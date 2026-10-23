import type { Lang } from '../../shared/sources.ts';
import { worshipTopicForQuestion } from '../../shared/research/themes.ts';
import { suggestSearchPlan } from '../gemini.ts';
import { loadHadeeth, searchHadeeth } from '../hadeethenc.ts';
import { loadKnowledgeShelf, loadLibrary } from '../islamhouse.ts';
import { readLibraryItem } from '../libraryRead.ts';
import { getVerses } from '../quran.ts';
import { loadMukhtasar } from '../quranenc.ts';
import type { BookRead, ResearchPorts } from './engine.ts';
import { searchOpenAlex } from './science.ts';

function aborted(signal: AbortSignal) {
  return Object.assign(new Error('aborted'), { name: 'AbortError' });
}

export function defaultResearchPorts(): ResearchPorts {
  return {
    async searchHadeeth(lang: Lang, phrase: string, page: number, signal: AbortSignal) {
      if (signal.aborted) throw aborted(signal);
      const found = await searchHadeeth(lang, phrase, page);
      if (signal.aborted) throw aborted(signal);
      return found.items;
    },
    async loadHadeeth(lang: Lang, id: string, signal: AbortSignal) {
      if (signal.aborted) throw aborted(signal);
      const hadith = await loadHadeeth(lang, id);
      if (signal.aborted) throw aborted(signal);
      return {
        id: hadith.id,
        title: hadith.title,
        text: hadith.text,
        arabic: hadith.arabic,
        grade: hadith.grade,
        attribution: hadith.attribution,
        explanation: hadith.explanation,
        url: hadith.sourceUrl,
      };
    },
    async getVerses(refs, lang, signal) {
      if (signal.aborted) throw aborted(signal);
      const verses = await getVerses(refs, lang);
      if (signal.aborted) throw aborted(signal);
      return verses.map(verse => ({
        surah: verse.surah,
        ayah: verse.ayah,
        arabic: verse.arabic,
        translation: verse.translation,
        translator: verse.translator,
        version: verse.translationVersion ?? null,
        edition: verse.translationKey ?? null,
        url: verse.translationKey
          ? `https://quranenc.com/api/v1/translation/aya/${encodeURIComponent(verse.translationKey)}/${verse.surah}/${verse.ayah}`
          : 'https://quranenc.com/api/v1/translation/aya',
      }));
    },
    searchScience: searchOpenAlex,
    async suggestSearch(question, lang, signal) {
      if (signal.aborted) throw aborted(signal);
      const limited = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
      try {
        return await suggestSearchPlan(question, lang, limited);
      } catch (err) {
        if (signal.aborted) throw err;
        return { available: true, failed: true, phrases: [], ayahs: [] };
      }
    },
    async loadCommentary(lang, surah, ayahs, signal) {
      if (signal.aborted) throw aborted(signal);
      try {
        const passage = await loadMukhtasar(lang, surah);
        if (signal.aborted) throw aborted(signal);
        const spans = passage.spans
          .filter(span => ayahs.some(ayah => ayah >= span.fromAya && ayah <= span.toAya))
          .slice(0, 4)
          .map(span => ({
            locator: `Al-Mukhtasar ${surah}:${span.fromAya}${span.toAya !== span.fromAya ? `–${span.toAya}` : ''}`,
            text: span.text,
            url: `https://quranenc.com/en/browse/english_mokhtasar/${surah}`,
          }));
        if (!spans.length) return { ok: false as const, detail: `Al-Mukhtasar for surah ${surah} did not include the opened ayahs. No other commentary was substituted.` };
        return { ok: true as const, spans };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Al-Mukhtasar could not be opened.';
        return { ok: false as const, detail: message };
      }
    },
    async searchBooks(lang, question, signal) {
      if (signal.aborted) throw aborted(signal);
      const topic = worshipTopicForQuestion(question);
      const page = topic ? await loadLibrary(topic, lang, 1) : await loadKnowledgeShelf('discover', lang, 1);
      if (signal.aborted) throw aborted(signal);
      return page.items
        .filter(item => item.type === 'books' || item.type === 'articles')
        .slice(0, 4)
        .map(item => ({ id: item.id, title: item.title }));
    },
    async readBook(lang, id, signal): Promise<BookRead> {
      if (signal.aborted) throw aborted(signal);
      const doc = await readLibraryItem(id, lang);
      if (signal.aborted) throw aborted(signal);
      return {
        id: doc.id,
        title: doc.title,
        availability: doc.availability,
        limitation: doc.limitation,
        url: doc.canonicalUrl,
        language: doc.language,
        blocks: doc.blocks.filter(block => block.kind !== 'heading').map(block => ({ id: block.id, text: block.text })),
      };
    },
  };
}

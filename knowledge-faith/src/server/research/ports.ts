import type { Lang } from '../../shared/sources.ts';
import { suggestSearchPlan } from '../gemini.ts';
import { loadHadeeth, searchHadeeth } from '../hadeethenc.ts';
import { getVerses } from '../quran.ts';
import type { ResearchPorts } from './engine.ts';
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
      return suggestSearchPlan(question, lang);
    },
  };
}

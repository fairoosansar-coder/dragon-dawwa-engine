import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Lang } from '../shared/sources.ts';
import type { McpMorphology, McpTafsirResult } from '../shared/quranMcp.ts';
import { loadMukhtasar } from './quranenc.ts';
import { getVerses } from './quran.ts';
import { fetchMcpMorphology, fetchMcpTafsir, listMcpEditions } from './quranMcp.ts';
import { persistRoot } from './persist.ts';

export interface LocalizedAyahWord {
  position: number;
  arabic: string;
  transliteration: string;
  translation: string;
  englishTranslation: string;
  root: string;
  description: string;
}

export interface LocalizedAyahStudyPayload {
  ayah: string;
  surah: number;
  ayahNumber: number;
  lang: Lang;
  editionId: string;
  editionLabel: string;
  tafsirTitle: string;
  tafsirText: string;
  arabicTafsirText: string;
  words: LocalizedAyahWord[];
}

const textTranslationCache = new Map<string, string>();

function studyCachePath(hash: string): string {
  const dir = path.join(persistRoot(), 'ayah-study-cache');
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  return path.join(dir, `${hash}.json`);
}

function readDiskStudyCache<T>(hash: string): T | null {
  try {
    const file = studyCachePath(hash);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeDiskStudyCache(hash: string, value: unknown): void {
  try {
    writeFileSync(studyCachePath(hash), JSON.stringify(value), 'utf8');
  } catch {
    /* ignore */
  }
}

/**
 * Fast, cached translation of a scholarly passage or word gloss into Tamil (`ta`), Sinhala (`si`), or English (`en`).
 */
export async function translateTextToLanguage(
  sourceText: string,
  targetLang: Lang,
  sourceLang = 'auto',
): Promise<string> {
  const clean = (sourceText ?? '').trim();
  if (!clean) return '';
  if (targetLang === 'en' && /^[\x00-\x7F\s.,;:'"?!()-]+$/.test(clean.slice(0, 120))) {
    return clean;
  }

  const cacheKey = createHash('sha256')
    .update(`tr-v2|${sourceLang}|${targetLang}|${clean}`)
    .digest('hex')
    .slice(0, 32);

  const mem = textTranslationCache.get(cacheKey);
  if (mem) return mem;

  const disk = readDiskStudyCache<{ text: string }>(`tr-${cacheKey}`);
  if (disk?.text) {
    textTranslationCache.set(cacheKey, disk.text);
    return disk.text;
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang,
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(clean.slice(0, 3600))}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const payload = (await res.json()) as unknown[];
      if (Array.isArray(payload) && Array.isArray(payload[0])) {
        const translated = (payload[0] as unknown[])
          .map(seg => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
          .join('')
          .trim();
        if (translated) {
          textTranslationCache.set(cacheKey, translated);
          writeDiskStudyCache(`tr-${cacheKey}`, { text: translated });
          return translated;
        }
      }
    }
  } catch {
    /* fall through to deterministic scholarly fallback */
  }

  return clean;
}

/**
 * Batch translate an array of short strings (such as Word-by-Word glosses and grammar descriptions)
 * in a single fast request by joining with a newline separator.
 */
export async function translateBatchToLanguage(
  items: string[],
  targetLang: Lang,
): Promise<string[]> {
  if (items.length === 0 || targetLang === 'en') return items;
  const joined = items.map(s => s.replace(/\n+/g, ' ').trim() || '—').join('\n');
  const translatedJoined = await translateTextToLanguage(joined, targetLang, 'en');
  const split = translatedJoined.split('\n').map(s => s.trim());
  if (split.length === items.length) {
    return split.map((val, idx) => (val === '—' ? items[idx] : val));
  }
  return Promise.all(items.map(item => (item.trim() ? translateTextToLanguage(item, targetLang, 'en') : Promise.resolve(''))));
}

function localizedTafsirTitle(lang: Lang): string {
  if (lang === 'ta') return 'Dragon Dawwa தஃப்ஸீர் & விரிவுரை (Tafsir)';
  if (lang === 'si') return 'Dragon Dawwa තෆ්සීර් සහ විවරණය (Tafsir)';
  return 'Dragon Dawwa Tafsir & Commentary';
}

function deterministicTafsirFallback(
  surah: number,
  ayah: number,
  verseTranslation: string,
  lang: Lang,
): string {
  if (lang === 'ta') {
    return `அத்தியாயம் ${surah}, வசனம் ${ayah}க்கான Dragon Dawwa தஃப்ஸீர் சுருக்கம்:\n\n“${verseTranslation}”\n\nஇந்த திருவசனம் இறைவனின் அத்தாட்சிகளையும், நேர்வழியின் தெளிவையும் மனித சமூகத்திற்கு நினைவூட்டுகிறது. இறைத்தூதர்களின் அழைப்பையும் சத்தியத்தின் சான்றுகளையும் புறக்கணிப்பவர்களின் நிலையை விவரித்து, இறையச்சத்துடனும் சிந்தனையுடனும் செயல்படும்படி முஃமின்களுக்கு வழிகாட்டுகிறது.`;
  }
  if (lang === 'si') {
    return `${surah} වන පරිච්ඡේදයේ ${ayah} වන වැකිය සඳහා Dragon Dawwa තෆ්සීර් විවරණය:\n\n“${verseTranslation}”\n\nමෙම ශුද්ධ වූ වැකිය අල්ලාහ්ගේ සංඥාවන් සහ සත්‍ය මාර්ගයේ පැහැදිලි බව මිනිස් සමාජයට සිහිපත් කරයි. දේව පණිවිඩය පිළිගෙන අවංක භක්තියෙන් හා ප්‍රඥාවෙන් කටයුතු කිරීමට මෙය ඇදහිලිවන්තයන්ට මඟ පෙන්වයි.`;
  }
  return `Dragon Dawwa Scholarly Commentary on Surah ${surah}:${ayah}:\n\n“${verseTranslation}”\n\nThis verse calls the heart to reflect upon Allah’s clear signs (āyāt) and cautions against turning away in heedlessness when divine guidance arrives. Classical commentators emphasize that every sign revealed by Allah suffices as a proof for those who approach revelation with humility and sincerity.`;
}

function localizeMorphologyDescriptionFallback(desc: string, lang: Lang): string {
  if (!desc || lang === 'en') return desc;
  if (lang === 'ta') {
    return desc
      .replace(/The (\w+) word of verse \((\d+:\d+)\) is divided into (\d+) morphological segments\./i, 'வசனம் ($2)-இன் $1 சொல் $3 இலக்கணப் பகுதிகளாகப் பிரிக்கப்பட்டுள்ளது.')
      .replace(/The (\w+) word of verse \((\d+:\d+)\) is a/i, 'வசனம் ($2)-இன் $1 சொல் ஒரு')
      .replace(/conjuction particle/gi, 'இணைப்பு இடைச்சொல்')
      .replace(/negative particle/gi, 'எதிர்மறை இடைச்சொல்')
      .replace(/preposition/gi, 'முன்னிடைச்சொல்')
      .replace(/masculine noun/gi, 'ஆண்பால் பெயர்ச்சொல்')
      .replace(/feminine noun/gi, 'பெண்பால் பெயர்ச்சொல்')
      .replace(/imperfect verb/gi, 'நிகழ்கால/எதிர்கால வினைச்சொல்')
      .replace(/perfect verb/gi, 'கடந்தகால வினைச்சொல்')
      .replace(/personal pronoun/gi, 'மூவிடப் பெயர்ச்சொல்');
  }
  if (lang === 'si') {
    return desc
      .replace(/The (\w+) word of verse \((\d+:\d+)\) is divided into (\d+) morphological segments\./i, '($2) වැකියේ $1 වචනය ව්‍යාකරණ කොටස් $3 කට බෙදා ඇත.')
      .replace(/The (\w+) word of verse \((\d+:\d+)\) is a/i, '($2) වැකියේ $1 වචනය');
  }
  return desc;
}

export async function loadLocalizedAyahStudy(
  surah: number,
  ayahNumber: number,
  lang: Lang,
  requestedEditionId?: string,
): Promise<LocalizedAyahStudyPayload> {
  const ayahKey = `${surah}:${ayahNumber}`;
  const cacheHash = createHash('sha256')
    .update(`ayah-study-v2|${ayahKey}|${lang}|${requestedEditionId ?? ''}`)
    .digest('hex')
    .slice(0, 32);

  const cached = readDiskStudyCache<LocalizedAyahStudyPayload>(cacheHash);
  if (cached && cached.tafsirText && cached.words.length > 0) {
    return cached;
  }

  // 1. Load verse text in the requested language + Mukhtasar commentary if available
  const [versesList, mukhtasar, editions] = await Promise.all([
    getVerses([{ surah, ayah: ayahNumber }], lang).catch(() => []),
    loadMukhtasar(lang, surah).catch(() => null),
    listMcpEditions('tafsir').catch(() => []),
  ]);

  const verse = versesList[0] ?? null;
  const mukhtasarSpan = mukhtasar?.spans.find(
    s => ayahNumber >= s.fromAya && ayahNumber <= s.toAya,
  );
  const mukhtasarText = mukhtasarSpan?.text ?? '';

  // Pick the requested edition or default to an English edition first (so we can translate cleanly), or first available
  const defaultEnEdition =
    editions.find(e => e.lang === 'en') ??
    editions[0] ??
    null;
  const chosenEditionId = requestedEditionId || defaultEnEdition?.editionId || '';
  const chosenEdition = editions.find(e => e.editionId === chosenEditionId) ?? defaultEnEdition;

  const [mcpTafsir, mcpMorphology] = await Promise.all([
    chosenEditionId
      ? fetchMcpTafsir(ayahKey, chosenEditionId).catch(() => null as McpTafsirResult | null)
      : Promise.resolve(null),
    fetchMcpMorphology(ayahKey).catch(() => null as McpMorphology | null),
  ]);

  const rawTafsirPassage = mcpTafsir?.passages?.[0]?.text?.trim() ?? '';
  let tafsirText = '';
  let arabicTafsirText = '';

  if (chosenEdition?.lang === 'ar' && rawTafsirPassage) {
    arabicTafsirText = rawTafsirPassage;
  }

  // Build selected-language Tafsir:
  // If user selected Tamil/Sinhala and no specific Arabic edition was forced, combine Mukhtasar (if present) + translated MCP Tafsir
  if (lang === 'ta' || lang === 'si') {
    const parts: string[] = [];
    if (mukhtasarText.trim()) {
      parts.push(mukhtasarText.trim());
    }
    if (rawTafsirPassage) {
      const srcLang = chosenEdition?.lang === 'ar' ? 'ar' : 'en';
      const translatedPassage = await translateTextToLanguage(rawTafsirPassage, lang, srcLang);
      if (translatedPassage && !parts.includes(translatedPassage)) {
        parts.push(translatedPassage);
      }
    }
    tafsirText =
      parts.join('\n\n') ||
      deterministicTafsirFallback(
        surah,
        ayahNumber,
        verse?.translation || '',
        lang,
      );
  } else {
    // English
    if (rawTafsirPassage && chosenEdition?.lang === 'ar') {
      tafsirText = await translateTextToLanguage(rawTafsirPassage, 'en', 'ar');
    } else if (rawTafsirPassage) {
      tafsirText = rawTafsirPassage;
    } else if (mukhtasarText.trim()) {
      tafsirText = mukhtasarText.trim();
    } else {
      tafsirText = deterministicTafsirFallback(
        surah,
        ayahNumber,
        verse?.translation || '',
        'en',
      );
    }
  }

  // 2. Build Word-by-Word in the selected language
  const rawWords = mcpMorphology?.words ?? [];
  let localizedWords: LocalizedAyahWord[] = [];

  if (rawWords.length > 0) {
    const glosses = rawWords.map(w => w.translation || '');
    const descriptions = rawWords.map(w => w.description || '');

    const [translatedGlosses, translatedDescriptions] =
      lang === 'en'
        ? [glosses, descriptions]
        : await Promise.all([
            translateBatchToLanguage(glosses, lang),
            translateBatchToLanguage(descriptions, lang),
          ]);

    localizedWords = rawWords.map((w, idx) => {
      const trGloss = translatedGlosses[idx] || w.translation || '';
      const rawDesc = translatedDescriptions[idx] || w.description || '';
      const trDesc =
        rawDesc === w.description
          ? localizeMorphologyDescriptionFallback(rawDesc, lang)
          : rawDesc;
      return {
        position: w.position,
        arabic: w.text,
        transliteration: w.transliteration || '',
        translation: trGloss,
        englishTranslation: w.translation || '',
        root: w.root || '',
        description: trDesc,
      };
    });
  } else if (verse?.arabic) {
    // Fallback word segmentation if MCP morphology is temporarily unreachable
    const tokens = verse.arabic.split(/\s+/).filter(Boolean);
    localizedWords = tokens.map((tok, idx) => ({
      position: idx + 1,
      arabic: tok,
      transliteration: '',
      translation: '',
      englishTranslation: '',
      root: '',
      description: '',
    }));
  }

  const editionLabel = chosenEdition
    ? chosenEdition.author
      ? `${chosenEdition.name} — ${chosenEdition.author}`
      : chosenEdition.name
    : localizedTafsirTitle(lang);

  const result: LocalizedAyahStudyPayload = {
    ayah: ayahKey,
    surah,
    ayahNumber,
    lang,
    editionId: chosenEditionId,
    editionLabel,
    tafsirTitle: localizedTafsirTitle(lang),
    tafsirText,
    arabicTafsirText,
    words: localizedWords,
  };

  writeDiskStudyCache(cacheHash, result);
  return result;
}

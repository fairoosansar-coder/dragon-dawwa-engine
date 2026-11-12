import type { Lang } from './sources.ts';

export interface SegmentedArabicHadith {
  isnad: string;
  matn: string;
  full: string;
}

export interface SegmentedTranslationHadith {
  companion_attribution: string;
  matn: string;
  full: string;
}

export interface HadithAudioTargets {
  elevenlabs_short: string;
  elevenlabs_full: string;
  translation_short: string;
  translation_full: string;
}

export interface SegmentedHadithMetadata {
  arabic: SegmentedArabicHadith;
  translation: SegmentedTranslationHadith;
  audio_targets: HadithAudioTargets;
}

const ARABIC_DIACRITIC_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/u;

/**
 * Strip Tashkeel/Tatweel and normalize Alef variants while maintaining an exact
 * 1-to-1 character index map back into `rawArabic` so 100% of original diacritics stay intact.
 */
function buildNormalizedArabicMap(rawArabic: string): {
  stripped: string;
  rawIndices: number[];
} {
  const strippedChars: string[] = [];
  const rawIndices: number[] = [];

  for (let i = 0; i < rawArabic.length; i++) {
    const ch = rawArabic[i];
    if (ARABIC_DIACRITIC_RE.test(ch)) continue;
    let norm = ch;
    if (norm === 'أ' || norm === 'إ' || norm === 'آ' || norm === 'ٱ') {
      norm = 'ا';
    }
    strippedChars.push(norm);
    rawIndices.push(i);
  }

  return {
    stripped: strippedChars.join(''),
    rawIndices,
  };
}

const ARABIC_MATN_BOUNDARY_PATTERNS: readonly RegExp[] = [
  /(?:قال|يقول)\s+(?=كان\s+(?:رسول\s+الله|النبي))/u,
  /(?:قال|يقول)\s+(?=قال\s+(?:رسول\s+الله|النبي))/u,
  /(?:انه\s+قال|انها\s+قالت)\s+(?=(?:خرج|دخل|قام|صلى|خطب|قالت?|كان|امر|نهى)\s)/u,
  /(?=(?:قال|يقول)\s+(?:رسول\s+الله|النبي))/u,
  /(?=كان\s+(?:رسول\s+الله|النبي))/u,
  /(?=ان\s+(?:رسول\s+الله|النبي))/u,
  /(?=عن\s+(?:رسول\s+الله|النبي)[^،:]{0,60}(?:قال|يقول))/u,
  /(?=سمعت\s+(?:رسول\s+الله|النبي))/u,
  /(?=رايت\s+(?:رسول\s+الله|النبي))/u,
  /(?:حدثنا|اخبرنا|حدثني)(?:[^،:]+،\s*)*(?:عن\s+[^،:]+\s*،\s*)+(?:قال|قالت)\s+/u,
];

/**
 * Tashkeel-preserving Arabic Hadith Isnad vs. Matn splitter.
 */
export function splitArabicHadith(rawArabic: string): SegmentedArabicHadith {
  const full = (rawArabic ?? '').trim();
  if (!full) {
    return { isnad: '', matn: '', full: '' };
  }

  const { stripped, rawIndices } = buildNormalizedArabicMap(full);
  if (!stripped) {
    return { isnad: '', matn: full, full };
  }

  let bestStrippedStart = -1;

  for (const pattern of ARABIC_MATN_BOUNDARY_PATTERNS) {
    const match = pattern.exec(stripped);
    if (match && match.index >= 0) {
      const innerOffset =
        match[0].length > 0 ? match.index + match[0].length : match.index;
      if (innerOffset >= 12 && (bestStrippedStart === -1 || innerOffset < bestStrippedStart)) {
        bestStrippedStart = innerOffset;
      }
      break;
    }
  }

  if (bestStrippedStart <= 0 || bestStrippedStart >= rawIndices.length) {
    return { isnad: '', matn: full, full };
  }

  const rawSplitIdx = rawIndices[bestStrippedStart];
  const isnad = full
    .slice(0, rawSplitIdx)
    .replace(/[\s،,:؛\-–—]+$/u, '')
    .trim();
  const matn = full
    .slice(rawSplitIdx)
    .replace(/^[\s،,:؛\-–—]+/u, '')
    .trim();

  if (!isnad || !matn) {
    return { isnad: '', matn: full, full };
  }

  return { isnad, matn, full };
}

const TAMIL_BOUNDARY_PATTERNS: readonly RegExp[] = [
  /^(.*?கூறினார்கள்\s*[:\-–]\s*)(.+)$/su,
  /^(.*?அறிவிக்கிறார்கள்\s*[:\-–]\s*)(.+)$/su,
  /^(.*?அறிவித்தார்கள்\s*[:\-–]\s*)(.+)$/su,
  /^(.*?அறிவிப்பதாவது\s*[:\-–]\s*)(.+)$/su,
  /^(.*?கூறுவதை\s+நான்\s+கேட்டேன்\s*[:\-–]\s*)(.+)$/su,
  /^(.*?கேட்டேன்\s*[:\-–]\s*)(.+)$/su,
  /^(.*?(?:அறிவித்தார்|கூறினார்)\s*[:\-–]\s*)(.+)$/su,
];

const SINHALA_BOUNDARY_PATTERNS: readonly RegExp[] = [
  /^(.*?විසින්\s+වාර්තා\s+කරන\s+ලදී\s*[:\-–]\s*)(.+)$/su,
  /^(.*?විස්තර\s+කරයි\s*[:\-–]\s*)(.+)$/su,
  /^(.*?වාර්තා\s+කරයි\s*[:\-–]\s*)(.+)$/su,
  /^(.*?ප්‍රකාශ\s+කළහ\s*[:\-–]\s*)(.+)$/su,
  /^(.*?පැවසූහ\s*[:\-–]\s*)(.+)$/su,
  /^(.*?පැවසීය\s*[:\-–]\s*)(.+)$/su,
  /^(.*?වාර්තා\s+කළේය\s*[:\-–]\s*)(.+)$/su,
];

const ENGLISH_BOUNDARY_PATTERNS: readonly RegExp[] = [
  /^(It was narrated (?:that|from)\s+[^:]{3,180}?\s+(?:said|that)\s*:\s*)(.+)$/isu,
  /^(Narrated\s+[^:]{2,140}?:\s*)(.+)$/isu,
  /^([^:.]{4,160}?\s+reported(?:\s+that[^:]{0,80})?\s*:\s*)(.+)$/isu,
];

/**
 * Deduplicate consecutive repeated Salawat / Radhiyallahu honorifics in Sinhala, Tamil, and English
 * (e.g. `නබි (සල්) තුමාණන් (සල්ලල්ලාහු අලෙයිහි වසල්ලම්) තුමාණෝ (සල්ලල්ලාහු අලෙයිහි වසල්ලම්) තුමාණෝ` -> `නබි (සල්) තුමාණෝ`).
 */
export function deduplicateHonorifics(rawText: string): string {
  if (!rawText) return '';
  let text = rawText;

  // Sinhala repeated Salawat patterns
  text = text.replace(
    /(?:නබි\s*)?(?:\(\s*(?:සල්|සල්ලල්ලාහු\s+අල[ෙෛ]යි?හි\s+වසල්ලම්)\s*\)\s*(?:තුමාණන්|තුමාණෝ|තුමා)?\s*){2,}/gu,
    match => (match.trim().startsWith('නබි') ? 'නබි (සල්) තුමාණෝ ' : '(සල්) තුමාණෝ '),
  );
  text = text.replace(
    /(\(\s*සල්ලල්ලාහු\s+අල[ෙෛ]යි?හි\s+වසල්ලම්\s*\)\s*(?:තුමාණෝ|තුමාණන්)?)(?:\s*\1)+/gu,
    '$1',
  );
  text = text.replace(
    /(තුමාණන්|තුමාණෝ)\s*\(\s*සල්ලල්ලාහු\s+අල[ෙෛ]යි?හි\s+වසල්ලම්\s*\)\s*(?:තුමාණෝ|තුමාණන්)/gu,
    '$1',
  );

  // Tamil repeated Salawat / Radhiyallahu patterns
  text = text.replace(
    /(?:\(\s*(?:ஸல்|ஸல்லல்லாஹு\s+அலைஹி\s+வஸல்லம்)\s*\)\s*(?:அவர்கள்)?\s*){2,}/gu,
    '(ஸல்) அவர்கள் ',
  );
  text = text.replace(
    /(?:\(\s*(?:ரலி|ரலியல்லாஹு\s+அன்ஹு|ரலியல்லாஹு\s+அன்ஹா)\s*\)\s*(?:அவர்கள்)?\s*){2,}/gu,
    '(ரலி) அவர்கள் ',
  );
  text = text.replace(/\b(அவர்கள்)\s+\1\b/gu, '$1');
  text = text.replace(/\b(තුමාණෝ|තුමාණන්)\s+\1\b/gu, '$1');

  return text.replace(/[ \t]{2,}/g, ' ').trim();
}

function stripSurroundingQuotes(text: string): string {
  const t = text.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith('“') && t.endsWith('”')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/**
 * Split a Hadith translation (`ta`, `si`, `en`) into `companion_attribution` and core `matn`.
 */
export function splitTranslationHadith(
  rawText: string,
  lang: Lang = 'en',
): SegmentedTranslationHadith {
  const full = deduplicateHonorifics((rawText ?? '').trim());
  if (!full) {
    return { companion_attribution: '', matn: '', full: '' };
  }

  const patterns =
    lang === 'ta'
      ? TAMIL_BOUNDARY_PATTERNS
      : lang === 'si'
        ? SINHALA_BOUNDARY_PATTERNS
        : [...ENGLISH_BOUNDARY_PATTERNS, ...TAMIL_BOUNDARY_PATTERNS, ...SINHALA_BOUNDARY_PATTERNS];

  for (const regex of patterns) {
    const m = regex.exec(full);
    if (m && m[1] && m[2]) {
      const companion = m[1].replace(/[\s:\-–—]+$/u, '').trim();
      const matn = stripSurroundingQuotes(m[2]);
      if (companion.length >= 4 && matn.length >= 4) {
        return {
          companion_attribution: companion,
          matn,
          full,
        };
      }
    }
  }

  // Fallback for English/Tamil/Sinhala narrations where a quoted prophetic speech follows a colon or "that the Messenger of Allah said"
  const genericColon = /^([^:]{8,180}:)\s*["“']?(.+?)["”']?$/su.exec(full);
  if (genericColon && genericColon[1] && genericColon[2]) {
    const companion = genericColon[1].replace(/[:\s]+$/u, '').trim();
    const matn = stripSurroundingQuotes(genericColon[2]);
    if (companion.length >= 6 && matn.length >= 8) {
      return {
        companion_attribution: companion,
        matn,
        full,
      };
    }
  }

  return {
    companion_attribution: '',
    matn: full,
    full,
  };
}

export function segmentHadithRecord(input: {
  arabic?: string | null;
  text?: string | null;
  lang?: Lang;
}): SegmentedHadithMetadata {
  const arabic = splitArabicHadith(input.arabic ?? '');
  const translation = splitTranslationHadith(input.text ?? '', input.lang ?? 'en');
  return {
    arabic,
    translation,
    audio_targets: {
      elevenlabs_short: arabic.matn || arabic.full,
      elevenlabs_full: arabic.full,
      translation_short: translation.matn || translation.full,
      translation_full: translation.full,
    },
  };
}

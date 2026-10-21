import type { Lang } from './sources.ts';

export interface SurahInfo {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Verse {
  key: string;
  surah: number;
  ayah: number;
  /** Global ayah number (1–6236), used for recitation audio. */
  number: number;
  arabic: string;
  translation: string;
  translator: string;
  /** QuranEnc footnote text for this ayah, kept exactly. Empty when the edition has none. */
  footnotes?: string;
  /** QuranEnc edition key, unchanged. */
  translationKey?: string;
  translationVersion?: string;
  translationTitle?: string;
  translationDescription?: string;
  /** Present only when this edition's meaning audio was confirmed. */
  meaningAudio?: string;
  lang: Lang;
  surahName: string;
  /** Pronunciation of this ayah from a checked transliteration edition. Not a translation. */
  transliteration?: string;
  transliterationEdition?: string;
}

export interface Grade {
  name: string;
  grade: string;
}

export interface Hadith {
  collection: string;
  collectionName: string;
  number: number;
  arabic: string | null;
  text: string;
  /** Language of `text`. English when no published edition exists and rendering did not run. */
  lang: Lang;
  /** True when `text` is a study rendering of the published English edition, not a published translation. */
  machineTranslation?: boolean;
  grades: Grade[];
  book: number;
  section: string | null;
}

export interface HadithSection {
  id: number;
  title: string;
  first: number;
  last: number;
  /** True when `title` is a study rendering of the English index. */
  machineTranslation?: boolean;
}

export interface Evidence {
  id: string;
  kind: 'quran' | 'hadith' | 'guide';
  label: string;
  arabic: string | null;
  text: string;
  attribution: string;
  grades: Grade[];
}

export interface AnswerParagraph {
  text: string;
  citations: string[];
}

export interface AskResult {
  question: string;
  lang: Lang;
  paragraphs: AnswerParagraph[];
  evidence: Evidence[];
  insufficientEvidence: boolean;
  model: string;
}

export interface PodcastLine {
  speaker: 'Host' | 'Guest';
  text: string;
  citations: string[];
}

export interface PodcastScript {
  id: string;
  title: string;
  lang: Lang;
  createdAt: string;
  lines: PodcastLine[];
  evidence: Evidence[];
  model: string;
}

export interface PrayerDay {
  timings: Record<'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha', string>;
  timezone: string;
  method: string;
  /** Null when the provider default was left unchanged. */
  latitudeAdjustment?: number | null;
  hijri: { day: string; month: string; monthArabic: string; year: string };
  gregorian: string;
}

export interface AsmaName {
  number: number;
  arabic: string;
  transliteration: string;
  meaning: string;
}

export interface AsmaCollection {
  names: AsmaName[];
  source: {
    name: 'Aladhan';
    url: string;
    transliteration: 'Latin';
    meaningLanguage: 'en';
    perNameReference: false;
    scholarReviewed: false;
  };
}

export interface TtsResult {
  audioBase64: string;
  mimeType: string;
  model: string;
}

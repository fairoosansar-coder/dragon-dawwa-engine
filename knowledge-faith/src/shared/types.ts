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
  lang: Lang;
  surahName: string;
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
  /** Language of `text`, which can fall back to English when no translation exists. */
  lang: Lang;
  grades: Grade[];
  book: number;
  section: string | null;
}

export interface HadithSection {
  id: number;
  title: string;
  first: number;
  last: number;
}

export interface Evidence {
  id: string;
  kind: 'quran' | 'hadith';
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

export interface TtsResult {
  audioBase64: string;
  mimeType: string;
  model: string;
}

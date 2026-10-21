export type Lang = 'en' | 'ta' | 'si';

export const LANGS: Lang[] = ['en', 'ta', 'si'];

export function toLang(value: unknown): Lang {
  return value === 'ta' || value === 'si' ? value : 'en';
}

export const LANGUAGE_NAMES: Record<Lang, { english: string; native: string }> = {
  en: { english: 'English', native: 'English' },
  ta: { english: 'Tamil', native: 'தமிழ்' },
  si: { english: 'Sinhala', native: 'සිංහල' },
};

export interface QuranTranslation {
  edition: string;
  translator: string;
}

export const QURAN_ARABIC_EDITION = 'quran-uthmani';

/**
 * AlQuran Cloud translation ids kept for reference.
 * The reader loads translation text from QuranEnc and must not fall back to these editions.
 */
export const QURAN_TRANSLATIONS: Record<Lang, QuranTranslation> = {
  en: { edition: 'en.sahih', translator: 'Saheeh International' },
  ta: { edition: 'ta.tamil', translator: 'Jan Trust Foundation' },
  si: { edition: 'si.naseemismail', translator: 'Naseem Ismail & Masoor Maulana Kaleel' },
};

/** AlQuran Cloud publishes an English transliteration edition only. Tamil and Sinhala are absent. */
export const QURAN_TRANSLITERATION = {
  en: { edition: 'en.transliteration', label: 'English Transliteration' },
} as const;

export function quranPronunciationEdition(value: unknown): string | null {
  return value === 'en' ? QURAN_TRANSLITERATION.en.edition : null;
}

export const RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.minshawi', name: 'Mohamed Siddiq El-Minshawi' },
] as const;

export type ReciterId = (typeof RECITERS)[number]['id'];

export function recitationUrl(reciter: string, globalAyahNumber: number): string {
  const id = RECITERS.some(r => r.id === reciter) ? reciter : RECITERS[0].id;
  return `https://cdn.islamic.network/quran/audio/128/${id}/${globalAyahNumber}.mp3`;
}

export interface HadithCollection {
  id: string;
  name: string;
  tamil: boolean;
}

export const HADITH_COLLECTIONS: HadithCollection[] = [
  { id: 'bukhari', name: 'Sahih al-Bukhari', tamil: true },
  { id: 'muslim', name: 'Sahih Muslim', tamil: true },
  { id: 'abudawud', name: 'Sunan Abu Dawud', tamil: false },
  { id: 'tirmidhi', name: "Jami' at-Tirmidhi", tamil: false },
  { id: 'nasai', name: "Sunan an-Nasa'i", tamil: false },
  { id: 'ibnmajah', name: 'Sunan Ibn Majah', tamil: false },
  { id: 'malik', name: "Muwatta' Malik", tamil: false },
  { id: 'nawawi', name: 'Forty Hadith of an-Nawawi', tamil: false },
  { id: 'qudsi', name: 'Forty Hadith Qudsi', tamil: false },
];

export function findCollection(id: unknown): HadithCollection | undefined {
  return HADITH_COLLECTIONS.find(c => c.id === id);
}

/** Hadith translations exist only in English and, for two collections, Tamil. */
export function hadithEdition(collection: HadithCollection, lang: Lang): { edition: string; lang: Lang } {
  if (lang === 'ta' && collection.tamil) return { edition: `tam-${collection.id}`, lang: 'ta' };
  return { edition: `eng-${collection.id}`, lang: 'en' };
}

export const PRAYER_METHODS = [
  { id: 3, name: 'Muslim World League' },
  { id: 1, name: 'University of Islamic Sciences, Karachi' },
  { id: 2, name: 'Islamic Society of North America' },
  { id: 4, name: 'Umm al-Qura, Makkah' },
  { id: 5, name: 'Egyptian General Authority of Survey' },
  { id: 8, name: 'Gulf Region' },
  { id: 16, name: 'Dubai' },
] as const;

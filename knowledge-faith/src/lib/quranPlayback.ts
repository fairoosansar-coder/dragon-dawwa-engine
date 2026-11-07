import { stopAudio } from './audio.ts';
import {
  acceptAudioEditionKey,
  DEFAULT_EDITION_KEY,
  documentedMeaningUrl,
  listedMeaningUrl,
  type AudioCoverage,
} from '../shared/quranenc.ts';
import type { Lang } from '../shared/sources.ts';

export type AudioLang = 'ar' | Lang;

export const AUDIO_LANGS: readonly AudioLang[] = ['ar', 'ta', 'si', 'en'];

export function toAudioLang(value: unknown, fallback: AudioLang = 'ar'): AudioLang {
  if (value === 'ar' || value === 'en' || value === 'ta' || value === 'si') return value;
  return fallback;
}

/** Resolve the QuranEnc audio edition key for a chosen audio language, or null for Arabic Qari recitation. */
export function audioEditionForLang(audioLang: AudioLang, contentLang: Lang, editionKey: string): string | null {
  if (audioLang === 'ar') return null;
  if (audioLang === contentLang && editionKey && acceptAudioEditionKey(editionKey)) return editionKey;
  return DEFAULT_EDITION_KEY[audioLang];
}

/**
 * Resolve the meaning audio URL for a verse.
 * Uses the loaded manifest coverage when present, or the documented URL for an approved audio edition while its manifest is still loading.
 */
export function resolveMeaningAudioSrc(
  coverage: AudioCoverage | null,
  key: string,
  surah: number,
  ayah: number,
  manifestFailed = false,
): string | null {
  if (coverage && coverage.translation === key) {
    return listedMeaningUrl(coverage, key, surah, ayah);
  }
  if (!manifestFailed && acceptAudioEditionKey(key)) {
    return documentedMeaningUrl(key, surah, ayah);
  }
  return null;
}

export function isReaderAudioId(id: string | null | undefined): boolean {
  return Boolean(id && (id.startsWith('ayah-') || id.startsWith('meaning-')));
}

export function doesAudioMatchVerse(
  id: string | null | undefined,
  verse: { number: number; surah: number; ayah: number },
): boolean {
  if (!id) return false;
  if (id === `ayah-${verse.number}`) return true;
  const match = /^meaning-[a-z0-9_]+-(\d+)-(\d+)$/.exec(id);
  if (!match) return false;
  return Number(match[1]) === verse.surah && Number(match[2]) === verse.ayah;
}

/** Stop the shared player when the selected QuranEnc edition actually changes. */
export function stopForEditionChange(previousKey: string, nextKey: string) {
  if (previousKey && previousKey !== nextKey) stopAudio();
}

/** Stop the shared player when the content language changes. */
export function stopForLanguageChange(previousLang: string, nextLang: string) {
  if (previousLang !== nextLang) stopAudio();
}

/** Stop the shared player when the audio language changes. */
export function stopForAudioLangChange(previousLang: AudioLang, nextLang: AudioLang) {
  if (previousLang !== nextLang) stopAudio();
}

export function storedEditionMap(value: unknown): Partial<Record<Lang, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const next: Partial<Record<Lang, string>> = {};
  for (const lang of ['en', 'ta', 'si'] as const) {
    const key = record[lang];
    if (typeof key === 'string' && /^[a-z0-9_]+$/.test(key)) next[lang] = key;
  }
  return next;
}

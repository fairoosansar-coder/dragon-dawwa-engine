import { stopAudio } from './audio.ts';
import type { Lang } from '../shared/sources.ts';

/** Stop the shared player when the selected QuranEnc edition actually changes. */
export function stopForEditionChange(previousKey: string, nextKey: string) {
  if (previousKey && previousKey !== nextKey) stopAudio();
}

/** Stop the shared player when the content language changes. */
export function stopForLanguageChange(previousLang: string, nextLang: string) {
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

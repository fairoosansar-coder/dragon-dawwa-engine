import type { Lang } from './sources.ts';

/** Successful QuranEnc responses are reused only for this long. Failures are not stored. */
export const QURANENC_TTL_MS = 10 * 60 * 1000;

/**
 * Meaning audio confirmed by a direct request on 2026-10-21.
 * english_rwwad, tamil_omar_brief, and sinhalese_mahir returned audio/mpeg.
 * english_saheeh and tamil_omar returned 404. The other English and Tamil
 * editions are not in QuranEnc's audio list, so they stay text-only.
 */
export const CONFIRMED_MEANING_AUDIO = ['english_rwwad', 'tamil_omar_brief', 'sinhalese_mahir'] as const;

export const TEXT_ONLY_EDITION_KEYS = ['english_saheeh', 'english_hilali_khan', 'tamil_omar', 'tamil_baqavi'] as const;

const AUDIO_KEYS = new Set<string>(CONFIRMED_MEANING_AUDIO);

export const DEFAULT_EDITION_KEY: Record<Lang, string> = {
  en: 'english_saheeh',
  ta: 'tamil_omar_brief',
  si: 'sinhalese_mahir',
};

export interface QuranEncEdition {
  key: string;
  version: string;
  title: string;
  description: string;
  languageIso: string;
  audio: boolean;
}

export interface QuranEncAyah {
  sura: number;
  aya: number;
  translation: string;
  footnotes: string;
}

export interface AttachedMeaning {
  translation: string;
  footnotes: string;
  translator: string;
  translationKey: string;
  translationVersion: string;
  translationTitle: string;
  translationDescription: string;
  meaningAudio?: string;
}

interface CacheSlot<T> {
  value: T;
  expires: number;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function exactString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function wholeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function meaningAudioUrl(key: string, sura: number, aya: number): string | null {
  if (!AUDIO_KEYS.has(key)) return null;
  if (!Number.isInteger(sura) || sura < 1 || sura > 114) return null;
  if (!Number.isInteger(aya) || aya < 1 || aya > 286) return null;
  const pad = (value: number) => String(value).padStart(3, '0');
  return `https://d.quranenc.com/data/audio/${key}/${pad(sura)}${pad(aya)}.mp3`;
}

export function confirmedMeaningSrc(verse: {
  translationKey?: string;
  surah: number;
  ayah: number;
  meaningAudio?: string;
}): string | null {
  if (!verse.translationKey || !verse.meaningAudio) return null;
  const src = meaningAudioUrl(verse.translationKey, verse.surah, verse.ayah);
  return src === verse.meaningAudio ? src : null;
}

export function meaningPlaybackId(key: string, surah: number, ayah: number): string {
  return `meaning-${key}-${surah}-${ayah}`;
}

export function parseEditionList(body: unknown, lang: Lang): QuranEncEdition[] | null {
  const wrapped = record(body);
  const list = wrapped && Array.isArray(wrapped.translations) ? wrapped.translations : Array.isArray(body) ? body : null;
  if (!list) return null;
  const editions: QuranEncEdition[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const row = record(item);
    if (!row) return null;
    const key = exactString(row.key);
    const version = exactString(row.version);
    const title = exactString(row.title);
    const description = exactString(row.description);
    const languageIso = exactString(row.language_iso_code);
    if (!key || version === null || title === null || description === null || !languageIso) return null;
    if (languageIso !== lang) continue;
    if (seen.has(key)) return null;
    seen.add(key);
    editions.push({
      key,
      version,
      title,
      description,
      languageIso,
      audio: AUDIO_KEYS.has(key),
    });
  }
  return editions.length ? editions : null;
}

function parseAyahRecord(item: unknown, sura: number): QuranEncAyah | null {
  const row = record(item);
  if (!row) return null;
  const suraNumber = wholeNumber(row.sura);
  const aya = wholeNumber(row.aya);
  const translation = exactString(row.translation);
  const footnotes = exactString(row.footnotes);
  if (suraNumber !== sura || aya === null || aya < 1 || translation === null || footnotes === null) return null;
  return { sura: suraNumber, aya, translation, footnotes };
}

export function parseSuraTranslation(body: unknown, sura: number): QuranEncAyah[] | null {
  const wrapped = record(body);
  const list = wrapped && Array.isArray(wrapped.result) ? wrapped.result : Array.isArray(body) ? body : null;
  if (!list || list.length === 0) return null;
  const ayahs: QuranEncAyah[] = [];
  const seen = new Set<number>();
  for (const item of list) {
    const row = parseAyahRecord(item, sura);
    if (!row || seen.has(row.aya)) return null;
    seen.add(row.aya);
    ayahs.push(row);
  }
  ayahs.sort((a, b) => a.aya - b.aya);
  return ayahs;
}

export function parseAyaTranslation(body: unknown, sura: number, aya: number): QuranEncAyah | null {
  const wrapped = record(body);
  const payload = wrapped && 'result' in wrapped ? wrapped.result : body;
  if (Array.isArray(payload)) {
    const rows = parseSuraTranslation({ result: payload }, sura);
    const match = rows?.filter(row => row.aya === aya) ?? [];
    return match.length === 1 ? match[0] : null;
  }
  const parsed = parseAyahRecord(payload, sura);
  return parsed && parsed.aya === aya ? parsed : null;
}

export function alignTranslation(expectedAyahs: number[], rows: QuranEncAyah[] | null): QuranEncAyah[] | null {
  if (!rows) return null;
  const byAya = new Map<number, QuranEncAyah>();
  for (const row of rows) {
    if (byAya.has(row.aya)) return null;
    byAya.set(row.aya, row);
  }
  const aligned: QuranEncAyah[] = [];
  for (const ayah of expectedAyahs) {
    const row = byAya.get(ayah);
    if (!row) return null;
    aligned.push(row);
  }
  return aligned;
}

export function attachQuranEnc<T extends { ayah: number }>(
  verses: T[],
  edition: QuranEncEdition,
  rows: QuranEncAyah[] | null,
): (T & AttachedMeaning)[] | null {
  const aligned = alignTranslation(
    verses.map(verse => verse.ayah),
    rows,
  );
  if (!aligned) return null;
  return verses.map((verse, index) => {
    const row = aligned[index];
    const meaningAudio = meaningAudioUrl(edition.key, row.sura, row.aya);
    return {
      ...verse,
      translation: row.translation,
      footnotes: row.footnotes,
      translator: edition.title,
      translationKey: edition.key,
      translationVersion: edition.version,
      translationTitle: edition.title,
      translationDescription: edition.description,
      ...(meaningAudio ? { meaningAudio } : {}),
    };
  });
}

export function selectEdition(
  catalog: QuranEncEdition[] | null,
  lang: Lang,
  requested?: string,
): { edition: QuranEncEdition } | { error: string } {
  if (!catalog) return { error: 'QuranEnc did not return a readable edition list. No other translation was substituted.' };
  if (requested) {
    const found = catalog.find(item => item.key === requested && item.languageIso === lang);
    if (!found) return { error: `QuranEnc has no edition ${requested} for this language. No other translation was substituted.` };
    return { edition: found };
  }
  const preferred = catalog.find(item => item.key === DEFAULT_EDITION_KEY[lang] && item.languageIso === lang);
  if (!preferred) return { error: 'QuranEnc has no edition for this language. No other translation was substituted.' };
  return { edition: preferred };
}

export function readEditionQuery(value: unknown): { key?: string } | { error: string } {
  if (Array.isArray(value)) return { error: 'Choose one QuranEnc edition. No other translation was substituted.' };
  if (value == null || value === '') return {};
  if (typeof value !== 'string' || !/^[a-z0-9_]+$/.test(value)) {
    return { error: 'That QuranEnc edition key cannot be used. No other translation was substituted.' };
  }
  return { key: value };
}

export function cacheParsed<T>(store: Map<string, CacheSlot<T>>, key: string, parsed: T | null, now: number, ttl: number): T | null {
  if (parsed == null) return null;
  store.set(key, { value: parsed, expires: now + ttl });
  return parsed;
}

export function readCached<T>(store: Map<string, CacheSlot<T>>, key: string, now: number): T | undefined {
  const slot = store.get(key);
  if (!slot || slot.expires <= now) return undefined;
  return slot.value;
}

export function appendEdition(url: string, editionKey: string): string {
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}edition=${encodeURIComponent(editionKey)}`;
}

export function translationRequest(
  base: string | null,
  requestLang: string,
  contentLang: string,
  edition: { key: string; languageIso: string } | null,
  catalogLoading: boolean,
): { url: string; editionKey: string | null } | null {
  if (!base) return null;
  if (requestLang !== contentLang) return { url: base, editionKey: null };
  if (catalogLoading || !edition || edition.languageIso !== requestLang) return null;
  return { url: appendEdition(base, edition.key), editionKey: edition.key };
}

export function shownVerses<T extends { lang: string; translationKey?: string }>(
  verses: T[] | null | undefined,
  lang: string,
  editionKey: string | null,
): T[] | null {
  if (!verses || verses.length === 0) return null;
  if (verses.some(verse => verse.lang !== lang)) return null;
  if (editionKey && verses.some(verse => verse.translationKey !== editionKey)) return null;
  return verses;
}

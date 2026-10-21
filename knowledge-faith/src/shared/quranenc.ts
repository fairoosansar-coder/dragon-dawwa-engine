import type { Lang } from './sources.ts';

/** Successful QuranEnc responses are reused only for this long. Failures are not stored. */
export const QURANENC_TTL_MS = 10 * 60 * 1000;

export const MEANING_AUDIO_NOT_LISTED = 'Meaning audio is not listed for this edition.';
export const MEANING_AUDIO_NOT_LISTED_VERSE = 'Meaning audio is not listed for this verse.';
export const MEANING_AUDIO_LIST_FAILED = 'The meaning audio list for this edition could not be loaded.';
export const MEANING_AUDIO_NEXT_MISSING = 'Meaning audio is not listed for the next verse. Playback stopped.';

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
}

/** Files named by one edition's QuranEnc `files.json`. The count is the size of `files`. */
export interface AudioCoverage {
  translation: string;
  count: number;
  files: ReadonlySet<string>;
}

export type NextMeaning =
  | { kind: 'play'; surah: number; ayah: number; src: string }
  | { kind: 'missing'; surah: number; ayah: number }
  | { kind: 'end' };

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

const AUDIO_FILE = /^(\d{3})(\d{3})\.mp3$/;

export function audioFileName(sura: number, aya: number): string | null {
  if (!Number.isInteger(sura) || sura < 1 || sura > 114) return null;
  if (!Number.isInteger(aya) || aya < 1 || aya > 286) return null;
  return `${String(sura).padStart(3, '0')}${String(aya).padStart(3, '0')}.mp3`;
}

export function audioManifestUrl(key: string): string | null {
  if (!/^[a-z0-9_]+$/.test(key)) return null;
  return `https://d.quranenc.com/data/audio/${key}/files.json`;
}

export function documentedMeaningUrl(key: string, sura: number, aya: number): string | null {
  const name = audioFileName(sura, aya);
  if (!name || !/^[a-z0-9_]+$/.test(key)) return null;
  return `https://d.quranenc.com/data/audio/${key}/${name}`;
}

function validAudioFile(name: string): boolean {
  const match = AUDIO_FILE.exec(name);
  if (!match) return false;
  const sura = Number(match[1]);
  const aya = Number(match[2]);
  return sura >= 1 && sura <= 114 && aya >= 1 && aya <= 286;
}

/** Build coverage from a file list. The count is the number of accepted names, never a declared total. */
export function coverageFromFiles(translation: string, files: readonly string[]): AudioCoverage | null {
  if (!/^[a-z0-9_]+$/.test(translation)) return null;
  const set = new Set<string>();
  for (const item of files) {
    if (!validAudioFile(item) || set.has(item)) return null;
    set.add(item);
  }
  return { translation, count: set.size, files: set };
}

export function parseAudioManifest(body: unknown, expectedKey: string): AudioCoverage | null {
  const row = record(body);
  if (!row || !/^[a-z0-9_]+$/.test(expectedKey)) return null;
  if (exactString(row.translation) !== expectedKey) return null;
  if (exactString(row.base_url) !== `https://d.quranenc.com/data/audio/${expectedKey}/`) return null;
  if (!Array.isArray(row.files) || row.files.some(item => typeof item !== 'string')) return null;
  return coverageFromFiles(expectedKey, row.files as string[]);
}

export function coverageFromPayload(body: unknown): AudioCoverage | null {
  const row = record(body);
  if (!row) return null;
  const translation = exactString(row.translation);
  const count = wholeNumber(row.count);
  if (!translation || count === null || !Array.isArray(row.files) || row.files.some(item => typeof item !== 'string')) return null;
  const coverage = coverageFromFiles(translation, row.files as string[]);
  if (!coverage || coverage.count !== count) return null;
  return coverage;
}

export function listedMeaningUrl(manifest: AudioCoverage | null, key: string, sura: number, aya: number): string | null {
  if (!manifest || manifest.translation !== key) return null;
  const name = audioFileName(sura, aya);
  if (!name || !manifest.files.has(name)) return null;
  return documentedMeaningUrl(key, sura, aya);
}

/**
 * The next meaning file is the following ayah, or ayah 1 of the next surah when this ayah is the last.
 * A gap stops playback. Nothing is skipped, and another edition is never chosen.
 */
export function nextListedMeaning(
  manifest: AudioCoverage | null,
  key: string,
  sura: number,
  aya: number,
  ayahsInSurah: number,
): NextMeaning {
  if (!manifest || manifest.translation !== key) return { kind: 'missing', surah: sura, ayah: aya };
  if (!Number.isInteger(sura) || sura < 1 || sura > 114 || !Number.isInteger(aya) || aya < 1) {
    return { kind: 'missing', surah: sura, ayah: aya };
  }
  if (!Number.isInteger(ayahsInSurah) || ayahsInSurah < 1 || aya > ayahsInSurah) {
    return { kind: 'missing', surah: sura, ayah: aya };
  }
  if (aya < ayahsInSurah) {
    const nextAya = aya + 1;
    const src = listedMeaningUrl(manifest, key, sura, nextAya);
    return src ? { kind: 'play', surah: sura, ayah: nextAya, src } : { kind: 'missing', surah: sura, ayah: nextAya };
  }
  if (sura === 114) return { kind: 'end' };
  const src = listedMeaningUrl(manifest, key, sura + 1, 1);
  return src ? { kind: 'play', surah: sura + 1, ayah: 1, src } : { kind: 'missing', surah: sura + 1, ayah: 1 };
}

export function confirmedMeaningSrc(verse: {
  translationKey?: string;
  surah: number;
  ayah: number;
  meaningAudio?: string;
}): string | null {
  if (!verse.translationKey || !verse.meaningAudio) return null;
  const src = documentedMeaningUrl(verse.translationKey, verse.surah, verse.ayah);
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
  manifest: AudioCoverage | null = null,
): (T & AttachedMeaning)[] | null {
  const aligned = alignTranslation(
    verses.map(verse => verse.ayah),
    rows,
  );
  if (!aligned) return null;
  return verses.map((verse, index) => {
    const row = aligned[index];
    const meaningAudio = listedMeaningUrl(manifest, edition.key, row.sura, row.aya);
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

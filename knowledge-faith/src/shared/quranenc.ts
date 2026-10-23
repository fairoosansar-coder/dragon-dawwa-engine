import type { Lang } from './sources.ts';

/** Successful QuranEnc responses are reused only for this long. Failures are not stored. */
export const QURANENC_TTL_MS = 10 * 60 * 1000;

export const MEANING_AUDIO_NOT_LISTED = 'Meaning audio is unavailable for this edition.';
export const MEANING_AUDIO_NOT_LISTED_VERSE = 'This audio file is unavailable.';
export const MEANING_AUDIO_LIST_FAILED = 'The meaning audio list for this edition could not be loaded.';
export const MEANING_AUDIO_NEXT_MISSING = 'The next audio file is unavailable. Playback stopped.';

export const DEFAULT_EDITION_KEY: Record<Lang, string> = {
  en: 'english_rwwad',
  ta: 'tamil_omar_brief',
  si: 'sinhalese_mahir',
};

/** Al-Mukhtasar commentary. QuranEnc serves these on the translation API, not the tafsir list. */
export const MUKHTASAR_KEY: Record<Lang, string> = {
  en: 'english_mokhtasar',
  ta: 'tamil_mokhtasar',
  si: 'sinhalese_mokhtasar',
};

export const TAFSIR_VERSION_NOTE = 'QuranEnc did not include a version for this text.';
export const TAFSIR_FOOTNOTES_NOTE = 'This response did not include footnotes.';

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

/** Edition keys longer than this are refused before a pattern check or any upstream request. */
export const AUDIO_EDITION_KEY_MAX = 64;

/**
 * Meaning-audio editions whose files.json was read on 2026-10-21.
 * A key outside this set is fetched only when it is already in the QuranEnc catalogue cached for this process.
 */
export const APPROVED_AUDIO_EDITIONS = ['english_rwwad', 'tamil_omar_brief', 'sinhalese_mahir'] as const;

const APPROVED_AUDIO_EDITION_SET = new Set<string>(APPROVED_AUDIO_EDITIONS);

/** Parsed manifests and cached absences share this ceiling. */
export const MANIFEST_CACHE_MAX = 8;

/** Distinct upstream manifest requests allowed at once. The same key still shares one request. */
export const MANIFEST_INFLIGHT_MAX = 2;

export function acceptAudioEditionKey(key: string, catalogue: ReadonlySet<string> = new Set()): boolean {
  if (typeof key !== 'string' || key.length < 1 || key.length > AUDIO_EDITION_KEY_MAX) return false;
  if (!/^[a-z0-9_]+$/.test(key)) return false;
  return APPROVED_AUDIO_EDITION_SET.has(key) || catalogue.has(key);
}

export function audioManifestUrl(key: string): string | null {
  if (typeof key !== 'string' || key.length < 1 || key.length > AUDIO_EDITION_KEY_MAX) return null;
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
  const footnotes = row.footnotes == null ? '' : exactString(row.footnotes);
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

export function evictExpired<T>(store: Map<string, CacheSlot<T>>, now: number): void {
  for (const [key, slot] of store) {
    if (slot.expires <= now) store.delete(key);
  }
}

/** Insert one entry, drop expired slots, and keep the map at `max` by removing the oldest. */
export function rememberBounded<T>(store: Map<string, CacheSlot<T>>, key: string, value: T, now: number, ttl: number, max: number): void {
  evictExpired(store, now);
  store.delete(key);
  store.set(key, { value, expires: now + ttl });
  while (store.size > max) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function readCached<T>(store: Map<string, CacheSlot<T>>, key: string, now: number): T | undefined {
  const slot = store.get(key);
  if (!slot || slot.expires <= now) {
    if (slot) store.delete(key);
    return undefined;
  }
  store.delete(key);
  store.set(key, slot);
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

/** A stored catalog key, otherwise the language default. Either can start a request before the catalogue returns. */
export function immediateEditionKey(lang: Lang, stored: Partial<Record<Lang, string>> | null | undefined): string {
  const saved = stored?.[lang];
  if (saved && /^[a-z0-9_]+$/.test(saved)) return saved;
  return DEFAULT_EDITION_KEY[lang];
}

/** Ignore a meaning payload that belongs to an earlier surah, language, or edition. */
export function acceptsMeaning(
  payload: { surah: number; lang: string; editionKey: string } | null | undefined,
  surah: number,
  lang: string,
  editionKey: string,
): boolean {
  return Boolean(payload && payload.surah === surah && payload.lang === lang && payload.editionKey === editionKey);
}

export interface CommentaryAyah {
  aya: number;
  translation: string;
  footnotes: string | null;
}

export interface CommentarySpan {
  fromAya: number;
  toAya: number;
  text: string;
  footnotes: string | null;
}

function parseTafsirAyah(item: unknown, sura: number): CommentaryAyah | null {
  const row = record(item);
  if (!row) return null;
  const suraNumber = wholeNumber(row.sura);
  const aya = wholeNumber(row.aya);
  const translation = exactString(row.translation);
  if (suraNumber !== sura || aya === null || aya < 1 || translation === null) return null;
  if (row.footnotes == null) return { aya, translation, footnotes: null };
  const footnotes = exactString(row.footnotes);
  if (footnotes === null) return null;
  return { aya, translation, footnotes };
}

/** Read a QuranEnc surah payload. Null footnotes stay null. The wording is not rewritten. */
export function parseTafsirSura(body: unknown, sura: number): CommentaryAyah[] | null {
  const wrapped = record(body);
  const list = wrapped && Array.isArray(wrapped.result) ? wrapped.result : Array.isArray(body) ? body : null;
  if (!list || list.length === 0) return null;
  const ayahs: CommentaryAyah[] = [];
  const seen = new Set<number>();
  for (const item of list) {
    const row = parseTafsirAyah(item, sura);
    if (!row || seen.has(row.aya)) return null;
    seen.add(row.aya);
    ayahs.push(row);
  }
  ayahs.sort((a, b) => a.aya - b.aya);
  return ayahs;
}

/** Join a contiguous run only when the source text and footnotes are exactly the same. */
export function groupSameCommentary(rows: CommentaryAyah[]): CommentarySpan[] {
  const spans: CommentarySpan[] = [];
  for (const row of [...rows].sort((a, b) => a.aya - b.aya)) {
    const last = spans[spans.length - 1];
    if (last && row.aya === last.toAya + 1 && row.translation === last.text && row.footnotes === last.footnotes) {
      last.toAya = row.aya;
      continue;
    }
    spans.push({ fromAya: row.aya, toAya: row.aya, text: row.translation, footnotes: row.footnotes });
  }
  return spans;
}

export function verseSpanLabel(fromAya: number, toAya: number): string {
  return fromAya === toAya ? `Verse ${fromAya}` : `Verses ${fromAya}–${toAya}`;
}

export function describeMukhtasar(
  lang: Lang,
  key: string,
  listedKeys: string[] | null,
): { listedInTafsir: boolean; listNote: string; versionNote: string } {
  const language = lang === 'en' ? 'English' : lang === 'ta' ? 'Tamil' : 'Sinhala';
  const listed = Boolean(listedKeys?.includes(key));
  const listNote = listed
    ? `QuranEnc lists this tafsir as ${key}.`
    : listedKeys
      ? `QuranEnc’s tafsir list has no ${language} entry. This text is Al-Mukhtasar from the translation API as ${key}.`
      : `The tafsir list could not be loaded. This text is Al-Mukhtasar from the translation API as ${key}. No other commentary was substituted.`;
  return { listedInTafsir: listed, listNote, versionNote: TAFSIR_VERSION_NOTE };
}

export function parseTafsirKeys(body: unknown): string[] | null {
  const wrapped = record(body);
  if (!wrapped || !Array.isArray(wrapped.tafsirs)) return null;
  const keys: string[] = [];
  for (const item of wrapped.tafsirs) {
    const row = record(item);
    const key = row ? exactString(row.key) : null;
    if (!key) return null;
    keys.push(key);
  }
  return keys;
}

/**
 * Home “Search the library” helpers — Qur’an verse refs + catalogue title search.
 * Never starts a research job.
 */

import type { SurahInfo } from '../shared/types.ts';
import type { Lang } from '../shared/sources.ts';
import { readingLinkHash } from './verseShare.ts';
import { buildBookReaderHash } from './bookPageBookmark.ts';

export type LibrarySearchKind = 'verse' | 'book';

export interface LibraryVerseHit {
  kind: 'verse';
  surah: number;
  ayah: number;
  surahName: string;
  hash: string;
}

export interface LibraryBookHit {
  kind: 'book';
  id: number;
  title: string;
  language: Lang;
  publicationLanguage: string | null;
  author: string | null;
  editionNote: string | null;
  hash: string;
}

export type LibrarySearchHit = LibraryVerseHit | LibraryBookHit;

export type LibraryRefParse =
  | { ok: true; surah: number; ayah: number; surahName: string }
  | { ok: false; reason: 'empty' | 'not_ref' | 'invalid_bounds'; message: string };

/** Must match server.ts books API `q` truncate (`slice(0, 80)`). */
export const LIBRARY_TITLE_QUERY_MAX = 80;

/** Normalize Unicode / whitespace for title matching (preserve native script). */
export function normalizeLibraryQuery(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Bound title queries to the same 80-char server limit before request / compare. */
export function truncateLibraryTitleQuery(raw: string): string {
  return normalizeLibraryQuery(raw).slice(0, LIBRARY_TITLE_QUERY_MAX);
}

/**
 * Parse a complete `surah:ayah` (or `surah.ayah`) reference against catalogue bounds.
 * Invalid refs return useful feedback — never silently fall back to 1:1.
 */
export function parseLibraryVerseRef(raw: string, surahs: readonly SurahInfo[]): LibraryRefParse {
  const text = normalizeLibraryQuery(raw);
  if (!text) return { ok: false, reason: 'empty', message: 'Enter a Qur’an reference (e.g. 18:10) or a book title.' };
  const match = text.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
  if (!match) return { ok: false, reason: 'not_ref', message: '' };
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  const info = surahs.find(item => item.number === surah);
  if (!info) {
    return {
      ok: false,
      reason: 'invalid_bounds',
      message: `Chapter ${surah} is outside the Qur’an (1–114).`,
    };
  }
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > info.numberOfAyahs) {
    return {
      ok: false,
      reason: 'invalid_bounds',
      message: `Surah ${info.englishName} (${surah}) has ${info.numberOfAyahs} ayahs — ${surah}:${ayah} is out of range.`,
    };
  }
  return { ok: true, surah, ayah, surahName: info.englishName };
}

export function libraryVerseHit(
  parse: Extract<LibraryRefParse, { ok: true }>,
  lang: Lang,
  edition: string,
): LibraryVerseHit {
  return {
    kind: 'verse',
    surah: parse.surah,
    ayah: parse.ayah,
    surahName: parse.surahName,
    hash: readingLinkHash({
      surah: parse.surah,
      ayah: parse.ayah,
      lang,
      edition,
      mode: 'book',
    }),
  };
}

export interface CatalogueBookRow {
  id: number;
  title: string;
  language?: string | null;
  publicationLanguage?: string | null;
  authors?: string[] | null;
  author?: string | null;
  publisher?: string | null;
  description?: string | null;
}

export function catalogueBookToHit(row: CatalogueBookRow, requestedLang: Lang): LibraryBookHit {
  const language: Lang =
    row.language === 'ta' || row.language === 'si' || row.language === 'en'
      ? row.language
      : requestedLang;
  const author =
    (Array.isArray(row.authors) && row.authors[0]) ||
    (typeof row.author === 'string' ? row.author : null) ||
    null;
  return {
    kind: 'book',
    id: row.id,
    title: row.title,
    language,
    publicationLanguage: row.publicationLanguage ?? row.language ?? null,
    author,
    editionNote: row.publisher ?? null,
    hash: buildBookReaderHash({ itemId: row.id, lang: language }),
  };
}

/** True when the query looks like a verse ref attempt (digits + colon/dot). */
export function looksLikeVerseRef(raw: string): boolean {
  return /^\d{1,3}\s*[:.]\s*\d{0,3}$/.test(normalizeLibraryQuery(raw));
}

/**
 * True only when catalogue results belong to the normalized submitted title query.
 * Prevents opening a previous query’s first hit after an in-debounce edit+submit.
 */
export function catalogueResultsMatchSubmit(input: {
  submittedQuery: string;
  catalogueQuery: string | null | undefined;
  catalogueLang: string | null | undefined;
  requestedLang: Lang;
  itemCount: number;
}): boolean {
  const submitted = truncateLibraryTitleQuery(input.submittedQuery);
  if (!submitted || looksLikeVerseRef(submitted) || submitted.length < 3) return false;
  if (input.catalogueLang !== input.requestedLang) return false;
  if (truncateLibraryTitleQuery(input.catalogueQuery ?? '') !== submitted) return false;
  return input.itemCount >= 0;
}

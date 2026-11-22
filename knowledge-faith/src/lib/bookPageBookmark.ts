/**
 * Typed book-page bookmarks (PDF vs prepared text).
 * Separate from resume cursor `kf-book-page` and from title saves `kf-saved-books`.
 */

import type { Lang } from '../shared/sources.ts';
import { preparedTextQuarantined } from '../shared/bookReadiness.ts';

export const BOOK_PAGE_BOOKMARKS_KEY = 'kf-book-page-bookmarks';
/** Legacy single-slot resume cursor — never treated as a bookmark. */
export const BOOK_RESUME_KEY = 'kf-book-page';

export type BookRepresentation = 'pdf' | 'text';

export interface BookPageLocator {
  v: 1;
  itemId: number;
  representation: BookRepresentation;
  /** 1-based page within the named representation. */
  page: number;
  /** Publication / edition language for this locator (not UI language alone). */
  lang: Lang;
  /** Stable attachment identity (usually PDF sourceUrl); null for prepared text without attachment. */
  attachmentId: string | null;
  /** Optional prepared-text block/revision anchor. */
  anchor: string | null;
  title: string | null;
  publicationLanguage: string | null;
  savedAt: string;
}

export interface BookPageBookmarkWriteResult {
  ok: boolean;
  bookmarks: BookPageLocator[];
  error: 'quota' | 'unavailable' | 'invalid' | 'quarantined' | null;
}

function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'ta' || value === 'si';
}

function isRepresentation(value: unknown): value is BookRepresentation {
  return value === 'pdf' || value === 'text';
}

function finitePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
}

/** Deterministic equality — ignores timestamps and display title. */
export function sameBookPageLocator(
  a: Pick<BookPageLocator, 'itemId' | 'representation' | 'page' | 'lang' | 'attachmentId'>,
  b: Pick<BookPageLocator, 'itemId' | 'representation' | 'page' | 'lang' | 'attachmentId'>,
): boolean {
  return (
    a.itemId === b.itemId &&
    a.representation === b.representation &&
    a.page === b.page &&
    a.lang === b.lang &&
    (a.attachmentId ?? null) === (b.attachmentId ?? null)
  );
}

export function validateBookPageLocator(raw: unknown): BookPageLocator | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.v !== 1) return null;
  const itemId = finitePositiveInt(row.itemId);
  const page = finitePositiveInt(row.page);
  if (itemId == null || page == null) return null;
  if (!isRepresentation(row.representation) || !isLang(row.lang)) return null;
  if (row.representation === 'text' && preparedTextQuarantined(itemId)) return null;
  const attachmentId =
    typeof row.attachmentId === 'string' && row.attachmentId.trim()
      ? row.attachmentId.trim()
      : null;
  if (row.representation === 'pdf' && !attachmentId) return null;
  const anchor = typeof row.anchor === 'string' && row.anchor.trim() ? row.anchor.trim() : null;
  const title = typeof row.title === 'string' ? row.title : null;
  const publicationLanguage =
    typeof row.publicationLanguage === 'string' ? row.publicationLanguage : null;
  const savedAt =
    typeof row.savedAt === 'string' && row.savedAt.trim() ? row.savedAt : new Date(0).toISOString();
  return {
    v: 1,
    itemId,
    representation: row.representation,
    page,
    lang: row.lang,
    attachmentId,
    anchor,
    title,
    publicationLanguage,
    savedAt,
  };
}

export function parseBookPageBookmarks(raw: unknown): BookPageLocator[] {
  if (!Array.isArray(raw)) return [];
  const out: BookPageLocator[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const locator = validateBookPageLocator(item);
    if (!locator) continue;
    const key = locatorKey(locator);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(locator);
  }
  return out;
}

export function locatorKey(
  locator: Pick<BookPageLocator, 'itemId' | 'representation' | 'page' | 'lang' | 'attachmentId'>,
): string {
  return [
    locator.itemId,
    locator.representation,
    locator.page,
    locator.lang,
    locator.attachmentId ?? '',
  ].join('\u0001');
}

type PlaceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readBookPageBookmarks(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): BookPageLocator[] {
  try {
    const raw = storage?.getItem(BOOK_PAGE_BOOKMARKS_KEY);
    if (raw == null || raw === '') return [];
    return parseBookPageBookmarks(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function writeBookPageBookmarks(
  bookmarks: readonly BookPageLocator[],
  storage: PlaceStorage | undefined = globalThis.localStorage,
): BookPageBookmarkWriteResult {
  const cleaned = parseBookPageBookmarks(bookmarks);
  if (!storage) {
    return { ok: false, bookmarks: cleaned, error: 'unavailable' };
  }
  try {
    storage.setItem(BOOK_PAGE_BOOKMARKS_KEY, JSON.stringify(cleaned));
    return { ok: true, bookmarks: cleaned, error: null };
  } catch (err) {
    const quota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return { ok: false, bookmarks: readBookPageBookmarks(storage), error: quota ? 'quota' : 'unavailable' };
  }
}

export function upsertBookPageBookmark(
  input: Omit<BookPageLocator, 'v' | 'savedAt'> & { savedAt?: string },
  storage: PlaceStorage | undefined = globalThis.localStorage,
): BookPageBookmarkWriteResult {
  if (input.representation === 'text' && preparedTextQuarantined(input.itemId)) {
    return { ok: false, bookmarks: readBookPageBookmarks(storage), error: 'quarantined' };
  }
  const next: BookPageLocator = {
    v: 1,
    itemId: input.itemId,
    representation: input.representation,
    page: input.page,
    lang: input.lang,
    attachmentId: input.attachmentId,
    anchor: input.anchor ?? null,
    title: input.title ?? null,
    publicationLanguage: input.publicationLanguage ?? null,
    savedAt: input.savedAt ?? new Date().toISOString(),
  };
  if (!validateBookPageLocator(next)) {
    return { ok: false, bookmarks: readBookPageBookmarks(storage), error: 'invalid' };
  }
  const current = readBookPageBookmarks(storage);
  const without = current.filter(item => !sameBookPageLocator(item, next));
  return writeBookPageBookmarks([next, ...without], storage);
}

export function removeBookPageBookmark(
  locator: Pick<BookPageLocator, 'itemId' | 'representation' | 'page' | 'lang' | 'attachmentId'>,
  storage: PlaceStorage | undefined = globalThis.localStorage,
): BookPageBookmarkWriteResult {
  const current = readBookPageBookmarks(storage);
  return writeBookPageBookmarks(
    current.filter(item => !sameBookPageLocator(item, locator)),
    storage,
  );
}

/** Legacy `{id,page}` is resume-only — never manufacture a typed bookmark from it. */
export function parseLegacyBookResume(raw: unknown): { id: number; page: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as { id?: unknown; page?: unknown };
  const id = finitePositiveInt(row.id);
  const page = finitePositiveInt(row.page);
  if (id == null || page == null) return null;
  return { id, page };
}

export function readLegacyBookResume(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): { id: number; page: number } | null {
  try {
    const raw = storage?.getItem(BOOK_RESUME_KEY);
    if (raw == null || raw === '') return null;
    return parseLegacyBookResume(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function rememberLegacyBookResume(
  id: number,
  page: number,
  storage: PlaceStorage | undefined = globalThis.localStorage,
): boolean {
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(page) || page <= 0) return false;
  try {
    storage?.setItem(BOOK_RESUME_KEY, JSON.stringify({ id, page }));
    return true;
  } catch {
    return false;
  }
}

export function buildBookReaderHash(input: {
  itemId: number;
  representation?: BookRepresentation | null;
  readerPage?: number | null;
  lang?: Lang | null;
  attachmentId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.representation === 'pdf' || input.representation === 'text') {
    params.set('rep', input.representation);
  }
  if (input.readerPage != null && Number.isInteger(input.readerPage) && input.readerPage > 0) {
    params.set('readerPage', String(input.readerPage));
  }
  if (input.lang) params.set('lang', input.lang);
  if (input.attachmentId) params.set('att', input.attachmentId);
  const qs = params.toString();
  return `#/books/item/${input.itemId}${qs ? `?${qs}` : ''}`;
}

export function parseBookReaderParams(params: URLSearchParams | Record<string, string | null | undefined>): {
  representation: BookRepresentation | null;
  readerPage: number | null;
  lang: Lang | null;
  attachmentId: string | null;
} {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(key);
    const value = params[key];
    return typeof value === 'string' ? value : null;
  };
  const rep = get('rep');
  const page = finitePositiveInt(get('readerPage'));
  const langRaw = get('lang');
  const att = get('att');
  return {
    representation: isRepresentation(rep) ? rep : null,
    readerPage: page,
    lang: isLang(langRaw) ? langRaw : null,
    attachmentId: att && att.trim() ? att.trim() : null,
  };
}

export function bookmarkLabel(locator: BookPageLocator): string {
  const rep = locator.representation === 'pdf' ? 'PDF' : 'Prepared text';
  const title = locator.title?.trim() || `Book ${locator.itemId}`;
  return `${title} · ${rep} p.${locator.page}`;
}

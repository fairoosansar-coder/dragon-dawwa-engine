import type { Lang } from '../shared/sources.ts';
import { ISLAMHOUSE_TTL_MS, parseLibraryItem, type LibraryItem } from '../shared/islamhouse.ts';
import {
  BOOK_PAGE_SIZE,
  SEARCH_PAGE_SIZE,
  bookCard,
  bookMatches,
  hasPdf,
  parseBookList,
  parseSearchPage,
  thinCard,
  topCategories,
  translationChoices,
  type BookCard,
  type BookDetail,
  type BookMeta,
  type BookShelfResponse,
  type BookStats,
  type BookTranslation,
} from '../shared/bookShelf.ts';
import { fetchJson, UpstreamError } from './http.ts';
import { islamHouseMain, itemRequestUrl } from './islamhouse.ts';

export interface BookQuery {
  lang: Lang;
  page: number;
  categoryId: number | null;
  q: string;
  essential: boolean;
  format: 'any' | 'pdf';
  sort: 'newest' | 'title';
}

const SEARCH_URL = 'https://islamhouse.com/search/search.php';
const LANGS: Lang[] = ['en', 'ta', 'si'];

interface CacheEntry<T> {
  expires: number;
  value: T;
}

const catalogues = new Map<Lang, CacheEntry<BookCard[]>>();
const catalogueJobs = new Map<Lang, Promise<BookCard[]>>();
const categoriesCache = new Map<Lang, CacheEntry<{ id: number; title: string; books: number }[]>>();
const searchCache = new Map<string, CacheEntry<ReturnType<typeof parseSearchPage>>>();

async function pool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

async function bookList(lang: Lang, page: number, pageSize: number, categoryId?: number): Promise<{ page: number; pages: number; total: number; items: LibraryItem[] }> {
  const path = categoryId
    ? `get-category-items/${categoryId}/books/${lang}/${lang}/${page}/${pageSize}/json`
    : `books/${lang}/${lang}/${page}/${pageSize}/json`;
  const body = await fetchJson<unknown>(islamHouseMain(path), ISLAMHOUSE_TTL_MS);
  const parsed = parseBookList(body, lang, page);
  if (!parsed) throw new UpstreamError('IslamHouse returned an unreadable book list', 502);
  return parsed;
}

async function loadCatalogue(lang: Lang): Promise<BookCard[]> {
  const hit = catalogues.get(lang);
  if (hit && hit.expires > Date.now()) return hit.value;
  const pending = catalogueJobs.get(lang);
  if (pending) return pending;
  const job = (async () => {
    const first = await bookList(lang, 1, 48);
    const rest = first.pages > 1 ? await pool(Array.from({ length: first.pages - 1 }, (_, index) => index + 2), 4, page => bookList(lang, page, 48)) : [];
    const seen = new Set<number>();
    const items: BookCard[] = [];
    for (const row of [first, ...rest]) {
      for (const item of row.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(bookCard(item));
      }
    }
    if (first.total > 0 && items.length < first.total) {
      throw new UpstreamError('The book catalogue was only partly retrieved.', 502);
    }
    catalogues.set(lang, { expires: Date.now() + ISLAMHOUSE_TTL_MS, value: items });
    return items;
  })();
  catalogueJobs.set(lang, job);
  try {
    return await job;
  } catch (err) {
    catalogues.delete(lang);
    throw err;
  } finally {
    catalogueJobs.delete(lang);
  }
}

async function loadCategoryBooks(lang: Lang, categoryId: number): Promise<BookCard[]> {
  const first = await bookList(lang, 1, 48, categoryId);
  const rest = first.pages > 1 ? await pool(Array.from({ length: first.pages - 1 }, (_, index) => index + 2), 4, page => bookList(lang, page, 48, categoryId)) : [];
  return [first, ...rest].flatMap(page => page.items.map(bookCard));
}

async function featuredBook(lang: Lang): Promise<BookCard | null> {
  try {
    const body = await fetchJson<unknown>(islamHouseMain(`get-highlights/${lang}/${lang}/json`), ISLAMHOUSE_TTL_MS);
    if (!Array.isArray(body)) return null;
    for (const row of body) {
      const item = parseLibraryItem(row, lang);
      if (item?.type === 'books') return bookCard(item);
    }
    return null;
  } catch {
    return null;
  }
}

async function postSearch(lang: Lang, term: string, page: number) {
  const key = `${lang}|${term}|${page}`;
  const hit = searchCache.get(key);
  if (hit && hit.expires > Date.now() && hit.value) return hit.value;
  let response: Response;
  try {
    response = await fetch(SEARCH_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: 'https://islamhouse.com',
        'User-Agent': 'DragonDawwa/1.0 (Knowledge and Faith)',
      },
      body: JSON.stringify({ browse_mode: false, term, langs: [lang], types: ['books'], page, flang: lang }),
    });
  } catch {
    throw new UpstreamError('IslamHouse search took too long to respond.', 504);
  }
  const finalUrl = new URL(response.url);
  if (finalUrl.hostname !== 'islamhouse.com' || finalUrl.pathname !== '/search/search.php') {
    throw new UpstreamError('IslamHouse search moved to an unexpected address.', 502);
  }
  if (!response.ok) throw new UpstreamError(`IslamHouse search returned ${response.status}.`, 502);
  const parsed = parseSearchPage(await response.json());
  if (!parsed) throw new UpstreamError('IslamHouse search returned an unreadable list.', 502);
  searchCache.set(key, { expires: Date.now() + ISLAMHOUSE_TTL_MS, value: parsed });
  return parsed;
}

async function enrich(lang: Lang, cards: BookCard[]): Promise<BookCard[]> {
  const indexed = catalogues.get(lang);
  const known = indexed && indexed.expires > Date.now() ? new Map(indexed.value.map(item => [item.id, item])) : null;
  return pool(cards, 6, async card => {
    const hit = known?.get(card.id);
    if (hit) return hit;
    if (card.authors.length || card.files.length || card.image) return card;
    try {
      const body = await fetchJson<unknown>(itemRequestUrl(card.id, lang), ISLAMHOUSE_TTL_MS);
      const item = parseLibraryItem(body, lang);
      if (!item || (item.language && item.language !== lang)) return card;
      return bookCard(item);
    } catch {
      return card;
    }
  });
}

function windowOf(items: BookCard[], page: number, pageSize: number) {
  const pages = items.length ? Math.ceil(items.length / pageSize) : 0;
  const slice = items.slice((page - 1) * pageSize, page * pageSize);
  return {
    page,
    pages,
    total: items.length,
    from: slice.length ? (page - 1) * pageSize + 1 : 0,
    to: slice.length ? (page - 1) * pageSize + slice.length : 0,
    items: slice,
  };
}

function sortTitle(items: BookCard[], lang: Lang): BookCard[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title, lang, { sensitivity: 'base' }) || a.id - b.id);
}

export async function loadBookShelf(query: BookQuery): Promise<BookShelfResponse> {
  const plain = !query.q && !query.categoryId && !query.essential && query.format === 'any' && query.sort === 'newest';
  let featured: BookCard | null = null;
  let result: { page: number; pages: number; total: number | null; from: number; to: number; items: BookCard[] };

  if (query.q) {
    if (query.categoryId) {
      let items = (await loadCategoryBooks(query.lang, query.categoryId)).filter(item => bookMatches(item, query.q));
      if (query.essential) items = items.filter(item => item.essential);
      if (query.format === 'pdf') items = items.filter(hasPdf);
      if (query.sort === 'title') items = sortTitle(items, query.lang);
      result = windowOf(items, query.page, BOOK_PAGE_SIZE);
    } else if (query.essential || query.format === 'pdf' || query.sort === 'title') {
      const catalogue = await loadCatalogue(query.lang);
      const byId = new Map(catalogue.map(item => [item.id, item]));
      const matched: BookCard[] = [];
      let page = 1;
      let complete = false;
      let numFound = 0;
      while (page <= 8) {
        const found = await postSearch(query.lang, query.q, page);
        numFound = found.numFound;
        for (const hit of found.hits) {
          const card = byId.get(hit.id);
          if (card) matched.push(card);
        }
        if (!found.showMore) {
          complete = true;
          break;
        }
        page += 1;
      }
      let items = matched;
      if (query.essential) items = items.filter(item => item.essential);
      if (query.format === 'pdf') items = items.filter(hasPdf);
      if (query.sort === 'title') items = sortTitle(items, query.lang);
      if (!complete && numFound > matched.length) {
        const slice = windowOf(items, query.page, BOOK_PAGE_SIZE);
        result = { ...slice, total: null };
      } else {
        result = windowOf(items, query.page, BOOK_PAGE_SIZE);
      }
    } else {
      const found = await postSearch(query.lang, query.q, query.page);
      const items = await enrich(query.lang, found.hits.map(hit => thinCard(hit, query.lang)));
      const pages = found.numFound ? Math.ceil(found.numFound / SEARCH_PAGE_SIZE) : 0;
      result = {
        page: query.page,
        pages,
        total: found.numFound,
        from: items.length ? found.from : 0,
        to: items.length ? found.from + items.length - 1 : 0,
        items,
      };
    }
  } else if (query.categoryId || query.essential || query.format === 'pdf' || query.sort === 'title') {
    let items = query.categoryId ? await loadCategoryBooks(query.lang, query.categoryId) : await loadCatalogue(query.lang);
    if (query.essential) items = items.filter(item => item.essential);
    if (query.format === 'pdf') items = items.filter(hasPdf);
    if (query.sort === 'title') items = sortTitle(items, query.lang);
    result = windowOf(items, query.page, BOOK_PAGE_SIZE);
  } else {
    const list = await bookList(query.lang, query.page, BOOK_PAGE_SIZE);
    const items = list.items.map(bookCard);
    const pages = list.total ? Math.ceil(list.total / BOOK_PAGE_SIZE) : 0;
    result = {
      page: list.page,
      pages,
      total: list.total,
      from: items.length ? (list.page - 1) * BOOK_PAGE_SIZE + 1 : 0,
      to: items.length ? (list.page - 1) * BOOK_PAGE_SIZE + items.length : 0,
      items,
    };
  }

  if (plain && result.page === 1) featured = await featuredBook(query.lang);

  return {
    lang: query.lang,
    page: result.page,
    pages: result.pages,
    total: result.total,
    from: result.from,
    to: result.to,
    query: query.q,
    categoryId: query.categoryId,
    essential: query.essential,
    format: query.format,
    sort: query.sort,
    items: result.items,
    featured,
  };
}

async function languageCount(lang: Lang): Promise<number | null> {
  try {
    const body = await fetchJson<unknown>(islamHouseMain(`get-language-items-count/books/${lang}/${lang}/json`), ISLAMHOUSE_TTL_MS);
    const row = body !== null && typeof body === 'object' ? (body as { items_count?: unknown }) : null;
    const count = Number(row?.items_count);
    return Number.isInteger(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

export async function loadBookMeta(lang: Lang): Promise<BookMeta> {
  const cached = categoriesCache.get(lang);
  const counts = { en: null, ta: null, si: null } as Record<Lang, number | null>;
  await Promise.all(LANGS.map(async code => {
    counts[code] = await languageCount(code);
  }));
  if (cached && cached.expires > Date.now()) return { lang, counts, categories: cached.value };
  let categories: { id: number; title: string; books: number }[] = [];
  try {
    const tree = await fetchJson<unknown>(islamHouseMain('get-object-category-tree/en/json'), ISLAMHOUSE_TTL_MS);
    const tops = topCategories(tree);
    const counted = await pool(tops, 6, async category => {
      try {
        const list = await bookList(lang, 1, 1, category.id);
        return list.total > 0 ? { id: category.id, title: category.title, books: list.total } : null;
      } catch {
        return null;
      }
    });
    categories = counted.filter((item): item is { id: number; title: string; books: number } => item !== null);
    categories.sort((a, b) => a.title.localeCompare(b.title, 'en'));
    categoriesCache.set(lang, { expires: Date.now() + ISLAMHOUSE_TTL_MS, value: categories });
  } catch {
    categories = cached?.value ?? [];
  }
  return { lang, counts, categories };
}

export async function loadBookStats(lang: Lang): Promise<BookStats> {
  try {
    const items = await loadCatalogue(lang);
    return {
      lang,
      essential: items.filter(item => item.essential).length,
      pdf: items.filter(hasPdf).length,
    };
  } catch {
    return { lang, essential: null, pdf: null };
  }
}

export async function loadBookDetail(id: number, lang: Lang): Promise<BookDetail> {
  const translationsBody = await fetchJson<unknown>(islamHouseMain(`get-item-translations/${id}/en/json`), ISLAMHOUSE_TTL_MS).catch(() => []);
  const translations = translationChoices(translationsBody);
  let book: BookCard | null = null;
  let limitation: string | null = null;
  try {
    const body = await fetchJson<unknown>(itemRequestUrl(id, lang), ISLAMHOUSE_TTL_MS);
    const item = parseLibraryItem(body, lang);
    if (!item) limitation = 'IslamHouse returned no record for this book.';
    else if (item.language && item.language !== lang) {
      limitation = `This book is not available in ${lang}. Another language was not substituted.`;
    } else book = bookCard(item);
  } catch (err) {
    limitation = err instanceof UpstreamError ? err.message : 'IslamHouse did not respond.';
  }
  if (book && !translations.some(item => item.lang === lang)) translations.unshift({ lang, id: book.id });
  return { lang, book, translations, limitation };
}

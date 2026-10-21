import type { Lang } from '../shared/sources.ts';
import { knowledgePath, type KnowledgePath } from '../shared/sourceRegistry.ts';
import {
  ISLAMHOUSE_TTL_MS,
  parseLibraryItem,
  parseLibraryPage,
  parseSubcategories,
  RELATED_WORSHIP_CATEGORIES,
  worshipTopic,
  type LibraryCategory,
  type LibraryItem,
  type LibraryPage,
} from '../shared/islamhouse.ts';
import { fetchJson, UpstreamError } from './http.ts';

/** Published in IslamHouse’s own API examples. Override with ISLAMHOUSE_API_KEY. Never send this to the browser. */
const PUBLISHED_EXAMPLE_KEY = 'paV29H2gm56kvLPy';

function apiKey(): string {
  const configured = process.env.ISLAMHOUSE_API_KEY?.trim();
  return configured || PUBLISHED_EXAMPLE_KEY;
}

function subcategoriesUrl(categoryId: number): string {
  return `https://api3.islamhouse.com/v3/${apiKey()}/main/get-sub-categories/${categoryId}/en/json`;
}

async function readSubcategories(categoryId: number) {
  try {
    return parseSubcategories(await fetchJson<unknown>(subcategoriesUrl(categoryId), ISLAMHOUSE_TTL_MS));
  } catch {
    return null;
  }
}

async function topicCategories(topicId: string, parentId: number): Promise<LibraryCategory[]> {
  const topic = worshipTopic(topicId);
  if (!topic) return [];
  const parent = await readSubcategories(parentId);
  const children = parent?.children ?? [];
  const related: LibraryCategory[] = [];
  for (const id of RELATED_WORSHIP_CATEGORIES[topic.id]) {
    if (id === parentId || children.some(child => child.id === id)) continue;
    const node = await readSubcategories(id);
    if (node) related.push({ id: node.id, title: node.title });
  }
  return [...children, ...related];
}

export async function loadLibrary(topicId: string, lang: Lang, page: number, category?: string): Promise<LibraryPage> {
  const topic = worshipTopic(topicId);
  if (!topic) throw new UpstreamError('Unknown worship topic', 404);
  const categories = await topicCategories(topic.id, topic.categoryId);
  const requested = category && /^\d{1,12}$/.test(category) ? Number(category) : topic.categoryId;
  const known = new Set<number>([topic.categoryId, ...categories.map(item => item.id)]);
  if (!known.has(requested)) throw new UpstreamError('Unknown category', 404);
  const url = `https://api3.islamhouse.com/v3/${apiKey()}/main/get-category-items/${requested}/showall/en/${lang}/${page}/12/json`;
  const body = await fetchJson<unknown>(url, ISLAMHOUSE_TTL_MS);
  const parsed = parseLibraryPage(body, topic.id, lang, page);
  if (!parsed) throw new UpstreamError('IslamHouse returned an unreadable list', 502);
  return { ...parsed, categoryId: requested, categories };
}

export interface KnowledgeShelf {
  id: KnowledgePath['id'];
  title: string;
  sourceTitle: string;
  categoryId: number;
  lang: Lang;
  page: number;
  pages: number;
  total: number;
  items: LibraryItem[];
  categories: LibraryCategory[];
}

export async function loadKnowledgeShelf(pathId: string, lang: Lang, page: number, category?: string): Promise<KnowledgeShelf> {
  const path = knowledgePath(pathId);
  if (!path) throw new UpstreamError('Unknown knowledge path', 404);
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const node = await readSubcategories(path.categoryId);
  const children = node?.children ?? [];
  const requested = category && /^\d{1,12}$/.test(category) ? Number(category) : path.categoryId;
  if (requested !== path.categoryId && !children.some(child => child.id === requested)) throw new UpstreamError('Unknown category', 404);
  const url = `https://api3.islamhouse.com/v3/${apiKey()}/main/get-category-items/${requested}/showall/en/${lang}/${safePage}/12/json`;
  const body = await fetchJson<unknown>(url, ISLAMHOUSE_TTL_MS);
  const parsed = parseLibraryPage(body, 'prayer', lang, safePage);
  if (!parsed) throw new UpstreamError('IslamHouse returned an unreadable list', 502);
  return {
    id: path.id,
    title: path.title,
    sourceTitle: path.sourceTitle,
    categoryId: requested,
    lang,
    page: parsed.page,
    pages: parsed.pages,
    total: parsed.total,
    items: parsed.items,
    categories: children,
  };
}

export interface ItemDocument {
  id: number;
  title: string;
  description: string | null;
  html: string | null;
  language: string | null;
  authors: string[];
  translators: string[];
  reviewers: string[];
}

/** get-item using the publication’s site language. An English site language is not a substitute. */
export async function loadItemDocument(id: number, siteLang: Lang): Promise<ItemDocument | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const url = `https://api3.islamhouse.com/v3/${apiKey()}/main/get-item/${id}/${siteLang}/json`;
  let body: unknown;
  try {
    body = await fetchJson<unknown>(url, ISLAMHOUSE_TTL_MS);
  } catch {
    return null;
  }
  const row = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!row || typeof row.error === 'string' || typeof row.title !== 'string') return null;
  if (row.source_language && row.source_language !== siteLang) return null;
  const authors: string[] = [];
  const translators: string[] = [];
  const reviewers: string[] = [];
  if (Array.isArray(row.prepared_by)) {
    for (const person of row.prepared_by) {
      if (!person || typeof person !== 'object') continue;
      const credit = person as Record<string, unknown>;
      const name = typeof credit.title === 'string' ? credit.title : '';
      const kind = typeof credit.kind === 'string' ? credit.kind : '';
      if (!name) continue;
      if (kind === 'author') authors.push(name);
      else if (kind === 'translator') translators.push(name);
      else if (kind === 'reviewer') reviewers.push(name);
    }
  }
  return {
    id,
    title: row.title,
    description: typeof row.description === 'string' ? row.description : null,
    html: typeof row.full_description === 'string' ? row.full_description : null,
    language: typeof row.source_language === 'string' ? row.source_language : null,
    authors,
    translators,
    reviewers,
  };
}

export async function loadLibraryItem(id: string, lang: Lang, topicId: string): Promise<{ lang: Lang; topic: string; item: LibraryItem }> {
  const topic = worshipTopic(topicId);
  if (!topic || !/^\d{1,12}$/.test(id)) throw new UpstreamError('This item is not available in the selected language.', 404);
  const url = `https://api3.islamhouse.com/v3/${apiKey()}/main/get-item/${id}/en/json`;
  let body: unknown;
  try {
    body = await fetchJson<unknown>(url, ISLAMHOUSE_TTL_MS);
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) throw new UpstreamError('This item is not available in the selected language.', 404);
    throw err;
  }
  const item = parseLibraryItem(body, lang);
  if (!item) throw new UpstreamError('IslamHouse returned an unreadable item', 502);
  if (item.language && item.language !== lang) throw new UpstreamError('This item is not available in the selected language.', 404);
  return { lang, topic: topic.id, item };
}

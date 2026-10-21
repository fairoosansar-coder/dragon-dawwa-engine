import type { Lang } from '../shared/sources.ts';
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

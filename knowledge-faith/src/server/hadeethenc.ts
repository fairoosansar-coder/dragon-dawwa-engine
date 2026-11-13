import type { Lang } from '../shared/sources.ts';
import {
  categoriesForParent,
  HADEETH_UNAVAILABLE,
  HADEETHENC_CATEGORY_LIST,
  HADEETHENC_TTL_MS,
  parseCategories,
  parseHadeeth,
  parseHadeethList,
  parseHadeethSearch,
  type EncyclopediaHadith,
  type HadeethCategory,
  type HadeethListPage,
  type HadeethSearchHit,
} from '../shared/hadeethenc.ts';
import { fetchJson, UpstreamError } from './http.ts';
import { loadCollection, missingTranslation, searchCollection } from './hadeethenc/collection.ts';

const ROOT = 'https://hadeethenc.com/api/v1';

export async function loadHadeethCategories(
  lang: Lang,
  parent?: string,
): Promise<{ lang: Lang; parentId: string | null; categories: HadeethCategory[] }> {
  if (parent && !/^\d{1,8}$/.test(parent)) throw new UpstreamError('Unknown category', 404);
  const body = await fetchJson<unknown>(`${HADEETHENC_CATEGORY_LIST}?language=${lang}`, HADEETHENC_TTL_MS);
  const categories = parseCategories(body);
  if (!categories) throw new UpstreamError('HadeethEnc returned an unreadable category list', 502);
  const parentId = parent ?? null;
  return { lang, parentId, categories: categoriesForParent(categories, parentId) };
}

export async function loadHadeethList(lang: Lang, categoryId: string, page: number): Promise<HadeethListPage> {
  if (!/^\d{1,8}$/.test(categoryId)) throw new UpstreamError('Unknown category', 404);
  const body = await fetchJson<unknown>(
    `${ROOT}/hadeeths/list/?language=${lang}&category_id=${categoryId}&page=${page}&per_page=20`,
    HADEETHENC_TTL_MS,
  );
  const parsed = parseHadeethList(body, lang, categoryId);
  if (!parsed) throw new UpstreamError('HadeethEnc returned an unreadable list', 502);
  return parsed;
}

export async function searchHadeeth(
  lang: Lang,
  phrase: string,
  page = 1,
): Promise<{ lang: Lang; phrase: string; items: HadeethSearchHit[] }> {
  const safePage = Number.isInteger(page) && page >= 1 && page <= 5 ? page : 1;
  const local = searchCollection(lang, phrase, safePage);
  if (local && local.length) return { lang, phrase, items: local };
  const body = await fetchJson<unknown>(
    `${ROOT}/hadeeths/search/?language=${lang}&phrase=${encodeURIComponent(phrase)}&page=${safePage}&per_page=20`,
    HADEETHENC_TTL_MS,
  );
  const items = parseHadeethSearch(body);
  if (!items) throw new UpstreamError('HadeethEnc returned an unreadable search result', 502);
  return { lang, phrase, items };
}

export async function loadHadeeth(lang: Lang, id: string): Promise<EncyclopediaHadith> {
  if (!/^\d{1,12}$/.test(id)) throw new UpstreamError(HADEETH_UNAVAILABLE, 404);
  const stored = loadCollection(lang, id);
  if (stored) return stored;
  if (missingTranslation(lang, id)) throw new UpstreamError(HADEETH_UNAVAILABLE, 404);
  try {
    const body = await fetchJson<unknown>(`${ROOT}/hadeeths/one/?language=${lang}&id=${id}`, HADEETHENC_TTL_MS);
    const parsed = parseHadeeth(body, lang);
    if (!parsed) throw new UpstreamError('HadeethEnc returned an unreadable record', 502);
    return parsed;
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) throw new UpstreamError(HADEETH_UNAVAILABLE, 404);
    throw err;
  }
}

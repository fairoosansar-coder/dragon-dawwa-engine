import type { Lang } from '../shared/sources.ts';
import {
  HADEETH_UNAVAILABLE,
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

const ROOT = 'https://hadeethenc.com/api/v1';

export async function loadHadeethCategories(lang: Lang): Promise<{ lang: Lang; categories: HadeethCategory[] }> {
  const body = await fetchJson<unknown>(`${ROOT}/categories/roots/?language=${lang}`, HADEETHENC_TTL_MS);
  const categories = parseCategories(body);
  if (!categories) throw new UpstreamError('HadeethEnc returned an unreadable category list', 502);
  return { lang, categories };
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

export async function searchHadeeth(lang: Lang, phrase: string): Promise<{ lang: Lang; phrase: string; items: HadeethSearchHit[] }> {
  const body = await fetchJson<unknown>(
    `${ROOT}/hadeeths/search/?language=${lang}&phrase=${encodeURIComponent(phrase)}&page=1&per_page=20`,
    HADEETHENC_TTL_MS,
  );
  const items = parseHadeethSearch(body);
  if (!items) throw new UpstreamError('HadeethEnc returned an unreadable search result', 502);
  return { lang, phrase, items };
}

export async function loadHadeeth(lang: Lang, id: string): Promise<EncyclopediaHadith> {
  if (!/^\d{1,12}$/.test(id)) throw new UpstreamError(HADEETH_UNAVAILABLE, 404);
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

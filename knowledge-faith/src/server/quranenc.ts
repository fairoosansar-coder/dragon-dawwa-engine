import { fetchJsonFresh, UpstreamError } from './http.ts';
import type { Lang } from '../shared/sources.ts';
import {
  cacheParsed,
  parseAyaTranslation,
  parseEditionList,
  parseSuraTranslation,
  QURANENC_TTL_MS,
  readCached,
  selectEdition,
  type QuranEncAyah,
  type QuranEncEdition,
} from '../shared/quranenc.ts';

const LIST = 'https://quranenc.com/api/v1/translations/list';
const SURA = 'https://quranenc.com/api/v1/translation/sura';
const AYA = 'https://quranenc.com/api/v1/translation/aya';

const memory = new Map<string, { value: unknown; expires: number }>();
const inflight = new Map<string, Promise<unknown>>();

const UNREADABLE = 'QuranEnc returned a translation that could not be read. No other translation was substituted.';
const NO_RESPONSE = 'QuranEnc did not respond. This translation was not loaded.';

async function loadCached<T>(key: string, url: string, parse: (body: unknown) => T | null, notFound: string): Promise<T> {
  const hit = readCached(memory as Map<string, { value: T; expires: number }>, key, Date.now());
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const request = (async () => {
    let body: unknown;
    try {
      body = await fetchJsonFresh(url);
    } catch (err) {
      const status = err instanceof UpstreamError ? err.status : 504;
      if (status === 404) throw new UpstreamError(notFound, 404);
      throw new UpstreamError(NO_RESPONSE, status === 504 ? 504 : 502);
    }
    const parsed = cacheParsed(memory as Map<string, { value: T; expires: number }>, key, parse(body), Date.now(), QURANENC_TTL_MS);
    if (!parsed) throw new UpstreamError(UNREADABLE, 502);
    return parsed;
  })();

  inflight.set(key, request);
  try {
    return await request;
  } finally {
    inflight.delete(key);
  }
}

export async function listQuranEncEditions(lang: Lang): Promise<QuranEncEdition[]> {
  return loadCached(
    `list:${lang}`,
    `${LIST}/${lang}`,
    body => parseEditionList(body, lang),
    'QuranEnc has no edition list for this language. No other translation was substituted.',
  );
}

export async function requireEdition(lang: Lang, requested?: string): Promise<QuranEncEdition> {
  const catalog = await listQuranEncEditions(lang);
  const selected = selectEdition(catalog, lang, requested);
  if ('error' in selected) throw new UpstreamError(selected.error, 404);
  return selected.edition;
}

export async function quranEncSura(edition: QuranEncEdition, sura: number): Promise<QuranEncAyah[]> {
  return loadCached(
    `sura:${edition.key}:${sura}`,
    `${SURA}/${encodeURIComponent(edition.key)}/${sura}`,
    body => parseSuraTranslation(body, sura),
    'QuranEnc has no text for this edition and surah. No other translation was substituted.',
  );
}

export async function quranEncAya(edition: QuranEncEdition, sura: number, aya: number): Promise<QuranEncAyah> {
  return loadCached(
    `aya:${edition.key}:${sura}:${aya}`,
    `${AYA}/${encodeURIComponent(edition.key)}/${sura}/${aya}`,
    body => parseAyaTranslation(body, sura, aya),
    'QuranEnc has no text for this edition and verse. No other translation was substituted.',
  );
}

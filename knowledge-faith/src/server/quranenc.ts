import { fetchJsonFresh, UpstreamError } from './http.ts';
import type { Lang } from '../shared/sources.ts';
import {
  acceptAudioEditionKey,
  AUDIO_EDITION_KEY_MAX,
  audioManifestUrl,
  cacheParsed,
  describeMukhtasar,
  evictExpired,
  groupSameCommentary,
  MANIFEST_CACHE_MAX,
  MANIFEST_INFLIGHT_MAX,
  MEANING_AUDIO_LIST_FAILED,
  MEANING_AUDIO_NOT_LISTED,
  MUKHTASAR_KEY,
  parseAudioManifest,
  parseAyaTranslation,
  parseEditionList,
  parseSuraTranslation,
  parseTafsirKeys,
  parseTafsirSura,
  QURANENC_TTL_MS,
  readCached,
  readEditionQuery,
  rememberBounded,
  selectEdition,
  TAFSIR_VERSION_NOTE,
  type AudioCoverage,
  type CommentarySpan,
  type QuranEncAyah,
  type QuranEncEdition,
} from '../shared/quranenc.ts';

const LIST = 'https://quranenc.com/api/v1/translations/list';
const SURA = 'https://quranenc.com/api/v1/translation/sura';
const AYA = 'https://quranenc.com/api/v1/translation/aya';
const TAFSIR_LIST = 'https://quranenc.com/api/v1/tafsirs/list';

const memory = new Map<string, { value: unknown; expires: number }>();
const inflight = new Map<string, Promise<unknown>>();
const manifestCache = new Map<string, { value: AudioCoverage | { absent: true }; expires: number }>();
const manifestInflight = new Map<string, Promise<AudioCoverage | null>>();
let manifestSlots = 0;
const manifestWaiters: Array<() => void> = [];

function cachedEditionKeys(): Set<string> {
  const keys = new Set<string>();
  const now = Date.now();
  for (const lang of ['en', 'ta', 'si'] as const) {
    const list = readCached(memory as Map<string, { value: QuranEncEdition[]; expires: number }>, `list:${lang}`, now);
    if (!list) continue;
    for (const edition of list) keys.add(edition.key);
  }
  return keys;
}

function takeManifestSlot(): Promise<void> {
  if (manifestSlots < MANIFEST_INFLIGHT_MAX) {
    manifestSlots += 1;
    return Promise.resolve();
  }
  return new Promise(resolve => {
    manifestWaiters.push(() => {
      manifestSlots += 1;
      resolve();
    });
  });
}

function releaseManifestSlot(): void {
  manifestSlots -= 1;
  const next = manifestWaiters.shift();
  if (next) next();
  else if (manifestSlots < 0) manifestSlots = 0;
}

/** Refuse a key that is too long, malformed, or outside the approved audio editions and the cached catalogue. */
export function audioManifestEdition(value: unknown, catalogue?: ReadonlySet<string>): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > AUDIO_EDITION_KEY_MAX) {
    throw new UpstreamError('That QuranEnc edition key cannot be used. No other translation was substituted.', 400);
  }
  const requested = readEditionQuery(value);
  if ('error' in requested || !requested.key) {
    throw new UpstreamError(
      'error' in requested ? requested.error : 'Choose one QuranEnc edition. No other translation was substituted.',
      400,
    );
  }
  if (!acceptAudioEditionKey(requested.key, catalogue ?? cachedEditionKeys())) {
    throw new UpstreamError('That QuranEnc edition is not an approved audio edition. No list was requested.', 400);
  }
  return requested.key;
}

export function audioManifestCacheSize(): number {
  evictExpired(manifestCache, Date.now());
  return manifestCache.size;
}

export function resetAudioManifestCacheForTests(): void {
  manifestCache.clear();
  manifestInflight.clear();
  manifestWaiters.length = 0;
  manifestSlots = 0;
}

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
      if (err instanceof UpstreamError && (status === 429 || status === 504)) throw err;
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

/**
 * Load one edition's files.json. A 404 is cached as absence. Network failures and unreadable
 * manifests are not stored, and a missing list is never replaced with another edition.
 */
export async function loadAudioManifest(key: string, catalogue?: ReadonlySet<string>): Promise<AudioCoverage | null> {
  const edition = audioManifestEdition(key, catalogue);
  const url = audioManifestUrl(edition);
  if (!url) throw new UpstreamError(MEANING_AUDIO_LIST_FAILED, 400);
  const now = Date.now();
  evictExpired(manifestCache, now);
  const hit = readCached(manifestCache, edition, now);
  if (hit) return 'absent' in hit ? null : hit;
  const pending = manifestInflight.get(edition);
  if (pending) return pending;

  const request = (async () => {
    await takeManifestSlot();
    try {
      const again = readCached(manifestCache, edition, Date.now());
      if (again) return 'absent' in again ? null : again;
      let body: unknown;
      try {
        body = await fetchJsonFresh(url);
      } catch (err) {
        const status = err instanceof UpstreamError ? err.status : 504;
        if (status === 404) {
          rememberBounded(manifestCache, edition, { absent: true }, Date.now(), QURANENC_TTL_MS, MANIFEST_CACHE_MAX);
          return null;
        }
        throw new UpstreamError(MEANING_AUDIO_LIST_FAILED, status === 504 ? 504 : 502);
      }
      const parsed = parseAudioManifest(body, edition);
      if (!parsed) throw new UpstreamError(MEANING_AUDIO_LIST_FAILED, 502);
      rememberBounded(manifestCache, edition, parsed, Date.now(), QURANENC_TTL_MS, MANIFEST_CACHE_MAX);
      return parsed;
    } finally {
      releaseManifestSlot();
    }
  })();

  manifestInflight.set(edition, request);
  try {
    return await request;
  } finally {
    manifestInflight.delete(edition);
  }
}

/** Meaning coverage for a text response. A failed list leaves the translation in place and omits audio. */
export async function meaningCoverage(key: string): Promise<AudioCoverage | null> {
  try {
    return await loadAudioManifest(key);
  } catch (err) {
    if (err instanceof UpstreamError) return null;
    throw err;
  }
}

export { MEANING_AUDIO_NOT_LISTED };

export interface MukhtasarPassage {
  surah: number;
  lang: Lang;
  key: string;
  listedInTafsir: boolean;
  listNote: string;
  version: null;
  versionNote: string;
  source: string;
  spans: CommentarySpan[];
}

async function loadTafsirKeys(lang: Lang): Promise<string[] | null> {
  try {
    return await loadCached(
      `tafsir-list:${lang}`,
      `${TAFSIR_LIST}/${lang}`,
      parseTafsirKeys,
      'QuranEnc has no tafsir list for this language.',
    );
  } catch {
    return null;
  }
}

/** Al-Mukhtasar for one surah. Loaded only when the reader asks. Meaning audio is not attached. */
export async function loadMukhtasar(lang: Lang, surah: number): Promise<MukhtasarPassage> {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw new UpstreamError('Surah must be between 1 and 114', 400);
  const key = MUKHTASAR_KEY[lang];
  const [rows, listedKeys] = await Promise.all([
    loadCached(
      `mukhtasar:${key}:${surah}`,
      `${SURA}/${encodeURIComponent(key)}/${surah}`,
      body => parseTafsirSura(body, surah),
      'Al-Mukhtasar text is unavailable for this surah. No other commentary was substituted.',
    ),
    loadTafsirKeys(lang),
  ]);
  const described = describeMukhtasar(lang, key, listedKeys);
  return {
    surah,
    lang,
    key,
    listedInTafsir: described.listedInTafsir,
    listNote: described.listNote,
    version: null,
    versionNote: described.versionNote || TAFSIR_VERSION_NOTE,
    source: `${SURA}/${key}/${surah}`,
    spans: groupSameCommentary(rows),
  };
}

export async function quranEncAya(edition: QuranEncEdition, sura: number, aya: number): Promise<QuranEncAyah> {
  return loadCached(
    `aya:${edition.key}:${sura}:${aya}`,
    `${AYA}/${encodeURIComponent(edition.key)}/${sura}/${aya}`,
    body => parseAyaTranslation(body, sura, aya),
    'QuranEnc has no text for this edition and verse. No other translation was substituted.',
  );
}

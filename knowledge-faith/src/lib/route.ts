/** Hash routes for Knowledge & Faith. `#/prayer` remains an alias of `#/spiritual`. */

export const ROUTE_ROOTS = ['hub', 'quran', 'hadith', 'books', 'spiritual', 'studio', 'podcast'] as const;
export type RouteRoot = (typeof ROUTE_ROOTS)[number];

export type ResearchDeskName = 'knowledge' | 'quran' | 'hadith' | 'books' | 'fiqh' | 'seerah';
export type ResearchEntryName = 'knowledge' | 'quran' | 'hadith' | 'books';

/** Research desks. Fiqh and Seerah stay on the hub and still research as Knowledge. */
export function openedResearchDesk(path: RouteRoot, segments: string[]): { entry: ResearchEntryName; desk: ResearchDeskName } | null {
  if (path === 'hub' && segments[0] === 'fiqh') return { entry: 'knowledge', desk: 'fiqh' };
  if (path === 'hub' && segments[0] === 'seerah') return { entry: 'knowledge', desk: 'seerah' };
  if (segments[0] !== 'research') return null;
  if (path === 'hub') return { entry: 'knowledge', desk: 'knowledge' };
  if (path === 'quran' || path === 'hadith' || path === 'books') return { entry: path, desk: path };
  return null;
}

const ALIASES: Record<string, string> = {
  'screen-13': 'hub',
  'screen-14': 'quran/study',
  'screen-15': 'hadith/research',
  'screen-16': 'spiritual',
  'screen-17': 'hub/scholar',
  podcasts: 'studio/roundtable',
};

export function resolveHashPath(raw: string): string {
  const clean = raw.replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '');
  if (ALIASES[clean]) return ALIASES[clean];
  if (clean === 'prayer' || clean.startsWith('prayer/')) return `spiritual${clean.slice('prayer'.length)}`;
  return clean;
}

export function parseHash(hash: string): { path: RouteRoot; segments: string[]; params: URLSearchParams } {
  const queryAt = hash.indexOf('?');
  const pathPart = queryAt === -1 ? hash : hash.slice(0, queryAt);
  const params = new URLSearchParams(queryAt === -1 ? '' : hash.slice(queryAt + 1));
  const parts = resolveHashPath(pathPart).split('/').filter(Boolean);
  const path = parts[0] ?? 'hub';
  if (!ROUTE_ROOTS.includes(path as RouteRoot)) return { path: 'hub', segments: [], params };
  return { path: path as RouteRoot, segments: parts.slice(1), params };
}

export function spiritualHref(segments: string[] = []): string {
  return `#/spiritual${segments.length ? `/${segments.join('/')}` : ''}`;
}

/**
 * Qur'an lists use the section field only.
 * A hadith dossier `?q=` or `?hadith=` stays on the address bar and must not filter surahs.
 */
export function quranListQuery(sectionQuery: string, locationSearch = ''): string {
  const params = new URLSearchParams(locationSearch.replace(/^\?/, ''));
  params.delete('q');
  params.delete('hadith');
  return sectionQuery.trim();
}

/** Shell search is shown only where the open section reads the query. */
export function showSectionSearch(path: RouteRoot, segments: string[]): boolean {
  if (path === 'hub') return segments[0] === 'discover' || segments[0] === 'deepen' || segments[0] === 'prophet';
  if (path === 'quran') return segments[0] == null || segments[0] === 'search';
  if (path === 'books') return segments[0] !== 'research' && segments[0] !== 'item';
  if (path === 'podcast') return false;
  if (path === 'hadith') {
    if (segments[0] === 'research') return false;
    if (segments[0] && /^\d+$/.test(segments[0])) return false;
    return true;
  }
  if (path === 'studio') return segments[0] !== 'roundtable' && segments[0] !== 'pilot';
  if (path === 'spiritual') return segments.length === 0;
  return false;
}

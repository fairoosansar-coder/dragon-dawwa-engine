/** Hash routes for Knowledge & Faith. `#/prayer` remains an alias of `#/spiritual`. */

export const ROUTE_ROOTS = ['hub', 'quran', 'hadith', 'spiritual', 'studio'] as const;
export type RouteRoot = (typeof ROUTE_ROOTS)[number];

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

export function parseHash(hash: string): { path: RouteRoot; segments: string[] } {
  const parts = resolveHashPath(hash).split('/').filter(Boolean);
  const path = parts[0] ?? 'hub';
  if (!ROUTE_ROOTS.includes(path as RouteRoot)) return { path: 'hub', segments: [] };
  return { path: path as RouteRoot, segments: parts.slice(1) };
}

export function spiritualHref(segments: string[] = []): string {
  return `#/spiritual${segments.length ? `/${segments.join('/')}` : ''}`;
}

/** Shell search is shown only where the open section reads the query. */
export function showSectionSearch(path: RouteRoot, segments: string[]): boolean {
  if (path === 'hub' || path === 'quran') return true;
  if (path === 'hadith') {
    if (segments[0] === 'research') return false;
    if (segments[0] && /^\d+$/.test(segments[0])) return false;
    return true;
  }
  if (path === 'studio') return false;
  if (path === 'spiritual') return segments.length === 0;
  return false;
}

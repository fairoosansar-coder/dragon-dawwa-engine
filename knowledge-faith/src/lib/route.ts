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

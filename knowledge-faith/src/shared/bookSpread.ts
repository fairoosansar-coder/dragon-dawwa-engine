/** A public IslamHouse PDF the browser can read directly. Other addresses are refused. */
export function islamHousePdfUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (url.hostname !== 'd1.islamhouse.com') return null;
  if (!url.pathname.startsWith('/data/') || !url.pathname.toLowerCase().endsWith('.pdf')) return null;
  return url.toString();
}

export function clampPage(page: number, total: number): number {
  if (!Number.isInteger(total) || total < 1) return 1;
  if (!Number.isInteger(page)) return 1;
  return Math.min(Math.max(page, 1), total);
}

export interface BookLeaf {
  pages: number[];
  /** An empty sheet beside a final odd leaf, so the spread still closes. */
  blank: 'right' | null;
}

/**
 * Cover (page 1) stands alone. Later leaves pair an even page on the left
 * with the next page on the right. A single-page reader returns one page.
 */
export function facingPages(page: number, total: number, spread: boolean): BookLeaf {
  const current = clampPage(page, total);
  if (!spread || total < 2) return { pages: [current], blank: null };
  if (current <= 1) return { pages: [1], blank: null };
  const left = current % 2 === 0 ? current : current - 1;
  if (left + 1 <= total) return { pages: [left, left + 1], blank: null };
  return { pages: [left], blank: 'right' };
}

export function spreadOrigin(page: number, total: number, spread: boolean): number {
  return facingPages(page, total, spread).pages[0] ?? 1;
}

/** Turn one leaf and land on the first page of the leaf that opens. */
export function stepPage(page: number, total: number, spread: boolean, direction: 1 | -1): number {
  const shown = facingPages(page, total, spread);
  const first = shown.pages[0] ?? 1;
  const last = shown.pages[shown.pages.length - 1] ?? first;
  const raw = direction > 0 ? (last >= total ? first : last + 1) : first <= 1 ? 1 : first - 1;
  return spreadOrigin(raw, total, spread);
}

export interface AyahRef {
  surah: number;
  ayah: number;
}

export interface HadithRef {
  collection: string;
  number: number;
}

export function refKey(ref: AyahRef): string {
  return `${ref.surah}:${ref.ayah}`;
}

/** Parses "2:153" or a range "96:1-5" into individual ayah references. */
export function parseRefs(input: string): AyahRef[] {
  const match = /^\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*$/.exec(input);
  if (!match) return [];
  const surah = Number(match[1]);
  const start = Number(match[2]);
  const end = match[3] ? Number(match[3]) : start;
  if (surah < 1 || surah > 114 || start < 1 || end < start || end - start > 49) return [];
  return Array.from({ length: end - start + 1 }, (_, i) => ({ surah, ayah: start + i }));
}

export function isValidRef(ref: AyahRef, ayahCounts: readonly number[]): boolean {
  return (
    Number.isInteger(ref.surah) &&
    Number.isInteger(ref.ayah) &&
    ref.surah >= 1 &&
    ref.surah <= ayahCounts.length &&
    ref.ayah >= 1 &&
    ref.ayah <= ayahCounts[ref.surah - 1]
  );
}

export function dedupeRefs<T>(items: T[], key: (item: T) => string, limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

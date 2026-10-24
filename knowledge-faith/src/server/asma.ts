import type { AsmaCollection, AsmaName } from '../shared/types.ts';
import { DAY, fetchJson, UpstreamError } from './http.ts';

const URL = 'https://api.aladhan.com/v1/asmaAlHusna';

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Accepts the Aladhan payload only when all 99 records are complete. Returns null instead of filling gaps. */
export function parseAsmaPayload(payload: unknown): AsmaName[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length !== 99) return null;
  const names: AsmaName[] = [];
  const seen = new Set<number>();
  for (const item of data) {
    if (!item || typeof item !== 'object') return null;
    const row = item as { number?: unknown; name?: unknown; transliteration?: unknown; en?: { meaning?: unknown } };
    const number = row.number;
    const arabic = text(row.name);
    const transliteration = text(row.transliteration);
    const meaning = text(row.en?.meaning);
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 1 || number > 99) return null;
    if (seen.has(number) || !arabic || !transliteration || !meaning) return null;
    seen.add(number);
    names.push({ number, arabic, transliteration, meaning });
  }
  if (seen.size !== 99) return null;
  names.sort((a, b) => a.number - b.number);
  return names;
}

export async function getAsma(): Promise<AsmaCollection> {
  const payload = await fetchJson<unknown>(URL, 7 * DAY);
  const names = parseAsmaPayload(payload);
  if (!names) throw new UpstreamError('The Asma al-Husna collection did not match the expected 99 named records', 502);
  return {
    names,
    source: {
      name: 'Aladhan',
      url: URL,
      transliteration: 'Latin',
      meaningLanguage: 'en',
      perNameReference: false,
      scholarReviewed: false,
    },
  };
}

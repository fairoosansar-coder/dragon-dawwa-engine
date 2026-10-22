import { ISLAMHOUSE_TTL_MS } from '../shared/islamhouse.ts';

const cache = new Map<string, { html: string; expires: number }>();

/** Official IslamHouse reader HTML. Other hosts, and files outside /read/, are refused. */
export async function fetchReaderHtml(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'islamhouse.com' || !parsed.pathname.startsWith('/read/')) return null;
  const key = parsed.toString();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.html;
  try {
    const res = await fetch(key, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: 'text/html', 'User-Agent': 'DragonDawwa/1.0' },
    });
    const finalUrl = new URL(res.url);
    if (!res.ok || finalUrl.hostname !== 'islamhouse.com' || !finalUrl.pathname.startsWith('/read/')) return null;
    const html = await res.text();
    cache.set(key, { html, expires: Date.now() + ISLAMHOUSE_TTL_MS });
    return html;
  } catch {
    return null;
  }
}

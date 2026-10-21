const ALLOWED_HOSTS = new Set(['api.alquran.cloud', 'cdn.jsdelivr.net', 'api.aladhan.com', 'quranenc.com']);
const MAX_ENTRIES = 500;

interface Entry {
  value: unknown;
  expires: number;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export class UpstreamError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

/** GET JSON from an allowlisted upstream with a timeout and a bounded in-memory TTL cache. */
export async function fetchJson<T>(url: string, ttlMs: number, timeoutMs = 12_000): Promise<T> {
  const host = new URL(url).hostname;
  if (!ALLOWED_HOSTS.has(host)) throw new UpstreamError(`Upstream host not allowed: ${host}`, 500);

  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) {
    cache.delete(url);
    cache.set(url, hit);
    return hit.value as T;
  }
  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;

  const request = (async () => {
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
    } catch {
      throw new UpstreamError(`${host} did not respond`, 504);
    }
    if (res.status === 404) throw new UpstreamError('Not found at source', 404);
    if (!res.ok) throw new UpstreamError(`${host} returned ${res.status}`);
    const value = (await res.json()) as T;
    cache.set(url, { value, expires: Date.now() + ttlMs });
    while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    return value;
  })();

  inflight.set(url, request);
  try {
    return (await request) as T;
  } finally {
    inflight.delete(url);
  }
}

/** GET JSON from an allowlisted host and do not store the response. Callers cache only after a successful parse. */
export async function fetchJsonFresh<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const host = new URL(url).hostname;
  if (!ALLOWED_HOSTS.has(host)) throw new UpstreamError(`Upstream host not allowed: ${host}`, 500);
  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
      headers: { Accept: 'application/json', 'User-Agent': 'DragonDawwa/1.0' },
    });
  } catch {
    throw new UpstreamError(`${host} did not respond`, 504);
  }
  const finalHost = new URL(res.url).hostname;
  if (!ALLOWED_HOSTS.has(finalHost)) throw new UpstreamError(`Upstream host not allowed: ${finalHost}`, 502);
  if (res.status === 404) throw new UpstreamError('Not found at source', 404);
  if (!res.ok) throw new UpstreamError(`${host} returned ${res.status}`);
  return (await res.json()) as T;
}

export const DAY = 86_400_000;
export const HOUR = 3_600_000;

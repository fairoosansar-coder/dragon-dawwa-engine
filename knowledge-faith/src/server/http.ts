import dns from 'node:dns';
import https from 'node:https';
import net from 'node:net';

dns.setDefaultResultOrder('ipv4first');
// IPv6 egress is off. Happy Eyeballs still starts an IPv6 attempt after 250ms and
// closes the IPv4 socket; the API's handshake reply then arrives with no socket.
net.setDefaultAutoSelectFamily?.(false);
net.setDefaultAutoSelectFamilyAttemptTimeout?.(10_000);

const ALLOWED_HOSTS = new Set([
  'api.alquran.cloud',
  'cdn.jsdelivr.net',
  'api.aladhan.com',
  'quranenc.com',
  'd.quranenc.com',
  'hadeethenc.com',
  'api3.islamhouse.com',
]);

export const SOURCE_BUSY = 'The source asked us to wait. Try again shortly.';
export const SOURCE_TIMEOUT = 'The source took too long to respond. Try again.';
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

const UPSTREAM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'DragonDawwa/1.0 (Knowledge and Faith research)',
};

function failureCode(error: unknown): string {
  const cause = (error as { cause?: { code?: string; message?: string } } | null)?.cause;
  if (cause?.code) return cause.code;
  if (cause?.message) return cause.message;
  return error instanceof Error ? error.message : 'fetch failed';
}

/** Railway resolves this name to an address it cannot finish a handshake with, and also publishes IPv6 while egress is IPv4 only. */
async function ipv4Candidates(hostname: string): Promise<string[]> {
  const found = new Set<string>();
  try {
    for (const address of await dns.promises.resolve4(hostname)) found.add(address);
  } catch {
    /* public DNS may still know the name */
  }
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      signal: AbortSignal.timeout(4_000),
      headers: { Accept: 'application/dns-json' },
    });
    if (res.ok) {
      const payload = (await res.json()) as { Answer?: { type?: number; data?: string }[] };
      for (const row of payload.Answer ?? []) {
        if (row.type === 1 && row.data && net.isIP(row.data) === 4) found.add(row.data);
      }
    }
  } catch {
    /* the system address remains available */
  }
  return [...found];
}

function httpsGet(url: string, timeoutMs: number, address: string): Promise<Response> {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: address,
        servername: target.hostname,
        method: 'GET',
        path: `${target.pathname}${target.search}`,
        headers: { ...UPSTREAM_HEADERS, Host: target.hostname },
        family: 4,
        timeout: timeoutMs,
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk as Buffer));
        res.on('error', reject);
        res.on('end', () => {
          resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 502 }));
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/** First IPv4 handshake to finish wins. A geo answer can point at an edge this host cannot complete. */
function raceIpv4(url: string, timeoutMs: number, addresses: string[]): Promise<Response> {
  const hostname = new URL(url).hostname;
  if (addresses.length === 0) return Promise.reject(new UpstreamError(SOURCE_TIMEOUT, 504));
  return new Promise((resolve, reject) => {
    let pending = addresses.length;
    let settled = false;
    for (const address of addresses) {
      httpsGet(url, timeoutMs, address).then(
        response => {
          if (settled) return;
          settled = true;
          resolve(response);
        },
        (error: unknown) => {
          console.error(`[upstream] ${hostname} via ${address} ${failureCode(error)}`);
          if (settled) return;
          pending -= 1;
          if (pending === 0) {
            settled = true;
            reject(new UpstreamError(SOURCE_TIMEOUT, 504));
          }
        },
      );
    }
  });
}

async function fetchUpstream(url: string, timeoutMs: number): Promise<Response> {
  const hostname = new URL(url).hostname;
  try {
    return await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
      headers: UPSTREAM_HEADERS,
    });
  } catch (error) {
    console.error(`[upstream] ${hostname} ${failureCode(error)}`);
    const addresses = await ipv4Candidates(hostname);
    if (addresses.length === 0) throw new UpstreamError(SOURCE_TIMEOUT, 504);
    return raceIpv4(url, timeoutMs, addresses);
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
    const res = await fetchUpstream(url, timeoutMs);
    if (res.status === 404) throw new UpstreamError('Not found at source', 404);
    if (res.status === 429) throw new UpstreamError(SOURCE_BUSY, 429);
    if (res.status === 204 || res.status === 205) throw new UpstreamError(`${host} returned an empty response`, 502);
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
  const res = await fetchUpstream(url, timeoutMs);
  const finalHost = new URL(res.url || url).hostname;
  // A missing QuranEnc audio list answers 404 and redirects to an error page on another host.
  // That is absence. Do not read the error page, and do not treat it as a failed list.
  if (res.status === 404) throw new UpstreamError('Not found at source', 404);
  if (!ALLOWED_HOSTS.has(finalHost)) throw new UpstreamError(`Upstream host not allowed: ${finalHost}`, 502);
  if (res.status === 429) throw new UpstreamError(SOURCE_BUSY, 429);
  if (res.status === 204 || res.status === 205) throw new UpstreamError(`${host} returned an empty response`, 502);
  if (!res.ok) throw new UpstreamError(`${host} returned ${res.status}`);
  return (await res.json()) as T;
}

export const DAY = 86_400_000;
export const HOUR = 3_600_000;

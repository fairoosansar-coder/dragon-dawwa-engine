import type { RequestHandler } from 'express';

/** Keep buffered downloads bounded until the response finishes sending. */
export function mediaConcurrencyLimiter(limit: number): RequestHandler {
  let active = 0;
  return (_req, res, next) => {
    if (active >= limit) {
      res.setHeader('Retry-After', '5');
      res.status(429).json({ error: 'The media reader is busy. Please retry shortly.' });
      return;
    }
    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active -= 1;
      res.off('finish', release);
      res.off('close', release);
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}

/** Only IslamHouse attachment files. Arbitrary URLs are refused. */
export function allowedMediaUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  if (url.hostname !== 'd1.islamhouse.com') return null;
  if (!url.pathname.startsWith('/data/')) return null;
  return url;
}

export function mediaViewUrl(sourceUrl: string, kind: 'pdf' | 'audio' | 'video' | 'file'): string {
  if (kind !== 'pdf') return sourceUrl;
  return `/api/library/media?url=${encodeURIComponent(sourceUrl)}`;
}

const MAX_BYTES = 20 * 1024 * 1024;

export async function readMedia(url: URL): Promise<{ type: string; body: Buffer }> {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'DragonDawwa/1.0' },
  });
  const finalUrl = new URL(response.url);
  if (finalUrl.hostname !== 'd1.islamhouse.com' || !finalUrl.pathname.startsWith('/data/')) {
    await response.body?.cancel();
    throw new Error('The file moved off the IslamHouse file host.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`The file host returned ${response.status}.`);
  }
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error('The file is larger than this reader will load.');
  }
  if (!response.body) throw new Error('The file host returned an empty body.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('The file is larger than this reader will load.');
      chunks.push(value);
    }
    return { type: response.headers.get('content-type') || 'application/octet-stream', body: Buffer.concat(chunks, bytes) };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

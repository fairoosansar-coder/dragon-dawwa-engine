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
    throw new Error('The file moved off the IslamHouse file host.');
  }
  if (!response.ok) throw new Error(`The file host returned ${response.status}.`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_BYTES) throw new Error('The file is larger than this reader will load.');
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_BYTES) throw new Error('The file is larger than this reader will load.');
  return { type: response.headers.get('content-type') || 'application/octet-stream', body };
}

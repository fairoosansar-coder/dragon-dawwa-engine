import type { IncomingMessage, ServerResponse } from 'node:http';

const cache = new Map<string, { expires: number; data: unknown }>();
export async function ummahQuranMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void, apiKey: string | undefined = process.env.UMMAH_API_KEY) {
  const path = (req.url || '').split('?')[0];
  if (!path.startsWith('/api/quran-audio/')) return next();
  res.setHeader('Content-Type', 'application/json');
  const match = /^\/api\/quran-audio\/(\d{1,3})\/(\d{1,3})$/.exec(path);
  if (req.method !== 'GET' || !match || +match[1] < 1 || +match[1] > 114 || +match[2] < 1 || +match[2] > 286) {
    res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid Quran audio request' })); return;
  }
  try {
    let hit = cache.get(path);
    if (!hit || hit.expires < Date.now()) {
      const url = new URL(`https://ummahapi.com/api/quran/audio/${+match[1]}/${+match[2]}`);
      if (apiKey) url.searchParams.set('apikey', apiKey);
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('upstream');
      const body = await response.json();
      if (!body.success || body.data?.verse_key !== `${+match[1]}:${+match[2]}` || !Array.isArray(body.data.reciters)) throw new Error('schema');
      const reciters = body.data.reciters.filter((r: any) => {
        try { const u = new URL(r.audio_url); return u.protocol === 'https:' && u.hostname === 'everyayah.com'; } catch { return false; }
      }).map((r: any) => ({ id: r.id, name: r.name, audio_url: r.audio_url }));
      if (!reciters.length) throw new Error('empty');
      hit = { expires: Date.now() + 3600000, data: { verse_key: body.data.verse_key, reciters } };
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(path, hit);
    }
    res.end(JSON.stringify(hit.data));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'Quran audio is unavailable. Please retry.' }));
  }
}

import type { IncomingMessage, ServerResponse } from 'node:http';
const cache = new Map<string, { expires: number; data: unknown }>();
export async function ummahStudyMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void, apiKey: string | undefined = process.env.UMMAH_API_KEY) {
  const path = (req.url || '').split('?')[0];
  if (!path.startsWith('/api/quran-study/')) return next();
  res.setHeader('Content-Type', 'application/json');
  const match = /^\/api\/quran-study\/(words|ibn_kathir|maarif|muyassar|ibn_kathir_ar)\/(\d{1,3})\/(\d{1,3})$/.exec(path);
  if (req.method !== 'GET' || !match || +match[2] < 1 || +match[2] > 114 || +match[3] < 1 || +match[3] > 286) {
    res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid study request' })); return;
  }
  const [, kind, s, a] = match;
  try {
    let hit = cache.get(path);
    if (!hit || hit.expires < Date.now()) {
      const url = new URL(kind === 'words' ? `https://ummahapi.com/api/quran/words/${+s}/${+a}` : `https://ummahapi.com/api/tafsir/${kind}/surah/${+s}/ayah/${+a}`);
      if (apiKey) url.searchParams.set('apikey', apiKey);
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('upstream');
      const body = await response.json(); const data = body.data;
      if (!body.success || data?.verse_key !== `${+s}:${+a}`) throw new Error('reference');
      if (kind === 'words' ? !Array.isArray(data.words) || !data.words.length : data.tafsir?.key !== kind || typeof data.tafsir?.text !== 'string' || !data.tafsir.text.trim()) throw new Error('schema');
      hit = { expires: Date.now() + 3600000, data };
      if (cache.size >= 150) cache.delete(cache.keys().next().value!);
      cache.set(path, hit);
    }
    res.end(JSON.stringify(hit.data));
  } catch {
    res.statusCode = 502; res.end(JSON.stringify({ error: 'Study content unavailable. Please retry.' }));
  }
}

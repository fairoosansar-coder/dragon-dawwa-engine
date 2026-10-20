import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { HADITH_COLLECTIONS, PRAYER_METHODS, RECITERS, toLang } from './src/shared/sources.ts';
import { dedupeRefs, parseRefs, refKey, type HadithRef } from './src/shared/refs.ts';
import type { PodcastLine } from './src/shared/types.ts';
import { getSurah, getVerses, listSurahs } from './src/server/quran.ts';
import { getHadith, getSection, listSections } from './src/server/hadith.ts';
import { getPrayerTimes } from './src/server/prayer.ts';
import { UpstreamError } from './src/server/http.ts';
import { hadithEvidence, verseEvidence } from './src/server/grounding.ts';
import {
  ask,
  gatherEvidence,
  geminiConfigured,
  narrate,
  narrateDialogue,
  VOICES,
  writePodcast,
  type SourceFetchers,
} from './src/server/gemini.ts';

const PORT = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === 'production';

const fetchers: SourceFetchers = {
  verses: getVerses,
  hadith: (ref, lang) => getHadith(ref.collection, ref.number, lang),
};

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

type Handler = (req: Request, res: Response) => Promise<unknown>;
const route = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

function text(value: unknown, max: number, field: string): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new UpstreamError(`${field} is required`, 400);
  if (s.length > max) throw new UpstreamError(`${field} must be at most ${max} characters`, 400);
  return s;
}

const AI_WINDOW_MS = 15 * 60_000;
const AI_LIMIT = Number(process.env.AI_REQUESTS_PER_15_MIN ?? 30);
const aiUsage = new Map<string, number[]>();

function aiLimiter(req: Request, res: Response, next: NextFunction) {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const recent = (aiUsage.get(key) ?? []).filter(t => now - t < AI_WINDOW_MS);
  if (recent.length >= AI_LIMIT) {
    res.status(429).json({ error: 'Too many AI requests. Please wait a few minutes and try again.' });
    return;
  }
  recent.push(now);
  aiUsage.set(key, recent);
  if (aiUsage.size > 10_000) aiUsage.clear();
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'UmmaConnect Knowledge & Faith', ai: geminiConfigured() });
});

app.get('/api/config', (_req, res) => {
  res.json({
    ai: geminiConfigured(),
    reciters: RECITERS,
    voices: VOICES,
    prayerMethods: PRAYER_METHODS,
    hadithCollections: HADITH_COLLECTIONS,
  });
});

app.get('/api/quran/surahs', route(async (_req, res) => res.json(await listSurahs())));

app.get(
  '/api/quran/surah/:n',
  route(async (req, res) => res.json(await getSurah(Number(req.params.n), toLang(req.query.lang)))),
);

app.get(
  '/api/quran/verses',
  route(async (req, res) => {
    const refs = dedupeRefs(String(req.query.refs ?? '').split(',').flatMap(parseRefs), refKey, 60);
    res.json(await getVerses(refs, toLang(req.query.lang)));
  }),
);

app.get(
  '/api/hadith/:collection/sections',
  route(async (req, res) => res.json(await listSections(String(req.params.collection)))),
);

app.get(
  '/api/hadith/:collection/section/:n',
  route(async (req, res) =>
    res.json(await getSection(String(req.params.collection), Number(req.params.n), toLang(req.query.lang))),
  ),
);

app.get(
  '/api/hadith/:collection/:number',
  route(async (req, res) => {
    const hadith = await getHadith(String(req.params.collection), Number(req.params.number), toLang(req.query.lang));
    if (!hadith) throw new UpstreamError('Hadith not found', 404);
    res.json(hadith);
  }),
);

app.get(
  '/api/prayer',
  route(async (req, res) =>
    res.json(
      await getPrayerTimes(Number(req.query.lat), Number(req.query.lng), Number(req.query.method), Number(req.query.school)),
    ),
  ),
);

app.post(
  '/api/ask',
  aiLimiter,
  route(async (req, res) => {
    const question = text(req.body?.question, 500, 'question');
    res.json(await ask(question, toLang(req.body?.lang), fetchers));
  }),
);

app.post(
  '/api/podcast/script',
  aiLimiter,
  route(async (req, res) => {
    const topic = text(req.body?.topic, 300, 'topic');
    const lang = toLang(req.body?.lang);
    const minutes = Math.min(Math.max(Number(req.body?.minutes) || 2, 1), 5);
    const refs = Array.isArray(req.body?.refs)
      ? dedupeRefs((req.body.refs as unknown[]).flatMap(r => parseRefs(String(r))), refKey, 8)
      : [];
    const hadithRefs: HadithRef[] = Array.isArray(req.body?.hadith)
      ? (req.body.hadith as HadithRef[]).slice(0, 4).map(h => ({ collection: String(h.collection), number: Number(h.number) }))
      : [];
    const evidence =
      refs.length || hadithRefs.length
        ? [
            ...verseEvidence(await getVerses(refs, lang)),
            ...hadithEvidence(
              (await Promise.all(hadithRefs.map(h => getHadith(h.collection, h.number, lang).catch(() => null)))).filter(
                h => h !== null,
              ),
            ),
          ]
        : await gatherEvidence(topic, lang, fetchers);
    res.json(await writePodcast(topic, lang, minutes, evidence));
  }),
);

app.post(
  '/api/voice/narrate',
  aiLimiter,
  route(async (req, res) => {
    const body = text(req.body?.text, 3000, 'text');
    const style = typeof req.body?.style === 'string' ? req.body.style : '';
    res.json(await narrate(body, req.body?.voice, style));
  }),
);

app.post(
  '/api/voice/dialogue',
  aiLimiter,
  route(async (req, res) => {
    const lines: PodcastLine[] = Array.isArray(req.body?.lines)
      ? (req.body.lines as PodcastLine[]).slice(0, 60).map(l => ({
          speaker: l.speaker === 'Guest' ? 'Guest' : 'Host',
          text: String(l.text ?? '').trim(),
          citations: [],
        }))
      : [];
    const total = lines.reduce((n, l) => n + l.text.length, 0);
    if (!lines.length || total > 6000) throw new UpstreamError('Provide 1-60 lines totalling at most 6000 characters', 400);
    res.json(await narrateDialogue(lines, req.body?.hostVoice, req.body?.guestVoice));
  }),
);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof UpstreamError ? err.status : 500;
  if (status >= 500) console.error(err);
  const message = err instanceof UpstreamError ? err.message : 'Unexpected server error';
  res.status(status).json({ error: message });
});

if (isProduction) {
  const dist = path.resolve(import.meta.dirname, 'dist');
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(PORT, () => {
  console.log(`Knowledge & Faith running on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
});

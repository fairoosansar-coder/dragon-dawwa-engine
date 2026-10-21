import './src/server/loadEnv.ts';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { HADITH_COLLECTIONS, PRAYER_METHODS, RECITERS, toLang } from './src/shared/sources.ts';
import { dedupeRefs, parseRefs, refKey, type HadithRef } from './src/shared/refs.ts';
import type { PodcastLine } from './src/shared/types.ts';
import { getSurah, getVerses, listSurahs } from './src/server/quran.ts';
import { getHadith, getSection, listSections } from './src/server/hadith.ts';
import { getPrayerTimes } from './src/server/prayer.ts';
import { getHijriMonth } from './src/server/hijriMonth.ts';
import { suggestZakahFields } from './src/server/zakahDraft.ts';
import { UpstreamError } from './src/server/http.ts';
import { hadithEvidence, verseEvidence } from './src/server/grounding.ts';
import {
  ask,
  gatherEvidence,
  generateJson,
  geminiConfigured,
  narrate,
  narrateDialogue,
  VOICES,
  writePodcast,
  type SourceFetchers,
} from './src/server/gemini.ts';
import { executeDragonDawwaAnalysis } from './src/engine/server/hadithEngine.ts';
import { synthesizeRoundtableVoice } from './src/engine/server/geminiTtsService.ts';
import { extractHadithFromMedia } from './src/engine/server/hadithOcrService.ts';
import { transcribeAudioWithGemini } from './src/engine/server/geminiAudioTranscribe.ts';
import { ummahQuranMiddleware } from './src/engine/server/ummahQuran.ts';
import { ummahStudyMiddleware } from './src/engine/server/ummahStudy.ts';
import { publicAppUrl, viteDevServerOptions } from './src/server/publicUrl.ts';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

const fetchers: SourceFetchers = {
  verses: getVerses,
  hadith: (ref, lang) => getHadith(ref.collection, ref.number, lang),
};

const app = express();
app.disable('x-powered-by');
if (process.env.CODESPACES === 'true' || process.env.CODESPACE_NAME) {
  app.set('trust proxy', 1);
}
app.use(ummahQuranMiddleware);
app.use(ummahStudyMiddleware);
app.use(['/api/extract-hadith-media', '/api/transcribe-audio'], express.json({ limit: '15mb' }));
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

function rateLimiter(limit: number) {
  const usage = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const recent = (usage.get(key) ?? []).filter(t => now - t < AI_WINDOW_MS);
    if (recent.length >= limit) {
      res.status(429).json({ error: 'Too many AI requests. Please wait a few minutes and try again.' });
      return;
    }
    recent.push(now);
    usage.set(key, recent);
    if (usage.size > 10_000) usage.clear();
    next();
  };
}

const aiLimiter = rateLimiter(Number(process.env.AI_REQUESTS_PER_15_MIN ?? 30));
// The roundtable player synthesises one request per script line.
const ttsLimiter = rateLimiter(Number(process.env.TTS_REQUESTS_PER_15_MIN ?? 240));

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
      await getPrayerTimes(
        Number(req.query.lat),
        Number(req.query.lng),
        Number(req.query.method),
        Number(req.query.school),
        typeof req.query.date === 'string' && req.query.date ? req.query.date : undefined,
        Number(req.query.latAdj),
      ),
    ),
  ),
);

app.get(
  '/api/hijri-month',
  route(async (req, res) => res.json(await getHijriMonth(Number(req.query.year), Number(req.query.month)))),
);

app.post(
  '/api/spiritual/zakah-draft',
  aiLimiter,
  route(async (req, res) => {
    requireAi();
    const description = text(req.body?.description, 1000, 'description');
    res.json(await suggestZakahFields(description, generateJson));
  }),
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

function requireAi() {
  if (!geminiConfigured()) throw new UpstreamError('AI features are not configured on this server (GEMINI_API_KEY missing).', 503);
}

function engineFailure(err: unknown, fallback: string): UpstreamError {
  if (err instanceof UpstreamError) return err;
  console.error(err);
  const message = err instanceof Error ? err.message : '';
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(message)) return new UpstreamError('Gemini is temporarily unavailable. Please retry.', 503);
  return new UpstreamError(fallback, 502);
}

app.post(
  '/api/analyze',
  aiLimiter,
  route(async (req, res) => {
    const hadith = text(req.body?.hadith_input, 4000, 'hadith_input');
    const isnad = typeof req.body?.isnad_input === 'string' ? req.body.isnad_input.slice(0, 2000) : '';
    requireAi();
    try {
      res.json(await executeDragonDawwaAnalysis(hadith, isnad, toLang(req.body?.preferred_language)));
    } catch (err) {
      throw engineFailure(err, 'The hadith research engine could not complete this request. Please retry.');
    }
  }),
);

app.post(
  '/api/tts',
  ttsLimiter,
  route(async (req, res) => {
    const body = text(req.body?.text, 3000, 'text');
    const speaker = typeof req.body?.speaker === 'string' ? req.body.speaker.slice(0, 80) : 'Host';
    const voice = typeof req.body?.voiceName === 'string' ? req.body.voiceName.slice(0, 40) : undefined;
    requireAi();
    try {
      res.json(await synthesizeRoundtableVoice(body, speaker, voice));
    } catch (err) {
      throw engineFailure(err, 'Gemini neural voice failed. The robotic system voice is not used. Please retry.');
    }
  }),
);

function base64Field(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new UpstreamError(`${field} is required`, 400);
  return value;
}

const MEDIA_TYPE = /^(image\/[a-z0-9.+-]+|application\/pdf|text\/plain|audio\/[a-z0-9.+-]+)$/i;

function mediaType(value: unknown, fallback: string): string {
  const type = typeof value === 'string' && value ? value.split(';')[0].trim() : fallback;
  if (!MEDIA_TYPE.test(type)) throw new UpstreamError('Unsupported file type', 415);
  return type;
}

app.post(
  '/api/extract-hadith-media',
  aiLimiter,
  route(async (req, res) => {
    const file = base64Field(req.body?.file_base64, 'file_base64');
    const type = mediaType(req.body?.mime_type, 'image/jpeg');
    const notes = typeof req.body?.user_notes === 'string' ? req.body.user_notes.slice(0, 1000) : undefined;
    requireAi();
    try {
      res.json(await extractHadithFromMedia(file, type, notes));
    } catch (err) {
      throw engineFailure(err, 'The media service could not read this file.');
    }
  }),
);

app.post(
  '/api/transcribe-audio',
  aiLimiter,
  route(async (req, res) => {
    const audio = base64Field(req.body?.audio_base64, 'audio_base64');
    const type = mediaType(req.body?.mime_type, 'audio/webm');
    requireAi();
    try {
      res.json(await transcribeAudioWithGemini(audio, type));
    } catch (err) {
      throw engineFailure(err, 'Speech transcription failed. Please retry.');
    }
  }),
);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const parserStatus = (err as { status?: unknown; expose?: unknown }).expose === true ? Number((err as { status?: unknown }).status) : 0;
  const status = err instanceof UpstreamError ? err.status : parserStatus || 500;
  if (status >= 500) console.error(err);
  const message =
    err instanceof UpstreamError ? err.message : status === 413 ? 'Upload is too large' : parserStatus ? 'Invalid request body' : 'Unexpected server error';
  res.status(status).json({ error: message });
});

if (isProduction) {
  const dist = path.resolve(import.meta.dirname, 'dist');
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, ...viteDevServerOptions(PORT) },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, HOST, () => {
  console.log(
    `Knowledge & Faith running on ${publicAppUrl(PORT)} (${isProduction ? 'production' : 'development'}); Gemini neural TTS ${geminiConfigured() ? 'on' : 'off'}`,
  );
});

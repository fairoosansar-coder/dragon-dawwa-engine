import './src/server/loadEnv.ts';
import express, { type NextFunction, type Request, type Response } from 'express';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { HADITH_COLLECTIONS, PRAYER_METHODS, RECITERS, quranPronunciationEdition, toLang } from './src/shared/sources.ts';
import { dedupeRefs, parseRefs, refKey, type HadithRef } from './src/shared/refs.ts';
import type { PodcastLine } from './src/shared/types.ts';
import { getSurah, getSurahArabic, getSurahMeaning, getVerses, listSurahs } from './src/server/quran.ts';
import { audioManifestEdition, listQuranEncEditions, loadAudioManifest, loadMukhtasar, MEANING_AUDIO_NOT_LISTED } from './src/server/quranenc.ts';
import { readEditionQuery } from './src/shared/quranenc.ts';
import { getAsma } from './src/server/asma.ts';
import { getHadith, getSection, listSections } from './src/server/hadith.ts';
import { getPrayerTimes } from './src/server/prayer.ts';
import { getHijriMonth } from './src/server/hijriMonth.ts';
import { suggestZakahFields } from './src/server/zakahDraft.ts';
import { UpstreamError } from './src/server/http.ts';
import { encyclopediaEvidence, hadithEvidence, verseEvidence } from './src/server/grounding.ts';
import { loadHadeeth, loadHadeethCategories, loadHadeethList, searchHadeeth } from './src/server/hadeethenc.ts';
import { pageByRelevance } from './src/shared/hadeethenc.ts';
import { askPilot, loadPilotEpisode } from './src/server/pilot.ts';
import { loadKnowledgeShelf, loadLibrary, loadLibraryItem } from './src/server/islamhouse.ts';
import { loadBookDetail, loadBookMeta, loadBookShelf, loadBookStats } from './src/server/bookShelf.ts';
import { readingPages } from './src/server/pdfPages.ts';
import { readLibraryItem } from './src/server/libraryRead.ts';
import { allowedMediaUrl, readMedia } from './src/server/media.ts';
import { listNames, readName } from './src/server/names.ts';
import { cancelSharedResearchJob, getSharedResearchJob, startSharedResearchJob } from './src/server/research/jobs.ts';
import { listCommunityPodcasts, publishCommunityPodcast } from './src/server/research/communityPodcasts.ts';
import { coordinateQuestion } from './src/shared/research/coordinator.ts';
import type { ResearchScope } from './src/shared/contracts/v1.ts';
import { dossierEvidence, quoteFromEvidence, researchTopic } from './src/server/research.ts';
import { attachVerification, verifyScript } from './src/shared/research.ts';
import type { EncyclopediaHadith } from './src/shared/hadeethenc.ts';
import {
  ask,
  generateJson,
  geminiConfigured,
  narrate,
  narrateDialogue,
  VOICES,
  writePodcast,
  type SourceFetchers,
} from './src/server/gemini.ts';
import { executeDragonDawwaAnalysis } from './src/engine/server/hadithEngine.ts';
import { getResearchJob, startResearchJob } from './src/engine/server/researchJobs.ts';
import { synthesizeRoundtableVoice } from './src/engine/server/geminiTtsService.ts';
import { extractHadithFromMedia } from './src/engine/server/hadithOcrService.ts';
import { transcribeAudioWithGemini } from './src/engine/server/geminiAudioTranscribe.ts';
import { ummahQuranMiddleware } from './src/engine/server/ummahQuran.ts';
import { ummahStudyMiddleware } from './src/engine/server/ummahStudy.ts';
import { publicAppUrl, viteDevServerOptions } from './src/server/publicUrl.ts';
import { EditorialStore, parseEditorAccounts } from './src/server/spiritual/editorialStore.ts';
import { spiritualRouter } from './src/server/spiritual/routes.ts';
import { studioRouter } from './src/server/studio/routes.ts';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

const fetchers: SourceFetchers = {
  verses: getVerses,
  hadith: (ref, lang) => getHadith(ref.collection, ref.number, lang),
  encyclopedia: async (phrase, lang, offset = 0) => {
    const found = await searchHadeeth(lang, phrase.slice(0, 120));
    const page = pageByRelevance(found.items, offset);
    const records = await Promise.all(page.map(item => loadHadeeth(lang, item.id).catch(() => null)));
    return encyclopediaEvidence(
      records.filter((item): item is EncyclopediaHadith => item !== null),
      offset,
    );
  },
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

function rateLimiter(limit: number, message = 'Too many AI requests. Please wait a few minutes and try again.') {
  const usage = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const recent = (usage.get(key) ?? []).filter(t => now - t < AI_WINDOW_MS);
    if (recent.length >= limit) {
      res.status(429).json({ error: message });
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

function releaseInfo(): { sha: string; builtAt: string } {
  try {
    const parsed = JSON.parse(readFileSync(path.join(process.cwd(), 'build-info.json'), 'utf8')) as {
      sha?: unknown;
      builtAt?: unknown;
    };
    if (
      typeof parsed.sha === 'string' &&
      /^[0-9a-f]{7,40}$|^unknown$|^dev$/.test(parsed.sha) &&
      typeof parsed.builtAt === 'string' &&
      parsed.builtAt.length <= 40
    ) {
      return { sha: parsed.sha, builtAt: parsed.builtAt };
    }
  } catch {
    // A dev start before the production build has no stamp file.
  }
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA ?? '';
  return { sha: /^[0-9a-f]{7,40}$/i.test(sha) ? sha.toLowerCase() : 'unknown', builtAt: 'unknown' };
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'DRAGON DAWWA', ai: geminiConfigured(), release: releaseInfo() });
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

function editionKeyFrom(value: unknown): string | undefined {
  const requested = readEditionQuery(value);
  if ('error' in requested) throw new UpstreamError(requested.error, 400);
  return requested.key;
}

app.get('/api/quran/surahs', route(async (_req, res) => res.json(await listSurahs())));
app.get('/api/quran/editions', route(async (req, res) => res.json(await listQuranEncEditions(toLang(req.query.lang)))));
app.get(
  '/api/quran/audio-manifest',
  route(async (req, res) => {
    const manifest = await loadAudioManifest(audioManifestEdition(req.query.edition));
    if (!manifest) throw new UpstreamError(MEANING_AUDIO_NOT_LISTED, 404);
    res.json({ translation: manifest.translation, count: manifest.count, files: [...manifest.files] });
  }),
);
app.get('/api/asma', route(async (_req, res) => res.json(await getAsma())));

app.get(
  '/api/quran/surah/:n/arabic',
  route(async (req, res) => res.json(await getSurahArabic(Number(req.params.n), quranPronunciationEdition(req.query.pronunciation)))),
);

app.get(
  '/api/quran/surah/:n/meaning',
  route(async (req, res) => res.json(await getSurahMeaning(Number(req.params.n), toLang(req.query.lang), editionKeyFrom(req.query.edition)))),
);

app.get(
  '/api/quran/tafsir',
  route(async (req, res) => {
    const surah = Number(req.query.surah);
    res.json(await loadMukhtasar(toLang(req.query.lang), surah));
  }),
);

app.get(
  '/api/quran/surah/:n',
  route(async (req, res) =>
    res.json(
      await getSurah(
        Number(req.params.n),
        toLang(req.query.lang),
        quranPronunciationEdition(req.query.pronunciation),
        editionKeyFrom(req.query.edition),
      ),
    ),
  ),
);

app.get(
  '/api/quran/verses',
  route(async (req, res) => {
    const refs = dedupeRefs(String(req.query.refs ?? '').split(',').flatMap(parseRefs), refKey, 60);
    res.json(
      await getVerses(refs, toLang(req.query.lang), quranPronunciationEdition(req.query.pronunciation), editionKeyFrom(req.query.edition)),
    );
  }),
);

app.get(
  '/api/hadith/:collection/sections',
  route(async (req, res) => res.json(await listSections(String(req.params.collection), toLang(req.query.lang)))),
);

app.get(
  '/api/hadith/:collection/section/:n',
  route(async (req, res) => {
    const raw = Number(req.query.limit);
    const limit = Number.isInteger(raw) && raw > 0 ? raw : undefined;
    res.json(await getSection(String(req.params.collection), Number(req.params.n), toLang(req.query.lang), limit));
  }),
);

app.get(
  '/api/hadith/:collection/:number',
  route(async (req, res) => {
    const hadith = await getHadith(String(req.params.collection), Number(req.params.number), toLang(req.query.lang));
    if (!hadith) throw new UpstreamError('Hadith not found', 404);
    res.json(hadith);
  }),
);

function pageNumber(value: unknown): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : 1;
}

app.get(
  '/api/hadeeth/categories',
  route(async (req, res) =>
    res.json(await loadHadeethCategories(toLang(req.query.lang), typeof req.query.parent === 'string' ? req.query.parent : undefined)),
  ),
);

app.get(
  '/api/hadeeth/list',
  route(async (req, res) => res.json(await loadHadeethList(toLang(req.query.lang), String(req.query.category ?? ''), pageNumber(req.query.page)))),
);

app.get(
  '/api/hadeeth/search',
  route(async (req, res) => {
    const phrase = text(req.query.q, 120, 'q');
    if (phrase.length < 2) throw new UpstreamError('q must be at least 2 characters', 400);
    res.json(await searchHadeeth(toLang(req.query.lang), phrase));
  }),
);

app.get('/api/hadeeth/:id', route(async (req, res) => res.json(await loadHadeeth(toLang(req.query.lang), String(req.params.id)))));

app.get(
  '/api/library/items',
  route(async (req, res) =>
    res.json(
      await loadLibrary(
        String(req.query.topic ?? ''),
        toLang(req.query.lang),
        pageNumber(req.query.page),
        typeof req.query.category === 'string' ? req.query.category : undefined,
      ),
    ),
  ),
);

app.get(
  '/api/library/read/:id',
  route(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new UpstreamError('Unknown item', 404);
    const document = await readLibraryItem(id, toLang(req.query.lang));
    if (req.query.pages !== '1') {
      res.json(document);
      return;
    }
    const pages = await readingPages(document);
    res.json({ ...document, pages });
  }),
);

function bookShelfQuery(req: Request) {
  const category = Number(req.query.category);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
  if (q && q.length < 3) throw new UpstreamError('Search needs at least 3 characters', 400);
  return {
    lang: toLang(req.query.lang),
    page: pageNumber(req.query.page),
    categoryId: Number.isInteger(category) && category > 0 ? category : null,
    q,
    essential: req.query.shelf === 'essential',
    format: req.query.format === 'pdf' ? 'pdf' as const : 'any' as const,
    sort: req.query.sort === 'title' ? 'title' as const : 'newest' as const,
  };
}

app.get('/api/library/books/meta', route(async (req, res) => res.json(await loadBookMeta(toLang(req.query.lang)))));
app.get('/api/library/books/stats', route(async (req, res) => res.json(await loadBookStats(toLang(req.query.lang)))));

app.get(
  '/api/library/books/:id',
  route(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new UpstreamError('Unknown book', 404);
    res.json(await loadBookDetail(id, toLang(req.query.lang)));
  }),
);

app.get('/api/library/books', route(async (req, res) => res.json(await loadBookShelf(bookShelfQuery(req)))));

app.get('/api/library/media', async (req, res, next) => {
  try {
    const url = allowedMediaUrl(typeof req.query.url === 'string' ? req.query.url : '');
    if (!url) throw new UpstreamError('That file address is not an IslamHouse media file.', 400);
    const file = await readMedia(url);
    res.setHeader('Content-Type', file.type.split(';')[0] || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(file.body);
  } catch (err) {
    next(err instanceof UpstreamError ? err : new UpstreamError(err instanceof Error ? err.message : 'The file could not be read.', 502));
  }
});

app.get('/api/names', route(async (_req, res) => res.json(await listNames())));
app.get('/api/names/:id', route(async (req, res) => res.json(await readName(String(req.params.id)))));

app.post(
  '/api/research/jobs',
  rateLimiter(20, 'Too many research jobs. Please wait a few minutes.'),
  route(async (req, res) => {
    const question = text(req.body?.question, 800, 'question');
    const lang = toLang(req.body?.lang);
    const entryRaw = typeof req.body?.entry === 'string' ? req.body.entry : '';
    if (!entryRaw) {
      const id = startSharedResearchJob(question, lang);
      res.status(202).json({ id, contractVersion: '1.0.0' });
      return;
    }
    const entries: ResearchScope[] = ['knowledge', 'quran', 'hadith', 'books'];
    if (!entries.includes(entryRaw as ResearchScope)) throw new UpstreamError('Unknown research entry', 400);
    const bookId = Number(req.body?.bookId);
    const decision = coordinateQuestion({
      question,
      entry: entryRaw as ResearchScope,
      language: lang,
      bookId: Number.isInteger(bookId) && bookId > 0 ? bookId : null,
      forwarded: req.body?.forwarded === true,
      clarified: req.body?.clarified === true,
      priorQuestion: typeof req.body?.priorQuestion === 'string' ? req.body.priorQuestion.slice(0, 800) : null,
    });
    if (decision.action === 'clarify') {
      res.json({ action: 'clarify', clarificationId: decision.clarificationId, contractVersion: '1.0.0' });
      return;
    }
    const researched = decision.assignment.forwardedFrom ? `${question}` : question;
    const id = startSharedResearchJob(researched, lang, undefined, {
      assignment: decision.assignment,
      force: req.body?.force === true,
    });
    res.status(202).json({
      action: decision.action,
      id,
      scope: decision.assignment.scope,
      noticeId: decision.assignment.noticeId,
      contractVersion: '1.0.0',
    });
  }),
);

app.get('/api/research/podcasts', route(async (_req, res) => res.json({ episodes: listCommunityPodcasts() })));

app.post(
  '/api/research/podcasts',
  route(async (req, res) => {
    if (req.body?.shared !== true) throw new UpstreamError('A podcast is published only when it is explicitly shared.', 400);
    const question = text(req.body?.question, 800, 'question');
    const lines = Array.isArray(req.body?.lines) ? req.body.lines.slice(0, 24) : [];
    const participants = Array.isArray(req.body?.participants) ? req.body.participants.slice(0, 12) : [];
    const reportHtml = typeof req.body?.reportHtml === 'string' ? req.body.reportHtml.slice(0, 400_000) : '';
    if (!lines.length || !reportHtml) throw new UpstreamError('A shared episode needs its script and full report.', 400);
    const episode = publishCommunityPodcast({
      id: text(req.body?.id, 80, 'id'),
      question,
      language: toLang(req.body?.language ?? req.body?.lang),
      participants: participants.map((item: { id?: string; role?: string; team?: string }) => ({
        id: String(item?.id ?? '').slice(0, 80),
        role: String(item?.role ?? '').slice(0, 120),
        team: String(item?.team ?? '').slice(0, 40),
      })),
      lines: lines.map((line: { speaker?: string; role?: string; text?: string }) => ({
        speaker: String(line?.speaker ?? '').slice(0, 120),
        role: String(line?.role ?? '').slice(0, 120),
        text: String(line?.text ?? '').slice(0, 4000),
      })),
      reportHtml,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(episode);
  }),
);

app.get(
  '/api/research/jobs/:id',
  route(async (req, res) => {
    const job = getSharedResearchJob(String(req.params.id));
    if (!job) throw new UpstreamError('Unknown research job', 404);
    res.json(job);
  }),
);

app.post(
  '/api/research/jobs/:id/cancel',
  route(async (req, res) => {
    const job = cancelSharedResearchJob(String(req.params.id));
    if (!job) throw new UpstreamError('Unknown research job', 404);
    res.json(job);
  }),
);

app.get(
  '/api/knowledge/:path',
  route(async (req, res) =>
    res.json(
      await loadKnowledgeShelf(
        String(req.params.path),
        toLang(req.query.lang),
        pageNumber(req.query.page),
        typeof req.query.category === 'string' ? req.query.category : undefined,
      ),
    ),
  ),
);

app.get('/api/studio/pilot', route(async (req, res) => res.json(await loadPilotEpisode(toLang(req.query.lang)))));

app.post(
  '/api/studio/pilot/ask',
  aiLimiter,
  route(async (req, res) => {
    const question = text(req.body?.question, 500, 'question');
    const chapter = typeof req.body?.chapterId === 'string' ? req.body.chapterId : '';
    res.json(await askPilot(question, toLang(req.body?.lang), chapter));
  }),
);

app.get(
  '/api/library/item',
  route(async (req, res) => res.json(await loadLibraryItem(String(req.query.id ?? ''), toLang(req.query.lang), String(req.query.topic ?? '')))),
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
    const explicit =
      refs.length || hadithRefs.length
        ? [
            ...verseEvidence(await getVerses(refs, lang)),
            ...hadithEvidence(
              (await Promise.all(hadithRefs.map(h => getHadith(h.collection, h.number, lang).catch(() => null)))).filter(
                h => h !== null,
              ),
            ),
          ]
        : [];
    const dossier = explicit.length ? null : await researchTopic({ topic, questions: [topic], lang });
    const evidence = explicit.length ? explicit : dossierEvidence(dossier!);
    if (!evidence.length) {
      throw new UpstreamError(dossier?.unanswered[0] ?? 'No sources could be retrieved for this topic.', 422);
    }
    const script = geminiConfigured() ? await writePodcast(topic, lang, minutes, evidence) : quoteFromEvidence(topic, lang, evidence);
    res.json(attachVerification(script, verifyScript(script.lines, evidence), dossier?.unanswered ?? []));
  }),
);

app.post(
  '/api/voice/narrate',
  aiLimiter,
  route(async (req, res) => {
    const body = text(req.body?.text, 3000, 'text');
    const style = typeof req.body?.style === 'string' ? req.body.style : '';
    res.json(await narrate(body, req.body?.voice, style, toLang(req.body?.lang)));
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
    const id = startResearchJob(
      () => executeDragonDawwaAnalysis(hadith, isnad, toLang(req.body?.preferred_language)),
      err => engineFailure(err, 'The hadith research engine could not complete this request. Please retry.').message,
    );
    res.status(202).json({ id, status: 'running' });
  }),
);

app.get(
  '/api/analyze/:id',
  route(async (req, res) => {
    const job = getResearchJob(String(req.params.id));
    if (!job) throw new UpstreamError('Research job not found. Please run it again.', 404);
    res.set('Cache-Control', 'no-store');
    if (job.status === 'done') return res.json({ id: job.id, status: 'done', analysis: job.result });
    if (job.status === 'error') return res.json({ id: job.id, status: 'error', error: job.error });
    res.json({ id: job.id, status: 'running' });
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

const dataDir = path.resolve(process.env.KF_DATA_DIR || path.join(import.meta.dirname, '.data'));
const editorAccounts = parseEditorAccounts(process.env.EDITORIAL_USERS);
app.use(
  spiritualRouter({
    store: new EditorialStore(path.join(dataDir, 'editorial.json')),
    accounts: editorAccounts,
    fetchers,
    model: generateJson,
    aiConfigured: geminiConfigured,
    aiLimiter,
    reportLimiter: rateLimiter(Number(process.env.REPORTS_PER_15_MIN ?? 10), 'Too many reports. Please wait a few minutes and try again.'),
  }),
);
app.use(
  studioRouter({
    accounts: editorAccounts,
    aiLimiter,
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

const httpServer = http.createServer(app);

if (isProduction) {
  const dist = path.resolve(import.meta.dirname, 'dist');
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, ...viteDevServerOptions(PORT, httpServer) },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

httpServer.listen(PORT, HOST, () => {
  console.log(
    `DRAGON DAWWA running on ${publicAppUrl(PORT)} (${isProduction ? 'production' : 'development'}); Gemini neural TTS ${geminiConfigured() ? 'on' : 'off'}`,
  );
});

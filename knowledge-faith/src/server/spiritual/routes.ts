import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { toLang } from '../../shared/sources.ts';
import { EditorialError, TRANSITIONS, type Action, type EditorUser } from '../../shared/spiritual/governance.ts';
import { TUNABLE, type Tune } from '../../shared/spiritual/prayerSettings.ts';
import type { JsonModel, SourceFetchers } from '../gemini.ts';
import { UpstreamError } from '../http.ts';
import { getPrayerCalendar } from '../prayer.ts';
import { parseExplainInput, studyAnswer, studyEvidence, studyScope, zakahAssist, zakahExplain } from './assistant.ts';
import { authenticate, type EditorAccount, type EditorialStore } from './editorialStore.ts';
import { resolveSources } from './sources.ts';

export interface SpiritualDeps {
  store: EditorialStore;
  accounts: EditorAccount[];
  fetchers: SourceFetchers;
  model: JsonModel;
  aiConfigured: () => boolean;
  aiLimiter: RequestHandler;
  reportLimiter: RequestHandler;
}

type Handler = (req: Request, res: Response) => unknown;
const route = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);

function text(value: unknown, max: number, field: string): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new UpstreamError(`${field} is required`, 400);
  if (s.length > max) throw new UpstreamError(`${field} must be at most ${max} characters`, 400);
  return s;
}

function parseTune(raw: unknown): Tune {
  const tune: Tune = {};
  if (typeof raw !== 'string' || !raw) return tune;
  for (const part of raw.split(',').slice(0, TUNABLE.length)) {
    const [key, value] = part.split(':');
    if ((TUNABLE as readonly string[]).includes(key)) tune[key as keyof Tune] = Number(value);
  }
  return tune;
}

const revNumber = (req: Request) => {
  const n = Number(req.params.rev);
  if (!Number.isInteger(n) || n < 1) throw new EditorialError('Invalid revision', 400);
  return n;
};

export function spiritualRouter(deps: SpiritualDeps): express.Router {
  const { store, accounts, fetchers } = deps;
  const router = express.Router();

  const requireAi = () => {
    if (!deps.aiConfigured()) throw new UpstreamError('The study assistant is not configured on this server.', 503);
  };

  router.get('/api/spiritual/status', (_req, res) => {
    res.json({ ai: deps.aiConfigured(), editorial: accounts.length > 0 });
  });

  router.get('/api/spiritual/guides', (_req, res) => res.json(store.publicIndex()));

  router.get(
    '/api/spiritual/guides/:slug',
    route((req, res) => res.json(store.publicGuide(String(req.params.slug), toLang(req.query.lang)))),
  );

  router.get(
    '/api/spiritual/sources',
    route(async (req, res) => {
      const ids = String(req.query.ids ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      res.json(await resolveSources(ids, toLang(req.query.lang), fetchers));
    }),
  );

  router.get(
    '/api/spiritual/prayer/calendar',
    route(async (req, res) => {
      const num = (v: unknown) => (v === undefined || v === '' ? NaN : Number(v));
      res.json(
        await getPrayerCalendar(num(req.query.lat), num(req.query.lng), num(req.query.year), num(req.query.month), {
          method: num(req.query.method),
          school: num(req.query.school),
          highLatitude: req.query.highLatitude === undefined ? undefined : num(req.query.highLatitude),
          tune: parseTune(req.query.tune),
          timezone: typeof req.query.timezone === 'string' && req.query.timezone ? req.query.timezone : undefined,
        }),
      );
    }),
  );

  router.post(
    '/api/spiritual/reports',
    deps.reportLimiter,
    route((req, res) => {
      const report = store.addReport(req.body ?? {});
      res.status(201).json({ id: report.id, status: report.status });
    }),
  );

  router.post(
    '/api/spiritual/study',
    deps.aiLimiter,
    route(async (req, res) => {
      const question = text(req.body?.question, 600, 'question');
      const lang = toLang(req.body?.lang);
      const scope = studyScope(
        typeof req.body?.topic === 'string' ? req.body.topic : undefined,
        typeof req.body?.guide === 'string' ? req.body.guide : undefined,
      );
      requireAi();
      const sources = await resolveSources(scope.sourceIds, lang, fetchers);
      const evidence = studyEvidence(sources, store.publishedSections(scope.slugs, lang));
      res.json(await studyAnswer(question, lang, evidence, deps.model));
    }),
  );

  router.post(
    '/api/spiritual/zakah/assist',
    deps.aiLimiter,
    route(async (req, res) => {
      const body = text(req.body?.text, 1500, 'text');
      requireAi();
      res.json(await zakahAssist(body, toLang(req.body?.lang), deps.model));
    }),
  );

  router.post(
    '/api/spiritual/zakah/explain',
    deps.aiLimiter,
    route(async (req, res) => {
      const input = parseExplainInput((req.body ?? {}) as Record<string, unknown>, toLang(req.body?.lang));
      requireAi();
      res.json(await zakahExplain(input, deps.model));
    }),
  );

  /* ---------- Editorial: every route below requires a configured account and a valid token ---------- */

  const editor = express.Router();
  editor.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!accounts.length) return next(new EditorialError('Editorial accounts are not configured on this server.', 503));
    const user = authenticate(accounts, req.headers.authorization);
    if (!user) return next(new EditorialError('Sign in with an editorial access token.', 401));
    res.locals.user = user;
    next();
  });
  const me = (res: Response) => res.locals.user as EditorUser;

  editor.get('/me', (_req, res) => res.json(me(res)));
  editor.get('/guides', (_req, res) => res.json(store.list(me(res))));
  editor.get(
    '/guides/:slug',
    route((req, res) => res.json(store.get(String(req.params.slug), me(res)))),
  );
  editor.post(
    '/guides/:slug/revisions',
    route((req, res) => res.status(201).json(store.createRevision(String(req.params.slug), me(res)))),
  );
  editor.patch(
    '/guides/:slug/revisions/:rev',
    route((req, res) => res.json(store.edit(String(req.params.slug), revNumber(req), me(res), req.body ?? {}))),
  );
  editor.post(
    '/guides/:slug/revisions/:rev/reviews',
    route((req, res) => res.status(201).json(store.review(String(req.params.slug), revNumber(req), me(res), req.body ?? {}))),
  );
  editor.post(
    '/guides/:slug/revisions/:rev/transitions',
    route((req, res) => {
      const action = String(req.body?.action ?? '') as Action;
      if (!Object.hasOwn(TRANSITIONS, action)) throw new EditorialError('Unknown action', 400);
      res.json(store.transition(String(req.params.slug), revNumber(req), action, me(res)));
    }),
  );
  editor.get('/reports', (_req, res) => res.json(store.reports(me(res))));
  editor.post(
    '/reports/:id/resolve',
    route((req, res) => res.json(store.resolveReport(String(req.params.id), me(res)))),
  );
  router.use('/api/editorial', editor);

  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof EditorialError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  });

  return router;
}

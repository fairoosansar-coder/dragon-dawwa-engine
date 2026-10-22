import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { toLang } from '../../shared/sources.ts';
import { EditorialError, type EditorUser } from '../../shared/spiritual/governance.ts';
import type { StudioSegment } from '../../shared/studio/contracts.ts';
import type { StudioTransitionAction } from '../../shared/studio/verification.ts';
import { UpstreamError } from '../http.ts';
import { authenticate, type EditorAccount } from '../spiritual/editorialStore.ts';
import {
  answerStudioQuestion,
  editStudioProductionScript,
  getStudioCatalogueSummary,
  getStudioVoiceStatus,
  listStudioProductions,
  loadStudioEpisode,
  runStudioProductionPipeline,
  transitionStudioProduction,
} from './service.ts';

export interface StudioRouterDeps {
  accounts: EditorAccount[];
  aiLimiter: RequestHandler;
}

type Handler = (req: Request, res: Response) => unknown;
const route = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);

function text(value: unknown, max: number, field: string): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new UpstreamError(`${field} is required`, 400);
  if (s.length > max) throw new UpstreamError(`${field} must be at most ${max} characters`, 400);
  return s;
}

export function studioRouter(deps: StudioRouterDeps): express.Router {
  const router = express.Router();

  router.get('/api/studio/voice-status', (_req, res) => {
    res.json(getStudioVoiceStatus());
  });

  router.get('/api/studio/catalogue', (req, res) => {
    res.json(getStudioCatalogueSummary(toLang(req.query.lang)));
  });

  router.get(
    '/api/studio/episodes/:id',
    route(async (req, res) => {
      const id = String(req.params.id || 'tonight-mercy-ar-rahman');
      const lang = toLang(req.query.lang);
      res.json(await loadStudioEpisode(id, lang));
    }),
  );

  router.post(
    '/api/studio/ask',
    deps.aiLimiter,
    route(async (req, res) => {
      const question = text(req.body?.question, 500, 'question');
      const episodeId = typeof req.body?.episodeId === 'string' ? req.body.episodeId : 'tonight-mercy-ar-rahman';
      const segmentId = typeof req.body?.segmentId === 'string' ? req.body.segmentId : 'seg-1';
      const lang = toLang(req.body?.lang);
      const targetLang = req.body?.targetLang ? toLang(req.body.targetLang) : undefined;
      res.json(
        await answerStudioQuestion({
          episodeId,
          segmentId,
          question,
          lang,
          targetLang,
        }),
      );
    }),
  );

  router.post(
    '/api/studio/pipeline/run',
    deps.aiLimiter,
    route(async (req, res) => {
      const topic = text(req.body?.topic, 300, 'topic');
      const result = await runStudioProductionPipeline({
        ...req.body,
        topic,
        lang: toLang(req.body?.lang),
      });
      res.status(201).json(result);
    }),
  );

  router.get('/api/studio/productions', (_req, res) => {
    res.json({ productions: listStudioProductions() });
  });

  router.patch(
    '/api/studio/productions/:id/script',
    route((req, res) => {
      const episodeId = String(req.params.id);
      const lang = toLang(req.body?.lang);
      const segments = Array.isArray(req.body?.segments) ? (req.body.segments as StudioSegment[]) : [];
      if (!segments.length) throw new UpstreamError('segments array is required', 400);
      const editorName = typeof req.body?.editorName === 'string' && req.body.editorName.trim() ? req.body.editorName.trim() : 'Studio Script Editor';
      const changeNote = typeof req.body?.changeNote === 'string' ? req.body.changeNote : 'Edited script segments';
      res.json(editStudioProductionScript(episodeId, lang, segments, editorName, changeNote));
    }),
  );

  router.post(
    '/api/studio/productions/:id/transition',
    route((req, res) => {
      const episodeId = String(req.params.id);
      const lang = toLang(req.body?.lang);
      const action = String(req.body?.action ?? '') as StudioTransitionAction;
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';

      // Reuse existing editorial roles and permissions for publication/approval transitions
      let user: EditorUser | null = authenticate(deps.accounts, req.headers.authorization);
      if (!user) {
        if (action === 'publish-episode' || action === 'withdraw-episode') {
          if (!deps.accounts.length) {
            throw new EditorialError(
              'Publication requires authorized editorial accounts (EDITORIAL_USERS is not configured on this server). Episode remains un-published.',
              503,
            );
          }
          throw new EditorialError('Sign in with an authorized publisher token to publish or withdraw episodes.', 401);
        }
        // For local studio review/draft transitions when no EDITORIAL_USERS is configured, allow studio desk reviewer role except publish
        if (deps.accounts.length > 0) {
          throw new EditorialError('Sign in with an editorial access token.', 401);
        }
        user = {
          id: 'studio-reviewer',
          name: 'Studio Editorial Desk',
          roles: ['author', 'source-checker', 'religious-reviewer', 'language-reviewer'],
        };
      }

      res.json(transitionStudioProduction(episodeId, lang, action, user, notes, req.body?.sourceItem));
    }),
  );

  router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof EditorialError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  });

  return router;
}

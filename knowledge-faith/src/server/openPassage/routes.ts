import { randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authenticateGoogleCredential, setSeekerCookie, verifyGoogleIdToken } from '../seekerAuth.ts';
import { UpstreamError } from '../http.ts';
import { openPassageGoogleClientId, openPassagePublicEnabled } from './feature.ts';
import {
  getOpenPassageGate,
  getOpenPassageJob,
  openPassageJobAudio,
  startOpenPassageJob,
} from './jobs.ts';

type Handler = (req: Request, res: Response) => unknown;
const route = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);

const issued: number[] = [];

function limitIssuance(): void {
  const now = Date.now();
  while (issued.length && now - issued[0] > 3_600_000) issued.shift();
  if (issued.length >= 240) {
    throw Object.assign(new Error('Sign-in is busy. Please try again later.'), { status: 429 });
  }
  issued.push(now);
}

function bearer(req: Request): string {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw Object.assign(new Error('access_pass_required'), { status: 401 });
  }
  return header.slice(7).trim();
}

function gateError(err: unknown, res: Response): boolean {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    const status = (err as { status: number; message?: string }).status;
    const message = (err as { message?: string }).message || 'Request failed';
    if (status === 403 && message === 'google_required') {
      res.status(403).json({ detail: 'google_required' });
      return true;
    }
    if (status === 401) {
      res.status(401).json({ detail: message });
      return true;
    }
    res.status(status).json({ detail: message });
    return true;
  }
  return false;
}

export function openPassageRouter(): express.Router {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!openPassagePublicEnabled()) {
      res.status(404).json({ detail: 'Open Passage public desk is disabled.' });
      return;
    }
    const length = Number(req.headers['content-length'] || 0);
    if (length > 8000) {
      res.status(413).end();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get(
    '/api/open-passage/google-config',
    route((_req, res) => {
      const clientId = openPassageGoogleClientId() || null;
      res.json({ clientId });
    }),
  );

  router.post(
    '/api/open-passage/access',
    route((_req, res) => {
      limitIssuance();
      res.json({ token: getOpenPassageGate().mint(false) });
    }),
  );

  router.post(
    '/api/open-passage/google',
    route(async (req, res) => {
      limitIssuance();
      const credential = typeof req.body?.credential === 'string' ? req.body.credential.trim() : '';
      if (credential.length < 20 || credential.length > 6200) {
        throw new UpstreamError('A Google credential is required.', 400);
      }
      const clientId = openPassageGoogleClientId();
      if (!clientId) {
        throw new UpstreamError('Google sign-in is not configured for this preview.', 503);
      }
      await verifyGoogleIdToken(credential, clientId);
      // Reuse the established seeker account/session so Saved works across devices.
      try {
        const auth = await authenticateGoogleCredential({ credential });
        setSeekerCookie(res, auth.token);
      } catch {
        /* Research pass still issues even if seeker session linking fails transiently. */
      }
      res.json({ token: getOpenPassageGate().mint(true) });
    }),
  );

  router.post(
    '/api/open-passage/jobs',
    route((req, res) => {
      try {
        const question = typeof req.body?.question === 'string' ? req.body.question : '';
        const token = bearer(req);
        const started = startOpenPassageJob(token, question);
        res.json(started);
      } catch (err) {
        if (gateError(err, res)) return;
        throw err;
      }
    }),
  );

  router.get(
    '/api/open-passage/jobs/:id',
    route((req, res) => {
      try {
        const job = getOpenPassageJob(String(req.params.id));
        res.json({
          state: job.state,
          sources: job.sources,
          result: job.result,
        });
      } catch (err) {
        if (gateError(err, res)) return;
        throw err;
      }
    }),
  );

  router.post(
    '/api/open-passage/jobs/:id/audio/:mode',
    route(async (req, res) => {
      try {
        const mode = String(req.params.mode);
        if (mode !== 'brief' && mode !== 'podcast') {
          res.status(404).json({ detail: 'Unknown audio mode.' });
          return;
        }
        const rendered = await openPassageJobAudio(String(req.params.id), mode);
        res.setHeader('Content-Type', rendered.mimeType);
        res.send(rendered.bytes);
      } catch (err) {
        if (gateError(err, res)) return;
        throw new UpstreamError(
          'Audio is unavailable. The research document and transcript remain usable.',
          503,
        );
      }
    }),
  );

  // Health / nonce helper for staging smoke without logging secrets.
  router.get(
    '/api/open-passage/health',
    route((_req, res) => {
      res.json({
        ok: true,
        public: openPassagePublicEnabled(),
        googleConfigured: Boolean(openPassageGoogleClientId()),
        nonce: randomBytes(8).toString('hex'),
      });
    }),
  );

  return router;
}

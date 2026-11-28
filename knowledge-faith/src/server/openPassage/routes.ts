import { randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { authenticateGoogleCredential, setSeekerCookie, verifyGoogleIdToken } from '../seekerAuth.ts';
import { UpstreamError } from '../http.ts';
import { openPassageGoogleClientId, openPassagePublicEnabled } from './feature.ts';
import { digestCaller } from './accessGate.ts';
import {
  getOpenPassageGate,
  getOpenPassageJob,
  openPassageJobAudio,
  startOpenPassageJob,
} from './jobs.ts';

type Handler = (req: Request, res: Response) => unknown;
const route = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);

/** Anonymous guest pass minting — separate from verified Google so spam cannot exhaust sign-in. */
const guestIssued: number[] = [];
/** Verified Google research-pass minting after credential check. */
const googleIssued: number[] = [];
/** Per-caller guest mint attempts (before shared budget). */
const guestByCaller = new Map<string, number[]>();
/** Per-caller Google verify attempts (before outbound tokeninfo). */
const googleVerifyByCaller = new Map<string, number[]>();
/** In-flight Google verifications per caller. */
const googleVerifyInflight = new Map<string, number>();

const CALLER_GUEST_MAX = 12;
const CALLER_GUEST_WINDOW_MS = 3_600_000;
const CALLER_GOOGLE_VERIFY_MAX = 30;
const CALLER_GOOGLE_VERIFY_WINDOW_MS = 15 * 60_000;
const CALLER_GOOGLE_VERIFY_CONCURRENCY = 2;

function limitWindow(bucket: number[], max: number, message: string): void {
  const now = Date.now();
  while (bucket.length && now - bucket[0] > 3_600_000) bucket.shift();
  if (bucket.length >= max) {
    throw new UpstreamError(message, 429);
  }
  bucket.push(now);
}

function callerKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim() || 'unknown';
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0]!.trim() || 'unknown';
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

const CALLER_STORE_MAX_KEYS = 10_000;

/** Drop expired timestamps; never wipe the whole map (that fail-opens every budget). */
function pruneCallerStore(store: Map<string, number[]>, windowMs: number, now = Date.now()): void {
  for (const [entryKey, times] of store) {
    const recent = times.filter(t => now - t < windowMs);
    if (recent.length) store.set(entryKey, recent);
    else store.delete(entryKey);
  }
}

function evictOldestCallerKeys(store: Map<string, number[]>, keep: number): void {
  if (store.size <= keep) return;
  const ranked = [...store.entries()].sort((a, b) => {
    const aLast = a[1][a[1].length - 1] ?? 0;
    const bLast = b[1][b[1].length - 1] ?? 0;
    return aLast - bLast;
  });
  const remove = store.size - keep;
  for (let i = 0; i < remove; i++) store.delete(ranked[i]![0]);
}

function limitCallerWindow(
  store: Map<string, number[]>,
  key: string,
  max: number,
  windowMs: number,
  message: string,
): void {
  const now = Date.now();
  pruneCallerStore(store, windowMs, now);
  const recent = (store.get(key) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= max) {
    throw new UpstreamError(message, 429);
  }
  recent.push(now);
  store.set(key, recent);
  if (store.size > CALLER_STORE_MAX_KEYS) {
    evictOldestCallerKeys(store, CALLER_STORE_MAX_KEYS);
  }
}

function limitGuestIssuance(): void {
  limitWindow(guestIssued, 240, 'The free desk is busy. Please try again later.');
}

function limitGuestIssuanceForCaller(req: Request): void {
  limitCallerWindow(
    guestByCaller,
    callerKey(req),
    CALLER_GUEST_MAX,
    CALLER_GUEST_WINDOW_MS,
    'The free desk is busy. Please try again later.',
  );
}

function limitGoogleIssuance(): void {
  limitWindow(googleIssued, 240, 'Sign-in is busy. Please try again later.');
}

function beginGoogleVerifyForCaller(req: Request): string {
  const key = callerKey(req);
  limitCallerWindow(
    googleVerifyByCaller,
    key,
    CALLER_GOOGLE_VERIFY_MAX,
    CALLER_GOOGLE_VERIFY_WINDOW_MS,
    'Sign-in is busy. Please try again later.',
  );
  const inflight = googleVerifyInflight.get(key) ?? 0;
  if (inflight >= CALLER_GOOGLE_VERIFY_CONCURRENCY) {
    throw new UpstreamError('Sign-in is busy. Please try again later.', 429);
  }
  googleVerifyInflight.set(key, inflight + 1);
  return key;
}

function endGoogleVerifyForCaller(key: string): void {
  const inflight = googleVerifyInflight.get(key) ?? 0;
  if (inflight <= 1) googleVerifyInflight.delete(key);
  else googleVerifyInflight.set(key, inflight - 1);
}

function bearer(req: Request): string {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw new UpstreamError('access_pass_required', 401);
  }
  return header.slice(7).trim();
}

function gateError(err: unknown, res: Response): boolean {
  if (err instanceof UpstreamError) {
    const message = err.message || 'Request failed';
    if (err.status === 403 && message === 'google_required') {
      res.status(403).json({ detail: 'google_required' });
      return true;
    }
    res.status(err.status).json({ detail: message });
    return true;
  }
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

/**
 * Routes are relative to the `/api/open-passage` mount in server.ts so kill-switch
 * and size-limit middleware cannot 404/413 the rest of the app (studio, editorial, etc.).
 */
export function openPassageRouter(): express.Router {
  const router = express.Router();

  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const isHealth = req.path === '/health' || req.path === '/health/';
    if (!openPassagePublicEnabled() && !isHealth) {
      res.status(404).json({ detail: 'Open Passage public desk is disabled.' });
      return;
    }
    const length = Number(req.headers['content-length'] || 0);
    if (length > 8000) {
      res.status(413).end();
      return;
    }
    next();
  });

  router.get(
    '/google-config',
    route((_req, res) => {
      const clientId = openPassageGoogleClientId() || null;
      res.json({ clientId });
    }),
  );

  router.post(
    '/access',
    route((req, res) => {
      // Caller budget first so one visitor cannot exhaust the shared hour window.
      limitGuestIssuanceForCaller(req);
      limitGuestIssuance();
      const caller = digestCaller(callerKey(req));
      res.json({ token: getOpenPassageGate().mint(false, caller) });
    }),
  );

  router.post(
    '/google',
    route(async (req, res) => {
      const credential = typeof req.body?.credential === 'string' ? req.body.credential.trim() : '';
      if (credential.length < 20 || credential.length > 6200) {
        throw new UpstreamError('A Google credential is required.', 400);
      }
      const clientId = openPassageGoogleClientId();
      if (!clientId) {
        throw new UpstreamError('Google sign-in is not configured for this preview.', 503);
      }
      // Rate-limit verify attempts/concurrency before outbound tokeninfo.
      const verifyKey = beginGoogleVerifyForCaller(req);
      try {
        // Verify first — unverified spam must not consume the Google issuance budget.
        await verifyGoogleIdToken(credential, clientId);
        limitGoogleIssuance();
        // Reuse the established seeker account/session so Saved works across devices.
        let seeker: { token: string; user: unknown } | undefined;
        try {
          const auth = await authenticateGoogleCredential({ credential });
          setSeekerCookie(res, auth.token);
          seeker = { token: auth.token, user: auth.user };
        } catch {
          /* Research pass still issues even if seeker session linking fails transiently. */
        }
        res.json({ token: getOpenPassageGate().mint(true, digestCaller(callerKey(req))), seeker });
      } finally {
        endGoogleVerifyForCaller(verifyKey);
      }
    }),
  );

  router.post(
    '/jobs',
    route((req, res) => {
      try {
        const question = typeof req.body?.question === 'string' ? req.body.question : '';
        const token = bearer(req);
        const started = startOpenPassageJob(token, question, digestCaller(callerKey(req)));
        res.json(started);
      } catch (err) {
        if (gateError(err, res)) return;
        throw err;
      }
    }),
  );

  router.get(
    '/jobs/:id',
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
    '/jobs/:id/audio/:mode',
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
    '/health',
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

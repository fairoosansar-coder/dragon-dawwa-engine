import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { UpstreamError } from './http.ts';
import { persistRoot } from './persist.ts';
import { toLang, type Lang } from '../shared/sources.ts';

export type SeekerEmblem = 'rub-el-hizb' | 'crescent-star' | 'octagon-rosette' | 'emerald-lamp';
export type SeekerAuthProvider = 'email' | 'google' | 'apple' | 'guest';
export type SeekerAuthMethod = 'google' | 'password' | 'studio';

export interface SeekerProfile {
  id: string;
  email: string;
  name: string;
  kunyah: string;
  bio: string;
  emblem: SeekerEmblem;
  provider: SeekerAuthProvider;
  authProvider: SeekerAuthMethod;
  googleSub?: string | null;
  avatarUrl?: string | null;
  verified: boolean;
  createdAt: string;
}

export type PublicSeekerProfile = SeekerProfile;

export interface GoogleAuthConfig {
  enabled: boolean;
  clientId: string | null;
  hasClientSecret: boolean;
  issuer: string;
  oauthRedirectPath: '/api/auth/google/start';
  callbackPath: '/api/auth/google/callback';
}

export interface VerifiedGoogleClaims {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string | null;
  iss?: string;
  aud?: string;
}

interface StoredAccount extends SeekerProfile {
  passwordHash: string;
  salt: string;
}

export interface StoredWallPost {
  id: string;
  userId?: string;
  surah: number;
  ayah: number;
  surahName: string;
  arabic: string;
  translation: string;
  reflection: string;
  authorName: string;
  authorRole: string;
  authorEmblem?: SeekerEmblem;
  authorAvatarUrl?: string | null;
  authorAuthProvider?: SeekerAuthMethod;
  verified?: boolean;
  likes: number;
  lang: Lang;
  url: string;
  createdAt: string;
  updatedAt?: string;
}

const COOKIE_NAME = 'dd_seeker_token';
const OAUTH_NONCE_COOKIE = 'dd_google_oauth_nonce';
const EMBLEMS: readonly SeekerEmblem[] = ['rub-el-hizb', 'crescent-star', 'octagon-rosette', 'emerald-lamp'];
const VALID_GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

const accountsByEmail = new Map<string, StoredAccount>();
const accountsById = new Map<string, StoredAccount>();
const accountsByGoogleSub = new Map<string, StoredAccount>();
const revokedTokens = new Set<string>();
const wallPosts: StoredWallPost[] = [];
let storeLoaded = false;

function secretKey(): string {
  return process.env.SEEKER_SESSION_SECRET || process.env.GEMINI_API_KEY || 'dragon-dawwa-seeker-session-secret-key-2026';
}

function storeFilePath(): string {
  return path.join(persistRoot(), 'faith-wall-auth.json');
}

export function sanitizeEmblem(value: unknown): SeekerEmblem {
  if (typeof value === 'string' && EMBLEMS.includes(value as SeekerEmblem)) {
    return value as SeekerEmblem;
  }
  return 'rub-el-hizb';
}

function sanitizeProvider(value: unknown): SeekerAuthProvider {
  if (value === 'google' || value === 'apple' || value === 'guest') return value;
  return 'email';
}

function sanitizeAuthMethod(value: unknown, provider: SeekerAuthProvider): SeekerAuthMethod {
  if (value === 'google' || value === 'password' || value === 'studio') return value;
  if (provider === 'google') return 'google';
  if (provider === 'email') return 'password';
  return 'studio';
}

export function sanitizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1024) return null;
  if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) return trimmed;
  return null;
}

export function getGoogleAuthConfig(): GoogleAuthConfig {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_OIDC_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
  const clientSecret = (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_OIDC_CLIENT_SECRET ||
    ''
  ).trim();
  const issuer = (process.env.GOOGLE_OIDC_ISSUER || 'https://accounts.google.com').trim();
  return {
    enabled: Boolean(clientId),
    clientId: clientId || null,
    hasClientSecret: Boolean(clientSecret),
    issuer,
    oauthRedirectPath: '/api/auth/google/start',
    callbackPath: '/api/auth/google/callback',
  };
}

function getGoogleClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OIDC_CLIENT_SECRET || '').trim();
}

function indexAccount(acc: StoredAccount) {
  accountsByEmail.set(acc.email.toLowerCase(), acc);
  accountsById.set(acc.id, acc);
  if (acc.googleSub) {
    accountsByGoogleSub.set(acc.googleSub, acc);
  }
}

function loadStore() {
  if (storeLoaded) return;
  storeLoaded = true;
  const file = storeFilePath();
  if (!fs.existsSync(file)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      accounts?: StoredAccount[];
      posts?: StoredWallPost[];
    };
    if (Array.isArray(raw.accounts)) {
      for (const acc of raw.accounts) {
        if (acc && typeof acc.id === 'string' && typeof acc.email === 'string') {
          const normalized: StoredAccount = {
            ...acc,
            provider: sanitizeProvider(acc.provider),
            authProvider: sanitizeAuthMethod(acc.authProvider, sanitizeProvider(acc.provider)),
            googleSub: typeof acc.googleSub === 'string' && acc.googleSub ? acc.googleSub : null,
            avatarUrl: sanitizeAvatarUrl(acc.avatarUrl),
          };
          indexAccount(normalized);
        }
      }
    }
    if (Array.isArray(raw.posts)) {
      wallPosts.splice(0, wallPosts.length, ...raw.posts.slice(0, 100));
    }
  } catch {
    /* ignore corrupted file */
  }
}

function saveStore() {
  try {
    const file = storeFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          accounts: [...accountsById.values()],
          posts: wallPosts.slice(0, 100),
        },
        null,
        2,
      ),
    );
  } catch {
    /* keep in memory if disk is read-only */
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function toPublicProfile(account: StoredAccount): SeekerProfile {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    kunyah: account.kunyah,
    bio: account.bio,
    emblem: account.emblem,
    provider: account.provider,
    authProvider: account.authProvider,
    googleSub: account.googleSub ?? null,
    avatarUrl: account.avatarUrl ?? null,
    verified: account.verified,
    createdAt: account.createdAt,
  };
}

export function issueSeekerToken(profile: SeekerProfile): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: profile.id,
      email: profile.email,
      name: profile.name,
      kunyah: profile.kunyah,
      bio: profile.bio,
      emblem: profile.emblem,
      provider: profile.provider,
      authProvider: profile.authProvider,
      googleSub: profile.googleSub ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      verified: profile.verified,
      createdAt: profile.createdAt,
      iat: Date.now(),
    }),
    'utf8',
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secretKey()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySeekerToken(token: string | null | undefined): SeekerProfile | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (!trimmed || revokedTokens.has(trimmed)) return null;
  const parts = trimmed.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secretKey()).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const id = typeof decoded.sub === 'string' ? decoded.sub : '';
    const email = typeof decoded.email === 'string' ? decoded.email : '';
    if (!id || !email) return null;
    loadStore();
    const stored = accountsById.get(id);
    if (stored) return toPublicProfile(stored);
    const provider = sanitizeProvider(decoded.provider);
    return {
      id,
      email,
      name: typeof decoded.name === 'string' && decoded.name ? decoded.name : 'Community Seeker',
      kunyah: typeof decoded.kunyah === 'string' && decoded.kunyah ? decoded.kunyah : 'Seeker of Knowledge',
      bio: typeof decoded.bio === 'string' ? decoded.bio : '',
      emblem: sanitizeEmblem(decoded.emblem),
      provider,
      authProvider: sanitizeAuthMethod(decoded.authProvider, provider),
      googleSub: typeof decoded.googleSub === 'string' && decoded.googleSub ? decoded.googleSub : null,
      avatarUrl: sanitizeAvatarUrl(decoded.avatarUrl),
      verified: decoded.verified !== false,
      createdAt: typeof decoded.createdAt === 'string' ? decoded.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader !== 'string') return null;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name && rest.length) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return rest.join('=');
      }
    }
  }
  return null;
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (match?.[1]) return match[1].trim();
  }
  return readCookie(req, COOKIE_NAME);
}

export function getRequestSeeker(req: Request): SeekerProfile | null {
  return verifySeekerToken(extractTokenFromRequest(req));
}

export function setSeekerCookie(res: Response, token: string) {
  res.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`,
  );
}

export function clearSeekerCookie(res: Response) {
  res.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`);
}

export function sanitizeReturnToHash(raw: unknown): string {
  if (typeof raw !== 'string') return '#/quran/wall';
  const trimmed = raw.trim();
  if (!trimmed) return '#/quran/wall';
  if (trimmed.startsWith('#/')) return trimmed.slice(0, 240);
  if (trimmed.startsWith('/#/')) return trimmed.slice(1, 241);
  if (trimmed.startsWith('/')) return `#${trimmed.slice(0, 240)}`;
  return '#/quran/wall';
}

export function resolveRequestOrigin(req: Request): string {
  const explicitOrigin = (process.env.PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  if (explicitOrigin && /^https?:\/\//i.test(explicitOrigin)) {
    return explicitOrigin;
  }
  const forwardedHost = typeof req.headers['x-forwarded-host'] === 'string'
    ? req.headers['x-forwarded-host'].split(',')[0].trim()
    : '';
  const host = forwardedHost || req.get('host') || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:3000';
  const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto'].split(',')[0].trim()
    : '';
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const proto = forwardedProto || (isLocal ? (req.protocol || 'http') : 'https');
  return `${proto}://${host}`;
}

export function createGoogleOAuthState(input: {
  nonce: string;
  returnTo: string;
  redirectUri: string;
  iat?: number;
}): string {
  const payload = Buffer.from(
    JSON.stringify({
      nonce: input.nonce,
      returnTo: sanitizeReturnToHash(input.returnTo),
      redirectUri: input.redirectUri,
      iat: input.iat ?? Date.now(),
    }),
    'utf8',
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secretKey()).update(`oauth:${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyGoogleOAuthState(
  stateToken: string | null | undefined,
  cookieNonce?: string | null,
): { nonce: string; returnTo: string; redirectUri: string } | null {
  if (!stateToken || typeof stateToken !== 'string') return null;
  const parts = stateToken.trim().split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secretKey()).update(`oauth:${payload}`).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      nonce?: unknown;
      returnTo?: unknown;
      redirectUri?: unknown;
      iat?: unknown;
    };
    const nonce = typeof decoded.nonce === 'string' ? decoded.nonce : '';
    const redirectUri = typeof decoded.redirectUri === 'string' ? decoded.redirectUri : '';
    const iat = typeof decoded.iat === 'number' ? decoded.iat : 0;
    if (!nonce || !redirectUri) return null;
    if (Date.now() - iat > 15 * 60 * 1000) return null;
    if (cookieNonce && cookieNonce !== nonce) return null;
    return {
      nonce,
      returnTo: sanitizeReturnToHash(decoded.returnTo),
      redirectUri,
    };
  } catch {
    return null;
  }
}

export function buildGoogleOAuthStart(
  req: Request,
  returnToRaw?: unknown,
): { url: string; nonce: string; state: string; redirectUri: string } {
  const cfg = getGoogleAuthConfig();
  if (!cfg.enabled || !cfg.clientId) {
    throw new UpstreamError('Google Sign-In is not configured on this server (GOOGLE_OIDC_CLIENT_ID missing).', 503);
  }
  const origin = resolveRequestOrigin(req);
  const redirectUri = `${origin}${cfg.callbackPath}`;
  const nonce = crypto.randomBytes(16).toString('hex');
  const returnTo = sanitizeReturnToHash(returnToRaw);
  const state = createGoogleOAuthState({ nonce, returnTo, redirectUri });

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'online',
    state,
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    nonce,
    state,
    redirectUri,
  };
}

export function setGoogleOAuthNonceCookie(res: Response, nonce: string) {
  res.append(
    'Set-Cookie',
    `${OAUTH_NONCE_COOKIE}=${encodeURIComponent(nonce)}; Path=/; Max-Age=900; HttpOnly; SameSite=Lax`,
  );
}

export function clearGoogleOAuthNonceCookie(res: Response) {
  res.append('Set-Cookie', `${OAUTH_NONCE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

export function readGoogleOAuthNonceCookie(req: Request): string | null {
  return readCookie(req, OAUTH_NONCE_COOKIE);
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.trim().split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId?: string | null,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<VerifiedGoogleClaims> {
  if (!idToken || typeof idToken !== 'string') {
    throw new UpstreamError('A Google ID token is required.', 400);
  }
  const cfg = getGoogleAuthConfig();
  const targetClientId = (expectedClientId ?? cfg.clientId ?? '').trim();

  const res = await fetchImpl(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken.trim())}`,
  );
  if (!res.ok) {
    throw new UpstreamError('Google ID token could not be verified.', 401);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const aud = typeof data.aud === 'string' ? data.aud.trim() : '';
  const iss = typeof data.iss === 'string' ? data.iss.trim() : '';
  const sub = typeof data.sub === 'string' ? data.sub.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const emailVerified = data.email_verified === true || data.email_verified === 'true';
  const exp = Number(data.exp ?? 0);

  if (targetClientId && aud !== targetClientId) {
    throw new UpstreamError('Google ID token audience does not match this application.', 401);
  }
  if (iss && !VALID_GOOGLE_ISSUERS.has(iss) && iss !== cfg.issuer) {
    throw new UpstreamError('Google ID token issuer is invalid.', 401);
  }
  if (exp > 0 && exp * 1000 < Date.now() - 30_000) {
    throw new UpstreamError('Google ID token has expired.', 401);
  }
  if (!sub || !email) {
    throw new UpstreamError('Google ID token did not include subject and email.', 401);
  }

  return {
    sub,
    email,
    emailVerified,
    name: typeof data.name === 'string' ? data.name.trim() : undefined,
    picture: sanitizeAvatarUrl(data.picture),
    iss,
    aud,
  };
}

export function upsertGoogleSeekerAccount(claims: VerifiedGoogleClaims): {
  token: string;
  user: SeekerProfile;
} {
  loadStore();
  const email = claims.email.trim().toLowerCase();
  if (!claims.sub || !email) {
    throw new UpstreamError('Google account profile is missing required identity claims.', 400);
  }

  const bySub = accountsByGoogleSub.get(claims.sub);
  const byEmail = claims.emailVerified !== false ? accountsByEmail.get(email) : undefined;
  const existing = bySub ?? byEmail;

  const defaultName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const name = existing?.name || (claims.name ?? '').trim().slice(0, 80) || defaultName || 'Google Seeker';
  const kunyah = existing?.kunyah || 'Verified Google Seeker';
  const bio = existing?.bio || '';
  const emblem = sanitizeEmblem(existing?.emblem);
  const avatarUrl = sanitizeAvatarUrl(claims.picture) ?? existing?.avatarUrl ?? null;
  const salt = existing?.salt ?? crypto.randomBytes(16).toString('hex');
  const passwordHash = existing?.passwordHash ?? hashPassword(crypto.randomUUID(), salt);

  const account: StoredAccount = {
    id: existing?.id ?? `seeker-google-${claims.sub.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || crypto.randomBytes(4).toString('hex')}`,
    email,
    name,
    kunyah,
    bio,
    emblem,
    provider: 'google',
    authProvider: 'google',
    googleSub: claims.sub,
    avatarUrl,
    verified: true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    salt,
    passwordHash,
  };

  indexAccount(account);

  for (const post of wallPosts) {
    if (post.userId === account.id) {
      post.authorName = account.name;
      post.authorRole = account.kunyah;
      post.authorEmblem = account.emblem;
      post.authorAvatarUrl = account.avatarUrl;
      post.authorAuthProvider = 'google';
      post.verified = true;
    }
  }
  saveStore();

  const user = toPublicProfile(account);
  const token = issueSeekerToken(user);
  return { token, user };
}

export async function authenticateGoogleCredential(
  credential: unknown,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ token: string; user: SeekerProfile }> {
  if (typeof credential !== 'string' || !credential.trim()) {
    throw new UpstreamError('Google credential token is required.', 400);
  }
  const claims = await verifyGoogleIdToken(credential.trim(), undefined, fetchImpl);
  return upsertGoogleSeekerAccount(claims);
}

export async function exchangeGoogleOAuthCode(
  input: {
    code: string;
    state: string;
    cookieNonce?: string | null;
  },
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ token: string; user: SeekerProfile; returnTo: string }> {
  const cfg = getGoogleAuthConfig();
  const clientSecret = getGoogleClientSecret();
  if (!cfg.enabled || !cfg.clientId || !clientSecret) {
    throw new UpstreamError('Google OAuth client credentials are not fully configured.', 503);
  }

  const verifiedState = verifyGoogleOAuthState(input.state, input.cookieNonce);
  if (!verifiedState) {
    throw new UpstreamError('Google OAuth state expired or could not be verified. Please try signing in again.', 400);
  }

  const tokenRes = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: cfg.clientId,
      client_secret: clientSecret,
      redirect_uri: verifiedState.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!tokenRes.ok) {
    throw new UpstreamError('Failed to exchange Google OAuth authorization code.', 401);
  }

  const tokenData = (await tokenRes.json()) as {
    id_token?: string;
    access_token?: string;
  };

  let claims: VerifiedGoogleClaims | null = null;
  if (typeof tokenData.id_token === 'string' && tokenData.id_token) {
    const decoded = decodeJwtPayload(tokenData.id_token);
    if (decoded && typeof decoded.sub === 'string' && typeof decoded.email === 'string') {
      const aud = typeof decoded.aud === 'string' ? decoded.aud : '';
      if (aud && aud !== cfg.clientId) {
        throw new UpstreamError('Google ID token audience mismatch.', 401);
      }
      claims = {
        sub: decoded.sub,
        email: decoded.email.toLowerCase(),
        emailVerified: decoded.email_verified !== false,
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
        picture: sanitizeAvatarUrl(decoded.picture),
        iss: typeof decoded.iss === 'string' ? decoded.iss : undefined,
        aud,
      };
    }
  }

  if (!claims && typeof tokenData.access_token === 'string' && tokenData.access_token) {
    const userRes = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userRes.ok) {
      const profile = (await userRes.json()) as Record<string, unknown>;
      if (typeof profile.sub === 'string' && typeof profile.email === 'string') {
        claims = {
          sub: profile.sub,
          email: profile.email.toLowerCase(),
          emailVerified: profile.email_verified !== false,
          name: typeof profile.name === 'string' ? profile.name : undefined,
          picture: sanitizeAvatarUrl(profile.picture),
        };
      }
    }
  }

  if (!claims) {
    throw new UpstreamError('Google OAuth response did not include a readable user profile.', 401);
  }

  const { token, user } = upsertGoogleSeekerAccount(claims);
  return { token, user, returnTo: verifiedState.returnTo };
}

export function registerSeekerAccount(input: {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  kunyah?: unknown;
  bio?: unknown;
  emblem?: unknown;
  provider?: unknown;
  avatarUrl?: unknown;
}): { token: string; user: SeekerProfile } {
  loadStore();
  const provider = sanitizeProvider(input.provider);
  const authProvider = sanitizeAuthMethod(undefined, provider);
  const rawEmail = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const email =
    rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
      ? rawEmail
      : provider !== 'email'
        ? `${provider}.${Date.now()}@seeker.dragondawwa.com`
        : '';
  if (!email) {
    throw new UpstreamError('Please enter a valid email address.', 400);
  }
  const password = typeof input.password === 'string' ? input.password : '';
  if (provider === 'email' && password.length < 4) {
    throw new UpstreamError('Password must be at least 4 characters.', 400);
  }
  const existing = accountsByEmail.get(email);
  if (existing && provider === 'email') {
    throw new UpstreamError('An account with this email already exists. Please sign in.', 409);
  }
  const nameRaw = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '';
  const defaultName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const name = nameRaw || existing?.name || defaultName || 'Community Seeker';
  const kunyah =
    (typeof input.kunyah === 'string' ? input.kunyah.trim().slice(0, 80) : '') ||
    existing?.kunyah ||
    (provider === 'google' ? 'Verified Google Seeker' : 'Seeker of Knowledge');
  const bio = (typeof input.bio === 'string' ? input.bio.trim().slice(0, 280) : '') || existing?.bio || '';
  const emblem = sanitizeEmblem(input.emblem ?? existing?.emblem);
  const avatarUrl = sanitizeAvatarUrl(input.avatarUrl) ?? existing?.avatarUrl ?? null;
  const salt = existing?.salt ?? crypto.randomBytes(16).toString('hex');
  const passwordHash = password ? hashPassword(password, salt) : existing?.passwordHash ?? hashPassword(crypto.randomUUID(), salt);

  const account: StoredAccount = {
    id: existing?.id ?? `seeker-${crypto.randomBytes(6).toString('hex')}`,
    email,
    name,
    kunyah,
    bio,
    emblem,
    provider,
    authProvider: existing?.authProvider ?? authProvider,
    googleSub: existing?.googleSub ?? null,
    avatarUrl,
    verified: true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    salt,
    passwordHash,
  };
  indexAccount(account);
  saveStore();

  const user = toPublicProfile(account);
  const token = issueSeekerToken(user);
  return { token, user };
}

export function loginSeekerAccount(input: {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  kunyah?: unknown;
  emblem?: unknown;
  provider?: unknown;
  avatarUrl?: unknown;
}): { token: string; user: SeekerProfile } {
  loadStore();
  const provider = sanitizeProvider(input.provider);
  if (provider !== 'email') {
    return registerSeekerAccount(input);
  }
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new UpstreamError('Please enter a valid email address.', 400);
  }
  if (password.length < 4) {
    throw new UpstreamError('Please enter your password (at least 4 characters).', 400);
  }
  const existing = accountsByEmail.get(email);
  if (!existing) {
    return registerSeekerAccount(input);
  }
  const computed = hashPassword(password, existing.salt);
  if (computed !== existing.passwordHash) {
    throw new UpstreamError('Incorrect password for this Seeker account.', 401);
  }
  const user = toPublicProfile(existing);
  const token = issueSeekerToken(user);
  return { token, user };
}

export function updateSeekerAccountProfile(
  current: SeekerProfile,
  input: { name?: unknown; kunyah?: unknown; bio?: unknown; emblem?: unknown; avatarUrl?: unknown },
): { token: string; user: SeekerProfile } {
  loadStore();
  const stored = accountsById.get(current.id);
  const name =
    typeof input.name === 'string' && input.name.trim()
      ? input.name.trim().slice(0, 80)
      : stored?.name ?? current.name;
  const kunyah =
    typeof input.kunyah === 'string' && input.kunyah.trim()
      ? input.kunyah.trim().slice(0, 80)
      : stored?.kunyah ?? current.kunyah;
  const bio =
    typeof input.bio === 'string'
      ? input.bio.trim().slice(0, 280)
      : stored?.bio ?? current.bio;
  const emblem = input.emblem !== undefined ? sanitizeEmblem(input.emblem) : stored?.emblem ?? current.emblem;
  const avatarUrl =
    input.avatarUrl !== undefined
      ? sanitizeAvatarUrl(input.avatarUrl)
      : stored?.avatarUrl ?? current.avatarUrl ?? null;

  const updated: StoredAccount = {
    id: current.id,
    email: stored?.email ?? current.email,
    name,
    kunyah,
    bio,
    emblem,
    provider: stored?.provider ?? current.provider,
    authProvider: stored?.authProvider ?? current.authProvider,
    googleSub: stored?.googleSub ?? current.googleSub ?? null,
    avatarUrl,
    verified: true,
    createdAt: stored?.createdAt ?? current.createdAt,
    salt: stored?.salt ?? crypto.randomBytes(16).toString('hex'),
    passwordHash: stored?.passwordHash ?? '',
  };
  indexAccount(updated);

  for (const post of wallPosts) {
    if (post.userId === updated.id) {
      post.authorName = updated.name;
      post.authorRole = updated.kunyah;
      post.authorEmblem = updated.emblem;
      post.authorAvatarUrl = updated.avatarUrl;
      post.authorAuthProvider = updated.authProvider;
    }
  }
  saveStore();

  const user = toPublicProfile(updated);
  const token = issueSeekerToken(user);
  return { token, user };
}

export function revokeSeekerToken(token: string | null) {
  if (token) revokedTokens.add(token);
}

export function listServerWallPosts(): StoredWallPost[] {
  loadStore();
  return [...wallPosts];
}

export function createServerWallPost(
  body: Record<string, unknown>,
  seeker: SeekerProfile | null,
): StoredWallPost {
  loadStore();
  const surah = Number(body.surah);
  const ayah = Number(body.ayah);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1 || ayah > 286) {
    throw new UpstreamError('Valid surah and ayah are required.', 400);
  }
  const id =
    typeof body.id === 'string' && /^[A-Za-z0-9._-]{4,120}$/.test(body.id)
      ? body.id
      : `wall-${surah}-${ayah}-${Date.now()}`;
  const post: StoredWallPost = {
    id,
    userId: seeker?.id ?? (typeof body.userId === 'string' ? body.userId.slice(0, 80) : undefined),
    surah,
    ayah,
    surahName: String(body.surahName ?? '').slice(0, 120),
    arabic: String(body.arabic ?? '').slice(0, 4000),
    translation: String(body.translation ?? '').slice(0, 4000),
    reflection: String(body.reflection ?? '').trim().slice(0, 600),
    authorName: seeker?.name ?? (String(body.authorName ?? '').trim().slice(0, 80) || 'Community Seeker'),
    authorRole: seeker?.kunyah ?? (String(body.authorRole ?? '').trim().slice(0, 80) || 'Faith Wall Contributor'),
    authorEmblem: seeker?.emblem ?? sanitizeEmblem(body.authorEmblem),
    authorAvatarUrl: seeker?.avatarUrl ?? sanitizeAvatarUrl(body.authorAvatarUrl),
    authorAuthProvider: seeker?.authProvider ?? (body.authorAuthProvider === 'google' ? 'google' : undefined),
    verified: Boolean(seeker),
    likes: typeof body.likes === 'number' && body.likes >= 0 ? Math.min(body.likes, 10000) : 1,
    lang: toLang(body.lang),
    url: String(body.url ?? '').slice(0, 400),
    createdAt: new Date().toISOString(),
  };
  const existingIdx = wallPosts.findIndex(item => item.id === post.id);
  if (existingIdx !== -1) wallPosts.splice(existingIdx, 1);
  wallPosts.unshift(post);
  if (wallPosts.length > 100) wallPosts.pop();
  saveStore();
  return post;
}

export function updateServerWallPost(
  postId: string,
  reflection: string,
  seeker: SeekerProfile | null,
): StoredWallPost {
  loadStore();
  if (!seeker) throw new UpstreamError('Sign in to edit your Faith Wall reflections.', 401);
  const post = wallPosts.find(item => item.id === postId);
  if (!post) throw new UpstreamError('Faith Wall post not found.', 404);
  if (post.userId && post.userId !== seeker.id) {
    throw new UpstreamError('You can only edit reflections on your own Faith Wall.', 403);
  }
  post.reflection = reflection.trim().slice(0, 600);
  post.authorName = seeker.name;
  post.authorRole = seeker.kunyah;
  post.authorEmblem = seeker.emblem;
  post.authorAvatarUrl = seeker.avatarUrl;
  post.authorAuthProvider = seeker.authProvider;
  post.verified = true;
  post.updatedAt = new Date().toISOString();
  saveStore();
  return post;
}

export function deleteServerWallPost(postId: string, seeker: SeekerProfile | null): { deleted: true; id: string } {
  loadStore();
  if (!seeker) throw new UpstreamError('Sign in to delete your Faith Wall reflections.', 401);
  const index = wallPosts.findIndex(item => item.id === postId);
  if (index === -1) throw new UpstreamError('Faith Wall post not found.', 404);
  const post = wallPosts[index];
  if (post.userId && post.userId !== seeker.id) {
    throw new UpstreamError('You can only delete reflections from your own Faith Wall.', 403);
  }
  wallPosts.splice(index, 1);
  saveStore();
  return { deleted: true, id: postId };
}

export function resetSeekerStoreForTests() {
  accountsByEmail.clear();
  accountsById.clear();
  accountsByGoogleSub.clear();
  revokedTokens.clear();
  wallPosts.length = 0;
  storeLoaded = true;
}

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { UpstreamError } from './http.ts';
import { persistRoot } from './persist.ts';
import { toLang, type Lang } from '../shared/sources.ts';

export type SeekerEmblem = 'rub-el-hizb' | 'crescent-star' | 'octagon-rosette' | 'emerald-lamp';
export type SeekerAuthProvider = 'email' | 'google' | 'phone' | 'username';
export type SeekerAuthMethod = 'google' | 'password';
export type SeekerRole = 'seeker' | 'researcher' | 'scholar' | 'admin';

export interface SeekerProfile {
  id: string;
  email: string;
  phone?: string | null;
  username?: string;
  name: string;
  handle?: string;
  kunyah: string;
  bio: string;
  emblem: SeekerEmblem;
  provider: SeekerAuthProvider;
  authProvider: SeekerAuthMethod;
  role?: SeekerRole;
  bannerUrl?: string | null;
  googleSub?: string | null;
  avatarUrl?: string | null;
  verified: boolean;
  createdAt: string;
}

export type PublicSeekerProfile = SeekerProfile;

export const GOOGLE_CALLBACK_ALIASES = [
  '/api/auth/google/callback',
  '/auth/google/callback',
  '/api/auth/callback/google',
  '/api/oidc/callback',
  '/auth/callback',
] as const;

export interface GoogleAuthConfig {
  enabled: boolean;
  clientId: string | null;
  hasClientSecret: boolean;
  issuer: string;
  oauthRedirectPath: '/api/auth/google/start';
  callbackPath: string;
  redirectUriOverride: string | null;
  callbackAliases: readonly string[];
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

export type WallPostTheme = 'emerald' | 'amethyst' | 'obsidian' | 'sapphire' | 'amber';
export type WallPostType = 'reflection' | 'podcast' | 'good_deed';
export type WallPostStatus = 'pending' | 'approved' | 'rejected';

export interface StoredWallReply {
  id: string;
  postId: string;
  userId?: string;
  authorName: string;
  authorRole: string;
  authorEmblem?: SeekerEmblem;
  authorAvatarUrl?: string | null;
  text: string;
  createdAt: string;
}

export interface StoredWallPost {
  id: string;
  userId?: string;
  authorId?: string;
  authorEmail?: string;
  type?: WallPostType;
  status?: WallPostStatus;
  isPinned?: boolean;
  isOfficialBroadcast?: boolean;
  isAnonymous?: boolean;
  deedCategory?: 'charity' | 'dhikr' | 'kindness';
  deedTitle?: string;
  surah: number;
  ayah: number;
  surahName: string;
  arabic: string;
  translation: string;
  reflection: string;
  theme?: WallPostTheme;
  podcastId?: string;
  podcastTitle?: string;
  podcastAudioUrl?: string;
  podcastDuration?: string;
  podcastCitations?: string[];
  hadithCollection?: string;
  hadithNumber?: number;
  hadithGrade?: string;
  authorName: string;
  authorHandle?: string;
  authorRole: string;
  authorEmblem?: SeekerEmblem;
  authorAvatar?: string | null;
  authorAvatarUrl?: string | null;
  authorAuthProvider?: SeekerAuthMethod;
  verified?: boolean;
  likes: number;
  reactions?: Record<string, number>;
  replies?: StoredWallReply[];
  lang: Lang;
  url: string;
  createdAt: string;
  updatedAt?: string;
}

export function sanitizeAnonymousServerWallPost(post: StoredWallPost): StoredWallPost {
  const isAnon = Boolean(post.isAnonymous || (post as { anonymous?: boolean }).anonymous);
  if (!isAnon) return post;
  const cleaned: StoredWallPost = {
    ...post,
    isAnonymous: true,
    userId: undefined,
    authorId: undefined,
    authorEmail: undefined,
    authorName: 'Anonymous Seeker',
    authorHandle: '@anonymous',
    authorRole: 'Sincere Sunnah Pledge',
    authorEmblem: 'emerald-lamp',
    authorAvatar: undefined,
    authorAvatarUrl: undefined,
    authorAuthProvider: undefined,
    verified: false,
  };
  delete (cleaned as unknown as Record<string, unknown>).anonymous;
  return cleaned;
}

export type ModerationMode = 'instant' | 'review';
export type DeskPaletteId = 'emerald-gold' | 'amethyst-obsidian' | 'parchment-slate';

export interface AdminSettings {
  moderationMode: ModerationMode;
  heroBannerUrl: string;
  deskPalette: DeskPaletteId;
  updatedAt?: string;
}

export interface UnansweredQuestionRecord {
  id: string;
  userId?: string;
  userName?: string;
  question: string;
  language: Lang;
  status: 'open' | 'answered';
  answer?: string;
  answeredBy?: string;
  citations?: string[];
  createdAt: string;
  answeredAt?: string;
}

const COOKIE_NAME = 'dd_seeker_token';
const OAUTH_NONCE_COOKIE = 'dd_google_oauth_nonce';
const EMBLEMS: readonly SeekerEmblem[] = ['rub-el-hizb', 'crescent-star', 'octagon-rosette', 'emerald-lamp'];
const VALID_GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

const accountsByEmail = new Map<string, StoredAccount>();
const accountsByPhone = new Map<string, StoredAccount>();
const accountsByUsername = new Map<string, StoredAccount>();
const accountsById = new Map<string, StoredAccount>();
const accountsByGoogleSub = new Map<string, StoredAccount>();
const revokedTokens = new Set<string>();
const wallPosts: StoredWallPost[] = [];
const unansweredQuestions: UnansweredQuestionRecord[] = [];
let adminSettings: AdminSettings = {
  moderationMode: 'instant',
  heroBannerUrl: '/assets/banner-art.jpg',
  deskPalette: 'emerald-gold',
};
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
  if (value === 'google' || value === 'phone' || value === 'username') return value;
  return 'email';
}

function isRejectedBypassProvider(value: unknown): boolean {
  return value === 'guest' || value === 'quick' || value === 'apple' || value === 'demo';
}

function sanitizeAuthMethod(value: unknown, provider: SeekerAuthProvider): SeekerAuthMethod {
  if (value === 'google' || value === 'password') return value;
  if (provider === 'google') return 'google';
  return 'password';
}

export function normalizeEmailIdentifier(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
}

export function normalizePhoneIdentifier(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed || /[a-zA-Z@]/.test(trimmed)) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return '';
  return hasPlus ? `+${digits}` : digits;
}

export function normalizeUsernameIdentifier(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return cleaned.length >= 2 ? cleaned.slice(0, 40) : '';
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
  const rawRedirectOverride = (
    process.env.GOOGLE_REDIRECT_URI ||
    process.env.GOOGLE_OIDC_REDIRECT_URI ||
    ''
  ).trim();
  let callbackPath = '/api/auth/google/callback';
  let redirectUriOverride: string | null = null;
  if (rawRedirectOverride) {
    if (/^https?:\/\//i.test(rawRedirectOverride)) {
      redirectUriOverride = rawRedirectOverride;
      try {
        callbackPath = new URL(rawRedirectOverride).pathname || callbackPath;
      } catch {
        /* keep default */
      }
    } else if (rawRedirectOverride.startsWith('/')) {
      callbackPath = rawRedirectOverride;
    }
  }
  return {
    enabled: Boolean(clientId),
    clientId: clientId || null,
    hasClientSecret: Boolean(clientSecret),
    issuer,
    oauthRedirectPath: '/api/auth/google/start',
    callbackPath,
    redirectUriOverride,
    callbackAliases: GOOGLE_CALLBACK_ALIASES,
  };
}

function getGoogleClientSecret(): string {
  return (process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OIDC_CLIENT_SECRET || '').trim();
}

function indexAccount(acc: StoredAccount) {
  if (acc.email) {
    accountsByEmail.set(acc.email.toLowerCase(), acc);
  }
  if (acc.phone) {
    const normPhone = normalizePhoneIdentifier(acc.phone);
    if (normPhone) {
      accountsByPhone.set(normPhone, acc);
      accountsByPhone.set(normPhone.replace(/^\+/, ''), acc);
    }
  }
  const uname = normalizeUsernameIdentifier(acc.username || acc.handle || acc.name);
  if (uname) {
    accountsByUsername.set(uname, acc);
  }
  const handleClean = normalizeUsernameIdentifier(acc.handle);
  if (handleClean) {
    accountsByUsername.set(handleClean, acc);
  }
  accountsById.set(acc.id, acc);
  if (acc.googleSub) {
    accountsByGoogleSub.set(acc.googleSub, acc);
  }
}

function findAccountByIdentifier(rawIdentifier: string): StoredAccount | undefined {
  const trimmed = rawIdentifier.trim();
  if (!trimmed) return undefined;

  const email = normalizeEmailIdentifier(trimmed);
  if (email) {
    const byEmail = accountsByEmail.get(email);
    if (byEmail) return byEmail;
  }

  const phone = normalizePhoneIdentifier(trimmed);
  if (phone) {
    const byPhone = accountsByPhone.get(phone) ?? accountsByPhone.get(phone.replace(/^\+/, '')) ?? accountsByPhone.get(`+${phone.replace(/^\+/, '')}`);
    if (byPhone) return byPhone;
  }

  const username = normalizeUsernameIdentifier(trimmed);
  if (username) {
    const byUser = accountsByUsername.get(username);
    if (byUser) return byUser;
  }

  const lower = trimmed.toLowerCase();
  for (const acc of accountsById.values()) {
    if (
      acc.email.toLowerCase() === lower ||
      (acc.phone && acc.phone === phone) ||
      (acc.username && acc.username.toLowerCase() === username) ||
      (acc.handle && acc.handle.replace(/^@/, '').toLowerCase() === username) ||
      acc.name.toLowerCase() === lower
    ) {
      return acc;
    }
  }
  return undefined;
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
      adminSettings?: Partial<AdminSettings>;
      questions?: UnansweredQuestionRecord[];
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
            bannerUrl: sanitizeAvatarUrl(acc.bannerUrl) || '/assets/banner-art.jpg',
          };
          indexAccount(normalized);
        }
      }
    }
    if (Array.isArray(raw.posts)) {
      wallPosts.splice(0, wallPosts.length, ...raw.posts.slice(0, 100));
    }
    if (raw.adminSettings && typeof raw.adminSettings === 'object') {
      adminSettings = {
        moderationMode: raw.adminSettings.moderationMode === 'review' ? 'review' : 'instant',
        heroBannerUrl:
          typeof raw.adminSettings.heroBannerUrl === 'string' && raw.adminSettings.heroBannerUrl
            ? raw.adminSettings.heroBannerUrl
            : '/assets/banner-art.jpg',
        deskPalette:
          raw.adminSettings.deskPalette === 'amethyst-obsidian' || raw.adminSettings.deskPalette === 'parchment-slate'
            ? raw.adminSettings.deskPalette
            : 'emerald-gold',
      };
    }
    if (Array.isArray(raw.questions)) {
      unansweredQuestions.splice(0, unansweredQuestions.length, ...raw.questions.slice(0, 100));
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
          adminSettings,
          questions: unansweredQuestions.slice(0, 100),
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

function inferRole(email: string, name: string, explicitRole?: unknown): SeekerRole {
  if (explicitRole === 'admin' || explicitRole === 'scholar' || explicitRole === 'researcher' || explicitRole === 'seeker') {
    return explicitRole;
  }
  if (/feroz|fairoos|admin/i.test(email) || /feroz|fairoos/i.test(name)) {
    return 'admin';
  }
  return 'seeker';
}

function toPublicProfile(account: StoredAccount): SeekerProfile {
  const username =
    account.username ||
    (account.handle ? account.handle.replace(/^@/, '') : '') ||
    account.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '') ||
    'seeker';
  return {
    id: account.id,
    email: account.email,
    phone: account.phone ?? null,
    username,
    name: account.name,
    handle: account.handle || `@${username.replace(/[^a-z0-9]+/g, '') || 'seeker'}`,
    kunyah: account.kunyah,
    bio: account.bio,
    emblem: account.emblem,
    provider: account.provider,
    authProvider: account.authProvider,
    role: account.role ?? inferRole(account.email, account.name),
    bannerUrl: account.bannerUrl ?? '/assets/banner-art.jpg',
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
      phone: profile.phone ?? null,
      username: profile.username,
      name: profile.name,
      handle: profile.handle,
      kunyah: profile.kunyah,
      bio: profile.bio,
      emblem: profile.emblem,
      provider: profile.provider,
      authProvider: profile.authProvider,
      role: profile.role ?? inferRole(profile.email, profile.name),
      bannerUrl: profile.bannerUrl ?? '/assets/banner-art.jpg',
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
    const name = typeof decoded.name === 'string' && decoded.name ? decoded.name : 'Community Seeker';
    return {
      id,
      email,
      name,
      handle: typeof decoded.handle === 'string' ? decoded.handle : `@${name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'seeker'}`,
      kunyah: typeof decoded.kunyah === 'string' && decoded.kunyah ? decoded.kunyah : 'Seeker of Knowledge',
      bio: typeof decoded.bio === 'string' ? decoded.bio : '',
      emblem: sanitizeEmblem(decoded.emblem),
      provider,
      authProvider: sanitizeAuthMethod(decoded.authProvider, provider),
      role: inferRole(email, name, decoded.role),
      bannerUrl: typeof decoded.bannerUrl === 'string' && decoded.bannerUrl ? decoded.bannerUrl : '/assets/banner-art.jpg',
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

export const AUTH_REQUIRED_MESSAGE =
  'Authentication required. Please sign in to use Dragon Dawwa research tools.';

export function requireSeekerAuth(req: Request, res: Response, next: () => void) {
  if (process.env.ALLOW_UNAUTHENTICATED_RESEARCH_FOR_TESTS === '1') {
    next();
    return;
  }
  const seeker = getRequestSeeker(req);
  if (!seeker) {
    res.status(401).json({
      error: AUTH_REQUIRED_MESSAGE,
      requiresAuth: true,
    });
    return;
  }
  next();
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

export function resolveGoogleRedirectUri(req: Request, callbackPathOverride?: unknown): string {
  const cfg = getGoogleAuthConfig();
  if (
    typeof callbackPathOverride === 'string' &&
    callbackPathOverride.startsWith('/') &&
    (GOOGLE_CALLBACK_ALIASES as readonly string[]).includes(callbackPathOverride)
  ) {
    return `${resolveRequestOrigin(req)}${callbackPathOverride}`;
  }
  if (cfg.redirectUriOverride) {
    return cfg.redirectUriOverride;
  }
  return `${resolveRequestOrigin(req)}${cfg.callbackPath}`;
}

export function buildGoogleOAuthStart(
  req: Request,
  returnToRaw?: unknown,
  callbackPathOverride?: unknown,
): { url: string; nonce: string; state: string; redirectUri: string } {
  const cfg = getGoogleAuthConfig();
  if (!cfg.enabled || !cfg.clientId) {
    throw new UpstreamError('Google Sign-In is not configured on this server (GOOGLE_OIDC_CLIENT_ID missing).', 503);
  }
  const redirectUri = resolveGoogleRedirectUri(req, callbackPathOverride);
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

export async function verifyGoogleAccessToken(
  accessToken: string,
  expectedClientId?: string | null,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<VerifiedGoogleClaims> {
  if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
    throw new UpstreamError('A Google access token is required.', 400);
  }
  const token = accessToken.trim();
  const cfg = getGoogleAuthConfig();
  const targetClientId = (expectedClientId ?? cfg.clientId ?? '').trim();

  // Verify token audience/expiry against Google tokeninfo if available
  const infoRes = await fetchImpl(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
  ).catch(() => null);

  let tokenInfoSub = '';
  let tokenInfoEmail = '';
  let tokenInfoVerified = false;
  if (infoRes && infoRes.ok) {
    const info = (await infoRes.json().catch(() => ({}))) as Record<string, unknown>;
    const aud = typeof info.aud === 'string' ? info.aud.trim() : typeof info.azp === 'string' ? info.azp.trim() : '';
    const exp = Number(info.exp ?? 0);
    if (targetClientId && aud && aud !== targetClientId) {
      throw new UpstreamError('Google access token audience does not match this application.', 401);
    }
    if (exp > 0 && exp * 1000 < Date.now() - 30_000) {
      throw new UpstreamError('Google access token has expired.', 401);
    }
    tokenInfoSub = typeof info.sub === 'string' ? info.sub.trim() : '';
    tokenInfoEmail = typeof info.email === 'string' ? info.email.trim().toLowerCase() : '';
    tokenInfoVerified = info.email_verified === true || info.email_verified === 'true';
  }

  // Fetch user profile from Google OAuth2 v3 userinfo
  const userRes = await fetchImpl('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) {
    throw new UpstreamError('Google access token could not be verified.', 401);
  }
  const profile = (await userRes.json().catch(() => ({}))) as Record<string, unknown>;
  const sub = typeof profile.sub === 'string' && profile.sub.trim() ? profile.sub.trim() : tokenInfoSub;
  const email =
    typeof profile.email === 'string' && profile.email.trim()
      ? profile.email.trim().toLowerCase()
      : tokenInfoEmail;
  const emailVerified =
    profile.email_verified === true ||
    profile.email_verified === 'true' ||
    tokenInfoVerified;

  if (!sub || !email) {
    throw new UpstreamError('Google user profile did not include subject and email.', 401);
  }

  return {
    sub,
    email,
    emailVerified,
    name: typeof profile.name === 'string' ? profile.name.trim() : undefined,
    picture: sanitizeAvatarUrl(profile.picture),
    aud: targetClientId || undefined,
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
    if (!post.isAnonymous && post.userId === account.id) {
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
  credentialOrInput:
    | unknown
    | {
        credential?: unknown;
        accessToken?: unknown;
        access_token?: unknown;
      },
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ token: string; user: SeekerProfile }> {
  if (typeof credentialOrInput === 'string') {
    const trimmed = credentialOrInput.trim();
    if (!trimmed) {
      throw new UpstreamError('Google credential token is required.', 400);
    }
    const claims = await verifyGoogleIdToken(trimmed, undefined, fetchImpl);
    return upsertGoogleSeekerAccount(claims);
  }
  if (credentialOrInput && typeof credentialOrInput === 'object') {
    const record = credentialOrInput as {
      credential?: unknown;
      accessToken?: unknown;
      access_token?: unknown;
    };
    const idToken = typeof record.credential === 'string' ? record.credential.trim() : '';
    const accessToken =
      typeof record.accessToken === 'string' && record.accessToken.trim()
        ? record.accessToken.trim()
        : typeof record.access_token === 'string' && record.access_token.trim()
          ? record.access_token.trim()
          : '';
    if (idToken) {
      const claims = await verifyGoogleIdToken(idToken, undefined, fetchImpl);
      return upsertGoogleSeekerAccount(claims);
    }
    if (accessToken) {
      const claims = await verifyGoogleAccessToken(accessToken, undefined, fetchImpl);
      return upsertGoogleSeekerAccount(claims);
    }
  }
  throw new UpstreamError('Google credential or access token is required.', 400);
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
  identifier?: unknown;
  email?: unknown;
  phone?: unknown;
  username?: unknown;
  password?: unknown;
  name?: unknown;
  kunyah?: unknown;
  bio?: unknown;
  emblem?: unknown;
  provider?: unknown;
  mode?: unknown;
  avatarUrl?: unknown;
}): { token: string; user: SeekerProfile } {
  loadStore();
  if (isRejectedBypassProvider(input.provider) || input.mode === 'quick' || input.mode === 'guest') {
    throw new UpstreamError('Guest and quick sign-in are disabled. Please sign in with your credentials or Google.', 400);
  }

  const rawContact =
    typeof input.email === 'string' && input.email.trim()
      ? input.email.trim()
      : typeof input.phone === 'string' && input.phone.trim()
        ? input.phone.trim()
        : typeof input.identifier === 'string' && input.identifier.trim()
          ? input.identifier.trim()
          : '';

  const emailFromInput = normalizeEmailIdentifier(input.email) || normalizeEmailIdentifier(rawContact);
  const phoneFromInput = normalizePhoneIdentifier(input.phone) || normalizePhoneIdentifier(rawContact);
  const explicitUsername = normalizeUsernameIdentifier(input.username);
  const nameRaw = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '';
  const usernameFromContact = !emailFromInput && !phoneFromInput ? normalizeUsernameIdentifier(rawContact) : '';
  const username =
    explicitUsername ||
    usernameFromContact ||
    normalizeUsernameIdentifier(nameRaw) ||
    (emailFromInput ? normalizeUsernameIdentifier(emailFromInput.split('@')[0]) : '') ||
    (phoneFromInput ? `seeker_${phoneFromInput.replace(/\D/g, '').slice(-6)}` : '');

  if (typeof input.email === 'string' && input.email.trim() && !emailFromInput && !phoneFromInput && !usernameFromContact) {
    throw new UpstreamError('Please enter a valid email address, phone number, or username.', 400);
  }
  if (!emailFromInput && !phoneFromInput && !username) {
    throw new UpstreamError('Please enter a valid email address, phone number, or username.', 400);
  }

  const password = typeof input.password === 'string' ? input.password : '';
  if (password.length < 4) {
    throw new UpstreamError('Password must be at least 4 characters.', 400);
  }

  if (emailFromInput && accountsByEmail.has(emailFromInput)) {
    throw new UpstreamError('An account with this email already exists. Please sign in.', 409);
  }
  if (phoneFromInput && (accountsByPhone.has(phoneFromInput) || accountsByPhone.has(phoneFromInput.replace(/^\+/, '')))) {
    throw new UpstreamError('An account with this phone number already exists. Please sign in.', 409);
  }
  if (explicitUsername && accountsByUsername.has(explicitUsername)) {
    throw new UpstreamError('An account with this username already exists. Please sign in.', 409);
  }

  const provider: SeekerAuthProvider = phoneFromInput && !emailFromInput
    ? 'phone'
    : !emailFromInput && username
      ? 'username'
      : 'email';
  const email =
    emailFromInput ||
    (phoneFromInput
      ? `${phoneFromInput.replace(/\D/g, '')}@phone.dragondawwa.com`
      : `${username}@user.dragondawwa.com`);
  const defaultName = emailFromInput
    ? emailFromInput.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : username
      ? username.replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'Community Seeker';
  const name = nameRaw || defaultName || 'Community Seeker';
  const finalUsername = username || normalizeUsernameIdentifier(name) || 'seeker';
  const handle = `@${finalUsername.replace(/[^a-z0-9]+/g, '') || 'seeker'}`;
  const kunyah =
    (typeof input.kunyah === 'string' ? input.kunyah.trim().slice(0, 80) : '') ||
    'Seeker of Knowledge';
  const bio = typeof input.bio === 'string' ? input.bio.trim().slice(0, 280) : '';
  const emblem = sanitizeEmblem(input.emblem);
  const avatarUrl = sanitizeAvatarUrl(input.avatarUrl);
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  const account: StoredAccount = {
    id: `seeker-${crypto.randomBytes(6).toString('hex')}`,
    email,
    phone: phoneFromInput || null,
    username: finalUsername,
    name,
    handle,
    kunyah,
    bio,
    emblem,
    provider,
    authProvider: 'password',
    googleSub: null,
    avatarUrl,
    verified: true,
    createdAt: new Date().toISOString(),
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
  identifier?: unknown;
  email?: unknown;
  phone?: unknown;
  username?: unknown;
  password?: unknown;
  name?: unknown;
  kunyah?: unknown;
  emblem?: unknown;
  provider?: unknown;
  mode?: unknown;
  avatarUrl?: unknown;
}): { token: string; user: SeekerProfile } {
  loadStore();
  if (isRejectedBypassProvider(input.provider) || input.mode === 'quick' || input.mode === 'guest') {
    throw new UpstreamError('Guest and quick sign-in are disabled. Please sign in with your credentials or Google.', 400);
  }
  const rawIdentifier =
    typeof input.identifier === 'string' && input.identifier.trim()
      ? input.identifier.trim()
      : typeof input.email === 'string' && input.email.trim()
        ? input.email.trim()
        : typeof input.phone === 'string' && input.phone.trim()
          ? input.phone.trim()
          : typeof input.username === 'string' && input.username.trim()
            ? input.username.trim()
            : '';

  if (!rawIdentifier) {
    throw new UpstreamError('Please enter your username, email, or phone number.', 400);
  }
  const isEmail = Boolean(normalizeEmailIdentifier(rawIdentifier));
  const isPhone = Boolean(normalizePhoneIdentifier(rawIdentifier));
  const isUsername = Boolean(normalizeUsernameIdentifier(rawIdentifier));
  if (!isEmail && !isPhone && !isUsername) {
    throw new UpstreamError('Please enter a valid username, email address, or phone number.', 400);
  }

  const password = typeof input.password === 'string' ? input.password : '';
  if (password.length < 4) {
    throw new UpstreamError('Please enter your password (at least 4 characters).', 400);
  }

  const existing = findAccountByIdentifier(rawIdentifier);
  if (!existing) {
    throw new UpstreamError('No Seeker account found for that username, email, or phone number. Please create an account first.', 401);
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
  input: {
    name?: unknown;
    kunyah?: unknown;
    bio?: unknown;
    emblem?: unknown;
    avatarUrl?: unknown;
    bannerUrl?: unknown;
    role?: unknown;
  },
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
  const bannerUrl =
    typeof input.bannerUrl === 'string' && input.bannerUrl.trim()
      ? input.bannerUrl.trim().slice(0, 500)
      : stored?.bannerUrl ?? current.bannerUrl ?? '/assets/banner-art.jpg';
  const role = inferRole(stored?.email ?? current.email, name, input.role ?? stored?.role ?? current.role);

  const updated: StoredAccount = {
    id: current.id,
    email: stored?.email ?? current.email,
    name,
    handle: `@${name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'seeker'}`,
    kunyah,
    bio,
    emblem,
    provider: stored?.provider ?? current.provider,
    authProvider: stored?.authProvider ?? current.authProvider,
    role,
    bannerUrl,
    googleSub: stored?.googleSub ?? current.googleSub ?? null,
    avatarUrl,
    verified: true,
    createdAt: stored?.createdAt ?? current.createdAt,
    salt: stored?.salt ?? crypto.randomBytes(16).toString('hex'),
    passwordHash: stored?.passwordHash ?? '',
  };
  indexAccount(updated);

  for (const post of wallPosts) {
    if (!post.isAnonymous && post.userId === updated.id) {
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
  return [...wallPosts]
    .map(p => (p.isAnonymous ? sanitizeAnonymousServerWallPost(p) : p))
    .sort((a, b) => {
      if (Boolean(b.isPinned) !== Boolean(a.isPinned)) return b.isPinned ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

function sanitizeTheme(value: unknown): WallPostTheme {
  if (
    value === 'emerald' ||
    value === 'amethyst' ||
    value === 'obsidian' ||
    value === 'sapphire' ||
    value === 'amber'
  ) {
    return value;
  }
  return 'emerald';
}

export const SACRED_ANCHOR_REQUIRED_MESSAGE =
  'Posts on the Faith Wall require a sacred anchor (a Qur’an/Hadith citation or a completed Research Podcast episode).';

export function createServerWallPost(
  body: Record<string, unknown>,
  seeker: SeekerProfile | null,
): StoredWallPost {
  loadStore();
  const postType: WallPostType =
    body.type === 'podcast' ? 'podcast' : body.type === 'good_deed' ? 'good_deed' : 'reflection';
  const surah = Number(body.surah ?? 0);
  const ayah = Number(body.ayah ?? 0);
  const podcastId = typeof body.podcastId === 'string' ? body.podcastId.trim().slice(0, 120) : '';
  const podcastTitle = typeof body.podcastTitle === 'string' ? body.podcastTitle.trim().slice(0, 240) : '';
  const hadithCollection = typeof body.hadithCollection === 'string' ? body.hadithCollection.trim().slice(0, 80) : '';
  const hadithNumber = Number(body.hadithNumber ?? 0);

  if (postType === 'podcast') {
    if (!podcastId && !podcastTitle) {
      throw new UpstreamError(SACRED_ANCHOR_REQUIRED_MESSAGE, 400);
    }
  } else {
    const validQuran = Number.isInteger(surah) && surah >= 1 && surah <= 114 && Number.isInteger(ayah) && ayah >= 1 && ayah <= 286;
    const validHadith = Boolean(hadithCollection && Number.isInteger(hadithNumber) && hadithNumber >= 1);
    if (!validQuran && !validHadith) {
      throw new UpstreamError('Valid surah and ayah are required.', 400);
    }
  }

  const isOfficialBroadcast = Boolean(body.isOfficialBroadcast);
  const isAnon = Boolean(body.isAnonymous || body.anonymous);
  const isPinned = Boolean(body.isPinned || isOfficialBroadcast);
  const defaultStatus: WallPostStatus =
    isOfficialBroadcast || body.status === 'approved'
      ? 'approved'
      : body.status === 'pending' || adminSettings.moderationMode === 'review'
        ? 'pending'
        : 'approved';

  const id =
    typeof body.id === 'string' && /^[A-Za-z0-9._-]{4,120}$/.test(body.id)
      ? body.id
      : postType === 'podcast'
        ? `wall-pod-${Date.now()}`
        : postType === 'good_deed'
          ? `wall-deed-${Date.now()}`
          : `wall-${surah || 1}-${ayah || 1}-${Date.now()}`;

  const resolvedAuthorName = isAnon
    ? 'Anonymous Seeker'
    : isOfficialBroadcast
      ? String(body.authorName || 'Dragon Dawwa Editorial Board').slice(0, 80)
      : seeker?.name ?? (String(body.authorName ?? '').trim().slice(0, 80) || 'Community Seeker');

  const rawPost: StoredWallPost = {
    id,
    userId: isAnon
      ? undefined
      : seeker?.id ?? (typeof body.userId === 'string' ? body.userId.slice(0, 80) : undefined),
    type: postType,
    status: defaultStatus,
    isPinned,
    isOfficialBroadcast,
    isAnonymous: isAnon,
    deedCategory:
      body.deedCategory === 'charity' || body.deedCategory === 'dhikr' || body.deedCategory === 'kindness'
        ? body.deedCategory
        : undefined,
    deedTitle: typeof body.deedTitle === 'string' ? body.deedTitle.slice(0, 200) : undefined,
    surah: Number.isInteger(surah) && surah >= 1 ? surah : 1,
    ayah: Number.isInteger(ayah) && ayah >= 1 ? ayah : 1,
    surahName: String(body.surahName ?? (postType === 'podcast' ? 'Research Podcast' : '')).slice(0, 120),
    arabic: String(body.arabic ?? body.verse_text ?? '').slice(0, 4000),
    translation: String(body.translation ?? body.translation_text ?? '').slice(0, 4000),
    reflection: String(body.reflection ?? body.reflection_text ?? '').trim().slice(0, 500),
    theme: sanitizeTheme(body.theme),
    podcastId: podcastId || undefined,
    podcastTitle: podcastTitle || undefined,
    podcastAudioUrl: typeof body.podcastAudioUrl === 'string' ? body.podcastAudioUrl.slice(0, 500) : undefined,
    podcastDuration: typeof body.podcastDuration === 'string' ? body.podcastDuration.slice(0, 40) : undefined,
    podcastCitations: Array.isArray(body.podcastCitations)
      ? body.podcastCitations.slice(0, 12).map(c => String(c).slice(0, 160))
      : undefined,
    hadithCollection: hadithCollection || undefined,
    hadithNumber: Number.isInteger(hadithNumber) && hadithNumber > 0 ? hadithNumber : undefined,
    hadithGrade: typeof body.hadithGrade === 'string' ? body.hadithGrade.slice(0, 80) : undefined,
    authorName: resolvedAuthorName,
    authorHandle: isAnon
      ? '@anonymous'
      : `@${resolvedAuthorName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'seeker'}`,
    authorRole: isAnon
      ? 'Sincere Sunnah Pledge'
      : isOfficialBroadcast
        ? '✦ Official Institutional Broadcast'
        : seeker?.kunyah ?? (String(body.authorRole ?? '').trim().slice(0, 80) || 'Faith Wall Contributor'),
    authorEmblem: isAnon ? 'emerald-lamp' : seeker?.emblem ?? sanitizeEmblem(body.authorEmblem),
    authorAvatar: undefined,
    authorAvatarUrl: isAnon ? undefined : seeker?.avatarUrl ?? sanitizeAvatarUrl(body.authorAvatarUrl),
    authorAuthProvider: isAnon
      ? undefined
      : seeker?.authProvider ?? (body.authorAuthProvider === 'google' ? 'google' : undefined),
    verified: isAnon ? false : Boolean(seeker || isOfficialBroadcast),
    likes: typeof body.likes === 'number' && body.likes >= 0 ? Math.min(body.likes, 10000) : 1,
    reactions: { amin: 1 },
    replies: [],
    lang: toLang(body.lang),
    url: String(body.url ?? '').slice(0, 400),
    createdAt: new Date().toISOString(),
  };
  const post = isAnon ? sanitizeAnonymousServerWallPost(rawPost) : rawPost;
  const existingIdx = wallPosts.findIndex(item => item.id === post.id);
  if (existingIdx !== -1) wallPosts.splice(existingIdx, 1);
  wallPosts.unshift(post);
  if (wallPosts.length > 100) wallPosts.pop();
  saveStore();
  return post;
}

export function moderateServerWallPost(
  postId: string,
  patch: { status?: unknown; isPinned?: unknown; isOfficialBroadcast?: unknown },
): StoredWallPost {
  loadStore();
  const post = wallPosts.find(item => item.id === postId);
  if (!post) throw new UpstreamError('Faith Wall post not found.', 404);
  if (patch.status === 'approved' || patch.status === 'rejected' || patch.status === 'pending') {
    post.status = patch.status;
  }
  if (typeof patch.isPinned === 'boolean') {
    post.isPinned = patch.isPinned;
  }
  if (typeof patch.isOfficialBroadcast === 'boolean') {
    post.isOfficialBroadcast = patch.isOfficialBroadcast;
  }
  post.updatedAt = new Date().toISOString();
  saveStore();
  return post;
}

export function getServerAdminSettings(): AdminSettings {
  loadStore();
  return { ...adminSettings };
}

export function updateServerAdminSettings(patch: Partial<AdminSettings>): AdminSettings {
  loadStore();
  if (patch.moderationMode === 'instant' || patch.moderationMode === 'review') {
    adminSettings.moderationMode = patch.moderationMode;
  }
  if (typeof patch.heroBannerUrl === 'string' && patch.heroBannerUrl.trim()) {
    adminSettings.heroBannerUrl = patch.heroBannerUrl.trim().slice(0, 500);
  }
  if (
    patch.deskPalette === 'emerald-gold' ||
    patch.deskPalette === 'amethyst-obsidian' ||
    patch.deskPalette === 'parchment-slate'
  ) {
    adminSettings.deskPalette = patch.deskPalette;
  }
  adminSettings.updatedAt = new Date().toISOString();
  saveStore();
  return { ...adminSettings };
}

export function listServerQuestions(): UnansweredQuestionRecord[] {
  loadStore();
  return [...unansweredQuestions];
}

export function createServerQuestion(
  body: Record<string, unknown>,
  seeker: SeekerProfile | null,
): UnansweredQuestionRecord {
  loadStore();
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 1200) : '';
  if (!question) throw new UpstreamError('Question text is required.', 400);
  const record: UnansweredQuestionRecord = {
    id: typeof body.id === 'string' && body.id ? body.id.slice(0, 80) : `q-${Date.now()}`,
    userId: seeker?.id ?? (typeof body.userId === 'string' ? body.userId : undefined),
    userName: seeker?.name ?? (typeof body.userName === 'string' ? body.userName : 'Community Seeker'),
    question,
    language: toLang(body.language ?? body.lang),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  unansweredQuestions.unshift(record);
  if (unansweredQuestions.length > 100) unansweredQuestions.pop();
  saveStore();
  return record;
}

export function answerServerQuestion(
  questionId: string,
  body: Record<string, unknown>,
  seeker: SeekerProfile | null,
): UnansweredQuestionRecord {
  loadStore();
  const answer = typeof body.answer === 'string' ? body.answer.trim().slice(0, 4000) : '';
  if (!answer) throw new UpstreamError('Scholar answer text is required.', 400);
  let record = unansweredQuestions.find(q => q.id === questionId);
  if (!record) {
    record = {
      id: questionId,
      question: typeof body.question === 'string' ? body.question : 'Seeker Inquiry',
      language: toLang(body.language),
      status: 'answered',
      createdAt: new Date().toISOString(),
    };
    unansweredQuestions.unshift(record);
  }
  record.status = 'answered';
  record.answer = answer;
  record.answeredBy =
    seeker?.name || (typeof body.answeredBy === 'string' && body.answeredBy ? body.answeredBy : 'Institutional Scholarly Board');
  if (Array.isArray(body.citations)) {
    record.citations = body.citations.slice(0, 12).map(c => String(c).slice(0, 160));
  }
  record.answeredAt = new Date().toISOString();
  saveStore();
  return record;
}

export function getServerUserProfile(idOrHandle: string): {
  profile: SeekerProfile;
  posts: StoredWallPost[];
} | null {
  loadStore();
  const clean = idOrHandle.replace(/^@/, '').toLowerCase();
  let found: StoredAccount | undefined = accountsById.get(idOrHandle);
  if (!found) {
    for (const acc of accountsById.values()) {
      const h = (acc.handle || acc.name).replace(/^@/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (acc.id.toLowerCase() === clean || h === clean || acc.name.toLowerCase() === clean) {
        found = acc;
        break;
      }
    }
  }
  if (!found) return null;
  const profile = toPublicProfile(found);
  const posts = wallPosts.filter(
    p => !p.isAnonymous && (p.userId === profile.id || p.authorName === profile.name) && p.status !== 'rejected',
  );
  return { profile, posts };
}

export function updateServerWallPost(
  postId: string,
  reflection: string,
  seeker: SeekerProfile | null,
  theme?: unknown,
): StoredWallPost {
  loadStore();
  if (!seeker) throw new UpstreamError('Sign in to edit your Faith Wall reflections.', 401);
  const post = wallPosts.find(item => item.id === postId);
  if (!post) throw new UpstreamError('Faith Wall post not found.', 404);
  if (post.userId && post.userId !== seeker.id) {
    throw new UpstreamError('You can only edit reflections on your own Faith Wall.', 403);
  }
  post.reflection = reflection.trim().slice(0, 500);
  if (theme !== undefined) {
    post.theme = sanitizeTheme(theme);
  }
  if (post.isAnonymous) {
    const sanitized = sanitizeAnonymousServerWallPost({
      ...post,
      updatedAt: new Date().toISOString(),
    });
    Object.assign(post, sanitized);
  } else {
    post.authorName = seeker.name;
    post.authorRole = seeker.kunyah;
    post.authorEmblem = seeker.emblem;
    post.authorAvatarUrl = seeker.avatarUrl;
    post.authorAuthProvider = seeker.authProvider;
    post.verified = true;
    post.updatedAt = new Date().toISOString();
  }
  saveStore();
  return post.isAnonymous ? sanitizeAnonymousServerWallPost(post) : post;
}

export function reactToServerWallPost(
  postId: string,
  reactionId: string,
): { ok: true; postId: string; reactionId: string; count: number } {
  loadStore();
  const cleanId = reactionId.trim().slice(0, 64) || 'amin';
  const post = wallPosts.find(item => item.id === postId);
  if (post) {
    post.reactions = post.reactions ?? {};
    post.reactions[cleanId] = (post.reactions[cleanId] ?? 0) + 1;
    post.likes = (post.likes ?? 0) + 1;
    saveStore();
    return { ok: true, postId, reactionId: cleanId, count: post.reactions[cleanId] };
  }
  return { ok: true, postId, reactionId: cleanId, count: 1 };
}

export function addReplyToServerWallPost(
  postId: string,
  text: string,
  seeker: SeekerProfile | null,
): StoredWallReply {
  loadStore();
  const cleaned = text.trim().slice(0, 500);
  if (!cleaned) throw new UpstreamError('Reply text is required.', 400);
  const reply: StoredWallReply = {
    id: `reply-${postId}-${Date.now()}`,
    postId,
    userId: seeker?.id,
    authorName: seeker?.name || 'Community Seeker',
    authorRole: seeker?.kunyah || 'Seeker of Knowledge',
    authorEmblem: seeker?.emblem ?? 'rub-el-hizb',
    authorAvatarUrl: seeker?.avatarUrl ?? null,
    text: cleaned,
    createdAt: new Date().toISOString(),
  };
  const post = wallPosts.find(item => item.id === postId);
  if (post) {
    post.replies = [...(post.replies ?? []), reply].slice(-50);
    saveStore();
  }
  return reply;
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
  accountsByPhone.clear();
  accountsByUsername.clear();
  accountsById.clear();
  accountsByGoogleSub.clear();
  revokedTokens.clear();
  wallPosts.length = 0;
  unansweredQuestions.length = 0;
  adminSettings = {
    moderationMode: 'instant',
    heroBannerUrl: '/assets/banner-art.jpg',
    deskPalette: 'emerald-gold',
  };
  storeLoaded = true;
}

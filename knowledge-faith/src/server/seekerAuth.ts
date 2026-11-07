import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { UpstreamError } from './http.ts';
import { persistRoot } from './persist.ts';
import { toLang, type Lang } from '../shared/sources.ts';

export type SeekerEmblem = 'rub-el-hizb' | 'crescent-star' | 'octagon-rosette' | 'emerald-lamp';
export type SeekerAuthProvider = 'email' | 'google' | 'apple' | 'guest';

export interface SeekerProfile {
  id: string;
  email: string;
  name: string;
  kunyah: string;
  bio: string;
  emblem: SeekerEmblem;
  provider: SeekerAuthProvider;
  verified: boolean;
  createdAt: string;
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
  verified?: boolean;
  likes: number;
  lang: Lang;
  url: string;
  createdAt: string;
  updatedAt?: string;
}

const COOKIE_NAME = 'dd_seeker_token';
const EMBLEMS: readonly SeekerEmblem[] = ['rub-el-hizb', 'crescent-star', 'octagon-rosette', 'emerald-lamp'];

const accountsByEmail = new Map<string, StoredAccount>();
const accountsById = new Map<string, StoredAccount>();
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
          accountsByEmail.set(acc.email.toLowerCase(), acc);
          accountsById.set(acc.id, acc);
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
    return {
      id,
      email,
      name: typeof decoded.name === 'string' && decoded.name ? decoded.name : 'Community Seeker',
      kunyah: typeof decoded.kunyah === 'string' && decoded.kunyah ? decoded.kunyah : 'Seeker of Knowledge',
      bio: typeof decoded.bio === 'string' ? decoded.bio : '',
      emblem: sanitizeEmblem(decoded.emblem),
      provider: sanitizeProvider(decoded.provider),
      verified: decoded.verified !== false,
      createdAt: typeof decoded.createdAt === 'string' ? decoded.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (match?.[1]) return match[1].trim();
  }
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string') {
    for (const part of cookieHeader.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === COOKIE_NAME && rest.length) {
        return decodeURIComponent(rest.join('='));
      }
    }
  }
  return null;
}

export function getRequestSeeker(req: Request): SeekerProfile | null {
  return verifySeekerToken(extractTokenFromRequest(req));
}

export function setSeekerCookie(res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`,
  );
}

export function clearSeekerCookie(res: Response) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`);
}

export function registerSeekerAccount(input: {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  kunyah?: unknown;
  bio?: unknown;
  emblem?: unknown;
  provider?: unknown;
}): { token: string; user: SeekerProfile } {
  loadStore();
  const provider = sanitizeProvider(input.provider);
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
    'Seeker of Knowledge';
  const bio = (typeof input.bio === 'string' ? input.bio.trim().slice(0, 280) : '') || existing?.bio || '';
  const emblem = sanitizeEmblem(input.emblem ?? existing?.emblem);
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
    verified: true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    salt,
    passwordHash,
  };
  accountsByEmail.set(email, account);
  accountsById.set(account.id, account);
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
  input: { name?: unknown; kunyah?: unknown; bio?: unknown; emblem?: unknown },
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

  const updated: StoredAccount = {
    id: current.id,
    email: stored?.email ?? current.email,
    name,
    kunyah,
    bio,
    emblem,
    provider: stored?.provider ?? current.provider,
    verified: true,
    createdAt: stored?.createdAt ?? current.createdAt,
    salt: stored?.salt ?? crypto.randomBytes(16).toString('hex'),
    passwordHash: stored?.passwordHash ?? '',
  };
  accountsById.set(updated.id, updated);
  accountsByEmail.set(updated.email.toLowerCase(), updated);

  for (const post of wallPosts) {
    if (post.userId === updated.id) {
      post.authorName = updated.name;
      post.authorRole = updated.kunyah;
      post.authorEmblem = updated.emblem;
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
  revokedTokens.clear();
  wallPosts.length = 0;
  storeLoaded = true;
}

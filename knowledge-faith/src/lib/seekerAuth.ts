import { useCallback, useEffect, useState } from 'react';
import { resolveHashPath, ROUTE_ROOTS, type RouteRoot } from './route.ts';

export type SeekerEmblem = 'rub-el-hizb' | 'crescent-star' | 'octagon-rosette' | 'emerald-lamp';
export type SeekerAuthProvider = 'email' | 'google' | 'phone' | 'username';
export type SeekerAuthMethod = 'google' | 'password';
export type SeekerRole = 'seeker' | 'researcher' | 'scholar' | 'admin';

export interface SeekerUser {
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
  authProvider?: SeekerAuthMethod;
  role?: SeekerRole;
  bannerUrl?: string | null;
  googleSub?: string | null;
  avatarUrl?: string | null;
  verified: boolean;
  createdAt: string;
}

export type PublicSeekerProfile = SeekerUser;

export interface SeekerSession {
  token: string;
  user: SeekerUser;
}

export interface GoogleAuthClientConfig {
  enabled: boolean;
  clientId: string | null;
  hasClientSecret: boolean;
  oauthRedirectPath: string;
  callbackPath: string;
  redirectUriOverride?: string | null;
}

export const SEEKER_AUTH_EVENT = 'kf-seeker-auth-changed';
export const SEEKER_MODAL_EVENT = 'kf-seeker-modal-open';
export const SESSION_STORAGE_KEY = 'kf-seeker-session';
export const SESSION_TOKEN_KEY = 'dd-seeker-session-token';

const DEFAULT_GOOGLE_CONFIG: GoogleAuthClientConfig = {
  enabled: false,
  clientId: null,
  hasClientSecret: false,
  oauthRedirectPath: '/api/auth/google/start',
  callbackPath: '/api/auth/google/callback',
  redirectUriOverride: null,
};

let memorySession: SeekerSession | null = null;
let memoryGoogleConfig: GoogleAuthClientConfig = DEFAULT_GOOGLE_CONFIG;
let modalRequestedOpen = false;
let pendingRouteTarget: string | null = null;
let pendingDeskLabel: string | null = null;
let sessionHydrated = false;

export const PENDING_ROUTE_STORAGE_KEY = 'dd-seeker-pending-route';

export function isPublicHomeHash(rawHash: string): boolean {
  const clean = rawHash.replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '').trim();
  return clean === '' || clean === 'hub' || clean === 'screen-13' || clean === 'about';
}

/** Accept only local application routes; navigation never grants access to a route. */
export function isValidRequestedDestination(hash: string | null | undefined): hash is string {
  if (!hash || !/^#\/[a-z0-9-]+(?:[/?]|$)/i.test(hash) || /[\\\s\x00-\x1f]/.test(hash)) return false;
  if (isPublicHomeHash(hash)) return false;
  const path = resolveHashPath(hash);
  return ROUTE_ROOTS.includes(path.split('/')[0] as RouteRoot);
}

export function postLoginDestination(pending: string | null, current: string): string {
  if (isValidRequestedDestination(pending)) return pending;
  return isValidRequestedDestination(current) ? current : '#/quran/wall';
}

export function deskLabelForHash(rawHash: string): string {
  const clean = rawHash.replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '').toLowerCase();
  if (!clean || clean === 'hub') return 'Knowledge Studio';
  if (clean.includes('wall')) return 'Community Faith Wall';
  if (clean.startsWith('quran')) return 'Al-Qur’an Reader & Tafsir';
  if (clean.startsWith('hadith')) return 'Prophetic Sunnah (Hadith)';
  if (clean.includes('names') || clean.includes('asma')) return '99 Names of Allah';
  if (clean.includes('seerah') || clean.includes('prophet')) return 'Seerah & History';
  if (clean.includes('fiqh')) return 'Fiqh & Fatwa Desk';
  if (clean.startsWith('podcast') || clean.startsWith('studio')) return 'Research & Podcasts Studio';
  if (clean.startsWith('books') || clean.includes('discover') || clean.includes('deepen')) return 'Books & Source Library';
  if (clean.includes('shahadah')) return 'New to Islam (Shahadah)';
  if (clean.startsWith('spiritual') || clean.startsWith('prayer')) return 'Five Pillars & Worship';
  if (clean.includes('saved')) return 'Saved Bookmarks';
  if (clean.includes('scholar')) return 'Ask a Scholar';
  if (clean.startsWith('profile')) return 'Seeker Profile & Portfolio';
  if (clean.startsWith('admin')) return 'Institutional Admin Cockpit';
  return 'Dragon Dawwa Studio';
}

export function readPendingRoute(): string | null {
  if (isValidRequestedDestination(pendingRouteTarget)) return pendingRouteTarget;
  if (typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(PENDING_ROUTE_STORAGE_KEY);
      if (isValidRequestedDestination(stored)) return stored;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function readPendingDeskLabel(): string | null {
  if (pendingDeskLabel) return pendingDeskLabel;
  const route = readPendingRoute();
  return route ? deskLabelForHash(route) : null;
}

export function setPendingRoute(route: string | null, label?: string | null): void {
  const normalized = route
    ? route.startsWith('#')
      ? route
      : route.startsWith('/')
        ? `#${route}`
        : `#/${route}`
    : null;
  pendingRouteTarget = isValidRequestedDestination(normalized) ? normalized : null;
  pendingDeskLabel = label ?? (pendingRouteTarget ? deskLabelForHash(pendingRouteTarget) : null);
  if (typeof window !== 'undefined') {
    try {
      if (pendingRouteTarget) {
        window.sessionStorage.setItem(PENDING_ROUTE_STORAGE_KEY, pendingRouteTarget);
      } else {
        window.sessionStorage.removeItem(PENDING_ROUTE_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }
}

export function consumePendingRoute(): string | null {
  const target = readPendingRoute();
  setPendingRoute(null, null);
  return target;
}

export const SEEKER_EMBLEMS: Array<{ id: SeekerEmblem; label: string; subtitle: string }> = [
  { id: 'rub-el-hizb', label: 'Rub el Hizb', subtitle: 'Eight-pointed Mushaf star' },
  { id: 'crescent-star', label: 'Crescent & Star', subtitle: 'Night Masjid hilal mark' },
  { id: 'octagon-rosette', label: 'Octagon Rosette', subtitle: 'Khatam geometric seal' },
  { id: 'emerald-lamp', label: 'Mihrab Lamp', subtitle: 'Nur illumination emblem' },
];

export function sanitizeSeekerEmblem(value: unknown): SeekerEmblem {
  if (
    value === 'rub-el-hizb' ||
    value === 'crescent-star' ||
    value === 'octagon-rosette' ||
    value === 'emerald-lamp'
  ) {
    return value;
  }
  return 'rub-el-hizb';
}

function decodeTokenUserFallback(token: string): SeekerUser | null {
  const trimmed = token.trim();
  if (!trimmed || trimmed.startsWith('local-token-')) return null;
  const parts = trimmed.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const base64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(base64) : Buffer.from(parts[0], 'base64url').toString('utf8');
    const decoded = JSON.parse(json) as Record<string, unknown>;
    const id = typeof decoded.sub === 'string' ? decoded.sub : '';
    const email = typeof decoded.email === 'string' ? decoded.email : '';
    if (!id || !email) return null;
    const provider: SeekerAuthProvider =
      decoded.provider === 'google' || decoded.provider === 'phone' || decoded.provider === 'username'
        ? decoded.provider
        : 'email';
    const authProvider: SeekerAuthMethod =
      decoded.authProvider === 'google' || decoded.authProvider === 'password'
        ? decoded.authProvider
        : provider === 'google'
          ? 'google'
          : 'password';
    return {
      id,
      email,
      phone: typeof decoded.phone === 'string' ? decoded.phone : null,
      username: typeof decoded.username === 'string' ? decoded.username : undefined,
      name: typeof decoded.name === 'string' && decoded.name ? decoded.name : 'Community Seeker',
      kunyah: typeof decoded.kunyah === 'string' && decoded.kunyah ? decoded.kunyah : 'Seeker of Knowledge',
      bio: typeof decoded.bio === 'string' ? decoded.bio : '',
      emblem: sanitizeSeekerEmblem(decoded.emblem),
      provider,
      authProvider,
      googleSub: typeof decoded.googleSub === 'string' ? decoded.googleSub : null,
      avatarUrl: typeof decoded.avatarUrl === 'string' && decoded.avatarUrl ? decoded.avatarUrl : null,
      verified: decoded.verified !== false,
      createdAt: typeof decoded.createdAt === 'string' ? decoded.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function consumeOAuthHandoffFromLocation(): SeekerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const authError = url.searchParams.get('auth_error');
    if (authError) {
      writeSeekerSession(null);
      return null;
    }
    const handoffToken = url.searchParams.get('dd_seeker_handoff');
    if (!handoffToken) return null;
    const user = decodeTokenUserFallback(handoffToken);
    url.searchParams.delete('dd_seeker_handoff');
    const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', cleanUrl);
    if (user) {
      const session: SeekerSession = { token: handoffToken, user };
      writeSeekerSession(session);
      return session;
    }
    writeSeekerSession(null);
  } catch {
    /* ignore */
  }
  return null;
}

export function readSeekerSession(): SeekerSession | null {
  if (typeof window !== 'undefined') {
    const handoff = consumeOAuthHandoffFromLocation();
    if (handoff) return handoff;
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SeekerSession>;
        if (
          parsed &&
          typeof parsed.token === 'string' &&
          parsed.token.trim() &&
          !parsed.token.startsWith('local-token-') &&
          parsed.user &&
          typeof parsed.user.id === 'string' &&
          parsed.user.id.trim()
        ) {
          const provider: SeekerAuthProvider =
            parsed.user.provider === 'google' || parsed.user.provider === 'phone' || parsed.user.provider === 'username'
              ? parsed.user.provider
              : 'email';
          const authProvider: SeekerAuthMethod =
            parsed.user.authProvider === 'google' || parsed.user.authProvider === 'password'
              ? parsed.user.authProvider
              : provider === 'google'
                ? 'google'
                : 'password';
          return {
            token: parsed.token,
            user: {
              id: parsed.user.id,
              email: parsed.user.email || '',
              phone: parsed.user.phone ?? null,
              username: parsed.user.username,
              name: parsed.user.name || 'Community Seeker',
              handle: parsed.user.handle,
              kunyah: parsed.user.kunyah || 'Seeker of Knowledge',
              bio: parsed.user.bio || '',
              emblem: sanitizeSeekerEmblem(parsed.user.emblem),
              provider,
              authProvider,
              role: parsed.user.role,
              bannerUrl: parsed.user.bannerUrl ?? null,
              googleSub: parsed.user.googleSub ?? null,
              avatarUrl: parsed.user.avatarUrl ?? null,
              verified: parsed.user.verified !== false,
              createdAt: parsed.user.createdAt || new Date().toISOString(),
            },
          };
        }
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
      }
      const tokenOnly = window.localStorage.getItem(SESSION_TOKEN_KEY);
      if (tokenOnly) {
        if (!tokenOnly.startsWith('local-token-')) {
          const decoded = decodeTokenUserFallback(tokenOnly);
          if (decoded) return { token: tokenOnly, user: decoded };
        }
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
      }
    } catch {
      /* ignore */
    }
  }
  if (memorySession?.token?.startsWith('local-token-')) {
    memorySession = null;
  }
  return memorySession;
}

export const getSession = readSeekerSession;

export function writeSeekerSession(session: SeekerSession | null): void {
  memorySession = session;
  if (typeof window !== 'undefined') {
    try {
      if (session) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        window.localStorage.setItem(SESSION_TOKEN_KEY, session.token);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
      }
    } catch {
      /* keep in memory */
    }
    window.dispatchEvent(new Event(SEEKER_AUTH_EVENT));
  }
}

export function readGoogleAuthConfig(): GoogleAuthClientConfig {
  return memoryGoogleConfig;
}

export async function refreshSeekerSessionAndConfig(): Promise<{
  session: SeekerSession | null;
  googleAuth: GoogleAuthClientConfig;
}> {
  const local = readSeekerSession();
  if (typeof fetch !== 'function') {
    return { session: local, googleAuth: memoryGoogleConfig };
  }
  try {
    const headers: Record<string, string> = {};
    if (local?.token) headers.Authorization = `Bearer ${local.token}`;
    const response = await fetch('/api/auth/session', { headers });
    if (response.ok) {
      const body = (await response.json()) as {
        authenticated?: boolean;
        user?: SeekerUser | null;
        googleAuth?: Partial<GoogleAuthClientConfig>;
      };
      if (body.googleAuth) {
        memoryGoogleConfig = {
          enabled: Boolean(body.googleAuth.enabled),
          clientId: body.googleAuth.clientId ?? null,
          hasClientSecret: Boolean(body.googleAuth.hasClientSecret),
          oauthRedirectPath: body.googleAuth.oauthRedirectPath || '/api/auth/google/start',
          callbackPath: body.googleAuth.callbackPath || '/api/auth/google/callback',
          redirectUriOverride: body.googleAuth.redirectUriOverride ?? null,
        };
      }
      if (body.authenticated && body.user && local?.token) {
        const next: SeekerSession = { token: local.token, user: body.user };
        writeSeekerSession(next);
        return { session: next, googleAuth: memoryGoogleConfig };
      }
      if (body.authenticated === false && local) {
        writeSeekerSession(null);
        return { session: null, googleAuth: memoryGoogleConfig };
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SEEKER_AUTH_EVENT));
      }
    }
  } catch {
    /* ignore offline error */
  }
  return { session: local, googleAuth: memoryGoogleConfig };
}

export function openSeekerAuthModal(options?: { targetRoute?: string; deskLabel?: string }): void {
  if (options?.targetRoute) {
    setPendingRoute(options.targetRoute, options.deskLabel ?? deskLabelForHash(options.targetRoute));
  } else if (options?.deskLabel) {
    pendingDeskLabel = options.deskLabel;
  }
  modalRequestedOpen = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SEEKER_MODAL_EVENT));
  }
}

export function closeSeekerAuthModal(): void {
  modalRequestedOpen = false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SEEKER_MODAL_EVENT));
  }
}

export function requestAuthenticatedNavigation(targetHash: string, deskLabel?: string): boolean {
  const session = readSeekerSession();
  const normalized = targetHash.startsWith('#')
    ? targetHash
    : targetHash.startsWith('/')
      ? `#${targetHash}`
      : `#/${targetHash}`;
  if (session?.user || isPublicHomeHash(normalized)) {
    if (typeof window !== 'undefined' && window.location.hash !== normalized) {
      window.location.hash = normalized;
    }
    return true;
  }
  openSeekerAuthModal({
    targetRoute: normalized,
    deskLabel: deskLabel ?? deskLabelForHash(normalized),
  });
  if (typeof window !== 'undefined' && !isPublicHomeHash(window.location.hash)) {
    window.history.replaceState(null, '', '#/hub');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  return false;
}

export async function signInWithGoogleCredential(
  credentialOrToken: string | { credential?: string; accessToken?: string },
  preferredLanguage?: 'en' | 'ta' | 'si',
): Promise<SeekerSession> {
  const payload =
    typeof credentialOrToken === 'string'
      ? { credential: credentialOrToken.trim(), preferredLanguage }
      : {
          credential: credentialOrToken.credential?.trim(),
          accessToken: credentialOrToken.accessToken?.trim(),
          preferredLanguage,
        };
  if (!payload.credential && !payload.accessToken) {
    writeSeekerSession(null);
    throw new Error('Google Sign-In credential is required.');
  }
  if (typeof fetch !== 'function') {
    writeSeekerSession(null);
    throw new Error('Authentication service is unavailable.');
  }
  let response: Response;
  try {
    response = await fetch('/api/auth/google/credential', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    writeSeekerSession(null);
    throw err instanceof Error ? err : new Error('Google Sign-In could not be verified.');
  }
  const body = (await response.json().catch(() => ({}))) as {
    token?: string;
    user?: SeekerUser;
    error?: string;
  };
  if (!response.ok || !body.token || !body.user) {
    writeSeekerSession(null);
    throw new Error(body.error || 'Google Sign-In could not be verified.');
  }
  const session: SeekerSession = { token: body.token, user: body.user };
  writeSeekerSession(session);
  return session;
}

export async function signInWithGoogleAccessToken(
  accessToken: string,
  preferredLanguage?: 'en' | 'ta' | 'si',
): Promise<SeekerSession> {
  return signInWithGoogleCredential({ accessToken }, preferredLanguage);
}

export function buildGoogleOAuthRedirectUrl(returnTo?: string, callbackPath?: string): string {
  const pending = readPendingRoute();
  const target =
    postLoginDestination(pending, returnTo ?? (typeof window !== 'undefined' ? window.location.hash : ''));
  const params = new URLSearchParams({ returnTo: target });
  if (callbackPath) params.set('callbackPath', callbackPath);
  return `/api/auth/google/start?${params.toString()}`;
}

let gisScriptPromise: Promise<boolean> | null = null;

export function ensureGoogleGisLoaded(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve(true);
  }
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise<boolean>(resolve => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      const check = () => {
        if (window.google?.accounts?.id) resolve(true);
      };
      existing.addEventListener('load', () => resolve(Boolean(window.google?.accounts?.id)), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      window.setTimeout(() => {
        check();
        resolve(Boolean(window.google?.accounts?.id));
      }, 2500);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(Boolean(window.google?.accounts?.id));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

export async function loginOrRegisterSeeker(input: {
  mode: 'login' | 'register' | string;
  identifier?: string;
  email?: string;
  phone?: string;
  username?: string;
  password?: string;
  name?: string;
  kunyah?: string;
  bio?: string;
  emblem?: SeekerEmblem;
  provider?: SeekerAuthProvider | string;
  avatarUrl?: string | null;
}): Promise<SeekerSession> {
  if (
    input.mode === 'quick' ||
    input.mode === 'guest' ||
    input.provider === 'guest' ||
    input.provider === 'quick' ||
    input.provider === 'apple'
  ) {
    writeSeekerSession(null);
    throw new Error('Guest and quick sign-in are disabled. Please sign in with your credentials or Google.');
  }
  if (typeof fetch !== 'function') {
    writeSeekerSession(null);
    throw new Error('Authentication service is unavailable.');
  }
  const endpoint = input.mode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const provider = input.provider ?? 'email';
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: input.identifier,
        email: input.email,
        phone: input.phone,
        username: input.username,
        password: input.password,
        name: input.name,
        kunyah: input.kunyah,
        bio: input.bio,
        emblem: input.emblem,
        provider,
        avatarUrl: input.avatarUrl,
      }),
    });
  } catch (err) {
    writeSeekerSession(null);
    throw err instanceof Error ? err : new Error('Authentication failed.');
  }
  const body = (await response.json().catch(() => ({}))) as {
    token?: string;
    user?: SeekerUser;
    error?: string;
  };
  if (!response.ok || !body.token || !body.user) {
    writeSeekerSession(null);
    throw new Error(body.error || 'Authentication failed.');
  }
  const session: SeekerSession = { token: body.token, user: body.user };
  writeSeekerSession(session);
  return session;
}

export async function updateSeekerProfile(input: {
  name: string;
  kunyah: string;
  bio?: string;
  emblem?: SeekerEmblem;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  role?: SeekerRole;
}): Promise<SeekerSession | null> {
  const current = readSeekerSession();
  if (!current) return null;
  if (typeof fetch === 'function') {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${current.token}`,
        },
        body: JSON.stringify(input),
      });
      const body = (await response.json().catch(() => ({}))) as {
        token?: string;
        user?: SeekerUser;
      };
      if (response.ok && body.token && body.user) {
        const updated: SeekerSession = { token: body.token, user: body.user };
        writeSeekerSession(updated);
        return updated;
      }
    } catch {
      /* fall back to local update */
    }
  }
  const updated: SeekerSession = {
    token: current.token,
    user: {
      ...current.user,
      name: input.name.trim() || current.user.name,
      handle: `@${(input.name.trim() || current.user.name).toLowerCase().replace(/[^a-z0-9]+/g, '') || 'seeker'}`,
      kunyah: input.kunyah.trim() || current.user.kunyah,
      bio: input.bio !== undefined ? input.bio.trim() : current.user.bio,
      emblem: input.emblem ? sanitizeSeekerEmblem(input.emblem) : current.user.emblem,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : current.user.avatarUrl,
      bannerUrl: input.bannerUrl !== undefined ? input.bannerUrl : current.user.bannerUrl,
      role: input.role ?? current.user.role,
    },
  };
  writeSeekerSession(updated);
  return updated;
}

export async function signOutSeeker(): Promise<void> {
  const current = readSeekerSession();
  setPendingRoute(null, null);
  writeSeekerSession(null);
  if (typeof window !== 'undefined' && !isPublicHomeHash(window.location.hash)) {
    window.location.hash = '#/hub';
  }
  if (current && typeof fetch === 'function') {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${current.token}` },
      });
    } catch {
      /* ignore */
    }
  }
}

export function useSeekerAuth() {
  const [session, setSession] = useState<SeekerSession | null>(() => readSeekerSession());
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthClientConfig>(() => readGoogleAuthConfig());
  const [modalOpen, setModalOpen] = useState<boolean>(() => modalRequestedOpen);
  const [pendingRoute, setPendingRouteState] = useState<string | null>(() => readPendingRoute());
  const [pendingDesk, setPendingDeskState] = useState<string | null>(() => readPendingDeskLabel());

  useEffect(() => {
    const syncAuth = () => {
      const current = readSeekerSession();
      setSession(current);
      setGoogleAuth(readGoogleAuthConfig());
      if (current?.user) {
        const dest = consumePendingRoute();
        if (typeof window !== 'undefined') {
          if (dest) {
            modalRequestedOpen = false;
            setModalOpen(false);
            setPendingRouteState(null);
            setPendingDeskState(null);
            if (window.location.hash !== dest) {
              window.location.hash = dest;
            }
          } else if (modalRequestedOpen) {
            modalRequestedOpen = false;
            setModalOpen(false);
            window.location.hash = postLoginDestination(null, window.location.hash);
          }
        }
      }
    };
    const syncModal = () => {
      setModalOpen(modalRequestedOpen);
      setPendingRouteState(readPendingRoute());
      setPendingDeskState(readPendingDeskLabel());
    };
    window.addEventListener(SEEKER_AUTH_EVENT, syncAuth);
    window.addEventListener('storage', syncAuth);
    window.addEventListener(SEEKER_MODAL_EVENT, syncModal);

    if (!sessionHydrated) {
      sessionHydrated = true;
      void refreshSeekerSessionAndConfig().then(({ session: s, googleAuth: g }) => {
        setSession(s ?? readSeekerSession());
        setGoogleAuth(g);
      });
    }

    return () => {
      window.removeEventListener(SEEKER_AUTH_EVENT, syncAuth);
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener(SEEKER_MODAL_EVENT, syncModal);
    };
  }, []);

  const openModal = useCallback(
    (options?: { targetRoute?: string; deskLabel?: string }) => openSeekerAuthModal(options),
    [],
  );
  const closeModal = useCallback(() => closeSeekerAuthModal(), []);

  return {
    session,
    user: session?.user ?? null,
    token: session?.token ?? null,
    isAuthenticated: Boolean(session?.user),
    googleAuth,
    modalOpen,
    pendingRoute,
    pendingDesk,
    openModal,
    closeModal,
    loginOrRegister: loginOrRegisterSeeker,
    signInWithGoogleCredential,
    signInWithGoogleAccessToken,
    updateProfile: updateSeekerProfile,
    signOut: signOutSeeker,
  };
}


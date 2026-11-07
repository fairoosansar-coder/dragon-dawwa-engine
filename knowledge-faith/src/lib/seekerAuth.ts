import { useCallback, useEffect, useState } from 'react';

export type SeekerEmblem = 'rub-el-hizb' | 'crescent-star' | 'octagon-rosette' | 'emerald-lamp';
export type SeekerAuthProvider = 'email' | 'google' | 'apple' | 'guest';

export interface SeekerUser {
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

export interface SeekerSession {
  token: string;
  user: SeekerUser;
}

export const SEEKER_AUTH_EVENT = 'kf-seeker-auth-changed';
export const SEEKER_MODAL_EVENT = 'kf-seeker-modal-open';
const SESSION_STORAGE_KEY = 'kf-seeker-session';

let memorySession: SeekerSession | null = null;
let modalRequestedOpen = false;

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

export function readSeekerSession(): SeekerSession | null {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SeekerSession>;
        if (parsed && typeof parsed.token === 'string' && parsed.user && typeof parsed.user.id === 'string') {
          return {
            token: parsed.token,
            user: {
              id: parsed.user.id,
              email: parsed.user.email || '',
              name: parsed.user.name || 'Community Seeker',
              kunyah: parsed.user.kunyah || 'Seeker of Knowledge',
              bio: parsed.user.bio || '',
              emblem: sanitizeSeekerEmblem(parsed.user.emblem),
              provider: parsed.user.provider || 'email',
              verified: parsed.user.verified !== false,
              createdAt: parsed.user.createdAt || new Date().toISOString(),
            },
          };
        }
      }
    } catch {
      /* ignore */
    }
  }
  return memorySession;
}

export function writeSeekerSession(session: SeekerSession | null): void {
  memorySession = session;
  if (typeof window !== 'undefined') {
    try {
      if (session) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      /* keep in memory */
    }
    window.dispatchEvent(new Event(SEEKER_AUTH_EVENT));
  }
}

export function openSeekerAuthModal(): void {
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

function buildLocalFallbackSession(input: {
  email?: string;
  name?: string;
  kunyah?: string;
  bio?: string;
  emblem?: SeekerEmblem;
  provider?: SeekerAuthProvider;
}): SeekerSession {
  const provider = input.provider ?? 'email';
  const email = (input.email ?? '').trim().toLowerCase() || `${provider}.seeker@dragondawwa.com`;
  const defaultName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const name = (input.name ?? '').trim() || defaultName || 'Community Seeker';
  const kunyah = (input.kunyah ?? '').trim() || 'Seeker of Knowledge';
  const bio = (input.bio ?? '').trim();
  const emblem = sanitizeSeekerEmblem(input.emblem);
  const id = `seeker-${email.replace(/[^a-z0-9]/g, '').slice(0, 18) || 'local'}`;
  const user: SeekerUser = {
    id,
    email,
    name,
    kunyah,
    bio,
    emblem,
    provider,
    verified: true,
    createdAt: new Date().toISOString(),
  };
  return { token: `local-token-${id}`, user };
}

export async function loginOrRegisterSeeker(input: {
  mode: 'login' | 'register' | 'quick';
  email?: string;
  password?: string;
  name?: string;
  kunyah?: string;
  bio?: string;
  emblem?: SeekerEmblem;
  provider?: SeekerAuthProvider;
}): Promise<SeekerSession> {
  const endpoint = input.mode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const provider = input.provider ?? 'email';
  if (typeof fetch === 'function') {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          name: input.name,
          kunyah: input.kunyah,
          bio: input.bio,
          emblem: input.emblem,
          provider,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        token?: string;
        user?: SeekerUser;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error || 'Authentication failed.');
      }
      if (body.token && body.user) {
        const session: SeekerSession = { token: body.token, user: body.user };
        writeSeekerSession(session);
        return session;
      }
    } catch (err) {
      if (err instanceof Error && /password|already exists|valid email/i.test(err.message)) {
        throw err;
      }
    }
  }
  const fallback = buildLocalFallbackSession(input);
  writeSeekerSession(fallback);
  return fallback;
}

export async function updateSeekerProfile(input: {
  name: string;
  kunyah: string;
  bio?: string;
  emblem?: SeekerEmblem;
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
      kunyah: input.kunyah.trim() || current.user.kunyah,
      bio: input.bio !== undefined ? input.bio.trim() : current.user.bio,
      emblem: input.emblem ? sanitizeSeekerEmblem(input.emblem) : current.user.emblem,
    },
  };
  writeSeekerSession(updated);
  return updated;
}

export async function signOutSeeker(): Promise<void> {
  const current = readSeekerSession();
  writeSeekerSession(null);
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
  const [modalOpen, setModalOpen] = useState<boolean>(() => modalRequestedOpen);

  useEffect(() => {
    const syncAuth = () => setSession(readSeekerSession());
    const syncModal = () => setModalOpen(modalRequestedOpen);
    window.addEventListener(SEEKER_AUTH_EVENT, syncAuth);
    window.addEventListener('storage', syncAuth);
    window.addEventListener(SEEKER_MODAL_EVENT, syncModal);
    return () => {
      window.removeEventListener(SEEKER_AUTH_EVENT, syncAuth);
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener(SEEKER_MODAL_EVENT, syncModal);
    };
  }, []);

  const openModal = useCallback(() => openSeekerAuthModal(), []);
  const closeModal = useCallback(() => closeSeekerAuthModal(), []);

  return {
    session,
    user: session?.user ?? null,
    token: session?.token ?? null,
    modalOpen,
    openModal,
    closeModal,
    loginOrRegister: loginOrRegisterSeeker,
    updateProfile: updateSeekerProfile,
    signOut: signOutSeeker,
  };
}

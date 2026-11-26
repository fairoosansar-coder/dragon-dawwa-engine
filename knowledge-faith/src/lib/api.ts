import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openSeekerAuthModal,
  readSeekerSession,
  refreshSeekerSessionAndConfig,
  writeSeekerSession,
} from './seekerAuth.ts';

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const session = readSeekerSession();
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }
  return headers;
}

async function readJsonBody(res: Response): Promise<{ error?: string; requiresAuth?: boolean } & Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as { error?: string; requiresAuth?: boolean } & Record<string, unknown>;
}

/** Copy init headers but drop Authorization so a healed Bearer is not concatenated with a stale one. */
function headersForAuthRetry(init?: RequestInit): Record<string, string> {
  const merged: Record<string, string> = {};
  if (init?.headers) {
    for (const [key, value] of new Headers(init.headers).entries()) {
      if (key.toLowerCase() === 'authorization') continue;
      merged[key] = value;
    }
  }
  return authHeaders(merged);
}

/**
 * On 401 requiresAuth: refresh session (cookie may still be valid while Bearer is stale),
 * retry once with the healed token, otherwise clear the ghost UI session and open sign-in.
 */
async function fetchJson<T>(url: string, init: RequestInit, retried = false): Promise<T> {
  const res = await fetch(url, init);
  const body = await readJsonBody(res);
  if (res.status === 401 && body.requiresAuth) {
    if (!retried) {
      const { session } = await refreshSeekerSessionAndConfig();
      if (session?.token) {
        return fetchJson<T>(
          url,
          {
            ...init,
            headers: headersForAuthRetry(init),
          },
          true,
        );
      }
    }
    writeSeekerSession(null);
    openSeekerAuthModal();
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const getJson = <T,>(url: string) => fetchJson<T>(url, { headers: authHeaders() });

export const postJson = <T,>(url: string, body: unknown) =>
  fetchJson<T>(url, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

export interface Remote<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Fetches `url` whenever it changes; a null url leaves the state idle. */
export function useRemote<T>(url: string | null): Remote<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: Boolean(url),
  });
  const [nonce, setNonce] = useState(0);
  const loadedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url) {
      loadedUrlRef.current = null;
      setState({ data: null, error: null, loading: false });
      return;
    }
    let active = true;
    const urlChanged = loadedUrlRef.current !== url;
    loadedUrlRef.current = url;
    // URL change: drop prior payload so a new question/reportId cannot flash the previous dossier.
    // Same-URL reload (job polling): keep prior data so progress UI does not unmount/remount.
    setState(prev => ({
      data: urlChanged ? null : prev.data,
      error: null,
      loading: true,
    }));
    getJson<T>(url)
      .then(data => active && setState({ data, error: null, loading: false }))
      .catch((err: Error) =>
        active &&
        setState(prev => ({
          data: urlChanged ? null : prev.data,
          error: err.message,
          loading: false,
        })),
      );
    return () => {
      active = false;
    };
  }, [url, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  // Effects run after render: do not expose the old language/record even for one paint.
  if (loadedUrlRef.current !== url) return {data:null,error:null,loading:Boolean(url),reload};
  return { ...state, reload };
}

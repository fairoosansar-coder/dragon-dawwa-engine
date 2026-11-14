import { useCallback, useEffect, useState } from 'react';
import { openSeekerAuthModal, readSeekerSession } from './seekerAuth.ts';

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const session = readSeekerSession();
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }
  return headers;
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; requiresAuth?: boolean };
  if (res.status === 401 && body.requiresAuth) {
    openSeekerAuthModal();
  }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const getJson = <T,>(url: string) => fetch(url, { headers: authHeaders() }).then(r => parse<T>(r));

export const postJson = <T,>(url: string, body: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  }).then(r => parse<T>(r));

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

  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let active = true;
    // Drop prior payload immediately so a new question/reportId cannot flash the previous dossier.
    setState({ data: null, error: null, loading: true });
    getJson<T>(url)
      .then(data => active && setState({ data, error: null, loading: false }))
      .catch((err: Error) => active && setState({ data: null, error: err.message, loading: false }));
    return () => {
      active = false;
    };
  }, [url, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  return { ...state, reload };
}

import { useCallback, useEffect, useState } from 'react';

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const getJson = <T,>(url: string) => fetch(url).then(r => parse<T>(r));

export const postJson = <T,>(url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r =>
    parse<T>(r),
  );

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
    setState(s => ({ ...s, error: null, loading: true }));
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

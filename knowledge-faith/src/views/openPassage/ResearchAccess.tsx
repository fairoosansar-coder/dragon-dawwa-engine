import { useEffect, useRef, useState } from 'react';
import {
  ensureGoogleIdentityInitialized,
  signInWithGoogleCredential,
  subscribeGoogleGisCredential,
  writeSeekerSession,
  type SeekerUser,
} from '../../lib/seekerAuth.ts';

/** Same-origin Open Passage API (never hardcode preview ports). */
export const guestBase = '/api/open-passage';
const prefix = 'op-research-v1:';
const temp: Record<string, string> = {};

function storage(key: string): Storage {
  return key === 'guest' || key === 'member' ? localStorage : sessionStorage;
}

export function readAccess(key: string): string {
  try {
    return storage(key).getItem(prefix + key) || temp[key] || '';
  } catch {
    return temp[key] || '';
  }
}

export function writeAccess(key: string, value: string): void {
  temp[key] = value;
  try {
    if (value) storage(key).setItem(prefix + key, value);
    else storage(key).removeItem(prefix + key);
  } catch {
    /* This tab can still complete a question when storage is unavailable. */
  }
}

let opening: Promise<string> | undefined;

export async function researchPass(): Promise<string> {
  const current = readAccess('member') || readAccess('guest');
  if (current) return current;

  async function issue(): Promise<string> {
    const old = readAccess('guest');
    if (old) return old;
    const response = await fetch(`${guestBase}/access`, { method: 'POST' });
    if (!response.ok) throw Error('The free desk is busy. Please try again later.');
    const body = (await response.json()) as { token?: string };
    if (!body.token) throw Error('The free desk is busy. Please try again later.');
    writeAccess('guest', body.token);
    return body.token;
  }

  async function onePass(): Promise<string> {
    return navigator.locks
      ? await navigator.locks.request('op-guest-pass', issue)
      : await issue();
  }

  if (!opening) opening = onePass().finally(() => {
    opening = undefined;
  });
  return opening;
}

export function GoogleGate({ resume }: { resume: () => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const done = useRef(resume);
  done.current = resume;
  const [message, setMessage] = useState('Checking Google sign-in…');

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    (async () => {
      try {
        const response = await fetch(`${guestBase}/google-config`);
        if (!response.ok) throw Error();
        const { clientId } = (await response.json()) as { clientId?: string | null };
        if (!active) return;
        if (!clientId) {
          setMessage(
            'Google sign-in is not yet configured for staging. Your question is kept in this tab; the example and its audio are still available.',
          );
          return;
        }
        unsubscribe = subscribeGoogleGisCredential('open-passage-gate', async credential => {
          if (!active) return;
          setMessage('Verifying your Google sign-in…');
          try {
            const verify = await fetch(`${guestBase}/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            });
            if (!verify.ok) throw Error();
            const body = (await verify.json()) as {
              token?: string;
              seeker?: { token?: string; user?: SeekerUser };
            };
            if (!body.token) throw Error();
            writeAccess('member', body.token);
            // Sync the client seeker session so Read Qur'an / Hadith / Saved work
            // without a full page reload after the research-gate Google sign-in.
            try {
              await signInWithGoogleCredential(credential);
            } catch {
              if (body.seeker?.token && body.seeker.user) {
                writeSeekerSession({ token: body.seeker.token, user: body.seeker.user });
              }
            }
            if (active) done.current();
          } catch {
            if (active) {
              setMessage(
                'Google sign-in could not be verified. Please try again. Your question is still here.',
              );
            }
          }
        });
        if (!(await ensureGoogleIdentityInitialized(clientId)) || !window.google?.accounts?.id || !mount.current) {
          throw Error();
        }
        if (!active) return;
        mount.current.replaceChildren();
        window.google.accounts.id.renderButton(mount.current, {
          type: 'standard',
          text: 'continue_with',
          theme: 'outline',
          size: 'large',
        });
        setMessage('');
      } catch {
        if (active) {
          setMessage(
            'Google sign-in could not load. Your question is kept in this tab. Please reload to try again.',
          );
        }
      }
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="op-listen">
      <p className="op-kicker">Free research access</p>
      <h3>Continue with Google</h3>
      <p>
        You’ve used your guest question. Sign in to research more questions. Open Passage is still
        free.
      </p>
      <div ref={mount} />
      <p role="status">{message}</p>
    </div>
  );
}

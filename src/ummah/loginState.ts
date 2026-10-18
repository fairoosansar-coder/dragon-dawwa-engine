export type LoginRoute = 'screen-2' | string;

export interface LoginResponse {
  status: number;
  json: () => Promise<unknown>;
}

export interface LoginRequestOptions { signal?: AbortSignal }

export type LoginRequest = (path: '/api/social/config' | '/api/review/session' | '/api/social/me', options?: LoginRequestOptions) => Promise<LoginResponse>;

export interface LoadLoginStateOptions {
  /** Tests may reduce this; production readiness checks never wait longer than 12 seconds. */
  budgetMs?: number;
  /** A replacement check or component unmount may stop this check before its deadline. */
  signal?: AbortSignal;
}

export const LOGIN_READINESS_BUDGET_MS = 12_000;

export type LoginState =
  | { kind: 'loading' }
  | { kind: 'unconfigured' }
  | { kind: 'configured-anonymous'; loginPath: '/auth/login' }
  | { kind: 'authenticated-unmapped-or-forbidden' }
  | { kind: 'mapped-member'; name: string; canReview: boolean; canSubmit: boolean }
  | { kind: 'temporary-error'; stage: 'config' | 'session' | 'member' };

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** The public configuration may enable login; it never establishes a user or a community membership. */
export function trustedLoginPath(config: unknown): '/auth/login' | null {
  if (!isRecord(config) || config.reviewEnabled !== true) return null;
  return config.loginPath === '/auth/login' ? '/auth/login' : null;
}

/** Hash routes always win; the short `/login` entry route opens the sign-in screen when no hash was supplied. */
export function routeFromLocation(pathname: string, hash: string, routeFromHash: (hash: string) => string): LoginRoute {
  if (hash) return routeFromHash(hash);
  return /^\/login\/?$/.test(pathname) ? 'screen-2' : routeFromHash(hash);
}

function memberProjection(value: unknown) {
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || Number(value.id) < 1 ||
      value.reviewEnabled !== true || typeof value.canReview !== 'boolean' || typeof value.canSubmit !== 'boolean') return null;
  return {
    // This display name comes only from the server's `/api/social/me` projection.
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 250) : 'Community member',
    canReview: value.canReview === true,
    canSubmit: value.canSubmit === true,
  };
}

function validSession(value: unknown) {
  return isRecord(value) && isRecord(value.user) && typeof value.user.id === 'string' && value.user.id.length > 0;
}

interface LoginDeadline {
  signal: AbortSignal;
  race<T>(operation: Promise<T>): Promise<T>;
  close(): void;
}

function readinessBudget(options?: LoadLoginStateOptions) {
  return typeof options?.budgetMs === 'number' && Number.isFinite(options.budgetMs) && options.budgetMs > 0
    ? Math.min(options.budgetMs, LOGIN_READINESS_BUDGET_MS) : LOGIN_READINESS_BUDGET_MS;
}

/** A single deadline spans every endpoint and its JSON body, even for requests that ignore abort. */
function loginDeadline(options?: LoadLoginStateOptions): LoginDeadline {
  const controller = new AbortController();
  let settled = false;
  let rejectDeadline: (reason?: unknown) => void = () => {};
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
  const stop = () => {
    if (settled) return;
    settled = true;
    controller.abort();
    rejectDeadline(new Error('Authentication readiness check timed out or was cancelled.'));
  };
  const timeout = setTimeout(stop, readinessBudget(options));
  let removeCancellationListener = () => {};
  if (options?.signal) {
    if (options.signal.aborted) stop();
    else {
      options.signal.addEventListener('abort', stop, { once: true });
      removeCancellationListener = () => options.signal?.removeEventListener('abort', stop);
    }
  }
  return {
    signal: controller.signal,
    race: <T>(operation: Promise<T>) => Promise.race([operation, deadline]),
    close: () => { clearTimeout(timeout); removeCancellationListener(); },
  };
}

async function json(deadline: LoginDeadline, response: LoginResponse): Promise<unknown | null> {
  try { return await deadline.race(response.json()); } catch { return null; }
}

/**
 * Build a UI state from endpoint status and JSON only. It never reads browser IDs, roles,
 * storage, or tokens. A successful public config merely authorizes showing the safe login link.
 */
export async function loadLoginState(request: LoginRequest, options?: LoadLoginStateOptions): Promise<LoginState> {
  const deadline = loginDeadline(options);
  try {
  let configResponse: LoginResponse;
  try { configResponse = await deadline.race(request('/api/social/config', { signal: deadline.signal })); } catch { return { kind: 'temporary-error', stage: 'config' }; }
  const config = await json(deadline, configResponse);
  if (configResponse.status !== 200 || !isRecord(config)) return { kind: 'temporary-error', stage: 'config' };
  if (config.reviewEnabled !== true) return { kind: 'unconfigured' };
  const loginPath = trustedLoginPath(config);
  if (!loginPath) return { kind: 'temporary-error', stage: 'config' };

  let sessionResponse: LoginResponse;
  try { sessionResponse = await deadline.race(request('/api/review/session', { signal: deadline.signal })); } catch { return { kind: 'temporary-error', stage: 'session' }; }
  if (sessionResponse.status === 401) return { kind: 'configured-anonymous', loginPath };
  if (sessionResponse.status === 403) return { kind: 'authenticated-unmapped-or-forbidden' };
  const session = await json(deadline, sessionResponse);
  if (sessionResponse.status !== 200 || !validSession(session)) return { kind: 'temporary-error', stage: 'session' };

  let memberResponse: LoginResponse;
  try { memberResponse = await deadline.race(request('/api/social/me', { signal: deadline.signal })); } catch { return { kind: 'temporary-error', stage: 'member' }; }
  if ([401, 403].includes(memberResponse.status)) return { kind: 'authenticated-unmapped-or-forbidden' };
  const member = await json(deadline, memberResponse);
  const projection = memberProjection(member);
  if (memberResponse.status !== 200 || !projection) return { kind: 'temporary-error', stage: 'member' };
  return { kind: 'mapped-member', ...projection };
  } finally { deadline.close(); }
}

/** Fetch POST retains a first-party Origin; a session recheck verifies logout before changing the view. */
export async function signOutCurrentSession(fetcher: typeof fetch = fetch): Promise<void> {
  const response = await fetcher('/auth/logout', {method:'POST',credentials:'same-origin',redirect:'manual',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:''});
  if (response.type !== 'opaqueredirect' && !response.ok) throw new Error('Sign-out could not be verified. Please retry.');
  const session = await fetcher('/api/review/session', {credentials:'same-origin',redirect:'error',headers:{Accept:'application/json'}});
  if (session.status !== 401) throw new Error('Sign-out could not be verified. Please retry.');
}

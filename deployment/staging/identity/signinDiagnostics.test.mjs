import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosedGoogleAuthResponse } from './signinDiagnostics.mjs';
import { googleSubjectId } from './vendor/google-auth.mjs';

const ORIGIN = 'https://signin-diagnostics.synthetic.railway.app';
const NOW = 1_700_000_000_000;
const STATE = 's'.repeat(32);
const NONCE = 'n'.repeat(32);
const VERIFIER = 'v'.repeat(43);
const SUBJECT = 'synthetic-google-subject';
const EMAIL = 'synthetic.person@example.invalid';
const ROLE_LOOKUP = 'SELECT role,disabled FROM review_roles WHERE user_id=?';
const baseEnv = Object.freeze({
  UMMAH_IDENTITY_ENVIRONMENT: 'synthetic-staging',
  REVIEW_PUBLIC_ORIGIN: ORIGIN,
  AUTH_PROVIDER: 'google-oidc',
  RAILWAY_PROJECT_ID: '48d7a4cf-07dc-489b-8a3d-d6d10142b14e',
  RAILWAY_ENVIRONMENT_ID: '1f7d98bf-1d49-4d9f-a5cc-13b57abcc095',
  REVIEW_DB_TRANSPORT: 'railway-internal-wireguard',
  REVIEW_DB_ROLE: 'app',
  REVIEW_BIND_HOST: '0.0.0.0',
  GOOGLE_OIDC_ISSUER: 'https://accounts.google.com',
  GOOGLE_OIDC_CLIENT_ID: 'synthetic-signin-diagnostics-client',
  GOOGLE_OIDC_CLIENT_SECRET: 'synthetic-signin-diagnostics-client-secret',
  REVIEW_APP_ID: 'synthetic-signin-diagnostics-app',
  REVIEW_SESSION_SECRET: 'synthetic-session-secret-0123456789abcdef',
  DD_DELETION_AUDIT_SECRET: 'synthetic-deletion-secret-0123456789abcdef',
  STUDY_USAGE_SECRET: 'synthetic-usage-secret-0123456789abcdef',
  QURAN_ENVIRONMENT: 'production',
  DD_PUBLIC_READ_MODE: 'private',
});

function env(extra = {}) { return { ...baseEnv, ...extra }; }
function claims(overrides = {}) {
  return {
    iss: 'https://accounts.google.com', sub: SUBJECT, email_verified: true,
    email: EMAIL, name: 'Synthetic Person', ...overrides,
  };
}
function oidcLibrary({ discovery = async () => ({ synthetic: true }), grant } = {}) {
  return {
    customFetch: Symbol('synthetic-fetch'),
    enableNonRepudiationChecks() {},
    randomState: () => STATE,
    randomNonce: () => NONCE,
    randomPKCECodeVerifier: () => VERIFIER,
    calculatePKCECodeChallenge: async () => 'c'.repeat(43),
    discovery,
    buildAuthorizationUrl: () => new URL('https://accounts.google.com/o/oauth2/v2/auth?synthetic=1'),
    authorizationCodeGrant: grant || (async () => ({ claims: () => claims() })),
  };
}
function loginRequest(environment = env()) { return new Request(`${environment.REVIEW_PUBLIC_ORIGIN}/auth/login`); }
function options(extra = {}) { return { now: () => NOW, discover: async () => ({ synthetic: true }), ...extra }; }
function recorder() {
  const events = [];
  return { events, onFailure: value => events.push(value) };
}
function assertReference(response, event, { clearFlow = false } = {}) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const reference = response.headers.get('x-ummah-auth-reference');
  assert.match(reference || '', /^uc-auth-[0-9a-f]{16}$/);
  assert.equal(event.reference, reference);
  assert.deepEqual(Object.keys(event).sort(), ['event', 'reference', 'stage']);
  assert.equal(event.event, 'ummah_staging_signin_unavailable');
  if (clearFlow) {
    const cookies = response.headers.getSetCookie();
    assert.equal(cookies.length, 1);
    assert.match(cookies[0], /^__Host-dd_oidc_flow=; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=0$/);
  }
  return response.text().then(body => {
    assert.equal(body, `Sign-in is temporarily unavailable.\nReference: ${reference}`);
  });
}
async function callbackRequest({ library = oidcLibrary(), environment = env(), loginOptions = options() } = {}) {
  const login = await diagnosedGoogleAuthResponse(loginRequest(environment), environment, { library, ...loginOptions });
  assert.equal(login.status, 302);
  const flow = login.headers.getSetCookie().find(value => value.startsWith('__Host-dd_oidc_flow='));
  assert.ok(flow, 'the actual authority must issue a sealed flow cookie');
  return new Request(`${environment.REVIEW_PUBLIC_ORIGIN}/auth/callback?state=${STATE}&code=synthetic-code`, {
    headers: { Cookie: flow.split(';', 1)[0] },
  });
}
function roleDb(row, observe = () => {}) {
  return {
    prepare(sql) {
      assert.equal(sql, ROLE_LOOKUP);
      return { bind(subject) { observe(subject); return { first: async () => row }; } };
    },
  };
}

test('library discovery rejection is labeled login_discovery', async () => {
  const log = recorder();
  const hostile = new Error('synthetic discovery token cookie query must stay private');
  const response = await diagnosedGoogleAuthResponse(loginRequest(), env(), {
    library: oidcLibrary({ discovery: async () => { throw hostile; } }),
    now: () => NOW, onFailure: log.onFailure,
  });
  assert.equal(log.events.length, 1);
  assert.equal(log.events[0].stage, 'login_discovery');
  await assertReference(response, log.events[0]);
});

test('injected callback discovery rejection is safely labeled callback_discovery', async () => {
  const library = oidcLibrary();
  const request = await callbackRequest({ library });
  const log = recorder();
  const response = await diagnosedGoogleAuthResponse(request, env(), {
    library, now: () => NOW, db: roleDb({ role: 'author', disabled: 0 }),
    discover: async () => { throw new Error('synthetic discovery failure'); }, onFailure: log.onFailure,
  });
  assert.equal(log.events.length, 1);
  assert.equal(log.events[0].stage, 'callback_discovery');
  await assertReference(response, log.events[0], { clearFlow: true });
});

test('authorization-code grant rejection preserves flow clearing and adds a reference', async () => {
  const library = oidcLibrary({ grant: async () => { throw new Error('synthetic grant failure'); } });
  const request = await callbackRequest({ library });
  const log = recorder();
  const response = await diagnosedGoogleAuthResponse(request, env(), {
    library, db: roleDb({ role: 'author', disabled: 0 }), ...options(), onFailure: log.onFailure,
  });
  assert.equal(log.events.length, 1);
  assert.equal(log.events[0].stage, 'callback_tokens');
  await assertReference(response, log.events[0], { clearFlow: true });
});

test('role-store rejection is labeled without logging SQL or bound values', async () => {
  const library = oidcLibrary();
  const request = await callbackRequest({ library });
  const log = recorder();
  const response = await diagnosedGoogleAuthResponse(request, env(), {
    library, ...options(), onFailure: log.onFailure,
    db: { prepare() { throw new Error('synthetic role-store failure'); } },
  });
  assert.equal(log.events.length, 1);
  assert.equal(log.events[0].stage, 'callback_role_store');
  await assertReference(response, log.events[0], { clearFlow: true });
});

test('a post-lookup issuance failure is labeled callback_session_issue', async () => {
  const library = oidcLibrary();
  const request = await callbackRequest({ library });
  const log = recorder();
  let calls = 0;
  const response = await diagnosedGoogleAuthResponse(request, env(), {
    library, db: roleDb({ role: 'author', disabled: 0 }), onFailure: log.onFailure,
    discover: async () => ({ synthetic: true }), now: () => (++calls === 1 ? NOW : -1),
  });
  assert.equal(log.events.length, 1);
  assert.equal(log.events[0].stage, 'callback_session_issue');
  await assertReference(response, log.events[0], { clearFlow: true });
});

test('missing database fails closed with an unknown stage and cleared flow', async () => {
  const library = oidcLibrary();
  const request = await callbackRequest({ library });
  const log = recorder();
  const response = await diagnosedGoogleAuthResponse(request, env(), {
    library, ...options(), onFailure: log.onFailure,
  });
  assert.equal(log.events.length, 1);
  assert.equal(log.events[0].stage, 'unknown');
  await assertReference(response, log.events[0], { clearFlow: true });
});

test('an unknown verified synthetic subject receives 403 without a session and is bound by subject, not email', async () => {
  const library = oidcLibrary();
  const request = await callbackRequest({ library });
  let bound;
  const log = recorder();
  const response = await diagnosedGoogleAuthResponse(request, env(), {
    library, ...options(), db: roleDb(null, value => { bound = value; }), onFailure: log.onFailure,
  });
  assert.equal(response.status, 403);
  assert.equal(log.events.length, 0);
  assert.equal(bound, googleSubjectId(SUBJECT));
  assert.notEqual(bound, EMAIL);
  assert.equal(response.headers.get('x-ummah-auth-reference'), null);
  assert.equal(response.headers.getSetCookie().some(value => value.startsWith('webdev_app_session=')), false);
  assert.equal(response.headers.getSetCookie().length, 1);
  assert.equal((await response.text()).includes(EMAIL), false);
});

test('a disabled role is denied with its unchanged invitation response', async () => {
  const library = oidcLibrary();
  const request = await callbackRequest({ library });
  const log = recorder();
  const response = await diagnosedGoogleAuthResponse(request, env(), {
    library, ...options(), db: roleDb({ role: 'reviewer', disabled: 1 }), onFailure: log.onFailure,
  });
  assert.equal(response.status, 403);
  assert.equal(log.events.length, 0);
  assert.equal(response.headers.get('x-ummah-auth-reference'), null);
  assert.equal(response.headers.getSetCookie().some(value => value.startsWith('webdev_app_session=')), false);
});

for (const role of ['author', 'reviewer']) test(`an authorized ${role} receives the unchanged secure session redirect`, async () => {
  const library = oidcLibrary();
  const request = await callbackRequest({ library });
  const log = recorder();
  const response = await diagnosedGoogleAuthResponse(request, env(), {
    library, ...options(), db: roleDb({ role, disabled: 0 }), onFailure: log.onFailure,
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-ummah-auth-reference'), null);
  assert.equal(log.events.length, 0);
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  const session = cookies.find(value => value.startsWith('webdev_app_session='));
  assert.match(session || '', /^webdev_app_session=[^;]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800$/);
  const token = session.split(';', 1)[0].slice('webdev_app_session='.length);
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(payload.openId, googleSubjectId(SUBJECT));
  assert.equal(payload.appId, baseEnv.REVIEW_APP_ID);
});

test('a throwing failure logger cannot change the generic failure response or grant access', async () => {
  const library = oidcLibrary({ grant: async () => { throw new Error('synthetic grant failure'); } });
  const request = await callbackRequest({ library });
  const response = await diagnosedGoogleAuthResponse(request, env(), {
    library, ...options(), db: roleDb({ role: 'author', disabled: 0 }),
    onFailure: () => { throw new Error('synthetic logger failure'); },
  });
  assert.equal(response.status, 503);
  assert.match(response.headers.get('x-ummah-auth-reference') || '', /^uc-auth-[0-9a-f]{16}$/);
  assert.equal(response.headers.getSetCookie().some(value => value.startsWith('webdev_app_session=')), false);
});

test('hostile dependency errors never appear in body or structured private log', async () => {
  const library = oidcLibrary({ grant: async () => {
    const error = new Error('hostile-cookie=synthetic-secret&code=synthetic-code&email=' + EMAIL);
    error.code = 'hostile-code';
    throw error;
  } });
  const request = await callbackRequest({ library });
  const log = recorder();
  const response = await diagnosedGoogleAuthResponse(request, env(), {
    library, ...options(), db: roleDb({ role: 'author', disabled: 0 }), onFailure: log.onFailure,
  });
  const body = await response.text();
  assert.equal(body.includes('hostile-cookie'), false);
  assert.equal(body.includes(EMAIL), false);
  assert.equal(JSON.stringify(log.events[0]).includes('hostile'), false);
  assert.equal(log.events[0].stage, 'callback_tokens');
});

test('bad-origin and configuration 503 responses are not mislabeled', async () => {
  const log = recorder();
  const library = oidcLibrary();
  const badOrigin = await diagnosedGoogleAuthResponse(new Request('https://untrusted.synthetic.invalid/auth/login'), env(), {
    library, ...options(), onFailure: log.onFailure,
  });
  assert.equal(badOrigin.status, 403);
  assert.equal(await badOrigin.text(), 'Request denied.');
  assert.equal(badOrigin.headers.get('x-ummah-auth-reference'), null);
  const unconfigured = await diagnosedGoogleAuthResponse(loginRequest(), env({ AUTH_PROVIDER: 'synthetic-invalid' }), {
    library, ...options(), onFailure: log.onFailure,
  });
  assert.equal(unconfigured.status, 503);
  assert.equal(await unconfigured.text(), 'Sign-in is not configured.');
  assert.equal(unconfigured.headers.get('x-ummah-auth-reference'), null);
  assert.equal(log.events.length, 0);
});

test('explicit non-Google authorization redirect remains unavailable without a diagnostic reference', async () => {
  const log = recorder();
  const library = { ...oidcLibrary(), buildAuthorizationUrl: () => new URL('https://wrong.synthetic.invalid/auth') };
  const response = await diagnosedGoogleAuthResponse(loginRequest(), env(), { library, ...options(), onFailure: log.onFailure });
  assert.equal(response.status, 503);
  assert.equal(await response.text(), 'Sign-in is unavailable.');
  assert.equal(response.headers.get('x-ummah-auth-reference'), null);
  assert.equal(log.events.length, 0);
});

test('invalid flow and unverified claims retain their original denials with no session', async () => {
  const log = recorder();
  const badFlow = await diagnosedGoogleAuthResponse(new Request(ORIGIN + '/auth/callback?state=invalid&code=invalid'), env(), { library: oidcLibrary(), ...options(), onFailure: log.onFailure });
  assert.equal(badFlow.status, 400);
  assert.equal(await badFlow.text(), 'Sign-in could not be verified. Please try again.');
  const library = oidcLibrary({ grant: async () => ({ claims: () => claims({ email_verified: false }) }) });
  const request = await callbackRequest({ library });
  const badClaims = await diagnosedGoogleAuthResponse(request, env(), { library, ...options(), db: { prepare() { assert.fail('unverified claims must never reach role lookup'); } }, onFailure: log.onFailure });
  assert.equal(badClaims.status, 401);
  assert.equal(await badClaims.text(), 'Identity could not be verified.');
  assert.equal(badClaims.headers.getSetCookie().some(c => c.startsWith('webdev_app_session=')), false);
  assert.equal(log.events.length, 0);
});

test('wrapper preserves the original client discovery cache instead of rediscovering each login', async () => {
  let calls = 0;
  const environment = env({ GOOGLE_OIDC_CLIENT_ID: 'synthetic-cache-preservation-client' });
  const library = oidcLibrary({ discovery: async () => { calls += 1; return { synthetic: true }; } });
  for (let i = 0; i < 2; i++) {
    const response = await diagnosedGoogleAuthResponse(loginRequest(environment), environment, { library, now: () => NOW, onFailure: () => assert.fail('no outage should be reported') });
    assert.equal(response.status, 302);
  }
  assert.equal(calls, 1);
});

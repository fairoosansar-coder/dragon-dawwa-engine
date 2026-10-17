import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type RequestListener } from 'node:http';
import { once } from 'node:events';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchPrivateIdentity } from '../src/server/privateIdentityTransport.ts';
import { configuredStagingAuthMiddleware } from '../src/server/stagingAuth.ts';
import { configuredStagingSocialMiddleware } from '../src/server/socialIdentity.ts';

const loopback = 'http://127.0.0.1:3001';
const canonicalHost = 'stage.test';
const privateHeaders = { Host: canonicalHost, Accept: 'application/json' };

async function privateServer(t: test.TestContext, handler: RequestListener) {
  const server = createServer(handler);
  server.listen(3001, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => {
    server.closeAllConnections();
    server.close(() => resolve());
  }));
  return server;
}

function unavailable(error: unknown) {
  assert.ok(error instanceof Error);
  assert.equal(error.message, 'Private identity request unavailable.');
  assert.doesNotMatch(error.message, /secret|token|cookie/i);
  return true;
}

test('native loopback fetch drops a custom Host while the private HTTP transport preserves it', async t => {
  const hosts: string[] = [];
  await privateServer(t, (req, res) => {
    hosts.push(req.headers.host || '');
    res.end('ok');
  });

  await fetch(`${loopback}/auth/login`, { headers: { Host: canonicalHost } });
  await fetchPrivateIdentity(`${loopback}/auth/login`, { headers: privateHeaders });

  assert.deepEqual(hosts, ['127.0.0.1:3001', canonicalHost]);
});

test('private identity accepts only the loopback allowlist, safe headers, GET, and logout POST bodies up to 2048 bytes', async () => {
  await assert.rejects(fetchPrivateIdentity('http://localhost:3001/auth/login', { headers: privateHeaders }), unavailable);
  await assert.rejects(fetchPrivateIdentity('http://127.1:3001/auth/login', { headers: privateHeaders }), unavailable);
  await assert.rejects(fetchPrivateIdentity(`${loopback}/auth/login#secret`, { headers: privateHeaders }), unavailable);
  await assert.rejects(fetchPrivateIdentity(`http://user:secret@127.0.0.1:3001/auth/login`, { headers: privateHeaders }), unavailable);
  await assert.rejects(fetchPrivateIdentity(`${loopback}/api/admin`, { headers: privateHeaders }), unavailable);
  await assert.rejects(fetchPrivateIdentity(`${loopback}/auth/login`, { method: 'POST', headers: privateHeaders }), unavailable);
  await assert.rejects(fetchPrivateIdentity(`${loopback}/auth/logout`, { method: 'POST', headers: privateHeaders, body: Buffer.alloc(2049) }), unavailable);
  await assert.rejects(fetchPrivateIdentity(`${loopback}/auth/logout`, { headers: { ...privateHeaders, Authorization: 'Bearer secret-token' } }), unavailable);
  await assert.rejects(fetchPrivateIdentity(`${loopback}/auth/logout`, { headers: { ...privateHeaders, Host: 'stage.test\r\nX-Leak: secret-token' } }), unavailable);
  await assert.rejects(fetchPrivateIdentity(`${loopback}/auth/logout`, { method: 'GET', headers: privateHeaders, body: 'x' }), unavailable);
});

test('private transport preserves raw multiple Set-Cookie values and never follows redirects', async t => {
  let followed = 0;
  await privateServer(t, (req, res) => {
    if (req.url === '/api/review/session') {
      followed += 1;
      res.end('followed');
      return;
    }
    res.writeHead(302, {
      Location: `${loopback}/api/review/session`,
      'Set-Cookie': ['webdev_app_session=synthetic; Path=/; HttpOnly', '__Host-dd_oidc_flow=synthetic; Path=/; HttpOnly'],
    });
    res.end();
  });

  const manual = await fetchPrivateIdentity(`${loopback}/auth/login`, { headers: privateHeaders, redirect: 'manual' });
  assert.equal(manual.status, 302);
  assert.deepEqual(manual.headers.getSetCookie(), [
    'webdev_app_session=synthetic; Path=/; HttpOnly',
    '__Host-dd_oidc_flow=synthetic; Path=/; HttpOnly',
  ]);
  const requestedFollow = await fetchPrivateIdentity(`${loopback}/auth/login`, { headers: privateHeaders, redirect: 'follow' });
  assert.equal(requestedFollow.status, 302);
  await assert.rejects(fetchPrivateIdentity(`${loopback}/auth/login`, { headers: privateHeaders, redirect: 'error' }), unavailable);
  assert.equal(followed, 0);
});

test('private transport bounds response bytes and honours AbortSignal without exposing server data', async t => {
  await privateServer(t, (req, res) => {
    if (req.url === '/api/review/session') {
      res.end(Buffer.alloc(64001, 0x61));
      return;
    }
    setTimeout(() => {
      if (!res.destroyed) res.end('delayed private-secret-token');
    }, 100);
  });

  await assert.rejects(fetchPrivateIdentity(`${loopback}/api/review/session`, { headers: privateHeaders }), unavailable);
  await assert.rejects(fetchPrivateIdentity(`${loopback}/auth/callback`, {
    headers: privateHeaders,
    signal: AbortSignal.timeout(20),
  }), unavailable);
});

test('staging auth proxy receives a corrected canonical-host login hop with redirect and all cookies intact', async t => {
  let receivedHost = '';
  let receivedCookie = '';
  await privateServer(t, (req, res) => {
    receivedHost = req.headers.host || '';
    receivedCookie = req.headers.cookie || '';
    res.writeHead(302, {
      Location: 'https://accounts.google.com/o/oauth2/auth?state=synthetic',
      'Set-Cookie': [
        '__Host-dd_oidc_flow=synthetic; Path=/; HttpOnly; Secure; SameSite=Lax',
        'webdev_app_session=synthetic; Path=/; HttpOnly; Secure; SameSite=Lax',
      ],
    });
    res.end();
  });
  const env = {
    UMMAH_SOCIAL_ENVIRONMENT: 'isolated-staging',
    UMMAH_PUBLIC_ORIGIN: 'https://stage.test',
    UMMAH_IDENTITY_ORIGIN: loopback,
    UMMAH_IDENTITY_ENVIRONMENT: 'isolated-staging',
  } as any;
  let status = 200;
  let body = '';
  const headers: Record<string, unknown> = {};
  await configuredStagingAuthMiddleware(env)({
    url: '/auth/login', method: 'GET',
    headers: { host: canonicalHost, cookie: 'unrelated=secret; webdev_app_session=signed; __Host-dd_oidc_flow=flow' },
  } as any, {
    setHeader(name: string, value: unknown) { headers[name] = value; },
    set statusCode(value: number) { status = value; },
    end(value?: Buffer) { body = value?.toString() || ''; },
  } as any, () => assert.fail('auth route should be handled'));

  assert.equal(receivedHost, canonicalHost);
  assert.doesNotMatch(receivedCookie, /unrelated|secret/);
  assert.equal(status, 302);
  assert.equal(headers.Location, 'https://accounts.google.com/o/oauth2/auth?state=synthetic');
  assert.deepEqual(headers['Set-Cookie'], [
    '__Host-dd_oidc_flow=synthetic; Path=/; HttpOnly; Secure; SameSite=Lax',
    'webdev_app_session=synthetic; Path=/; HttpOnly; Secure; SameSite=Lax',
  ]);
  assert.equal(body, '');
});

test('staging social session resolution uses the corrected private hop with a protected synthetic account map', async t => {
  let identityHost = '';
  let identityCookie = '';
  let providerAuthorization = '';
  await privateServer(t, (req, res) => {
    if (req.url === '/api/review/session') {
      identityHost = req.headers.host || '';
      identityCookie = req.headers.cookie || '';
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ user: { id: 'synthetic-user', role: 'author' } }));
      return;
    }
    if (req.url === '/api/v1/auth/current') {
      providerAuthorization = req.headers.authorization || '';
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ id: 7, display_name: 'Synthetic User' }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  const directory = await mkdtemp(join(tmpdir(), 'private-identity-'));
  const map = join(directory, 'accounts.json');
  await writeFile(map, JSON.stringify({ schemaVersion: 1, accounts: {
    'synthetic-user': { humhubUserId: 7, token: 'synthetic-provider-token' },
  } }), { mode: 0o600 });
  await chmod(map, 0o600);
  t.after(() => rm(directory, { recursive: true, force: true }));

  let middleware: ReturnType<typeof configuredStagingSocialMiddleware>;
  const app = createServer((req, res) => {
    Promise.resolve(middleware(req, res, () => { res.statusCode = 404; res.end(); }))
      .catch(() => { res.statusCode = 500; res.end(); });
  });
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  t.after(() => new Promise<void>(resolve => {
    app.closeAllConnections();
    app.close(() => resolve());
  }));
  const publicOrigin = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  middleware = configuredStagingSocialMiddleware({
    UMMAH_SOCIAL_ENVIRONMENT: 'isolated-staging',
    UMMAH_PUBLIC_ORIGIN: publicOrigin,
    UMMAH_IDENTITY_ORIGIN: loopback,
    UMMAH_IDENTITY_ENVIRONMENT: 'isolated-staging',
    HUMHUB_ORIGIN: loopback,
    UMMAH_ACCOUNT_MAP_FILE: map,
  } as any);

  const response = await fetch(`${publicOrigin}/api/social/me`, { headers: { Cookie: 'webdev_app_session=synthetic-signed-session' } });
  assert.equal(response.status, 200);
  const data = await response.json() as any;
  assert.equal(data.id, 7);
  assert.equal(data.name, 'Synthetic User');
  assert.equal(identityHost, new URL(publicOrigin).host);
  assert.equal(identityCookie, 'webdev_app_session=synthetic-signed-session');
  assert.equal(providerAuthorization, 'Bearer synthetic-provider-token');
});

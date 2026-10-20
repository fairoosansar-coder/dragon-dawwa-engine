// Controlled app-route contract tests only. They do not perform OIDC, hosted login, or device acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

async function withApp(handler: (base: string) => Promise<void>) {
  const app = express();
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'online', engine: 'Dragon Dawwa v2.5 with Gemini TTS', hasKey: false });
  });
  app.get('/healthz', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ status: 'ok', service: 'ummahconnect-app' });
  });
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'not_found' });
    }
    res.status(200).type('html').send('<!doctype html><title>shell</title>');
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await handler(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test('healthz returns a minimal JSON ok probe', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/healthz`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { status: 'ok', service: 'ummahconnect-app' });
  });
});

test('unknown API and auth paths return JSON 404 instead of the SPA shell', async () => {
  await withApp(async (base) => {
    for (const path of ['/api/does-not-exist', '/auth/does-not-exist']) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 404);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { error: 'not_found' });
    }
  });
});

test('ordinary app routes still serve the SPA shell', async () => {
  await withApp(async (base) => {
    const response = await fetch(`${base}/login`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<!doctype html>/i);
  });
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { studioRouter } from '../src/server/studio/routes.ts';
import { parseEditorAccounts } from '../src/server/spiritual/editorialStore.ts';

const token = 'test-editor-token-with-24-characters';

test('Studio control plane rejects anonymous, invalid and unconfigured access; public catalogue stays open', async () => {
  for (const configured of [false, true]) {
    const accounts = configured ? parseEditorAccounts(JSON.stringify([{ id: 'editor', name: 'Editor', roles: ['author'], token }])) : [];
    const app = express();
    app.use(express.json());
    app.use(studioRouter({ accounts, aiLimiter: (_req, _res, next) => next() }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}`;
    try {
      for (const authorization of ['', 'Bearer invalid']) {
        for (const [method, path] of [['POST', '/pipeline/run'], ['GET', '/productions'], ['PATCH', '/productions/test/script'], ['POST', '/productions/test/transition']]) {
          const res = await fetch(`${base}/api/studio${path}`, { method, headers: { authorization } });
          assert.equal(res.status, configured ? 401 : 503, `${method} ${path}`);
          assert.equal(res.headers.get('cache-control'), 'no-store');
          await res.text();
        }
      }
      const catalogue = await fetch(`${base}/api/studio/catalogue`);
      assert.equal(catalogue.status, 200);
      await catalogue.text();
      if (configured) {
        const res = await fetch(`${base}/api/studio/productions`, { headers: { authorization: `Bearer ${token}` } });
        assert.equal(res.status, 200);
        assert.ok(Array.isArray((await res.json()).productions));
      }
    } finally { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
  }
});


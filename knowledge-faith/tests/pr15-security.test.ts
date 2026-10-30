import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response, Router } from 'express';
import { studioRouter } from '../src/server/studio/routes.ts';
import { parseEditorAccounts } from '../src/server/spiritual/editorialStore.ts';

const token = 'test-editor-token-with-24-characters';

// Exercise Express route matching and middleware without binding a network port.
function request(router: Router, method: string, url: string, authorization = '') {
  return new Promise<{ status: number; headers: Record<string, string>; body: any }>((resolve, reject) => {
    const headers: Record<string, string> = {};
    let status = 200;
    const req = { method, url, headers: { authorization }, query: {}, body: {} } as Request;
    const res = {
      locals: {},
      setHeader(key: string, value: string) { headers[key.toLowerCase()] = value; },
      status(code: number) { status = code; return this; },
      json(body: unknown) { resolve({ status, headers, body }); },
    } as unknown as Response;
    router(req, res, (err?: unknown) => err ? reject(err) : reject(new Error('Route did not respond')));
  });
}

test('Studio control plane rejects anonymous, invalid and unconfigured access; public catalogue stays open', async () => {
  for (const configured of [false, true]) {
    const accounts = configured ? parseEditorAccounts(JSON.stringify([{ id: 'editor', name: 'Editor', roles: ['author'], token }])) : [];
    const router = studioRouter({ accounts, aiLimiter: (_req, _res, next) => next() });
      for (const authorization of ['', 'Bearer invalid']) {
        for (const [method, path] of [['POST', '/pipeline/run'], ['GET', '/productions'], ['PATCH', '/productions/test/script'], ['POST', '/productions/test/transition']]) {
          const res = await request(router, method, `/api/studio${path}`, authorization);
          assert.equal(res.status, configured ? 401 : 503, `${method} ${path}`);
          assert.equal(res.headers['cache-control'], 'no-store');
        }
      }
      const catalogue = await request(router, 'GET', '/api/studio/catalogue');
      assert.equal(catalogue.status, 200);
      if (configured) {
        const res = await request(router, 'GET', '/api/studio/productions', `Bearer ${token}`);
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.body.productions));
      }
  }
});


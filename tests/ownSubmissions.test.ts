// CONTROLLED source/gateway contract tests only: no HumHub, MySQL, OIDC, hosting, or human acceptance occurs here.
// Actual native synthetic-fixture checks live in scripts/test-native-humhub.mjs and remain distinct.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createSocialMiddleware } from '../src/server/socialGateway.ts';
import { createHumHubClient } from '../integrations/social/humhub-client.mjs';

const collection = (results: any[], page = 1) => ({ results, total: results.length, page, pages: results.length ? 1 : 0 });
const draft = { id: 42, reviewId: 101, message: 'Controlled author-owned draft.', status: 'pending', state: 10, sources: ['https://example.test/original'] };

async function harness(t: any) {
  const calls: URL[] = [];
  const actors: Record<string, any> = {
    author: { humhubUserId: 7, token: 'author-token', role: 'author' },
    reader: { humhubUserId: 9, token: 'reader-token', role: 'reader' },
  };
  const fetcher = async (input: string, options: any) => {
    const url = new URL(input); calls.push(url);
    const user = options.headers.Authorization === 'Bearer author-token' ? 7 : 9;
    if (url.pathname.endsWith('/auth/current')) return Response.json({ id: user, display_name: 'Controlled identity' });
    if (url.pathname.endsWith('/ummahreview/submissions')) {
      assert.equal(options.method, 'GET');
      assert.equal(url.searchParams.get('space'), '3');
      assert.ok(!url.searchParams.has('userId'));
      assert.ok(!url.searchParams.has('authorId'));
      return Response.json(collection(user === 7 ? [draft] : []));
    }
    assert.fail(`Unexpected controlled provider endpoint: ${url.pathname}`);
  };
  let middleware: any;
  const server = createServer((req, res) => {
    Promise.resolve(middleware(req, res, () => { res.statusCode = 404; res.end(); })).catch(() => { res.statusCode = 500; res.end(); });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  middleware = createSocialMiddleware({
    resolveActor: async req => actors[(req.headers.cookie || '').replace('actor=', '')] || null,
    origin: () => 'https://controlled-humhub.test', fetcher: fetcher as any, reviewEnabled: true, publicOrigin: origin,
  });
  t.after(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  return {
    calls,
    request: (path: string, actor = 'author') => fetch(`${origin}/api/social/${path}`, {
      headers: actor ? { Cookie: `actor=${actor}` } : {},
    }),
  };
}

test('controlled gateway returns only the authenticated actor native own-submissions projection', async t => {
  const h = await harness(t);
  const response = await h.request('submissions?space=3&page=2');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /private, no-store/);
  assert.deepEqual((await response.json()).items, [draft]);
  const ownCall = h.calls.find(url => url.pathname.endsWith('/ummahreview/submissions'))!;
  assert.equal(ownCall.searchParams.get('space'), '3');
  assert.equal(ownCall.searchParams.get('page'), '2');
  assert.equal(ownCall.searchParams.get('userId'), null);
  assert.equal(ownCall.searchParams.get('authorId'), null);

  assert.equal((await h.request('submissions?space=3&userId=8')).status, 400);
  assert.equal((await h.request('submissions?space=3&authorId=8')).status, 400);
  assert.equal((await h.request('submissions?space=3&author=other-user')).status, 400);
  assert.equal((await h.request('submissions?space=3&status=approved')).status, 400);
  assert.equal((await h.request('submissions?space=3&includeApproved=0')).status, 400);
  assert.equal((await h.request('submissions?space=3', 'reader')).status, 403);
  assert.equal((await h.request('submissions?space=3', '')).status, 401);
});

test('controlled adapter permits only a bounded page and explicitly opts into approved own rows', async () => {
  const calls: URL[] = [];
  const client = createHumHubClient({ origin: 'https://controlled-humhub.test', token: 'author-token', expectedUserId: 7,
    fetcher: (async (input: RequestInfo | URL) => {
      const url = new URL(String(input)); calls.push(url);
      if (url.pathname.endsWith('/auth/current')) return Response.json({ id: 7, display_name: 'Controlled identity' });
      return Response.json(collection([{ ...draft, status: 'approved', state: 1 }]));
    }) as typeof fetch,
  });
  const result = await client.ownSubmissions(3, 4, true);
  assert.equal(result.items[0].status, 'approved');
  const ownCall = calls.find(url => url.pathname.endsWith('/ummahreview/submissions'))!;
  assert.deepEqual(Object.fromEntries(ownCall.searchParams), { space: '3', page: '4', includeApproved: '1' });
  await assert.rejects(() => client.ownSubmissions(3, 10001), (error: any) => error.code === 'invalid_page');
  await assert.rejects(() => client.ownSubmissions(3, 1, 'yes' as any), (error: any) => error.code === 'invalid_submission_filter');
});

test('source contracts keep author filtering native, require a live scoped submitter, and render a reloadable own list', async () => {
  const root = new URL('../', import.meta.url);
  const [events, controller, panel] = await Promise.all([
    readFile(new URL('integrations/social/humhub-ummahreview/Events.php', root), 'utf8'),
    readFile(new URL('integrations/social/humhub-ummahreview/controllers/ReviewController.php', root), 'utf8'),
    readFile(new URL('src/ummah/SocialPanels.tsx', root), 'utf8'),
  ]);
  assert.match(events, /ummahreview\/submissions'.*review\/submissions'.*'verb' => 'GET'/);
  const ownAction = controller.slice(controller.indexOf('public function actionSubmissions'), controller.indexOf('public function actionView'));
  assert.match(ownAction, /submittingMemberSpace/);
  assert.match(controller, /private function submittingMemberSpace[\s\S]*can_submit/);
  assert.match(ownAction, /'r\.author_id' => \(int\)Yii::\$app->user->id/);
  assert.match(ownAction, /array_key_exists\('userId'/);
  assert.match(ownAction, /array_key_exists\('author'/);
  assert.match(ownAction, /\(int\)\$page > 10000/);
  assert.match(ownAction, /Content::STATE_DRAFT/);
  assert.match(ownAction, /Content::STATE_PUBLISHED/);
  assert.match(ownAction, /andWhere\(\$query->stateFilterCondition\)/);
  assert.match(panel, /socialRequest\('submissions\?space=' \+ space\)/);
  assert.match(panel, /Your pending submissions/);
  assert.match(panel, /Refresh submissions/);
});

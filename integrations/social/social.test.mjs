import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { createHumHubClient } from './humhub-client.mjs';
import { createLabServer } from './lab-server.mjs';

const config = { origin: 'https://humhub.test', token: 'private-test-token', expectedUserId: 7 };
const list = results => ({ results, total: results.length, page: 1, pages: results.length ? 1 : 0 });
function provider({ denied = false, mismatch = false } = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer private-test-token');
    const path = new URL(url).pathname;
    if (path.endsWith('/auth/current')) return Response.json({ id: mismatch ? 8 : 7, display_name: 'Test member', account: { email: 'private@example.test' } });
    if (path.endsWith('/space')) return Response.json(list([{ id: 3, name: 'Learning circle', description: '', owner: { email: 'private@example.test' } }]));
    if (path.endsWith('/space/3')) return denied ? Response.json({ message: 'internal trace private-test-token' }, { status: 403 }) : Response.json({ id: 3, name: 'Learning circle', description: '', contentcontainer_id: 91 });
    if (path.endsWith('/post/container/91')) return Response.json(list([{ id: 42, message: '<script>alert(1)</script>', content: { private: 'discarded' } }]));
    assert.fail('Unexpected upstream path ' + path);
  };
  return { fetcher, calls };
}
test('uses the space content container and returns only approved fields', async () => {
  const upstream = provider(); const client = createHumHubClient({ ...config, fetcher: upstream.fetcher });
  assert.deepEqual(await client.me(), { id: 7, name: 'Test member' });
  const spaces = await client.spaces(); assert.equal(spaces.items[0].id, 3);
  assert.ok(!JSON.stringify(spaces).includes('email'));
  const posts = await client.posts(3); assert.equal(posts.items[0].id, 42);
  assert.deepEqual(Object.keys(posts.items[0]), ['id', 'message']);
  assert.ok(upstream.calls.some(call => call.url.includes('post/container/91')));
});
test('identity mismatch stops reads before touching private content', async () => {
  const upstream = provider({ mismatch: true });
  await assert.rejects(createHumHubClient({ ...config, fetcher: upstream.fetcher }).posts(3), { code: 'social_identity_mismatch' });
  assert.equal(upstream.calls.length, 1);
});
test('denied space does not trigger post request or disclose provider error', async () => {
  const upstream = provider({ denied: true });
  await assert.rejects(createHumHubClient({ ...config, fetcher: upstream.fetcher }).posts(3), { code: 'social_access_denied' });
  assert.equal(upstream.calls.length, 2);
});
test('invalid target, token, pagination and IDs are rejected', async () => {
  for (const origin of ['http://remote.test', 'https://user:pass@humhub.test', 'https://humhub.test/path', 'https://humhub.test?token=x']) assert.throws(() => createHumHubClient({ ...config, origin }));
  assert.throws(() => createHumHubClient({ ...config, token: 'x\r\nHost: other' }));
  const client = createHumHubClient({ ...config, fetcher: () => assert.fail('no request expected') });
  await assert.rejects(client.spaces(-1), { code: 'invalid_page' });
  await assert.rejects(client.posts('../auth'), { code: 'invalid_space' });
});
test('HTML, invalid JSON and oversized responses fail closed', async () => {
  for (const response of [new Response('<html>login</html>'), new Response('broken', { headers: { 'content-type': 'application/json' } }), Response.json({ blob: 'x'.repeat(1_048_577) })]) {
    await assert.rejects(createHumHubClient({ ...config, fetcher: async () => response }).me());
  }
});
test('upstream outages and rate limits are safe errors', async () => {
  await assert.rejects(createHumHubClient({ ...config, fetcher: async () => { throw new Error('private-test-token'); } }).me(), { code: 'social_provider_unavailable' });
  await assert.rejects(createHumHubClient({ ...config, fetcher: async () => new Response('', { status: 429 }) }).me(), { code: 'social_rate_limited' });
});
async function lab(t, env, fetcher) {
  const server = createLabServer({ env, fetcher }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
test('real HTTP lab serves assets and honest unconfigured state', async t => {
  const origin = await lab(t, {}, () => assert.fail('must not connect'));
  const page = await fetch(origin); assert.equal(page.status, 200); assert.ok((await page.text()).includes('Dragon Dawwa'));
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const response = await fetch(origin + '/api/me'); assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'isolated_social_instance_required');
});
test('real HTTP lab rejects writes and cross-origin access', async t => {
  const origin = await lab(t, {}, () => assert.fail('must not connect'));
  assert.equal((await fetch(origin + '/api/posts', { method: 'POST' })).status, 405);
  assert.equal((await fetch(origin + '/api/me', { headers: { Origin: 'https://evil.test' } })).status, 403);
  const status = await new Promise((resolve, reject) => {
    const req = request(origin + '/api/me', { headers: { Host: 'evil.test' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(status, 403);
});
test('real HTTP route returns projected posts without bearer credentials', async t => {
  const upstream = provider();
  const origin = await lab(t, { SOCIAL_TEST_ISOLATED: 'true', SOCIAL_TEST_ORIGIN: config.origin, SOCIAL_MEMBER_TOKEN: config.token, SOCIAL_MEMBER_ID: '7' }, upstream.fetcher);
  const response = await fetch(origin + '/api/posts?space=3'); assert.equal(response.status, 200);
  const body = await response.text(); assert.ok(body.includes('42')); assert.ok(!body.includes('private-test-token')); assert.ok(!body.includes('discarded'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { qualify } from './probe.mjs';
const env = { SOCIAL_TEST_ORIGIN: 'https://social-test.example', SOCIAL_TEST_ISOLATED: 'true', SOCIAL_MEMBER_A_TOKEN: 'a-secret', SOCIAL_MEMBER_B_TOKEN: 'b-secret', SOCIAL_PRIVATE_SPACE_ID: '7' };
function mock({ leak = false, sameUser = false } = {}) {
  return async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    const token = options.headers.Authorization;
    if (url.pathname.endsWith('auth/current')) return token ? Response.json({ id: token.includes('a-secret') || sameUser ? 1 : 2 }) : Response.json({}, { status: 401 });
    return token?.includes('a-secret') || leak ? Response.json({ id: 7 }) : Response.json({}, { status: 404 });
  };
}
test('missing configuration makes no request', async () => {
  assert.equal((await qualify({}, () => assert.fail('must not connect'))).status, 'BLOCKED');
});
test('rejects non-isolated, insecure, credential-bearing and malformed targets', async () => {
  for (const change of [{ SOCIAL_TEST_ISOLATED: 'false' }, { SOCIAL_TEST_ORIGIN: 'http://example.com' }, { SOCIAL_TEST_ORIGIN: 'https://user:secret@example.com' }, { SOCIAL_PRIVATE_SPACE_ID: '../auth' }]) {
    assert.equal((await qualify({ ...env, ...change }, () => assert.fail('must not connect'))).status, 'BLOCKED');
  }
});
test('checks separate accounts and access without writing', async () => {
  const result = await qualify(env, mock());
  assert.equal(result.status, 'READ_ONLY_CHECKS_PASSED');
  assert.equal(result.checks.length, 7);
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test('detects private space leakage', async () => assert.equal((await qualify(env, mock({ leak: true }))).status, 'FAILED'));
test('detects reused account tokens', async () => assert.equal((await qualify(env, mock({ sameUser: true }))).status, 'FAILED'));
test('transport failures do not disclose credentials', async () => {
  const result = await qualify(env, async () => { throw new Error('a-secret'); });
  assert.equal(result.status, 'FAILED');
  assert.ok(!JSON.stringify(result).includes('a-secret'));
});

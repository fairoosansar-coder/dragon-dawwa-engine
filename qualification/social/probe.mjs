// Read-only qualification; never imported by the application server.
import { pathToFileURL } from 'node:url';

export async function qualify(env, fetcher = fetch) {
  const needed = ['SOCIAL_TEST_ORIGIN', 'SOCIAL_MEMBER_A_TOKEN', 'SOCIAL_MEMBER_B_TOKEN', 'SOCIAL_PRIVATE_SPACE_ID'];
  if (needed.some(key => !env[key]?.trim())) return { status: 'BLOCKED', reason: 'Isolated instance and two test-account credentials required', checks: [] };
  let origin;
  try { origin = new URL(env.SOCIAL_TEST_ORIGIN); } catch { return { status: 'BLOCKED', reason: 'Invalid test origin', checks: [] }; }
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
      !(origin.protocol === 'https:' || (origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) ||
      env.SOCIAL_TEST_ISOLATED !== 'true' || !/^[1-9]\d*$/.test(env.SOCIAL_PRIVATE_SPACE_ID)) {
    return { status: 'BLOCKED', reason: 'Explicit isolated origin and positive numeric space ID required; HTTPS except loopback', checks: [] };
  }
  const checks = [];
  async function get(path, token) {
    const response = await fetcher(new URL('/api/v1/' + path, origin), {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    });
    let body;
    if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) body = await response.json();
    return { status: response.status, body };
  }
  const add = (name, pass) => checks.push({ name, status: pass ? 'PASS' : 'FAIL' });
  try {
    const a = await get('auth/current', env.SOCIAL_MEMBER_A_TOKEN);
    const b = await get('auth/current', env.SOCIAL_MEMBER_B_TOKEN);
    const validId = value => Number.isSafeInteger(value) && value > 0;
    add('Member A authenticated', a.status === 200 && validId(a.body?.id));
    add('Member B authenticated', b.status === 200 && validId(b.body?.id));
    add('Distinct identities', validId(a.body?.id) && validId(b.body?.id) && a.body.id !== b.body.id);
    const anonymous = await get('auth/current');
    add('Anonymous identity denied', [401, 403].includes(anonymous.status));
    const path = 'space/' + env.SOCIAL_PRIVATE_SPACE_ID;
    const member = await get(path, env.SOCIAL_MEMBER_A_TOKEN);
    add('Member A sees expected private space', member.status === 200 && String(member.body?.id) === env.SOCIAL_PRIVATE_SPACE_ID);
    const outsider = await get(path, env.SOCIAL_MEMBER_B_TOKEN);
    add('Member B cannot read private space', [403, 404].includes(outsider.status));
    const guest = await get(path);
    add('Anonymous cannot read private space', [401, 403, 404].includes(guest.status));
  } catch {
    // Do not expose tokens, response bodies, private content or upstream error text.
    checks.push({ name: 'Transport and response parsing', status: 'FAIL' });
  }
  return { status: checks.every(check => check.status === 'PASS') ? 'READ_ONLY_CHECKS_PASSED' : 'FAILED', checks,
    limitation: 'Does not qualify publication moderation, feeds, SSO, persistence, upgrades or restore.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await qualify(process.env);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'READ_ONLY_CHECKS_PASSED' ? 0 : result.status === 'BLOCKED' ? 2 : 1;
}

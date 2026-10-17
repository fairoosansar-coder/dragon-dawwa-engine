// Controlled endpoint-response tests only: they do not perform OIDC, provider, device, or human-login acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLoginState, routeFromLocation, signOutCurrentSession, trustedLoginPath, type LoginRequest } from '../src/ummah/loginState.ts';
import { routeFromHash, screenReadiness } from '../src/ummah/catalog.ts';

const response = (status: number, body: unknown = {}) => ({ status, json: async () => body });
function controlled(...responses: ReturnType<typeof response>[]) {
  const paths: string[] = [];
  const request: LoginRequest = async path => {
    paths.push(path);
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected controlled request: ${path}`);
    return next;
  };
  return { request, paths };
}

test('login route opens screen 2 only for the no-hash /login entry point and honors explicit valid hashes', () => {
  assert.equal(routeFromLocation('/login', '', routeFromHash), 'screen-2');
  assert.equal(routeFromLocation('/login/', '', routeFromHash), 'screen-2');
  assert.equal(routeFromLocation('/login', '#/screen-11', routeFromHash), 'screen-11');
  assert.equal(routeFromLocation('/login', '#/missing', routeFromHash), 'directory');
  assert.equal(routeFromLocation('/', '', routeFromHash), 'screen-4');
});

test('public config controls only the safe login affordance, not identity or membership', async () => {
  assert.equal(trustedLoginPath({ reviewEnabled: true, loginPath: '/auth/login' }), '/auth/login');
  assert.equal(trustedLoginPath({ reviewEnabled: true, loginPath: 'https://attacker.test/auth/login' }), null);
  assert.equal(trustedLoginPath({ reviewEnabled: true, loginPath: '//attacker.test/auth/login' }), null);
  assert.equal(trustedLoginPath({ reviewEnabled: false, loginPath: '/auth/login' }), null);

  const unconfigured = controlled(response(200, { reviewEnabled: false, loginPath: null }));
  assert.deepEqual(await loadLoginState(unconfigured.request), { kind: 'unconfigured' });
  assert.deepEqual(unconfigured.paths, ['/api/social/config']);

  const anonymous = controlled(response(200, { reviewEnabled: true, loginPath: '/auth/login' }), response(401, { user: null }));
  assert.deepEqual(await loadLoginState(anonymous.request), { kind: 'configured-anonymous', loginPath: '/auth/login' });
  assert.deepEqual(anonymous.paths, ['/api/social/config', '/api/review/session']);

  const restrictedSession = controlled(response(200, { reviewEnabled: true, loginPath: '/auth/login' }), response(403, { user: null }));
  assert.deepEqual(await loadLoginState(restrictedSession.request), { kind: 'authenticated-unmapped-or-forbidden' });
  assert.deepEqual(restrictedSession.paths, ['/api/social/config', '/api/review/session']);
});

test('authenticated session and mapped-member checks remain separate and never infer a cross-account identity', async () => {
  const mapped = controlled(
    response(200, { reviewEnabled: true, loginPath: '/auth/login' }),
    response(200, { user: { id: 'identity-account-a', name: 'Identity account A', role: 'reviewer' } }),
    response(200, { id: 12, name: 'Community account B', canReview: true, canSubmit: false, reviewEnabled: true }),
  );
  assert.deepEqual(await loadLoginState(mapped.request), {
    kind: 'mapped-member', name: 'Community account B', canReview: true, canSubmit: false,
  });
  assert.deepEqual(mapped.paths, ['/api/social/config', '/api/review/session', '/api/social/me']);

  for (const status of [401, 403]) {
    const unavailable = controlled(
      response(200, { reviewEnabled: true, loginPath: '/auth/login' }),
      response(200, { user: { id: 'identity-account-a', role: 'author' } }),
      response(status, { error: 'controlled_access_denied' }),
    );
    const state = await loadLoginState(unavailable.request);
    assert.deepEqual(state, { kind: 'authenticated-unmapped-or-forbidden' });
    assert.ok(!('name' in state), 'no member name survives an unavailable mapping/permission check');
  }
});

test('config failures, invalid login paths, session failures, and member failures never leave a stale mapped-ready state', async () => {
  const cases: Array<[string, ReturnType<typeof response>[], unknown]> = [
    ['config failure', [response(503)], { kind: 'temporary-error', stage: 'config' }],
    ['invalid login path', [response(200, { reviewEnabled: true, loginPath: '/auth/logout' })], { kind: 'temporary-error', stage: 'config' }],
    ['session outage', [response(200, { reviewEnabled: true, loginPath: '/auth/login' }), response(503)], { kind: 'temporary-error', stage: 'session' }],
    ['member outage', [response(200, { reviewEnabled: true, loginPath: '/auth/login' }), response(200, { user: { id: 'a' } }), response(503)], { kind: 'temporary-error', stage: 'member' }],
  ];
  for (const [label, responses, expected] of cases) {
    const check = controlled(...responses);
    const state = await loadLoginState(check.request);
    assert.deepEqual(state, expected, label);
    assert.ok(!('name' in state), `${label} must not retain a previous member label`);
  }
});

test('malformed success responses never fabricate a mapped member',async()=>{
  for(const body of [{}, {error:'unexpected'}, {id:12,canSubmit:true,canReview:false}, {id:'12',canSubmit:true,canReview:false,reviewEnabled:true}]){
    const h=controlled(response(200,{reviewEnabled:true,loginPath:'/auth/login'}),response(200,{user:{id:'synthetic'}}),response(200,body));
    assert.deepEqual(await loadLoginState(h.request),{kind:'temporary-error',stage:'member'});
  }
});

test('catalog preserves the documented 33-screen readiness distribution', () => {
  const totals = { locallyWorking: 0, uiOnly: 0, blocked: 0 };
  for (let number = 1; number <= 33; number++) totals[screenReadiness(`screen-${number}`)]++;
  assert.deepEqual(totals, { locallyWorking: 6, uiOnly: 20, blocked: 7 });
  assert.equal(screenReadiness('screen-15'),'blocked');
  assert.equal(screenReadiness('screen-31'),'locallyWorking');
  assert.equal(screenReadiness('screen-33'),'uiOnly');
});

test('sign-out uses a credentialed same-origin POST and requires a server-denied session',async()=>{
  const calls:any[]=[];
  const redirectResponse=()=>{const r=new Response(null,{status:302});Object.defineProperty(r,'type',{value:'opaqueredirect'});return r;};
  await signOutCurrentSession((async(path,options)=>{
    calls.push({path,options});return path==='/auth/logout'?redirectResponse():new Response(null,{status:401});
  }) as typeof fetch);
  assert.equal(calls[0].path,'/auth/logout');assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.redirect,'manual');
  assert.equal(calls[1].path,'/api/review/session');
  await assert.rejects(signOutCurrentSession((async()=>new Response(null,{status:403}))as typeof fetch));
  await assert.rejects(signOutCurrentSession((async(path)=>path==='/auth/logout'?redirectResponse():new Response(null,{status:200}))as typeof fetch));
});

// Controlled contract tests. These are NOT real OIDC, HumHub/MySQL or physical Safari acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createSocialMiddleware } from '../src/server/socialGateway.ts';
import { createTrustedSocialResolver, configuredStagingSocialMiddleware } from '../src/server/socialIdentity.ts';
import { createHumHubClient } from '../integrations/social/humhub-client.mjs';

const collection = (results: any[]) => ({ results, total: results.length, page: 1, pages: results.length ? 1 : 0 });
async function harness(t: any, { mismatch = false, corrupt = false } = {}) {
  const rows: any[] = []; const revoked = new Set<string>(); const calls: any[] = [];
  const actor = { author: { id: 'google:synthetic-author', role: 'author' }, reviewer: { id: 'google:synthetic-reviewer', role: 'reviewer' } };
  const resolveActor = createTrustedSocialResolver({
    verifySession: async req => { const name = req.headers.cookie?.split('=')[1] as 'author' | 'reviewer'; return revoked.has(name) ? null : actor[name] || null; },
    lookupAccount: async id => ({ humhubUserId: id === actor.author.id ? 7 : 8, token: id === actor.author.id ? 'token-author' : 'token-reviewer' }),
  });
  const fetcher = async (url: string, options: any) => {
    const who = options.headers.Authorization === 'Bearer token-author' ? 7 : 8;
    const path = new URL(url).pathname; const input = options.body ? JSON.parse(options.body) : null;
    calls.push({ path, who, input });
    assert.equal(options.redirect, 'error');
    if (path.endsWith('/auth/current')) return Response.json({ id: mismatch ? 99 : who, display_name: 'Controlled test identity' });
    if (path.endsWith('/space')) return Response.json(collection([{id:3,name:'Controlled test community',description:''}]));
    if (path.endsWith('/ummahreview/submissions')) {
      if (input.spaceId !== 3) return Response.json({}, {status:403});
      const old = rows.find(row => row.author === who && row.requestKey === input.requestKey);
      if (old && old.message !== input.message) return Response.json({}, {status:409});
      if (old) return Response.json(old);
      const row = {id:42+rows.length, reviewId:101+rows.length, author:who, ...input, state:10,status:'pending'};
      rows.push(row); return Response.json(row);
    }
    if (path.endsWith('/ummahreview/posts')) {
      if (new URL(url).searchParams.get('space') !== '3') return Response.json({}, {status:403});
      return Response.json(collection(corrupt ? [{id:42,reviewId:101,message:'draft',state:10,status:'pending',sources:[]}] : rows.filter(row => row.status === 'approved')));
    }
    if (path.includes('/ummahreview/post/')) {
      const row = rows.find(row => row.id === Number(path.split('/').at(-1)) && row.status === 'approved');
      return row ? Response.json(row) : Response.json({}, {status:404});
    }
    if (path.endsWith('/ummahreview/reviews')) return who === 8 ? Response.json(collection(rows.filter(row => row.status === 'pending'))) : Response.json({}, {status:403});
    if (path.includes('/ummahreview/reviews/')) {
      const row = rows.find(row => row.reviewId === Number(path.split('/').at(-1)));
      if (who !== 8 || row?.author === who) return Response.json({}, {status:403});
      if (!row || row.status !== 'pending') return Response.json({}, {status:409});
      row.status = input.decision; row.state = input.decision === 'approved' ? 1 : 10;
      return Response.json(row);
    }
    assert.fail('Unexpected provider endpoint '+path);
  };
  let middleware: any;
  const server = createServer((req,res) => { Promise.resolve(middleware(req,res,() => {res.statusCode=404;res.end();})).catch(() => {res.statusCode=500;res.end();}); });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  middleware = createSocialMiddleware({resolveActor,origin:()=> 'https://controlled-humhub.test',fetcher:fetcher as any,reviewEnabled:true,publicOrigin:origin});
  t.after(() => new Promise<void>(resolve => {server.closeAllConnections();server.close(()=>resolve());}));
  async function request(path:string, who='author', input?:any, extra:any={}) {
    return fetch(origin+'/api/social/'+path, {method:input?'POST':'GET',headers:{Cookie:'session='+who,...(input?{Origin:origin,'Content-Type':'application/json'}:{}),...extra},...(input?{body:JSON.stringify(input)}:{})});
  }
  return {request,rows,revoked,calls};
}
const submission = {spaceId:3,message:'Controlled test reflection — not scholarship or a real transaction.',sources:['https://example.test/original'],requestKey:'synthetic-request-0001'};

test('controlled two-identity HTTP flow: account → community → draft → human review → approved feed/detail', async t => {
  const h = await harness(t);
  assert.equal((await h.request('me')).status,200);
  assert.equal((await h.request('spaces')).status,200);
  const draft = await h.request('submissions','author',submission); assert.equal(draft.status,200);
  const pending = await draft.json(); assert.equal(pending.state,10); assert.equal(pending.status,'pending'); assert.equal(h.rows.length,1);
  assert.equal((await (await h.request('posts?space=3','reviewer')).json()).items.length,0);
  assert.equal((await (await h.request('posts?space=3','author')).json()).items.length,0);
  assert.equal((await h.request('post?id=42')).status,404);
  assert.equal((await h.request('reviews?space=3','author')).status,403);
  assert.equal((await h.request('reviews','author',{reviewId:101,decision:'approved',note:'Attempted self review'})).status,403);
  const queue = await (await h.request('reviews?space=3','reviewer')).json(); assert.equal(queue.items[0].status,'pending');
  assert.equal((await h.request('reviews','reviewer',{reviewId:101,decision:'approved',note:'Human checked the submitted original source and text.'})).status,200);
  const feed = await (await h.request('posts?space=3')).json(); assert.equal(feed.items[0].state,1); assert.deepEqual(feed.items[0].sources,submission.sources);
  assert.equal((await h.request('post?id=42')).status,200);
  assert.doesNotMatch(JSON.stringify(feed),/token-author|token-reviewer|synthetic-author|requestKey/);
});
test('duplicate requests are idempotent; changed payload cannot reuse a key', async t => {
  const h = await harness(t); assert.equal((await h.request('submissions','author',submission)).status,200);
  assert.equal((await h.request('submissions','author',submission)).status,200); assert.equal(h.rows.length,1);
  assert.equal((await h.request('submissions','author',{...submission,message:'changed'})).status,409);
});
test('rejection leaves unpublished draft and removes it from approved detail',async t => {
  const h = await harness(t); await h.request('submissions','author',submission);
  assert.equal((await h.request('reviews','reviewer',{reviewId:101,decision:'rejected',note:'Source evidence insufficient.'})).status,200);
  assert.equal(h.rows[0].state,10); assert.equal((await (await h.request('posts?space=3')).json()).items.length,0);
  assert.equal((await h.request('post?id=42')).status,404);
});
test('revocation, missing session, identity mismatch and forbidden space fail closed',async t => {
  const h = await harness(t); h.revoked.add('author'); assert.equal((await h.request('spaces')).status,401);
  assert.equal((await h.request('spaces','unknown')).status,401);
  assert.equal((await h.request('posts?space=99','reviewer')).status,403);
  const bad = await harness(t,{mismatch:true}); assert.equal((await bad.request('spaces')).status,403); assert.equal(bad.calls.length,1);
});
test('same-origin JSON, source URLs, decision notes and byte limits are mandatory',async t => {
  const h = await harness(t);
  assert.equal((await h.request('submissions','author',submission,{Origin:'https://evil.test'})).status,403);
  assert.equal((await h.request('submissions','author',submission,{'sec-fetch-site':'cross-site'})).status,403);
  assert.equal((await h.request('submissions','author',{...submission,sources:['javascript:alert(1)']})).status,400);
  assert.equal((await h.request('submissions','author',{...submission,message:'😀'.repeat(4000)})).status,400);
  assert.equal((await h.request('reviews','reviewer',{reviewId:101,decision:'approved',note:''})).status,400);
  assert.equal(h.rows.length,0);
});
test('provider returning a draft to approved-only endpoint is rejected, not rendered',async t => {
  const h = await harness(t,{corrupt:true}); assert.equal((await h.request('posts?space=3')).status,502);
});
test('legacy native reader excludes author drafts and missing publication metadata',async () => {
  const client = createHumHubClient({origin:'https://humhub.test',token:'member-token',expectedUserId:7,fetcher:async (input) => {
    const url = String(input);
    if (url.includes('/auth/current')) return Response.json({id:7,display_name:'Test'});
    if (url.includes('/space/3')) return Response.json({id:3,name:'Test',contentcontainer_id:91});
    return Response.json(collection([{id:1,message:'draft',content:{metadata:{state:10}}},{id:2,message:'unknown'},{id:3,message:'published',content:{metadata:{state:1}}}]));
  }});
  assert.deepEqual((await client.posts(3)).items,[{id:3,message:'published'}]);
});
test('trusted resolver never uses browser roles/IDs or grants authority from the account map',async () => {
  const r = createTrustedSocialResolver({verifySession:async()=>null,lookupAccount:async()=>assert.fail('No lookup without session')});
  assert.equal(await r({headers:{'x-review-role':'owner','x-user-id':'google:other'}}as any),null);
  const invalid = createTrustedSocialResolver({verifySession:async()=>({id:'google:test',role:'administrator'}),lookupAccount:async()=>assert.fail('Unknown roles denied')});
  assert.equal(await invalid({}as any),null);
});
test('isolated staging cannot target the production identity host',async () => {
  const fn = configuredStagingSocialMiddleware({UMMAH_SOCIAL_ENVIRONMENT:'isolated-staging',UMMAH_PUBLIC_ORIGIN:'https://stage.test',UMMAH_IDENTITY_ORIGIN:'https://dragondawwa.org',HUMHUB_ORIGIN:'https://hh.test',UMMAH_ACCOUNT_MAP_FILE:'/unused',UMMAH_IDENTITY_ENVIRONMENT:'isolated-staging'}as any,()=>assert.fail('No production request')as any);
  let status=200,body=''; await fn({url:'/api/social/me',method:'GET',headers:{}}as any,{setHeader(){},set statusCode(v:number){status=v},end(v:string){body=v}}as any,()=>{});
  assert.equal(status,503); assert.match(body,/configuration_required/);
});
test('native PHP source guard contracts: draft BEFORE first save; locked decision, hash and no self-review',async () => {
  const root = new URL('../integrations/social/humhub-ummahreview/',import.meta.url);
  const controller = await readFile(new URL('controllers/ReviewController.php',root),'utf8');
  const draft = controller.indexOf('$post->content->state = Content::STATE_DRAFT');
  assert.ok(draft > 0 && draft < controller.indexOf('Events::saveSubmittedDraft($post)'));
  assert.match(controller,/FOR UPDATE/); assert.match(controller,/hash_equals/); assert.match(controller,/Independent human reviewer required/);
  const events = await readFile(new URL('Events.php',root),'utf8'); assert.match(events,/\$event->isValid = false/); assert.match(events,/publishingContentId/);
  assert.match(events,/visibility = Content::VISIBILITY_PRIVATE/);
  assert.match(events,/self::\$submittedDraft !== \$post/);
  assert.match(controller,/ReviewAudit::run/);
  const audit = await readFile(new URL('ReviewAudit.php',root),'utf8');
  assert.match(audit,/\$db->transaction/); assert.match(audit,/transaction_failed/);
  const config = await readFile(new URL('config.php',root),'utf8'); assert.match(config,/EVENT_BEFORE_INSERT/); assert.match(config,/EVENT_BEFORE_UPDATE/);
});

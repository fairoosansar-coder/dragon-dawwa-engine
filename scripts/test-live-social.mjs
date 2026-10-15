// Real provider acceptance only. Cookies must be supplied through protected staging secrets, never Git/chat.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const required = ['UMMAH_LIVE_STAGING_URL','UMMAH_TEST_AUTHOR_COOKIE','UMMAH_TEST_REVIEWER_COOKIE','UMMAH_TEST_SPACE_ID','UMMAH_TEST_FORBIDDEN_SPACE_ID'];
const missing = required.filter(k => !process.env[k]);
const output = new URL('../docs/ummahconnect/evidence/2026-10-15/live-staging.json',import.meta.url);
await fs.mkdir(new URL('.',output),{recursive:true});
if (missing.length) {
  const result={status:'BLOCKED',missing,realOIDCCallbackVerified:false,realHumHubFlowVerified:false,realIPhoneSafariVerified:false};
  await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(2);
}
const origin = new URL(process.env.UMMAH_LIVE_STAGING_URL).origin;
assert.equal(new URL(origin).protocol,'https:');assert.ok(!new URL(origin).hostname.endsWith('dragondawwa.org'),'Production is forbidden');
const cookies={author:process.env.UMMAH_TEST_AUTHOR_COOKIE,reviewer:process.env.UMMAH_TEST_REVIEWER_COOKIE};
const checks=[];
async function request(path,who='author',input) {
  const response=await fetch(origin+'/api/social/'+path,{method:input?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Cookie:cookies[who],Accept:'application/json',...(input?{Origin:origin,'Content-Type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})});
  const body=await response.json();return {status:response.status,body};
}
try {
  const a=await request('me'),b=await request('me','reviewer');assert.equal(a.status,200);assert.equal(b.status,200);assert.notEqual(a.body.id,b.body.id);assert.equal(b.body.canReview,true);checks.push('two different linked member identities');
  assert.equal((await request('spaces')).status,200);checks.push('real permitted community list');
  const input={spaceId:Number(process.env.UMMAH_TEST_SPACE_ID),message:'STAGING ACCEPTANCE TEST ONLY — not scholarship, donations, transactions or construction evidence.',sources:[],requestKey:crypto.randomUUID()};
  const draft=await request('submissions','author',input);assert.equal(draft.status,200);assert.equal(draft.body.status,'pending');assert.equal(draft.body.state,10);const {id,reviewId}=draft.body;checks.push('real provider submission is an unpublished draft');
  const retry=await request('submissions','author',input);assert.equal(retry.body.id,id);checks.push('submission retry is idempotent');
  for(const who of ['author','reviewer']){const feed=await request('posts?space='+input.spaceId,who);assert.equal(feed.status,200);assert.ok(!feed.body.items.some(p=>p.id===id));}checks.push('draft absent from both approved feeds');
  assert.equal((await request('post?id='+id)).status,404);checks.push('unapproved direct app URL denied');
  assert.equal((await request('reviews','author',{reviewId,decision:'approved',note:'STAGING: attempted self review.'})).status,403);checks.push('author review denied');
  assert.equal((await request('posts?space='+process.env.UMMAH_TEST_FORBIDDEN_SPACE_ID,'author')).status,403);checks.push('forbidden community denied');
  const queue=await request('reviews?space='+input.spaceId,'reviewer');assert.equal(queue.status,200);assert.ok(queue.body.items.some(p=>p.reviewId===reviewId));
  const approved=await request('reviews','reviewer',{reviewId,decision:'approved',note:'STAGING ACCEPTANCE TEST: independent human account explicitly approved this test-only text.'});assert.equal(approved.status,200);assert.equal(approved.body.state,1);checks.push('independent review publishes exact unchanged post');
  const feed=await request('posts?space='+input.spaceId);assert.ok(feed.body.items.some(p=>p.id===id));assert.equal((await request('post?id='+id)).status,200);checks.push('approved post visible to permitted account');
  const result={status:'PASS',origin,checks,testPostId:id,realHumHubFlowVerified:true,realOIDCCallbackVerified:false,realIPhoneSafariVerified:false,note:'Uses pre-authenticated test sessions. Fresh OIDC callback, native HumHub bypass, MySQL rollback and physical Safari still need separate acceptance.'};await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} catch(error) {
  await fs.writeFile(output,JSON.stringify({status:'FAIL',checks,errorType:error.name,realHumHubFlowVerified:false},null,2)+'\n');console.error('Live staging acceptance failed; inspect protected operator session. No secret values logged.');process.exit(1);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredStagingAuthMiddleware } from '../src/server/stagingAuth.ts';
const env = {UMMAH_SOCIAL_ENVIRONMENT:'isolated-staging',UMMAH_PUBLIC_ORIGIN:'https://stage.test',UMMAH_IDENTITY_ORIGIN:'https://identity-stage.test',UMMAH_IDENTITY_ENVIRONMENT:'isolated-staging'} as any;
async function run(path:string,fetcher:any,extra:any={},config=env) {
  let status=200,body:any='',next=false;const headers:any={};
  await configuredStagingAuthMiddleware(config,fetcher)({url:path,method:'GET',headers:{host:'stage.test',cookie:'unrelated=secret; webdev_app_session=signed-test; __Host-dd_oidc_flow=flow',...extra}}as any,
    {setHeader(k:string,v:any){headers[k]=v;},set statusCode(v:number){status=v;},end(v:any){body=v?.toString()||'';}}as any,()=>{next=true;});
  return {status,body,headers,next};
}
test('staging auth forwards only app cookies and canonical host to the existing authority',async()=>{
  const result=await run('/auth/login',async(url:string,init:any)=>{
    assert.equal(url,'https://identity-stage.test/auth/login');assert.equal(init.redirect,'manual');
    assert.equal(init.headers.Host,'stage.test');assert.doesNotMatch(init.headers.Cookie,/unrelated|secret/);
    return new Response(null,{status:302,headers:{Location:'https://accounts.google.com/o/oauth2/auth?state=test','Set-Cookie':'__Host-dd_oidc_flow=sealed; Path=/; HttpOnly; Secure; SameSite=Lax'}});
  });
  assert.equal(result.status,302);assert.match(result.headers.Location,/accounts.google.com/);assert.equal(result.headers['Cache-Control'],'no-store');
});
test('staging callback preserves same-origin redirect and host-only app session',async()=>{
  const result=await run('/auth/callback?code=test&state=test',async()=>new Response(null,{status:302,headers:{Location:'/', 'Set-Cookie':'webdev_app_session=signed; Path=/; HttpOnly; Secure; SameSite=Lax'}}));
  assert.equal(result.status,302);assert.equal(result.headers.Location,'/');assert.match(result.headers['Set-Cookie'][0],/^webdev_app_session=/);
});
test('external redirect or domain-scoped cookie from authority fails closed',async()=>{
  assert.equal((await run('/auth/callback',async()=>new Response(null,{status:302,headers:{Location:'https://evil.test'}}))).status,502);
  assert.equal((await run('/auth/login',async()=>new Response(null,{status:302,headers:{Location:'/', 'Set-Cookie':'webdev_app_session=x; Domain=stage.test'}}))).status,502);
});
test('production origin, bad host and authority outage are blocked without exposing secrets',async()=>{
  const production={...env,UMMAH_IDENTITY_ORIGIN:'https://dragondawwa.org'};
  assert.equal((await run('/auth/login',()=>assert.fail('No production request'),{},production)).status,503);
  assert.equal((await run('/auth/login',()=>assert.fail('No request'),{host:'evil.test'})).status,503);
  const result=await run('/auth/login',()=>{throw new Error('secret-token');});assert.equal(result.status,503);assert.doesNotMatch(result.body,/secret-token/);
});
test('default auth transport is not installed on production and cannot proxy arbitrary APIs',async()=>{
  assert.equal((await run('/auth/login',()=>assert.fail('No request'),{},{}as any)).next,true);
  assert.equal((await run('/api/admin/roles',()=>assert.fail('No request'))).next,true);
});

test('existing authority may clear its legacy logout nonce, never mint a new legacy cookie',async()=>{
  const headers=new Headers({Location:'/signed-out'});
  headers.append('Set-Cookie','webdev_app_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  headers.append('Set-Cookie','dd_oauth_nonce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  const result=await run('/auth/callback',async()=>new Response(null,{status:303,headers}));
  assert.equal(result.status,303);assert.equal(result.headers['Set-Cookie'].length,2);
  assert.equal((await run('/auth/login',async()=>new Response(null,{status:302,headers:{Location:'/', 'Set-Cookie':'dd_oauth_nonce=new; Path=/; Max-Age=600'}}))).status,502);
});

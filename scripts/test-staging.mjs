import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const req=(p,method='GET')=>worker.fetch(new Request('https://staging.test'+p,{method}),{});
test('staging serves the integrated app and bundled Quran source',async()=>{let r=await req('/');assert.equal(r.status,200);assert.match(await r.text(),/UmmahConnect/);r=await req('/data/quran-en.json');assert.equal(r.status,200);assert.ok((await r.text()).length>100000);});
test('staging cannot assert a research result, account or transaction without configured services',async()=>{for(const path of ['/api/analyze','/api/tts','/api/transcribe-audio','/api/extract-hadith-media']){const r=await req(path,'POST');assert.equal(r.status,503);assert.match(await r.text(),/isolated staging/);}assert.equal((await req('/api/social/spaces')).status,401);assert.equal((await req('/api/social/posts','POST')).status,405);assert.equal((await req('/api/payments','POST')).status,404);});
test('asset misses and unsupported methods do not return a misleading successful app response',async()=>{assert.equal((await req('/missing.js')).status,404);assert.equal((await req('/','POST')).status,405);assert.equal((await req('/api/tts')).status,405);});

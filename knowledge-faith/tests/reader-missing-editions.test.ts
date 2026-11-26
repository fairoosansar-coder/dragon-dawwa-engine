import test from 'node:test';
import assert from 'node:assert/strict';
import {fillMissingEditionRows,editionJson} from '../src/server/hadith.ts';
import {UpstreamError} from '../src/server/http.ts';
import type {Hadith} from '../src/shared/types.ts';
import {loadHadeethOriginal} from '../src/server/hadeethenc.ts';
import {editionFileNumber,exactEditionRow} from '../src/shared/editionNumber.ts';
const row=(number:number,lang:'ta'|'en',text:string)=>({collection:'muslim',number,lang,text} as Hadith);
test('classic section uses original Tamil when present and explicitly English only for missing numbers',()=>{
 const ta=row(2,'ta','தமிழ்');
 const restored=fillMissingEditionRows([ta],[row(1,'en','first'),row(2,'en','second'),row(3,'en','   ')]);
 assert.deepEqual(restored.map(x=>[x.number,x.lang]),[[1,'en'],[2,'ta']]);
 assert.equal(restored[1],ta);
});
test('Arabic lookup rejects malformed identifiers without contacting the publisher', async()=>{
 await assert.rejects(loadHadeethOriginal('../8953'),/Unknown hadith ID/);
});
test('decimal edition references use the integer parent file but never borrow a sibling text',()=>{
  assert.equal(editionFileNumber(402.2),402);
  assert.equal(editionFileNumber(-2),null);
  assert.equal(editionFileNumber(Infinity),null);
  assert.equal(exactEditionRow([{number:402},{number:402.2}],402.2)?.number,402.2);
  assert.equal(exactEditionRow([{number:402}],402.2),undefined);
});
test('unavailable CDN file uses the identical edition and release at the original repository',async()=>{
  const seen:string[]=[];
  const result=await editionJson('https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-bukhari/2214.min.json',1000,500,async url=>{
    seen.push(url);if(seen.length===1)throw new UpstreamError('CDN returned 403',502);return 'same edition';
  });
  assert.equal(result,'same edition');
  assert.equal(seen[1],'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/eng-bukhari/2214.min.json');
});

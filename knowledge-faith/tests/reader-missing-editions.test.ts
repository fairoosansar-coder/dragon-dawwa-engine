import test from 'node:test';
import assert from 'node:assert/strict';
import {fillMissingEditionRows} from '../src/server/hadith.ts';
import type {Hadith} from '../src/shared/types.ts';
import {loadHadeethOriginal} from '../src/server/hadeethenc.ts';
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

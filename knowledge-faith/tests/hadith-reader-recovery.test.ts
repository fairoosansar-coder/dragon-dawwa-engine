import test from 'node:test';
import assert from 'node:assert/strict';
import {readEncyclopediaEdition} from '../src/server/hadeethenc.ts';
import {UpstreamError} from '../src/server/http.ts';
import {applyMachineTranslation} from '../src/server/hadithTranslate.ts';
import {LANGS} from '../src/shared/sources.ts';
import {splitArabicHadith} from '../src/shared/hadithSegmentation.ts';
import {fillMissingEditionRows,readClassicHadith} from '../src/server/hadith.ts';
import type {Hadith} from '../src/shared/types.ts';
import type {EncyclopediaHadith} from '../src/shared/hadeethenc.ts';

for(const lang of LANGS) {
  test(`reader resolution: published, original, unknown and unavailable upstream (${lang})`,async()=>{
    const id='123', absent=async()=>{throw new UpstreamError('absent',404);};
    const original=async()=>({id,lang:'ar' as const,text:'العربية',sourceUrl:'https://hadeethenc.com/ar/browse/hadith/123'});
    const edition=async()=>({id,lang,text:'published'} as EncyclopediaHadith);
    assert.equal((await readEncyclopediaEdition(lang,id,edition,absent)).kind,'edition');
    const fallback=await readEncyclopediaEdition(lang,id,absent,original);
    assert.equal(fallback.kind,'original');assert.equal(fallback.requested,lang);
    await assert.rejects(readEncyclopediaEdition(lang,id,absent,absent),/Unknown hadith ID/);
    await assert.rejects(readEncyclopediaEdition(lang,id,async()=>{throw new UpstreamError('timeout',504);},original),/timeout/);
  });
}
test('a mixed batch never labels an English echo or the wrong script as Tamil or Sinhala',()=>{
  for(const [lang,good,bad] of [['ta','நம்பிக்கை','විශ්වාසය'],['si','විශ්වාසය','நம்பிக்கை']] as const){
    const rows=applyMachineTranslation(['Faith','same','Some text'],[good,'same',bad],lang);
    assert.deepEqual(rows.map(r=>r.machineTranslation),[true,false,false]);
    assert.equal(rows[2].text,'Some text');
  }
});
test('a clear chain boundary keeps both pieces; uncertain segmentation preserves all source text',()=>{
  const clear='حدثنا الراوي، عن شاهد، قالت العبارة الأخيرة';
  assert.equal(splitArabicHadith(clear).matn,'العبارة الأخيرة');
  const ambiguous='حدثنا الراوي، عن شاهد، عن راو آخر، دون قول صريح';
  assert.deepEqual(splitArabicHadith(ambiguous),{full:ambiguous,isnad:'',matn:ambiguous});
});
test('a Tamil-only source remains Tamil when a reader opens its number or section from English or Sinhala',async()=>{
  const row={collection:'muslim',number:128,lang:'ta',text:'தமிழ் உரை'} as Hadith;
  for(const lang of LANGS){
    assert.equal(await readClassicHadith('muslim',128,lang,async(_c,_n,l)=>l==='ta'?row:null,async()=>null),row);
  }
  assert.deepEqual(fillMissingEditionRows([],[row]),[row]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readEncyclopediaEdition} from '../src/server/hadeethenc.ts';
import {UpstreamError} from '../src/server/http.ts';
import {applyMachineTranslation} from '../src/server/hadithTranslate.ts';
import {LANGS} from '../src/shared/sources.ts';
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

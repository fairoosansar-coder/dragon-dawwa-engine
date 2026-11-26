import assert from 'node:assert/strict';
import test from 'node:test';
import {ENCYCLOPEDIA_DOMAINS,KUTUB_AL_SITTAH,TOPIC_CHIPS,domainCopy,collectionName,chipLabel} from '../src/views/hadithEncyclopediaCopy.ts';

for(const lang of ['en','ta','si'] as const){
  test(`all seven categories, six collections and topic buttons use only the selected locale (${lang})`,()=>{
    const values=[...ENCYCLOPEDIA_DOMAINS.flatMap(d=>Object.values(domainCopy(d,lang))),...KUTUB_AL_SITTAH.map(b=>collectionName(b.id,b.name,lang)),...TOPIC_CHIPS.map(c=>chipLabel(c.id,lang))];
    for(const s of values){
      assert.equal(/[\u0b80-\u0bff]/u.test(s),lang==='ta',s);
      assert.equal(/[\u0d80-\u0dff]/u.test(s),lang==='si',s);
      assert.ok(s.length);
    }
  });
}

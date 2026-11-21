import test from 'node:test';
import assert from 'node:assert/strict';
import {decideFinding, findingLabel, matchesNarration} from '../src/engine/utils/automatedFinding.ts';
import type {HadeethEncRetrievedRecord} from '../src/engine/types/hadith.ts';
const q='None of you truly believes until he loves for his brother what he loves for himself.';
const target=q.replace(' truly','');
const other='None of you truly believes until I become dearer to him than his father, his children, and all people.';
function row(id:string,title:string,grade:string|null='Authentic'):HadeethEncRetrievedRecord{
  return {id,title,translation:`Anas reported: “${title}”`,arabic:null,published_grade:grade,language:'en',source_url:`https://hadeethenc.com/en/browse/hadith/${id}`} as HadeethEncRetrievedRecord;
}
test('distinctive clause, not opening formula, identifies the two matching editions',()=>{
  const d=decideFinding(q,[row('5953',other),row('4717',target),row('66520',target)],'source-check');
  assert.equal(d.status,'matched');assert.deepEqual(d.sources.map(r=>r.id),['4717','66520']);
});
test('a missing match is a finished negative result, including a negated near-match',()=>{
  for(const rows of [[],[row('5953',other)],[row('1',target.replace('he loves','he does not love'))]]){
    const d=decideFinding(q,rows,'source-check');assert.equal(d.status,'insufficient');assert.match(findingLabel(d),/Research complete/);
  }
  assert.equal(matchesNarration('None of you truly believes until',other,other,null),false);
});
test('keep conflicting grades visible and reject an unbound external source',()=>{
  assert.equal(decideFinding(q,[row('1',target),row('2',target,'Weak')],'source-check').status,'conflicting-grades');
  assert.equal(decideFinding(q,[{...row('1',target),source_url:'https://example.org'}],'source-check').status,'insufficient');
});

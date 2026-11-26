import test from 'node:test';
import assert from 'node:assert/strict';
import {readClassicHadith} from '../src/server/hadith.ts';
import type {Hadith} from '../src/shared/types.ts';
import type {Lang} from '../src/shared/sources.ts';
const read=async(collection:string,number:number,lang:Lang)=>({collection,number,lang,text:'Previous rendering',arabic:'الأصل'} as Hadith);
test('only the Tamil-derived Sinhala draft gets the pending label, including its segmented body',async()=>{
  const h=await readClassicHadith('abudawud',1,'si',read);
  assert.equal(h?.translationProvenance?.sourceLanguage,'ta');
  assert.equal(h?.translationProvenance?.nativeReview,'pending');
  assert.match(h!.text,/ශරීර කෘත්‍යය/);
  assert.match(h!.segmented!.translation.matn,/ශරීර කෘත්‍යය/);
  for(const [c,n,l] of [['abudawud',1,'ta'],['abudawud',1,'en'],['abudawud',2,'si'],['muslim',1,'si']] as const){
    const other=await readClassicHadith(c,n,l,read);
    assert.equal(other?.translationProvenance,undefined);assert.equal(other?.text,'Previous rendering');
  }
});

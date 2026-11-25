import test from 'node:test';
import assert from 'node:assert/strict';
import type { Hadith } from '../src/shared/types.ts';
import {matchingTamilPassage,tamilMuslimReference} from '../src/shared/hadithReadingAlternative.ts';

test('only the reviewed Tamil cross-reference is eligible',()=>{
  assert.equal(tamilMuslimReference('8953','ta'),1258);
  assert.equal(tamilMuslimReference('8953','si'),null);
  assert.equal(tamilMuslimReference('8954','ta'),null);
});
test('extract the published portion, never a generated, stale or unrelated text',()=>{
  const text='மக்களே! வெங்காயமும் வெள்ளைப் பூண்டுமே. சமைத்து';
  const record={collection:'muslim',number:1258,lang:'ta',machineTranslation:false,text:'முன்னுரை '+text+' - மேற்கண்ட ஹதீஸ் குறிப்பு'} as Hadith;
  assert.equal(matchingTamilPassage(record,1258),text);
  for(const patch of [{lang:'en'},{number:1259},{collection:'bukhari'},{machineTranslation:true},{text:'different passage'}]){
    assert.equal(matchingTamilPassage({...record,...patch} as Hadith,1258),null);
  }
});

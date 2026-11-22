import test from 'node:test';
import assert from 'node:assert/strict';
import {openPassageUiEnabled} from '../src/lib/productBrand.ts';

test('Open Passage branding is opt-in; legacy installs keep their name',()=>{
  for(const flag of [undefined,'','0','false','off','no']) assert.equal(openPassageUiEnabled(flag),false);
  for(const flag of ['1','true','on','yes',' TRUE ']) assert.equal(openPassageUiEnabled(flag),true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OpenPassageGate} from '../src/server/openPassage/accessGate.ts';

test('explicit saves retain the original document across restart and isolate accounts',()=>{
  const dir=mkdtempSync(join(tmpdir(),'op-test-library-'));
  const file=join(dir,'gate.sqlite');
  let gate=new OpenPassageGate(file);
  try{
    const job={id:'fixture',ownerId:'alice',result:{question:'Fixture question',markdown:'# Exact fixture'}};
    assert.equal(gate.saveReport('bob',job),false);
    assert.equal(gate.saveReport('alice',{...job,ownerId:undefined}),false);
    assert.equal(gate.saveReport('alice',{...job,result:undefined}),false);
    assert.equal(gate.library('alice').length,0);
    assert.equal(gate.saveReport('alice',job),true);
    assert.equal(gate.saveReport('alice',job),true);
    gate.close();gate=new OpenPassageGate(file);
    assert.equal(gate.library('alice').length,1);
    assert.equal(gate.libraryDocument('alice','fixture')?.document,'# Exact fixture');
    assert.equal(gate.library('bob').length,0);
    assert.equal(gate.libraryDocument('bob','fixture'),undefined);
  }finally{gate.close();rmSync(dir,{recursive:true,force:true});}
});

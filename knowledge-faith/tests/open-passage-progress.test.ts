import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openPassageEvidence} from '../src/server/openPassage/evidence.ts';
import {generate,resetOpenPassageJobsForTests,type OpenPassageJob} from '../src/server/openPassage/jobs.ts';
import {initialProgress,progressCopy} from '../src/shared/openPassageProgress.ts';
import {ResearchProgress} from '../src/views/openPassage/ResearchProgress.tsx';
test('actual local retrieval reports only opened valid sources, without counting repeated references',async()=>{
  const searches:string[]=[],opened:string[]=[];
  const sources=await openPassageEvidence('16:90 and 16:90 and 99:999',e=>{'search' in e?searches.push(e.search):opened.push(e.opened);});
  assert.deepEqual(searches,['quran']);assert.deepEqual(opened,['quran:16:90']);assert.deepEqual(opened,sources.map(s=>s.id));
});
test('worker snapshots track actual operations and do not mark an incomplete report ready early',async()=>{
  resetOpenPassageJobsForTests(join(mkdtempSync(join(tmpdir(),'op-progress-')),'gate.sqlite'));
  const j:OpenPassageJob={id:'unit',state:'new',time:0,sources:[],audio:{}};
  const seen:string[]=[];
  await generate(j,'16:90','ta',{
    question:async q=>{seen.push(j.progress!.activity);return q;},text:async s=>{seen.push(j.progress!.activity);return s;},
    evidence:async(q,notify)=>{seen.push(j.progress!.activity);return openPassageEvidence(q,notify);},
    display:async(rows,_lang,checked)=>{assert.equal(j.progress!.editionsTotal,1);seen.push(j.progress!.activity);checked?.();return rows;},
    build:async(_q,_l,_sources,opts)=>{seen.push(j.progress!.activity);opts?.onRoundtableStart?.();seen.push(j.progress!.activity);return {status:'live_synthesis',agents:Array.from({length:7},()=>({title:'கேள்வி',summary:'ஆய்வு',keyPoints:[],citations:[]})),executiveSummary:'ஆய்வு',roundtableTurns:[]} as unknown as Awaited<ReturnType<typeof import('../src/server/sevenAgentService.ts').buildDynamicDossier>>;}
  });
  assert.deepEqual([...new Set(seen)],['prepare','quran','editions','analysis','roundtable','writing']);assert.equal(j.progress?.activity,'ready');assert.equal(j.progress.editionsChecked,1);
});
test('progress bar exposes current stage, actual references, localized copy, and no running state after failure',()=>{
  for(const lang of ['en','ta','si'] as const){
    const p={...initialProgress(),activity:'analysis' as const,opened:['quran:4:129','quran:19:25']};
    const html=renderToStaticMarkup(React.createElement(ResearchProgress,{lang,progress:p}));
    assert.ok(html.includes(progressCopy(lang).analysis));assert.ok(html.includes(`${progressCopy(lang).verse} 4:129`));assert.match(html,/role="progressbar"/);assert.match(html,/aria-valuenow="2"/);assert.doesNotMatch(html,/\d+%/);
    assert.equal(renderToStaticMarkup(React.createElement(ResearchProgress,{lang,progress:{...p,activity:'failed'}})),'');
  }
});

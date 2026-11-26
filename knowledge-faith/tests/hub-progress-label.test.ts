import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hubProgressLabel} from '../src/components/research/SevenAgentCountdownCard.tsx';
for(const lang of ['en','ta','si'] as const){
  test(`${lang}: clocks cannot advance the reported phase`,()=>{
    const waiting=hubProgressLabel(lang);
    assert.equal(hubProgressLabel(lang,'running','unreported'),waiting);
    assert.equal(hubProgressLabel(lang,'error','verify'),waiting);
    const stages=['understand','search','read','verify'].map(s=>hubProgressLabel(lang,'running',s));
    assert.equal(new Set([waiting,hubProgressLabel(lang,'queued'), ...stages,hubProgressLabel(lang,'done')]).size,7);
  });
}

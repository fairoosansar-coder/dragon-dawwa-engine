import {test} from 'node:test';
import assert from 'node:assert/strict';
import {citedRoundtableFromAgents,mergePostSynthesisTurns} from '../src/server/sevenAgentService.ts';
import {speakableTurn,listenerProbe,studioDirection} from '../src/shared/research/studioDialogue.ts';
import {writeBroadcastScript} from '../src/server/research/broadcastScript.ts';

type Payload=Parameters<typeof citedRoundtableFromAgents>[1];
const fixture={hadithSummary:'The wording describes a gift, not an exchange.',fiqhSummary:'A gift does not require repayment.',scienceSummary:'No experiment was included in the evidence.',executiveSummary:'Look at whether repayment was agreed.'} as Payload;
test('Tamil Ajwa: seven alternating beats, four named speakers, no stage directions spoken',()=>{
  const turns=citedRoundtableFromAgents('அஜ்வா பேரீச்சம்பழம் சாப்பிட்டால் விஷம் பாதிக்காதா?',fixture,[],'ta');
  assert.equal(turns.length,7);
  assert.equal(new Set(turns.map(t=>t.speaker)).size,4);
  assert.match(turns[0].text,/சோதித்துப் பார்க்கச் சொல்வதும் ஒன்றா/);
  assert.match(turns[2].text,/ஒரு நிமிடம்/);
  assert.match(turns[5].text,/மருத்துவச் சேவை/);
  for(const [i,t] of turns.entries()){
    assert.ok(speakableTurn(t.text,'ta'));
    assert.doesNotMatch(t.text,/\[|[a-z]/i);
    if(i)assert.notEqual(t.speaker,turns[i-1].speaker);
  }
});
test('retain evidence verbatim and reject wrong-role, wrong-language, role cue and lecture takes',()=>{
  const turns=citedRoundtableFromAgents('Is a gift really a loan?',fixture,[],'en');
  assert.equal(turns[1].text,fixture.hadithSummary);
  assert.equal(turns[3].text,fixture.fiqhSummary);
  assert.equal(turns[5].text,fixture.scienceSummary);
  assert.deepEqual(mergePostSynthesisTurns(turns,turns,'en'),turns);
  for(const bad of [{speaker:'Other'}, {text:'[warm & reflective] Yes.'},{text:'One. Two. Three. Four. Five.'},{text:'untested '.repeat(83)}]){
    assert.equal(mergePostSynthesisTurns(turns,turns.map((t,i)=>i===1?{...t,...bad}:t),'en'),null);
  }
  assert.equal(mergePostSynthesisTurns(turns,turns,'ta'),null);
});
test('broadcast speakers do not introduce themselves; absent agents never receive lines',()=>{
  const cast=['Tariq','Farhan','Zainab'].map((persona,i)=>({id:persona,persona,role:persona,speaker:persona+':',status:i===2?'not_run' as const:'ran' as const,finding:'இரண்டுக்கும் வேறுபாடு இருக்கிறது.'}));
  const script=writeBroadcastScript({question:'இதற்கு என்ன பொருள்?',language:'ta',agents:cast});
  assert.match(script,/இதற்கு என்ன பொருள்\?/);
  assert.doesNotMatch(script,/இங்கே இருக்கிறேன்|Zainab:/);
});
test('Feroz can challenge a science claim and let the same guest narrow it before closing',()=>{
  const base=citedRoundtableFromAgents('Who was studied?',fixture,[],'en');
  const host=base.at(-1)!,science=base.at(-2)!;
  const extended=[...base.slice(0,-1),{...host,text:'Wait, who was actually included in that study?'},{...science,text:'We cannot tell from this evidence.'},host];
  assert.equal(mergePostSynthesisTurns(base,extended,'en')?.length,9);
  assert.equal(mergePostSynthesisTurns(base,extended.map((t,i)=>i===6?{...t,text:'Thanks for the explanation.'}:t),'en'),null);
  assert.equal(mergePostSynthesisTurns(base,extended.map((t,i)=>i===7?{...t,speaker:host.speaker}:t),'en'),null);
  assert.match(listenerProbe('ta','ஆறு மடங்கு','source'),/கணக்கு யாரை/);
  assert.match(studioDirection('ta'),/உம்மா and வாப்பா/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {citedRoundtableFromAgents,mergePostSynthesisTurns} from '../src/server/sevenAgentService.ts';
import {speakableTurn,spokenFinding,spokenHostOpen,listenerProbe,studioDirection,studioCopy} from '../src/shared/research/studioDialogue.ts';
import {writeBroadcastScript,generatedHostLine} from '../src/server/research/broadcastScript.ts';

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
test('oversized broadcast findings keep a substantive excerpt instead of a generic placeholder',()=>{
  const longFinding =
    'The opened ayah establishes that Allah alone is worthy of worship. '.repeat(18) +
    'Surah 2, ayah 255: ' +
    '"'.repeat(2) +
    'x'.repeat(140) +
    '"'.repeat(2);
  assert.equal(speakableTurn(longFinding,'en'),false);
  const excerpt=spokenFinding(longFinding,'en');
  assert.match(excerpt,/Allah alone is worthy of worship/);
  assert.notEqual(excerpt,studioCopy.en.limit);
  assert.ok(speakableTurn(excerpt,'en'));
  const script=writeBroadcastScript({
    question:'What does the verse say?',
    language:'en',
    agents:[{id:'mushaf',role:'Mushaf reading',persona:'Dr. Tariq al-Mansoor',speaker:'DR. TARIQ:',status:'ran',finding:longFinding}],
  });
  assert.match(script,/Allah alone is worthy of worship/);
  assert.doesNotMatch(script,/short spoken version in this language is not available/);
});
test('host probes alternate before each specialist and URLs stay out of speech',()=>{
  const cast=[
    {id:'a',persona:'Tariq',role:'Tariq',speaker:'DR. TARIQ:',status:'ran' as const,finding:'Allah alone is worthy of worship (https://example.com/ayah).'},
    {id:'b',persona:'Layla',role:'Layla',speaker:'DR. LAYLA:',status:'ran' as const,finding:'Patience is mentioned beside that ayah.'},
    {id:'c',persona:'Yusuf',role:'Yusuf',speaker:'SHEIKH YUSUF:',status:'ran' as const,finding:'The commentary keeps the same distinction.'},
  ];
  const script=writeBroadcastScript({question:'What does the verse say?',language:'en',agents:cast});
  assert.doesNotMatch(script,/https?:\/\//i);
  assert.match(script,/Allah alone is worthy of worship/);
  const spoken=script.split(/\n\n/).filter(l=>!/^\[AUDIO CUE:/i.test(l));
  // Host open, Tariq, Host probe, Layla, Host probe, Yusuf = 6 spoken beats
  assert.equal(spoken.length,6);
  assert.match(spoken[0],/\(HOST\):/);
  assert.match(spoken[1],/DR\. TARIQ:/);
  assert.match(spoken[2],/\(HOST\):/);
  assert.match(spoken[3],/DR\. LAYLA:/);
  assert.match(spoken[4],/\(HOST\):/);
  assert.match(spoken[5],/SHEIKH YUSUF:/);
});
test('speakableTurn rejects arbitrary bracket cues and SSML; Ajwa nutrition is not poisoning',()=>{
  assert.equal(speakableTurn('[thoughtful] Yes.','en'),false);
  assert.equal(speakableTurn('<break time="300ms"/> Yes.','en'),false);
  assert.equal(spokenFinding('English only source.','ta'),studioCopy.ta.limit);
  assert.equal(spokenHostOpen('What about Ajwa dates?', 'ta'), studioCopy.ta.hook);
  assert.equal(generatedHostLine('What about Ajwa dates?', 'si'), studioCopy.si.hook);
  const nutrition=citedRoundtableFromAgents(
    'அஜ்வா பேரீச்சம்பழத்தின் சத்துக்கள் பற்றி சில விஷயங்கள் சொல்லுங்கள்?',
    fixture,
    [],
    'ta',
  );
  assert.doesNotMatch(nutrition.map(t=>t.text).join(' '),/சோதித்துப் பார்க்க|மருத்துவச் சேவை|நஞ்சு/);
  assert.match(nutrition[0].text,/சத்துக்கள்|விஷயங்கள்|நடைமுறையில்/);
  const poison=citedRoundtableFromAgents('அஜ்வா பேரீச்சம்பழம் சாப்பிட்டால் விஷம் பாதிக்காதா?',fixture,[],'ta');
  assert.match(poison[0].text,/சோதித்துப் பார்க்க/);
  const siTopic=citedRoundtableFromAgents('අජ්වා රටඉඳි ගැන විෂය කුමක්ද?',fixture,[],'si');
  assert.doesNotMatch(siTopic.map(t=>t.text).join(' '),/විෂ තොරතුරු|හදිසි වෛද්‍ය/);
  assert.notEqual(siTopic[0].text,studioCopy.si.limit);
  const siPoison=citedRoundtableFromAgents('අජ්වා රටඉඳි කෑවොත් විෂ බල නොපායිද?',fixture,[],'si');
  assert.match(siPoison[0].text,/අත්හදා බලන්න/);
});

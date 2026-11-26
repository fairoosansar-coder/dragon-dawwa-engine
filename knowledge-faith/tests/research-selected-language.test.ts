import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generate,resetOpenPassageJobsForTests,type OpenPassageJob} from '../src/server/openPassage/jobs.ts';
import {researchText,matchesResearchLanguage} from '../src/server/openPassage/localize.ts';
import {reportCopy} from '../src/shared/openPassageLanguage.ts';
import {OpenPassageGate} from '../src/server/openPassage/accessGate.ts';
import type {SevenAgentResearchDossier} from '../src/shared/sevenAgentTypes.ts';
import type {Lang} from '../src/shared/sources.ts';

const english='What does Qur’an 16:90 say about justice?';
const q={en:english,ta:'குர்ஆன் 16:90 நீதி குறித்து என்ன கூறுகிறது?',si:'කුර්ආනයේ 16:90 යුක්තිය ගැන පවසන්නේ කුමක්ද?'};
const answer={en:'Act justly.',ta:'நீதியுடன் நடக்க வேண்டும்.',si:'යුක්තිසහගතව කටයුතු කරන්න.'};
const source={id:'quran:16:90',locator:'16:90',canonicalUrl:'https://quran.com/16/90',text:'English source wording',provider:'test'};
for(const lang of ['ta','si','en'] as const){
 test(`English input produces a ${lang} question, seven findings, transcript and Markdown`,async()=>{
    resetOpenPassageJobsForTests(join(mkdtempSync(join(tmpdir(),'op-lang-')),'gate.sqlite'));
    const captured:string[]=[];
    const text=(s:string,l:Lang)=>researchText(s,l,async()=>s===english?q[l]:answer[l]);
    const job:OpenPassageJob={id:'example',time:0,state:'new',sources:[],audio:{}};
    await generate(job,english,lang,{question:text,text,evidence:async input=>{assert.equal(input,english);return [source];},display:async(rows,l)=>rows.map(r=>({...r,text:answer[l]})),
      build:async(question,l)=>{captured.push(question,l!);return {status:'live_synthesis',executiveSummary:'Act justly.',agents:Array.from({length:7},()=>({title:'Analysis',summary:'Act justly.',keyPoints:['Act justly.'],citations:['quran:16:90']})),roundtableTurns:[{speaker:'Host',text:'Act justly.'}]} as SevenAgentResearchDossier;}});
    assert.deepEqual(captured,[q[lang],lang]);assert.equal(job.state,'ready');
    const r=job.result!;assert.equal(r.language,lang);assert.equal(r.question,q[lang]);assert.equal(r.summary,answer[lang]);assert.equal(r.sections.length,7);
    assert.ok(r.sections.every(s=>matchesResearchLanguage(s.title,lang)&&s.summary===answer[lang]&&s.points[0]===answer[lang]&&s.citations[0]==='16:90'));
    assert.equal(r.turns[0].text,answer[lang]);assert.ok(r.markdown.includes(reportCopy(lang).transcript));assert.ok(r.markdown.includes(source.canonicalUrl));
    if(lang!=='en')assert.doesNotMatch(r.markdown,/Act justly|Plain-language answer|English source wording|What does/);
 });
}
test('English echoes, wrong scripts and changed numbered references are not labeled as translations',async()=>{
 for(const lang of ['ta','si'] as const){
   await assert.rejects(researchText(english,lang,async()=>english));
   await assert.rejects(researchText(english,lang,async()=>q[lang==='ta'?'si':'ta']));
   await assert.rejects(researchText(english,lang,async()=>q[lang].replace('16:90','16:91')));
   assert.equal(matchesResearchLanguage(`${answer[lang]} This paragraph is still English.`,lang),false);
 }
});
test('wrong-language retries do not reuse a report or grant a second guest pass',()=>{
 const gate=new OpenPassageGate(':memory:');
 try{const token=gate.mint(false);const jobs={a:{result:{full:true}}};
 assert.equal(gate.reserve(token,english,'a',{},'ta'),'a');gate.finish('a',true);
 assert.equal(gate.reserve(token,english,'b',jobs,'ta'),'a');
 assert.throws(()=>gate.reserve(token,english,'b',jobs,'si'),/google_required/);
 }finally{gate.close();}
});
test('sources-only report has a localized conclusion and transcript, without implying seven completed findings',async()=>{
 for(const lang of ['ta','si'] as const){
 const job:OpenPassageJob={id:'empty',time:0,state:'new',sources:[],audio:{}};
 await generate(job,english,lang,{question:async(_,l)=>q[l],text:async()=>{throw Error('unexpected synthesis')},evidence:async()=>[],display:async()=>[],build:async()=>{throw Error('should not synthesize')}});
 assert.equal(job.result?.full,false);assert.equal(job.result?.summary,reportCopy(lang).insufficientBody);assert.equal(job.result?.turns[0].text,q[lang]);
 }
});

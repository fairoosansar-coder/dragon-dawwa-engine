import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeGeminiVoice } from '../src/server/geminiTtsService.ts';
import { executeDragonDawwaAnalysis } from '../src/server/hadithEngine.ts';
test('missing Gemini configuration fails visibly without a sample dossier', async () => {
 const key=process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
 try {
  await assert.rejects(executeDragonDawwaAnalysis('Actions are according to intentions'), /GEMINI_API_KEY/);
  await assert.rejects(synthesizeGeminiVoice('test','Host'), /GEMINI_API_KEY/);
 } finally { if(key===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=key; }
});
test('TTS uses documented interactions payload and preserves selected voice', async () => {
 const original=global.fetch; const key=process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY='test-only';
 global.fetch=(async (url: string, options: any) => {
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/interactions');
  const body=JSON.parse(options.body);
  assert.equal(body.response_format.type,'audio'); assert.equal(body.generation_config.speech_config[0].voice,'Kore');
  assert.equal(body.input[0].content[0].text,'Test clip');
  return { ok:true, json:async()=>({steps:[{type:'model_output',content:[{type:'audio',data:'dGVzdA=='}]}]}) };
 }) as any;
 try { const result=await synthesizeGeminiVoice('Test clip','Host','Kore'); assert.equal(result.audioBase64,'dGVzdA=='); }
 finally { global.fetch=original; if(key===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=key; }
});
test('TTS access failure returns a safe error rather than generated fallback audio', async () => {
 const original=global.fetch; const key=process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY='test-only';
 global.fetch=(async()=>({ok:false,status:403})) as any;
 try { await assert.rejects(synthesizeGeminiVoice('Access test','Host'), /access was rejected/); }
 finally { global.fetch=original; if(key===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=key; }
});

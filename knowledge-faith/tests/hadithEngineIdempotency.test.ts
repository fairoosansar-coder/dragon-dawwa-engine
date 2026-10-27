import assert from 'node:assert/strict';
import { describe, mock, test } from 'node:test';
import { GoogleGenAI } from '@google/genai';
import { executeDragonDawwaAnalysis } from '../src/engine/server/hadithEngine.ts';

const generateCalls: string[] = [];
const probe = new GoogleGenAI({ apiKey: 'test-key' });
mock.method(Object.getPrototypeOf(probe.models), 'generateContentInternal', async () => {
  generateCalls.push('generateContent');
  return { text: '{"query_hadith":"from-model","agent_6_synthesis":{"final_status":"model"}}' };
});

const stored = {
  query_hadith: 'إنما الأعمال بالنيات',
  agent_6_synthesis: { final_status: 'sahih' },
};

describe('executeDragonDawwaAnalysis idempotency', { concurrency: 1 }, () => {
  test('a completed Supabase row is returned and generateContent is not called', async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousFetch = globalThis.fetch;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    const before = generateCalls.length;
    let query = '';
    globalThis.fetch = async input => {
      query = String(input);
      return Response.json([{ id: 'dossier-1', status: 'done', data: stored }]);
    };
    try {
      const result = await executeDragonDawwaAnalysis(stored.query_hadith, '', 'ta');
      assert.deepEqual(result, stored);
      assert.equal(generateCalls.length, before);
      const url = new URL(query);
      assert.equal(url.searchParams.get('status'), 'eq.done');
      assert.equal(url.searchParams.get('language'), 'eq."ta"');
      assert.equal(url.searchParams.get('hadith_input'), `eq."${stored.query_hadith}"`);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    }
  });

  test('a running row is not a hit and generateContent still runs', async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousGemini = process.env.GEMINI_API_KEY;
    const previousFetch = globalThis.fetch;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.GEMINI_API_KEY = 'test-key';
    const before = generateCalls.length;
    globalThis.fetch = async () => Response.json([{ id: 'running-1', status: 'running', data: stored }]);
    try {
      const result = await executeDragonDawwaAnalysis('a different hadith', '', 'en');
      assert.equal(result.agent_6_synthesis.final_status, 'model');
      assert.equal(generateCalls.length, before + 1);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
      if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousGemini;
    }
  });

  test('unset Supabase falls through to generateContent', async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousAnon = process.env.SUPABASE_ANON_KEY;
    const previousGemini = process.env.GEMINI_API_KEY;
    const previousFetch = globalThis.fetch;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    let fetched = false;
    const before = generateCalls.length;
    globalThis.fetch = async () => {
      fetched = true;
      return Response.json([]);
    };
    try {
      const result = await executeDragonDawwaAnalysis('unset path', '', 'en');
      assert.equal(fetched, false);
      assert.equal(result.agent_6_synthesis.final_status, 'model');
      assert.equal(generateCalls.length, before + 1);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
      if (previousAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
      else process.env.SUPABASE_ANON_KEY = previousAnon;
      if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousGemini;
    }
  });
});

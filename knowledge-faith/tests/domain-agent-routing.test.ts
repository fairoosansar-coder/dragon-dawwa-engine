import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getDragonDawwaSystemInstruction, executeDragonDawwaAnalysis } from '../src/engine/server/hadithEngine.ts';
import {
  DOMAIN_CONFIGS,
  parallelTaskInput,
  resolveDomainConfig,
  usesHadithAuthentication,
  type ResearchDomainId,
} from '../src/server/research/agentConfig.ts';
import { agentsThatRan, writeBroadcastScript } from '../src/server/research/broadcastScript.ts';
import { executeResearch, type ResearchPorts } from '../src/server/research/engine.ts';
import { orchestrateDomainResearch } from '../src/server/research/parallelOrchestrator.ts';
import { parallelApiKey } from '../src/server/research/parallelTask.ts';

const HADITH_TOKENS = ['takhrij', 'isnad', 'rijal', 'shawahid', 'matn', 'scholars', 'synthesis', 'hadeethenc'];
const COPIED_LABEL = /\bisnad\b|\brijal\b|\bshawahid\b|\btakhrij\b|\bmatn\b/i;

function agentText(domain: ResearchDomainId): string {
  return DOMAIN_CONFIGS[domain].agents
    .map(agent => `${agent.role}\n${agent.goal}\n${agent.systemPrompt}\n${agent.sourceTarget}`)
    .join('\n');
}

describe('domain agent map', () => {
  test('each domain has seven agents with a prompt, a goal, and a source', () => {
    for (const domain of ['hadith', 'quran', 'fiqh', 'seerah'] as const) {
      const agents = DOMAIN_CONFIGS[domain].agents;
      assert.equal(agents.length, 7);
      assert.equal(new Set(agents.map(agent => agent.id)).size, 7);
      assert.equal(new Set(agents.map(agent => agent.speaker)).size, 7);
      for (const agent of agents) {
        assert.ok(agent.systemPrompt.length > 40);
        assert.ok(agent.goal.length > 10);
        assert.ok(agent.sourceTarget.length > 8);
        assert.ok(agent.role.trim());
      }
    }
  });

  test('hadith keeps matn, isnad, and the six-plus-synthesis roles', () => {
    const instruction = getDragonDawwaSystemInstruction('en').toLowerCase();
    const blob = agentText('hadith').toLowerCase();
    for (const token of HADITH_TOKENS) {
      assert.match(blob, new RegExp(token));
      assert.match(instruction, new RegExp(token));
    }
    assert.equal(DOMAIN_CONFIGS.hadith.controller, 'gemini');
    assert.equal(usesHadithAuthentication(undefined), true);
    assert.equal(usesHadithAuthentication(''), true);
    assert.equal(usesHadithAuthentication('Hadith & Authentication'), true);
  });

  test('quran, fiqh, and seerah do not copy isnad or rijal labels', () => {
    for (const domain of ['quran', 'fiqh', 'seerah'] as const) {
      assert.equal(DOMAIN_CONFIGS[domain].controller, 'parallel');
      assert.equal(COPIED_LABEL.test(agentText(domain)), false);
    }
    assert.equal(resolveDomainConfig("Qur'an & Tafsir")?.label, "Qur'an");
    assert.equal(resolveDomainConfig('Fiqh & Everyday Life')?.label, 'Fiqh');
    assert.equal(resolveDomainConfig('Sirah')?.id, 'seerah');
    assert.equal(resolveDomainConfig('Comparative Religion'), null);
    assert.equal(usesHadithAuthentication("Qur'an"), false);
  });
});

describe('broadcast script', () => {
  test('includes the generated host and only agents that ran', () => {
    const script = writeBroadcastScript({
      question: 'What does the verse say?',
      language: 'en',
      agents: [
        {
          id: 'mushaf',
          role: 'Mushaf reading',
          persona: 'Dr. Tariq al-Mansoor',
          speaker: 'DR. TARIQ:',
          status: 'ran',
          finding: 'Surah 2, ayah 255: Allah, there is no god except Him.',
        },
        {
          id: 'thematic',
          role: 'Thematic ayahs',
          persona: 'Sheikh Yusuf al-Azhari',
          speaker: 'SHEIKH YUSUF:',
          status: 'not_run',
          finding: 'This finding must not be spoken.',
        },
      ],
    });
    assert.match(script, /I am a generated host/);
    assert.match(script, /Brother Feroz did not speak these words and did not approve them/);
    assert.match(script, /DR\. TARIQ:/);
    assert.match(script, /Mushaf reading/);
    assert.equal(script.includes('SHEIKH YUSUF:'), false);
    assert.equal(script.includes('This finding must not be spoken'), false);
    assert.equal(agentsThatRan([
      { id: 'a', role: 'Mushaf reading', persona: 'Dr. Tariq al-Mansoor', speaker: 'DR. TARIQ:', status: 'ran', finding: 'Opened.' },
      { id: 'b', role: 'Thematic ayahs', persona: 'Sheikh Yusuf al-Azhari', speaker: 'SHEIKH YUSUF:', status: 'not_run', finding: '' },
    ]).map(agent => agent.id).join(','), 'a');
  });

  test('uses the same writer for every domain', () => {
    const host = 'Welcome to Dragon Dawwa Live.';
    const quran = writeBroadcastScript({
      question: 'What does 2:255 say?',
      language: 'en',
      agents: [{ id: 'mushaf', role: 'Mushaf reading', persona: 'Dr. Tariq al-Mansoor', speaker: 'DR. TARIQ:', status: 'ran', finding: 'The ayah was opened.' }],
    });
    const seerah = writeBroadcastScript({
      question: 'When was the Hijrah?',
      language: 'en',
      agents: [{ id: 'narrative', role: 'Event narrative', persona: 'Dr. Tariq al-Mansoor', speaker: 'DR. TARIQ:', status: 'ran', finding: 'The book was opened.' }],
    });
    assert.equal(quran.includes(host), true);
    assert.equal(seerah.includes(host), true);
    assert.match(quran, /My role is Mushaf reading/);
    assert.match(seerah, /My role is Event narrative/);
    assert.equal(/\bisnad\b/i.test(quran + seerah), false);
  });
});

describe('Parallel category dispatch', () => {
  test('a completed category row is returned before any model call', async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousFetch = globalThis.fetch;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    const stored = {
      query_hadith: 'What does 2:255 say?',
      research_category: "Qur'an",
      agent_6_synthesis: { podcast_script: 'BROTHER FEROZ (HOST): stored', executive_report_markdown: 'stored' },
    };
    let calls = 0;
    let query = '';
    globalThis.fetch = async input => {
      calls += 1;
      query = String(input);
      return Response.json([{ id: 'dossier-quran', status: 'done', data: stored }]);
    };
    try {
      const result = await executeDragonDawwaAnalysis(stored.query_hadith, '', 'en', 'test-key', "Qur'an & Tafsir");
      assert.equal(calls, 1);
      assert.equal(result.agent_6_synthesis.podcast_script, stored.agent_6_synthesis.podcast_script);
      const url = new URL(query);
      assert.equal(url.searchParams.get('question'), `eq."${stored.query_hadith}"`);
      assert.equal(url.searchParams.get('category'), 'eq."Qur\'an"');
      assert.equal(url.searchParams.get('hadith_input'), null);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    }
  });

  test('hadith authentication still looks up the hadith text', async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousFetch = globalThis.fetch;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    const stored = { query_hadith: 'إنما الأعمال بالنيات', agent_6_synthesis: { final_status: 'sahih' } };
    let query = '';
    globalThis.fetch = async input => {
      query = String(input);
      return Response.json([{ id: 'dossier-hadith', status: 'done', data: stored }]);
    };
    try {
      const result = await executeDragonDawwaAnalysis(stored.query_hadith, '', 'en', 'test-key', 'Hadith & Authentication');
      assert.equal(result.agent_6_synthesis.final_status, 'sahih');
      const url = new URL(query);
      assert.equal(url.searchParams.get('hadith_input'), `eq."${stored.query_hadith}"`);
      assert.equal(url.searchParams.get('category'), null);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    }
  });

  test('one Parallel task carries the seven agents and the script omits agents that did not run', async () => {
    const calls: { url: string; body: string }[] = [];
    const ports = {
      searchHadeeth: async () => [],
      loadHadeeth: async () => { throw new Error('not opened'); },
      getVerses: async (refs: { surah: number; ayah: number }[]) => refs.map(ref => ({
        surah: ref.surah,
        ayah: ref.ayah,
        arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ',
        translation: 'Allah, there is no god except Him, the Ever-Living, the Sustainer of existence.',
        translator: 'Saheeh International',
        version: null,
        edition: 'quran-uthmani',
        url: `https://quranenc.com/en/ayah/${ref.surah}/${ref.ayah}`,
      })),
      searchScience: async () => 'not_configured' as const,
    } satisfies ResearchPorts;
    const result = await orchestrateDomainResearch({
      category: "Qur'an",
      query: 'What does Qur’an 2:255 mean?',
      language: 'en',
      deps: {
        apiKey: 'test-key',
        pollMs: 1,
        ports,
        lookup: async () => null,
        fetchImpl: async (url, init) => {
          calls.push({ url: String(url), body: String(init?.body ?? '') });
          return Response.json({
            run_id: 'run-quran',
            status: 'completed',
            output: {
              content: {
                findings: [],
                agents: [{
                  id: 'tafsir',
                  status: 'ran',
                  finding: 'The opened commentary describes Allah as the Ever-Living.',
                  sources: [{
                    title: 'Al-Mukhtasar 2:255',
                    url: 'https://quranenc.com/en/tafsir/2/255',
                    excerpt: 'The commentary on the Throne verse describes Allah as the Ever-Living and does not add a ruling.',
                  }],
                }],
              },
            },
          });
        },
        runResearch: input => executeResearch(input),
      },
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /https:\/\/api\.parallel\.ai\/v1\/tasks\/runs$/);
    const posted = JSON.parse(calls[0].body) as { input: string; task_spec: { output_schema: { json_schema: { properties: { agents?: unknown } } } } };
    assert.match(posted.input, /Do not start a separate model call per agent/);
    for (const agent of DOMAIN_CONFIGS.quran.agents) assert.match(posted.input, new RegExp(agent.id));
    assert.ok(posted.task_spec.output_schema.json_schema.properties.agents);
    assert.equal(parallelTaskInput(DOMAIN_CONFIGS.quran, 'What does Qur’an 2:255 mean?', 'en').includes('mushaf'), true);
    const script = result.agent_6_synthesis.podcast_script;
    assert.match(script, /I am a generated host/);
    assert.match(script, /DR\. TARIQ:/);
    assert.match(script, /DR\. LAYLA:/);
    assert.match(script, /DR\. ZAINAB:/);
    assert.match(script, /Tafsir/);
    assert.equal(script.includes('SHEIKH YUSUF:'), false);
    assert.equal(/\bisnad\b|\brijal\b/i.test(script), false);
    assert.equal(result.domain_agents?.find(agent => agent.id === 'thematic')?.status, 'not_run');
    assert.equal(result.domain_agents?.find(agent => agent.id === 'tafsir')?.status, 'ran');
    assert.equal(result.research_category, "Qur'an");
    assert.equal(result.parallel_run_id, 'run-quran');
    assert.match(result.agent_6_synthesis.executive_report_markdown, /## Agents that ran/);
    assert.match(result.agent_6_synthesis.executive_report_markdown, /one task/);
    assert.equal(result.agent_6_synthesis.final_status, 'Not a hadith grade');
  });

  test('an unknown category does not start hadith authentication', async () => {
    await assert.rejects(
      () => executeDragonDawwaAnalysis('What is this?', '', 'en', 'test-key', 'Comparative Religion'),
      /no research agents configured/,
    );
  });

  test('PARALLEL_AI_API_KEY is accepted by the existing client', () => {
    assert.equal(parallelApiKey({ PARALLEL_AI_API_KEY: 'dedicated', PARALLEL_API_KEY: 'other' }), 'dedicated');
    assert.equal(parallelApiKey({ PARALLEL_API_KEY: 'other' }), 'other');
    assert.equal(parallelApiKey({ PARALLEL_API_KEY: '' }), null);
  });
});

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ANALYSIS_CATEGORIES, HADITH_AUTHENTICATION_CATEGORY, usesHadithAuthentication } from '../src/engine/categories.ts';
import { executeDragonDawwaAnalysis } from '../src/engine/server/hadithEngine.ts';
import { getAllPodcastPersonas, getGeminiVoiceForSpeaker } from '../src/engine/server/geminiTtsService.ts';
import { executeParallelResearch } from '../src/server/research/categoryResearch.ts';
import { parallelApiKey } from '../src/server/research/parallelTask.ts';
import { generatedContentForLanguage } from '../src/engine/utils/contentLanguage.ts';
import { buildFullReportMarkdown } from '../src/engine/utils/agent7SourceResearch.ts';
import { readSavedResearch, upsertSavedResearch } from '../src/engine/utils/savedResearch.ts';
import { executeDragonDawwaAnalysis as executeRootAnalysis } from '../../src/server/hadithEngine.ts';
import { getGeminiVoiceForSpeaker as rootVoiceForSpeaker } from '../../src/server/geminiTtsService.ts';

const FINDING = {
  claim: 'Researchers disagree about how the comparison should be framed.',
  excerpt: 'The cited page records a disagreement and the surrounding historical context.',
  url: 'https://example.test/comparison',
  title: 'Comparison study',
  confidence: 'medium',
};

function parallelBody(finding = FINDING) {
  return {
    run_id: 'run-test',
    status: 'completed',
    output: { content: { findings: [finding] } },
  };
}

function modelJson(): string {
  return JSON.stringify({
    app_name: 'Dragon Dawwa',
    query_hadith: 'ignored',
    agent_1_takhrij: {
      sources: [{ collection: 'Invented', hadith_number: '1', exact_wording: 'should be cleared' }],
      variants_summary: 'invented',
    },
    agent_2_isnad: { narrator_sequence: ['Invented'], chain_links: [], overall_chain_status: 'invented' },
    agent_3_rijal: { narrators: [{ narrator_name: 'Invented', critic_verdicts: [], status: 'Thiqah', citations: [] }] },
    agent_4_shawahid_matn: { supporting_reports: ['invented'], hidden_defects_ilal: [], contradictions: [] },
    agent_5_scholars_verdict: { gradings: [{ scholar: 'Invented', grading: 'Sahih', reference: 'none' }] },
    agent_6_synthesis: {
      final_status: 'Sahih',
      purity_confidence_score: 99,
      consensus_and_disagreements: 'The cited page records a disagreement.',
      executive_report_markdown: 'The comparison is discussed in the returned study.',
      podcast_script: [
        'BROTHER FEROZ (HOST): This is a generated studio presenter. These words are not a personal statement or approval by Feroz.',
        'ZAYD (The Polymath Researcher): The cited study records a scholarly disagreement about the comparison.',
      ].join('\n'),
    },
  });
}

describe('category routing', () => {
  const saved = {
    parallelAi: process.env.PARALLEL_AI_API_KEY,
    parallel: process.env.PARALLEL_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };

  afterEach(() => {
    if (saved.parallelAi === undefined) delete process.env.PARALLEL_AI_API_KEY;
    else process.env.PARALLEL_AI_API_KEY = saved.parallelAi;
    if (saved.parallel === undefined) delete process.env.PARALLEL_API_KEY;
    else process.env.PARALLEL_API_KEY = saved.parallel;
    if (saved.gemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved.gemini;
  });

  it('lists the fifteen analyzer categories and keeps an omitted category on the hadith path', () => {
    assert.equal(ANALYSIS_CATEGORIES.length, 15);
    assert.equal(ANALYSIS_CATEGORIES[3], HADITH_AUTHENTICATION_CATEGORY);
    assert.equal(usesHadithAuthentication(undefined), true);
    assert.equal(usesHadithAuthentication(''), true);
    assert.equal(usesHadithAuthentication('Hadith & Authentication'), true);
    assert.equal(usesHadithAuthentication('Modern Science & Religion'), false);
    assert.ok(ANALYSIS_CATEGORIES.includes("Qur'an & Tafsir"));
    assert.ok(ANALYSIS_CATEGORIES.includes('Ask a Question'));
  });

  it('reads PARALLEL_AI_API_KEY first and PARALLEL_API_KEY when that is unset', () => {
    process.env.PARALLEL_AI_API_KEY = 'parallel-ai-test-key';
    process.env.PARALLEL_API_KEY = 'parallel-fallback-test-key';
    assert.equal(parallelApiKey(), 'parallel-ai-test-key');
    delete process.env.PARALLEL_AI_API_KEY;
    assert.equal(parallelApiKey(), 'parallel-fallback-test-key');
    delete process.env.PARALLEL_API_KEY;
    assert.equal(parallelApiKey(), null);
  });

  it('sends a non-hadith category through Parallel and forces the podcast schema', async () => {
    process.env.PARALLEL_AI_API_KEY = 'parallel-ai-test-key';
    let sawKey = false;
    let sawTask = false;
    const analysis = await executeParallelResearch('Comparative Religion', 'How do the accounts compare?', 'en', {
      pollMs: 1,
      geminiApiKey: '',
      fetchImpl: async (input, init) => {
        const url = String(input);
        sawTask = url === 'https://api.parallel.ai/v1/tasks/runs';
        const header = new Headers(init?.headers).get('x-api-key') ?? '';
        sawKey = header === 'parallel-ai-test-key';
        const body = JSON.parse(String(init?.body ?? '{}')) as { input?: string };
        assert.match(body.input ?? '', /Comparative Religion/);
        assert.match(body.input ?? '', /scholarly disagreements/);
        assert.match(body.input ?? '', /sources/i);
        return Response.json(parallelBody());
      },
      generateContent: async ({ systemInstruction, prompt }) => {
        assert.match(systemInstruction, /You are Amina, the Chair/);
        assert.match(systemInstruction, /ZAYD \(The Polymath Researcher\)/);
        assert.match(systemInstruction, /generated studio presenter/);
        assert.match(prompt, /https:\/\/example\.test\/comparison/);
        return modelJson();
      },
    });
    assert.equal(sawTask, true);
    assert.equal(sawKey, true);
    assert.equal(analysis.agent_1_takhrij.sources.length, 0);
    assert.equal(analysis.agent_1_takhrij.variants_summary, 'N/A');
    assert.deepEqual(analysis.agent_2_isnad.narrator_sequence, []);
    assert.equal(analysis.agent_2_isnad.overall_chain_status, 'N/A');
    assert.equal(analysis.agent_3_rijal.narrators.length, 0);
    assert.deepEqual(analysis.agent_4_shawahid_matn.supporting_reports, []);
    assert.equal(analysis.agent_5_scholars_verdict.gradings.length, 0);
    assert.equal(analysis.agent_6_synthesis.final_status, 'Not a hadith grade');
    assert.equal(analysis.agent_6_synthesis.purity_confidence_score, 0);
    assert.match(analysis.agent_6_synthesis.podcast_script, /BROTHER FEROZ \(HOST\):/);
    assert.match(analysis.agent_6_synthesis.podcast_script, /ZAYD \(The Polymath Researcher\):/);
    assert.match(analysis.agent_6_synthesis.podcast_script, /generated studio presenter/);
    assert.match(analysis.agent_6_synthesis.executive_report_markdown, /https:\/\/example\.test\/comparison/);
    assert.equal(analysis.content_language, 'en');
    assert.equal(analysis.research_category, 'Comparative Religion');
    assert.equal(analysis.agent_7_source_research, undefined);
    const report = buildFullReportMarkdown(analysis);
    assert.match(report, /Comparative Religion Research/);
    assert.doesNotMatch(report, /Agent 7|HadeethEnc/);
  });

  it('resumes the original Parallel run and excludes verbatim source excerpts from language validation', async () => {
    process.env.PARALLEL_AI_API_KEY = 'parallel-ai-test-key';
    const resultUrls: string[] = [];
    let resultCalls = 0;
    const analysis = await executeParallelResearch('Comparative Religion', 'Compare these accounts', 'en', {
      pollMs: 1,
      deadlineMs: 500,
      geminiApiKey: '',
      fetchImpl: async (input, init) => {
        const url = String(input);
        if (init?.method === 'POST') {
          return Response.json({ run_id: 'same-run', status: 'running' });
        }
        resultUrls.push(url);
        resultCalls += 1;
        if (resultCalls === 1) return new Response('', { status: 408 });
        if (resultCalls === 2) return Response.json({ run_id: 'same-run', status: 'running' });
        return Response.json(parallelBody({
          ...FINDING,
          title: 'தமிழ் source title',
          excerpt: 'தமிழ் மொழியில் உள்ள மூல உரை மேற்கோள்.',
        }));
      },
      generateContent: async () => modelJson(),
    });
    assert.equal(resultCalls, 3);
    assert.ok(resultUrls.every(url => url.includes('/same-run/')));
    assert.equal(analysis.content_language, 'en');
    assert.match(analysis.agent_6_synthesis.executive_report_markdown, /தமிழ்/);
    assert.doesNotMatch(
      generatedContentForLanguage(
        'An English podcast script.',
        'An English report.\n\n## Sources returned by Parallel.ai\n- தமிழ் source title',
      ),
      /தமிழ்/,
    );
  });

  it('fails only after the Parallel research deadline when its original run remains active', async () => {
    process.env.PARALLEL_AI_API_KEY = 'parallel-ai-test-key';
    await assert.rejects(
      () => executeParallelResearch('Comparative Religion', 'Compare these accounts', 'en', {
        pollMs: 1,
        deadlineMs: 30,
        fetchImpl: async (_input, init) => init?.method === 'POST'
          ? Response.json({ run_id: 'never-finished', status: 'running' })
          : new Response('', { status: 408 }),
        generateContent: async () => {
          assert.fail('Gemini must not receive an unfinished Parallel run');
        },
      }),
      /completion deadline/,
    );
  });

  it('adds the selected-language host disclaimer', async () => {
    process.env.PARALLEL_AI_API_KEY = 'parallel-ai-test-key';
    const tamil = JSON.parse(modelJson()) as ReturnType<typeof JSON.parse>;
    tamil.agent_6_synthesis.executive_report_markdown = 'இந்த ஒப்பீடு திரும்பிய ஆய்வில் விவரிக்கப்படுகிறது.';
    tamil.agent_6_synthesis.podcast_script = [
      'BROTHER FEROZ (HOST): This is a generated studio presenter. These words are not a personal statement or approval by Feroz.',
      'ZAYD (The Polymath Researcher): இந்த ஆய்வு ஒப்பீட்டைப் பற்றி விளக்குகிறது.',
    ].join('\n');
    const analysis = await executeParallelResearch('Comparative Religion', 'ஒப்பீடு என்ன?', 'ta', {
      pollMs: 1,
      geminiApiKey: '',
      fetchImpl: async () => Response.json(parallelBody()),
      generateContent: async () => JSON.stringify(tamil),
    });
    assert.match(analysis.agent_6_synthesis.podcast_script, /இது உருவாக்கப்பட்ட ஸ்டூடியோ தொகுப்பாளர் உரை/);
    assert.doesNotMatch(analysis.agent_6_synthesis.podcast_script, /generated studio presenter/);
  });

  it('retains the saved category and defaults legacy records to hadith', () => {
    const stored = JSON.stringify([
      { question: 'saved question', language: 'en', category: 'Comparative Religion' },
      { question: 'legacy question', language: 'en' },
    ]);
    const records = readSavedResearch({ getItem: () => stored });
    assert.equal(records[0].category, 'Comparative Religion');
    assert.equal(records[1].category, 'Hadith & Authentication');
    const updated = upsertSavedResearch(records, {
      question: 'saved question',
      language: 'en',
      category: 'Modern Science & Religion',
    });
    assert.equal(updated[0].category, 'Modern Science & Religion');
  });

  it('does not complete an answer when Parallel returns nothing', async () => {
    process.env.PARALLEL_API_KEY = 'parallel-fallback-test-key';
    delete process.env.PARALLEL_AI_API_KEY;
    let generated = false;
    await assert.rejects(
      () => executeParallelResearch('Faith & Philosophy', 'What is the argument?', 'en', {
        pollMs: 1,
        fetchImpl: async () => Response.json({ run_id: 'run-empty', status: 'completed', output: { content: { findings: [] } } }),
        generateContent: async () => {
          generated = true;
          return modelJson();
        },
      }),
      /no sources/,
    );
    assert.equal(generated, false);

    delete process.env.PARALLEL_API_KEY;
    let called = false;
    await assert.rejects(
      () => executeParallelResearch('Ask a Question', 'A question', 'en', {
        fetchImpl: async () => {
          called = true;
          return Response.json(parallelBody());
        },
      }),
      /not configured/,
    );
    assert.equal(called, false);
  });

  it('keeps Hadith & Authentication on the six-agent path and routes every other category to Parallel', async () => {
    process.env.PARALLEL_AI_API_KEY = 'parallel-ai-test-key';
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('api.parallel.ai')) return Response.json(parallelBody());
      return original(input, init);
    };
    try {
      const hadith = await executeDragonDawwaAnalysis(
        'Do not fast on Saturdays except for what has been made obligatory for you',
        '',
        'en',
        '',
        'Hadith & Authentication',
      );
      assert.match(hadith.agent_6_synthesis.podcast_script, /DR\.\s*AMINA:|BROTHER FEROZ/i);
      assert.equal(calls.some(url => url.includes('api.parallel.ai')), false);

      calls.length = 0;
      const omitted = await executeDragonDawwaAnalysis(
        'Do not fast on Saturdays except for what has been made obligatory for you',
        '',
        'en',
        '',
      );
      assert.ok(omitted.agent_6_synthesis.executive_report_markdown.length > 20);
      assert.equal(calls.some(url => url.includes('api.parallel.ai')), false);

      await assert.rejects(
        () => executeDragonDawwaAnalysis('How does fasting relate to metabolism?', '', 'en', '', 'Modern Science & Religion'),
        /GEMINI_API_KEY is missing/,
      );
      assert.equal(calls.some(url => url.includes('api.parallel.ai')), true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('routes the root analyzer the same way', async () => {
    process.env.PARALLEL_AI_API_KEY = 'parallel-ai-test-key';
    const calls: string[] = [];
    const original = globalThis.fetch;
    const gemini = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    globalThis.fetch = async (input, init) => {
      calls.push(String(input));
      if (String(input).includes('api.parallel.ai')) return Response.json(parallelBody());
      return original(input, init);
    };
    try {
      const hadith = await executeRootAnalysis('actions are by intentions', '', 'en', 'Hadith & Authentication');
      assert.ok(hadith.agent_6_synthesis.podcast_script.length > 10);
      assert.equal(calls.some(url => url.includes('api.parallel.ai')), false);
      await assert.rejects(
        () => executeRootAnalysis('How do the accounts compare?', '', 'en', 'Comparative Religion'),
        /GEMINI_API_KEY is missing/,
      );
      assert.equal(calls.some(url => url.includes('api.parallel.ai')), true);
    } finally {
      globalThis.fetch = original;
      if (gemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = gemini;
    }
  });

  it('maps Zayd to Orus and leaves the host voice on Puck', () => {
    assert.equal(getAllPodcastPersonas().length, 7);
    const host = getGeminiVoiceForSpeaker('BROTHER FEROZ (HOST)');
    assert.equal(host.voiceName, 'Puck');
    for (const speaker of ['Zayd', 'Polymath', 'Researcher', 'ZAYD (The Polymath Researcher)']) {
      const voice = getGeminiVoiceForSpeaker(speaker);
      assert.equal(voice.voiceName, 'Orus', speaker);
      assert.equal(voice.personaName.includes('Zayd'), true);
      assert.notEqual(voice.voiceName, host.voiceName);
    }
    assert.equal(getGeminiVoiceForSpeaker('DR. AMINA').voiceName, 'Aoede');
    assert.equal(getGeminiVoiceForSpeaker('Host').personaName.includes('Feroz'), true);
    const rootHost = rootVoiceForSpeaker('Brother Feroz');
    assert.equal(rootHost.voiceName, 'Puck');
    assert.equal(rootVoiceForSpeaker('Researcher').voiceName, 'Orus');
    assert.notEqual(rootVoiceForSpeaker('Zayd').voiceName, rootHost.voiceName);
  });
});

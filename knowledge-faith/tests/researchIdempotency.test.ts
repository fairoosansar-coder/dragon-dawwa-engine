import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { executeDragonDawwaAnalysis } from '../src/engine/server/hadithEngine.ts';
import { clearResearchJobs, getResearchJob } from '../src/engine/server/researchJobs.ts';
import { clearSharedResearchJobs, getSharedResearchJob } from '../src/server/research/jobs.ts';
import {
  eqFilter,
  findCompletedResearch,
  replayHadithAnalysis,
  replaySharedResearch,
  type SupabaseResearchConfig,
} from '../src/server/researchIdempotency.ts';
import { UpstreamError } from '../src/server/http.ts';

const config: SupabaseResearchConfig = {
  url: 'https://example.supabase.co',
  apiKey: 'service-key',
  tables: ['research_records'],
};

function jsonFetch(rows: unknown, capture: string[] = []): typeof fetch {
  return async input => {
    capture.push(String(input));
    return Response.json(rows);
  };
}

describe('research idempotency', { concurrency: 1 }, () => {
  test('eq filter quotes exact text', () => {
    assert.equal(eqFilter('say "hello"'), 'eq."say ""hello"""');
  });

  test('a finished hadith dossier is returned and Gemini is not required', async () => {
    clearResearchJobs();
    const urls: string[] = [];
    const body = await replayHadithAnalysis('إنما الأعمال بالنيات', 'ta', {
      config,
      fetch: jsonFetch(
        [
          {
            id: 'dossier-9',
            status: 'done',
            kind: 'dossier',
            data: { query_hadith: 'إنما الأعمال بالنيات', agent_6_synthesis: { verdict: 'sahih' } },
          },
        ],
        urls,
      ),
    });
    assert.ok(body);
    assert.equal(body.id, 'dossier-9');
    assert.equal(body.status, 'done');
    assert.equal((body.agent_6_synthesis as { verdict: string }).verdict, 'sahih');
    assert.equal(getResearchJob('dossier-9')?.status, 'done');
    const url = new URL(urls[0] ?? '');
    assert.equal(url.pathname, '/rest/v1/research_records');
    assert.equal(url.searchParams.get('status'), 'eq.done');
    assert.equal(url.searchParams.get('language'), 'eq."ta"');
    assert.equal(url.searchParams.get('hadith_input'), 'eq."إنما الأعمال بالنيات"');
    assert.equal(url.searchParams.get('question'), null);
    clearResearchJobs();
  });

  test('question and category must both match', async () => {
    const urls: string[] = [];
    const found = await findCompletedResearch(
      { question: 'Why do Muslims fast?', category: 'quran', language: 'en' },
      { config, fetch: jsonFetch([{ id: 'ep-4', status: 'done', kind: 'episode', data: { passages: [] } }], urls) },
    );
    assert.equal(found?.id, 'ep-4');
    assert.equal(found?.kind, 'episode');
    const url = new URL(urls[0] ?? '');
    assert.equal(url.searchParams.get('question'), 'eq."Why do Muslims fast?"');
    assert.equal(url.searchParams.get('category'), 'eq."quran"');
    assert.equal(url.searchParams.get('hadith_input'), null);
  });

  test('a shared research hit is published without starting providers', async () => {
    clearSharedResearchJobs();
    const replay = await replaySharedResearch('Why do Muslims fast?', 'en', 'quran', {
      scope: 'quran',
      teams: ['quran'],
      bookId: null,
      noticeId: null,
      forwardedFrom: null,
    }, {
      config,
      fetch: jsonFetch([{ id: 'job-7', status: 'done', kind: 'dossier', data: { passages: [{ id: 'p1' }], claims: [] } }]),
    });
    assert.equal(replay?.job.status, 'done');
    assert.equal(replay?.job.id, 'job-7');
    assert.equal(getSharedResearchJob('job-7')?.job.status, 'done');
    assert.equal(getSharedResearchJob('job-7')?.dossier?.passages.length, 1);
    clearSharedResearchJobs();
  });

  test('no match lets the caller start a job', async () => {
    const found = await replayHadithAnalysis('new text', 'en', { config, fetch: jsonFetch([]) });
    assert.equal(found, null);
  });

  test('rows that are not done are ignored', async () => {
    const found = await findCompletedResearch(
      { hadithInput: 'text', language: 'en' },
      { config, fetch: jsonFetch([{ id: 'running-1', status: 'running', data: { ok: true } }]) },
    );
    assert.equal(found, null);
  });

  test('a failed lookup does not look like a miss', async () => {
    const fetchImpl: typeof fetch = async () => new Response('no', { status: 500 });
    await assert.rejects(
      () => findCompletedResearch({ hadithInput: 'text', language: 'en' }, { config, fetch: fetchImpl }),
      (err: unknown) => err instanceof UpstreamError && err.status === 503,
    );
  });

  test('missing Supabase configuration does not query', async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      return Response.json([]);
    };
    const found = await findCompletedResearch({ hadithInput: 'text', language: 'en' }, { config: null, fetch: fetchImpl });
    assert.equal(found, null);
    assert.equal(called, false);
  });

  test('executeDragonDawwaAnalysis returns the saved dossier before Gemini', async () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousFetch = globalThis.fetch;
    process.env.SUPABASE_URL = config.url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = config.apiKey;
    let called = false;
    const stored = { query_hadith: 'text', agent_6_synthesis: { final_status: 'hasan' } };
    globalThis.fetch = async () => {
      called = true;
      return Response.json([{ id: 'saved-1', status: 'done', data: stored }]);
    };
    try {
      const result = await executeDragonDawwaAnalysis('text', '', 'si');
      assert.equal(called, true);
      assert.deepEqual(result, stored);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    }
  });
});

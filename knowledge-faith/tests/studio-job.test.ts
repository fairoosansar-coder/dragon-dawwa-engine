import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { researchJobDone, researchJobRunning } from '../src/shared/contracts/examples.ts';
import type { ResearchJobResponse } from '../src/shared/contracts/v1.ts';
import { questionUsesCurrentEpisode } from '../src/shared/studio/askIntent.ts';
import { isStaleResearchResponse, jobReadyForScript, passageMatchesLanguage } from '../src/shared/studio/jobReadiness.ts';
import type { TopicBrief } from '../src/shared/studio/contracts.ts';
import { UpstreamError } from '../src/server/http.ts';
import type { ResearchPorts } from '../src/server/research/engine.ts';
import { clearSharedResearchJobs, getSharedResearchJob, startSharedResearchJob } from '../src/server/research/jobs.ts';
import { loadCompletedResearchJob, referencesFromJob, waitForSharedResearchJob } from '../src/server/studio/fromJob.ts';
import { assembleStudioProductionFromJob } from '../src/server/studio/scriptFromJob.ts';
import { followResearchJob } from '../src/studio/followResearchJob.ts';
import { runStudioProductionPipeline } from '../src/server/studio/service.ts';

const NEIGHBOR = 'What are the rights of a neighbor? How should someone visit the sick?';

function brief(topic: string, lang: TopicBrief['lang'] = 'en'): TopicBrief {
  return {
    topic,
    audience: 'general',
    lang,
    durationMinutes: 4,
    familyId: 'research-room',
    learningObjective: 'Read the retrieved passages.',
    tone: 'warm_reflective',
    format: 'single_presenter',
    questions: [topic],
  };
}

function ports(over: Partial<ResearchPorts> = {}): ResearchPorts {
  return {
    searchHadeeth: async () => [],
    loadHadeeth: async () => {
      throw new Error('not opened');
    },
    getVerses: async () => [],
    searchScience: async () => 'not_configured',
    ...over,
  };
}

describe('research job script', { concurrency: 1 }, () => {
  it('keeps a quoted passage, its grade and locator, and leaves presenter lines unverified', () => {
    const job: ResearchJobResponse = structuredClone(researchJobDone);
    job.dossier?.claims.push({
      claim: 'A neighbor must be visited every hour.',
      passageIds: ['E6103'],
      support: 'unsupported',
      citationExists: true,
      quotationFaithful: false,
      citationRelevant: false,
      note: 'The opened passage does not say this.',
    });
    assert.equal(questionUsesCurrentEpisode(NEIGHBOR), false);
    assert.equal(jobReadyForScript(researchJobRunning), false);
    assert.equal(jobReadyForScript(job), true);
    assert.equal(isStaleResearchResponse(job.job.id, { job: { id: 'other-job' } }), true);
    assert.equal(isStaleResearchResponse(job.job.id, job), false);

    const built = assembleStudioProductionFromJob(brief(job.job.question), job, 'prod-neighbor', '2026-10-22T00:00:00.000Z');
    const quote = built.episode.segments.find(segment => segment.text === job.dossier?.passages[0]?.text);
    assert.ok(quote);
    assert.equal(built.episode.verification.unverified.includes(`Line ${quote.index + 1}`), false);
    assert.ok(built.episode.verification.unverified.includes('Line 1'));
    assert.equal(built.episode.verification.supported, false);
    assert.equal(built.episode.published, false);
    assert.equal(built.episode.editorialState, 'needs-review');
    assert.equal(built.episode.outline.length, 6);
    assert.equal(built.episode.references[0]?.grade, 'Authentic');
    assert.match(built.episode.references[0]?.locator ?? '', /HadeethEnc 6103/);
    assert.match(quote.translationEdition ?? '', /Grade: Authentic/);
    assert.match(quote.sectionLabel, /HadeethEnc 6103/);
    assert.ok(built.episode.gaps.some(gap => /unsupported: A neighbor must be visited every hour/i.test(gap.message)));
    assert.ok(built.episode.segments.some(segment => /stays unverified \(unsupported\)/i.test(segment.text)));
    assert.equal(built.dossierSummary.coverage[0]?.kind, 'budget_exhausted');
    assert.equal(built.dossierSummary.claims.some(claim => claim.support === 'unsupported'), true);
    assert.equal(built.episode.verification.gradesPreserved, true);
  });

  it('does not copy English text into a Tamil or Sinhala script', () => {
    for (const lang of ['ta', 'si'] as const) {
      const job = structuredClone(researchJobDone);
      job.job.language = lang;
      assert.equal(passageMatchesLanguage(job.dossier?.passages[0]?.text ?? '', lang), false);
      assert.throws(
        () => assembleStudioProductionFromJob(brief(job.job.question, lang), job, `prod-${lang}`, '2026-10-22T00:00:00.000Z'),
        (err: unknown) => {
          assert.ok(err instanceof UpstreamError);
          assert.equal(err.status, 422);
          assert.match(err.message, new RegExp(`requested in ${lang}`));
          assert.match(err.message, /was not copied into the script/);
          assert.doesNotMatch(err.message, /100% sahih|does not exist/i);
          return true;
        },
      );
    }
  });

  it('keeps a null dossier and a stale id out of the script, and separates a failed request from no evidence', async () => {
    const running = structuredClone(researchJobRunning);
    running.job.id = 'job-a';
    const stale = structuredClone(researchJobDone);
    stale.job.id = 'job-b';
    const done = structuredClone(researchJobDone);
    done.job.id = 'job-a';
    const progress: string[] = [];
    const steps: Array<{ status: number; body: unknown }> = [
      { status: 202, body: { id: 'job-a' } },
      { status: 200, body: running },
      { status: 200, body: stale },
      { status: 200, body: done },
    ];
    const ready = await followResearchJob({
      question: NEIGHBOR,
      lang: 'en',
      pauseMs: 0,
      onProgress: response => progress.push(response.job.id),
      fetchImpl: (async () => {
        const step = steps.shift();
        if (!step) throw new Error('no scripted response');
        return new Response(JSON.stringify(step.body), { status: step.status });
      }) as typeof fetch,
    });
    assert.equal(ready.job.id, 'job-a');
    assert.deepEqual(progress, ['job-a', 'job-a']);
    assert.equal(progress.includes('job-b'), false);
    assert.equal(jobReadyForScript(researchJobRunning), false);

    const failed = followResearchJob({
      question: NEIGHBOR,
      lang: 'en',
      pauseMs: 0,
      fetchImpl: (async (url: string) => {
        if (String(url).endsWith('/jobs')) {
          return new Response(JSON.stringify({ id: 'job-err' }), { status: 202 });
        }
        return new Response(
          JSON.stringify({
            ...researchJobRunning,
            job: {
              ...researchJobRunning.job,
              id: 'job-err',
              status: 'error',
              errors: [{ provider: 'HadeethEnc', message: 'HadeethEnc search failed: timeout' }],
            },
          }),
          { status: 200 },
        );
      }) as typeof fetch,
    });
    await assert.rejects(failed, /HadeethEnc search failed: timeout/);

    const empty = structuredClone(researchJobDone);
    empty.dossier = {
      ...empty.dossier!,
      passages: [],
      claims: [
        {
          claim: 'What is the population of Tokyo?',
          passageIds: [],
          support: 'insufficient',
          citationExists: false,
          quotationFaithful: null,
          citationRelevant: false,
          note: 'No opened passage contained a content term from this part of the question.',
        },
      ],
    };
    empty.job.coverage = [
      {
        kind: 'no_relevant_evidence',
        provider: 'dossier',
        detail: 'No opened passage matched this question in the material that was searched. The libraries were not read in full.',
      },
    ];
    const mapped = referencesFromJob(empty, 'en');
    assert.equal(mapped.references.length, 0);
    assert.match(mapped.gaps.map(gap => gap.message).join('\n'), /no relevant evidence/i);
    assert.doesNotMatch(mapped.gaps.map(gap => gap.message).join('\n'), /source unavailable/i);
  });

  it('cancels a running job and refuses to read a null dossier', async () => {
    clearSharedResearchJobs();
    let opened = 0;
    const hanging = (_lang: string, _phrase: string, _page: number, signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) => {
        const fail = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        if (signal.aborted) fail();
        else signal.addEventListener('abort', fail, { once: true });
      });
    const id = startSharedResearchJob('blocked question', 'en', ports({
      searchHadeeth: hanging,
      loadHadeeth: async () => {
        opened += 1;
        throw new Error('should not open');
      },
    }));
    assert.equal(getSharedResearchJob(id)?.dossier, null);
    assert.equal(jobReadyForScript(getSharedResearchJob(id)), false);
    assert.throws(() => loadCompletedResearchJob(id), /dossier is not ready/);

    const controller = new AbortController();
    const pending = waitForSharedResearchJob(NEIGHBOR, 'en', controller.signal, ports({ searchHadeeth: hanging }));
    controller.abort();
    await assert.rejects(pending, (err: unknown) => {
      assert.ok(err instanceof UpstreamError);
      assert.equal(err.status, 499);
      return true;
    });

    const { cancelSharedResearchJob } = await import('../src/server/research/jobs.ts');
    assert.equal(cancelSharedResearchJob(id)?.job.status, 'cancelled');
    assert.throws(() => loadCompletedResearchJob(id), /cancelled/);
    assert.equal(opened, 0);
    clearSharedResearchJobs();
  });

  it('posts cancel when the poll is aborted and does not treat that as a finished dossier', async () => {
    let cancelled = false;
    const controller = new AbortController();
    const pending = followResearchJob({
      question: NEIGHBOR,
      lang: 'en',
      signal: controller.signal,
      pauseMs: 5,
      fetchImpl: (async (url: string, init?: RequestInit) => {
        const target = String(url);
        if (target.endsWith('/cancel')) {
          cancelled = true;
          return new Response('{}', { status: 200 });
        }
        if (init?.method === 'POST') return new Response(JSON.stringify({ id: 'job-cancel' }), { status: 202 });
        return new Promise<Response>((_resolve, reject) => {
          const fail = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          if (init?.signal?.aborted) fail();
          else init?.signal?.addEventListener('abort', fail, { once: true });
        });
      }) as typeof fetch,
    });
    setTimeout(() => controller.abort(), 30);
    await assert.rejects(pending, (err: unknown) => err instanceof Error && err.name === 'AbortError');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(cancelled, true);
  });
});

describe('live studio research', { concurrency: 1 }, () => {
  it('researches a fresh neighbor question and reports Tamil and Sinhala availability', { timeout: 90_000 }, async () => {
    clearSharedResearchJobs();
    const english = await runStudioProductionPipeline({
      topic: NEIGHBOR,
      lang: 'en',
      familyId: 'research-room',
      format: 'single_presenter',
      durationMinutes: 4,
    });
    assert.equal(english.episode.published, false);
    assert.equal(english.episode.verification.supported, false);
    assert.ok(english.episode.references.length > 0);
    assert.ok(english.episode.references.some(reference => reference.grade && reference.locator));
    assert.ok(english.episode.segments.some(segment => english.episode.references.some(reference => reference.passage === segment.text)));
    assert.ok(english.dossierSummary.coverage.length > 0);
    assert.ok(english.dossierSummary.claims.length > 0);
    for (const reference of english.episode.references) {
      assert.equal(passageMatchesLanguage(reference.passage, 'en'), true);
      assert.equal(reference.passageLanguage, 'en');
    }

    for (const lang of ['ta', 'si'] as const) {
      try {
        const result = await runStudioProductionPipeline({
          topic: NEIGHBOR,
          lang,
          familyId: 'research-room',
          format: 'single_presenter',
        });
        for (const reference of result.episode.references) {
          assert.equal(passageMatchesLanguage(reference.passage, lang), true);
          assert.equal(reference.passageLanguage, lang);
        }
        assert.equal(result.episode.segments.some(segment => /Grade:/.test(segment.sectionLabel) || result.episode.references.some(reference => reference.locator)), true);
      } catch (err) {
        assert.ok(err instanceof UpstreamError);
        assert.equal(err.status, 422);
        assert.match(err.message, new RegExp(`${lang}|not copied|not available|language unavailable|no relevant evidence|source unavailable`, 'i'));
        assert.doesNotMatch(err.message, /does not exist in Islam|100% sahih/i);
      }
    }
    clearSharedResearchJobs();
  });
});

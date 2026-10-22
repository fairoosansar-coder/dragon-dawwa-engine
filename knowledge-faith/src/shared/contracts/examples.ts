/**
 * Endpoint examples for research contract 1.0.0.
 *
 * Ownership
 * - Research engine owns this directory, `/api/research/jobs`, `/api/library/*`, and `/api/names`.
 * - Studio owns `/api/studio/*`, `src/shared/studio/**`, `src/server/studio/**`, `src/studio/**`, and `src/views/PodcastStudio.tsx`.
 * - `server.ts` is shared. Research mounts the job, library, and names routes. Studio mounts `studioRouter` beside `spiritualRouter`.
 * - `src/lib/audio.ts` stays the only player. These examples do not start audio.
 * - `researchTopic` and `src/engine/server/researchJobs.ts` stay the podcast and AI-dossier helpers. They are not this job API.
 */
import type { ResearchJobResponse } from './v1.ts';

export const RESEARCH_JOBS_PATH = '/api/research/jobs';

export const createResearchJobRequest = {
  question: 'What are the rights of a neighbor? How should someone visit the sick?',
  lang: 'en',
} as const;

export const createResearchJobAccepted = {
  id: '50b72534-a7d5-45b6-b9de-2133021b281f',
  contractVersion: '1.0.0',
} as const;

/** Queries the job is expected to run. The full question is not one of them. */
export const createResearchJobQueries = [
  'rights neighbor',
  'neighbor',
  'rights',
  'visit sick',
  'visit',
  'sick',
] as const;

export const researchJobRunning: ResearchJobResponse = {
  contractVersion: '1.0.0',
  job: {
    contractVersion: '1.0.0',
    id: createResearchJobAccepted.id,
    question: createResearchJobRequest.question,
    language: 'en',
    subquestions: [
      {
        id: 'q1',
        text: 'What are the rights of a neighbor?',
        domain: 'practice',
        queries: ['rights neighbor', 'neighbor', 'rights'],
      },
      {
        id: 'q2',
        text: 'How should someone visit the sick?',
        domain: 'practice',
        queries: ['visit sick', 'visit', 'sick'],
      },
    ],
    status: 'running',
    progress: { step: 'read', completed: 3, total: 4 },
    coverage: [],
    errors: [],
    startedAt: '2026-10-21T22:04:00.000Z',
    finishedAt: null,
    timingsMs: { totalMs: 0, sources: {} },
  },
  dossier: null,
};

export const researchJobDone: ResearchJobResponse = {
  contractVersion: '1.0.0',
  job: {
    ...researchJobRunning.job,
    status: 'done',
    progress: { step: 'verify', completed: 4, total: 4 },
    coverage: [
      {
        kind: 'budget_exhausted',
        provider: 'HadeethEnc',
        detail: '158 search rows were not opened. A title was only used to choose what to open.',
      },
      {
        kind: 'evidence_found',
        provider: 'dossier',
        detail: '4 passage(s) were opened and kept.',
      },
    ],
    finishedAt: '2026-10-21T22:04:01.254Z',
    timingsMs: { totalMs: 1254, sources: { HadeethEnc: 1465 } },
  },
  dossier: {
    contractVersion: '1.0.0',
    jobId: createResearchJobAccepted.id,
    passages: [
      {
        contractVersion: '1.0.0',
        id: 'E6103',
        source: {
          contractVersion: '1.0.0',
          id: '6103',
          provider: 'HadeethEnc',
          language: 'en',
          edition: null,
          version: null,
          title: 'Feed the hungry, visit the sick, and arrange for the release of captives.',
          credits: [],
          canonicalUrl: 'https://hadeethenc.com/en/browse/hadith/6103',
          contentType: 'hadith',
          rights: {
            source: 'HadeethEnc.com',
            conditions: 'Preserve the published text, grade, and source. A Dragon Dawwa summary is separate work.',
            generatedWork: false,
            checkedOn: '2026-10-21',
          },
          retrievedAt: '2026-10-21T22:04:01.254Z',
          contentHash: null,
        },
        text: 'Feed the hungry, visit the sick, and arrange for the release of captives.',
        originalLanguage: 'en',
        arabic: null,
        locator: 'Narrated by Al-Bukhāri. HadeethEnc 6103',
        context: null,
        readerRoute: '#/hadith/6103?lang=en',
        role: 'source_text',
        publishedGrade: 'Authentic',
      },
    ],
    claims: [
      {
        claim: 'How should someone visit the sick?',
        passageIds: ['E6103'],
        support: 'supported',
        citationExists: true,
        quotationFaithful: true,
        citationRelevant: true,
        note: 'The passage contains the claim’s wording or its content words. This is not a scholarly verdict.',
      },
    ],
    unresolved: [],
    disagreements: [],
    verificationNote:
      'Citation existence, quotation fidelity and claim support are checked separately. A citation id alone is not support. This is not a scholarly verdict and not a claim of complete coverage.',
  },
};

export const cancelResearchJobResponse: ResearchJobResponse = {
  contractVersion: '1.0.0',
  job: {
    ...researchJobRunning.job,
    status: 'cancelled',
    finishedAt: '2026-10-21T22:04:00.400Z',
    errors: [],
  },
  dossier: null,
};

export const researchJobNotFound = { error: 'Unknown research job' } as const;

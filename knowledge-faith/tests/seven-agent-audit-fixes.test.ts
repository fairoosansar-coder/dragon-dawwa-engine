import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isScienceClaimDiagnostic,
  linkClaimToRetrievedPassages,
  linkClaimsToRetrievedPassages,
  passagesReferencedInText,
} from '../src/server/research/claimPassageLink.ts';
import {
  hydrateRetrievedPassagesFromResearchJobs,
  runSevenAgentResearch,
} from '../src/server/sevenAgentService.ts';
import {
  clearSharedResearchJobs,
  rememberCompletedSharedJob,
} from '../src/server/research/jobs.ts';
import type { ResearchJobResponse } from '../src/shared/contracts/v1.ts';
import {
  isSourcesOnlyOrUnavailable,
  reportOriginLabel,
  type SevenAgentResearchDossier,
} from '../src/shared/sevenAgentTypes.ts';
import type { ClaimEvidence, EvidencePassage } from '../src/shared/contracts/v1.ts';
import { RECONCILIATION_BASE_PROMPT } from '../src/server/research/agentConfig.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const deskSource = readFileSync(path.join(root, 'src/views/ResearchDesk.tsx'), 'utf8');
const boardSource = readFileSync(
  path.join(root, 'src/components/research/SevenAgentResearchBoard.tsx'),
  'utf8',
);

function passage(id: string, locator: string, text: string): EvidencePassage {
  return {
    contractVersion: '1.0.0',
    id,
    source: {
      contractVersion: '1.0.0',
      id: id.replace(/^Q/, '').replace('-', ':'),
      provider: 'QuranEnc',
      language: 'en',
      edition: 'en',
      version: null,
      title: locator,
      credits: [],
      canonicalUrl: `https://example.test/${id}`,
      contentType: 'quran',
      rights: {
        source: 'test',
        conditions: 'test',
        generatedWork: false,
        checkedOn: '2026-01-01',
      },
      retrievedAt: '2026-01-01T00:00:00.000Z',
      contentHash: null,
    },
    text,
    originalLanguage: 'en',
    arabic: null,
    locator,
    context: null,
    readerRoute: `#/quran/read?ref=${id}`,
    role: 'translation',
    publishedGrade: null,
  };
}

describe('seven-agent audit fixes — fallback status & confidence', () => {
  it('uses null confidence and sources_only/unavailable when live synthesis is off', async () => {
    process.env.SEVEN_AGENT_LIVE_SYNTHESIS = '0';
    const dossier = await runSevenAgentResearch(
      'What does Qur’an 49:6 teach about verifying news?',
      'en',
    );
    assert.equal(dossier.confidenceScore, null);
    assert.ok(dossier.status === 'sources_only' || dossier.status === 'unavailable');
    assert.equal(dossier.reportOrigin, 'sources_only');
    assert.equal(dossier.agents.every(agent => agent.confidenceScore === '—'), true);
    assert.equal(dossier.agents.some(agent => /90\.0%/.test(agent.confidenceScore)), false);
    assert.equal(
      dossier.agents.some(agent => agent.citations.includes('Awaiting live 7-agent synthesis')),
      false,
    );
    assert.match(dossier.verdictHeadline, /Sources Found|Executive Verdict Unavailable/);
  });

  it('exposes provenance helpers for ResearchDesk precedence', () => {
    const sourcesOnly: Pick<SevenAgentResearchDossier, 'status'> = { status: 'sources_only' };
    const live: Pick<SevenAgentResearchDossier, 'status'> = { status: 'live_synthesis' };
    assert.equal(isSourcesOnlyOrUnavailable(sourcesOnly), true);
    assert.equal(isSourcesOnlyOrUnavailable({ status: 'unavailable' }), true);
    assert.equal(isSourcesOnlyOrUnavailable(live), false);
    assert.equal(reportOriginLabel('cached_dossier'), 'Cached Dossier');
    assert.equal(reportOriginLabel('curated_benchmark'), 'Curated Benchmark');
    assert.equal(reportOriginLabel('live_synthesis'), 'Live Synthesis');
    assert.equal(reportOriginLabel('sources_only'), 'Sources Only');
  });
});

describe('seven-agent audit fixes — ResearchDesk precedence & badges', () => {
  it('keeps sources_only boards from replacing research-job passages', () => {
    assert.match(deskSource, /isSourcesOnlyOrUnavailable/);
    assert.match(deskSource, /sources-only-opened-passages/);
    assert.match(deskSource, /showResearchJobPassages/);
    assert.match(deskSource, /job=\$\{encodeURIComponent\(jobParam\)\}/);
    assert.match(boardSource, /seven-agent-report-origin-badge/);
    assert.match(boardSource, /Sources Found · Executive Verdict Unavailable/);
    assert.match(boardSource, /reportOriginLabel/);
  });
});

describe('seven-agent audit fixes — job hydration validation', () => {
  it('rejects an explicit jobId when question or language does not match', () => {
    clearSharedResearchJobs();
    const jobPassages = [passage('Q49-6', "Qur'an 49:6", 'Investigate news carefully.')];
    const response: ResearchJobResponse = {
      contractVersion: '1.0.0',
      job: {
        contractVersion: '1.0.0',
        id: 'job-verify-news',
        question: 'What does Qur’an 49:6 teach about verifying news?',
        language: 'en',
        status: 'done',
        startedAt: '2026-01-01T00:00:00.000Z',
        finishedAt: '2026-01-01T00:01:00.000Z',
        progress: { step: 'done', completed: 1, total: 1 },
        subquestions: [],
        coverage: [],
        errors: [],
        timingsMs: { totalMs: 10, sources: {} },
        investigation: 'complete',
      },
      dossier: {
        contractVersion: '1.0.0',
        jobId: 'job-verify-news',
        passages: jobPassages,
        claims: [],
        unresolved: [],
        disagreements: [],
        verificationNote: '',
        answer: null,
      },
    };
    rememberCompletedSharedJob(response, { scope: 'knowledge', teams: [], bookId: null });

    const mismatchedQuestion = hydrateRetrievedPassagesFromResearchJobs({
      question: 'Does embryonic development appear in Qur’an 23:14?',
      language: 'en',
      jobId: 'job-verify-news',
    });
    assert.equal(mismatchedQuestion.length, 0);

    const mismatchedLang = hydrateRetrievedPassagesFromResearchJobs({
      question: 'What does Qur’an 49:6 teach about verifying news?',
      language: 'ta',
      jobId: 'job-verify-news',
    });
    assert.equal(mismatchedLang.length, 0);

    const matched = hydrateRetrievedPassagesFromResearchJobs({
      question: 'What does Qur’an 49:6 teach about verifying news?',
      language: 'en',
      jobId: 'job-verify-news',
    });
    assert.equal(matched.length, 1);
    assert.equal(matched[0]?.id, 'Q49-6');
    clearSharedResearchJobs();
  });
});

describe('seven-agent audit fixes — claim-to-passage linking', () => {
  it('auto-links Qur’an 49:6 claims to passage Q49-6 without inventing support', () => {
    const passages = [
      passage('Q49-6', "Qur'an 49:6", 'O you who have believed, if there comes to you a disobedient one with information, investigate.'),
    ];
    assert.equal(passagesReferencedInText('See Qur’an 49:6 on verifying reports.', passages).length, 1);

    const claim: ClaimEvidence = {
      claim: 'Qur’an 49:6 requires verifying news before acting.',
      passageIds: [],
      support: 'insufficient',
      citationExists: false,
      quotationFaithful: null,
      citationRelevant: false,
      note: 'No passage linked yet.',
    };
    const linked = linkClaimToRetrievedPassages(claim, passages);
    assert.deepEqual(linked.passageIds, ['Q49-6']);
    assert.equal(linked.citationExists, true);
    assert.equal(linked.citationRelevant, true);
    assert.equal(linked.support, 'insufficient');

    const unrelated: ClaimEvidence = {
      claim: 'The moon is made of cheese.',
      passageIds: [],
      support: 'insufficient',
      citationExists: false,
      quotationFaithful: null,
      citationRelevant: false,
      note: 'Unrelated.',
    };
    const still = linkClaimsToRetrievedPassages([unrelated], passages)[0];
    assert.equal(still.citationExists, false);
    assert.deepEqual(still.passageIds, []);
    assert.equal(still.support, 'insufficient');
  });

  it('does not override science-domain empirical diagnostics with Qur’an verse links', () => {
    const passages = [
      passage(
        'Q23-14',
        "Qur'an 23:14",
        'Then We made the sperm-drop into a clinging clot, and We made the clot into a lump.',
      ),
    ];
    const scienceClaim: ClaimEvidence = {
      claim: 'Does embryonic biology in Qur’an 23:14 anticipate modern science?',
      passageIds: [],
      support: 'insufficient',
      citationExists: false,
      quotationFaithful: null,
      citationRelevant: false,
      note: 'No empirical record was retrieved for this part of the question. Religious passages were not used as scientific evidence.',
    };
    assert.equal(isScienceClaimDiagnostic(scienceClaim), true);
    const kept = linkClaimToRetrievedPassages(scienceClaim, passages);
    assert.deepEqual(kept.passageIds, []);
    assert.equal(kept.citationExists, false);
    assert.equal(kept.citationRelevant, false);
    assert.match(kept.note, /empirical record/);
  });
});

describe('seven-agent audit fixes — domain routing labels', () => {
  it('keeps isnad/rijal/takhrij out of non-hadith reconciliation prompts', () => {
    assert.equal(/\bisnad\b|\brijal\b|\bshawahid\b|\btakhrij\b|\bmatn\b/i.test(RECONCILIATION_BASE_PROMPT), false);
  });
});

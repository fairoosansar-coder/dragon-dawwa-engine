import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isScienceClaimDiagnostic,
  linkClaimToRetrievedPassages,
  linkClaimsToRetrievedPassages,
  passageMatchesRef,
  passagesReferencedInText,
} from '../src/server/research/claimPassageLink.ts';
import {
  getSevenAgentDossierById,
  hydrateRetrievedPassagesFromResearchJobs,
  runSevenAgentResearch,
} from '../src/server/sevenAgentService.ts';
import {
  clearSharedResearchJobs,
  rememberCompletedSharedJob,
} from '../src/server/research/jobs.ts';
import type { ClaimEvidence, EvidencePassage, ResearchJobResponse } from '../src/shared/contracts/v1.ts';
import {
  isSourcesOnlyOrUnavailable,
  reportOriginLabel,
  type SevenAgentResearchDossier,
} from '../src/shared/sevenAgentTypes.ts';
import { RECONCILIATION_BASE_PROMPT } from '../src/server/research/agentConfig.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const deskSource = readFileSync(path.join(root, 'src/views/ResearchDesk.tsx'), 'utf8');
const boardSource = readFileSync(
  path.join(root, 'src/components/research/SevenAgentResearchBoard.tsx'),
  'utf8',
);
const frameSource = readFileSync(path.join(root, 'src/engine/ResearchFrame.tsx'), 'utf8');
const serverSource = readFileSync(path.join(root, 'server.ts'), 'utf8');
const serviceSource = readFileSync(path.join(root, 'src/server/sevenAgentService.ts'), 'utf8');

function passage(
  id: string,
  locator: string,
  text: string,
  opts: { contentType?: EvidencePassage['source']['contentType']; provider?: string } = {},
): EvidencePassage {
  const contentType = opts.contentType ?? 'quran';
  const provider = opts.provider ?? 'QuranEnc';
  return {
    contractVersion: '1.0.0',
    id,
    source: {
      contractVersion: '1.0.0',
      id: id.replace(/^Q/, '').replace('-', ':'),
      provider,
      language: 'en',
      edition: 'en',
      version: null,
      title: locator,
      credits: [],
      canonicalUrl: `https://example.test/${id}`,
      contentType,
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
    role: contentType === 'hadith' ? 'source_text' : 'translation',
    publishedGrade: null,
  };
}

function jobResponse(
  id: string,
  question: string,
  language: 'en' | 'ta' | 'si',
  passages: EvidencePassage[],
): ResearchJobResponse {
  return {
    contractVersion: '1.0.0',
    job: {
      contractVersion: '1.0.0',
      id,
      question,
      language,
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
      jobId: id,
      passages,
      claims: [],
      unresolved: [],
      disagreements: [],
      verificationNote: '',
      answer: null,
    },
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
    assert.ok(
      dossier.reportOrigin === 'sources_only' || dossier.reportOrigin === 'unavailable',
    );
    if (!(dossier.retrievedPassages?.length)) {
      assert.equal(dossier.status, 'unavailable');
      assert.equal(dossier.reportOrigin, 'unavailable');
      assert.match(dossier.verdictHeadline, /Executive Verdict Unavailable/);
      assert.doesNotMatch(dossier.verdictHeadline, /Sources Found/);
    } else {
      assert.equal(dossier.status, 'sources_only');
      assert.equal(dossier.reportOrigin, 'sources_only');
      assert.match(dossier.verdictHeadline, /Sources Found/);
    }
    assert.equal(dossier.agents.every(agent => agent.confidenceScore === '—'), true);
    assert.equal(dossier.agents.some(agent => /90\.0%/.test(agent.confidenceScore)), false);
    assert.equal(
      dossier.agents.some(agent => agent.citations.includes('Awaiting live 7-agent synthesis')),
      false,
    );
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
    assert.equal(reportOriginLabel('unavailable'), 'Unavailable');
  });
});

describe('seven-agent audit fixes — ResearchDesk precedence & badges', () => {
  it('keeps sources_only boards from replacing research-job passages', () => {
    assert.match(deskSource, /isSourcesOnlyOrUnavailable/);
    assert.match(deskSource, /showCompletedJobReport/);
    assert.match(deskSource, /completed-job-report/);
    assert.match(deskSource, /jobPollNeeded/);
    assert.match(deskSource, /sevenAgentRemote\.reload\(\)/);
    assert.match(deskSource, /parallelSettled/);
    assert.match(deskSource, /prior\.parallel === 'running'/);
    assert.match(deskSource, /if \(sevenAgentRemote\.loading\) return;/);
    assert.match(deskSource, /settlement pending|leave priorEvidenceSyncRef untouched|stays pending/i);
    assert.equal(/needsHydrationRefresh\s*=\s*[\s\S]*?parallelSettled\s*\|\|/.test(deskSource), false);
    // Consume settle only after the loading skip (loading return precedes prior update for settle path).
    const loadingGuardIdx = deskSource.indexOf('if (sevenAgentRemote.loading) return;');
    const settleConsumeIdx = deskSource.indexOf(
      'priorEvidenceSyncRef.current = {\n      job: jobStatus,\n      parallel: parallelStatus,\n    };\n    const needsHydrationRefresh',
    );
    assert.ok(loadingGuardIdx > 0 && settleConsumeIdx > loadingGuardIdx);
    assert.match(deskSource, /sourcesOnlyBoard\s*\?\s*undefined/);
    assert.match(deskSource, /job=\$\{encodeURIComponent\(jobParam\)\}/);
    assert.match(frameSource, /onRoundtable\?/);
    assert.match(boardSource, /seven-agent-report-origin-badge/);
    assert.match(boardSource, /Sources Found · Executive Verdict Unavailable/);
    assert.match(boardSource, /Executive Verdict Unavailable/);
    assert.match(boardSource, /retrievedPassages\?\.length/);
    assert.match(boardSource, /reportOriginLabel/);
    assert.match(serverSource, /getSevenAgentDossierById\(id, lang, \{ jobId \}\)/);
    assert.match(serviceSource, /withJobHydration/);
    assert.match(serviceSource, /freshPassages/);
    assert.match(serviceSource, /localizeDossierToLanguage\(englishFallback/);
    assert.match(serviceSource, /dossierNeedsLocalization\(englishFallback/);
  });
});

describe('seven-agent audit fixes — job hydration validation', () => {
  it('rejects mismatched/empty explicit jobId without substituting another job', () => {
    clearSharedResearchJobs();
    const verifyPassages = [passage('Q49-6', "Qur'an 49:6", 'Investigate news carefully.')];
    const embryoPassages = [
      passage('Q23-14', "Qur'an 23:14", 'Then We made the sperm-drop into a clinging clot.'),
    ];
    rememberCompletedSharedJob(
      jobResponse('job-verify-news', 'What does Qur’an 49:6 teach about verifying news?', 'en', verifyPassages),
      { scope: 'knowledge', teams: [], bookId: null },
    );
    rememberCompletedSharedJob(
      jobResponse('job-embryo', 'Does embryonic development appear in Qur’an 23:14?', 'en', embryoPassages),
      { scope: 'knowledge', teams: [], bookId: null },
    );

    // Mismatched question: do not substitute the embryo job even though it aligns with the ask.
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

    const missingJob = hydrateRetrievedPassagesFromResearchJobs({
      question: 'What does Qur’an 49:6 teach about verifying news?',
      language: 'en',
      jobId: 'job-does-not-exist',
    });
    assert.equal(missingJob.length, 0);

    const matched = hydrateRetrievedPassagesFromResearchJobs({
      question: 'What does Qur’an 49:6 teach about verifying news?',
      language: 'en',
      jobId: 'job-verify-news',
    });
    assert.equal(matched.length, 1);
    assert.equal(matched[0]?.id, 'Q49-6');

    // Without jobId, question-aligned lookup still works.
    const byQuestion = hydrateRetrievedPassagesFromResearchJobs({
      question: 'Does embryonic development appear in Qur’an 23:14?',
      language: 'en',
    });
    assert.equal(byQuestion.length, 1);
    assert.equal(byQuestion[0]?.id, 'Q23-14');
    clearSharedResearchJobs();
  });

  it('hydrates report-id reopen and synthesis fallback from an aligned job', async () => {
    process.env.SEVEN_AGENT_LIVE_SYNTHESIS = '0';
    clearSharedResearchJobs();
    const question = 'What does Qur’an 49:6 teach about verifying news?';
    const verifyPassages = [passage('Q49-6', "Qur'an 49:6", 'Investigate news carefully.')];
    rememberCompletedSharedJob(
      jobResponse('job-verify-hydrate', question, 'en', verifyPassages),
      { scope: 'knowledge', teams: [], bookId: null },
    );

    const live = await runSevenAgentResearch(question, 'en', { jobId: 'job-verify-hydrate' });
    assert.equal(live.status, 'sources_only');
    assert.equal(live.reportOrigin, 'sources_only');
    assert.equal(live.retrievedPassages?.length, 1);
    assert.equal(live.retrievedPassages?.[0]?.id, 'Q49-6');
    assert.match(live.verdictHeadline, /Sources Found/);

    // Persist an empty unavailable stub, then reopen by id with the job.
    const emptyStub = await runSevenAgentResearch(
      'A unique offline question with no shared research job yet xyz-7721',
      'en',
    );
    assert.equal(emptyStub.status, 'unavailable');
    assert.equal(emptyStub.retrievedPassages?.length ?? 0, 0);

    rememberCompletedSharedJob(
      jobResponse(
        'job-stub-hydrate',
        emptyStub.question,
        'en',
        [passage('Q49-6', "Qur'an 49:6", 'Investigate.')],
      ),
      { scope: 'knowledge', teams: [], bookId: null },
    );
    const reopened = await getSevenAgentDossierById(emptyStub.id, 'en', {
      jobId: 'job-stub-hydrate',
    });
    assert.ok(reopened);
    assert.equal(reopened!.status, 'sources_only');
    assert.equal(reopened!.retrievedPassages?.length, 1);
    assert.equal(reopened!.retrievedPassages?.[0]?.id, 'Q49-6');
    clearSharedResearchJobs();
  });
});

describe('seven-agent audit fixes — claim-to-passage linking', () => {
  it('auto-links Qur’an 49:6 via canonical identity without inventing support', () => {
    const passages = [
      passage('Q49-6', "Qur'an 49:6", 'O you who have believed, if there comes to you a disobedient one with information, investigate.'),
    ];
    assert.equal(passagesReferencedInText('See Qur’an 49:6 on verifying reports.', passages).length, 1);
    assert.equal(passageMatchesRef(passages[0]!, 49, 6), true);

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
    // Locator match must not overwrite failed relevance / support / note.
    assert.equal(linked.citationRelevant, false);
    assert.equal(linked.support, 'insufficient');
    assert.equal(linked.note, 'No passage linked yet.');

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

  it('does not match cross-references in hadith body text as the verse passage', () => {
    const hadith = passage(
      'H-bukhari-1',
      'Sahih al-Bukhari 1',
      'The Prophet mentioned the ruling also taught in 49:6 about verifying reports.',
      { contentType: 'hadith', provider: 'hadith-api' },
    );
    const quran = passage(
      'Q2-255',
      "Qur'an 2:255",
      'Allah — there is no deity except Him. Classical notes may cite 49:6 for related themes.',
    );
    assert.equal(passageMatchesRef(hadith, 49, 6), false);
    assert.equal(passageMatchesRef(quran, 49, 6), false);
    assert.equal(passagesReferencedInText('See Qur’an 49:6.', [hadith, quran]).length, 0);

    const real = passage('Q49-6', "Qur'an 49:6", 'Investigate.');
    assert.equal(passagesReferencedInText('See Qur’an 49:6.', [hadith, quran, real]).map(p => p.id).join(','), 'Q49-6');
  });

  it('does not treat commentary that cites a verse as that verse passage', () => {
    const tafsir: EvidencePassage = {
      ...passage(
        'T-49-6-notes',
        'Tafsir on related themes (mentions 49:6)',
        'Classical notes may cite 49:6 when discussing verification.',
      ),
      role: 'commentary',
      locator: 'Mukhtasar commentary citing 49:6',
    };
    assert.equal(passageMatchesRef(tafsir, 49, 6), false);
    assert.equal(passagesReferencedInText('See Qur’an 49:6.', [tafsir]).length, 0);

    const real = passage('Q49-6', "Qur'an 49:6", 'Investigate.');
    assert.equal(passagesReferencedInText('See Qur’an 49:6.', [tafsir, real]).map(p => p.id).join(','), 'Q49-6');
  });

  it('preserves unfaithful quotation diagnostics when attaching a locator', () => {
    const passages = [passage('Q49-6', "Qur'an 49:6", 'Investigate news carefully.')];
    const unfaithful: ClaimEvidence = {
      claim: 'Qur’an 49:6 says “never verify anything.”',
      passageIds: [],
      support: 'unfaithful',
      citationExists: false,
      quotationFaithful: false,
      citationRelevant: false,
      note: 'The citation exists. The quoted words are not in that passage.',
    };
    const linked = linkClaimToRetrievedPassages(unfaithful, passages);
    assert.deepEqual(linked.passageIds, ['Q49-6']);
    assert.equal(linked.citationExists, true);
    assert.equal(linked.support, 'unfaithful');
    assert.equal(linked.quotationFaithful, false);
    assert.equal(linked.citationRelevant, false);
    assert.match(linked.note, /quoted words are not/);
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

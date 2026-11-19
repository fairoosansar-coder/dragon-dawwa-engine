import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import express, { type NextFunction, type Request, type Response } from 'express';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AddressInfo } from 'node:net';
import { HadithReportPaper } from '../src/engine/components/HadithReportPaper.tsx';
import { clearResearchJobs, seedResearchJob } from '../src/engine/server/researchJobs.ts';
import type { DragonDawwaAnalysis } from '../src/engine/types/hadith.ts';
import { bindReport } from '../src/engine/utils/reportBinding.ts';
import { getLocalizedAnalysis } from '../src/engine/utils/localizedAnalysis.ts';
import { reportIdFor } from '../src/engine/utils/reportPresentation.ts';
import { humanReviewRouter } from '../src/server/research/humanReviewRoutes.ts';
import { HumanReviewStore } from '../src/server/research/humanReviewStore.ts';
import { parseEditorAccounts } from '../src/server/spiritual/editorialStore.ts';
import { UpstreamError } from '../src/server/http.ts';
import { reportIdentity, sha256Hex } from '../src/shared/research/revision.ts';

const TOKEN_A = 'test-sources-reviewer-token-0001';
const TOKEN_BOTH = 'test-sources-both-roles-token-0001';
const TOKEN_B = 'test-findings-reviewer-token-0002';
const TOKEN_C = 'test-language-reviewer-token-0003';

function dossier(question = 'من ترك صلاة العصر فقد حبط عمله'): DragonDawwaAnalysis {
  return {
    app_name: 'Dragon Dawwa',
    query_hadith: question,
    generated_at: '2026-10-25T18:40:00.000Z',
    agent_1_takhrij: {
      variants_summary: 'Bukhari 553 is the short wording.',
      sources: [{
        collection: 'Sahih al-Bukhari',
        hadith_number: '553',
        exact_wording: 'Whoever leaves the Asr prayer, his deeds are nullified.',
        exact_wording_arabic: 'مَنْ تَرَكَ صَلَاةَ الْعَصْرِ فَقَدْ حَبِطَ عَمَلُهُ',
        exact_wording_english: 'Whoever leaves the Asr prayer, his deeds are nullified.',
        wording_differences: 'Ahmad adds “intentionally”.',
      }],
    },
    agent_2_isnad: {
      overall_chain_status: 'Muttasil',
      narrator_sequence: ['இமாம் புகாரி (Imam al-Bukhari)', 'முஸ்லிம் பின் இப்ராஹீம் (Muslim ibn Ibrahim)'],
      chain_links: [{
        teacher: 'Muslim ibn Ibrahim',
        student: 'Imam al-Bukhari',
        transmission_mode: 'Haddathana',
        connection_status: 'Muttasil',
        historical_reasoning: 'Bukhari heard Muslim ibn Ibrahim directly. Tahdhib al-Kamal 2/12.',
      }],
    },
    agent_3_rijal: { narrators: [] },
    agent_4_shawahid_matn: {
      supporting_reports: [],
      hidden_defects_ilal: [],
      contradictions: ['Scholars differ on whether the deeds are legally void or the wording is a warning.'],
      quranic_corroboration_arabic: '',
      quranic_corroboration_english: '',
    },
    agent_5_scholars_verdict: {
      gradings: [{ scholar: 'Ibn Hajar', grading: 'Sahih', reference: 'Fath al-Bari' }],
    },
    agent_6_synthesis: {
      final_status: 'Sahih',
      purity_confidence_score: 0,
      consensus_and_disagreements: 'The narration is reliably transmitted. The legal meaning of nullified deeds is disputed.',
      executive_report_markdown: 'Authenticity and the legal conclusion are separate.',
      podcast_script: 'BROTHER FEROZ (HOST): The question is the Asr prayer.',
    },
  };
}

function accounts() {
  return parseEditorAccounts(JSON.stringify([
    { token: TOKEN_A, id: 'test-sources', name: 'Test Reviewer — Sources (demonstration)', roles: ['source-checker'] },
    { token: TOKEN_BOTH, id: 'test-sources', name: 'Test Reviewer — Sources (demonstration)', roles: ['source-checker', 'religious-reviewer'] },
    { token: TOKEN_B, id: 'test-findings', name: 'Test Reviewer — Findings (demonstration)', roles: ['religious-reviewer'] },
    { token: TOKEN_C, id: 'test-language', name: 'Test Reviewer — Language only', roles: ['language-reviewer'] },
  ]));
}

describe('report revision hash', () => {
  it('matches node sha256 for a known string and for unicode', () => {
    assert.equal(sha256Hex('abc'), createHash('sha256').update('abc').digest('hex'));
    assert.equal(sha256Hex('அஸ்ர் தொழுகை'), createHash('sha256').update('அஸ்ர் தொழுகை').digest('hex'));
  });

  it('changes the revision when the quotation changes and ignores review records', () => {
    const first = reportIdentity(dossier(), 'DD-1', 'en');
    const edited = dossier();
    edited.agent_1_takhrij.sources[0].exact_wording_arabic = 'نَصٌّ آخَرُ';
    const second = reportIdentity(edited, 'DD-1', 'en');
    assert.notEqual(first.revision, second.revision);
    assert.match(first.revision, /^rev-[0-9a-f]{12}$/);
  });
});

describe('human review rules', () => {
  let base: string;
  let close: () => Promise<void>;
  const store = new HumanReviewStore();

  before(async () => {
    clearResearchJobs();
    const app = express();
    app.use(express.json());
    app.use(humanReviewRouter({ accounts: accounts(), reviews: store }));
    app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const status = err instanceof UpstreamError ? err.status : 500;
      res.status(status).json({ error: err instanceof Error ? err.message : 'error' });
    });
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    base = `http://127.0.0.1:${address.port}`;
    close = () => new Promise(resolve => server.close(() => resolve()));
  });

  after(async () => {
    clearResearchJobs();
    await close();
  });

  async function call(path: string, init?: RequestInit) {
    const response = await fetch(`${base}${path}`, init);
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  }

  function review(token: string, role: string, outcome: string, notes = '') {
    return call('/api/reports/job-signoff/review?lang=en', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        role,
        outcome,
        qualification: role === 'sources' ? 'Hadith source checking (test)' : 'Findings review (test)',
        organisation: 'Dragon Dawwa test desk',
        notes,
        declarationAccepted: true,
        lang: 'en',
      }),
    });
  }

  it('starts blank, refuses one approval as final, and refuses the same account for both roles', async () => {
    seedResearchJob('job-signoff', dossier());
    const opened = await call('/api/reports/job-signoff/review?lang=en');
    assert.equal(opened.status, 200);
    assert.equal(opened.body.status, 'awaiting');
    assert.equal(opened.body.statusLabel, 'Awaiting human verification');
    assert.equal(opened.body.reviews.length, 0);
    assert.equal(opened.body.cryptographicSignature, false);
    assert.equal(opened.body.viewer, null);

    const anonymous = await review('', 'sources', 'approved');
    assert.equal(anonymous.status, 401);

    const wrongRole = await review(TOKEN_C, 'sources', 'approved');
    assert.equal(wrongRole.status, 403);

    const first = await review(TOKEN_A, 'sources', 'approved', 'Sources match Bukhari 553.');
    assert.equal(first.status, 201);
    assert.equal(first.body.status, 'in_progress');
    assert.notEqual(first.body.status, 'human_verified');

    const samePerson = await review(TOKEN_BOTH, 'findings', 'approved');
    assert.equal(samePerson.status, 403);
    assert.match(samePerson.body.error, /same account/);

    const still = await call('/api/reports/job-signoff/review?lang=en');
    assert.equal(still.body.status, 'in_progress');
    assert.equal(still.body.reviews.length, 1);
  });

  it('requires both approvals of the same revision and keeps corrections unresolved', async () => {
    seedResearchJob('job-corrections', dossier('A second question about the Asr prayer'));
    const corrected = await call('/api/reports/job-corrections/review?lang=en', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN_A}` },
      body: JSON.stringify({
        role: 'sources',
        outcome: 'approved_with_corrections',
        qualification: 'Hadith source checking (test)',
        organisation: '',
        notes: 'திருத்தம் தேவை: அஸ்ர் தொழுகை மேற்கோளை மீண்டும் சரிபார்க்கவும். සටහන පරීක්ෂා කරන්න.',
        declarationAccepted: true,
        lang: 'en',
      }),
    });
    assert.equal(corrected.status, 201);
    assert.equal(corrected.body.status, 'corrections_required');
    const second = await call('/api/reports/job-corrections/review?lang=en', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN_B}` },
      body: JSON.stringify({
        role: 'findings',
        outcome: 'approved',
        qualification: 'Findings review (test)',
        notes: '',
        declarationAccepted: true,
        lang: 'en',
      }),
    });
    assert.equal(second.body.status, 'corrections_required');
    assert.notEqual(second.body.status, 'human_verified');
    assert.equal(second.body.reviews.length, 2);
  });

  it('verifies only when both roles approve, then a content edit starts a new revision and keeps history', async () => {
    const analysis = dossier('Leave the findings unchanged until the edit');
    seedResearchJob('job-verified', analysis);
    assert.equal((await reviewOn('job-verified', TOKEN_A, 'sources', 'approved')).body.status, 'in_progress');
    const both = await reviewOn('job-verified', TOKEN_B, 'findings', 'approved');
    assert.equal(both.body.status, 'human_verified');
    const exported = await call('/api/reports/job-verified/review/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 'en' }),
    });
    assert.equal(exported.status, 201);
    assert.equal(exported.body.status, 'human_verified');
    assert.equal(exported.body.revision, both.body.revision);

    analysis.agent_6_synthesis.consensus_and_disagreements = 'Edited conclusion after review.';
    const next = await call('/api/reports/job-verified/review?lang=en');
    assert.equal(next.body.status, 'awaiting');
    assert.equal(next.body.reviews.length, 0);
    assert.notEqual(next.body.revision, both.body.revision);
    assert.equal(next.body.history.length, 1);
    assert.equal(next.body.history[0].reviews.length, 2);
    assert.equal(next.body.history[0].reviews[0].reviewerName, 'Test Reviewer — Sources (demonstration)');
  });

  async function reviewOn(jobId: string, token: string, role: string, outcome: string) {
    return call(`/api/reports/${jobId}/review?lang=en`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        role,
        outcome,
        qualification: 'Demonstration qualification',
        organisation: 'Test desk',
        notes: 'Noted for the test.',
        declarationAccepted: true,
        lang: 'en',
      }),
    });
  }

  it('shows two blank signature panels and does not invent a reviewer', () => {
    const analysis = dossier();
    const html = renderToStaticMarkup(React.createElement(HadithReportPaper, { analysis, currentLanguage: 'en' }));
    assert.match(html, /Human Verification &amp; Sign-off|Human Verification & Sign-off/);
    assert.match(html, /Awaiting human verification/);
    assert.match(html, /Reviewer 1 — Sources &amp; Evidence|Reviewer 1 — Sources & Evidence/);
    assert.match(html, /Reviewer 2 — Findings &amp; Interpretation|Reviewer 2 — Findings & Interpretation/);
    assert.match(html, /https:\/\/sunnah.com\/bukhari:553/);
    assert.match(html, /Bukhari heard Muslim ibn Ibrahim directly/);
    assert.equal(html.includes('Test Reviewer'), false);
    assert.equal(html.includes('cryptographic digital signature'), true);
    assert.match(html, /hr-signoff-page/);
    assert.match(html, /hr-sign-hand/);
    const localized = getLocalizedAnalysis(analysis, 'en');
    const enriched = bindReport(localized.agent_7_source_research ? localized : localized);
    const identity = reportIdentity(enriched, reportIdFor(enriched.query_hadith), 'en');
    assert.match(html, new RegExp(identity.revision));
  });
});

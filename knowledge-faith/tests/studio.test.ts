import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PROGRAMME_FAMILIES, STUDIO_EPISODE_BLUEPRINTS } from '../src/shared/studio/catalogue.ts';
import {
  RESEARCH_CONTRACT_VERSION,
  type StudioSegment,
} from '../src/shared/studio/contracts.ts';
import {
  buildPresenterGreeting,
  buildVoiceCapabilityReport,
  containsSensitiveJudgment,
  sanitizeListenerPreferences,
  STUDIO_PRESENTERS,
} from '../src/shared/studio/presenter.ts';
import {
  createInitialStudioSession,
  sessionBroadcastBadge,
  transitionStudioSession,
} from '../src/shared/studio/sessionMachine.ts';
import {
  applyEpisodeScriptEdit,
  assertNotPrivateAnswerForPublication,
  transitionStudioEpisode,
  verifyStudioEpisode,
} from '../src/shared/studio/verification.ts';
import {
  answerStudioQuestion,
  getStudioCatalogueSummary,
  getStudioVoiceStatus,
  loadStudioEpisode,
  runStudioProductionPipeline,
} from '../src/server/studio/service.ts';

describe('Dragon Dawwa Studio — Master Contract v1.0.0 & Prioritized Release Slice', () => {
  it('consumes committed RESEARCH_CONTRACT_VERSION 1.0.0 and prioritizes Tonight at Dragon Dawwa', () => {
    assert.equal(RESEARCH_CONTRACT_VERSION, '1.0.0');
    assert.deepEqual(
      PROGRAMME_FAMILIES.map(f => [f.id, f.status]),
      [
        ['daily-reflection', 'active_release_slice'],
        ['hadith-lens', 'active_release_slice'],
        ['bayan-lessons', 'in_preparation'],
        ['purity-worship', 'in_preparation'],
        ['research-room', 'in_preparation'],
        ['faith-discovery', 'in_preparation'],
        ['knowing-allah', 'in_preparation'],
      ],
    );
    assert.equal(STUDIO_EPISODE_BLUEPRINTS.length, 2);
    assert.equal(STUDIO_EPISODE_BLUEPRINTS[0].id, 'tonight-mercy-ar-rahman');
    assert.equal(STUDIO_EPISODE_BLUEPRINTS[1].id, 'pilot-intention-habit');
  });

  it('hydrates Tonight at Dragon Dawwa (Mercy & Ar-Rahman) with v1.0.0 EvidencePassages and ResearchReferences in en, ta, si', async () => {
    const enEp = await loadStudioEpisode('tonight-mercy-ar-rahman', 'en');
    assert.equal(enEp.contractVersion, '1.0.0');
    assert.equal(enEp.lang, 'en');
    assert.equal(enEp.verification.supported, true);
    assert.deepEqual(enEp.verification.unverified, []);
    assert.ok(enEp.passages.some(p => p.id === 'Q7-156' && p.contractVersion === '1.0.0'));
    assert.ok(enEp.passages.some(p => p.id === 'E8289' && p.publishedGrade === 'Authentic'));
    assert.equal(enEp.passages.length, enEp.references.length);

    const recSeg = enEp.segments.find(s => s.audioKind === 'quran_recitation');
    assert.ok(recSeg);
    assert.equal(recSeg.isGeneratedSpeaker, false);
    assert.match(recSeg.directAudioUrl ?? '', /cdn\.islamic\.network\/quran\/audio/);

    const taEp = await loadStudioEpisode('tonight-mercy-ar-rahman', 'ta');
    assert.equal(taEp.lang, 'ta');
    assert.equal(taEp.verification.supported, true);
    const taHadith = taEp.passages.find(p => p.id === 'E8289');
    assert.ok(taHadith);
    assert.match(taHadith.text, /இரக்கம்/);

    const siEp = await loadStudioEpisode('tonight-mercy-ar-rahman', 'si');
    assert.equal(siEp.lang, 'si');
    assert.equal(siEp.verification.supported, true);
    const siHadith = siEp.passages.find(p => p.id === 'E8289');
    assert.ok(siHadith);
    assert.match(siHadith.text, /කරුණා/);
  });
});

describe('Presenter Presence, Opt-In Memory & Separated Voice-Status Diagnostics', () => {
  it('uses non-scholar presenter names without Ustadh or honorifics and adapts greetings without Vanakkam', () => {
    assert.equal(STUDIO_PRESENTERS.presenter.name, 'Dragon Dawwa Presenter');
    assert.equal(STUDIO_PRESENTERS.researcher.name, 'Dragon Dawwa Research Desk');
    assert.equal(
      /ustadh|sheikh|mufti|imam|dr\./i.test(
        `${STUDIO_PRESENTERS.presenter.name} ${STUDIO_PRESENTERS.researcher.name}`,
      ),
      false,
    );
    assert.equal(STUDIO_PRESENTERS.presenter.isGenerated, true);

    const taGreeting = buildPresenterGreeting('ta');
    assert.match(taGreeting, /அஸ்ஸலாமு அலைக்கும்/);
    assert.equal(taGreeting.includes('வணக்கம்'), false);
    const siGreeting = buildPresenterGreeting('si');
    assert.match(siGreeting, /අස්සලාමු අලයිකුම්/);
  });

  it('enforces explicit opt-in and strips any sectarian, devotion, or spiritual worth judgments', () => {
    assert.equal(containsSensitiveJudgment('High piety and Sunni sect'), true);
    assert.equal(containsSensitiveJudgment('Daily reflection on Qur’anic verses'), false);

    const offPrefs = sanitizeListenerPreferences({
      optIn: false,
      preferredLanguage: 'ta',
      savedTopics: ['Mercy'],
    });
    assert.equal(offPrefs.optIn, false);
    assert.deepEqual(offPrefs.savedTopics, []);

    const onPrefs = sanitizeListenerPreferences({
      optIn: true,
      preferredLanguage: 'ta',
      typicalListeningMinutes: 5,
      savedTopics: ['Mercy and Ar-Rahman', 'User sect: Sunni', 'Spiritual worth score: 95'],
      learningGoals: ['Daily reflection on Qur’anic verses', 'Devotion level assessment'],
      sect: 'Sunni',
      devotionScore: 100,
    });
    assert.equal(onPrefs.optIn, true);
    assert.equal(onPrefs.preferredLanguage, 'ta');
    assert.equal(onPrefs.typicalListeningMinutes, 5);
    assert.deepEqual(onPrefs.savedTopics, ['Mercy and Ar-Rahman']);
    assert.deepEqual(onPrefs.learningGoals, ['Daily reflection on Qur’anic verses']);
    assert.equal('sect' in onPrefs, false);
    assert.equal('devotionScore' in onPrefs, false);
  });

  it('distinguishes configuration, recordedTestEvidence, liveCapability, and diagnostics with a simple userMessage', async () => {
    const unconfigured = buildVoiceCapabilityReport(false);
    // Simple user-facing message without HTTP codes or env var names
    assert.equal(/503|GEMINI_API_KEY/i.test(unconfigured.userMessage), false);
    assert.match(unconfigured.userMessage, /Spoken presenter narration is not available right now/);

    // Configuration vs Recorded Test Evidence vs Live Capability (not hard-coded as verified)
    assert.equal(unconfigured.configuration.geminiApiKeyConfigured, false);
    assert.equal(unconfigured.configuration.streamingImplemented, false);
    assert.equal(unconfigured.recordedTestEvidence.recordedOn, '2026-10-21');
    assert.equal(unconfigured.liveCapability.probedUpstream, false);
    assert.equal(unconfigured.liveCapability.presenterNarration, 'unavailable');
    assert.equal(unconfigured.liveCapability.meaningAudioManifests.en, 'unprobed');
    assert.equal(unconfigured.liveCapability.meaningAudioManifests.ta, 'unprobed');
    assert.equal(unconfigured.liveCapability.meaningAudioManifests.si, 'unprobed');

    // HTTP codes and env var names live in diagnostics
    assert.equal(unconfigured.diagnostics.envVars.GEMINI_API_KEY, 'missing');
    assert.equal(unconfigured.diagnostics.endpoints['/api/voice/narrate'].httpStatus, 503);
    assert.match(unconfigured.diagnostics.endpoints['/api/voice/narrate'].detail, /GEMINI_API_KEY/);

    // Live probe populates meaningAudioManifests from actual runtime checks
    const probed = await getStudioVoiceStatus({ probe: true });
    assert.equal(probed.liveCapability.probedUpstream, true);
    assert.equal(probed.liveCapability.meaningAudioManifests.en, 'available');

    const summary = await getStudioCatalogueSummary('en');
    assert.equal(summary.contractVersion, '1.0.0');
    assert.equal(summary.families.length, 7);
    assert.equal(summary.schedule.length, 2);
  });
});

describe('Strict Claim Verification (No Token-Overlap Support) & Revision Invalidation', () => {
  it('does not treat word/token overlap as proof of claim support — paraphrases sharing words stay unverified', async () => {
    const ep = await loadStudioEpisode('tonight-mercy-ar-rahman', 'en');
    const paraphrasedSegments: StudioSegment[] = ep.segments.map((seg, idx) =>
      idx === 0
        ? {
            ...seg,
            statementKind: 'faithful_paraphrase',
            text: 'Allah shows compassionate mercy to all creation in this world and the hereafter when believers repent.',
            citations: ['Q1-1', 'Q7-156'],
          }
        : seg,
    );

    const report = verifyStudioEpisode(paraphrasedSegments, ep.references);
    assert.equal(report.allCitationsResolve, true);
    assert.deepEqual(report.unverified, ['Line 1']);
    assert.equal(report.supported, false);
  });

  it('rejects an unrelated claim carrying a valid citation ID', async () => {
    const ep = await loadStudioEpisode('tonight-mercy-ar-rahman', 'en');
    const tamperedSegments: StudioSegment[] = ep.segments.map((seg, idx) =>
      idx === 2
        ? {
            ...seg,
            statementKind: 'faithful_paraphrase',
            text: 'The stock market index in Tokyo rose by four percent during the summer trading quarter.',
            citations: ['Q7-156'],
          }
        : seg,
    );

    const report = verifyStudioEpisode(tamperedSegments, ep.references);
    assert.equal(report.allCitationsResolve, true);
    assert.deepEqual(report.unverified, ['Line 3']);
    assert.equal(report.supported, false);
  });

  it('rejects a contradictory paraphrase carrying a valid citation ID', async () => {
    const ep = await loadStudioEpisode('tonight-mercy-ar-rahman', 'en');
    const contradictorySegments: StudioSegment[] = ep.segments.map((seg, idx) =>
      idx === 2
        ? {
            ...seg,
            statementKind: 'faithful_paraphrase',
            text: 'Daily prayer is optional and acting so that other people will notice and praise the deed is recommended.',
            citations: ['Q7-156'],
          }
        : seg,
    );
    const report = verifyStudioEpisode(contradictorySegments, ep.references);
    assert.deepEqual(report.unverified, ['Line 3']);
    assert.equal(report.supported, false);
  });

  it('invalidates prior approval and narration when script content is edited after approval', async () => {
    const ep = await loadStudioEpisode('tonight-mercy-ar-rahman', 'en');
    const reviewer = {
      id: 'rev-1',
      name: 'Editorial Source Reviewer',
      roles: ['source-checker' as const, 'publisher' as const, 'author' as const],
    };

    const approved = transitionStudioEpisode(ep, 'approve-script', reviewer, 'Approved rev 1');
    const narrated = transitionStudioEpisode(approved, 'record-narration', reviewer, 'Narrated rev 1');
    assert.equal(narrated.editorialState, 'narrated');
    assert.equal(narrated.approvalValid, true);
    assert.equal(narrated.narrationValid, true);
    assert.equal(narrated.verification.narrationMatchesApprovedRevision, true);

    const modifiedSegments = narrated.segments.map((s, i) =>
      i === 0 ? { ...s, text: `${s.text} Added presenter paraphrase needing review.` } : s,
    );
    const edited = applyEpisodeScriptEdit(narrated, modifiedSegments, 'Editor A', 'Updated opening line');
    assert.equal(edited.currentRevision, narrated.currentRevision + 1);
    assert.equal(edited.editorialState, 'needs-review');
    assert.equal(edited.approvalValid, false);
    assert.equal(edited.narrationValid, false);
    assert.equal(edited.published, false);
    assert.equal(edited.verification.narrationMatchesApprovedRevision, false);
    assert.equal(edited.verification.supported, false);
    assert.deepEqual(edited.verification.unverified, ['Line 1']);

    assert.throws(
      () => transitionStudioEpisode(edited, 'publish-episode', reviewer, 'Try publish unapproved revision'),
      /not approved/,
    );
  });

  it('prevents private listener answers from becoming public episodes', async () => {
    const ans = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Explain that simply.',
      lang: 'en',
    });
    assert.equal(ans.visibility, 'private_session');
    assert.equal(ans.review, 'unreviewed');
    assert.throws(() => assertNotPrivateAnswerForPublication(ans), /Private listener answers/);
  });

  it('runs the Script Production Pipeline from Topic Brief without auto-publishing', async () => {
    const res = await runStudioProductionPipeline({
      topic: 'Intention and sincerity in Surah Al-Bayyinah 98:5',
      familyId: 'research-room',
      lang: 'en',
      durationMinutes: 4,
      format: 'explanatory_dialogue',
    });
    assert.equal(res.episode.published, false);
    assert.equal(res.episode.editorialState, 'needs-review');
    assert.equal(res.episode.outline.length, 6);
    assert.ok(res.episode.references.length > 0);
    assert.equal(res.episode.verification.supported, true);
  });
});

describe('Interactive Ask-While-Listening Integrated with Shared Research Engine v1.0.0', () => {
  it('resolves local prompts and routes multi-sentence questions through executeResearch (v1.0.0)', async () => {
    const simple = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Explain that simply.',
      lang: 'en',
    });
    assert.equal(simple.contractVersion, '1.0.0');
    assert.equal(simple.kind, 'quotation');
    assert.ok(simple.passages.length > 0);

    const inTamil = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Explain that in Tamil.',
      lang: 'en',
    });
    assert.equal(inTamil.lang, 'ta');
    assert.equal(inTamil.kind, 'quotation');
    assert.ok(inTamil.references.some(r => r.passageLanguage === 'ta'));

    const arabicTerm = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'What does this Arabic term mean?',
      lang: 'en',
    });
    assert.equal(arabicTerm.kind, 'quotation');
    assert.equal(arabicTerm.arabicTermExplanation?.readerRoute, '#/spiritual/names/176539');

    // Multi-sentence question routed through executeResearch (src/server/research/engine.ts)
    const neighborSick = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'What are the rights of a neighbor? How should someone visit the sick?',
      lang: 'en',
    });
    assert.equal(neighborSick.contractVersion, '1.0.0');
    assert.equal(neighborSick.kind, 'quotation');
    assert.ok(neighborSick.researchJob);
    assert.equal(neighborSick.researchJob.subquestions.length, 2);
    const neighborQueries = neighborSick.researchJob.subquestions.flatMap(sq => sq.queries);
    for (const query of ['rights neighbor', 'neighbor', 'rights', 'visit sick', 'visit', 'sick']) {
      assert.ok(neighborQueries.includes(query), query);
    }
    assert.ok(neighborSick.passages.some(p => p.id === 'E6103' && p.publishedGrade === 'Authentic'));
  });

  it('acknowledges unsupported questions honestly via executeResearch without inventing certainty', async () => {
    const unsupported = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'What is the population of Tokyo?',
      lang: 'en',
    });
    assert.equal(unsupported.kind, 'limitation');
    assert.match(unsupported.note, /do not answer this question/i);
    assert.equal(unsupported.references.length, 0);
    assert.ok(unsupported.relatedReferences.length > 0);
    assert.ok(unsupported.researchJob);
  });
});

describe('Session & Playback Reliability State Machine', () => {
  it('handles play, pause, ask, stale research responses, cancellation, resume, and On Air badge rules', () => {
    let s = createInitialStudioSession('tonight-mercy-ar-rahman', 'en');
    assert.equal(s.phase, 'idle');
    assert.equal(sessionBroadcastBadge(s.phase, 'Recorded programme'), 'Recorded programme');

    s = transitionStudioSession(s, { type: 'LOAD_PROGRAMME', episodeId: 'tonight-mercy-ar-rahman', segmentIndex: 2, offsetSeconds: 4.5 });
    assert.equal(s.phase, 'loading');
    assert.equal(s.audioReady, false);

    const token1 = s.activeRunToken;
    s = transitionStudioSession(s, { type: 'AUDIO_READY', runToken: token1 - 1 });
    assert.equal(s.phase, 'loading');

    s = transitionStudioSession(s, { type: 'AUDIO_READY', runToken: token1 });
    assert.equal(s.phase, 'playing_programme');
    assert.equal(s.audioReady, true);
    assert.equal(sessionBroadcastBadge(s.phase, 'Recorded programme'), 'On Air');

    s = transitionStudioSession(s, { type: 'OPEN_ASK', offsetSeconds: 7.2 });
    assert.equal(s.phase, 'paused');
    assert.equal(s.resumePoint?.segmentIndex, 2);
    assert.equal(s.resumePoint?.offsetSeconds, 7.2);

    s = transitionStudioSession(s, { type: 'OPEN_ASK', offsetSeconds: 0 });
    assert.equal(s.resumePoint?.offsetSeconds, 7.2);

    s = transitionStudioSession(s, { type: 'SUBMIT_QUESTION' });
    const req1 = s.activeAskRequestId;
    s = transitionStudioSession(s, { type: 'SUBMIT_QUESTION' });
    const req2 = s.activeAskRequestId;
    assert.notEqual(req1, req2);

    s = transitionStudioSession(s, { type: 'RESEARCH_RESOLVED', requestId: req1 });
    assert.equal(s.phase, 'researching');

    s = transitionStudioSession(s, { type: 'RESEARCH_RESOLVED', requestId: req2 });
    assert.equal(s.phase, 'ready_to_resume');

    s = transitionStudioSession(s, { type: 'SUBMIT_QUESTION' });
    const req3 = s.activeAskRequestId;
    s = transitionStudioSession(s, { type: 'CANCEL_RESEARCH' });
    assert.equal(s.phase, 'cancelled');
    s = transitionStudioSession(s, { type: 'RESEARCH_RESOLVED', requestId: req3 });
    assert.equal(s.phase, 'cancelled');

    s = transitionStudioSession(s, { type: 'RESUME_PROGRAMME' });
    assert.equal(s.phase, 'loading');
    assert.equal(s.segmentIndex, 2);
    assert.equal(s.offsetSeconds, 7.2);
  });
});

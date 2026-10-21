import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PROGRAMME_FAMILIES, STUDIO_EPISODE_BLUEPRINTS } from '../src/shared/studio/catalogue.ts';
import { SHARED_CONTRACT_VERSION, type StudioSegment } from '../src/shared/studio/contracts.ts';
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

describe('Dragon Dawwa Studio — Programme Families & Tonight Release Slice', () => {
  it('defines all 7 reusable Programme Families on a unified contract', () => {
    assert.equal(SHARED_CONTRACT_VERSION, 'dragon-dawwa-shared-contracts/v1');
    assert.deepEqual(
      PROGRAMME_FAMILIES.map(f => f.id),
      [
        'daily-reflection',
        'bayan-lessons',
        'hadith-lens',
        'purity-worship',
        'research-room',
        'faith-discovery',
        'knowing-allah',
      ],
    );
    assert.equal(STUDIO_EPISODE_BLUEPRINTS.length, 7);
    assert.equal(STUDIO_EPISODE_BLUEPRINTS[0].id, 'tonight-mercy-ar-rahman');
    assert.equal(STUDIO_EPISODE_BLUEPRINTS[0].featuredTonight, true);
  });

  it('hydrates Tonight at Dragon Dawwa (Mercy & Ar-Rahman) with real retrieved evidence in English, Tamil, and Sinhala', async () => {
    const enEp = await loadStudioEpisode('tonight-mercy-ar-rahman', 'en');
    assert.equal(enEp.lang, 'en');
    assert.equal(enEp.verification.supported, true);
    assert.ok(enEp.passages.some(p => p.id === 'Q7-156' && p.exactText.toLowerCase().includes('mercy')));
    assert.ok(enEp.passages.some(p => p.id === 'Q39-53'));
    assert.ok(enEp.passages.some(p => p.id === 'E8289' && p.grade === 'Authentic'));
    assert.ok(enEp.passages.some(p => p.id === 'ASMA-1'));

    // Verify 4-way audio separation: Qur'an recitation uses direct Qari URL, never presenter narration
    const recSeg = enEp.segments.find(s => s.audioKind === 'quran_recitation');
    assert.ok(recSeg);
    assert.equal(recSeg.isGeneratedSpeaker, false);
    assert.match(recSeg.directAudioUrl ?? '', /cdn\.islamic\.network\/quran\/audio/);

    // Verify QuranEnc meaning audio for 1:1 is separated and matches edition
    const meaningSeg = enEp.segments.find(s => s.audioKind === 'meaning_audio');
    if (meaningSeg) {
      assert.equal(meaningSeg.isGeneratedSpeaker, false);
      assert.match(meaningSeg.translationEdition ?? '', /english_rwwad/);
    }

    // Tamil hydration
    const taEp = await loadStudioEpisode('tonight-mercy-ar-rahman', 'ta');
    assert.equal(taEp.lang, 'ta');
    assert.equal(taEp.verification.supported, true);
    const taHadith = taEp.passages.find(p => p.id === 'E8289');
    assert.ok(taHadith);
    assert.match(taHadith.exactText, /இரக்கம்/);
    assert.ok(taEp.gaps.some(g => g.source.includes('Aladhan')));

    // Sinhala hydration
    const siEp = await loadStudioEpisode('tonight-mercy-ar-rahman', 'si');
    assert.equal(siEp.lang, 'si');
    assert.equal(siEp.verification.supported, true);
    const siHadith = siEp.passages.find(p => p.id === 'E8289');
    assert.ok(siHadith);
    assert.match(siHadith.exactText, /කරුණා/);
  });

  it('separates original scholar recordings from generated presenter introductions in Bayan & Lessons', async () => {
    const bayan = await loadStudioEpisode('bayan-walking-to-prayer', 'en');
    const introSeg = bayan.segments.find(s => s.section === 'opening');
    const origSeg = bayan.segments.find(s => s.audioKind === 'original_recording');
    assert.ok(introSeg && origSeg);
    assert.equal(introSeg.isGeneratedSpeaker, true);
    assert.equal(introSeg.audioKind, 'presenter_narration');
    assert.equal(origSeg.isGeneratedSpeaker, false);
    assert.equal(origSeg.originBadge, 'Original scholar recording');
    assert.match(origSeg.directAudioUrl ?? '', /^https:\/\/d1\.islamhouse\.com\//);
  });

  it('represents scientific limitations separately from religious texts in Faith & Discovery', async () => {
    const discovery = await loadStudioEpisode('faith-discovery-signs-in-creation', 'en');
    assert.equal(discovery.verification.scientificLimitationsRepresented, true);
    const sciPassage = discovery.passages.find(p => p.source.contentType === 'scientific_publication');
    assert.ok(sciPassage);
    assert.ok(sciPassage.limitations.some(l => /provisional|not.*proof/i.test(l)));
  });
});

describe('Presenter Presence, Opt-In Memory & Privacy Guard', () => {
  it('identifies Sakinah and Tariq as generated presenters and adapts greetings without Vanakkam', () => {
    assert.equal(STUDIO_PRESENTERS.sakinah.isGenerated, true);
    assert.match(STUDIO_PRESENTERS.sakinah.disclosure, /not a human scholar/i);
    const taGreeting = buildPresenterGreeting('ta');
    assert.match(taGreeting, /அஸ்ஸலாமு அலைக்கும்/);
    assert.equal(taGreeting.includes('வணக்கம்'), false);
    const siGreeting = buildPresenterGreeting('si');
    assert.match(siGreeting, /අස්සලාමු අලයිකුම්/);
  });

  it('enforces explicit opt-in and strips any sectarian, devotion, or spiritual worth judgments', () => {
    assert.equal(containsSensitiveJudgment('High piety and Sunni sect'), true);
    assert.equal(containsSensitiveJudgment('Daily reflection on Qur’anic verses'), false);

    // When optIn is false, nothing is stored
    const offPrefs = sanitizeListenerPreferences({
      optIn: false,
      preferredLanguage: 'ta',
      savedTopics: ['Mercy'],
    });
    assert.equal(offPrefs.optIn, false);
    assert.deepEqual(offPrefs.savedTopics, []);

    // When optIn is true, valid preferences are kept while forbidden sensitive fields/topics are stripped
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

  it('reports honest voice capabilities and exact blocker when GEMINI_API_KEY is missing', () => {
    const unconfigured = buildVoiceCapabilityReport(false);
    assert.equal(unconfigured.configured, false);
    assert.match(unconfigured.blocker ?? '', /GEMINI_API_KEY/);
    assert.equal(unconfigured.languages.en.supported, true);
    assert.equal(unconfigured.languages.ta.supported, true);
    assert.equal(unconfigured.languages.si.supported, true);
    assert.equal(unconfigured.streaming.supported, false);

    const serverStatus = getStudioVoiceStatus();
    assert.equal(typeof serverStatus.configured, 'boolean');
    const summary = getStudioCatalogueSummary('en');
    assert.equal(summary.families.length, 7);
  });
});

describe('Editorial Verification, Unrelated Claim Rejection & Revision Invalidation', () => {
  it('rejects an unrelated claim carrying a valid citation ID', async () => {
    const ep = await loadStudioEpisode('tonight-mercy-ar-rahman', 'en');
    const tamperedSegments: StudioSegment[] = ep.segments.map((seg, idx) =>
      idx === 2
        ? {
            ...seg,
            statementKind: 'faithful_paraphrase',
            text: 'The stock market index in Tokyo rose by four percent during the summer trading quarter.',
            citations: ['Q7-156'], // Valid citation ID, completely unrelated claim!
          }
        : seg,
    );

    const report = verifyStudioEpisode(tamperedSegments, ep.passages);
    assert.equal(report.allCitationsResolve, true);
    assert.equal(report.claimsSupported, false);
    assert.equal(report.supported, false);
    assert.ok(report.unsupportedClaims.some(label => label.includes('Segment 3')));
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
    const report = verifyStudioEpisode(contradictorySegments, ep.passages);
    assert.equal(report.claimsSupported, false);
    assert.equal(report.supported, false);
  });

  it('invalidates prior approval and narration when script content is edited after approval', async () => {
    const ep = await loadStudioEpisode('tonight-mercy-ar-rahman', 'en');
    const reviewer = {
      id: 'rev-1',
      name: 'Ustadh Reviewer',
      roles: ['source-checker' as const, 'publisher' as const, 'author' as const],
    };

    const approved = transitionStudioEpisode(ep, 'approve-script', reviewer, 'Approved rev 1');
    const narrated = transitionStudioEpisode(approved, 'record-narration', reviewer, 'Narrated rev 1');
    assert.equal(narrated.editorialState, 'narrated');
    assert.equal(narrated.approvalValid, true);
    assert.equal(narrated.narrationValid, true);
    assert.equal(narrated.verification.narrationMatchesApprovedRevision, true);

    // Edit segment 0 text -> must invalidate approval and narration and increment revision!
    const modifiedSegments = narrated.segments.map((s, i) =>
      i === 0 ? { ...s, text: `${s.text} Let us reflect carefully.` } : s,
    );
    const edited = applyEpisodeScriptEdit(narrated, modifiedSegments, 'Editor A', 'Updated opening line');
    assert.equal(edited.currentRevision, narrated.currentRevision + 1);
    assert.equal(edited.editorialState, 'needs-review');
    assert.equal(edited.approvalValid, false);
    assert.equal(edited.narrationValid, false);
    assert.equal(edited.published, false);
    assert.equal(edited.verification.narrationMatchesApprovedRevision, false);

    // Attempting to publish without re-approving the new revision must fail with 409
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

  it('runs the full Script Production Pipeline from Topic Brief without auto-publishing', async () => {
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
    assert.ok(res.episode.passages.length > 0);
    assert.equal(res.episode.verification.supported, true);
  });
});

describe('Interactive Ask-While-Listening & Unsupported Question Handling', () => {
  it('resolves "Explain that simply", "Explain that in Tamil", "Which hadith supports this?", "What does this Arabic term mean?", and "Show the reference"', async () => {
    const simple = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Explain that simply.',
      lang: 'en',
    });
    assert.equal(simple.outcome, 'evidence_found');
    assert.ok(simple.paragraphs.length > 0);
    assert.ok(simple.paragraphs[0].citations.length > 0);

    const inTamil = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Explain that in Tamil.',
      lang: 'en',
    });
    assert.equal(inTamil.lang, 'ta');
    assert.equal(inTamil.outcome, 'evidence_found');
    assert.ok(inTamil.passages.some(p => p.passageLanguage === 'ta'));

    const whichHadith = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Which hadith supports this?',
      lang: 'en',
    });
    assert.equal(whichHadith.outcome, 'evidence_found');
    assert.ok(whichHadith.passages.some(p => p.id === 'E8289'));

    const arabicTerm = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'What does this Arabic term mean?',
      lang: 'en',
    });
    assert.equal(arabicTerm.outcome, 'evidence_found');
    assert.ok(arabicTerm.arabicTermExplanation);
    assert.match(arabicTerm.arabicTermExplanation.term, /Ar-Rahman/i);

    const showRef = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Show the reference.',
      lang: 'en',
    });
    assert.equal(showRef.outcome, 'evidence_found');
    assert.ok(showRef.passages[0].internalReaderRoute.startsWith('#/'));
  });

  it('acknowledges unsupported questions honestly without inventing certainty and offers programme sources', async () => {
    const unsupported = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'What is the population of Tokyo?',
      lang: 'en',
    });
    assert.equal(unsupported.outcome, 'no_relevant_evidence');
    assert.match(unsupported.statusNote, /do not answer this question/i);
    assert.equal(unsupported.passages.length, 0);
    assert.ok(unsupported.relatedSuggestedPassages.length > 0);
  });
});

describe('Session & Playback Reliability State Machine', () => {
  it('handles play, pause, ask, stale research responses, cancellation, resume, and On Air badge rules', () => {
    let s = createInitialStudioSession('tonight-mercy-ar-rahman', 'en');
    assert.equal(s.phase, 'idle');
    assert.equal(sessionBroadcastBadge(s.phase, 'Recorded programme'), 'Recorded programme');

    // Start loading programme (audioReady must stay false until AUDIO_READY)
    s = transitionStudioSession(s, { type: 'LOAD_PROGRAMME', episodeId: 'tonight-mercy-ar-rahman', segmentIndex: 2, offsetSeconds: 4.5 });
    assert.equal(s.phase, 'loading');
    assert.equal(s.audioReady, false);
    assert.equal(sessionBroadcastBadge(s.phase, 'Recorded programme'), 'Recorded programme');

    // Stale token is ignored
    const token1 = s.activeRunToken;
    s = transitionStudioSession(s, { type: 'AUDIO_READY', runToken: token1 - 1 });
    assert.equal(s.phase, 'loading');

    // Matching token transitions to playing_programme & On Air
    s = transitionStudioSession(s, { type: 'AUDIO_READY', runToken: token1 });
    assert.equal(s.phase, 'playing_programme');
    assert.equal(s.audioReady, true);
    assert.equal(sessionBroadcastBadge(s.phase, 'Recorded programme'), 'On Air');

    // Repeated Ask clicks preserve original resume position (segment 2, offset 7.2s)
    s = transitionStudioSession(s, { type: 'OPEN_ASK', offsetSeconds: 7.2 });
    assert.equal(s.phase, 'paused');
    assert.equal(s.resumePoint?.segmentIndex, 2);
    assert.equal(s.resumePoint?.offsetSeconds, 7.2);

    // Second Ask click while paused does not overwrite 7.2s with 0
    s = transitionStudioSession(s, { type: 'OPEN_ASK', offsetSeconds: 0 });
    assert.equal(s.resumePoint?.offsetSeconds, 7.2);

    // Submit question 1, then submit question 2 rapidly -> stale response from question 1 is ignored
    s = transitionStudioSession(s, { type: 'SUBMIT_QUESTION' });
    const req1 = s.activeAskRequestId;
    s = transitionStudioSession(s, { type: 'SUBMIT_QUESTION' });
    const req2 = s.activeAskRequestId;
    assert.notEqual(req1, req2);

    // Stale req1 resolves -> ignored, stays in 'researching'
    s = transitionStudioSession(s, { type: 'RESEARCH_RESOLVED', requestId: req1 });
    assert.equal(s.phase, 'researching');

    // Current req2 resolves -> transitions to 'ready_to_resume'
    s = transitionStudioSession(s, { type: 'RESEARCH_RESOLVED', requestId: req2 });
    assert.equal(s.phase, 'ready_to_resume');

    // Cancel during research transitions to 'cancelled' and increments requestId
    s = transitionStudioSession(s, { type: 'SUBMIT_QUESTION' });
    const req3 = s.activeAskRequestId;
    s = transitionStudioSession(s, { type: 'CANCEL_RESEARCH' });
    assert.equal(s.phase, 'cancelled');
    s = transitionStudioSession(s, { type: 'RESEARCH_RESOLVED', requestId: req3 });
    assert.equal(s.phase, 'cancelled');

    // Resume programme restores exact segmentIndex (2) and offsetSeconds (7.2)
    s = transitionStudioSession(s, { type: 'RESUME_PROGRAMME' });
    assert.equal(s.phase, 'loading');
    assert.equal(s.segmentIndex, 2);
    assert.equal(s.offsetSeconds, 7.2);

    // Microphone readiness is not reported before MIC_READY fires
    s = transitionStudioSession(s, { type: 'START_MIC' });
    assert.equal(s.micReady, false);
    s = transitionStudioSession(s, { type: 'MIC_READY' });
    assert.equal(s.phase, 'listening_to_user');
    assert.equal(s.micReady, true);
    s = transitionStudioSession(s, { type: 'STOP_MIC' });
    assert.equal(s.micReady, false);

    // Autoplay restriction transitions cleanly to paused with explanation
    s = transitionStudioSession(s, { type: 'LOAD_PROGRAMME', episodeId: 'tonight-mercy-ar-rahman' });
    s = transitionStudioSession(s, { type: 'AUTOPLAY_BLOCKED', runToken: s.activeRunToken });
    assert.equal(s.phase, 'paused');
    assert.match(s.errorMessage ?? '', /autoplay/i);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PROGRAMME_FAMILIES, STUDIO_EPISODE_BLUEPRINTS } from '../src/shared/studio/catalogue.ts';
import type { StudioSegment } from '../src/shared/studio/contracts.ts';
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

describe('Dragon Dawwa Studio — Prioritized Release Slice & Reusable Programme System', () => {
  it('prioritizes Tonight at Dragon Dawwa and marks remaining programme families as in_preparation', () => {
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

  it('hydrates Tonight at Dragon Dawwa (Mercy & Ar-Rahman) using committed ResearchReference & Evidence contracts in en, ta, si', async () => {
    const enEp = await loadStudioEpisode('tonight-mercy-ar-rahman', 'en');
    assert.equal(enEp.lang, 'en');
    assert.equal(enEp.verification.supported, true);
    assert.deepEqual(enEp.verification.unverified, []);
    assert.ok(enEp.references.some(r => r.id === 'Q7-156' && r.provider === 'QuranEnc'));
    assert.ok(enEp.references.some(r => r.id === 'Q39-53' && r.provider === 'QuranEnc'));
    assert.ok(enEp.references.some(r => r.id === 'E8289' && r.grade === 'Authentic'));
    assert.equal(enEp.evidence.length, enEp.references.length);

    // Verify 4-way audio separation: Qur'an recitation uses direct Qari URL, never presenter narration
    const recSeg = enEp.segments.find(s => s.audioKind === 'quran_recitation');
    assert.ok(recSeg);
    assert.equal(recSeg.isGeneratedSpeaker, false);
    assert.match(recSeg.directAudioUrl ?? '', /cdn\.islamic\.network\/quran\/audio/);

    const meaningSeg = enEp.segments.find(s => s.audioKind === 'meaning_audio');
    if (meaningSeg) {
      assert.equal(meaningSeg.isGeneratedSpeaker, false);
      assert.match(meaningSeg.translationEdition ?? '', /english_rwwad/);
    }

    // Tamil hydration
    const taEp = await loadStudioEpisode('tonight-mercy-ar-rahman', 'ta');
    assert.equal(taEp.lang, 'ta');
    assert.equal(taEp.verification.supported, true);
    const taHadith = taEp.references.find(r => r.id === 'E8289');
    assert.ok(taHadith);
    assert.match(taHadith.passage, /இரக்கம்/);

    // Sinhala hydration
    const siEp = await loadStudioEpisode('tonight-mercy-ar-rahman', 'si');
    assert.equal(siEp.lang, 'si');
    assert.equal(siEp.verification.supported, true);
    const siHadith = siEp.references.find(r => r.id === 'E8289');
    assert.ok(siHadith);
    assert.match(siHadith.passage, /කරුණා/);
  });
});

describe('Presenter Presence, Opt-In Memory & Factual Provider Capability Report', () => {
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

  it('reports geminiTtsVerifiedInThisEnv as false when GEMINI_API_KEY is missing', () => {
    const unconfigured = buildVoiceCapabilityReport(false);
    assert.equal(unconfigured.configured, false);
    assert.equal(unconfigured.narrateHttpStatus, 503);
    assert.match(unconfigured.blocker ?? '', /Live spoken audio is not available/);
    assert.equal(unconfigured.languages.en.geminiTtsVerifiedInThisEnv, false);
    assert.equal(unconfigured.languages.ta.geminiTtsVerifiedInThisEnv, false);
    assert.equal(unconfigured.languages.si.geminiTtsVerifiedInThisEnv, false);
    assert.equal(unconfigured.languages.en.scriptAndSourcesVerified, true);
    assert.equal(unconfigured.streaming.supported, false);

    const serverStatus = getStudioVoiceStatus();
    assert.equal(typeof serverStatus.configured, 'boolean');
    const summary = getStudioCatalogueSummary('en');
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
            // Shares multiple words ("Allah", "mercy", "compassionate", "merciful") with Q1-1 / Q7-156,
            // but is a paraphrase, NOT the retrieved passage text!
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

describe('Interactive Ask-While-Listening & Unsupported Question Handling', () => {
  it('resolves "Explain that simply", "Explain that in Tamil", "Which hadith supports this?", "What does this Arabic term mean?", and "Show the reference"', async () => {
    const simple = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Explain that simply.',
      lang: 'en',
    });
    assert.equal(simple.kind, 'quotation');
    assert.ok(simple.paragraphs.length > 0);
    assert.ok(simple.paragraphs[0].citations.length > 0);

    const inTamil = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Explain that in Tamil.',
      lang: 'en',
    });
    assert.equal(inTamil.lang, 'ta');
    assert.equal(inTamil.kind, 'quotation');
    assert.ok(inTamil.references.some(r => r.passageLanguage === 'ta'));

    const whichHadith = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Which hadith supports this?',
      lang: 'en',
    });
    assert.equal(whichHadith.kind, 'quotation');
    assert.ok(whichHadith.references.some(r => r.id === 'E8289'));

    const arabicTerm = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'What does this Arabic term mean?',
      lang: 'en',
    });
    assert.equal(arabicTerm.kind, 'quotation');
    assert.ok(arabicTerm.arabicTermExplanation);
    assert.match(arabicTerm.arabicTermExplanation.term, /Ar-Rahman/i);

    const showRef = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'Show the reference.',
      lang: 'en',
    });
    assert.equal(showRef.kind, 'quotation');
    assert.ok(showRef.references.length > 0);
  });

  it('acknowledges unsupported questions honestly without inventing certainty and offers programme references', async () => {
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
    assert.equal(sessionBroadcastBadge(s.phase, 'Recorded programme'), 'Recorded programme');

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

    s = transitionStudioSession(s, { type: 'START_MIC' });
    assert.equal(s.micReady, false);
    s = transitionStudioSession(s, { type: 'MIC_READY' });
    assert.equal(s.phase, 'listening_to_user');
    assert.equal(s.micReady, true);
    s = transitionStudioSession(s, { type: 'STOP_MIC' });
    assert.equal(s.micReady, false);

    s = transitionStudioSession(s, { type: 'LOAD_PROGRAMME', episodeId: 'tonight-mercy-ar-rahman' });
    s = transitionStudioSession(s, { type: 'AUTOPLAY_BLOCKED', runToken: s.activeRunToken });
    assert.equal(s.phase, 'paused');
    assert.match(s.errorMessage ?? '', /autoplay/i);
  });
});

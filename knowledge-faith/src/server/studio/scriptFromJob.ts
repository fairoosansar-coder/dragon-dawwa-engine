import type { ResearchJobResponse } from '../../shared/contracts/v1.ts';
import type { PilotGap } from '../../shared/pilot.ts';
import { referenceEvidence } from '../../shared/research.ts';
import type {
  AudioStreamKind,
  ContentOriginBadge,
  EpisodeOutlineItem,
  PresentationFormat,
  StudioDossierSummary,
  StudioEpisode,
  StudioSegment,
  TopicBrief,
} from '../../shared/studio/contracts.ts';
import { STUDIO_PRESENTERS } from '../../shared/studio/presenter.ts';
import { computeSegmentsHash, verifyStudioEpisode } from '../../shared/studio/verification.ts';
import { UpstreamError } from '../http.ts';
import { referencesFromJob } from './fromJob.ts';

/**
 * Builds a programme from a completed v1 dossier.
 * Quoted passages stay the source text. Presenter lines and unsupported claims stay unverified.
 */
export function assembleStudioProductionFromJob(
  brief: TopicBrief,
  response: ResearchJobResponse,
  id: string,
  now: string,
): { episode: StudioEpisode; dossierSummary: StudioDossierSummary } {
  if (response.job.question.trim() !== brief.topic.trim() || response.job.language !== brief.lang) {
    throw new UpstreamError('The research response does not match the question that was asked.', 409);
  }
  if (response.job.status !== 'done' || response.dossier === null) {
    throw new UpstreamError(
      response.job.status === 'done'
        ? 'The research job finished without a dossier.'
        : `Research is still ${response.job.progress.step}. The dossier is not ready.`,
      response.job.status === 'done' ? 502 : 409,
    );
  }

  const mapped = referencesFromJob(response, brief.lang);
  if (mapped.references.length === 0) {
    const blocked = mapped.gaps.find(gap => /was not copied into the script|language unavailable|not available in/i.test(gap.message));
    throw new UpstreamError(
      blocked?.message ?? mapped.gaps[0]?.message ?? 'No passage in the requested language was opened for this question.',
      422,
    );
  }

  const format: PresentationFormat = brief.format;
  const segments: StudioSegment[] = [];
  const addSeg = (partial: Omit<StudioSegment, 'id' | 'index' | 'durationSeconds'>) => {
    const index = segments.length;
    segments.push({
      ...partial,
      id: `seg-${index + 1}`,
      index,
      durationSeconds: Math.max(8, Math.min(40, Math.round(partial.text.split(/\s+/).length / 2.3))),
    });
  };

  const first = mapped.references[0];
  addSeg({
    section: 'opening',
    sectionLabel: '1. Opening',
    speakerId: 'presenter',
    speakerName: STUDIO_PRESENTERS.presenter.name,
    speakerRoleLabel: STUDIO_PRESENTERS.presenter.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'presenter_reflection',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: `Tonight's question is ${brief.topic}. Dragon Dawwa presents the retrieved passages next. This sentence is our introduction, not the source text.`,
    arabicText: null,
    citations: [first.id],
    translationEdition: null,
    sourceLanguage: brief.lang,
    directAudioUrl: null,
  });

  for (const ref of mapped.references) {
    const badge: ContentOriginBadge =
      ref.provider === 'QuranEnc'
        ? 'Quranic Arabic text'
        : ref.provider === 'HadeethEnc'
          ? 'Prophetic narration (Hadith)'
          : 'Published translation';
    const audioKind: AudioStreamKind = 'presenter_narration';
    const speaker = format === 'explanatory_dialogue' ? STUDIO_PRESENTERS.researcher : STUDIO_PRESENTERS.presenter;
    addSeg({
      section: 'evidence',
      sectionLabel: `3. Evidence · ${ref.grade ? `${ref.grade} · ` : ''}${ref.locator}`,
      speakerId: speaker.id,
      speakerName: speaker.name,
      speakerRoleLabel: speaker.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'exact_quotation',
      originBadge: badge,
      audioKind,
      text: ref.passage,
      arabicText: ref.arabic,
      citations: [ref.id],
      translationEdition: `${ref.provider} ${ref.itemId}${ref.grade ? ` · Grade: ${ref.grade}` : ''} · ${ref.locator}`,
      sourceLanguage: brief.lang,
      directAudioUrl: null,
    });
  }

  const coverageAside = mapped.coverage.filter(note => note.kind !== 'evidence_found');
  for (const note of coverageAside.slice(0, 2)) {
    addSeg({
      section: 'exploration',
      sectionLabel: `4. Exploration · ${note.kind}`,
      speakerId: 'presenter',
      speakerName: STUDIO_PRESENTERS.presenter.name,
      speakerRoleLabel: STUDIO_PRESENTERS.presenter.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'presenter_reflection',
      originBadge: 'Dragon Dawwa generated material',
      audioKind: 'presenter_narration',
      text: `Coverage note from ${note.provider}: ${note.detail} This note records the search limit. It is not a new ruling.`,
      arabicText: null,
      citations: [first.id],
      translationEdition: null,
      sourceLanguage: brief.lang,
      directAudioUrl: null,
    });
  }

  const unsupported = mapped.claims.filter(claim => claim.support !== 'supported');
  if (unsupported.length === 0) {
    addSeg({
      section: 'application',
      sectionLabel: '5. Application',
      speakerId: 'presenter',
      speakerName: STUDIO_PRESENTERS.presenter.name,
      speakerRoleLabel: STUDIO_PRESENTERS.presenter.roleTitle,
      isGeneratedSpeaker: true,
      statementKind: 'presenter_reflection',
      originBadge: 'Dragon Dawwa generated material',
      audioKind: 'presenter_narration',
      text: 'The opened passage is read above with its published grade and locator. Dragon Dawwa does not turn that passage into a new ruling in this line.',
      arabicText: null,
      citations: [first.id],
      translationEdition: null,
      sourceLanguage: brief.lang,
      directAudioUrl: null,
    });
  } else {
    for (const claim of unsupported.slice(0, 4)) {
      const cited = mapped.references.find(ref => claim.passageIds.includes(ref.id)) ?? first;
      addSeg({
        section: 'application',
        sectionLabel: `5. Application · ${claim.support}`,
        speakerId: 'presenter',
        speakerName: STUDIO_PRESENTERS.presenter.name,
        speakerRoleLabel: STUDIO_PRESENTERS.presenter.roleTitle,
        isGeneratedSpeaker: true,
        statementKind: 'presenter_reflection',
        originBadge: 'Dragon Dawwa generated material',
        audioKind: 'presenter_narration',
        text: `This claim stays unverified (${claim.support}): ${claim.claim}. ${claim.note}`,
        arabicText: null,
        citations: [cited.id],
        translationEdition: null,
        sourceLanguage: brief.lang,
        directAudioUrl: null,
      });
    }
  }

  addSeg({
    section: 'closing',
    sectionLabel: '6. Closing',
    speakerId: 'presenter',
    speakerName: STUDIO_PRESENTERS.presenter.name,
    speakerRoleLabel: STUDIO_PRESENTERS.presenter.roleTitle,
    isGeneratedSpeaker: true,
    statementKind: 'presenter_reflection',
    originBadge: 'Dragon Dawwa generated material',
    audioKind: 'presenter_narration',
    text: 'The programme returns to the listener after these passages. Publication still waits for a human editor.',
    arabicText: null,
    citations: [first.id],
    translationEdition: null,
    sourceLanguage: brief.lang,
    directAudioUrl: null,
  });

  const citationIds = mapped.references.map(ref => ref.id);
  const outline: EpisodeOutlineItem[] = [
    { section: 'opening', heading: '1. Opening', summary: `Introduce ${brief.topic} without replacing the source text.`, plannedCitationIds: [first.id] },
    { section: 'orientation', heading: '2. Orientation', summary: brief.learningObjective, plannedCitationIds: citationIds },
    { section: 'evidence', heading: '3. Evidence', summary: `Read ${mapped.references.length} retrieved passage(s) with published grades and locators.`, plannedCitationIds: citationIds },
    { section: 'exploration', heading: '4. Exploration', summary: 'Coverage notes from the research job.', plannedCitationIds: citationIds },
    { section: 'application', heading: '5. Application', summary: 'Unsupported claims stay unverified for a human editor.', plannedCitationIds: citationIds },
    { section: 'closing', heading: '6. Closing', summary: 'Editorial review handoff.', plannedCitationIds: [first.id] },
  ];

  const verification = verifyStudioEpisode(segments, mapped.references, {
    currentRevision: 1,
    approvedRevision: null,
    narratedRevision: null,
  });
  const gaps: PilotGap[] = mapped.gaps;
  const episode: StudioEpisode = {
    id,
    slug: id,
    familyId: brief.familyId,
    title: brief.topic.slice(0, 140),
    subtitle: `Research job ${response.job.id.slice(0, 8)} · Draft (${brief.lang.toUpperCase()})`,
    summary: brief.learningObjective,
    lang: brief.lang,
    availableLanguages: [brief.lang],
    format,
    broadcastLabel: 'On demand',
    editorialState: 'needs-review',
    currentRevision: 1,
    approvedRevision: null,
    narratedRevision: null,
    approvalValid: false,
    narrationValid: false,
    published: false,
    presenters: format === 'explanatory_dialogue' ? [STUDIO_PRESENTERS.presenter, STUDIO_PRESENTERS.researcher] : [STUDIO_PRESENTERS.presenter],
    brief,
    outline,
    segments,
    references: mapped.references,
    evidence: mapped.references.map(referenceEvidence),
    gaps,
    disagreements: mapped.disagreements,
    verification,
    reviews: [],
    revisions: [
      {
        revision: 1,
        state: 'needs-review',
        updatedAt: now,
        updatedBy: 'Studio Production Pipeline',
        changeNote: 'Generated from a completed research job. Presenter lines and unsupported claims remain unverified.',
        segmentCount: segments.length,
        contentHash: computeSegmentsHash(segments),
        verificationSupported: verification.supported,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  return { episode, dossierSummary: summaryFrom(mapped, response) };
}

function summaryFrom(
  mapped: ReturnType<typeof referencesFromJob>,
  response: ResearchJobResponse,
): StudioDossierSummary {
  return {
    examined: [
      ...mapped.coverage.filter(note => note.kind === 'evidence_found').map(note => note.detail),
      ...mapped.references.map(ref => `${ref.provider} ${ref.itemId} · ${ref.grade ?? 'no published grade'} · ${ref.locator}`),
    ],
    notExamined: mapped.coverage
      .filter(note => note.kind === 'budget_exhausted' || note.kind === 'language_unavailable' || note.kind === 'source_unavailable')
      .map(note => `${note.kind}: ${note.detail}`),
    unanswered: mapped.gaps.map(gap => gap.message),
    disagreements: mapped.disagreements,
    coverage: response.job.coverage,
    claims: mapped.claims,
  };
}

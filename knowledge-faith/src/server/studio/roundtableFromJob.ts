import type { ResearchJobResponse } from '../../shared/contracts/v1.ts';
import { referenceEvidence } from '../../shared/research.ts';
import type { StudioDossierSummary, StudioEpisode, TopicBrief } from '../../shared/studio/contracts.ts';
import { toRoundtableEpisode } from '../../shared/studio/roundtable.ts';
import { computeSegmentsHash } from '../../shared/studio/verification.ts';
import { UpstreamError } from '../http.ts';
import { referencesFromJob } from './fromJob.ts';

/**
 * Listener roundtable from a completed research job.
 * Quoted passages stay exact. Generated conversation stays unverified. Nothing is published.
 */
export function assembleRoundtableFromJob(
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

  const shell: StudioEpisode = {
    id,
    slug: id,
    familyId: brief.familyId,
    title: brief.topic.slice(0, 140),
    subtitle: `Roundtable draft · ${brief.lang.toUpperCase()}`,
    summary: brief.learningObjective,
    lang: brief.lang,
    availableLanguages: [brief.lang],
    format: 'explanatory_dialogue',
    broadcastLabel: 'On demand',
    editorialState: 'needs-review',
    currentRevision: 1,
    approvedRevision: null,
    narratedRevision: null,
    approvalValid: false,
    narrationValid: false,
    published: false,
    presenters: [],
    brief,
    outline: [
      { section: 'opening', heading: 'Opening', summary: 'Welcome and the question.', plannedCitationIds: [mapped.references[0].id] },
      { section: 'evidence', heading: 'Source', summary: 'Retrieved wording, recitation or published meaning audio.', plannedCitationIds: mapped.references.map(ref => ref.id) },
      { section: 'application', heading: 'Example', summary: 'An example labelled as an example.', plannedCitationIds: [mapped.references[0].id] },
      { section: 'closing', heading: 'Closing', summary: 'A practical reflection. Not a ruling.', plannedCitationIds: [mapped.references[0].id] },
    ],
    segments: [],
    references: mapped.references,
    evidence: mapped.references.map(referenceEvidence),
    gaps: mapped.gaps,
    disagreements: mapped.disagreements,
    verification: {
      supported: false,
      missingCitations: [],
      unfaithful: [],
      unverified: [],
      review: 'editorial',
      allCitationsResolve: false,
      quotationsMatchEdition: false,
      languagesIdentified: false,
      gradesPreserved: false,
      scientificLimitationsRepresented: false,
      narrationMatchesApprovedRevision: false,
      unresolvedCitationIds: [],
      note: 'Generated roundtable lines stay unverified until a human editor reviews them.',
    },
    reviews: [],
    revisions: [],
    createdAt: now,
    updatedAt: now,
  };

  const episode = toRoundtableEpisode(shell);
  episode.id = id;
  episode.revisions = [
    {
      revision: 1,
      state: 'needs-review',
      updatedAt: now,
      updatedBy: 'Roundtable',
      changeNote: 'Generated roundtable. Dialogue is unverified. Retrieved passages stay exact. Not published.',
      segmentCount: episode.segments.length,
      contentHash: computeSegmentsHash(episode.segments),
      verificationSupported: episode.verification.supported,
    },
  ];

  const dossierSummary: StudioDossierSummary = {
    examined: mapped.references.map(ref => `${ref.provider} ${ref.itemId} · ${ref.grade ?? 'no published grade'} · ${ref.locator}`),
    notExamined: mapped.coverage
      .filter(note => note.kind === 'budget_exhausted' || note.kind === 'language_unavailable' || note.kind === 'source_unavailable')
      .map(note => `${note.kind}: ${note.detail}`),
    unanswered: mapped.gaps.map(gap => gap.message),
    disagreements: mapped.disagreements,
    coverage: response.job.coverage,
    claims: mapped.claims,
  };
  return { episode, dossierSummary };
}

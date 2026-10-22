import {
  referenceEvidence,
  verifyScript,
  type ResearchReference,
} from '../research.ts';
import { EditorialError, hasRole, type EditorUser, type Role } from '../spiritual/governance.ts';
import type { PodcastLine } from '../types.ts';
import type {
  StudioAskAnswer,
  StudioEditorialState,
  StudioEpisode,
  StudioReviewEntry,
  StudioSegment,
  StudioVerificationReport,
} from './contracts.ts';

const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['“', '”'],
  ['«', '»'],
  ['「', '」'],
  ['『', '』'],
  ['„', '“'],
  ['"', '"'],
  ['‘', '’'],
];

const FRAMING_WORDS = new Set([
  'the', 'book', 'says', 'said', 'say', 'in', 'this', 'section', 'passage', 'source', 'according', 'to', 'here',
  'we', 'read', 'that', 'a', 'an', 'of', 'and', 'its', 'it', 'is', 'as', 'for', 'from', 'on', 'by', 'host',
  'records', 'recorded', 'writes', 'wrote', 'states', 'stated', 'under', 'heading', 'verse', 'ayah', 'hadith',
]);

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractQuotations(text: string): string[] {
  const found: string[] = [];
  for (const [open, close] of QUOTE_PAIRS) {
    let from = 0;
    while (from < text.length) {
      const start = text.indexOf(open, from);
      if (start < 0) break;
      const end = text.indexOf(close, start + open.length);
      if (end < 0) break;
      const quote = compact(text.slice(start + open.length, end));
      if (quote.length >= 6) found.push(quote);
      from = end + close.length;
    }
  }
  return found;
}

function isFramingOnly(text: string): boolean {
  const tokens = text.toLocaleLowerCase('en').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.length === 0 || tokens.every(token => FRAMING_WORDS.has(token));
}

/**
 * Checks if a line that quotes a passage also appends unverified commentary or paraphrase outside the quotation.
 */
function hasUnverifiedResidueOutsideQuotes(text: string, passages: string[]): boolean {
  const compactLine = compact(text);
  if (!compactLine) return false;
  // If the entire line is inside a cited passage, there is no outside residue
  if (passages.some(p => p.includes(compactLine))) return false;

  let residue = text;
  for (const quote of extractQuotations(text)) {
    residue = residue.replace(quote, ' ');
  }
  residue = residue.replace(/[“”«»「」『』„"‘’]/g, ' ');
  const compactResidue = compact(residue);
  if (!compactResidue || isFramingOnly(compactResidue)) return false;
  return !passages.some(p => p.includes(compactResidue));
}

export function computeSegmentsHash(segments: StudioSegment[]): string {
  const payload = segments
    .map(s => `${s.id}|${s.speakerId}|${s.statementKind}|${s.audioKind}|${s.text}|${s.arabicText ?? ''}|${s.citations.join(',')}`)
    .join('\n');
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Verifies a Studio episode script using the committed `verifyScript()` from `src/shared/research.ts`
 * plus strict residue checking so appended paraphrases outside quotation marks are never auto-certified.
 *
 * CRITICAL RULE:
 * - Word/token overlap is a retrieval relevance signal, NEVER proof of claim support.
 * - Any paraphrase — whether sharing words with the passage, appended after a valid quotation,
 *   unrelated, or contradictory — remains in `unverified` (`supported: false`, `review: 'editorial'`).
 */
export function verifyStudioEpisode(
  segments: StudioSegment[],
  references: ResearchReference[],
  meta?: {
    currentRevision?: number;
    approvedRevision?: number | null;
    narratedRevision?: number | null;
  },
): StudioVerificationReport {
  const evidence = references.map(referenceEvidence);
  const byId = new Map(evidence.map(e => [e.id, e]));

  const lines: PodcastLine[] = segments.map(seg => ({
    speaker: seg.speakerId === 'researcher' ? 'Guest' : 'Host',
    text: seg.text,
    citations: seg.citations,
  }));

  const baseVerification = verifyScript(lines, evidence);
  const unverifiedSet = new Set(baseVerification.unverified);

  const unresolvedCitationIds: string[] = [];
  let languagesIdentified = true;
  let gradesPreserved = true;
  let scientificLimitationsRepresented = true;

  for (const ref of references) {
    if (!ref.passageLanguage) {
      languagesIdentified = false;
    }
    if (ref.provider === 'HadeethEnc') {
      const hasGrade = Boolean(ref.grade && ref.grade.trim());
      const hasNoGradeNote = ref.limitations.some(l => /did not include a grade|no grading/i.test(l));
      if (!hasGrade && !hasNoGradeNote) {
        gradesPreserved = false;
      }
    }
  }

  segments.forEach((segment, idx) => {
    const label = `Line ${idx + 1}`;
    if (!segment.sourceLanguage) {
      languagesIdentified = false;
    }
    if (segment.statementKind === 'published_translation' && !segment.translationEdition) {
      languagesIdentified = false;
    }
    for (const cid of segment.citations) {
      if (!byId.has(cid)) {
        unresolvedCitationIds.push(`${label}: ${cid}`);
      }
    }
    const passages = segment.citations.map(cid => compact(byId.get(cid)?.text ?? '')).filter(Boolean);
    if (passages.length > 0 && !baseVerification.unfaithful.includes(label)) {
      if (hasUnverifiedResidueOutsideQuotes(segment.text, passages)) {
        unverifiedSet.add(label);
      }
    }
    if (segment.statementKind === 'scientific_evidence' || /\b(scientific proof|science proves|physics|biology|chemistry|medicine)\b/i.test(segment.text)) {
      const hasLimitOnSegment = Boolean(segment.scientificLimitation && segment.scientificLimitation.trim());
      const hasLimitOnRef = references
        .filter(r => segment.citations.includes(r.id))
        .some(r => r.limitations.some(l => /scientific|empirical|provisional|not scientific evidence/i.test(l)));
      if (!hasLimitOnSegment && !hasLimitOnRef) {
        scientificLimitationsRepresented = false;
      }
    }
  });

  const unverified = [...unverifiedSet];
  const allCitationsResolve = unresolvedCitationIds.length === 0 && baseVerification.missingCitations.length === 0;
  const quotationsMatchEdition = baseVerification.unfaithful.length === 0;

  const curRev = meta?.currentRevision ?? 1;
  const appRev = meta?.approvedRevision ?? null;
  const narRev = meta?.narratedRevision ?? null;
  const narrationMatchesApprovedRevision =
    narRev === null ? true : appRev !== null && narRev === curRev && appRev === curRev;

  const supported =
    baseVerification.missingCitations.length === 0 &&
    baseVerification.unfaithful.length === 0 &&
    unverified.length === 0 &&
    allCitationsResolve &&
    quotationsMatchEdition &&
    languagesIdentified &&
    gradesPreserved &&
    scientificLimitationsRepresented;

  return {
    ...baseVerification,
    unverified,
    supported,
    allCitationsResolve,
    quotationsMatchEdition,
    languagesIdentified,
    gradesPreserved,
    scientificLimitationsRepresented,
    narrationMatchesApprovedRevision,
    unresolvedCitationIds,
  };
}

export function applyEpisodeScriptEdit(
  episode: StudioEpisode,
  newSegments: StudioSegment[],
  editorName: string,
  changeNote: string,
  now = new Date().toISOString(),
): StudioEpisode {
  const oldHash = computeSegmentsHash(episode.segments);
  const newHash = computeSegmentsHash(newSegments);
  const contentChanged = oldHash !== newHash;

  if (!contentChanged) {
    return {
      ...episode,
      updatedAt: now,
    };
  }

  const nextRevision = episode.currentRevision + 1;
  const nextState: StudioEditorialState =
    episode.editorialState === 'approved' ||
    episode.editorialState === 'narrated' ||
    episode.editorialState === 'published'
      ? 'needs-review'
      : episode.editorialState === 'draft' || episode.editorialState === 'researching'
        ? 'scripted'
        : episode.editorialState;

  const verification = verifyStudioEpisode(newSegments, episode.references, {
    currentRevision: nextRevision,
    approvedRevision: episode.approvedRevision,
    narratedRevision: episode.narratedRevision,
  });

  const updatedVerification: StudioVerificationReport = {
    ...verification,
    narrationMatchesApprovedRevision: false,
  };

  return {
    ...episode,
    segments: newSegments,
    currentRevision: nextRevision,
    editorialState: nextState,
    approvalValid: false,
    narrationValid: false,
    published: false,
    verification: updatedVerification,
    revisions: [
      ...episode.revisions,
      {
        revision: nextRevision,
        state: nextState,
        updatedAt: now,
        updatedBy: editorName,
        changeNote: changeNote.trim() || 'Edited script segments; prior approval and narration invalidated.',
        segmentCount: newSegments.length,
        contentHash: newHash,
        verificationSupported: updatedVerification.supported,
      },
    ],
    updatedAt: now,
  };
}

export type StudioTransitionAction =
  | 'submit-for-review'
  | 'approve-script'
  | 'record-narration'
  | 'publish-episode'
  | 'withdraw-episode'
  | 'return-to-draft';

const TRANSITION_ROLES: Record<StudioTransitionAction, Role[]> = {
  'submit-for-review': ['author', 'source-checker', 'publisher'],
  'approve-script': ['source-checker', 'religious-reviewer', 'language-reviewer'],
  'record-narration': ['author', 'publisher'],
  'publish-episode': ['publisher'],
  'withdraw-episode': ['publisher'],
  'return-to-draft': ['author', 'source-checker', 'religious-reviewer', 'language-reviewer', 'publisher'],
};

export function transitionStudioEpisode(
  episode: StudioEpisode,
  action: StudioTransitionAction,
  user: EditorUser,
  notes = '',
  now = new Date().toISOString(),
): StudioEpisode {
  const requiredRoles = TRANSITION_ROLES[action];
  if (!requiredRoles || !hasRole(user, requiredRoles)) {
    throw new EditorialError(`This Studio action (${action}) requires role: ${requiredRoles?.join(' or ')}.`, 403);
  }

  const verification = verifyStudioEpisode(episode.segments, episode.references, {
    currentRevision: episode.currentRevision,
    approvedRevision: episode.approvedRevision,
    narratedRevision: episode.narratedRevision,
  });

  if (action === 'submit-for-review') {
    const nextState: StudioEditorialState = 'needs-review';
    return {
      ...episode,
      editorialState: nextState,
      verification,
      revisions: [
        ...episode.revisions,
        {
          revision: episode.currentRevision,
          state: nextState,
          updatedAt: now,
          updatedBy: user.name,
          changeNote: notes || 'Submitted script for editorial review.',
          segmentCount: episode.segments.length,
          contentHash: computeSegmentsHash(episode.segments),
          verificationSupported: verification.supported,
        },
      ],
      updatedAt: now,
    };
  }

  if (action === 'approve-script') {
    if (!verification.supported) {
      throw new EditorialError(
        `Cannot approve script while automated verification reports unverified or unsupported lines: ${[
          ...verification.missingCitations.map(m => `missing citation on ${m}`),
          ...verification.unfaithful.map(u => `unfaithful quotation on ${u}`),
          ...verification.unverified.map(c => `unverified claim/paraphrase on ${c}`),
          ...verification.unresolvedCitationIds.map(id => `unresolved citation ${id}`),
        ].join('; ')}`,
        409,
      );
    }
    const reviewEntry: StudioReviewEntry = {
      id: `rev-${episode.currentRevision}-${episode.reviews.length + 1}`,
      reviewerId: user.id,
      reviewerName: user.name,
      role: user.roles[0] ?? 'source-checker',
      decision: 'approved',
      notes: notes || 'Verified citations, quotations, and source attributions.',
      createdAt: now,
      scriptRevision: episode.currentRevision,
    };
    const nextState: StudioEditorialState = 'approved';
    return {
      ...episode,
      editorialState: nextState,
      approvedRevision: episode.currentRevision,
      approvalValid: true,
      narrationValid: episode.narratedRevision === episode.currentRevision,
      reviews: [...episode.reviews, reviewEntry],
      verification: {
        ...verification,
        narrationMatchesApprovedRevision: episode.narratedRevision === episode.currentRevision,
      },
      revisions: [
        ...episode.revisions,
        {
          revision: episode.currentRevision,
          state: nextState,
          updatedAt: now,
          updatedBy: user.name,
          changeNote: notes || `Approved revision ${episode.currentRevision}.`,
          segmentCount: episode.segments.length,
          contentHash: computeSegmentsHash(episode.segments),
          verificationSupported: true,
        },
      ],
      updatedAt: now,
    };
  }

  if (action === 'record-narration') {
    if (!episode.approvalValid || episode.approvedRevision !== episode.currentRevision) {
      throw new EditorialError('Script revision must be approved before recording official episode narration.', 409);
    }
    const nextState: StudioEditorialState = 'narrated';
    return {
      ...episode,
      editorialState: nextState,
      narratedRevision: episode.currentRevision,
      narrationValid: true,
      verification: {
        ...verification,
        narrationMatchesApprovedRevision: true,
      },
      revisions: [
        ...episode.revisions,
        {
          revision: episode.currentRevision,
          state: nextState,
          updatedAt: now,
          updatedBy: user.name,
          changeNote: notes || `Recorded narration for approved revision ${episode.currentRevision}.`,
          segmentCount: episode.segments.length,
          contentHash: computeSegmentsHash(episode.segments),
          verificationSupported: true,
        },
      ],
      updatedAt: now,
    };
  }

  if (action === 'publish-episode') {
    if (!episode.approvalValid || episode.approvedRevision !== episode.currentRevision) {
      throw new EditorialError('Cannot publish an episode whose current script revision is not approved.', 409);
    }
    if (!verification.supported) {
      throw new EditorialError('Cannot publish an episode with failing citation or claim verification.', 409);
    }
    const nextState: StudioEditorialState = 'published';
    return {
      ...episode,
      editorialState: nextState,
      published: true,
      verification: {
        ...verification,
        narrationMatchesApprovedRevision:
          episode.narratedRevision === null || episode.narratedRevision === episode.currentRevision,
      },
      revisions: [
        ...episode.revisions,
        {
          revision: episode.currentRevision,
          state: nextState,
          updatedAt: now,
          updatedBy: user.name,
          changeNote: notes || `Published revision ${episode.currentRevision}.`,
          segmentCount: episode.segments.length,
          contentHash: computeSegmentsHash(episode.segments),
          verificationSupported: true,
        },
      ],
      updatedAt: now,
    };
  }

  if (action === 'withdraw-episode') {
    const nextState: StudioEditorialState = 'withdrawn';
    return {
      ...episode,
      editorialState: nextState,
      published: false,
      revisions: [
        ...episode.revisions,
        {
          revision: episode.currentRevision,
          state: nextState,
          updatedAt: now,
          updatedBy: user.name,
          changeNote: notes || 'Withdrawn from public catalogue.',
          segmentCount: episode.segments.length,
          contentHash: computeSegmentsHash(episode.segments),
          verificationSupported: verification.supported,
        },
      ],
      updatedAt: now,
    };
  }

  const nextState: StudioEditorialState = 'draft';
  return {
    ...episode,
    editorialState: nextState,
    approvalValid: false,
    narrationValid: false,
    published: false,
    revisions: [
      ...episode.revisions,
      {
        revision: episode.currentRevision,
        state: nextState,
        updatedAt: now,
        updatedBy: user.name,
        changeNote: notes || 'Returned to draft.',
        segmentCount: episode.segments.length,
        contentHash: computeSegmentsHash(episode.segments),
        verificationSupported: verification.supported,
      },
    ],
    updatedAt: now,
  };
}

export function assertNotPrivateAnswerForPublication(item: unknown): void {
  if (item && typeof item === 'object' && (item as Partial<StudioAskAnswer>).visibility === 'private_session') {
    throw new EditorialError('Private listener answers are session-scoped and cannot be promoted or published as public episodes.', 403);
  }
}

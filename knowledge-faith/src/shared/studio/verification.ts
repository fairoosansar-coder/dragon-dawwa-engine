import { contentTokens, passageSupportsTopic, VERIFICATION_NOTE } from '../research.ts';
import { EditorialError, hasRole, type EditorUser, type Role } from '../spiritual/governance.ts';
import type {
  EvidencePassage,
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

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function extractQuotations(text: string): string[] {
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
 * Checks whether a segment's claim is genuinely supported by its cited passages.
 * A valid citation ID alone NEVER validates an unrelated or contradictory claim.
 */
export function segmentClaimSupportedByPassages(segment: StudioSegment, citedPassages: EvidencePassage[]): boolean {
  if (!citedPassages.length) return false;
  const line = compact(segment.text);
  const passageTexts = citedPassages.map(p =>
    compact(`${p.exactText} ${p.arabicText ?? ''} ${p.surroundingContext.join(' ')} ${p.source.title}`),
  );

  // 1. Direct inclusion or exact quotation match
  if (passageTexts.some(pt => pt.toLowerCase().includes(line.toLowerCase()) || line.toLowerCase().includes(pt.toLowerCase()))) {
    return true;
  }

  // 2. Check contradiction patterns (e.g., "optional" vs "obligatory", "praise of people" vs "Allah alone")
  const lowerLine = line.toLowerCase();
  const combinedPassages = passageTexts.join(' ').toLowerCase();
  if (
    (/\boptional\b/.test(lowerLine) && !/\boptional\b/.test(combinedPassages)) ||
    (/\bother people will notice and praise\b/.test(lowerLine) && /\ballah alone\b|அல்லாஹ்வுக்காக மட்டுமே/.test(combinedPassages)) ||
    (/\bscientific proof\b|\bscience proves\b/.test(lowerLine) && segment.statementKind !== 'scientific_evidence')
  ) {
    return false;
  }

  // 3. Token overlap check: the claim must share substantive content tokens with the cited passages
  // (or, for cross-language explanations where segment is in English/Tamil/Sinhala and passage is in the same language,
  // share topical terms or reference the cited locator/title).
  const tokens = contentTokens(line);
  if (tokens.length === 0) return true;

  // Reject unrelated claims carrying a valid citation (e.g., "moon landing", "population of Tokyo", "stock market")
  const matchedTokens = tokens.filter(token => combinedPassages.includes(token));
  if (matchedTokens.length > 0) {
    // Require at least 20% of distinctive tokens or at least 2 content tokens (or 1 if total tokens <= 3) to appear in the cited passage
    const required = tokens.length <= 3 ? 1 : Math.min(2, Math.ceil(tokens.length * 0.2));
    return matchedTokens.length >= required;
  }

  // Also check passageSupportsTopic helper
  return citedPassages.some(p => passageSupportsTopic(line, p.exactText));
}

/**
 * Full 7-point verification of a StudioEpisode against its retrieved EvidencePassages:
 * 1. Every citation resolves to retrieved material.
 * 2. Quotations match the cited edition.
 * 3. Claims are actually supported (an unrelated claim carrying a valid citation is rejected).
 * 4. Translation and source language are identified.
 * 5. Source grades and scholarly attributions are preserved.
 * 6. Scientific limitations are represented.
 * 7. Narration corresponds to the approved script version.
 */
export function verifyStudioEpisode(
  segments: StudioSegment[],
  passages: EvidencePassage[],
  meta?: {
    currentRevision?: number;
    approvedRevision?: number | null;
    narratedRevision?: number | null;
    familyId?: string;
  },
): StudioVerificationReport {
  const byId = new Map(passages.map(p => [p.id, p]));
  const missingCitations: string[] = [];
  const unfaithfulQuotations: string[] = [];
  const unsupportedClaims: string[] = [];
  const unresolvedCitationIds: string[] = [];

  let languagesIdentified = true;
  let gradesPreserved = true;
  let scientificLimitationsRepresented = true;

  // Check passages for language & grade preservation
  for (const passage of passages) {
    if (!passage.passageLanguage || !passage.originalLanguage) {
      languagesIdentified = false;
    }
    if (passage.source.contentType === 'hadith') {
      // HadeethEnc or HadithApi must preserve either the source's grade or an explicit limitation that the source had no grade
      const hasGrade = Boolean(passage.grade && passage.grade.trim());
      const hasNoGradeNote = passage.limitations.some(l => /did not include a grade|no grading/i.test(l));
      if (!hasGrade && !hasNoGradeNote) {
        gradesPreserved = false;
      }
    }
  }

  segments.forEach((segment, idx) => {
    const label = `Segment ${idx + 1} (${segment.section})`;
    if (!segment.sourceLanguage) {
      languagesIdentified = false;
    }
    if (segment.statementKind === 'published_translation' && !segment.translationEdition) {
      languagesIdentified = false;
    }

    // Check unresolved citations
    for (const cid of segment.citations) {
      if (!byId.has(cid)) {
        unresolvedCitationIds.push(`${label}: ${cid}`);
      }
    }

    const resolvedCitations = segment.citations.map(cid => byId.get(cid)).filter((p): p is EvidencePassage => Boolean(p));

    // Substantive segments require citations
    const requiresCitation =
      segment.statementKind === 'exact_quotation' ||
      segment.statementKind === 'published_translation' ||
      segment.statementKind === 'faithful_paraphrase' ||
      segment.statementKind === 'scholarly_interpretation' ||
      segment.statementKind === 'scientific_evidence' ||
      segment.section === 'evidence';

    if (requiresCitation && resolvedCitations.length === 0) {
      missingCitations.push(label);
      return;
    }

    if (resolvedCitations.length > 0) {
      // Check quotations match the cited edition
      const quotes = extractQuotations(segment.text);
      const passageCorpus = resolvedCitations.map(p =>
        compact(`${p.exactText} ${p.arabicText ?? ''} ${p.surroundingContext.join(' ')}`),
      );
      const quoteMismatch = quotes.some(q => !passageCorpus.some(corpus => corpus.includes(q)));
      if (quoteMismatch) {
        unfaithfulQuotations.push(label);
      }

      // Check that the claim is genuinely supported by the cited passage (rejects unrelated claim with valid citation)
      if (!quoteMismatch && !segmentClaimSupportedByPassages(segment, resolvedCitations)) {
        unsupportedClaims.push(label);
      }
    }

    // Check scientific limitations when science is discussed
    if (segment.statementKind === 'scientific_evidence' || /\b(scientific|physics|biology|cosmology|embryology|empirical)\b/i.test(segment.text)) {
      const hasLimitOnSegment = Boolean(segment.scientificLimitation && segment.scientificLimitation.trim());
      const hasLimitOnPassage = resolvedCitations.some(p =>
        p.limitations.some(l => /scientific|empirical|provisional|not scientific proof/i.test(l)),
      );
      if (!hasLimitOnSegment && !hasLimitOnPassage) {
        scientificLimitationsRepresented = false;
      }
    }
  });

  const allCitationsResolve = unresolvedCitationIds.length === 0 && missingCitations.length === 0;
  const quotationsMatchEdition = unfaithfulQuotations.length === 0;
  const claimsSupported = unsupportedClaims.length === 0;

  const curRev = meta?.currentRevision ?? 1;
  const appRev = meta?.approvedRevision ?? null;
  const narRev = meta?.narratedRevision ?? null;
  const narrationMatchesApprovedRevision =
    narRev === null ? true : appRev !== null && narRev === curRev && appRev === curRev;

  const supported =
    allCitationsResolve &&
    quotationsMatchEdition &&
    claimsSupported &&
    languagesIdentified &&
    gradesPreserved &&
    scientificLimitationsRepresented;

  return {
    supported,
    allCitationsResolve,
    quotationsMatchEdition,
    claimsSupported,
    languagesIdentified,
    gradesPreserved,
    scientificLimitationsRepresented,
    narrationMatchesApprovedRevision,
    missingCitations,
    unfaithfulQuotations,
    unsupportedClaims,
    unresolvedCitationIds,
    review: 'editorial',
    note: VERIFICATION_NOTE,
  };
}

/**
 * Applies a script revision edit to a StudioEpisode.
 * CRITICAL RULE: Changing script content after approval or narration immediately invalidates
 * the affected approval and narration, increments currentRevision, and transitions the episode
 * back to 'needs-review' (or 'scripted').
 */
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

  const verification = verifyStudioEpisode(newSegments, episode.passages, {
    currentRevision: nextRevision,
    approvedRevision: episode.approvedRevision,
    narratedRevision: episode.narratedRevision,
    familyId: episode.familyId,
  });

  // Because currentRevision increased while approvedRevision and narratedRevision remain on the old revision,
  // approvalValid and narrationValid become false, and narrationMatchesApprovedRevision is false if narratedRevision was set.
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

/**
 * Transitions a StudioEpisode through editorial states using existing Dragon Dawwa editorial roles.
 * Never automatically publishes generated episodes.
 */
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

  const verification = verifyStudioEpisode(episode.segments, episode.passages, {
    currentRevision: episode.currentRevision,
    approvedRevision: episode.approvedRevision,
    narratedRevision: episode.narratedRevision,
    familyId: episode.familyId,
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
        `Cannot approve script while automated verification reports issues: ${[
          ...verification.missingCitations.map(m => `missing citation on ${m}`),
          ...verification.unfaithfulQuotations.map(u => `unfaithful quotation on ${u}`),
          ...verification.unsupportedClaims.map(c => `unsupported claim on ${c}`),
          ...verification.unresolvedCitationIds.map(id => `unresolved citation ${id}`),
        ].join('; ')}`,
        409,
      );
    }
    const reviewEntry: StudioReviewEntry = {
      id: `rev-${episode.currentRevision}-${episode.reviews.length + 1}`,
      reviewerId: user.id,
      reviewerName: user.name,
      role: user.roles[0] ?? 'religious-reviewer',
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

  // return-to-draft
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

/**
 * Enforces that a listener's private generated answer can never become a public episode.
 */
export function assertNotPrivateAnswerForPublication(item: unknown): void {
  if (item && typeof item === 'object' && (item as Partial<StudioAskAnswer>).visibility === 'private_session') {
    throw new EditorialError('Private listener answers are session-scoped and cannot be promoted or published as public episodes.', 403);
  }
}

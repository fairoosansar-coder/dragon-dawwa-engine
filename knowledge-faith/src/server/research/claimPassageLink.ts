/**
 * Auto-link claims / answer paragraphs to retrieved passages when they
 * reference the same verse or source locator (e.g. Qur'an 49:6 ↔ Q49-6).
 * Sets citationExists / citationRelevant; leaves genuinely unverified claims
 * as `insufficient` (does not invent support).
 */

import type {
  ClaimEvidence,
  EvidencePassage,
  ResearchAnswer,
} from '../../shared/contracts/v1.ts';
import { ayahsMentioned } from '../../shared/research.ts';

function verseKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

function passageMatchesRef(
  passage: EvidencePassage,
  surah: number,
  ayah: number,
): boolean {
  const id = passage.id.replace(/:/g, '-');
  if (id === `Q${surah}-${ayah}` || passage.id === `Q${surah}:${ayah}`) return true;
  const ref = verseKey(surah, ayah);
  if (passage.source?.id === ref) return true;
  const blob = `${passage.locator}\n${passage.source?.title ?? ''}\n${passage.text}`;
  return new RegExp(`\\b${surah}\\s*[:：]\\s*${ayah}\\b`).test(blob);
}

/** Passages in the job packet that match verse refs named in `text`. */
export function passagesReferencedInText(
  text: string,
  passages: readonly EvidencePassage[],
): EvidencePassage[] {
  const refs = ayahsMentioned(text);
  if (!refs.length || !passages.length) return [];
  const found: EvidencePassage[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    for (const passage of passages) {
      if (!passageMatchesRef(passage, ref.surah, ref.ayah)) continue;
      if (seen.has(passage.id)) continue;
      seen.add(passage.id);
      found.push(passage);
    }
  }
  return found;
}

/**
 * When a claim names a verse present in retrieved passages, attach those
 * passageIds and mark the citation as existing + relevant. Support stays
 * `insufficient` unless it was already `supported`.
 */
export function linkClaimToRetrievedPassages(
  claim: ClaimEvidence,
  passages: readonly EvidencePassage[],
): ClaimEvidence {
  const matched = passagesReferencedInText(claim.claim, passages);
  if (!matched.length) return claim;

  const passageIds = [...new Set([...claim.passageIds, ...matched.map(item => item.id)])];
  const alreadySupported = claim.support === 'supported';
  return {
    ...claim,
    passageIds,
    citationExists: true,
    citationRelevant: true,
    support: alreadySupported
      ? 'supported'
      : claim.support === 'citation_missing' || claim.support === 'unsupported'
        ? 'insufficient'
        : claim.support,
    note: alreadySupported
      ? claim.note
      : `Opened passage(s) ${passageIds.join(', ')} match a verse/source referenced in this claim. A locator match confirms the citation exists; it does not by itself establish the claim wording.`,
  };
}

export function linkClaimsToRetrievedPassages(
  claims: readonly ClaimEvidence[],
  passages: readonly EvidencePassage[],
): ClaimEvidence[] {
  return claims.map(claim => linkClaimToRetrievedPassages(claim, passages));
}

/** Attach passage ids to answer paragraphs that name opened verses. */
export function linkAnswerCitationsToPassages(
  answer: ResearchAnswer | null | undefined,
  passages: readonly EvidencePassage[],
): ResearchAnswer | null {
  if (!answer) return null;
  return {
    ...answer,
    paragraphs: answer.paragraphs.map(paragraph => {
      const matched = passagesReferencedInText(paragraph.text, passages);
      if (!matched.length) return paragraph;
      return {
        ...paragraph,
        citations: [...new Set([...paragraph.citations, ...matched.map(item => item.id)])],
      };
    }),
  };
}

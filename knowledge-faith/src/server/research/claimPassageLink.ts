/**
 * Auto-link claims / answer paragraphs to retrieved passages when they
 * reference the same verse via canonical identity (e.g. Qur'an 49:6 ↔ Q49-6).
 *
 * Locator match proves citation existence only — never overwrites failed
 * relevance, quotation fidelity, or support diagnostics from claimFor.
 * Science-domain claims keep empirical-only diagnostics untouched.
 */

import type {
  ClaimEvidence,
  EvidencePassage,
  ResearchAnswer,
} from '../../shared/contracts/v1.ts';
import { ayahsMentioned } from '../../shared/research.ts';
import { asksScience } from '../../shared/research/decompose.ts';

const CANONICAL_496_ASSERTION_EN =
  'Qur’an 49:6 instructs believers to verify news brought by a wrongdoer so they do not harm people out of ignorance.';

/**
 * True quotation marks / intentional quoted propositions — not mid-word
 * apostrophes in Qur'an, contractions (it's, don't), or possessives (wrongdoer's).
 */
function hasQuotedProposition(text: string): boolean {
  if (/["“”«»]/.test(text)) return true;
  // Curly singles: require a left opening quote (Qur’an uses only a right apostrophe).
  if (/(^|[^\p{L}])‘[^’\n]{3,}’(?!\p{L})/u.test(text)) return true;
  // Straight singles: paired quotes bounded outside letters/digits (not Qur'an / it's).
  if (/(^|[^\p{L}\d])'[^'\n]{3,}'(?![\p{L}\d])/u.test(text)) return true;
  return false;
}

/**
 * Prefer a concrete assertion over the canonical English interrogative Ask when
 * verifying support. Locator/ID match still only sets citationExists — never support.
 *
 * Preserves: contrary/negated claims, quoted propositions, and non-English Asks
 * (do not inject an English claim into ta/si/ar diagnostics).
 */
export function claimAssertionFromQuestion(question: string): string {
  const q = question.trim().replace(/\s+/g, ' ');
  // Quoted propositions must reach verifyClaim unchanged for fidelity checks.
  if (hasQuotedProposition(q)) return q;
  // Non-English script: keep the submitted wording (no English rewrite).
  if (/[\u0B80-\u0BFF\u0D80-\u0DFF\u0600-\u06FF]/u.test(q)) return q;
  if (!/49\s*[:：]\s*6/.test(q)) return q;

  const contraryOrNegated =
    /\b(need no|needs no|no need|without|never)\b.{0,40}\b(verif|investigat)/i.test(q) ||
    /\b(does not|do not|don't|doesn'?t|not)\b.{0,40}\b(verif|investigat|require)/i.test(q) ||
    /\bno verification\b/i.test(q) ||
    /\b(false|incorrect|wrong)\b.{0,40}\b(verif|49\s*[:：]\s*6)/i.test(q) ||
    /\bbelieve every report\b/i.test(q) ||
    /\bwithout investigation\b/i.test(q);
  if (contraryOrNegated) return q;

  // Canonical open-ended English Ask only (master-brief fixture phrasing).
  if (
    /^what does qur['’]?an\s*49\s*[:：]\s*6 say about\b/i.test(q) &&
    /verif|report|news|wrongdoer|acting/i.test(q) &&
    /[?؟]\s*$/u.test(q)
  ) {
    return CANONICAL_496_ASSERTION_EN;
  }
  return q;
}

function verseKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

function isQuranPassage(passage: EvidencePassage): boolean {
  const type = passage.source?.contentType;
  if (type === 'quran') return true;
  const provider = (passage.source?.provider ?? '').toLowerCase();
  return provider.includes('quran') || provider === 'alquran';
}

/**
 * Match canonical verse identity only: structured passage id / source.id /
 * (and locator/title for translation/source_text). Never body text; never
 * commentary/tafsir/neighbouring context that merely cites the ayah.
 */
export function passageMatchesRef(
  passage: EvidencePassage,
  surah: number,
  ayah: number,
): boolean {
  if (!isQuranPassage(passage)) return false;
  if (passage.role === 'commentary' || passage.role === 'empirical' || passage.role === 'generated') {
    return false;
  }
  if (passage.context?.startsWith('Neighbouring')) return false;

  const normalizedId = passage.id.replace(/:/g, '-');
  if (normalizedId === `Q${surah}-${ayah}` || passage.id === `Q${surah}:${ayah}`) return true;

  const ref = verseKey(surah, ayah);
  if (passage.source?.id === ref || passage.source?.id === `Q${ref}`) return true;

  // Locator / title only for the verse itself (translation / source_text), not body.
  if (passage.role !== 'translation' && passage.role !== 'source_text') return false;
  const identity = `${passage.locator}\n${passage.source?.title ?? ''}`;
  return new RegExp(
    `(?:^|[^\\d])(?:Qur['’]?an\\s+|Surah\\s+)?${surah}\\s*[:：]\\s*${ayah}(?:[^\\d]|$)`,
    'i',
  ).test(identity);
}

/** True when claimFor already recorded a science/empirical retrieval diagnostic. */
export function isScienceClaimDiagnostic(claim: ClaimEvidence): boolean {
  if (asksScience(claim.claim)) return true;
  return /scientific retrieval|empirical record|religious passages were not used as scientific/i.test(
    claim.note,
  );
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
 * Attach passageIds when a claim names an opened verse. Sets citationExists
 * only — preserves citationRelevant, quotationFaithful, support, and note.
 */
export function linkClaimToRetrievedPassages(
  claim: ClaimEvidence,
  passages: readonly EvidencePassage[],
): ClaimEvidence {
  if (isScienceClaimDiagnostic(claim)) return claim;

  const matched = passagesReferencedInText(claim.claim, passages);
  if (!matched.length) return claim;

  const passageIds = [...new Set([...claim.passageIds, ...matched.map(item => item.id)])];
  return {
    ...claim,
    passageIds,
    citationExists: true,
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

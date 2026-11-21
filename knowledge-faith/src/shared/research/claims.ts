import type { ClaimEvidence, ClaimSupport } from '../contracts/v1.ts';
import { contentTokens, passageSupportsTopic } from '../research.ts';
import { evaluateVerificationClaimAgainstPassages } from './claimMeaning.ts';

const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['“', '”'],
  ['«', '»'],
  ['"', '"'],
  ['‘', '’'],
];

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function quotations(text: string): string[] {
  const found: string[] = [];
  for (const [open, close] of QUOTE_PAIRS) {
    let from = 0;
    while (from < text.length) {
      const start = text.indexOf(open, from);
      if (start < 0) break;
      const end = text.indexOf(close, start + open.length);
      if (end < 0) break;
      const quote = compact(text.slice(start + open.length, end));
      if (quote.length >= 8) found.push(quote);
      from = end + close.length;
    }
  }
  return found;
}

export interface ClaimPassage {
  id: string;
  text: string;
}

/**
 * A citation id is not support, and a word match only identifies a candidate passage.
 * Exact quotation / exact claim wording → supported with quotationFaithful true|null as appropriate.
 * Conservative meaning check (opened edition text) can support a faithful paraphrase with quotationFaithful: null.
 * Word/token overlap alone stays 'insufficient'.
 */
export function verifyClaim(claim: string, citationId: string, passages: readonly ClaimPassage[]): ClaimEvidence {
  const passage = passages.find(item => item.id === citationId);
  if (!passage) {
    return {
      claim,
      passageIds: [],
      support: 'citation_missing',
      citationExists: false,
      quotationFaithful: null,
      citationRelevant: false,
      note: 'No retrieved passage has this citation id.',
    };
  }
  const quotes = quotations(claim);
  const body = compact(passage.text);
  const compactClaim = compact(claim);
  const faithful = quotes.length ? quotes.every(quote => body.includes(quote)) : null;
  if (faithful === false) {
    return {
      claim,
      passageIds: [citationId],
      support: 'unfaithful',
      citationExists: true,
      quotationFaithful: false,
      citationRelevant: false,
      note: 'The citation exists. The quoted words are not in that passage.',
    };
  }
  const exactMatch =
    faithful === true ||
    (compactClaim.length >= 12 && body.toLowerCase().includes(compactClaim.toLowerCase()));
  if (exactMatch) {
    return {
      claim,
      passageIds: [citationId],
      support: 'supported',
      citationExists: true,
      quotationFaithful: faithful,
      citationRelevant: true,
      note: 'The passage contains the exact quoted wording. This is not an independent scholarly verdict.',
    };
  }

  const meaning = evaluateVerificationClaimAgainstPassages(claim, passages, citationId);
  if (meaning.support === 'supported' && meaning.passageId) {
    return {
      claim,
      passageIds: [meaning.passageId],
      support: 'supported',
      citationExists: true,
      quotationFaithful: null,
      citationRelevant: true,
      note: meaning.note,
    };
  }
  if (meaning.support === 'unsupported' && meaning.note.includes('contrary')) {
    return {
      claim,
      passageIds: [citationId],
      support: 'unsupported',
      citationExists: true,
      quotationFaithful: null,
      citationRelevant: false,
      note: meaning.note,
    };
  }

  const relevant = passageSupportsTopic(claim, passage.text);
  const support: ClaimSupport = relevant ? 'insufficient' : 'unsupported';
  return {
    claim,
    passageIds: [citationId],
    support,
    citationExists: true,
    quotationFaithful: faithful,
    citationRelevant: relevant,
    note: relevant
      ? 'Candidate passage identified by word match. A word match does not automatically establish that a claim is supported.'
      : 'The citation exists. The claim is not established by that passage.',
  };
}

export function claimNeedsWords(claim: string): boolean {
  return contentTokens(claim).length > 0 || quotations(claim).length > 0;
}

import type { ClaimEvidence, ClaimSupport } from '../contracts/v1.ts';
import { contentTokens, passageSupportsTopic } from '../research.ts';

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
 * A claim is labeled 'supported' ONLY when the passage contains the verbatim quotation or exact claim wording.
 * Word/token matches without verbatim establishment are labeled 'insufficient' (candidate passage).
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
  const relevant = passageSupportsTopic(claim, passage.text) || exactMatch;
  const support: ClaimSupport = exactMatch ? 'supported' : relevant ? 'insufficient' : 'unsupported';
  return {
    claim,
    passageIds: [citationId],
    support,
    citationExists: true,
    quotationFaithful: faithful,
    citationRelevant: relevant,
    note: exactMatch
      ? 'The passage contains the exact quoted wording. This is not an independent scholarly verdict.'
      : relevant
        ? 'Candidate passage identified by word match. A word match does not automatically establish that a claim is supported.'
        : 'The citation exists. The claim is not established by that passage.',
  };
}

export function claimNeedsWords(claim: string): boolean {
  return contentTokens(claim).length > 0 || quotations(claim).length > 0;
}

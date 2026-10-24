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
 * A citation id is not support. The claim is supported only when that passage
 * contains the quotation, or the claim's own content words.
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
  const relevant = passageSupportsTopic(claim, passage.text) || faithful === true;
  const support: ClaimSupport = relevant ? 'supported' : 'unsupported';
  return {
    claim,
    passageIds: [citationId],
    support,
    citationExists: true,
    quotationFaithful: faithful,
    citationRelevant: relevant,
    note: relevant
      ? 'The passage contains the claim’s wording or its content words. This is not a scholarly verdict.'
      : 'The citation exists. The claim is not established by that passage.',
  };
}

export function claimNeedsWords(claim: string): boolean {
  return contentTokens(claim).length > 0 || quotations(claim).length > 0;
}

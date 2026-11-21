/**
 * Conservative claim-meaning verification against opened passage text.
 * Locator / citation id alone never establish support — only edition body text does.
 */

/** Synonym sets for the verification / news / harm-from-ignorance proposition (edition-agnostic). */
const NEWS_BEARER =
  /\b(wrongdoer|wrongdoers|disobedient|fasiq|fasiqs|wicked|transgressor|transgressors|evildoer|evildoers|sinner|sinners|corrupt)\b/i;
const NEWS_NOUN =
  /\b(news|information|report|reports|tidings|rumour|rumor|rumours|rumors|claim|claims|message|messages)\b/i;
const VERIFY_VERB =
  /\b(verif(?:y|ies|ied|ying)|investigat(?:e|es|ed|ing)|check(?:s|ed|ing)?|ascertain(?:s|ed|ing)?|scrutiniz(?:e|es|ed|ing)|examine(?:s|d|ing)?|inquire(?:s|d|ing)?|enquire(?:s|d|ing)?)\b/i;
const HARM_IGNORANCE =
  /\b(harm|hurt|injure|injury|damage|wrong|afflict)\b[\s\S]{0,80}\b(ignorance|ignorant|unaware|unknowingly|without knowledge)\b|\b(ignorance|ignorant|unaware|unknowingly|without knowledge)\b[\s\S]{0,80}\b(harm|hurt|injure|injury|damage|wrong|afflict)\b|\blest you\b[\s\S]{0,60}\b(harm|hurt|injure)\b|\bout of ignorance\b/i;

export interface PassageMeaningSupport {
  supported: boolean;
  supportingSpan: string | null;
  reason: string;
  elements: { newsBearer: boolean; news: boolean; verify: boolean; harmFromIgnorance: boolean };
}

function compactSpan(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function firstMatchSpan(haystack: string, pattern: RegExp): string | null {
  const match = pattern.exec(haystack);
  if (!match) return null;
  const start = Math.max(0, match.index - 40);
  const end = Math.min(haystack.length, match.index + match[0].length + 80);
  return compactSpan(haystack.slice(start, end));
}

/** True when the assertion denies or inverts verification-before-acting. */
export function isContraryVerificationClaim(claim: string): boolean {
  const q = claim.trim();
  return (
    /\b(need no|needs no|no need|without|never)\b.{0,40}\b(verif|investigat|check)/i.test(q) ||
    /\b(does not|do not|don't|doesn'?t|not)\b.{0,40}\b(verif|investigat|require|check)/i.test(q) ||
    /\bno verification\b/i.test(q) ||
    /\b(act|acting|believe|believing|proceed)\b.{0,40}\b(without|no)\b.{0,20}\b(verif|investigat|check|checking)\b/i.test(q) ||
    /\bwithout (investigation|verification|checking)\b/i.test(q) ||
    /\bbelieve every report\b/i.test(q) ||
    /\bact on the news without\b/i.test(q)
  );
}

/** True when the claim is about verifying news / reports before acting (English paraphrase space). */
export function isVerificationMeaningClaim(claim: string): boolean {
  if (isContraryVerificationClaim(claim)) return true;
  const q = claim.trim();
  const mentionsVerse = /49\s*[:：]\s*6/.test(q) || /qur['’]?an\s*49/i.test(q);
  const verifyTheme =
    VERIFY_VERB.test(q) &&
    (NEWS_NOUN.test(q) || NEWS_BEARER.test(q) || /\breport\b/i.test(q) || /\bacting\b/i.test(q));
  return mentionsVerse && (verifyTheme || /wrongdoer|ignorance|harm/i.test(q));
}

/**
 * Conservative meaning check against the opened passage body only.
 * ID / locator alone never establish support. Counterfactual: same id, unrelated text → false.
 */
export function passageEstablishesVerificationMeaning(passageText: string): PassageMeaningSupport {
  const body = compactSpan(passageText);
  if (!body) {
    return {
      supported: false,
      supportingSpan: null,
      reason: 'No passage text was available to verify the claim.',
      elements: { newsBearer: false, news: false, verify: false, harmFromIgnorance: false },
    };
  }
  const elements = {
    newsBearer: NEWS_BEARER.test(body),
    news: NEWS_NOUN.test(body),
    verify: VERIFY_VERB.test(body),
    harmFromIgnorance: HARM_IGNORANCE.test(body),
  };
  const supported =
    elements.newsBearer && elements.news && elements.verify && elements.harmFromIgnorance;
  if (!supported) {
    return {
      supported: false,
      supportingSpan: null,
      reason:
        'The opened passage does not establish that a wrongdoer brings news, that it must be verified before acting, and that the purpose is avoiding harm through ignorance.',
      elements,
    };
  }
  const span =
    firstMatchSpan(body, VERIFY_VERB) ??
    firstMatchSpan(body, NEWS_BEARER) ??
    body.slice(0, 180);
  return {
    supported: true,
    supportingSpan: span,
    reason:
      'Opened passage establishes: a wrongdoer/disobedient person brings news; verify/investigate before acting; purpose includes avoiding harm through ignorance.',
    elements,
  };
}

export interface ClaimPassageSupportResult {
  support: 'supported' | 'insufficient' | 'unsupported';
  citationRelevant: boolean;
  quotationFaithful: null;
  supportingSpan: string | null;
  note: string;
  passageId: string | null;
}

/**
 * Evaluate the displayed assertion against opened passage objects.
 * Keeps ID linking separate: this never sets citationExists from locator alone.
 * Paraphrases use quotationFaithful: null. Contrary assertions are never supported.
 */
export function evaluateVerificationClaimAgainstPassages(
  claim: string,
  passages: readonly { id: string; text: string }[],
  preferredPassageId?: string | null,
): ClaimPassageSupportResult {
  if (isContraryVerificationClaim(claim)) {
    return {
      support: 'unsupported',
      citationRelevant: false,
      quotationFaithful: null,
      supportingSpan: null,
      note: 'The assertion denies or inverts verification before acting. The opened passage does not establish that contrary claim.',
      passageId: preferredPassageId ?? passages[0]?.id ?? null,
    };
  }
  if (!isVerificationMeaningClaim(claim)) {
    return {
      support: 'insufficient',
      citationRelevant: false,
      quotationFaithful: null,
      supportingSpan: null,
      note: 'No conservative meaning rule applies to this assertion against the opened passages.',
      passageId: null,
    };
  }
  const ordered = preferredPassageId
    ? [
        ...passages.filter(item => item.id === preferredPassageId),
        ...passages.filter(item => item.id !== preferredPassageId),
      ]
    : [...passages];
  for (const passage of ordered) {
    const meaning = passageEstablishesVerificationMeaning(passage.text);
    if (meaning.supported) {
      return {
        support: 'supported',
        citationRelevant: true,
        quotationFaithful: null,
        supportingSpan: meaning.supportingSpan,
        note: `${meaning.reason} Supporting span: “${meaning.supportingSpan ?? ''}”. This is claim-level verification of the opened edition, not an executive verdict.`,
        passageId: passage.id,
      };
    }
  }
  const first = ordered[0];
  return {
    support: first ? 'insufficient' : 'unsupported',
    citationRelevant: Boolean(first),
    quotationFaithful: null,
    supportingSpan: null,
    note: first
      ? 'Candidate passage identified. The opened text does not establish the verification / wrongdoer / harm-from-ignorance meaning required for support.'
      : 'No opened passage was available to verify the claim.',
    passageId: first?.id ?? null,
  };
}

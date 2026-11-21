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

/**
 * True when the assertion denies or inverts verification-before-acting.
 * Nested negation that affirms verification (“do not act without verifying”) is NOT contrary.
 */
export function isContraryVerificationClaim(claim: string): boolean {
  const q = claim.trim();
  // Faithful nested negation: forbids unchecked action / harm, not verification itself.
  if (affirmsVerificationViaNestedNegation(q)) return false;
  return deniesVerificationItself(q);
}

/** “must not act … without checking” affirms verification; do not treat as contrary. */
function affirmsVerificationViaNestedNegation(q: string): boolean {
  return (
    /\b((do|does|did) not|don't|doesn'?t|must not|never|not)\b.{0,50}\b(act|acting|harm|proceed|believe)\b.{0,50}\bwithout\b.{0,30}\b(verif|investigat|check)/i.test(
      q,
    ) ||
    /\bwithout\b.{0,20}\b(verif|investigat|check).{0,40}\b(do not|don't|lest|so (that )?they (do not|don't))\b/i.test(q) ||
    /\b(lest|so (that )?they (do not|don't))\b.{0,60}\b(harm|act).{0,40}\b(without|before).{0,20}\b(verif|investigat|check)/i.test(
      q,
    )
  );
}

/** Negation scoped to verification itself (never verify / no need to check). */
function deniesVerificationItself(q: string): boolean {
  return (
    /\b(need no|needs no|no need)\b.{0,40}\b(verif|investigat|check)/i.test(q) ||
    /\bnever\b.{0,40}\b(verif|investigat|check)/i.test(q) ||
    /\b(does not|do not|don't|doesn'?t)\b.{0,40}\b(verif|investigat|check)\b/i.test(q) ||
    /\bno verification\b/i.test(q) ||
    // Act/believe without verifying — but not when nested negation already affirmed verification.
    /\b(act|acting|believe|believing|proceed)\b.{0,40}\b(without|no)\b.{0,20}\b(verif|investigat|check|checking)\b/i.test(q) ||
    /\bbelieve every report\b/i.test(q) ||
    /\bact on the news without\b/i.test(q)
  );
}

/**
 * Passage body that contains the theme tokens but inverts polarity
 * (e.g. “never verify … even if you harm people out of ignorance”).
 */
export function passageInvertsVerificationMeaning(passageText: string): boolean {
  const body = compactSpan(passageText);
  if (!body) return false;
  if (affirmsVerificationViaNestedNegation(body)) return false;
  return deniesVerificationItself(body);
}

/**
 * Extra / invented content the opened 49:6 theme does not establish
 * (e.g. “always tells the truth”, “exactly four witnesses”, “exactly three times”).
 */
export function claimAddsUnestablishedDetail(claim: string): boolean {
  const q = claim.trim();
  return (
    /\balways\b.{0,40}\b(truth|true|honest|reliable|trustworthy)\b/i.test(q) ||
    /\b(truth|true|honest|reliable|trustworthy)\b.{0,40}\balways\b/i.test(q) ||
    /\btells? the truth\b/i.test(q) ||
    /\bnever lies\b/i.test(q) ||
    /\b(exactly|precisely|only)\s+\w+\s+witness/i.test(q) ||
    /\b\d+\s+witness/i.test(q) ||
    /\bfour witnesses?\b/i.test(q) ||
    /\btwo witnesses?\b/i.test(q) ||
    // Invented timing / count qualifiers the verse does not state.
    /\b(exactly|precisely)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+times?\b/i.test(q) ||
    /\b(check|verif|investigat)\w*.{0,40}\b(\d+|three|twice|thrice)\s+times?\b/i.test(q) ||
    /\b(\d+|three|twice|thrice)\s+times?\b.{0,40}\b(check|verif|investigat)/i.test(q) ||
    /\bmust believe\b/i.test(q) ||
    /\bwithout evidence\b/i.test(q)
  );
}

/** Core proposition of 49:6: verify/investigate news from a wrongdoer to avoid harm through ignorance. */
export function claimStatesVerificationProposition(claim: string): boolean {
  const q = claim.trim();
  if (isContraryVerificationClaim(q) || claimAddsUnestablishedDetail(q)) return false;
  const hasVerify = VERIFY_VERB.test(q) || /\binvestigat/i.test(q);
  const hasNewsOrBearer = NEWS_NOUN.test(q) || NEWS_BEARER.test(q) || /\breport\b/i.test(q) || /\bnews\b/i.test(q);
  const hasPurpose =
    HARM_IGNORANCE.test(q) ||
    /\bignora/i.test(q) ||
    /\bharm\b/i.test(q) ||
    /\bbefore acting\b/i.test(q) ||
    /\bso (that )?they (do not|don't)\b/i.test(q) ||
    /\binstructs?\b.{0,80}\bverif/i.test(q) ||
    /\brequires?\b.{0,40}\bverif/i.test(q) ||
    /\bteaches?\b.{0,80}\binvestigat/i.test(q);
  // Canonical / faithful paraphrases name verification + news/bearer (+ purpose or verse framing).
  return hasVerify && hasNewsOrBearer && (hasPurpose || /49\s*[:：]\s*6/.test(q));
}

/**
 * True when the claim is specifically about 49:6 verification / news / harm-from-ignorance.
 * Mentions of another ayah, or only “Qur’an 49” + a fragment word, are out of scope.
 */
export function isVerificationMeaningClaim(claim: string): boolean {
  const q = claim.trim();
  // Must name 49:6 specifically — not Surah 49 generally or a different ayah.
  const names496 = /49\s*[:：]\s*6/.test(q) || /qur['’]?an\s*49\s*[:：]\s*6/i.test(q);
  if (!names496) return false;
  // Reject when another verse is the primary subject (e.g. “2:255 … and also 49:6”).
  const otherVerse = q.match(/\b(\d{1,3})\s*[:：]\s*(\d{1,3})\b/g) ?? [];
  const only496 = otherVerse.every(ref => /49\s*[:：]\s*6/.test(ref));
  if (!only496 && otherVerse.length > 1) return false;

  if (isContraryVerificationClaim(q)) return true;
  if (claimAddsUnestablishedDetail(q)) return true; // theme space so we reject support explicitly

  const verifyTheme =
    VERIFY_VERB.test(q) &&
    (NEWS_NOUN.test(q) || NEWS_BEARER.test(q) || /\breport\b/i.test(q) || /\bacting\b/i.test(q));
  // Require verify theme — not merely “wrongdoer/harm/ignorance” without verification.
  return verifyTheme || claimStatesVerificationProposition(q);
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
  // Keyword conjunction alone is not enough when the span inverts polarity.
  if (passageInvertsVerificationMeaning(body)) {
    return {
      supported: false,
      supportingSpan: null,
      reason:
        'The opened passage mentions verification theme words but inverts their polarity (e.g. never verify / act without checking). That cannot establish support.',
      elements,
    };
  }
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
 * Paraphrases use quotationFaithful: null. Contrary / invented assertions are never supported.
 * Passage theme alone is not enough — the assertion’s full proposition must be established.
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
  if (claimAddsUnestablishedDetail(claim)) {
    return {
      support: 'unsupported',
      citationRelevant: false,
      quotationFaithful: null,
      supportingSpan: null,
      note: 'The assertion adds details (or contradicts the verse theme) that the opened passage does not establish.',
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
  if (!claimStatesVerificationProposition(claim)) {
    return {
      support: 'insufficient',
      citationRelevant: false,
      quotationFaithful: null,
      supportingSpan: null,
      note: 'The assertion does not state the verification / wrongdoer / harm-from-ignorance proposition established by the opened passage.',
      passageId: preferredPassageId ?? passages[0]?.id ?? null,
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

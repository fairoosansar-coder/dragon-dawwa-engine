import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  claimAssertionFromQuestion,
  evaluateVerificationClaimAgainstPassages,
  isContraryVerificationClaim,
  passageEstablishesVerificationMeaning,
} from '../src/server/research/claimPassageLink.ts';
import { verifyClaim } from '../src/shared/research/claims.ts';

const SI_496 =
  'O you who have believed, if there comes to you a disobedient one with information, investigate, lest you harm a people out of ignorance and become, over what you have done, regretful.';

const CANONICAL_ASK =
  'What does Qur’an 49:6 say about verifying a report before acting on it?';

describe('claim passage support — meaning verification', () => {
  it('supports the canonical Ask assertion against the opened Sahih International 49:6 text', () => {
    const assertion = claimAssertionFromQuestion(CANONICAL_ASK);
    assert.match(assertion, /wrongdoer|verify|ignorance/i);
    assert.notEqual(assertion, CANONICAL_ASK);

    const meaning = passageEstablishesVerificationMeaning(SI_496);
    assert.equal(meaning.supported, true);
    assert.ok(meaning.supportingSpan);
    assert.equal(meaning.elements.newsBearer, true);
    assert.equal(meaning.elements.news, true);
    assert.equal(meaning.elements.verify, true);
    assert.equal(meaning.elements.harmFromIgnorance, true);

    const check = verifyClaim(assertion, 'Q49-6', [{ id: 'Q49-6', text: SI_496 }]);
    assert.equal(check.support, 'supported');
    assert.equal(check.citationExists, true);
    assert.equal(check.citationRelevant, true);
    assert.equal(check.quotationFaithful, null); // paraphrase, not a quoted proposition
    assert.deepEqual(check.passageIds, ['Q49-6']);
    assert.match(check.note, /Supporting span|Opened passage establishes/i);
  });

  it('supports a faithful paraphrase with different wording against the same opened text', () => {
    const paraphrase =
      'Qur’an 49:6 teaches that when a fasiq brings a report, believers must investigate so they do not harm others through ignorance.';
    const check = verifyClaim(paraphrase, 'Q49-6', [{ id: 'Q49-6', text: SI_496 }]);
    assert.equal(check.support, 'supported');
    assert.equal(check.quotationFaithful, null);
    assert.equal(check.citationExists, true);
  });

  it('does not support a contrary assertion even when the citation exists', () => {
    const contrary = 'Qur’an 49:6 says to act on the news without checking it';
    assert.equal(isContraryVerificationClaim(contrary), true);
    assert.equal(claimAssertionFromQuestion(contrary), contrary);

    const check = verifyClaim(contrary, 'Q49-6', [{ id: 'Q49-6', text: SI_496 }]);
    assert.equal(check.citationExists, true);
    assert.notEqual(check.support, 'supported');
    assert.equal(check.support, 'unsupported');
    assert.match(check.note, /contrary/i);
  });

  it('counterfactual: correct id with unrelated body must not become supported', () => {
    const assertion = claimAssertionFromQuestion(CANONICAL_ASK);
    const unrelated =
      'Allah — there is no deity except Him, the Ever-Living, the Sustainer of existence.';
    const meaning = passageEstablishesVerificationMeaning(unrelated);
    assert.equal(meaning.supported, false);

    const check = verifyClaim(assertion, 'Q49-6', [{ id: 'Q49-6', text: unrelated }]);
    assert.equal(check.citationExists, true);
    assert.notEqual(check.support, 'supported');
    assert.ok(check.support === 'insufficient' || check.support === 'unsupported');
  });

  it('marks fabricated quotes unfaithful without promoting support via id', () => {
    const check = verifyClaim(
      'Qur’an 49:6 says “never verify anything before you act.”',
      'Q49-6',
      [{ id: 'Q49-6', text: SI_496 }],
    );
    assert.equal(check.support, 'unfaithful');
    assert.equal(check.quotationFaithful, false);
    assert.equal(check.citationExists, true);
  });

  it('evaluateVerificationClaimAgainstPassages prefers the preferred passage id when meaning holds', () => {
    const assertion = claimAssertionFromQuestion(CANONICAL_ASK);
    const result = evaluateVerificationClaimAgainstPassages(
      assertion,
      [
        { id: 'Q2-255', text: 'Allah — there is no deity except Him.' },
        { id: 'Q49-6', text: SI_496 },
      ],
      'Q49-6',
    );
    assert.equal(result.support, 'supported');
    assert.equal(result.passageId, 'Q49-6');
    assert.equal(result.quotationFaithful, null);
    assert.ok(result.supportingSpan);
  });

  it('does not treat word overlap alone as support for an unrelated claim', () => {
    const check = verifyClaim(
      'Fasting on Saturday is forbidden except for obligatory fasts',
      'E65003',
      [{ id: 'E65003', text: 'I will fulfill the obligatory fast and the prayers.' }],
    );
    assert.notEqual(check.support, 'supported');
  });

  it('does not support invented propositions that only share the 49:6 theme', () => {
    const truth = verifyClaim(
      'Qur’an 49:6 says a wrongdoer always tells the truth.',
      'Q49-6',
      [{ id: 'Q49-6', text: SI_496 }],
    );
    assert.notEqual(truth.support, 'supported');
    assert.equal(truth.support, 'unsupported');
    assert.match(truth.note, /does not establish|adds details/i);

    const witnesses = verifyClaim(
      'Qur’an 49:6 requires verifying every report with exactly four witnesses.',
      'Q49-6',
      [{ id: 'Q49-6', text: SI_496 }],
    );
    assert.notEqual(witnesses.support, 'supported');
    assert.equal(witnesses.support, 'unsupported');
  });

  it('treats nested-negation paraphrases as faithful, not contrary', () => {
    const nested =
      'Qur’an 49:6 teaches believers do not act on a wrongdoer’s news without verifying, lest they harm people through ignorance.';
    assert.equal(isContraryVerificationClaim(nested), false);
    const check = verifyClaim(nested, 'Q49-6', [{ id: 'Q49-6', text: SI_496 }]);
    assert.equal(check.support, 'supported');
    assert.equal(check.quotationFaithful, null);
  });

  it('does not support unrelated Surah 49 fragments or other-ayah claims', () => {
    const fragment = verifyClaim(
      'Qur’an 49 mentions a wrongdoer and ignorance.',
      'Q49-6',
      [{ id: 'Q49-6', text: SI_496 }],
    );
    assert.notEqual(fragment.support, 'supported');

    const otherAyah = verifyClaim(
      'Qur’an 2:255 is the Throne Verse about Allah’s knowledge, and it mentions 49:6 harm.',
      'Q49-6',
      [{ id: 'Q49-6', text: SI_496 }],
    );
    assert.notEqual(otherAyah.support, 'supported');
  });

  it('does not support when the opened body inverts verification polarity', () => {
    const inverted =
      'When a wrongdoer brings news, never verify it before acting, even if you harm people out of ignorance.';
    const meaning = passageEstablishesVerificationMeaning(inverted);
    assert.equal(meaning.supported, false);
    assert.match(meaning.reason, /invert|polarity|never verify/i);

    const assertion = claimAssertionFromQuestion(CANONICAL_ASK);
    const check = verifyClaim(assertion, 'Q49-6', [{ id: 'Q49-6', text: inverted }]);
    assert.notEqual(check.support, 'supported');
  });

  it('does not support invented count qualifiers such as exactly three times', () => {
    const threeTimes = verifyClaim(
      'Qur’an 49:6 requires checking every report exactly three times.',
      'Q49-6',
      [{ id: 'Q49-6', text: SI_496 }],
    );
    assert.notEqual(threeTimes.support, 'supported');
    assert.equal(threeTimes.support, 'unsupported');
    assert.match(threeTimes.note, /does not establish|adds details/i);
  });

  it('treats must-not-act-without-checking as faithful nested negation', () => {
    const nested =
      'Qur’an 49:6 says believers must not act on a report without checking it, lest they harm people through ignorance.';
    assert.equal(isContraryVerificationClaim(nested), false);
    const check = verifyClaim(nested, 'Q49-6', [{ id: 'Q49-6', text: SI_496 }]);
    assert.equal(check.support, 'supported');
  });

  it('treats must-not-verify / should-not-verify as contrary, not supported', () => {
    for (const claim of [
      'Qur’an 49:6 says believers must not verify a wrongdoer’s report before acting.',
      'Qur’an 49:6 says believers should not verify news from a fasiq.',
      'Qur’an 49:6 says to act on the news without checking it.',
    ]) {
      assert.equal(isContraryVerificationClaim(claim), true, claim);
      const check = verifyClaim(claim, 'Q49-6', [{ id: 'Q49-6', text: SI_496 }]);
      assert.notEqual(check.support, 'supported', claim);
      assert.equal(check.support, 'unsupported', claim);
      assert.match(check.note, /contrary/i, claim);
    }
  });

  it('keeps until-verify / whether-or-not / should-not-skip paraphrases faithful and supportable', () => {
    for (const claim of [
      'Qur’an 49:6 teaches believers do not act until you verify a wrongdoer’s report, lest they harm people through ignorance.',
      'Qur’an 49:6 teaches believers to consider whether or not to verify a wrongdoer’s news before acting, lest they harm people through ignorance.',
      'Qur’an 49:6 teaches believers should not skip verifying a wrongdoer’s report, lest they harm people through ignorance.',
      'Qur’an 49:6 teaches believers do not act without verifying a wrongdoer’s news, lest they harm people through ignorance.',
    ]) {
      assert.equal(isContraryVerificationClaim(claim), false, claim);
      const check = verifyClaim(claim, 'Q49-6', [{ id: 'Q49-6', text: SI_496 }]);
      assert.equal(check.support, 'supported', claim);
    }
  });

  it('does not hard-reject unrelated claims that only share invented-detail wording', () => {
    // Without 49:6 theme, invented-detail patterns must not short-circuit verifyClaim.
    const meaning = evaluateVerificationClaimAgainstPassages(
      'The narrator always tells the truth about fasting.',
      [{ id: 'E65003', text: 'Fasting is mentioned in several places.' }],
    );
    assert.equal(meaning.support, 'insufficient');
    assert.match(meaning.note, /No conservative meaning rule/i);

    const truth = verifyClaim(
      'The narrator always tells the truth about fasting.',
      'E65003',
      [{ id: 'E65003', text: 'Fasting is mentioned in several places.' }],
    );
    assert.equal(/adds details|contrary claim/i.test(truth.note), false);
    assert.notEqual(truth.support, 'supported');

    const witnesses = verifyClaim(
      'The case requires two witnesses for the contract.',
      'E65004',
      [{ id: 'E65004', text: 'A different ruling about prayer times.' }],
    );
    assert.equal(/adds details|opened passage does not establish/i.test(witnesses.note), false);
  });
});

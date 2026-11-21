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
});

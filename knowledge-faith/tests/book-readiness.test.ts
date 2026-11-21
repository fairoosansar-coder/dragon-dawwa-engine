import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PREPARED_TEXT_QUARANTINE_IDS,
  PREPARED_TEXT_QUARANTINE_MESSAGE,
  preparedTextQuarantined,
} from '../src/shared/bookReadiness.ts';
import { claimAssertionFromQuestion } from '../src/server/research/claimPassageLink.ts';

describe('prepared-text readiness', () => {
  it('quarantines Tamil book 2843165 for prepared text/audio', () => {
    assert.equal(PREPARED_TEXT_QUARANTINE_IDS.has(2843165), true);
    assert.equal(preparedTextQuarantined(2843165), true);
    assert.equal(preparedTextQuarantined(1), false);
    assert.match(PREPARED_TEXT_QUARANTINE_MESSAGE, /under review|PDF/i);
  });
});

describe('claim assertion phrasing', () => {
  it('binds a concrete assertion for the canonical Qur’an 49:6 Ask', () => {
    const question =
      'What does Qur’an 49:6 say about verifying a report before acting on it?';
    const assertion = claimAssertionFromQuestion(question);
    assert.notEqual(assertion, question);
    assert.match(assertion, /verify news brought by a wrongdoer/i);
    assert.equal(assertion.includes('?'), false);
  });

  it('preserves contrary, negated, and quoted 49:6 propositions', () => {
    const contrary =
      'Qur’an 49:6 says reports from wrongdoers need no verification.';
    assert.equal(claimAssertionFromQuestion(contrary), contrary);
    const negated = 'Qur’an 49:6 does not require verifying a report before acting.';
    assert.equal(claimAssertionFromQuestion(negated), negated);
    const quoted =
      'Does Qur’an 49:6 say "believe every report without investigation"?';
    assert.equal(claimAssertionFromQuestion(quoted), quoted);
  });

  it('does not inject an English claim for Tamil or Sinhala Asks', () => {
    const ta =
      'குர்ஆன் 49:6 ஒரு செய்தியை சரிபார்ப்பது பற்றி என்ன சொல்கிறது?';
    assert.equal(claimAssertionFromQuestion(ta), ta);
    const si =
      'කුර්ආන් 49:6 ප්‍රවෘත්තියක් සනාථ කිරීම ගැන කුමක් පවසයිද?';
    assert.equal(claimAssertionFromQuestion(si), si);
  });

  it('leaves unrelated wording unchanged', () => {
    const q = 'Actions are by intentions.';
    assert.equal(claimAssertionFromQuestion(q), q);
  });
});

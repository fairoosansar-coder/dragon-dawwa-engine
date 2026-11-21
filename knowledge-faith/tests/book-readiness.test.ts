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

  it('preserves contrary or negated 49:6 claims without replacing them', () => {
    const contrary =
      'Qur’an 49:6 says reports from wrongdoers need no verification.';
    assert.equal(claimAssertionFromQuestion(contrary), contrary);
    const negated = 'Qur’an 49:6 does not require verifying a report before acting.';
    assert.equal(claimAssertionFromQuestion(negated), negated);
  });

  it('leaves unrelated wording unchanged', () => {
    const q = 'Actions are by intentions.';
    assert.equal(claimAssertionFromQuestion(q), q);
  });
});

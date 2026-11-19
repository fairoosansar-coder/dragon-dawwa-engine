import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RESEARCH_STARTERS } from '../src/views/researchStarters.ts';

describe('research starter chips', () => {
  it('offers the Qur’an, fiqh, seerah, and book questions', () => {
    assert.deepEqual(
      RESEARCH_STARTERS.quran?.map(item => item.question),
      [
        'Facing hardship and feeling lost (Surah 2:216)',
        'Finding tranquility in remembrance (Surah 13:28)',
        'The cosmic balance of creation (Surah 55:7-9)',
      ],
    );
    assert.deepEqual(
      RESEARCH_STARTERS.fiqh?.map(item => item.question),
      [
        'Principles of ease in travel worship',
        'Ethical parameters of modern digital commerce',
      ],
    );
    assert.deepEqual(
      RESEARCH_STARTERS.seerah?.map(item => item.question),
      [
        'Leadership and diplomacy during the Treaty of Hudaybiyyah',
        'Empathy towards adversaries in Makkah',
      ],
    );
    const books = RESEARCH_STARTERS.books ?? [];
    assert.ok(books.length >= 3 && books.length <= 4);
    assert.equal(RESEARCH_STARTERS.hadith, undefined);
    assert.equal(RESEARCH_STARTERS.knowledge, undefined);
  });
});
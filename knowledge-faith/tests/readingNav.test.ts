import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterSentence, hizbFromQuarter, mushafMark, parseReadingJump } from '../src/shared/readingNav.ts';

const kahf = { number: 18, englishName: 'Al-Kahf', englishNameTranslation: 'The Cave', numberOfAyahs: 110 };

test('hizb 30 is the quarter that page 293 reports', () => {
  assert.equal(hizbFromQuarter(117), 30);
  assert.equal(mushafMark({ surah: 18, ayah: 1, page: 293, juz: 15, hizbQuarter: 117 })?.hizb, 30);
  assert.equal(mushafMark({ surah: 18, ayah: 1, page: 293, juz: 15 }) , null);
});

test('the reading search jumps by surah, verse, juz, or page and does not guess a juz', () => {
  assert.deepEqual(parseReadingJump('18:1', [kahf]), { kind: 'verse', surah: 18, ayah: 1 });
  assert.deepEqual(parseReadingJump('Al-Kahf 4', [kahf]), { kind: 'verse', surah: 18, ayah: 4 });
  assert.deepEqual(parseReadingJump('Al-Kahf', [kahf]), { kind: 'surah', surah: 18 });
  assert.deepEqual(parseReadingJump('page 293', [kahf]), { kind: 'page', page: 293 });
  assert.deepEqual(parseReadingJump('juz 15', [kahf]), { kind: 'juz', juz: 15 });
  assert.equal(parseReadingJump('15', [kahf]), null);
  assert.equal(parseReadingJump('18:200', [kahf]), null);
});

test('the chapter line uses only the verse count, place, and juz', () => {
  assert.equal(
    chapterSentence({ englishName: 'Al-Kahf', number: 18, verses: 110, place: 'Mecca', juz: 15 }),
    'Surah Al-Kahf (Chapter 18) has 110 verses and was revealed in Mecca, in Juz 15.',
  );
});

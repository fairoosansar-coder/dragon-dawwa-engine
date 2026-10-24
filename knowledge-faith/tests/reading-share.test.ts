import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_BUSY, SOURCE_TIMEOUT } from '../src/server/http.ts';
import { parseReadingLink, readingLinkHash, verseShareText, wrapWords, packLines } from '../src/lib/verseShare.ts';

const verse = {
  surah: 2,
  ayah: 255,
  arabic: 'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ',
  translation: 'Allah — there is no god except Him.',
  footnotes: '[1] The footnote stays exact.',
  surahName: 'Al-Baqara',
  translationTitle: 'English Translation - Rowwad Translation Center',
  translationKey: 'english_rwwad',
  translationVersion: '1.0.20',
  translationDescription: 'Rowwad description stays exact.',
};

test('a shared link restores the verse, language, and edition', () => {
  const hash = readingLinkHash({ surah: 2, ayah: 255, lang: 'ta', edition: 'tamil_omar_brief', mode: 'book' });
  assert.equal(hash, '#/quran/book?surah=2&ayah=255&lang=ta&edition=tamil_omar_brief');
  assert.deepEqual(parseReadingLink(hash), { surah: 2, ayah: 255, lang: 'ta', edition: 'tamil_omar_brief' });
  assert.deepEqual(parseReadingLink('#/quran/book?surah=0&ayah=900&lang=fr&edition=../no'), {});
  assert.deepEqual(parseReadingLink('#/quran/study'), {});
});

test('copied verse text keeps the wording, footnote, and attribution', () => {
  const text = verseShareText(verse);
  assert.match(text, /ٱللَّهُ/);
  assert.match(text, /there is no god except Him/);
  assert.match(text, /\[1\] The footnote stays exact/);
  assert.match(text, /Al-Baqara 2:255/);
  assert.match(text, /english_rwwad · 1\.0\.20/);
  assert.match(text, /Rowwad description stays exact/);
  assert.match(text, /QuranEnc/);
  assert.equal(text.includes('…'), false);
});

test('wrapped lines do not drop words', () => {
  const source = 'They believe in the revelation that Allah sent down';
  const lines = wrapWords(source, 18, sample => sample.length);
  assert.equal(lines.join(' '), source);
  const broken = wrapWords('ABCDEFGHIJK', 4, sample => sample.length);
  assert.equal(broken.join(''), 'ABCDEFGHIJK');
  const packed = packLines(lines, 2);
  assert.deepEqual(packed.flat(), lines);
});

test('rate limits and timeouts use a plain message', () => {
  assert.match(SOURCE_BUSY, /wait/i);
  assert.match(SOURCE_TIMEOUT, /too long/i);
  assert.equal(SOURCE_BUSY.includes('429'), false);
});

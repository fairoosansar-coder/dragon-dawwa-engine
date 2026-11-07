import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_BUSY, SOURCE_TIMEOUT } from '../src/server/http.ts';
import {
  BRAND_FOOTER_LEFT,
  BRAND_FOOTER_RIGHT,
  CARD_HEIGHT,
  CARD_WIDTH,
  formatQuotedTranslation,
  formatVerseCardBadge,
} from '../src/lib/verseImage.ts';
import {
  listFaithWallPosts,
  packLines,
  parseReadingLink,
  publishFaithWallPost,
  readingLinkHash,
  SEEDED_FAITH_WALL_POSTS,
  toggleFaithWallLike,
  verseShareText,
  wrapWords,
} from '../src/lib/verseShare.ts';
import { quranSectionId } from '../src/components/shell/widgets.tsx';

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

test('verse card studio uses 1200x675 16:9 HD dimensions, illuminated badge, quoted translation, and brand footer', async () => {
  assert.equal(CARD_WIDTH, 1200);
  assert.equal(CARD_HEIGHT, 675);
  assert.equal(formatVerseCardBadge(verse), '✦ SURAH AL-BAQARA 2:255');
  assert.equal(formatQuotedTranslation('In the name of Allah[1]'), '“In the name of Allah”');
  assert.equal(BRAND_FOOTER_LEFT, 'DRAGON DAWWA · Institutional Research Studio');
  assert.equal(BRAND_FOOTER_RIGHT, 'dragondawwa.com');

  const post = await publishFaithWallPost({
    verse,
    lang: 'en',
    url: 'https://dragondawwa.com/#/quran/book?surah=2&ayah=255',
    reflection: 'Ayat al-Kursi brings serenity to the heart.',
  });
  assert.equal(post.surah, 2);
  assert.equal(post.ayah, 255);
  assert.equal(post.reflection, 'Ayat al-Kursi brings serenity to the heart.');
  assert.equal(listFaithWallPosts()[0]?.id, post.id);
  assert.ok(listFaithWallPosts().length >= SEEDED_FAITH_WALL_POSTS.length + 1);
  assert.equal(quranSectionId('wall'), 'wall');

  const beforeLikes = listFaithWallPosts().find(item => item.id === post.id)?.likes ?? 1;
  const afterToggle = toggleFaithWallLike(post.id);
  const likedPost = afterToggle.find(item => item.id === post.id);
  assert.equal(likedPost?.liked, true);
  assert.equal(likedPost?.likes, beforeLikes + 1);
});


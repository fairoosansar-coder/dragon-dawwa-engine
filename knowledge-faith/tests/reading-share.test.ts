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
  deleteFaithWallPost,
  listFaithWallPosts,
  packLines,
  parseReadingLink,
  publishFaithWallPost,
  readingLinkHash,
  SEEDED_FAITH_WALL_POSTS,
  toggleFaithWallLike,
  updateFaithWallPost,
  verseShareText,
  wrapWords,
} from '../src/lib/verseShare.ts';
import {
  createServerWallPost,
  deleteServerWallPost,
  loginSeekerAccount,
  registerSeekerAccount,
  resetSeekerStoreForTests,
  revokeSeekerToken,
  updateSeekerAccountProfile,
  updateServerWallPost,
  verifySeekerToken,
} from '../src/server/seekerAuth.ts';
import { writeSeekerSession } from '../src/lib/seekerAuth.ts';
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

test('seeker login session signs tokens, attaches verified identity to personal wall posts, and enforces edit/delete ownership', async () => {
  resetSeekerStoreForTests();

  const registered = registerSeekerAccount({
    email: 'feroz@dragondawwa.com',
    password: 'secret-password',
    name: 'Brother Feroz Ansar',
    kunyah: 'Institutional Research Fellow',
    emblem: 'crescent-star',
  });
  assert.equal(registered.user.email, 'feroz@dragondawwa.com');
  assert.equal(registered.user.name, 'Brother Feroz Ansar');
  assert.equal(registered.user.emblem, 'crescent-star');
  assert.equal(registered.user.verified, true);

  const verified = verifySeekerToken(registered.token);
  assert.equal(verified?.id, registered.user.id);

  assert.throws(
    () => loginSeekerAccount({ email: 'feroz@dragondawwa.com', password: 'wrong-password' }),
    /Incorrect password/,
  );

  const loggedIn = loginSeekerAccount({ email: 'feroz@dragondawwa.com', password: 'secret-password' });
  assert.equal(loggedIn.user.id, registered.user.id);

  const updatedProfile = updateSeekerAccountProfile(loggedIn.user, {
    name: 'Dr. Feroz Ansar',
    kunyah: 'Director of Research',
    bio: 'Reflecting on the Qur’an.',
    emblem: 'octagon-rosette',
  });
  assert.equal(updatedProfile.user.name, 'Dr. Feroz Ansar');
  assert.equal(updatedProfile.user.kunyah, 'Director of Research');
  assert.equal(updatedProfile.user.emblem, 'octagon-rosette');

  // Create server wall post as authenticated seeker
  const serverPost = createServerWallPost(
    {
      surah: 2,
      ayah: 2,
      surahName: 'Al-Baqara',
      arabic: 'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ فِيهِ',
      translation: 'This is the Book about which there is no doubt.',
      reflection: 'Initial reflection',
      lang: 'en',
      url: '#/quran/book?surah=2&ayah=2',
    },
    updatedProfile.user,
  );
  assert.equal(serverPost.userId, updatedProfile.user.id);
  assert.equal(serverPost.authorName, 'Dr. Feroz Ansar');
  assert.equal(serverPost.verified, true);

  // Other user cannot edit or delete
  const other = registerSeekerAccount({
    email: 'other@dragondawwa.com',
    password: 'other-password',
    name: 'Other User',
  });
  assert.throws(
    () => updateServerWallPost(serverPost.id, 'Hijacked reflection', other.user),
    /only edit reflections on your own Faith Wall/,
  );
  assert.throws(
    () => deleteServerWallPost(serverPost.id, other.user),
    /only delete reflections from your own Faith Wall/,
  );

  // Owner can edit and delete
  const editedServerPost = updateServerWallPost(serverPost.id, 'Refined scholarly reflection', updatedProfile.user);
  assert.equal(editedServerPost.reflection, 'Refined scholarly reflection');
  const deletedServer = deleteServerWallPost(serverPost.id, updatedProfile.user);
  assert.equal(deletedServer.deleted, true);

  // Client session + Personal Wall publish/edit/delete
  writeSeekerSession({ token: updatedProfile.token, user: updatedProfile.user });
  const clientPost = await publishFaithWallPost({
    verse,
    lang: 'en',
    url: '#/quran/book?surah=2&ayah=255',
    reflection: 'My personal wall note',
  });
  assert.equal(clientPost.userId, updatedProfile.user.id);
  assert.equal(clientPost.authorName, 'Dr. Feroz Ansar');
  assert.equal(clientPost.verified, true);

  const editedClientPost = await updateFaithWallPost(clientPost.id, 'Updated personal wall note');
  assert.equal(editedClientPost?.reflection, 'Updated personal wall note');

  const removed = await deleteFaithWallPost(clientPost.id);
  assert.equal(removed, true);
  assert.equal(listFaithWallPosts().some(item => item.id === clientPost.id), false);

  revokeSeekerToken(updatedProfile.token);
  assert.equal(verifySeekerToken(updatedProfile.token), null);
  writeSeekerSession(null);
});



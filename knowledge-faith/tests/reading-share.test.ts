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
  addFaithWallReply,
  answerScholarQuestion,
  CORE_DHIKR_REACTIONS,
  deleteFaithWallPost,
  formatPostTimestamp,
  getContextualNamesOfAllah,
  listAllFaithWallPosts,
  listFaithWallPosts,
  listScholarQuestions,
  moderateFaithWallPost,
  packLines,
  parseReadingLink,
  publishFaithWallPost,
  readAdminSettings,
  readingLinkHash,
  resolveUserProfilePortfolio,
  saveAdminSettings,
  SEEDED_COMPLETED_PODCASTS,
  SEEDED_FAITH_WALL_POSTS,
  submitScholarQuestion,
  toggleFaithWallBookmark,
  toggleFaithWallLike,
  toggleFaithWallReaction,
  updateFaithWallPost,
  verseShareText,
  WALL_THEME_LIST,
  WALL_THEMES,
  wrapWords,
} from '../src/lib/verseShare.ts';
import {
  addReplyToServerWallPost,
  answerServerQuestion,
  AUTH_REQUIRED_MESSAGE,
  authenticateGoogleCredential,
  buildGoogleOAuthStart,
  createServerQuestion,
  createServerWallPost,
  deleteServerWallPost,
  exchangeGoogleOAuthCode,
  getGoogleAuthConfig,
  getServerAdminSettings,
  getServerUserProfile,
  GOOGLE_CALLBACK_ALIASES,
  loginSeekerAccount,
  moderateServerWallPost,
  reactToServerWallPost,
  registerSeekerAccount,
  requireSeekerAuth,
  resetSeekerStoreForTests,
  revokeSeekerToken,
  updateSeekerAccountProfile,
  updateServerAdminSettings,
  updateServerWallPost,
  verifyGoogleOAuthState,
  verifySeekerToken,
} from '../src/server/seekerAuth.ts';
import { parseHash } from '../src/lib/route.ts';
import {
  consumePendingRoute,
  deskLabelForHash,
  isPublicHomeHash,
  readPendingDeskLabel,
  readPendingRoute,
  requestAuthenticatedNavigation,
  setPendingRoute,
  writeSeekerSession,
} from '../src/lib/seekerAuth.ts';
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

test('google OIDC config, OAuth start/callback flow, and GIS credential verification link seeker accounts and avatars', async () => {
  resetSeekerStoreForTests();
  const prevClientId = process.env.GOOGLE_OIDC_CLIENT_ID;
  const prevClientSecret = process.env.GOOGLE_OIDC_CLIENT_SECRET;
  const prevIssuer = process.env.GOOGLE_OIDC_ISSUER;

  try {
    process.env.GOOGLE_OIDC_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_OIDC_CLIENT_SECRET = 'test-google-client-secret';
    process.env.GOOGLE_OIDC_ISSUER = 'https://accounts.google.com';

    const cfg = getGoogleAuthConfig();
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.clientId, 'test-google-client-id.apps.googleusercontent.com');
    assert.equal(cfg.hasClientSecret, true);
    assert.equal(cfg.oauthRedirectPath, '/api/auth/google/start');

    const fakeReq = {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'dragon-dawwa-production.up.railway.app',
      },
      protocol: 'https',
      get: (name: string) => (name.toLowerCase() === 'host' ? 'dragon-dawwa-production.up.railway.app' : undefined),
    } as unknown as Parameters<typeof buildGoogleOAuthStart>[0];

    const started = buildGoogleOAuthStart(fakeReq, '#/quran/wall?view=mine');
    assert.match(started.url, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    assert.match(started.url, /client_id=test-google-client-id\.apps\.googleusercontent\.com/);
    assert.match(started.url, /redirect_uri=https%3A%2F%2Fdragon-dawwa-production\.up\.railway\.app%2Fapi%2Fauth%2Fgoogle%2Fcallback/);
    assert.match(started.url, /scope=openid\+email\+profile/);
    assert.equal(started.redirectUri, 'https://dragon-dawwa-production.up.railway.app/api/auth/google/callback');

    const verifiedState = verifyGoogleOAuthState(started.state, started.nonce);
    assert.equal(verifiedState?.returnTo, '#/quran/wall?view=mine');
    assert.equal(verifyGoogleOAuthState(started.state, 'wrong-nonce'), null);

    // Verify custom GOOGLE_OIDC_REDIRECT_URI and callback alias support
    assert.equal(GOOGLE_CALLBACK_ALIASES.includes('/api/auth/google/callback'), true);
    assert.equal(GOOGLE_CALLBACK_ALIASES.includes('/auth/google/callback'), true);
    assert.equal(GOOGLE_CALLBACK_ALIASES.includes('/api/auth/callback/google'), true);
    assert.equal(GOOGLE_CALLBACK_ALIASES.includes('/api/oidc/callback'), true);
    assert.equal(GOOGLE_CALLBACK_ALIASES.includes('/auth/callback'), true);

    const aliasStarted = buildGoogleOAuthStart(fakeReq, '#/quran/wall', '/auth/callback');
    assert.equal(aliasStarted.redirectUri, 'https://dragon-dawwa-production.up.railway.app/auth/callback');

    process.env.GOOGLE_OIDC_REDIRECT_URI = 'https://dragon-dawwa-production.up.railway.app/auth/google/callback';
    const overrideStarted = buildGoogleOAuthStart(fakeReq, '#/quran/wall');
    assert.equal(overrideStarted.redirectUri, 'https://dragon-dawwa-production.up.railway.app/auth/google/callback');
    delete process.env.GOOGLE_OIDC_REDIRECT_URI;

    // 1. Verify GIS ID token credential endpoint creates a verified Google Seeker with avatarUrl
    const mockFetchForGis = (async (input: RequestInfo | URL) => {
      const url = String(input);
      assert.match(url, /oauth2\.googleapis\.com\/tokeninfo/);
      return new Response(
        JSON.stringify({
          iss: 'https://accounts.google.com',
          aud: 'test-google-client-id.apps.googleusercontent.com',
          sub: 'google-sub-123456',
          email: 'layla.google@dragondawwa.com',
          email_verified: 'true',
          name: 'Dr. Layla Al-Qasimi',
          picture: 'https://lh3.googleusercontent.com/a/layla-avatar.png',
          exp: String(Math.floor(Date.now() / 1000) + 3600),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const gisResult = await authenticateGoogleCredential('header.payload.sig', mockFetchForGis);
    assert.equal(gisResult.user.email, 'layla.google@dragondawwa.com');
    assert.equal(gisResult.user.name, 'Dr. Layla Al-Qasimi');
    assert.equal(gisResult.user.googleSub, 'google-sub-123456');
    assert.equal(gisResult.user.avatarUrl, 'https://lh3.googleusercontent.com/a/layla-avatar.png');
    assert.equal(gisResult.user.authProvider, 'google');
    assert.equal(gisResult.user.provider, 'google');
    assert.equal(gisResult.user.verified, true);

    // 2. Verify OAuth2 authorization code exchange links to the same Seeker account by googleSub
    const fakeIdTokenPayload = Buffer.from(
      JSON.stringify({
        iss: 'https://accounts.google.com',
        aud: 'test-google-client-id.apps.googleusercontent.com',
        sub: 'google-sub-123456',
        email: 'layla.google@dragondawwa.com',
        email_verified: true,
        name: 'Dr. Layla Al-Qasimi',
        picture: 'https://lh3.googleusercontent.com/a/layla-avatar-hd.png',
      }),
      'utf8',
    ).toString('base64url');
    const mockFetchForOAuth = (async (input: RequestInfo | URL) => {
      const url = String(input);
      assert.equal(url, 'https://oauth2.googleapis.com/token');
      return new Response(
        JSON.stringify({
          id_token: `eyJhbGciOiJSUzI1NiJ9.${fakeIdTokenPayload}.sig`,
          access_token: 'ya29.mock-access-token',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const oauthResult = await exchangeGoogleOAuthCode(
      { code: '4/mock-oauth-code', state: started.state, cookieNonce: started.nonce },
      mockFetchForOAuth,
    );
    assert.equal(oauthResult.user.id, gisResult.user.id);
    assert.equal(oauthResult.user.avatarUrl, 'https://lh3.googleusercontent.com/a/layla-avatar-hd.png');
    assert.equal(oauthResult.user.authProvider, 'google');
    assert.equal(oauthResult.returnTo, '#/quran/wall?view=mine');

    const decodedFromToken = verifySeekerToken(oauthResult.token);
    assert.equal(decodedFromToken?.avatarUrl, 'https://lh3.googleusercontent.com/a/layla-avatar-hd.png');
    assert.equal(decodedFromToken?.authProvider, 'google');
  } finally {
    if (prevClientId === undefined) delete process.env.GOOGLE_OIDC_CLIENT_ID;
    else process.env.GOOGLE_OIDC_CLIENT_ID = prevClientId;
    if (prevClientSecret === undefined) delete process.env.GOOGLE_OIDC_CLIENT_SECRET;
    else process.env.GOOGLE_OIDC_CLIENT_SECRET = prevClientSecret;
    if (prevIssuer === undefined) delete process.env.GOOGLE_OIDC_ISSUER;
    else process.env.GOOGLE_OIDC_ISSUER = prevIssuer;
    writeSeekerSession(null);
  }
});

test('compulsory login gate intercepts internal routes when logged out and requireSeekerAuth rejects unauthenticated API calls', () => {
  resetSeekerStoreForTests();
  writeSeekerSession(null);
  setPendingRoute(null, null);

  assert.equal(isPublicHomeHash(''), true);
  assert.equal(isPublicHomeHash('#/'), true);
  assert.equal(isPublicHomeHash('#/hub'), true);
  assert.equal(isPublicHomeHash('#/quran'), false);
  assert.equal(isPublicHomeHash('#/podcast'), false);
  assert.equal(isPublicHomeHash('#/hub/seerah'), false);

  assert.equal(deskLabelForHash('#/quran'), 'Al-Qur’an Reader & Tafsir');
  assert.equal(deskLabelForHash('#/hadith'), 'Prophetic Sunnah (Hadith)');
  assert.equal(deskLabelForHash('#/podcast'), 'Research & Podcasts Studio');
  assert.equal(deskLabelForHash('#/quran/wall'), 'Community Faith Wall');

  // Logged-out navigation to internal route is intercepted and stored as pendingRoute
  const allowed = requestAuthenticatedNavigation('#/quran/book', 'Al-Qur’an Reader & Tafsir');
  assert.equal(allowed, false);
  assert.equal(readPendingRoute(), '#/quran/book');
  assert.equal(readPendingDeskLabel(), 'Al-Qur’an Reader & Tafsir');

  const consumed = consumePendingRoute();
  assert.equal(consumed, '#/quran/book');
  assert.equal(readPendingRoute(), null);

  // Server requireSeekerAuth rejects unauthenticated requests with 401 requiresAuth: true
  let statusCode = 200;
  let jsonBody: { error?: string; requiresAuth?: boolean } = {};
  let nextCalled = false;
  const unauthReq = { headers: {} } as unknown as Parameters<typeof requireSeekerAuth>[0];
  const mockRes = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: { error?: string; requiresAuth?: boolean }) {
      jsonBody = payload;
      return this;
    },
  } as unknown as Parameters<typeof requireSeekerAuth>[1];

  requireSeekerAuth(unauthReq, mockRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 401);
  assert.equal(jsonBody.requiresAuth, true);
  assert.equal(jsonBody.error, AUTH_REQUIRED_MESSAGE);

  // Authenticated request passes requireSeekerAuth
  const registered = registerSeekerAccount({
    email: 'seeker.gate@dragondawwa.com',
    password: 'gate-password',
    name: 'Gate Seeker',
  });
  const authReq = {
    headers: { authorization: `Bearer ${registered.token}` },
  } as unknown as Parameters<typeof requireSeekerAuth>[0];
  requireSeekerAuth(authReq, mockRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('social faith wall supports 5 themes, contextual Asma-ul-Husna engine, Dhikr reactions, bookmarks, and replies', async () => {
  resetSeekerStoreForTests();
  writeSeekerSession(null);

  // 1. Verify all 5 themes exist with expected gradient classes
  assert.equal(WALL_THEME_LIST.length, 5);
  assert.deepEqual(
    WALL_THEME_LIST.map(t => t.id),
    ['emerald', 'amethyst', 'obsidian', 'sapphire', 'amber'],
  );
  assert.match(WALL_THEMES.amethyst.classes, /from-\[#1A0B2E\]/);
  assert.match(WALL_THEMES.sapphire.classes, /from-\[#051329\]/);
  assert.match(WALL_THEMES.amber.classes, /from-\[#241407\]/);

  // 2. Verify contextual Asma-ul-Husna detection for Tawhid/Kursi, Mercy, Relief, Knowledge, and Guidance
  const kursiNames = getContextualNamesOfAllah(2, 255, verse.arabic + ' ' + verse.translation);
  assert.equal(kursiNames.some(n => n.transliteration === 'Al-Aḥad'), true);
  assert.equal(kursiNames.some(n => n.transliteration === 'Al-Qayyūm'), true);

  const reliefNames = getContextualNamesOfAllah(94, 5, 'For indeed, with hardship comes ease.');
  assert.equal(reliefNames.some(n => n.transliteration === 'Al-Fattāḥ'), true);
  assert.equal(reliefNames.some(n => n.transliteration === 'Al-Laṭīf'), true);

  const mercyNames = getContextualNamesOfAllah(39, 53, 'Allah forgives all sins; He is the Merciful.');
  assert.equal(mercyNames.some(n => n.transliteration === 'Al-Ghafūr'), true);
  assert.equal(mercyNames.some(n => n.transliteration === 'Ar-Raḥmān'), true);

  const knowledgeNames = getContextualNamesOfAllah(20, 114, 'My Lord, increase me in knowledge and wisdom.');
  assert.equal(knowledgeNames.some(n => n.transliteration === 'Al-ʿAlīm'), true);
  assert.equal(knowledgeNames.some(n => n.transliteration === 'Al-Ḥakīm'), true);

  assert.equal(CORE_DHIKR_REACTIONS.length, 5);

  // 3. Verify timestamp formatting
  const ts = formatPostTimestamp('2026-11-08T17:30:00.000Z', Date.parse('2026-11-08T19:30:00.000Z'));
  assert.match(ts.absolute, /2026/);
  assert.equal(ts.relative, '2h ago');

  // 4. Publish post with amethyst theme, toggle Dhikr & Asma reactions, bookmark, and add reply
  const post = await publishFaithWallPost({
    verse,
    lang: 'en',
    url: '#/quran/book?surah=2&ayah=255',
    reflection: 'Ayat al-Kursi in amethyst theme.',
    theme: 'amethyst',
  });
  assert.equal(post.theme, 'amethyst');

  const afterReact = toggleFaithWallReaction(post.id, 'asma:al_qayyum');
  const reactedPost = afterReact.find(item => item.id === post.id);
  assert.equal(reactedPost?.userReactions?.includes('asma:al_qayyum'), true);
  assert.equal(reactedPost?.reactions?.['asma:al_qayyum'], 1);

  const afterBookmark = toggleFaithWallBookmark(post.id);
  assert.equal(afterBookmark.find(item => item.id === post.id)?.saved, true);

  const reply = await addFaithWallReply(post.id, 'Māshā’Allāh, beautiful reflection!');
  assert.equal(reply?.text, 'Māshā’Allāh, beautiful reflection!');
  const withReplies = listFaithWallPosts().find(item => item.id === post.id);
  assert.equal(withReplies?.replies?.some(r => r.id === reply?.id), true);

  // 5. Server-side reaction and reply persistence
  const seeker = registerSeekerAccount({
    email: 'social@dragondawwa.com',
    password: 'social-password',
    name: 'Brother Feroz Ansar',
    kunyah: 'Community Researcher',
  });
  const srvPost = createServerWallPost(
    {
      surah: 94,
      ayah: 5,
      surahName: 'Ash-Sharh',
      arabic: 'فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
      translation: 'For indeed, with hardship comes ease.',
      reflection: 'Relief accompanies hardship.',
      theme: 'sapphire',
      lang: 'en',
      url: '#/quran/book?surah=94&ayah=5',
    },
    seeker.user,
  );
  assert.equal(srvPost.theme, 'sapphire');

  const srvReact = reactToServerWallPost(srvPost.id, 'subhanallah');
  assert.equal(srvReact.count, 1);

  const srvReply = addReplyToServerWallPost(srvPost.id, 'Alḥamdulillāh for this reminder.', seeker.user);
  assert.equal(srvReply.authorName, 'Brother Feroz Ansar');
});

test('curated user profiles, 2-door controlled posting engine, and institutional admin cockpit work end-to-end', async () => {
  resetSeekerStoreForTests();
  writeSeekerSession(null);

  // 1. Routes support #/profile, #/profile/:id, #/admin, and #/about
  assert.equal(parseHash('#/profile').path, 'profile');
  const handleLoc = parseHash('#/profile/ferozansar');
  assert.equal(handleLoc.path, 'profile');
  assert.deepEqual(handleLoc.segments, ['ferozansar']);
  assert.equal(parseHash('#/admin').path, 'admin');
  assert.equal(parseHash('#/about').path, 'about');
  assert.equal(isPublicHomeHash('#/about'), true);

  // 2. Strict 2-door rule on server: rejecting raw unanchored post
  const adminSeeker = registerSeekerAccount({
    email: 'feroz@dragondawwa.com',
    password: 'admin-password',
    name: 'FEROZ ANSAR',
    kunyah: 'Lead Researcher',
  });
  assert.equal(adminSeeker.user.role, 'admin');

  assert.throws(
    () =>
      createServerWallPost(
        {
          type: 'podcast',
          podcastId: '',
          podcastAudioUrl: '',
          reflection: 'Freeform text with no anchor',
        },
        adminSeeker.user,
      ),
    /sacred anchor/i,
  );

  // 3. Door 2: Publishing a completed Research Podcast episode
  const episode = SEEDED_COMPLETED_PODCASTS[0];
  const podcastPost = await publishFaithWallPost({
    type: 'podcast',
    verse,
    lang: 'en',
    url: '#/podcast',
    podcastId: episode.id,
    podcastTitle: episode.title,
    podcastAudioUrl: episode.audioUrl,
    podcastDuration: episode.duration,
    podcastCitations: episode.citations,
    reflection: 'Key takeaways from this research synthesis.',
    authorName: 'Brother Feroz Ansar',
    theme: 'emerald',
  });
  assert.equal(podcastPost.type, 'podcast');
  assert.equal(podcastPost.podcastId, episode.id);
  assert.equal(podcastPost.status, 'approved');

  // 4. User Profile Portfolio resolution (#/profile/brotherferozansar)
  const ferozPortfolio = resolveUserProfilePortfolio('brotherferozansar');
  assert.equal(ferozPortfolio.name, 'Brother Feroz Ansar');
  assert.equal(ferozPortfolio.reflectionsCount >= 1, true);
  assert.equal(ferozPortfolio.podcastsCount >= 1, true);
  assert.equal(ferozPortfolio.approvedPosts.every(p => p.status !== 'pending' && p.status !== 'rejected'), true);

  // 5. Admin Moderation Queue & review mode
  const updatedSettings = await saveAdminSettings({
    moderationMode: 'review',
    heroBannerUrl: '/assets/banner-art.jpg',
    deskPalette: 'amethyst-obsidian',
  });
  assert.equal(updatedSettings.moderationMode, 'review');
  assert.equal(readAdminSettings().heroBannerUrl, '/assets/banner-art.jpg');

  const pendingPost = await publishFaithWallPost({
    type: 'reflection',
    verse,
    lang: 'en',
    url: '#/quran/book?surah=2&ayah=255',
    reflection: 'A reflection submitted while Require Admin Review is active.',
    authorName: 'Seeker Pending',
  });
  assert.equal(pendingPost.status, 'pending');
  assert.equal(listFaithWallPosts().some(p => p.id === pendingPost.id), false);
  assert.equal(listAllFaithWallPosts(true).some(p => p.id === pendingPost.id && p.status === 'pending'), true);

  await moderateFaithWallPost(pendingPost.id, { status: 'approved' });
  assert.equal(listFaithWallPosts().some(p => p.id === pendingPost.id), true);

  // Reset moderation mode back to instant
  await saveAdminSettings({ moderationMode: 'instant' });

  // 6. Official Institutional Broadcast (pinned to top of Faith Wall)
  const broadcast = await publishFaithWallPost({
    type: 'reflection',
    verse,
    lang: 'en',
    url: '#/quran/book?surah=2&ayah=255',
    reflection: 'Official Friday institutional reminder from the Research Desk.',
    isPinned: true,
    isOfficialBroadcast: true,
    status: 'approved',
  });
  assert.equal(broadcast.isPinned, true);
  assert.equal(broadcast.isOfficialBroadcast, true);
  assert.equal(listFaithWallPosts()[0].id, broadcast.id);

  // 7. Scholar Q&A Inbox (create & answer question on client & server)
  const qClient = await submitScholarQuestion({
    question: 'What is the ruling on combining prayers while traveling?',
    language: 'en',
  });
  assert.equal(qClient.status, 'open');
  await answerScholarQuestion({
    id: qClient.id,
    answer: 'Combining Dhuhr with Asr and Maghrib with Isha is an established Prophetic concession (rukhṣah) during travel.',
    citations: ['Quran 4:101', 'Sahih Muslim 705'],
    answeredBy: 'Shaykh Ahmad Al-Mansoor',
  });
  const answeredClient = listScholarQuestions().find(item => item.id === qClient.id);
  assert.equal(answeredClient?.status, 'answered');
  assert.equal(answeredClient?.answeredBy, 'Shaykh Ahmad Al-Mansoor');

  // Server-side admin settings, moderation, and Q&A
  updateServerAdminSettings({ moderationMode: 'review' });
  assert.equal(getServerAdminSettings().moderationMode, 'review');
  const srvPending = createServerWallPost(
    {
      type: 'reflection',
      surah: 2,
      ayah: 255,
      arabic: verse.arabic,
      translation: verse.translation,
      reflection: 'Server pending post',
    },
    adminSeeker.user,
  );
  assert.equal(srvPending.status, 'pending');
  const srvApproved = moderateServerWallPost(srvPending.id, { status: 'approved', isPinned: true });
  assert.equal(srvApproved.status, 'approved');
  assert.equal(srvApproved.isPinned, true);

  const srvProf = getServerUserProfile(adminSeeker.user.id);
  assert.equal(srvProf?.profile.name, 'FEROZ ANSAR');
  assert.equal(srvProf?.posts.length, 1);

  const srvQ = createServerQuestion({ question: 'How is Zakah calculated on gold?' }, adminSeeker.user);
  const srvAnswered = answerServerQuestion(
    srvQ.id,
    {
      answer: '2.5% above the nisab of 85g of pure gold held for a lunar year.',
      citations: ['Sahih Bukhari 1454'],
    },
    adminSeeker.user,
  );
  assert.equal(srvAnswered.status, 'answered');

  const tamilPod = SEEDED_FAITH_WALL_POSTS.find(p => p.id === 'seed-wall-podcast-tamil-14-7');
  assert.ok(tamilPod);
  assert.equal(tamilPod.type, 'podcast');
  assert.equal(tamilPod.podcastDuration, '05:50');
  assert.match(tamilPod.podcastTitle ?? '', /சூரா இப்ராஹீம் 14:7/);
});







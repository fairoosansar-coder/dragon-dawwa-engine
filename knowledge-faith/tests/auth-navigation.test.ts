import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  buildGoogleOAuthRedirectUrl, closeSeekerAuthModal, consumePendingRoute,
  getSession, loginOrRegisterSeeker, openSeekerAuthModal, PENDING_ROUTE_STORAGE_KEY,
  readPendingRoute, readSeekerSession, refreshSeekerSessionAndConfig, requestAuthenticatedNavigation,
  SESSION_STORAGE_KEY, SESSION_TOKEN_KEY, setPendingRoute, signInWithGoogleAccessToken,
  signInWithGoogleCredential, useSeekerAuth, writeSeekerSession,
} from '../src/lib/seekerAuth.ts';
import {
  listFaithWallPosts, publishFaithWallPost, resolveUserProfilePortfolio,
} from '../src/lib/verseShare.ts';
import {
  authenticateGoogleCredential, createServerWallPost, exchangeGoogleOAuthCode,
  getServerUserProfile, listServerWallPosts, loginSeekerAccount, registerSeekerAccount,
  resetSeekerStoreForTests, verifyGoogleAccessToken,
} from '../src/server/seekerAuth.ts';
import { WallPostCard } from '../src/components/wall/WallPostCard.tsx';
import { PublicHomeOverview } from '../src/views/PublicHomeOverview.tsx';

test('post-login navigation preserves requested destinations and authentication gates', async t => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dragon.example/#/hub' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    Event: dom.window.Event, HashChangeEvent: dom.window.HashChangeEvent, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const originalFetch = globalThis.fetch;
  const user = { id: 'test-seeker', email: 'seeker@example.test', name: 'Seeker', kunyah: '', bio: '',
    emblem: 'rub-el-hizb' as const, provider: 'email' as const, verified: true, createdAt: '2026-11-11' };
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  let rejected = false;
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify(rejected ? { error: 'Invalid password or credential' } : { token: 'server-test-token', user }),
      { status: rejected ? 401 : 200, headers: { 'Content-Type': 'application/json' } });
  };
  function Observer() { useSeekerAuth(); return null; }
  const root = createRoot(document.getElementById('root')!);
  try {
    // Several components subscribe in production. Later subscribers must not overwrite the first redirect.
    await act(async () => root.render(createElement('div', null,
      createElement(Observer), createElement(Observer), createElement(Observer))));
    const reset = async () => {
      rejected = false;
      await act(async () => { closeSeekerAuthModal(); setPendingRoute(null); writeSeekerSession(null); });
      window.history.replaceState(null, '', '#/hub');
      requests.length = 0;
    };
    const paths = ['#/quran/book', '#/quran/book?surah=18&ayah=10', '#/quran/study?surah=2&ayah=255',
      '#/hadith', '#/hadith/123?lang=ta', '#/books/item/42', '#/hub/saved', '#/spiritual/salah',
      '#/podcast', '#/profile', '#/admin', '#/wall', '#/prayer'];
    for (const method of ['google', 'username', 'email', 'phone'] as const) {
      for (const destination of [...paths, null]) {
        await t.test(`${method}: ${destination ?? 'homepage → Faith Wall'}`, async () => {
          await reset();
          await act(async () => {
            if (destination) {
              assert.equal(requestAuthenticatedNavigation(destination), false);
              assert.equal(window.location.hash, '#/hub');
              assert.equal(readSeekerSession(), null);
            } else openSeekerAuthModal();
          });
          await act(async () => {
            if (method === 'google') await signInWithGoogleCredential('google-test-credential');
            else await loginOrRegisterSeeker({
              mode: 'login',
              identifier: method === 'phone' ? '+971501234567' : method === 'username' ? 'ahmad_k' : user.email,
              password: 'test-password',
            });
            closeSeekerAuthModal();
          });
          assert.equal(window.location.hash, destination ?? '#/quran/wall');
          assert.equal(readPendingRoute(), null);
          assert.equal(window.sessionStorage.getItem(PENDING_ROUTE_STORAGE_KEY), null);
          assert.equal(readSeekerSession()?.token, 'server-test-token');
          assert.equal(requests.at(-1)?.url, method === 'google' ? '/api/auth/google/credential' : '/api/auth/login');
        });
      }
    }
    for (const invalid of ['#/not-a-route', '#//evil.example', 'https://evil.example', '#/hub', '#/about', '#/quran\\evil']) {
      await t.test(`invalid saved destination falls back: ${invalid}`, async () => {
        await reset();
        window.sessionStorage.setItem(PENDING_ROUTE_STORAGE_KEY, invalid);
        await act(async () => { openSeekerAuthModal(); await signInWithGoogleCredential('credential'); });
        assert.equal(window.location.hash, '#/quran/wall');
        assert.equal(window.sessionStorage.getItem(PENDING_ROUTE_STORAGE_KEY), null);
      });
    }
    await t.test('sessionStorage destination survives a redirect/reload and is consumed once', async () => {
      await reset();
      window.sessionStorage.setItem(PENDING_ROUTE_STORAGE_KEY, '#/hadith/123?lang=si');
      assert.equal(new URL(buildGoogleOAuthRedirectUrl('#/hub', '/auth/callback'), window.location.origin).searchParams.get('returnTo'), '#/hadith/123?lang=si');
      assert.equal(readPendingRoute(), '#/hadith/123?lang=si');
      await act(async () => writeSeekerSession({ token: 'server-test-token', user }));
      assert.equal(window.location.hash, '#/hadith/123?lang=si');
      assert.equal(consumePendingRoute(), null);
    });
    await t.test('Google redirect homepage default and current deep-link fallback', async () => {
      await reset();
      for (const current of ['', '#/hub', '#/quran/book?surah=18']) {
        const url = new URL(buildGoogleOAuthRedirectUrl(current, '/auth/callback'), window.location.origin);
        assert.equal(url.searchParams.get('returnTo'), current.includes('book') ? current : '#/quran/wall');
        assert.equal(url.searchParams.get('callbackPath'), '/auth/callback');
      }
    });
    for (const method of ['google', 'email'] as const) {
      await t.test(`${method} rejection does not navigate or consume the destination`, async () => {
        await reset(); rejected = true;
        await act(async () => { requestAuthenticatedNavigation('#/quran/book'); });
        await act(async () => {
          await assert.rejects(method === 'google' ? signInWithGoogleCredential('bad') :
            loginOrRegisterSeeker({ mode: 'login', email: user.email, password: 'bad' }));
        });
        assert.equal(window.location.hash, '#/hub');
        assert.equal(readPendingRoute(), '#/quran/book');
        assert.equal(readSeekerSession(), null);
      });
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close(); globalThis.fetch = originalFetch;
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('modal delegates navigation to shared auth instead of overriding successful redirects', () => {
  const source = readFileSync(new URL('../src/components/SeekerAuthModal.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /window\.location\.hash\s*=/);
  assert.match(source, /buildGoogleOAuthRedirectUrl\(undefined, callbackPath\)/);
});

test('failed authentication never creates fallback local sessions and clears stale auth state', async t => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dragon.example/#/hub' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    Event: dom.window.Event, HashChangeEvent: dom.window.HashChangeEvent, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const originalFetch = globalThis.fetch;

  try {
    await t.test('failed email sign-in (401/500/empty body) clears stale session and denies access', async () => {
      for (const scenario of [
        { label: '401 invalid credentials', status: 401, payload: { error: 'Authentication failed.' } },
        { label: '500 server error', status: 500, payload: { error: 'Unexpected server error' } },
        { label: '200 with missing token/user', status: 200, payload: {} },
      ]) {
        // Seed a stale session first to verify failure clears it
        writeSeekerSession({
          token: 'stale-token.sig',
          user: {
            id: 'stale-user',
            email: 'stale@example.test',
            name: 'Stale User',
            kunyah: 'Seeker',
            bio: '',
            emblem: 'rub-el-hizb',
            provider: 'email',
            verified: true,
            createdAt: '2026-11-11',
          },
        });
        writeSeekerSession(null);
        requestAuthenticatedNavigation('#/quran/book?surah=2&ayah=255');

        globalThis.fetch = async () =>
          new Response(JSON.stringify(scenario.payload), {
            status: scenario.status,
            headers: { 'Content-Type': 'application/json' },
          });

        await assert.rejects(
          () =>
            loginOrRegisterSeeker({
              mode: 'login',
              provider: 'email',
              email: 'seeker@example.test',
              password: 'wrong-password',
            }),
          /Authentication failed|Unexpected server error/i,
          scenario.label,
        );

        assert.equal(getSession(), null, `${scenario.label}: getSession() must be null`);
        assert.equal(readSeekerSession(), null, `${scenario.label}: readSeekerSession() must be null`);
        assert.equal(window.localStorage.getItem(SESSION_STORAGE_KEY), null);
        assert.equal(window.localStorage.getItem(SESSION_TOKEN_KEY), null);
        assert.equal(window.location.hash, '#/hub');
        assert.equal(readPendingRoute(), '#/quran/book?surah=2&ayah=255');
      }
    });

    await t.test('network failure during email, phone, username, or Google auth never falls back to local session', async () => {
      globalThis.fetch = async () => {
        throw new Error('Failed to fetch: network unreachable');
      };

      for (const attempt of [
        () => loginOrRegisterSeeker({ mode: 'login', provider: 'email', email: 'seeker@example.test', password: 'secret' }),
        () => loginOrRegisterSeeker({ mode: 'register', provider: 'email', email: 'seeker@example.test', password: 'secret' }),
        () => loginOrRegisterSeeker({ mode: 'login', identifier: '+971501234567', password: 'secret' }),
        () => loginOrRegisterSeeker({ mode: 'login', identifier: 'ahmad_k', password: 'secret' }),
        () => signInWithGoogleCredential('mock-google-id-token'),
      ]) {
        await assert.rejects(attempt, /network unreachable/i);
        assert.equal(getSession(), null);
        assert.equal(window.localStorage.getItem(SESSION_STORAGE_KEY), null);
        assert.equal(window.localStorage.getItem(SESSION_TOKEN_KEY), null);
      }
    });

    await t.test('guest and quick sign-in bypasses are rejected on both client and server', async () => {
      for (const badClientCall of [
        () => loginOrRegisterSeeker({ mode: 'quick', provider: 'guest', email: 'guest@dragondawwa.com' }),
        () => loginOrRegisterSeeker({ mode: 'guest', provider: 'guest' }),
        () => loginOrRegisterSeeker({ mode: 'login', provider: 'guest', email: 'guest@dragondawwa.com', password: 'secret' }),
        () => loginOrRegisterSeeker({ mode: 'login', provider: 'apple', email: 'apple@dragondawwa.com', password: 'secret' }),
      ]) {
        await assert.rejects(badClientCall, /Guest and quick sign-in are disabled/i);
        assert.equal(getSession(), null);
      }

      assert.throws(
        () => registerSeekerAccount({ provider: 'guest', email: 'guest@dragondawwa.com', password: 'secret' }),
        /Guest and quick sign-in are disabled/i,
      );
      assert.throws(
        () => loginSeekerAccount({ mode: 'quick', provider: 'guest', email: 'guest@dragondawwa.com' }),
        /Guest and quick sign-in are disabled/i,
      );
    });

    await t.test('failed Google OAuth token exchange & callback auth_error keep session null', async () => {
      const prevClientId = process.env.GOOGLE_OIDC_CLIENT_ID;
      const prevClientSecret = process.env.GOOGLE_OIDC_CLIENT_SECRET;
      try {
        process.env.GOOGLE_OIDC_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
        process.env.GOOGLE_OIDC_CLIENT_SECRET = 'test-client-secret';

        await assert.rejects(
          () => exchangeGoogleOAuthCode({ code: 'bad-code', state: 'invalid-state', cookieNonce: 'nonce' }),
          /expired or could not be verified/i,
        );
        assert.equal(getSession(), null);

        // Simulate landing on ?auth_error=access_denied
        window.history.replaceState(null, '', '/?auth_error=access_denied#/hub');
        assert.equal(getSession(), null);

        // Simulate malformed dd_seeker_handoff token
        window.history.replaceState(null, '', '/?dd_seeker_handoff=local-token-fake#/hub');
        assert.equal(getSession(), null);
      } finally {
        if (prevClientId === undefined) delete process.env.GOOGLE_OIDC_CLIENT_ID;
        else process.env.GOOGLE_OIDC_CLIENT_ID = prevClientId;
        if (prevClientSecret === undefined) delete process.env.GOOGLE_OIDC_CLIENT_SECRET;
        else process.env.GOOGLE_OIDC_CLIENT_SECRET = prevClientSecret;
      }
    });

    await t.test('legacy local-token-* in localStorage or unauthenticated /api/auth/session is rejected and cleared', async () => {
      window.localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          token: 'local-token-seeker',
          user: { id: 'seeker-local', email: 'local@dragondawwa.com', name: 'Local Fallback' },
        }),
      );
      window.localStorage.setItem(SESSION_TOKEN_KEY, 'local-token-seeker');
      assert.equal(getSession(), null);
      assert.equal(window.localStorage.getItem(SESSION_STORAGE_KEY), null);
      assert.equal(window.localStorage.getItem(SESSION_TOKEN_KEY), null);

      // Valid-looking token that server reports as authenticated: false
      const fakePayload = Buffer.from(JSON.stringify({ sub: 'u1', email: 'u1@example.test' }), 'utf8').toString('base64url');
      writeSeekerSession({
        token: `${fakePayload}.fakesig`,
        user: {
          id: 'u1',
          email: 'u1@example.test',
          name: 'User One',
          kunyah: 'Seeker',
          bio: '',
          emblem: 'rub-el-hizb',
          provider: 'email',
          verified: true,
          createdAt: '2026-11-11',
        },
      });
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ authenticated: false, user: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      const refreshed = await refreshSeekerSessionAndConfig();
      assert.equal(refreshed.session, null);
      assert.equal(getSession(), null);
    });
  } finally {
    dom.window.close();
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('anonymous posts strip all identifying author, handle, userId, email, and avatar metadata on client, server, and UI card', async () => {
  resetSeekerStoreForTests();
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dragon.example/#/quran/wall' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    Event: dom.window.Event, HashChangeEvent: dom.window.HashChangeEvent, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const originalFetch = globalThis.fetch;
  const postedPayloads: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_url, init) => {
    if (init?.body) postedPayloads.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  };

  const root = createRoot(document.getElementById('root')!);
  try {
    const signedInSeeker = registerSeekerAccount({
      email: 'identifiable.seeker@dragondawwa.com',
      password: 'secret-password',
      name: 'Dr. Identifiable Author',
      kunyah: 'Senior Tafsir Fellow',
      emblem: 'octagon-rosette',
      provider: 'google',
      avatarUrl: 'https://lh3.googleusercontent.com/a/identifiable-photo.png',
    });
    writeSeekerSession({ token: signedInSeeker.token, user: signedInSeeker.user });

    // 1. Client-side anonymous post creation
    const anonClientPost = await publishFaithWallPost({
      type: 'good_deed',
      isAnonymous: true,
      deedCategory: 'charity',
      deedTitle: 'Quiet Daily Sadaqah',
      verse: {
        surah: 2,
        ayah: 261,
        surahName: 'Al-Baqara',
        arabic: 'مَّثَلُ ٱلَّذِينَ يُنفِقُونَ أَمْوَٰلَهُمْ فِى سَبِيلِ ٱللَّهِ',
        translation: 'The example of those who spend their wealth in the way of Allah.',
      },
      lang: 'en',
      url: '#/quran/book?surah=2&ayah=261',
      reflection: 'Gave quiet sadaqah today.',
      authorName: 'Dr. Identifiable Author',
      authorRole: 'Senior Tafsir Fellow',
    });

    assert.equal(anonClientPost.isAnonymous, true);
    assert.equal(anonClientPost.authorName, 'Anonymous Seeker');
    assert.equal(anonClientPost.authorHandle, '@anonymous');
    assert.equal(anonClientPost.authorRole, 'Sincere Sunnah Pledge');
    assert.equal(anonClientPost.userId, undefined);
    assert.equal(anonClientPost.authorId, undefined);
    assert.equal(anonClientPost.authorEmail, undefined);
    assert.equal(anonClientPost.authorAvatar, undefined);
    assert.equal(anonClientPost.authorAvatarUrl, undefined);
    assert.equal(anonClientPost.authorAuthProvider, undefined);
    assert.equal(anonClientPost.verified, false);
    assert.equal(anonClientPost.authorEmblem, 'emerald-lamp');

    // Outgoing API payload must also strip identifying metadata
    const lastPayload = postedPayloads.at(-1)!;
    assert.equal(lastPayload.isAnonymous, true);
    assert.equal(lastPayload.userId, undefined);
    assert.equal(lastPayload.authorName, 'Anonymous Seeker');
    assert.equal(lastPayload.authorHandle, '@anonymous');
    assert.equal(lastPayload.authorAvatarUrl, undefined);
    assert.equal(lastPayload.authorAuthProvider, undefined);
    assert.equal(lastPayload.verified, false);

    // Listed client posts while still signed in as the author must not re-hydrate author identity onto anonymous post
    const listedPost = listFaithWallPosts().find(p => p.id === anonClientPost.id)!;
    assert.equal(listedPost.userId, undefined);
    assert.equal(listedPost.authorName, 'Anonymous Seeker');
    assert.equal(listedPost.authorHandle, '@anonymous');
    assert.equal(listedPost.authorAvatarUrl, undefined);
    assert.equal(listedPost.authorAuthProvider, undefined);
    assert.equal(listedPost.verified, false);

    // User's own portfolio must not expose their anonymous post
    const selfPortfolio = resolveUserProfilePortfolio('me');
    assert.equal(selfPortfolio.approvedPosts.some(p => p.id === anonClientPost.id), false);

    // 2. Server-side anonymous post creation & listing
    const anonServerPost = createServerWallPost(
      {
        type: 'good_deed',
        isAnonymous: true,
        surah: 18,
        ayah: 10,
        surahName: 'Al-Kahf',
        arabic: 'رَبَّنَآ ءَاتِنَا مِن لَّدُنكَ رَحْمَةً',
        translation: 'Our Lord, grant us from Yourself mercy.',
        reflection: 'Anonymous Friday Kahf pledge.',
        authorName: 'Dr. Identifiable Author',
        authorAvatarUrl: 'https://lh3.googleusercontent.com/a/identifiable-photo.png',
        userId: signedInSeeker.user.id,
      },
      signedInSeeker.user,
    );

    assert.equal(anonServerPost.isAnonymous, true);
    assert.equal(anonServerPost.userId, undefined);
    assert.equal(anonServerPost.authorName, 'Anonymous Seeker');
    assert.equal(anonServerPost.authorHandle, '@anonymous');
    assert.equal(anonServerPost.authorAvatarUrl, undefined);
    assert.equal(anonServerPost.authorAuthProvider, undefined);
    assert.equal(anonServerPost.verified, false);

    const serverListed = listServerWallPosts().find(p => p.id === anonServerPost.id)!;
    assert.equal(serverListed.userId, undefined);
    assert.equal(serverListed.authorName, 'Anonymous Seeker');
    assert.equal(serverListed.authorAvatarUrl, undefined);
    assert.equal(getServerUserProfile(signedInSeeker.user.id)?.posts.some(p => p.id === anonServerPost.id), false);

    // 3. UI Card rendering of an anonymous post (even if raw props contain leaked fields)
    await act(async () => {
      root.render(
        createElement(WallPostCard, {
          post: {
            ...anonClientPost,
            isAnonymous: true,
            userId: 'leaked-user-id',
            authorName: 'Dr. Identifiable Author',
            authorHandle: '@identifiable',
            authorAvatarUrl: 'https://lh3.googleusercontent.com/a/identifiable-photo.png',
            verified: true,
          },
          owned: true,
          onReact: () => {},
          onToggleSave: () => {},
          onAddReply: () => {},
          onExportCard: () => {},
          onCopyPost: () => {},
          onSaveEdit: () => {},
          onDeletePost: () => {},
          copied: false,
          exporting: false,
        }),
      );
    });

    const cardHtml = document.getElementById('root')!.innerHTML;
    assert.match(cardHtml, /Anonymous Seeker/);
    assert.match(cardHtml, /@anonymous/);
    assert.doesNotMatch(cardHtml, /Dr\. Identifiable Author/);
    assert.doesNotMatch(cardHtml, /@identifiable/);
    assert.doesNotMatch(cardHtml, /identifiable-photo\.png/);
    assert.doesNotMatch(cardHtml, /leaked-user-id/);
    assert.equal(document.querySelector('[data-post-author-link]'), null);
    assert.equal(document.querySelector('[data-wall-edit]'), null);
    assert.equal(document.querySelector('[data-wall-delete]'), null);
  } finally {
    writeSeekerSession(null);
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('GitHub deployment workflow pins Node >=22.13 matching package.json engines.node', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const appPkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    engines?: { node?: string };
  };
  assert.equal(appPkg.engines?.node, '>=22.13.0');
  assert.doesNotMatch(workflow, /node-version:\s*['"]?20['"]?/);
  const match = workflow.match(/node-version:\s*['"]?(\d+)\.(\d+)(?:\.(\d+))?['"]?/);
  assert.ok(match, 'deploy.yml must specify a semantic node-version');
  const major = Number(match[1]);
  const minor = Number(match[2]);
  assert.ok(major > 22 || (major === 22 && minor >= 13), `Expected Node >= 22.13, found ${match[0]}`);
});

test('server supports registration and sign-in via username, email, or phone number, and simple light login UI has zero guest buttons', async () => {
  resetSeekerStoreForTests();

  // 1. Register with email + username, then sign in by email AND by username
  const emailUser = registerSeekerAccount({
    name: 'Ahmad Khalid',
    username: 'ahmad_k',
    email: 'ahmad.k@dragondawwa.com',
    password: 'strong-pass-1',
  });
  assert.equal(emailUser.user.username, 'ahmad_k');
  assert.equal(emailUser.user.email, 'ahmad.k@dragondawwa.com');

  const loginByEmail = loginSeekerAccount({
    identifier: 'ahmad.k@dragondawwa.com',
    password: 'strong-pass-1',
  });
  assert.equal(loginByEmail.user.id, emailUser.user.id);

  const loginByUsername = loginSeekerAccount({
    identifier: 'ahmad_k',
    password: 'strong-pass-1',
  });
  assert.equal(loginByUsername.user.id, emailUser.user.id);

  // 2. Register with phone number, then sign in by formatted or E.164 phone number and by username
  const phoneUser = registerSeekerAccount({
    name: 'fatima_nur',
    phone: '+971 50 123 4567',
    password: 'phone-pass-2',
  });
  assert.equal(phoneUser.user.phone, '+971501234567');
  assert.equal(phoneUser.user.provider, 'phone');

  const loginByPhoneFormatted = loginSeekerAccount({
    identifier: '+971 50 123 4567',
    password: 'phone-pass-2',
  });
  assert.equal(loginByPhoneFormatted.user.id, phoneUser.user.id);

  const loginByPhoneDigits = loginSeekerAccount({
    identifier: '971501234567',
    password: 'phone-pass-2',
  });
  assert.equal(loginByPhoneDigits.user.id, phoneUser.user.id);

  const loginByPhoneUsername = loginSeekerAccount({
    identifier: 'fatima_nur',
    password: 'phone-pass-2',
  });
  assert.equal(loginByPhoneUsername.user.id, phoneUser.user.id);

  // Unknown user or wrong password must throw 401 and never auto-register on login
  assert.throws(
    () => loginSeekerAccount({ identifier: 'unknown_user_99', password: 'phone-pass-2' }),
    /No Seeker account found/i,
  );
  assert.throws(
    () => loginSeekerAccount({ identifier: '+971 50 123 4567', password: 'wrong-password' }),
    /Incorrect password/i,
  );

  // 3. Verify simple light login UI renders required data-testids and zero guest/quick buttons
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dragon.example/#/hub' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    Event: dom.window.Event, HashChangeEvent: dom.window.HashChangeEvent, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(document.getElementById('root')!);
  try {
    writeSeekerSession(null);
    await act(async () => {
      root.render(createElement(PublicHomeOverview));
    });
    const html = document.getElementById('root')!.innerHTML;
    assert.ok(document.querySelector('[data-testid="auth-identifier-input"]'), 'must render auth-identifier-input');
    assert.ok(document.querySelector('[data-testid="auth-password-input"]'), 'must render auth-password-input');
    assert.ok(document.querySelector('[data-testid="auth-submit-btn"]'), 'must render auth-submit-btn');
    assert.ok(document.querySelector('[data-testid="auth-google-btn"]'), 'must render auth-google-btn');
    assert.equal(document.querySelector('[data-quick-auth]'), null, 'must not render any quick/guest auth buttons');
    assert.equal(document.querySelector('[data-google-oauth-redirect-link]'), null, 'must not render raw redirect sign-in link');
    assert.doesNotMatch(html, /Instant Seeker Pass|Continue as Guest|Guest Seeker|Use Google Redirect Sign-In/i);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('Google OAuth2 popup accessToken verification works via postmessage without redirect_uri_mismatch', async () => {
  resetSeekerStoreForTests();
  const prevClientId = process.env.GOOGLE_OIDC_CLIENT_ID;
  process.env.GOOGLE_OIDC_CLIENT_ID = '677673398182-ip1vn7a8qfdiisg3icu78ekktgc2r3pa.apps.googleusercontent.com';

  try {
    const mockGoogleFetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('oauth2.googleapis.com/tokeninfo')) {
        return new Response(
          JSON.stringify({
            aud: '677673398182-ip1vn7a8qfdiisg3icu78ekktgc2r3pa.apps.googleusercontent.com',
            sub: 'google-oauth2-sub-999',
            email: 'popup.seeker@dragondawwa.com',
            email_verified: 'true',
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      assert.equal(url, 'https://www.googleapis.com/oauth2/v3/userinfo');
      return new Response(
        JSON.stringify({
          sub: 'google-oauth2-sub-999',
          email: 'popup.seeker@dragondawwa.com',
          email_verified: true,
          name: 'Popup Google Seeker',
          picture: 'https://lh3.googleusercontent.com/a/popup-avatar.png',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const claims = await verifyGoogleAccessToken('ya29.valid-popup-access-token', undefined, mockGoogleFetch);
    assert.equal(claims.sub, 'google-oauth2-sub-999');
    assert.equal(claims.email, 'popup.seeker@dragondawwa.com');
    assert.equal(claims.name, 'Popup Google Seeker');

    const result = await authenticateGoogleCredential({ accessToken: 'ya29.valid-popup-access-token' }, mockGoogleFetch);
    assert.equal(result.user.email, 'popup.seeker@dragondawwa.com');
    assert.equal(result.user.provider, 'google');
    assert.equal(result.user.authProvider, 'google');
    assert.equal(result.user.verified, true);

    // Client signInWithGoogleAccessToken sends accessToken to /api/auth/google/credential and persists session
    const originalFetch = globalThis.fetch;
    try {
      let sentBody: Record<string, unknown> = {};
      globalThis.fetch = async (url, init) => {
        assert.equal(String(url), '/api/auth/google/credential');
        sentBody = JSON.parse(String(init?.body || '{}'));
        return new Response(JSON.stringify({ ok: true, token: result.token, user: result.user }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };
      const session = await signInWithGoogleAccessToken('ya29.valid-popup-access-token');
      assert.equal(sentBody.accessToken, 'ya29.valid-popup-access-token');
      assert.equal(session.user.email, 'popup.seeker@dragondawwa.com');
      assert.equal(getSession()?.user.email, 'popup.seeker@dragondawwa.com');
    } finally {
      writeSeekerSession(null);
      globalThis.fetch = originalFetch;
    }
  } finally {
    if (prevClientId === undefined) delete process.env.GOOGLE_OIDC_CLIENT_ID;
    else process.env.GOOGLE_OIDC_CLIENT_ID = prevClientId;
  }
});

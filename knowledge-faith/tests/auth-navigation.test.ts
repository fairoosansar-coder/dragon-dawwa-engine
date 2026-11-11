import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  buildGoogleOAuthRedirectUrl, closeSeekerAuthModal, consumePendingRoute,
  loginOrRegisterSeeker, openSeekerAuthModal, PENDING_ROUTE_STORAGE_KEY,
  readPendingRoute, readSeekerSession, requestAuthenticatedNavigation,
  setPendingRoute, signInWithGoogleCredential, useSeekerAuth, writeSeekerSession,
} from '../src/lib/seekerAuth.ts';

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
    for (const method of ['google', 'quick', 'email'] as const) {
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
            else await loginOrRegisterSeeker({ mode: method === 'quick' ? 'quick' : 'login',
              provider: method === 'quick' ? 'guest' : 'email', email: user.email, password: 'test-password' });
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

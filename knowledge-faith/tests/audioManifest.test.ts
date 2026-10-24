import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { MANIFEST_CACHE_MAX, MANIFEST_INFLIGHT_MAX, rememberBounded } from '../src/shared/quranenc.ts';
import {
  audioManifestCacheSize,
  audioManifestEdition,
  loadAudioManifest,
  resetAudioManifestCacheForTests,
} from '../src/server/quranenc.ts';
import { UpstreamError } from '../src/server/http.ts';

const originalFetch = globalThis.fetch;

function jsonResponse(url: string, status: number, body: unknown): Response {
  const response = new Response(status === 200 ? JSON.stringify(body) : 'missing', {
    status,
    headers: { 'content-type': 'application/json' },
  });
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

function manifestBody(key: string) {
  return {
    translation: key,
    base_url: `https://d.quranenc.com/data/audio/${key}/`,
    files: ['001001.mp3'],
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetAudioManifestCacheForTests();
});

describe('audio manifest gate', () => {
  it('does not fetch or cache unique invalid keys', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      throw new Error('invalid edition keys must not reach QuranEnc');
    };
    const before = audioManifestCacheSize();
    for (let i = 0; i < 40; i += 1) {
      await assert.rejects(() => loadAudioManifest(`not_listed_${i}`), (err: unknown) => {
        assert.ok(err instanceof UpstreamError);
        assert.equal(err.status, 400);
        return true;
      });
    }
    assert.throws(() => audioManifestEdition('a'.repeat(65)), (err: unknown) => err instanceof UpstreamError);
    assert.throws(() => audioManifestEdition('../english_rwwad'), (err: unknown) => err instanceof UpstreamError);
    assert.equal(calls, 0);
    assert.equal(audioManifestCacheSize(), before);
  });

  it('deduplicates one approved key and caps distinct in-flight fetches', async () => {
    let calls = 0;
    let active = 0;
    let peak = 0;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      calls += 1;
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 40));
      active -= 1;
      const key = url.split('/').at(-2) ?? '';
      return jsonResponse(url, 200, manifestBody(key));
    };
    const shared = await Promise.all([1, 2, 3, 4, 5].map(() => loadAudioManifest('english_rwwad')));
    assert.equal(calls, 1);
    assert.equal(shared[0]?.translation, 'english_rwwad');
    assert.equal(shared[0]?.files.has('001001.mp3'), true);

    resetAudioManifestCacheForTests();
    calls = 0;
    peak = 0;
    const keys = ['audio_aa', 'audio_bb', 'audio_cc', 'audio_dd'];
    const catalogue = new Set(keys);
    const loaded = await Promise.all(keys.map(key => loadAudioManifest(key, catalogue)));
    assert.equal(calls, keys.length);
    assert.ok(peak <= MANIFEST_INFLIGHT_MAX);
    assert.equal(loaded.filter(item => item?.count === 1).length, keys.length);
  });

  it('keeps negative entries inside the cache ceiling', async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => jsonResponse(String(input), 404, null);
    const keys = Array.from({ length: MANIFEST_CACHE_MAX + 4 }, (_, index) => `missing_audio_${index}`);
    const catalogue = new Set(keys);
    const results = await Promise.all(keys.map(key => loadAudioManifest(key, catalogue)));
    assert.equal(results.every(item => item === null), true);
    assert.ok(audioManifestCacheSize() <= MANIFEST_CACHE_MAX);
    assert.ok(audioManifestCacheSize() > 0);
  });

  it('drops expired manifest entries before counting size', () => {
    const store = new Map<string, { value: { absent: true }; expires: number }>();
    const now = 1_000;
    for (let i = 0; i < MANIFEST_CACHE_MAX + 3; i += 1) {
      rememberBounded(store, `old_${i}`, { absent: true }, now, 5, MANIFEST_CACHE_MAX);
    }
    assert.equal(store.size, MANIFEST_CACHE_MAX);
    assert.equal(store.has('old_0'), false);
    rememberBounded(store, 'fresh', { absent: true }, now + 5, 5, MANIFEST_CACHE_MAX);
    assert.equal(store.size, 1);
    assert.equal(store.has('fresh'), true);
  });

  it('still loads a verified edition manifest for playback', async () => {
    let calls = 0;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      return originalFetch(input, init);
    };
    const first = await loadAudioManifest('english_rwwad');
    assert.equal(first?.translation, 'english_rwwad');
    assert.equal(first?.files.has('001001.mp3'), true);
    assert.ok((first?.count ?? 0) > 1000);
    const after = calls;
    const second = await loadAudioManifest('english_rwwad');
    assert.equal(second?.count, first?.count);
    assert.equal(calls, after);
  });
});

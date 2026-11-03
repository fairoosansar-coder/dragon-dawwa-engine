import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ummahStudyMiddleware } from '../src/server/ummahStudy.ts';
async function request(url: string) {
  let body = ''; const res = { statusCode: 200, setHeader() {}, end(v: string) { body = v; } };
  await ummahStudyMiddleware({ url, method: 'GET' } as any, res as any, () => {});
  return { status: res.statusCode, body: JSON.parse(body) };
}
test('study source validation and cache', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = (async (url: URL) => { calls++; assert.equal(url.pathname, '/api/quran/words/5/114'); return { ok: true, json: async () => ({ success: true, data: { verse_key: '5:114', words: [{ position: 1, type: 'word', arabic: 'قَالَ', translation: 'Said' }] } }) }; }) as any;
  try {
    assert.equal((await request('/api/quran-study/words/999/1')).status, 400);
    assert.equal((await request('/api/quran-study/unknown/5/114')).status, 400);
    assert.equal(calls, 0);
    const result = await request('/api/quran-study/words/5/114');
    assert.equal(result.status, 200); assert.equal(result.body.words[0].translation, 'Said');
    await request('/api/quran-study/words/5/114'); assert.equal(calls, 1);
  } finally { global.fetch = original; }
});
test('rejects wrong verse and wrong tafsir edition', async () => {
  const original = global.fetch;
  try {
    for (const data of [
      { verse_key: '5:115', tafsir: { key: 'ibn_kathir', text: 'Wrong verse' } },
      { verse_key: '5:114', tafsir: { key: 'maarif', text: 'Wrong edition' } },
      { verse_key: '5:114', tafsir: { key: 'ibn_kathir', text: '' } },
    ]) {
      global.fetch = (async () => ({ ok: true, json: async () => ({ success: true, data }) })) as any;
      assert.equal((await request('/api/quran-study/ibn_kathir/5/114')).status, 502);
    }
    global.fetch = (async () => ({ ok: true, json: async () => ({ success: true, data: { verse_key: '5:114', tafsir: { key: 'ibn_kathir', text: 'Source text', author: 'Named author' } } }) })) as any;
    assert.equal((await request('/api/quran-study/ibn_kathir/5/114')).body.tafsir.text, 'Source text');
  } finally { global.fetch = original; }
});
test('upstream outage fails closed and redacts details', async () => {
  const original = global.fetch;
  global.fetch = (async () => { throw new Error('private credential'); }) as any;
  try { const result = await request('/api/quran-study/words/2/1'); assert.equal(result.status, 502); assert.ok(!JSON.stringify(result.body).includes('private')); } finally { global.fetch = original; }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ummahQuranMiddleware } from '../src/server/ummahQuran.ts';
async function request(url: string) {
  let body = ''; const res = { statusCode: 200, setHeader() {}, end(v: string) { body = v; } };
  await ummahQuranMiddleware({ url, method: 'GET' } as any, res as any, () => {});
  return { status: res.statusCode, body: JSON.parse(body) };
}
test('rejects invalid references without an upstream call', async () => {
  assert.equal((await request('/api/quran-audio/999/1')).status, 400);
});
test('keeps only HTTPS recordings from approved delivery host', async () => {
  const original = global.fetch;
  global.fetch = (async () => ({ ok: true, json: async () => ({ success: true, data: { verse_key: '1:1', reciters: [{ id: 1, audio_url: 'https://everyayah.com/data/test.mp3' }, { id: 2, audio_url: 'https://example.com/test.mp3' }, { id: 3, audio_url: null }] } }) })) as any;
  try { const result = await request('/api/quran-audio/1/1'); assert.equal(result.status, 200); assert.equal(result.body.reciters.length, 1); } finally { global.fetch = original; }
});
test('upstream failure returns an error without exposing credentials', async () => {
  const original = global.fetch;
  global.fetch = (async () => { throw new Error('secret upstream URL'); }) as any;
  try { const result = await request('/api/quran-audio/2/1'); assert.equal(result.status, 502); assert.ok(!JSON.stringify(result.body).includes('secret')); } finally { global.fetch = original; }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { mediaConcurrencyLimiter, readMedia } from '../src/server/media.ts';

test('media capacity stays reserved until finish/close and releases exactly once', () => {
  const limiter = mediaConcurrencyLimiter(1);
  const response = () => Object.assign(new EventEmitter(), { code: 0, setHeader() {}, status(code: number) { this.code = code; return this; }, json() {} });
  const first = response();
  let accepted = 0;
  const run = (res: ReturnType<typeof response>) => limiter({} as any, res as any, () => { accepted++; });
  run(first);
  const rejected = response(); run(rejected); assert.equal(rejected.code, 429);
  first.emit('finish'); first.emit('close');
  const second = response(); run(second);
  const third = response(); run(third); assert.equal(third.code, 429);
  assert.equal(accepted, 2);
  second.emit('close'); run(response()); assert.equal(accepted, 3);
});

test('media refuses oversized chunked bodies and cancels the upstream stream', async () => {
  const original = globalThis.fetch;
  let cancelled = false;
  const url = new URL('https://d1.islamhouse.com/data/test.pdf');
  globalThis.fetch = async () => {
    const response = new Response(new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
      cancel() { cancelled = true; },
    }));
    Object.defineProperty(response, 'url', { value: url.href });
    return response;
  };
  try {
    await assert.rejects(readMedia(url), /larger than/);
    assert.equal(cancelled, true);
  } finally { globalThis.fetch = original; }
});

test('media preserves valid file bytes and content type', async () => {
  const original = globalThis.fetch;
  const url = new URL('https://d1.islamhouse.com/data/test.pdf');
  globalThis.fetch = async () => {
    const response = new Response('pdf-test', { headers: { 'content-type': 'application/pdf' } });
    Object.defineProperty(response, 'url', { value: url.href });
    return response;
  };
  try {
    const result = await readMedia(url);
    assert.equal(result.body.toString(), 'pdf-test');
    assert.equal(result.type, 'application/pdf');
  } finally { globalThis.fetch = original; }
});

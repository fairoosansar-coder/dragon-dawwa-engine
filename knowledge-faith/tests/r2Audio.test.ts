import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { GetObjectCommand, type GetObjectCommandOutput } from '@aws-sdk/client-s3';
import type { Response } from 'express';
import { UpstreamError } from '../src/server/http.ts';
import { byteRangeHeader, streamEpisodeAudio, type R2ObjectClient } from '../src/server/r2Audio.ts';

function audioResponse() {
  const chunks: Buffer[] = [];
  let writes = 0;
  const headers: Record<string, string> = {};
  let statusCode = 0;
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      writes += 1;
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  const res = Object.assign(writable, {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string | number) {
      headers[name.toLowerCase()] = String(value);
    },
    headersSent: false,
  });
  return {
    res: res as unknown as Response,
    headers,
    status: () => statusCode,
    writes: () => writes,
    body: () => Buffer.concat(chunks).toString('utf8'),
  };
}

function chunked(parts: string[]): Readable {
  const pending = parts.map(part => Buffer.from(part));
  return new Readable({
    read() {
      this.push(pending.shift() ?? null);
    },
  });
}

test('byte range header keeps a single open range', () => {
  assert.equal(byteRangeHeader('bytes=0-'), 'bytes=0-');
  assert.equal(byteRangeHeader(' bytes=100-199 '), 'bytes=100-199');
  assert.equal(byteRangeHeader(undefined), null);
  assert.throws(() => byteRangeHeader('bytes=0-1,2-3'), (err: unknown) => err instanceof UpstreamError && err.status === 416);
});

test('ranged episode audio is piped as 206 without buffering the object', async () => {
  const calls: GetObjectCommand[] = [];
  const client: R2ObjectClient = {
    async send(command) {
      calls.push(command);
      const output: GetObjectCommandOutput = {
        $metadata: {},
        ContentLength: 6,
        ContentRange: 'bytes 0-5/24000',
        ContentType: 'application/octet-stream',
        Body: chunked(['abc', 'def']) as GetObjectCommandOutput['Body'],
      };
      return output;
    },
  };
  const sink = audioResponse();
  await streamEpisodeAudio(sink.res, 'ep-1', 'bytes=0-', client, 'dawwa-audio');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input.Bucket, 'dawwa-audio');
  assert.equal(calls[0]?.input.Key, 'episodes/ep-1.mp3');
  assert.equal(calls[0]?.input.Range, 'bytes=0-');
  assert.equal(sink.status(), 206);
  assert.equal(sink.headers['content-range'], 'bytes 0-5/24000');
  assert.equal(sink.headers['accept-ranges'], 'bytes');
  assert.equal(sink.headers['content-length'], '6');
  assert.equal(sink.headers['content-type'], 'audio/mpeg');
  assert.equal(sink.writes(), 2);
  assert.equal(sink.body(), 'abcdef');
});

test('a request without Range streams the object as 200', async () => {
  let range: string | undefined = 'unset';
  const client: R2ObjectClient = {
    async send(command) {
      range = command.input.Range;
      return { $metadata: {}, ContentLength: 3, Body: chunked(['mp3']) as GetObjectCommandOutput['Body'] };
    },
  };
  const sink = audioResponse();
  await streamEpisodeAudio(sink.res, 'episode_2', undefined, client, 'dawwa-audio');
  assert.equal(range, undefined);
  assert.equal(sink.status(), 200);
  assert.equal(sink.headers['accept-ranges'], 'bytes');
  assert.equal(sink.headers['content-length'], '3');
  assert.equal(sink.headers['content-type'], 'audio/mpeg');
  assert.equal(sink.headers['content-range'], undefined);
  assert.equal(sink.body(), 'mp3');
});

test('an invalid episode id never calls R2', async () => {
  let called = false;
  const client: R2ObjectClient = {
    async send() {
      called = true;
      return { $metadata: {} };
    },
  };
  await assert.rejects(() => streamEpisodeAudio(audioResponse().res, '../secret', 'bytes=0-', client, 'dawwa-audio'), (err: unknown) => {
    return err instanceof UpstreamError && err.status === 404;
  });
  assert.equal(called, false);
});

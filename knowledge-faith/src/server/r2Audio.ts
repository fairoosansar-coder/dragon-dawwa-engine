import { GetObjectCommand, S3Client, type GetObjectCommandOutput } from '@aws-sdk/client-s3';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { UpstreamError } from './http.ts';

const EPISODE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

export interface R2ObjectClient {
  send(command: GetObjectCommand): Promise<GetObjectCommandOutput>;
}

/** One byte range, preserved for the R2 GetObject `Range` parameter. */
export function byteRangeHeader(header: string | string[] | undefined): string | null {
  if (header == null || header === '') return null;
  if (Array.isArray(header)) throw new UpstreamError('Only one byte range is supported.', 416);
  const value = header.trim();
  const match = SINGLE_RANGE.exec(value);
  if (!match) throw new UpstreamError('The Range header must be a single byte range.', 416);
  const start = match[1] ?? '';
  const end = match[2] ?? '';
  if (!start && !end) throw new UpstreamError('The Range header must be a single byte range.', 416);
  if (start && end && Number(end) < Number(start)) throw new UpstreamError('The Range header must be a single byte range.', 416);
  return `bytes=${start}-${end}`;
}

export function episodeObjectKey(id: string): string {
  if (!EPISODE_ID.test(id)) throw new UpstreamError('Unknown episode', 404);
  const prefix = (process.env.R2_AUDIO_PREFIX ?? 'episodes/').replace(/^\/+/, '').replaceAll('..', '');
  return `${prefix}${id}.mp3`;
}

let r2Client: S3Client | undefined;

export function createR2Client(): S3Client {
  if (r2Client) return r2Client;
  const endpoint =
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? '';
  if (!endpoint || !accessKeyId || !secretAccessKey || !process.env.R2_BUCKET) {
    throw new UpstreamError('Audio streaming is not configured on this server.', 503);
  }
  r2Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return r2Client;
}

function readableBody(body: GetObjectCommandOutput['Body']): Readable {
  if (!body) throw new UpstreamError('Episode audio could not be streamed.', 502);
  // Node's S3 body is a readable stream. Pipe it; never call the byte-array collector.
  if (typeof (body as { pipe?: unknown }).pipe === 'function') return body as unknown as Readable;
  if (typeof (body as { getReader?: unknown }).getReader === 'function') {
    return Readable.fromWeb(body as unknown as Parameters<typeof Readable.fromWeb>[0]);
  }
  throw new UpstreamError('Episode audio could not be streamed.', 502);
}

function storageFailure(err: unknown): UpstreamError {
  if (err instanceof UpstreamError) return err;
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name) : '';
  const statusCode =
    err && typeof err === 'object' && '$metadata' in err
      ? Number((err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode)
      : 0;
  if (name === 'NoSuchKey' || name === 'NotFound' || statusCode === 404) return new UpstreamError('Episode audio was not found.', 404);
  if (name === 'InvalidRange' || statusCode === 416) return new UpstreamError('That audio range cannot be read.', 416);
  return new UpstreamError('Episode audio could not be streamed.', 502);
}

/**
 * Proxy one R2 object to the client.
 * A Range header is forwarded on GetObject and answered with 206.
 * The SDK body is piped through; it is never buffered into a single file allocation.
 */
export async function streamEpisodeAudio(
  res: Response,
  episodeId: string,
  rangeHeader: string | string[] | undefined,
  client: R2ObjectClient = createR2Client(),
  bucket = process.env.R2_BUCKET ?? '',
): Promise<void> {
  if (!bucket) throw new UpstreamError('Audio streaming is not configured on this server.', 503);
  const range = byteRangeHeader(rangeHeader);
  let object: GetObjectCommandOutput;
  try {
    object = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: episodeObjectKey(episodeId),
        ...(range ? { Range: range } : {}),
      }),
    );
  } catch (err) {
    throw storageFailure(err);
  }

  const body = readableBody(object.Body);
  const chunkLength = object.ContentLength;
  if (range) {
    if (chunkLength == null || !object.ContentRange) {
      body.destroy();
      throw new UpstreamError('Episode audio could not be streamed.', 502);
    }
    res.status(206);
    res.setHeader('Content-Range', object.ContentRange);
    res.setHeader('Content-Length', chunkLength);
  } else if (chunkLength != null) {
    res.status(200);
    res.setHeader('Content-Length', chunkLength);
  } else {
    res.status(200);
  }
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'private, no-transform');

  try {
    await pipeline(body, res);
  } catch (err) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    body.destroy();
    throw storageFailure(err);
  }
}

/**
 * Generate missing episode MP3s, store them in R2, and set audio_url.
 *
 * From the knowledge-faith directory:
 *   npx tsx scripts/backfill_audio.ts
 *   npx tsx scripts/backfill_audio.ts --dry-run
 *   npx tsx scripts/backfill_audio.ts --id <episode-id> --limit 5
 *
 * `npm start` already runs this package through tsx. The package is ESM, so
 * `npx ts-node scripts/backfill_audio.ts` cannot load the `.ts` imports.
 * `npm run backfill-audio` calls the same file.
 *
 * Finished statuses are complete, completed, done, and verified. The live
 * episodes table uses verified. A row is a target when that status is set and
 * either audio_url is empty or the R2 object is absent. Speech comes from
 * podcast_script, or from script / data JSON when that column is absent.
 * Each TTS call returns WAV. Those clips are stitched as PCM and encoded as
 * one MP3 at episodes/{id}.mp3. Objects under other bucket prefixes are never
 * listed, moved, or deleted.
 */
import { HeadObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { Mp3Encoder } from '@breezystack/lamejs';
import { pathToFileURL } from 'node:url';
import { withoutVanakkam } from '../src/engine/utils/tamilGreeting.ts';
import { createR2Client, episodeObjectKey } from '../src/server/r2Audio.ts';
import { toLang, type Lang } from '../src/shared/sources.ts';

const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FINISHED = new Set(['complete', 'completed', 'done', 'verified']);
const TARGET_RATE = 24000;
const MP3_KBPS = 96;
const PAGE = 1000;

export interface EpisodeStoreConfig {
  url: string;
  apiKey: string;
  table: string;
}

export interface SpeechClip {
  audioBase64: string;
  mimeType: string;
}

export interface PodcastLine {
  speaker: string;
  text: string;
}

export interface AudioStorage {
  exists(key: string): Promise<boolean>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
}

export interface BackfillReport {
  examined: number;
  planned: number;
  uploaded: number;
  linked: number;
  skipped: number;
  failed: { id: string; reason: string }[];
}

export interface BackfillOptions {
  dryRun?: boolean;
  limit?: number;
  ids?: string[];
  config?: EpisodeStoreConfig | null;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
  storage?: AudioStorage;
  synthesize?: (text: string, speaker: string, voice: string | undefined, lang: Lang) => Promise<SpeechClip>;
  log?: (message: string) => void;
}

interface EpisodeRow {
  id: string;
  status: string;
  audioUrl: string | null;
  script: string;
  lang: Lang;
}

const HELP = `Usage: npx tsx scripts/backfill_audio.ts [--dry-run] [--limit N] [--id EPISODE_ID]

Reads finished episodes from Supabase, synthesizes podcast_script with the
server TTS, uploads episodes/{id}.mp3 to R2, and sets audio_url to
/api/episodes/{id}/stream.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function episodeStoreConfig(env: NodeJS.ProcessEnv = process.env): EpisodeStoreConfig | null {
  const url = env.SUPABASE_URL?.replace(/\/$/, '') ?? '';
  const apiKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  const table = (env.SUPABASE_EPISODE_TABLE || 'episodes').trim();
  if (!url || !apiKey || !TABLE_NAME.test(table)) return null;
  return { url, apiKey, table };
}

export function isFinishedStatus(status: unknown): boolean {
  return typeof status === 'string' && FINISHED.has(status.trim().toLowerCase());
}

export function streamPath(id: string): string {
  return `/api/episodes/${id}/stream`;
}

function asScriptText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!Array.isArray(value)) return '';
  return value
    .map(item => {
      if (typeof item === 'string') return item.trim();
      if (!isRecord(item) || typeof item.text !== 'string' || !item.text.trim()) return '';
      const speaker = typeof item.speaker === 'string' && item.speaker.trim() ? item.speaker.trim() : 'Narrator';
      return `${speaker}: ${item.text.trim()}`;
    })
    .filter(Boolean)
    .join('\n');
}

function nestedPodcastScript(value: unknown): string {
  let current = value;
  if (typeof current === 'string') {
    const trimmed = current.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;
    try {
      current = JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }
  if (!isRecord(current)) return asScriptText(current);
  const direct = asScriptText(current.podcast_script);
  if (direct) return direct;
  if (isRecord(current.agent_6_synthesis)) {
    const spoken = asScriptText(current.agent_6_synthesis.podcast_script);
    if (spoken) return spoken;
  }
  if (isRecord(current.analysis)) return nestedPodcastScript(current.analysis);
  return asScriptText(current.lines);
}

/** Dialogue text from podcast_script, script, or the analysis JSON stored on the row. */
export function podcastScriptFromRow(row: Record<string, unknown>): string {
  if (typeof row.podcast_script === 'string' && row.podcast_script.trim()) return row.podcast_script;
  if (typeof row.script === 'string' && row.script.trim()) return row.script;
  for (const source of [row.script, row.data, row.analysis, row]) {
    const text = nestedPodcastScript(source);
    if (text) return text;
  }
  return '';
}

function speechAfterLabel(line: string, pattern: RegExp): string {
  return line.replace(pattern, '').trim();
}

/**
 * Speaker lines, in order. Audio-cue lines are omitted. Unlabeled text is Narrator.
 * The prefixes match the studio roundtable player.
 */
export function parsePodcastLines(script: string): PodcastLine[] {
  const spoken = withoutVanakkam(script);
  const lines: PodcastLine[] = [];
  for (const raw of spoken.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\[(AUDIO CUE|FX|CUE):/i.test(line)) continue;
    let speaker = 'Narrator';
    let text = line;
    const upper = line.toUpperCase();
    if (
      upper.startsWith('BROTHER FEROZ (HOST):') ||
      upper.startsWith('BROTHER FEROZ:') ||
      upper.startsWith('FEROZ:') ||
      upper.startsWith('ANCHOR:') ||
      upper.startsWith('HOST (BROTHER FEROZ):') ||
      upper.startsWith('HOST:') ||
      upper.startsWith('HOST (') ||
      upper.startsWith('HOST 2:') ||
      upper.startsWith('HOST 2 (')
    ) {
      speaker = 'Host';
      text = speechAfterLabel(line, /^(BROTHER\s+FEROZ(\s*\([^)]*\))?|FEROZ|ANCHOR|HOST\s*2(\s*\([^)]*\))?|HOST(\s*\([^)]*\))?):\s*/i);
    } else if (
      upper.startsWith('DR. TARIQ:') ||
      upper.startsWith('DR. TARIQ AL-MANSOOR:') ||
      upper.startsWith('TARIQ:') ||
      upper.startsWith('HOST 1 (DR. TARIQ):') ||
      upper.startsWith('HOST 1:')
    ) {
      speaker = 'Dr. Tariq al-Mansoor';
      text = speechAfterLabel(line, /^(HOST\s*1(\s*\([^)]*\))?|(DR\.\s*)?TARIQ(\s+AL-MANSOOR)?):\s*/i);
    } else if (upper.startsWith('DR. LAYLA:') || upper.startsWith('DR. LAYLA AL-QASIMI:') || upper.startsWith('LAYLA:')) {
      speaker = 'Dr. Layla al-Qasimi';
      text = speechAfterLabel(line, /^((DR\.\s*)?LAYLA(\s+AL-QASIMI)?):\s*/i);
    } else if (upper.startsWith('SHEIKH IMRAN:') || upper.startsWith('SHEIKH IMRAN AL-HASANI:') || upper.startsWith('IMRAN:')) {
      speaker = 'Sheikh Imran al-Hasani';
      text = speechAfterLabel(line, /^((SHEIKH\s*)?IMRAN(\s+AL-HASANI)?):\s*/i);
    } else if (upper.startsWith('DR. ZAINAB:') || upper.startsWith('DR. ZAINAB AL-MUBARAK:') || upper.startsWith('ZAINAB:')) {
      speaker = 'Dr. Zainab al-Mubarak';
      text = speechAfterLabel(line, /^((DR\.\s*)?ZAINAB(\s+AL-MUBARAK)?):\s*/i);
    } else if (upper.startsWith('SHEIKH YUSUF:') || upper.startsWith('SHEIKH YUSUF AL-AZHARI:') || upper.startsWith('YUSUF:')) {
      speaker = 'Sheikh Yusuf al-Azhari';
      text = speechAfterLabel(line, /^((SHEIKH\s*)?YUSUF(\s+AL-AZHARI)?):\s*/i);
    } else if (
      upper.startsWith('DR. AMINA:') ||
      upper.startsWith('DR. AMINA AL-KINDI:') ||
      upper.startsWith('AMINA:') ||
      upper.startsWith('AGENT 7:')
    ) {
      speaker = 'Dr. Amina al-Kindi';
      text = speechAfterLabel(line, /^(AGENT\s*7|(DR\.\s*)?AMINA(\s+AL-KINDI)?):\s*/i);
    }
    text = text.replace(/\[[^\]]*\]/g, '').trim();
    if (!text) continue;
    lines.push({ speaker, text });
  }
  return lines;
}

export function parseArgs(argv: string[]): { dryRun: boolean; limit?: number; ids: string[]; help: boolean } {
  let dryRun = false;
  let help = false;
  let limit: number | undefined;
  const ids: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--limit') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error('--limit must be a positive integer.');
      limit = value;
    } else if (arg === '--id') {
      const id = argv[++i];
      if (!id) throw new Error('--id needs an episode id.');
      ids.push(id);
    } else {
      throw new Error(`Unknown argument ${arg}. Run with --help.`);
    }
  }
  return { dryRun, limit, ids, help };
}

function readInt16(pcm: Buffer): Int16Array {
  const samples = new Int16Array(Math.floor(pcm.length / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2);
  return samples;
}

function writeInt16(samples: Int16Array): Buffer {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) pcm.writeInt16LE(samples[i] ?? 0, i * 2);
  return pcm;
}

function mono16(pcm: Buffer, channels: number): Buffer {
  if (channels === 1) return pcm.subarray(0, pcm.length - (pcm.length % 2));
  const frames = Math.floor(pcm.length / (2 * channels));
  const samples = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) sum += pcm.readInt16LE((i * channels + channel) * 2);
    samples[i] = Math.max(-32768, Math.min(32767, Math.round(sum / channels)));
  }
  return writeInt16(samples);
}

export function resampleMono16(pcm: Buffer, fromRate: number, toRate: number): Buffer {
  const input = readInt16(pcm);
  if (fromRate === toRate) return writeInt16(input);
  if (fromRate < 1 || toRate < 1 || input.length === 0) return Buffer.alloc(0);
  const outLength = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const output = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const position = (i * fromRate) / toRate;
    const index = Math.floor(position);
    const fraction = position - index;
    const left = input[Math.min(index, input.length - 1)] ?? 0;
    const right = input[Math.min(index + 1, input.length - 1)] ?? left;
    output[i] = Math.round(left + (right - left) * fraction);
  }
  return writeInt16(output);
}

/** PCM payload from a WAV container. Extra chunks before the data chunk are skipped. */
export function wavToMonoPcm(wav: Buffer): { pcm: Buffer; sampleRate: number } {
  if (wav.length < 12 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('TTS audio is not a WAV file.');
  }
  let offset = 12;
  let sampleRate = TARGET_RATE;
  let channels = 1;
  let bitsPerSample = 16;
  let pcm: Buffer | null = null;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > wav.length) break;
    if (id === 'fmt ' && size >= 16) {
      const format = wav.readUInt16LE(start);
      if (format !== 1) throw new Error('Only uncompressed WAV speech can be stitched.');
      channels = wav.readUInt16LE(start + 2);
      sampleRate = wav.readUInt32LE(start + 4);
      bitsPerSample = wav.readUInt16LE(start + 14);
    } else if (id === 'data') {
      pcm = wav.subarray(start, start + size);
      break;
    }
    offset = start + size + (size % 2);
  }
  if (!pcm) throw new Error('WAV data chunk was missing.');
  if (bitsPerSample !== 16) throw new Error(`WAV speech is ${bitsPerSample}-bit. Backfill expects 16-bit PCM.`);
  if (channels < 1) throw new Error('WAV speech has no channels.');
  return { pcm: mono16(Buffer.from(pcm), channels), sampleRate };
}

export function pcmFromTts(clip: SpeechClip): { pcm: Buffer; sampleRate: number } {
  const bytes = Buffer.from(clip.audioBase64, 'base64');
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF') return wavToMonoPcm(bytes);
  const rate = Number(/rate=(\d+)/i.exec(clip.mimeType)?.[1] ?? TARGET_RATE);
  return { pcm: bytes.subarray(0, bytes.length - (bytes.length % 2)), sampleRate: rate };
}

/** One PCM buffer at 24 kHz, in script order. */
export function stitchClips(clips: SpeechClip[]): Buffer {
  const parts = clips.map(clip => {
    const decoded = pcmFromTts(clip);
    return resampleMono16(decoded.pcm, decoded.sampleRate, TARGET_RATE);
  });
  return Buffer.concat(parts);
}

/** Encode mono 16-bit PCM as one MPEG audio buffer. */
export function encodeMp3(pcm: Buffer, sampleRate = TARGET_RATE): Buffer {
  if (pcm.length < 2) throw new Error('There is no speech to encode.');
  const samples = readInt16(pcm);
  const encoder = new Mp3Encoder(1, sampleRate, MP3_KBPS);
  const frames: Uint8Array[] = [];
  const block = 1152;
  for (let i = 0; i < samples.length; i += block) {
    const frame = encoder.encodeBuffer(samples.subarray(i, i + block));
    if (frame.length > 0) frames.push(frame);
  }
  const end = encoder.flush();
  if (end.length > 0) frames.push(end);
  const total = frames.reduce((sum, frame) => sum + frame.length, 0);
  if (total === 0) throw new Error('MP3 encoder produced no audio.');
  const mp3 = Buffer.alloc(total);
  let offset = 0;
  for (const frame of frames) {
    mp3.set(frame, offset);
    offset += frame.length;
  }
  return mp3;
}

export function clipsToMp3(clips: SpeechClip[]): Buffer {
  return encodeMp3(stitchClips(clips), TARGET_RATE);
}

function storageStatus(err: unknown): number {
  if (!err || typeof err !== 'object' || !('$metadata' in err)) return 0;
  return Number((err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode) || 0;
}

function storageName(err: unknown): string {
  if (!err || typeof err !== 'object' || !('name' in err)) return '';
  return String((err as { name?: unknown }).name);
}

function missingObject(err: unknown): boolean {
  const name = storageName(err);
  const status = storageStatus(err);
  return name === 'NoSuchKey' || name === 'NotFound' || status === 404;
}

export function storageAccessError(err: unknown, action: 'read' | 'write'): Error {
  const name = storageName(err);
  const status = storageStatus(err);
  if (name === 'AccessDenied' || status === 403) {
    const verb = action === 'write' ? 'upload' : 'read';
      return new Error(
        `R2 refused to ${verb} episode audio. Use an API token with Object Read and Object Write on this bucket.`,
      );
  }
  const detail = err instanceof Error ? err.message : String(err);
  return new Error(action === 'write' ? `R2 upload failed: ${detail}` : `R2 lookup failed: ${detail}`);
}

export function createR2AudioStorage(client: S3Client = createR2Client(), bucket = process.env.R2_BUCKET ?? ''): AudioStorage {
  if (!bucket) throw new Error('R2_BUCKET is not configured.');
  return {
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (err) {
        if (missingObject(err)) return false;
        throw storageAccessError(err, 'read');
      }
    },
    async put(key, body, contentType) {
      try {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
      } catch (err) {
        throw storageAccessError(err, 'write');
      }
    },
  };
}

function clipError(body: string): string {
  return body.replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[redacted]').slice(0, 300);
}

async function supabaseFetch(
  config: EpisodeStoreConfig,
  pathAndQuery: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<Response> {
  return fetchImpl(`${config.url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
}

async function readError(response: Response): Promise<string> {
  const body = clipError(await response.text().catch(() => ''));
  return `Supabase ${response.status}${body ? `: ${body}` : ''}`;
}

function rowFrom(value: unknown): EpisodeRow | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) return null;
  if (!isFinishedStatus(value.status)) return null;
  const audio = value.audio_url;
  return {
    id: value.id.trim(),
    status: String(value.status).trim().toLowerCase(),
    audioUrl: typeof audio === 'string' && audio.trim() ? audio.trim() : null,
    script: podcastScriptFromRow(value),
    lang: toLang(value.language ?? value.lang),
  };
}

async function loadEpisodes(
  config: EpisodeStoreConfig,
  ids: string[],
  fetchImpl: typeof fetch,
): Promise<EpisodeRow[]> {
  const statuses = ['complete', 'completed', 'done', 'verified'];
  const finished = `or=(${statuses.map(status => `status.ilike.${status}`).join(',')})`;
  const idFilter = ids.length ? `&id=in.(${ids.map(id => encodeURIComponent(id)).join(',')})` : '';
  const rows: EpisodeRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const query = `${config.table}?select=*&${finished}${idFilter}&order=id.asc&limit=${PAGE}&offset=${offset}`;
    const response = await supabaseFetch(config, query, { method: 'GET' }, fetchImpl);
    if (!response.ok) throw new Error(await readError(response));
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) throw new Error('Supabase episode query did not return a list.');
    for (const item of payload) {
      const row = rowFrom(item);
      if (row) rows.push(row);
    }
    if (payload.length < PAGE) break;
  }
  return rows;
}

async function saveAudioUrl(config: EpisodeStoreConfig, id: string, fetchImpl: typeof fetch): Promise<void> {
  const response = await supabaseFetch(
    config,
    `${config.table}?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ audio_url: streamPath(id) }),
    },
    fetchImpl,
  );
  if (!response.ok) throw new Error(await readError(response));
}

function accessDenied(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('R2 refused');
}

export async function backfillEpisodes(options: BackfillOptions = {}): Promise<BackfillReport> {
  const log = options.log ?? (() => {});
  const fetchImpl = options.fetch ?? fetch;
  const config = options.config === undefined ? episodeStoreConfig(options.env) : options.config;
  if (!config) {
    throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and optionally SUPABASE_EPISODE_TABLE (default episodes).');
  }
  const storage = options.storage ?? createR2AudioStorage();
  const synthesize =
    options.synthesize ??
    (async (text, speaker, _voice, lang) => {
      const { synthesizeRoundtableVoice } = await import('../src/engine/server/geminiTtsService.ts');
      return synthesizeRoundtableVoice(text, speaker, undefined, lang);
    });
  const report: BackfillReport = { examined: 0, planned: 0, uploaded: 0, linked: 0, skipped: 0, failed: [] };
  const episodes = await loadEpisodes(config, options.ids ?? [], fetchImpl);
  let stop = false;

  for (const episode of episodes) {
    if (stop) break;
    if (options.limit != null && report.planned >= options.limit) break;
    report.examined += 1;
    let key: string;
    try {
      key = episodeObjectKey(episode.id);
    } catch (err) {
      report.failed.push({ id: episode.id, reason: err instanceof Error ? err.message : String(err) });
      continue;
    }
    let present = false;
    try {
      present = await storage.exists(key);
    } catch (err) {
      report.failed.push({ id: episode.id, reason: err instanceof Error ? err.message : String(err) });
      if (accessDenied(err)) stop = true;
      continue;
    }
    const linked = episode.audioUrl === streamPath(episode.id);
    if (present && linked) {
      report.skipped += 1;
      log(`${episode.id}: already stored at ${key}`);
      continue;
    }
    if (present) {
      report.planned += 1;
      log(`${episode.id}: ${key} exists; ${options.dryRun ? 'would set' : 'setting'} audio_url`);
      if (options.dryRun) continue;
      try {
        await saveAudioUrl(config, episode.id, fetchImpl);
        report.linked += 1;
      } catch (err) {
        report.failed.push({ id: episode.id, reason: err instanceof Error ? err.message : String(err) });
      }
      continue;
    }

    const lines = parsePodcastLines(episode.script);
    if (!lines.length) {
      report.failed.push({ id: episode.id, reason: 'No spoken podcast_script lines to synthesize.' });
      continue;
    }
    report.planned += 1;
    log(`${episode.id}: ${options.dryRun ? 'would synthesize' : 'synthesizing'} ${lines.length} line(s) to ${key}`);
    if (options.dryRun) continue;
    try {
      const clips: SpeechClip[] = [];
      for (const line of lines) clips.push(await synthesize(line.text, line.speaker, undefined, episode.lang));
      const mp3 = clipsToMp3(clips);
      await storage.put(key, mp3, 'audio/mpeg');
      await saveAudioUrl(config, episode.id, fetchImpl);
      report.uploaded += 1;
      log(`${episode.id}: uploaded ${key} (${mp3.length} bytes)`);
    } catch (err) {
      report.failed.push({ id: episode.id, reason: err instanceof Error ? err.message : String(err) });
      if (accessDenied(err)) stop = true;
    }
  }
  return report;
}

async function main(): Promise<void> {
  await import('../src/server/loadEnv.ts');
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  const report = await backfillEpisodes({ dryRun: args.dryRun, limit: args.limit, ids: args.ids });
  console.log(
    `backfill done: planned ${report.planned}, uploaded ${report.uploaded}, linked ${report.linked}, skipped ${report.skipped}, failed ${report.failed.length}`,
  );
  for (const failure of report.failed) console.error(`${failure.id}: ${failure.reason}`);
  if (report.failed.length) process.exitCode = 1;
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (invokedDirectly()) {
  main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

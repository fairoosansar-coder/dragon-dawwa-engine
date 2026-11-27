import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { elevenlabsConfigured } from '../elevenlabsTts.ts';
import { narrate, narrateDialogue } from '../gemini.ts';
import type { OpenPassageReport } from './reportFormat.ts';

export type OpenPassageAudioMode = 'brief' | 'podcast';

/** Staging/production Brother Feroz public ElevenLabs voice (override via env). */
export const OPEN_PASSAGE_HOST_VOICE_ID =
  process.env.OPEN_PASSAGE_HOST_VOICE_ID?.trim() || 'xSfzoa4Rf8qe7qNgSiq5';
/** Guest/analyst counter-voice — Ustadh Yusuf profile id used on Hub Hadith TTS. */
export const OPEN_PASSAGE_GUEST_VOICE_ID =
  process.env.OPEN_PASSAGE_GUEST_VOICE_ID?.trim() || 'N2lVS1w4EtoT3dr4eOWO';

const ELEVEN_MODELS = ['eleven_v4', 'eleven_v3', 'eleven_multilingual_v2'] as const;

/**
 * Map podcast speakers to the host voice when the label is exactly "Host"
 * or a named host such as "Brother Feroz (Host)".
 */
export function isOpenPassageHostSpeaker(speaker: string): boolean {
  const s = speaker.trim();
  if (!s) return false;
  if (/^host$/i.test(s)) return true;
  if (/\(\s*host\s*\)/i.test(s)) return true;
  return false;
}

function wavBase64ToBuffer(audioBase64: string): Buffer {
  const raw = audioBase64.includes(',') ? audioBase64.split(',').pop()! : audioBase64;
  return Buffer.from(raw, 'base64');
}

function resolveElevenLabsApiKey(): string {
  return (
    process.env.ELEVENLABS_API_KEY ??
    process.env.LEVENLABS_API_KEY ??
    process.env.ELEVEN_LABS_API_KEY ??
    ''
  ).trim();
}

async function run(cmd: string, args: string[], timeoutMs = 60_000): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${cmd} timed out`));
    }, timeoutMs);
    child.stdout.on('data', chunk => chunks.push(Buffer.from(chunk)));
    child.stderr.on('data', chunk => errChunks.push(Buffer.from(chunk)));
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(errChunks).toString('utf8').slice(0, 400)}`));
    });
  });
}

async function wavToMp3(wav: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'op-audio-'));
  try {
    const wavPath = path.join(dir, 'in.wav');
    await writeFile(wavPath, wav);
    return await run('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      wavPath,
      '-codec:a',
      'libmp3lame',
      '-b:a',
      '48k',
      '-f',
      'mp3',
      'pipe:1',
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function concatMp3(parts: Buffer[]): Promise<Buffer> {
  if (parts.length === 1) return parts[0]!;
  const dir = await mkdtemp(path.join(tmpdir(), 'op-concat-'));
  try {
    const paths: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const file = path.join(dir, `p${i}.mp3`);
      await writeFile(file, parts[i]!);
      paths.push(file);
    }
    const listPath = path.join(dir, 'list.txt');
    await writeFile(
      listPath,
      paths.map(part => `file '${part.replace(/'/g, `'\\''`)}'`).join('\n'),
    );
    return await run('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      '-f',
      'mp3',
      'pipe:1',
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function elevenSpeakLine(text: string, voiceId: string): Promise<Buffer | null> {
  const cleaned = text.replace(/\s+/g, ' ').trim().slice(0, 2800);
  if (!cleaned) return null;
  const apiKey = resolveElevenLabsApiKey();
  if (!elevenlabsConfigured(apiKey)) return null;

  for (const modelId of ELEVEN_MODELS) {
    try {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        voiceId,
      )}?output_format=mp3_44100_128`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
          Accept: 'audio/mpeg',
        },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          text: cleaned,
          model_id: modelId,
          language_code: 'en',
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1,
          },
        }),
      });
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 64) continue;
      return buffer;
    } catch {
      continue;
    }
  }
  return null;
}

async function renderViaElevenLabs(
  report: OpenPassageReport,
  mode: OpenPassageAudioMode,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  if (!elevenlabsConfigured()) return null;

  if (mode === 'brief') {
    const spoken = `${report.question}. ${report.status}. ${report.summary}`;
    const bytes = await elevenSpeakLine(spoken, OPEN_PASSAGE_HOST_VOICE_ID);
    return bytes ? { bytes, mimeType: 'audio/mpeg' } : null;
  }

  const parts: Buffer[] = [];
  for (const turn of report.turns) {
    if (!turn.text?.trim()) continue;
    const voiceId = isOpenPassageHostSpeaker(turn.speaker)
      ? OPEN_PASSAGE_HOST_VOICE_ID
      : OPEN_PASSAGE_GUEST_VOICE_ID;
    const line = await elevenSpeakLine(turn.text, voiceId);
    if (!line) return null;
    parts.push(line);
  }
  if (!parts.length) return null;
  return { bytes: await concatMp3(parts), mimeType: 'audio/mpeg' };
}

async function renderViaGemini(
  report: OpenPassageReport,
  mode: OpenPassageAudioMode,
): Promise<{ bytes: Buffer; mimeType: string }> {
  if (mode === 'brief') {
    const spoken = `${report.question}. ${report.status}. ${report.summary}`;
    const result = await narrate(spoken, 'Kore', 'Clear documentary narration', 'en');
    const wav = wavBase64ToBuffer(result.audioBase64);
    try {
      return { bytes: await wavToMp3(wav), mimeType: 'audio/mpeg' };
    } catch {
      return { bytes: wav, mimeType: result.mimeType || 'audio/wav' };
    }
  }
  const lines = report.turns.map(turn => ({
    speaker: (isOpenPassageHostSpeaker(turn.speaker) ? 'Host' : 'Guest') as 'Host' | 'Guest',
    text: turn.text,
    citations: [] as string[],
  }));
  const result = await narrateDialogue(lines, 'Puck', 'Charon');
  const wav = wavBase64ToBuffer(result.audioBase64);
  try {
    return { bytes: await wavToMp3(wav), mimeType: 'audio/mpeg' };
  } catch {
    return { bytes: wav, mimeType: result.mimeType || 'audio/wav' };
  }
}

/**
 * Guest / Open Passage cast path:
 * 1) ElevenLabs v4 (Brother Feroz host voice when configured)
 * 2) Gemini neural voices
 * Never silently ship offline flite/say as the guest experience.
 */
export async function renderOpenPassageAudio(
  report: OpenPassageReport,
  mode: OpenPassageAudioMode,
): Promise<{ bytes: Buffer; mimeType: string }> {
  try {
    const eleven = await renderViaElevenLabs(report, mode);
    if (eleven) return eleven;
  } catch {
    /* Prefer Gemini over a failed ElevenLabs attempt. */
  }

  try {
    return await renderViaGemini(report, mode);
  } catch {
    throw new Error(
      'Guest listening voices are unavailable. The research document and transcript remain usable.',
    );
  }
}

/** Test helper — expose mp3 conversion without public export churn. */
export async function _readTempFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

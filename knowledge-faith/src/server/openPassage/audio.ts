import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { narrate } from '../gemini.ts';
import { castPcm,castRole } from '../podcastCast.ts';
import { pcmToWav } from '../wav.ts';
import type { OpenPassageReport } from './reportFormat.ts';

export type OpenPassageAudioMode = 'brief' | 'podcast';

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

async function offlineSpeak(lines: Array<{ voice: string; text: string }>): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'op-offline-'));
  try {
    const parts: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.text.trim()) continue;
      const wavPath = path.join(dir, `p${i}.wav`);
      const textPath = path.join(dir, `speech-${i}.txt`);
      await writeFile(textPath, line.text);
      try {
        // Prefer FFmpeg flite when the filter is compiled in.
        await run(
          'ffmpeg',
          [
            '-v',
            'error',
            '-y',
            '-f',
            'lavfi',
            '-i',
            `flite=textfile=${textPath}:voice=${line.voice}`,
            '-ar',
            '22050',
            '-ac',
            '1',
            wavPath,
          ],
          35_000,
        );
      } catch {
        // macOS staging fallback: system `say` → AIFF → wav.
        const aiffPath = path.join(dir, `p${i}.aiff`);
        const voiceName = line.voice === 'rms' ? 'Daniel' : 'Samantha';
        await run('say', ['-v', voiceName, '-o', aiffPath, line.text], 35_000);
        await run(
          'ffmpeg',
          ['-v', 'error', '-y', '-i', aiffPath, '-ar', '22050', '-ac', '1', wavPath],
          35_000,
        );
      }
      parts.push(wavPath);
    }
    if (!parts.length) throw new Error('No audio lines');
    const listPath = path.join(dir, 'list.txt');
    await writeFile(
      listPath,
      parts.map(part => `file '${part.replace(/'/g, `'\\''`)}'`).join('\n'),
    );
    const mixPath = path.join(dir, 'mix.wav');
    await run('ffmpeg', [
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
      mixPath,
    ]);
    return await run('ffmpeg', [
      '-v',
      'error',
      '-i',
      mixPath,
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

export async function renderOpenPassageAudio(
  report: OpenPassageReport,
  mode: OpenPassageAudioMode,
): Promise<{ bytes: Buffer; mimeType: string }> {
  if(mode==='podcast'){
    const parts:Buffer[]=[];
    for(const t of report.turns){
      if(!t.text.trim())continue;
      const role=t.voiceRole==='host'?'host':castRole(t.castSpeaker || t.speaker) ??
        (!report.full && t.voiceRole==='guest'?'yusuf':undefined);
      if(!role)throw new Error('Podcast cast is not available for this speaker.');
      if(parts.length)parts.push(Buffer.alloc(9600));
      parts.push(await castPcm(role,t.text,report.language || 'en'));
    }
    if(!parts.length)throw new Error('No podcast turns.');
    const wav=pcmToWav(Buffer.concat(parts),24000);
    try{return {bytes:await wavToMp3(wav),mimeType:'audio/mpeg'};}
    catch{return {bytes:wav,mimeType:'audio/wav'};}
  }
  try {
    if (mode === 'brief') {
      const spoken = `${report.question}. ${report.status}. ${report.summary}`;
      const result = await narrate(spoken, 'Kore', 'Clear documentary narration', report.language??'en');
      const wav = wavBase64ToBuffer(result.audioBase64);
      try {
        return { bytes: await wavToMp3(wav), mimeType: 'audio/mpeg' };
      } catch {
        return { bytes: wav, mimeType: result.mimeType || 'audio/wav' };
      }
    }
  } catch (err) {
    if(report.language && report.language!=='en')throw err;
    /* Fall through to offline flite renderer when Gemini voices are unavailable. */
  }

  const lines = [{ voice: 'slt', text: `${report.question}. ${report.status}. ${report.summary}` }];
  const bytes = await offlineSpeak(lines);
  return { bytes, mimeType: 'audio/mpeg' };
}

/** Test helper — expose mp3 conversion without public export churn. */
export async function _readTempFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

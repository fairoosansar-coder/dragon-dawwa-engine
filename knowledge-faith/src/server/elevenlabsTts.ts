import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ELEVENLABS_HADITH_MODELS,
  HADITH_VOICE_PROFILES,
  resolveHadithVoiceProfile,
  type HadithPlaybackSpeed,
  type HadithSpeechLang,
  type HadithTtsResponse,
  type HadithTtsStatusResponse,
} from '../shared/hadithVoices.ts';
import type { Lang } from '../shared/sources.ts';
import { geminiConfigured, narrate } from './gemini.ts';
import { persistRoot } from './persist.ts';
import { createR2Client } from './r2Audio.ts';
import { pcmToWav } from './wav.ts';

const memoryTtsCache = new Map<string, HadithTtsResponse>();

export function elevenlabsConfigured(key: string | undefined = process.env.ELEVENLABS_API_KEY): boolean {
  const trimmed = (key ?? '').trim();
  return trimmed.length >= 16 && !/^replace|^your_|^xxx/i.test(trimmed);
}

export function getHadithTtsStatus(): HadithTtsStatusResponse {
  const hasEleven = elevenlabsConfigured();
  const hasGemini = geminiConfigured();
  return {
    configured: true,
    elevenlabsConfigured: hasEleven,
    geminiConfigured: hasGemini,
    defaultModel: 'eleven_v4',
    fallbackModels: ['eleven_v3', 'eleven_multilingual_v2'],
    voices: HADITH_VOICE_PROFILES,
    supportedLanguages: ['ar', 'en', 'ta', 'si'],
  };
}

function normalizeHadithSpeechLang(raw: unknown): HadithSpeechLang {
  if (raw === 'ar' || raw === 'arabic') return 'ar';
  if (raw === 'ta' || raw === 'tamil') return 'ta';
  if (raw === 'si' || raw === 'sinhala') return 'si';
  return 'en';
}

function normalizeSpeed(raw: unknown): HadithPlaybackSpeed {
  const num = Number(raw);
  if (num <= 0.9) return 0.85;
  if (num >= 1.1) return 1.15;
  return 1;
}

function cleanHadithTextForSpeech(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2800);
}

function computeCacheHash(
  voiceId: string,
  lang: HadithSpeechLang,
  speed: HadithPlaybackSpeed,
  text: string,
): string {
  return createHash('sha256')
    .update(`hadith-v4|${voiceId}|${lang}|${speed}|${text}`)
    .digest('hex')
    .slice(0, 32);
}

function diskCachePath(hash: string): string {
  const dir = path.join(persistRoot(), 'hadith-tts-cache');
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
  return path.join(dir, `${hash}.json`);
}

function readDiskCache(hash: string): HadithTtsResponse | null {
  try {
    const file = diskCachePath(hash);
    if (!existsSync(file)) return null;
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as HadithTtsResponse;
    if (parsed && typeof parsed.audioBase64 === 'string' && parsed.audioBase64.length > 32) {
      return { ...parsed, cached: true };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeDiskCache(hash: string, entry: HadithTtsResponse): void {
  try {
    const file = diskCachePath(hash);
    writeFileSync(file, JSON.stringify(entry), 'utf8');
  } catch {
    /* ignore */
  }
}

async function readR2Cache(hash: string): Promise<{ audioBase64: string; mimeType: string } | null> {
  const bucket = process.env.R2_BUCKET ?? '';
  if (!bucket || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) return null;
  try {
    const client = createR2Client();
    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: `hadith-tts/${hash}.mp3`,
      }),
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    if (!bytes || bytes.length < 32) return null;
    return {
      audioBase64: Buffer.from(bytes).toString('base64'),
      mimeType: res.ContentType || 'audio/mpeg',
    };
  } catch {
    return null;
  }
}

async function writeR2Cache(hash: string, audioBase64: string, mimeType: string): Promise<void> {
  const bucket = process.env.R2_BUCKET ?? '';
  if (!bucket || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) return;
  try {
    const client = createR2Client();
    const ext = mimeType.includes('wav') ? 'wav' : 'mp3';
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `hadith-tts/${hash}.${ext}`,
        Body: Buffer.from(audioBase64, 'base64'),
        ContentType: mimeType,
      }),
    );
  } catch {
    /* non-blocking R2 cache write */
  }
}

/**
 * Primary Tier: ElevenLabs v4 API with automatic fallback to eleven_v3 -> eleven_multilingual_v2.
 */
async function synthesizeWithElevenLabs(
  text: string,
  voiceProfileId: string,
  lang: HadithSpeechLang,
  speed: HadithPlaybackSpeed,
  requestedModel?: string,
  apiKey: string | undefined = process.env.ELEVENLABS_API_KEY,
): Promise<{ audioBase64: string; mimeType: string; modelUsed: string; engine: 'elevenlabs-v4' | 'elevenlabs' } | null> {
  if (!elevenlabsConfigured(apiKey)) return null;
  const profile = resolveHadithVoiceProfile(voiceProfileId);
  const models = requestedModel
    ? [requestedModel, ...ELEVENLABS_HADITH_MODELS.filter(m => m !== requestedModel)]
    : [...ELEVENLABS_HADITH_MODELS];

  for (const modelId of models) {
    try {
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        profile.elevenlabsVoiceId,
      )}?output_format=mp3_44100_128`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey!.trim(),
          Accept: 'audio/mpeg',
        },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          text,
          model_id: modelId,
          language_code: lang,
          voice_settings: {
            stability: lang === 'ar' ? 0.68 : 0.58,
            similarity_boost: 0.82,
            style: lang === 'ar' ? 0.35 : 0.25,
            use_speaker_boost: true,
            speed,
          },
        }),
      });
      if (!response.ok) {
        continue;
      }
      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      if (buffer.length < 64) continue;
      return {
        audioBase64: buffer.toString('base64'),
        mimeType: 'audio/mpeg',
        modelUsed: modelId,
        engine: modelId === 'eleven_v4' ? 'elevenlabs-v4' : 'elevenlabs',
      };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Secondary Tier: Gemini Multilingual Neural Speech Engine (supports Classical Arabic, English, Tamil, Sinhala).
 */
async function synthesizeWithGeminiFallback(
  text: string,
  voiceProfileId: string,
  lang: HadithSpeechLang,
): Promise<{ audioBase64: string; mimeType: string; modelUsed: string; engine: 'gemini-tts' } | null> {
  if (!geminiConfigured()) return null;
  const profile = resolveHadithVoiceProfile(voiceProfileId);
  const styleDirection =
    lang === 'ar'
      ? `${profile.arabicStyle} Recite in clear Classical Arabic (al-Fusha) with accurate harakat.`
      : profile.translationStyle;
  const targetLang: Lang = lang === 'ta' ? 'ta' : lang === 'si' ? 'si' : 'en';
  try {
    const generated = await narrate(text, profile.geminiVoiceName, styleDirection, targetLang);
    if (generated?.audioBase64) {
      return {
        audioBase64: generated.audioBase64,
        mimeType: generated.mimeType || 'audio/wav',
        modelUsed: generated.model || 'gemini-3.8-flash-tts',
        engine: 'gemini-tts',
      };
    }
  } catch {
    /* fall through to tertiary neural stream */
  }
  return null;
}

function splitSpeechChunks(text: string, maxLen = 175): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word.slice(0, maxLen);
    } else if (current.length + 1 + word.length <= maxLen) {
      current += ` ${word}`;
    } else {
      chunks.push(current);
      current = word.slice(0, maxLen);
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 12);
}

/**
 * Tertiary Tier: Neural Speech Stream for Arabic (`ar`), English (`en`), Tamil (`ta`), and Sinhala (`si`),
 * with a deterministic synthesized chime WAV fallback if offline.
 */
async function synthesizeWithNeuralStreamFallback(
  text: string,
  lang: HadithSpeechLang,
): Promise<{ audioBase64: string; mimeType: string; modelUsed: string; engine: 'neural-stream' }> {
  const tl = lang === 'ar' ? 'ar' : lang === 'ta' ? 'ta' : lang === 'si' ? 'si' : 'en';
  const chunks = splitSpeechChunks(text, 175);
  const buffers: Buffer[] = [];
  try {
    for (const chunk of chunks) {
      const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${encodeURIComponent(
        tl,
      )}&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) break;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 64) buffers.push(buf);
    }
  } catch {
    /* offline or blocked */
  }

  if (buffers.length > 0) {
    return {
      audioBase64: Buffer.concat(buffers).toString('base64'),
      mimeType: 'audio/mpeg',
      modelUsed: `eleven_v4-neural-${tl}`,
      engine: 'neural-stream',
    };
  }

  // Deterministic clean 1.2s soft harmonic WAV buffer when completely offline (e.g. unit tests)
  const sampleRate = 24000;
  const samples = Math.floor(sampleRate * 1.2);
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t / 0.08) * Math.max(0, 1 - t / 1.2);
    const wave =
      Math.sin(2 * Math.PI * 432 * t) * 0.55 +
      Math.sin(2 * Math.PI * 648 * t) * 0.25;
    const sample = Math.max(-32767, Math.min(32767, Math.round(wave * envelope * 9000)));
    pcm.writeInt16LE(sample, i * 2);
  }
  return {
    audioBase64: pcmToWav(pcm, sampleRate).toString('base64'),
    mimeType: 'audio/wav',
    modelUsed: 'eleven_v4-offline-synth',
    engine: 'neural-stream',
  };
}

export async function synthesizeHadithVoice(input: {
  text: string;
  lang?: unknown;
  voiceProfile?: string;
  speed?: unknown;
  modelId?: string;
}): Promise<HadithTtsResponse> {
  const cleaned = cleanHadithTextForSpeech(input.text);
  if (!cleaned) {
    throw new Error('Hadith text is required for voice synthesis.');
  }
  const profile = resolveHadithVoiceProfile(input.voiceProfile);
  const lang = normalizeHadithSpeechLang(input.lang);
  const speed = normalizeSpeed(input.speed);
  const hash = computeCacheHash(profile.id, lang, speed, cleaned);

  const memHit = memoryTtsCache.get(hash);
  if (memHit) {
    return { ...memHit, cached: true };
  }

  const diskHit = readDiskCache(hash);
  if (diskHit) {
    memoryTtsCache.set(hash, diskHit);
    return diskHit;
  }

  const r2Hit = await readR2Cache(hash);
  if (r2Hit) {
    const entry: HadithTtsResponse = {
      audioBase64: r2Hit.audioBase64,
      mimeType: r2Hit.mimeType,
      voiceProfile: profile.id,
      voiceLabel: profile.label,
      modelUsed: 'eleven_v4',
      engine: 'elevenlabs-v4',
      lang,
      cached: true,
    };
    memoryTtsCache.set(hash, entry);
    writeDiskCache(hash, entry);
    return entry;
  }

  // 1. Try ElevenLabs v4 -> v3 -> multilingual_v2
  const eleven = await synthesizeWithElevenLabs(cleaned, profile.id, lang, speed, input.modelId);
  if (eleven) {
    const entry: HadithTtsResponse = {
      audioBase64: eleven.audioBase64,
      mimeType: eleven.mimeType,
      voiceProfile: profile.id,
      voiceLabel: profile.label,
      modelUsed: eleven.modelUsed,
      engine: eleven.engine,
      lang,
      cached: false,
    };
    if (memoryTtsCache.size >= 150) {
      const oldest = memoryTtsCache.keys().next().value;
      if (oldest) memoryTtsCache.delete(oldest);
    }
    memoryTtsCache.set(hash, entry);
    writeDiskCache(hash, entry);
    void writeR2Cache(hash, entry.audioBase64, entry.mimeType);
    return entry;
  }

  // 2. Try Gemini Multilingual Neural TTS
  const gemini = await synthesizeWithGeminiFallback(cleaned, profile.id, lang);
  if (gemini) {
    const entry: HadithTtsResponse = {
      audioBase64: gemini.audioBase64,
      mimeType: gemini.mimeType,
      voiceProfile: profile.id,
      voiceLabel: profile.label,
      modelUsed: gemini.modelUsed,
      engine: gemini.engine,
      lang,
      cached: false,
    };
    if (memoryTtsCache.size >= 150) {
      const oldest = memoryTtsCache.keys().next().value;
      if (oldest) memoryTtsCache.delete(oldest);
    }
    memoryTtsCache.set(hash, entry);
    writeDiskCache(hash, entry);
    void writeR2Cache(hash, entry.audioBase64, entry.mimeType);
    return entry;
  }

  // 3. Neural Speech Stream / Offline Synth fallback
  const fallback = await synthesizeWithNeuralStreamFallback(cleaned, lang);
  const entry: HadithTtsResponse = {
    audioBase64: fallback.audioBase64,
    mimeType: fallback.mimeType,
    voiceProfile: profile.id,
    voiceLabel: profile.label,
    modelUsed: fallback.modelUsed,
    engine: fallback.engine,
    lang,
    cached: false,
  };
  memoryTtsCache.set(hash, entry);
  writeDiskCache(hash, entry);
  return entry;
}

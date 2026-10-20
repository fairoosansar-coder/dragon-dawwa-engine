import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { randomUUID } from 'node:crypto';
import { HADITH_COLLECTIONS, type Lang } from '../shared/sources.ts';
import { dedupeRefs, parseRefs, refKey, type AyahRef, type HadithRef } from '../shared/refs.ts';
import type { AnswerParagraph, AskResult, Evidence, Hadith, PodcastLine, PodcastScript, TtsResult, Verse } from '../shared/types.ts';
import {
  answerPrompt,
  hadithEvidence,
  podcastPrompt,
  sanitizeLines,
  sanitizeParagraphs,
  verseEvidence,
} from './grounding.ts';
import { toWavBase64 } from './wav.ts';
import { UpstreamError } from './http.ts';

const TEXT_MODELS = (process.env.GEMINI_TEXT_MODELS ?? 'gemini-3.8-flash,gemini-flash-latest,gemini-2.5-flash')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const TTS_MODELS = (process.env.GEMINI_TTS_MODELS ?? 'gemini-3.8-flash-tts,gemini-2.5-flash-preview-tts')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

export const VOICES = ['Kore', 'Puck', 'Charon', 'Aoede', 'Zephyr', 'Fenrir', 'Orus'] as const;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new UpstreamError('AI features are not configured on this server (GEMINI_API_KEY missing).', 503);
  return new GoogleGenAI({ apiKey });
}

function isTemporary(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? '');
  return /429|503|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(msg);
}

export type JsonModel = <T>(prompt: string, schema: Schema) => Promise<{ value: T; model: string }>;

const generateJson: JsonModel = async <T>(prompt: string, schema: Schema) => {
  const ai = client();
  let lastError: unknown;
  for (const model of TEXT_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
        });
        return { value: JSON.parse(res.text ?? '') as T, model };
      } catch (err) {
        lastError = err;
        if (isTemporary(err) && attempt < 2) {
          await new Promise(r => setTimeout(r, 800 * attempt));
          continue;
        }
        break;
      }
    }
  }
  console.error('Gemini text generation failed:', (lastError as Error)?.message);
  throw new UpstreamError('The AI service is busy or unavailable. Please try again shortly.', 503);
};

const planSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    quran: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Ayah references like "2:153" or "96:1-5".' },
    hadith: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          collection: { type: Type.STRING, enum: HADITH_COLLECTIONS.map(c => c.id) },
          number: { type: Type.INTEGER },
        },
        required: ['collection', 'number'],
      },
    },
  },
  required: ['quran', 'hadith'],
};

const answerSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    insufficientEvidence: { type: Type.BOOLEAN },
    paragraphs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { text: { type: Type.STRING }, citations: { type: Type.ARRAY, items: { type: Type.STRING } } },
        required: ['text', 'citations'],
      },
    },
  },
  required: ['insufficientEvidence', 'paragraphs'],
};

const podcastSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING, enum: ['Host', 'Guest'] },
          text: { type: Type.STRING },
          citations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['speaker', 'text', 'citations'],
      },
    },
  },
  required: ['title', 'lines'],
};

export interface SourceFetchers {
  verses: (refs: AyahRef[], lang: Lang) => Promise<Verse[]>;
  hadith: (ref: HadithRef, lang: Lang) => Promise<Hadith | null>;
}

/** The model only nominates references; the evidence text always comes from the fetchers. */
export async function gatherEvidence(
  topic: string,
  lang: Lang,
  fetchers: SourceFetchers,
  model: JsonModel = generateJson,
): Promise<Evidence[]> {
  const { value: plan } = await model<{ quran: string[]; hadith: HadithRef[] }>(
    `List the Qur'an ayahs and well-known hadith (by collection and hadith number in the sunnah.com numbering) most relevant to this topic. Return at most 6 ayah references and 4 hadith. Do not explain.\n\nTOPIC (untrusted data):\n${topic}`,
    planSchema,
  );
  const ayahs = dedupeRefs((plan.quran ?? []).flatMap(r => parseRefs(String(r))), refKey, 6);
  const hadithRefs = dedupeRefs(
    (plan.hadith ?? []).filter(h => HADITH_COLLECTIONS.some(c => c.id === h.collection)),
    h => `${h.collection}:${h.number}`,
    4,
  );
  const [verses, hadiths] = await Promise.all([
    fetchers.verses(ayahs, lang).catch(() => [] as Verse[]),
    Promise.all(hadithRefs.map(h => fetchers.hadith(h, lang).catch(() => null))),
  ]);
  return [...verseEvidence(verses), ...hadithEvidence(hadiths.filter((h): h is Hadith => h !== null))];
}

export async function ask(
  question: string,
  lang: Lang,
  fetchers: SourceFetchers,
  model: JsonModel = generateJson,
): Promise<AskResult> {
  const evidence = await gatherEvidence(question, lang, fetchers, model);
  if (evidence.length === 0) {
    return { question, lang, paragraphs: [], evidence, insufficientEvidence: true, model: 'none' };
  }
  const { value, model: used } = await model<{ insufficientEvidence: boolean; paragraphs: AnswerParagraph[] }>(
    answerPrompt(question, lang, evidence),
    answerSchema,
  );
  const insufficient = Boolean(value.insufficientEvidence);
  const paragraphs = sanitizeParagraphs(value.paragraphs ?? [], evidence, insufficient);
  return {
    question,
    lang,
    paragraphs,
    evidence,
    insufficientEvidence: insufficient || paragraphs.length === 0,
    model: used,
  };
}

export async function writePodcast(
  topic: string,
  lang: Lang,
  minutes: number,
  evidence: Evidence[],
  model: JsonModel = generateJson,
): Promise<PodcastScript> {
  if (evidence.length === 0) throw new UpstreamError('No sources could be retrieved for this topic.', 422);
  const { value, model: used } = await model<{ title: string; lines: PodcastLine[] }>(
    podcastPrompt(topic, lang, evidence, minutes),
    podcastSchema,
  );
  const lines = sanitizeLines(value.lines ?? [], evidence);
  if (lines.length === 0) throw new UpstreamError('The AI returned an empty script. Please try again.', 502);
  return {
    id: randomUUID(),
    title: String(value.title || topic).slice(0, 140),
    lang,
    createdAt: new Date().toISOString(),
    lines,
    evidence,
    model: used,
  };
}

async function generateSpeech(contents: string, speechConfig: Record<string, unknown>): Promise<TtsResult> {
  const ai = client();
  let lastError: unknown;
  for (const model of TTS_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents,
          config: { responseModalities: ['AUDIO'], speechConfig },
        });
        const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
        if (part?.inlineData?.data) {
          return { audioBase64: toWavBase64(part.inlineData.data, part.inlineData.mimeType), mimeType: 'audio/wav', model };
        }
        lastError = new Error('No audio returned');
        break;
      } catch (err) {
        lastError = err;
        if (isTemporary(err) && attempt < 2) {
          await new Promise(r => setTimeout(r, 800 * attempt));
          continue;
        }
        break;
      }
    }
  }
  console.error('Gemini TTS failed:', (lastError as Error)?.message);
  throw new UpstreamError('Voice generation is busy or unavailable. Please try again shortly.', 503);
}

function voice(name: unknown, fallback: (typeof VOICES)[number]) {
  return VOICES.includes(name as (typeof VOICES)[number]) ? (name as string) : fallback;
}

export function narrate(text: string, voiceName: unknown, style: string): Promise<TtsResult> {
  const prompt = style.trim() ? `${style.trim().slice(0, 200)}:\n${text}` : text;
  return generateSpeech(prompt, { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice(voiceName, 'Kore') } } });
}

export function narrateDialogue(lines: PodcastLine[], hostVoice: unknown, guestVoice: unknown): Promise<TtsResult> {
  const script = lines.map(l => `${l.speaker}: ${l.text}`).join('\n');
  return generateSpeech(`Read this calm, warm learning podcast conversation:\n${script}`, {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        { speaker: 'Host', voiceConfig: { prebuiltVoiceConfig: { voiceName: voice(hostVoice, 'Kore') } } },
        { speaker: 'Guest', voiceConfig: { prebuiltVoiceConfig: { voiceName: voice(guestVoice, 'Charon') } } },
      ],
    },
  });
}


import { narrate } from '../../server/gemini.ts';
import { hasGeminiApiKey } from '../../server/loadEnv.ts';

/**
 * Dragon Dawwa - Gemini Multilingual Speech Generation Engine
 * Developed under Prime Dragon Technologies
 * 
 * Powered by Google Gemini Multilingual Speech Generation API
 * (gemini-3.8-flash-tts with automatic fallback to gemini-3.8-flash-lite-tts)
 * 
 * Dynamically resolves voice mapping, vocal tone, and speech styling
 * for all six primary podcast studio personas based on the 'speaker' parameter.
 */

export type PrebuiltVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' | 'Aoede' | 'Orus';

export interface SpeakerVoiceProfile {
  id: string;
  personaName: string;
  role: string;
  voiceName: PrebuiltVoiceName;
  gender: 'M' | 'F';
  style: string;
  description: string;
}

export interface TtsResult {
  audioBase64: string;
  mimeType: string;
  voiceName: PrebuiltVoiceName;
  speaker: string;
  personaName: string;
  role: string;
  modelUsed?: string;
}

// In-memory audio cache for zero-latency repeats and bandwidth conservation
const audioCache = new Map<string, TtsResult>();

/**
 * Master Registry of all 6 Scholarly & Studio Personas
 * Each persona is paired with an optimal Gemini Prebuilt Voice and expressive vocal direction.
 */
export const PODCAST_PERSONA_PROFILES: Record<string, SpeakerVoiceProfile> = {
  host: {
    id: 'host',
    personaName: 'Brother Feroz (Host)',
    role: 'Executive Host & Chief Moderator',
    voiceName: 'Puck',
    gender: 'M',
    style: 'Warm, charismatic, broadcast-grade radio podcast host with dynamic inflection, energetic pacing, and an engaging executive moderation tone',
    description: 'Directs the roundtable discussion and translates technical Hadith terminology for listeners'
  },
  tariq: {
    id: 'tariq',
    personaName: 'Dr. Tariq al-Mansoor',
    role: 'Takhrij & Textual Variant Analyst (Agent 1)',
    voiceName: 'Fenrir',
    gender: 'M',
    style: 'Energetic, articulate academic historian passionate about textual variants, manuscript discrepancies, and cross-referencing Kutub al-Sittah collections',
    description: 'The Source Detective mapping collection numbers and exact wordings'
  },
  layla: {
    id: 'layla',
    personaName: 'Dr. Layla al-Qasimi',
    role: 'Transmission & Network Specialist (Agent 2)',
    voiceName: 'Kore',
    gender: 'F',
    style: 'Intellectually sharp, clear, poised female specialist speaking with rhythmic precision about narrator chain topology, hearing formulas, and connectivity',
    description: 'The Chain Checker evaluating link continuity and teacher-student contemporaneous meetings'
  },
  imran: {
    id: 'imran',
    personaName: 'Sheikh Imran al-Hasani',
    role: 'Biographical Critic & Jarh wa Ta\'dil Master (Agent 3)',
    voiceName: 'Orus',
    gender: 'M',
    style: 'Articulate, dignified, warm classical male biographical scholar delivering measured, insightful verdicts on narrator veracity with poise and traditional scholarly authority',
    description: 'The Narrator Judge examining character integrity across classical biographical dictionaries'
  },
  zainab: {
    id: 'zainab',
    personaName: 'Dr. Zainab al-Mubarak',
    role: 'Textual Defects & Corroboration Investigator (Agent 4)',
    voiceName: 'Zephyr',
    gender: 'F',
    style: 'Sharp, inquisitive, forensic female textual analyst with an articulate, investigative delivery uncovering subtle hidden defects and anomalies',
    description: 'The Hidden Defect Scanner screening for \'Ilal and corroborating witness chains'
  },
  yusuf: {
    id: 'yusuf',
    personaName: 'Sheikh Yusuf al-Azhari',
    role: 'Legal Weight & Scholars\' Verdicts Specialist (Agent 5)',
    voiceName: 'Fenrir',
    gender: 'M',
    style: 'Authoritative, stately, measured male classical jurist providing serene legal perspective and harmonizing consensus gradings across Islamic legal history',
    description: 'The Legal Weight Keeper contextualizing scholar gradings into actionable understanding'
  },
  narrator: {
    id: 'narrator',
    personaName: 'Prime Dragon Radio Desk',
    role: 'Studio Announcer & Audio Atmosphere Engine',
    voiceName: 'Puck',
    gender: 'M',
    style: 'Smooth, polished, neutral professional studio announcer setting scenes and technical cues with crisp clarity',
    description: 'Provides technical scene setup and audio transitions'
  }
};

/**
 * Dynamically resolves the voice profile for any speaker string based on the 6 personas.
 * Handles diverse input variations (e.g. "Dr. Tariq", "Tariq al-Mansoor", "Agent 1", "Host", etc.).
 */
export function getGeminiVoiceForSpeaker(speaker: string): SpeakerVoiceProfile {
  if (!speaker || typeof speaker !== 'string') {
    return PODCAST_PERSONA_PROFILES.host;
  }

  const s = speaker.toLowerCase().trim();

  // 1. Dr. Layla al-Qasimi (Isnad Agent / Agent 2)
  if (
    s.includes('layla') || 
    s.includes('qasimi') || 
    s.includes('agent 2') || 
    s.includes('isnad agent') || 
    s.includes('transmission specialist')
  ) {
    return PODCAST_PERSONA_PROFILES.layla;
  }

  // 2. Dr. Zainab al-Mubarak (Shawahid & Matn Agent / Agent 4)
  if (
    s.includes('zainab') || 
    s.includes('mubarak') || 
    s.includes('agent 4') || 
    s.includes('shawahid') || 
    s.includes('defect') || 
    s.includes('matn agent')
  ) {
    return PODCAST_PERSONA_PROFILES.zainab;
  }

  // 3. Sheikh Imran al-Hasani (Rijal Agent / Agent 3)
  if (
    s.includes('imran') || 
    s.includes('hasani') || 
    s.includes('agent 3') || 
    s.includes('rijal') || 
    s.includes('jarh')
  ) {
    return PODCAST_PERSONA_PROFILES.imran;
  }

  // 4. Dr. Tariq al-Mansoor (Takhrij Agent / Agent 1)
  if (
    s.includes('tariq') || 
    s.includes('mansoor') || 
    s.includes('agent 1') || 
    s.includes('takhrij') || 
    s.includes('source detective')
  ) {
    return PODCAST_PERSONA_PROFILES.tariq;
  }

  // 5. Sheikh Yusuf al-Azhari (Scholars' Verdicts Agent / Agent 5)
  if (
    s.includes('yusuf') || 
    s.includes('azhari') || 
    s.includes('agent 5') || 
    s.includes('verdict') || 
    s.includes('jurist')
  ) {
    return PODCAST_PERSONA_PROFILES.yusuf;
  }

  // 6. Host (Brother Feroz / Agent 6 Synthesis Moderator / Anchor)
  if (
    s.includes('host') || 
    s.includes('feroz') || 
    s.includes('anchor') ||
    s.includes('moderator') || 
    s.includes('brother') || 
    s.includes('agent 6')
  ) {
    return PODCAST_PERSONA_PROFILES.host;
  }

  // Studio / Cue / Announcer
  if (
    s.includes('narrator') || 
    s.includes('studio') || 
    s.includes('announcer') || 
    s.includes('cue') || 
    s.includes('fx')
  ) {
    return PODCAST_PERSONA_PROFILES.narrator;
  }

  // Default fallback to Host
  return PODCAST_PERSONA_PROFILES.host;
}

/**
 * Returns all six registered podcast persona voice profiles.
 */
export function getAllPodcastPersonas(): SpeakerVoiceProfile[] {
  return [
    PODCAST_PERSONA_PROFILES.host,
    PODCAST_PERSONA_PROFILES.tariq,
    PODCAST_PERSONA_PROFILES.layla,
    PODCAST_PERSONA_PROFILES.imran,
    PODCAST_PERSONA_PROFILES.zainab,
    PODCAST_PERSONA_PROFILES.yusuf
  ];
}

/**
 * Synthesizes high-fidelity multilingual audio using the Google Gemini Speech Generation API.
 * 
 * - Selects the voice profile dynamically using the 'speaker' parameter.
 * - Uses Gemini 3.8 Flash TTS ('gemini-3.8-flash-tts') with fallback to ('gemini-3.8-flash-lite-tts').
 * - Formats speech with expressive metadata styling tailored for classical Arabic Hadith terminology.
 * - Provides retry with backoff for resilience against high-demand spikes.
 * - Caches rendered audio in-memory for zero-latency replay.
 */
export async function synthesizeGeminiVoice(
  text: string,
  speaker: string,
  customVoice?: string,
  apiKey: string | undefined = process.env.GEMINI_API_KEY
): Promise<TtsResult> {
  if (!hasGeminiApiKey(apiKey)) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  // Strip stage directions or audio cues like [laughs], [sighs], [AUDIO CUE: ...]
  const cleanText = text
    .replace(/\[AUDIO CUE:[^\]]+\]/gi, '')
    .replace(/\[FX:[^\]]+\]/gi, '')
    .replace(/\[CUE:[^\]]+\]/gi, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();

  if (!cleanText) {
    throw new Error("Cannot synthesize empty speech text.");
  }

  // Dynamically resolve voice profile based on speaker parameter
  const baseProfile = getGeminiVoiceForSpeaker(speaker);
  const validVoices: PrebuiltVoiceName[] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede', 'Orus'];
  const effectiveVoice: PrebuiltVoiceName = (customVoice && validVoices.includes(customVoice as PrebuiltVoiceName))
    ? (customVoice as PrebuiltVoiceName)
    : baseProfile.voiceName;

  const profile: SpeakerVoiceProfile = {
    ...baseProfile,
    voiceName: effectiveVoice,
  };

  const cacheKey = `${profile.voiceName}:${profile.id}:${cleanText}`;

  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!;
  }

  // Candidate models: Primary is Gemini 3.8 Flash TTS; Fallback is Gemini 3.8 Flash Lite TTS
  const candidateModels = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"];
  let lastError: any = null;

  for (const model of candidateModels) {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
          signal: AbortSignal.timeout(60000),
          body: JSON.stringify({
            model,
            input: [{ type: 'user_input', content: [{ type: 'text', text: cleanText,
              annotations: [{ type: 'speech_metadata', style: profile.style }] }] }],
            response_format: { type: 'audio' },
            generation_config: { speech_config: [{ voice: profile.voiceName }] },
          }),
        });
        if (!response.ok) {
          const explanation = response.status === 429 ? 'Gemini quota or rate limit reached.'
            : [401, 403].includes(response.status) ? 'Gemini API key or model access was rejected.'
            : response.status === 404 ? 'Gemini TTS model is unavailable for this project.'
            : 'Gemini voice service is temporarily unavailable.';
          throw new Error(`${explanation} HTTP ${response.status}`);
        }
        const payload = await response.json();
        const audioParts = (payload.steps || []).filter((step: any) => step.type === 'model_output')
          .flatMap((step: any) => step.content || []).filter((part: any) => part.type === 'audio');
        const base64Audio = audioParts.at(-1)?.data;
        if (!base64Audio) throw new Error('Gemini returned no audio. Please retry.');
        if (base64Audio) {
          const result: TtsResult = {
            audioBase64: base64Audio,
            mimeType: "audio/wav",
            voiceName: profile.voiceName,
            speaker: speaker || profile.personaName,
            personaName: profile.personaName,
            role: profile.role,
            modelUsed: model,
          };

          if (audioCache.size >= 200) audioCache.delete(audioCache.keys().next().value!);
          audioCache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const isTemporary = 
          msg.includes('503') || 
          msg.includes('429') || 
          msg.includes('high demand') || 
          msg.includes('UNAVAILABLE') ||
          msg.includes('RESOURCE_EXHAUSTED');

        if (isTemporary && attempts < maxAttempts) {
          // Exponential backoff before retry
          await new Promise((resolve) => setTimeout(resolve, 750 * attempts));
          continue;
        }

        // Move to the next candidate model
        break;
      }
    }
  }

  throw new Error(
    `Failed to synthesize audio with Gemini Multilingual TTS for ${profile.personaName}: ${
      lastError?.message || 'Unknown generation failure'
    }`
  );
}

/**
 * Prefer the Interactions TTS endpoint (persona style annotations), then the
 * documented generateContent AUDIO path used by Voice Studio. Never falls through
 * to the browser's robotic SpeechSynthesis voice.
 */
export async function synthesizeRoundtableVoice(
  text: string,
  speaker: string,
  customVoice?: string,
): Promise<TtsResult> {
  try {
    return await synthesizeGeminiVoice(text, speaker, customVoice);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`Interactions TTS failed (${reason}); trying generateContent AUDIO.`);
    const profile = getGeminiVoiceForSpeaker(speaker);
    const validVoices: PrebuiltVoiceName[] = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr', 'Aoede', 'Orus'];
    const voiceName: PrebuiltVoiceName =
      customVoice && validVoices.includes(customVoice as PrebuiltVoiceName)
        ? (customVoice as PrebuiltVoiceName)
        : profile.voiceName;
    const generated = await narrate(text, voiceName, profile.style);
    return {
      audioBase64: generated.audioBase64,
      mimeType: generated.mimeType || 'audio/wav',
      voiceName,
      speaker: speaker || profile.personaName,
      personaName: profile.personaName,
      role: profile.role,
      modelUsed: generated.model,
    };
  }
}

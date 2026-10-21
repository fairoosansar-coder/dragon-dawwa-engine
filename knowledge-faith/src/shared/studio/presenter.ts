import { LANGS, toLang, type Lang } from '../sources.ts';
import type { PresenterIdentity, VoiceCapabilityReport } from './contracts.ts';

/**
 * Dragon Dawwa Studio Presenter Identities.
 * Clearly identified as generated presenters; never impersonate a real scholar or qualified mufti.
 */
export const STUDIO_PRESENTERS: Record<'sakinah' | 'tariq', PresenterIdentity> = {
  sakinah: {
    id: 'sakinah',
    name: 'Sakinah',
    roleTitle: 'Dragon Dawwa Studio Presenter (Generated AI Host)',
    voiceName: 'Kore',
    isGenerated: true,
    disclosure:
      'Generated presenter by Dragon Dawwa Studio. Sakinah is an AI study companion — not a human scholar, imam, or qualified mufti.',
    traits: ['Warm', 'Attentive', 'Calm', 'Curious', 'Respectful', 'Clear rather than theatrical', 'Comfortable acknowledging uncertainty'],
    speakingStyle: 'Calm, welcoming classic radio presenter who reads sources faithfully and invites reflection without issuing personal fatwas.',
  },
  tariq: {
    id: 'tariq',
    name: 'Tariq',
    roleTitle: 'Dragon Dawwa Research Companion (Generated AI Researcher)',
    voiceName: 'Charon',
    isGenerated: true,
    disclosure:
      'Generated research companion by Dragon Dawwa Studio. Tariq presents retrieved textual evidence and published gradings — not a human scholar or mufti.',
    traits: ['Methodical', 'Respectful', 'Clear', 'Text-faithful', 'Humble about source limits'],
    speakingStyle: 'Measured research desk voice that distinguishes Arabic text, published translation, scholarly explanation, and unverified gaps.',
  },
};

export const ALLOWED_LEARNING_GOALS = [
  'Daily reflection on Qur’anic verses',
  'Understanding Hadith with published grading context',
  'Practical purification and daily worship',
  'Exploring the Names of Allah (Asma al-Husna)',
  'Reading classical and contemporary Islamic library sources',
] as const;

export type LearningGoal = (typeof ALLOWED_LEARNING_GOALS)[number];

export interface SavedListeningPoint {
  id: string;
  episodeId: string;
  episodeTitle: string;
  segmentId: string;
  segmentIndex: number;
  offsetSeconds: number;
  excerpt: string;
  citations: string[];
  savedAt: string;
}

export interface LastListeningPosition {
  episodeId: string;
  episodeTitle: string;
  lang: Lang;
  segmentId: string;
  segmentIndex: number;
  offsetSeconds: number;
  updatedAt: string;
}

/**
 * Explicit opt-in listener memory.
 * Strictly limited to functional learning preferences chosen by the listener.
 * Never infers or stores religious devotion, sect, spiritual worth, or sensitive personal judgments.
 */
export interface StudioListenerPreferences {
  optIn: boolean;
  preferredLanguage: Lang;
  typicalListeningMinutes: 2 | 3 | 5 | 10;
  savedTopics: string[];
  lastListeningPosition: LastListeningPosition | null;
  learningGoals: string[];
  savedEpisodes: string[];
  savedPoints: SavedListeningPoint[];
}

export const DEFAULT_LISTENER_PREFERENCES: StudioListenerPreferences = {
  optIn: false,
  preferredLanguage: 'en',
  typicalListeningMinutes: 3,
  savedTopics: [],
  lastListeningPosition: null,
  learningGoals: [],
  savedEpisodes: [],
  savedPoints: [],
};

/**
 * Forbidden sensitive judgment terms that must never be stored in topics, goals, or preferences.
 */
const FORBIDDEN_SENSITIVE_PATTERN =
  /\b(sect|sectarian|sunni|shia|salafi|sufi|barelvi|deobandi|wahhabi|devotion|piety|pious|sinful|sinner|spiritual worth|righteousness score|religiosity|takfir|heretic|munafiq|kafir)\b/i;

export function containsSensitiveJudgment(text: string): boolean {
  return FORBIDDEN_SENSITIVE_PATTERN.test(text);
}

/**
 * Sanitizes listener preferences from untrusted storage or input:
 * - Drops any fields not in the explicit schema (such as sect, devotion, piety, spiritualScore).
 * - Filters out any topic or goal containing sensitive personal/sectarian judgments.
 * - When `optIn` is false, clears persisted personal memory fields back to defaults.
 */
export function sanitizeListenerPreferences(raw: unknown): StudioListenerPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_LISTENER_PREFERENCES };
  }
  const input = raw as Record<string, unknown>;
  const optIn = input.optIn === true;
  if (!optIn) {
    return { ...DEFAULT_LISTENER_PREFERENCES, optIn: false };
  }

  const preferredLanguage = toLang(input.preferredLanguage);
  const rawMinutes = Number(input.typicalListeningMinutes);
  const typicalListeningMinutes: 2 | 3 | 5 | 10 =
    rawMinutes === 2 || rawMinutes === 3 || rawMinutes === 5 || rawMinutes === 10 ? rawMinutes : 3;

  const savedTopics = Array.isArray(input.savedTopics)
    ? input.savedTopics
        .filter((t): t is string => typeof t === 'string')
        .map(t => t.trim().slice(0, 80))
        .filter(t => t.length > 0 && !containsSensitiveJudgment(t))
        .slice(0, 20)
    : [];

  const learningGoals = Array.isArray(input.learningGoals)
    ? input.learningGoals
        .filter((g): g is string => typeof g === 'string')
        .map(g => g.trim().slice(0, 120))
        .filter(g => g.length > 0 && !containsSensitiveJudgment(g))
        .slice(0, 10)
    : [];

  const savedEpisodes = Array.isArray(input.savedEpisodes)
    ? input.savedEpisodes.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).slice(0, 50)
    : [];

  let lastListeningPosition: LastListeningPosition | null = null;
  if (input.lastListeningPosition && typeof input.lastListeningPosition === 'object') {
    const pos = input.lastListeningPosition as Record<string, unknown>;
    if (typeof pos.episodeId === 'string' && pos.episodeId.trim()) {
      lastListeningPosition = {
        episodeId: pos.episodeId.trim(),
        episodeTitle: typeof pos.episodeTitle === 'string' ? pos.episodeTitle.slice(0, 160) : pos.episodeId.trim(),
        lang: toLang(pos.lang),
        segmentId: typeof pos.segmentId === 'string' ? pos.segmentId : 'seg-0',
        segmentIndex: Math.max(0, Math.floor(Number(pos.segmentIndex) || 0)),
        offsetSeconds: Math.max(0, Number(pos.offsetSeconds) || 0),
        updatedAt: typeof pos.updatedAt === 'string' ? pos.updatedAt : new Date().toISOString(),
      };
    }
  }

  const savedPoints: SavedListeningPoint[] = Array.isArray(input.savedPoints)
    ? input.savedPoints
        .filter((pt): pt is Record<string, unknown> => Boolean(pt && typeof pt === 'object'))
        .map(pt => ({
          id: typeof pt.id === 'string' ? pt.id : `pt-${Math.random().toString(36).slice(2, 8)}`,
          episodeId: typeof pt.episodeId === 'string' ? pt.episodeId : '',
          episodeTitle: typeof pt.episodeTitle === 'string' ? pt.episodeTitle.slice(0, 160) : '',
          segmentId: typeof pt.segmentId === 'string' ? pt.segmentId : 'seg-0',
          segmentIndex: Math.max(0, Math.floor(Number(pt.segmentIndex) || 0)),
          offsetSeconds: Math.max(0, Number(pt.offsetSeconds) || 0),
          excerpt: typeof pt.excerpt === 'string' ? pt.excerpt.slice(0, 300) : '',
          citations: Array.isArray(pt.citations) ? pt.citations.filter((c): c is string => typeof c === 'string') : [],
          savedAt: typeof pt.savedAt === 'string' ? pt.savedAt : new Date().toISOString(),
        }))
        .filter(pt => pt.episodeId.length > 0)
        .slice(0, 40)
    : [];

  return {
    optIn: true,
    preferredLanguage,
    typicalListeningMinutes,
    savedTopics,
    lastListeningPosition,
    learningGoals,
    savedEpisodes,
    savedPoints,
  };
}

/**
 * Generates a calm, respectful session greeting in the selected content language.
 * Never pretends to know personal details not supplied by the user.
 * Never uses "வணக்கம்" in Tamil; greets with "அஸ்ஸலாமு அலைக்கும்".
 */
export function buildPresenterGreeting(lang: Lang, prefs?: StudioListenerPreferences): string {
  const goalNote =
    prefs?.optIn && prefs.learningGoals.length > 0
      ? lang === 'ta'
        ? ` நீங்கள் தேர்ந்தெடுத்த கற்றல் இலக்கு: ${prefs.learningGoals[0]}.`
        : lang === 'si'
          ? ` ඔබ තෝරාගත් ඉගෙනුම් ඉලක්කය: ${prefs.learningGoals[0]}.`
          : ` Your saved learning focus is ${prefs.learningGoals[0].toLowerCase()}.`
      : '';

  if (lang === 'ta') {
    return `அஸ்ஸலாமு அலைக்கும். Dragon Dawwa Studio-விற்கு வரவேற்கிறோம். நான் சகீனா — உருவாக்கப்பட்ட AI நிகழ்ச்சித் தொகுப்பாளர். குர்ஆன், ஹதீஸ் மற்றும் சரிபார்க்கப்பட்ட நூலக மூலங்களிலிருந்து அமைதியாகக் கேட்டுச் சிந்திப்போம்.${goalNote}`;
  }
  if (lang === 'si') {
    return `අස්සලාමු අලයිකුම්. Dragon Dawwa Studio වෙත සාදරයෙන් පිළිගනිමු. මම සකීනා — AI මගින් ජනනය කළ වැඩසටහන් ඉදිරිපත් කරන්නියයි. කුර්ආනය, හදීස් සහ සත්‍යාපිත මූලාශ්‍රවලින් සන්සුන්ව සවන් දී මෙනෙහි කරමු.${goalNote}`;
  }
  return `Assalamu Alaikum, and welcome to Dragon Dawwa Studio. I am Sakinah, your generated AI studio presenter. Take your time to listen, inspect every cited passage, and pause whenever a question comes to mind.${goalNote}`;
}

export function buildVoiceCapabilityReport(
  configured: boolean,
  models: string[] = ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'],
  voices: readonly string[] = ['Kore', 'Puck', 'Charon', 'Aoede', 'Zephyr', 'Fenrir', 'Orus'],
): VoiceCapabilityReport {
  const langs: Record<Lang, { supported: boolean; directionMode: string; note: string }> = {
    en: {
      supported: true,
      directionMode: 'Direct English transcript with optional speech_metadata style annotation',
      note: 'Supported by Gemini TTS models (Kore/Charon/Puck voices) when GEMINI_API_KEY is configured.',
    },
    ta: {
      supported: true,
      directionMode: 'Tamil Unicode script with speech_metadata direction "Speak in Tamil."',
      note: 'Supported by Gemini multilingual TTS; Tamil greeting enforces Assalamu Alaikum without Vanakkam.',
    },
    si: {
      supported: true,
      directionMode: 'Sinhala Unicode script with speech_metadata direction "Speak in Sinhala."',
      note: 'Supported by Gemini multilingual TTS when GEMINI_API_KEY is configured.',
    },
  };
  void LANGS;
  return {
    provider: 'Google Gemini Neural TTS',
    configured,
    blocker: configured
      ? null
      : 'GEMINI_API_KEY is not configured in this server environment (/api/health reports "ai": false). Live presenter speech synthesis is paused; full scripts, synchronized segment transcripts, live source research, and original Qur’an/meaning/scholar audio remain active.',
    models,
    voices,
    languages: langs,
    streaming: {
      supported: false,
      mode: 'Sentence-chunked WAV synthesis (up to 3 sentences per chunk) with 2-chunk lookahead prefetch. Raw WebSocket audio streaming is not used.',
    },
    voiceConsistency:
      'Consistent prebuilt voice assignment per presenter persona (Sakinah -> Kore, Tariq -> Charon) with in-memory WAV caching.',
    interruptions:
      'Immediate pause and monotonic run-token cancellation via the shared audio manager (src/lib/audio.ts); starting an answer or recitation stops active episode narration immediately.',
    audioFormats: ['audio/wav (24kHz 16-bit mono PCM wrapped in RIFF WAV)', 'audio/mpeg (external QuranEnc & AlQuran Cloud recitations and IslamHouse recordings)'],
    separationPolicy: {
      quran_recitation:
        'Played directly from verified qari recordings (AlQuran Cloud ar.alafasy / ar.husary / ar.minshawi). Never synthesized by presenter TTS.',
      meaning_audio:
        'Played only from QuranEnc verified edition audio manifests (english_rwwad, tamil_omar_brief, sinhalese_mahir) matching the exact translation edition.',
      original_recording:
        'Played directly from original scholar recordings on IslamHouse (d1.islamhouse.com) with speaker attribution. Generated intros/follow-ups are separate segments.',
      presenter_narration:
        'Synthesized only for generated presenter segments via approved Google/Gemini neural TTS (/api/voice/narrate) and clearly badged as generated narration.',
    },
  };
}

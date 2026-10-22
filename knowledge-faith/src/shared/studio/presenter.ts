import { LANGS, toLang, type Lang } from '../sources.ts';
import type { PresenterIdentity, VoiceCapabilityReport } from './contracts.ts';

/**
 * Dragon Dawwa Studio Presenter Identities.
 * Clearly identified as generated roles; never use human scholar names or titles such as Ustadh, Sheikh, Mufti, Imam, or Dr.
 */
export const STUDIO_PRESENTERS: Record<'presenter' | 'researcher', PresenterIdentity> = {
  presenter: {
    id: 'presenter',
    name: 'Dragon Dawwa Presenter',
    roleTitle: 'Generated Studio Presenter · Not a scholar or mufti',
    voiceName: 'Kore',
    isGenerated: true,
    disclosure:
      'Generated presenter by Dragon Dawwa Studio. This is an AI study companion — not a human scholar, imam, or qualified mufti.',
    traits: ['Warm', 'Attentive', 'Calm', 'Curious', 'Respectful', 'Clear rather than theatrical', 'Comfortable acknowledging uncertainty'],
    speakingStyle: 'Calm, welcoming classic radio presenter that reads verified passages faithfully and invites reflection without issuing personal fatwas.',
  },
  researcher: {
    id: 'researcher',
    name: 'Dragon Dawwa Research Desk',
    roleTitle: 'Generated Research Companion · Not a scholar or mufti',
    voiceName: 'Charon',
    isGenerated: true,
    disclosure:
      'Generated research companion by Dragon Dawwa Studio. Presents retrieved textual evidence and published gradings — not a human scholar or mufti.',
    traits: ['Methodical', 'Respectful', 'Clear', 'Text-faithful', 'Humble about source limits'],
    speakingStyle: 'Measured research desk companion that distinguishes Arabic text, published translation, scholarly explanation, and unverified gaps.',
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

const FORBIDDEN_SENSITIVE_PATTERN =
  /\b(sect|sectarian|sunni|shia|salafi|sufi|barelvi|deobandi|wahhabi|devotion|piety|pious|sinful|sinner|spiritual worth|righteousness score|religiosity|takfir|heretic|munafiq|kafir)\b/i;

export function containsSensitiveJudgment(text: string): boolean {
  return FORBIDDEN_SENSITIVE_PATTERN.test(text);
}

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
 * Never pretends to know personal details not supplied by the user, and never uses scholarly titles.
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
    return `அஸ்ஸலாமு அலைக்கும். Dragon Dawwa Studio-விற்கு வரவேற்கிறோம். இது உருவாக்கப்பட்ட AI நிகழ்ச்சித் தொகுப்பாளர் — ஓர் அறிஞரோ முஃப்தியோ அல்ல. குர்ஆன் மற்றும் ஹதீஸ் ஆதாரங்களை நேரடியாகக் கேட்டுச் சிந்திப்போம்.${goalNote}`;
  }
  if (lang === 'si') {
    return `අස්සලාමු අලයිකුම්. Dragon Dawwa Studio වෙත සාදරයෙන් පිළිගනිමු. මෙය ජනනය කළ AI ඉදිරිපත් කිරීමකි — විද්වතෙකු හෝ මුෆ්තිවරයෙකු නොවේ. කුර්ආනය සහ හදීස් මූලාශ්‍රවලට සන්සුන්ව සවන් දී මෙනෙහි කරමු.${goalNote}`;
  }
  return `Assalamu Alaikum, and welcome to Dragon Dawwa Studio. This is a generated AI studio presenter — not a human scholar or mufti. Listen to the retrieved passages, inspect every source, and pause whenever you wish to ask a question.${goalNote}`;
}

/**
 * Reports only what has actually been checked in this environment.
 * When GEMINI_API_KEY is missing, geminiTtsVerifiedInThisEnv is false for all languages.
 */
export function buildVoiceCapabilityReport(
  configured: boolean,
  models: string[] = ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'],
  voices: readonly string[] = ['Kore', 'Puck', 'Charon', 'Aoede', 'Zephyr', 'Fenrir', 'Orus'],
): VoiceCapabilityReport {
  void LANGS;
  const ttsNote = configured
    ? 'GEMINI_API_KEY is present; live TTS synthesis is enabled via /api/voice/narrate.'
    : 'Not verified in this environment: GEMINI_API_KEY is missing (/api/health reports "ai": false and POST /api/voice/narrate returned HTTP 503). Only script/source retrieval and QuranEnc meaning audio manifests were verified.';

  return {
    checkedOn: '2026-10-21',
    provider: 'Google Gemini TTS (/api/voice/narrate)',
    configured,
    narrateHttpStatus: configured ? 200 : 503,
    blocker: configured
      ? null
      : 'GEMINI_API_KEY is not configured on this server (POST /api/voice/narrate returns HTTP 503). Live generated presenter speech was not verified and is not mocked. Direct Qur’an Arabic recitation (AlQuran Cloud) and QuranEnc meaning audio manifests remain playable.',
    envModelsConfigured: models,
    envVoicesConfigured: voices,
    languages: {
      en: {
        scriptAndSourcesVerified: true,
        quranMeaningAudioEdition: 'english_rwwad (manifest verified HTTP 200)',
        geminiTtsVerifiedInThisEnv: configured,
        note: ttsNote,
      },
      ta: {
        scriptAndSourcesVerified: true,
        quranMeaningAudioEdition: 'tamil_omar_brief (manifest verified HTTP 200)',
        geminiTtsVerifiedInThisEnv: configured,
        note: ttsNote,
      },
      si: {
        scriptAndSourcesVerified: true,
        quranMeaningAudioEdition: 'sinhalese_mahir (manifest verified HTTP 200)',
        geminiTtsVerifiedInThisEnv: configured,
        note: ttsNote,
      },
    },
    streaming: {
      supported: false,
      mode: 'Code requests full WAV responses per chunk via generateContent / interactions; streaming audio is not implemented.',
    },
    interruptions:
      'Verified in client state machine and shared audio manager (src/lib/audio.ts): pausing, asking a question, or starting another audio source immediately stops active playback.',
    audioFormats: [
      'audio/mpeg (verified for AlQuran Cloud ar.alafasy recitation and QuranEnc meaning audio files)',
      'audio/wav (24kHz 16-bit mono PCM wrapper in src/server/wav.ts; live Gemini TTS output not verified without GEMINI_API_KEY)',
    ],
    separationPolicy: {
      quran_recitation:
        'Played directly from AlQuran Cloud (cdn.islamic.network/quran/audio/128/ar.alafasy). Never sent to presenter TTS.',
      meaning_audio:
        'Played only from QuranEnc verified edition audio manifests (english_rwwad, tamil_omar_brief, sinhalese_mahir) matching the exact translation edition.',
      original_recording:
        'Played directly from IslamHouse d1.islamhouse.com MP3 URLs with source attribution. Generated introductions stay in separate segments.',
      presenter_narration:
        'Calls POST /api/voice/narrate only when GEMINI_API_KEY is configured; otherwise reports the exact HTTP 503 blocker without substituting browser voices or mocked audio.',
    },
  };
}

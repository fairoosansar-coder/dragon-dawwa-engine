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
    return `அஸ்ஸலாமு அலைக்கும். வரவேற்கிறோம். இன்று நாம் உங்கள் கேள்வியுடன் அமைதியாக அமர்கிறோம்.${goalNote}`;
  }
  if (lang === 'si') {
    return `අස්සලාමු අලයිකුම්. සාදරයෙන් පිළිගනිමු. අද අපි ඔබේ ප්‍රශ්නය සමඟ සන්සුන්ව වාඩි වෙමු.${goalNote}`;
  }
  return `Assalamu Alaikum, and welcome. Today we sit with your question and talk it through as people.${goalNote}`;
}

export interface BuildVoiceStatusInput {
  geminiApiKeyConfigured: boolean;
  editorialAccountsConfigured?: boolean;
  models?: string[];
  voices?: readonly string[];
  liveManifestProbe?: Partial<Record<Lang, 'available' | 'unavailable'>>;
  checkedAt?: string;
}

/**
 * Strictly separates:
 * - `userMessage`: Simple user-facing message (no HTTP codes or env var names).
 * - `configuration`: What is configured in process environment/settings (no verification claim).
 * - `recordedTestEvidence`: Static notes from recorded test runs (explicitly labeled as historical, not live).
 * - `liveCapability`: Runtime state from actual checks (`unprobed` unless probed live; never hard-coded as verified).
 * - `diagnostics`: Technical HTTP codes (`200`, `503`) and environment-variable names (`GEMINI_API_KEY`, `GEMINI_TTS_MODELS`, `EDITORIAL_USERS`).
 */
export function buildVoiceCapabilityReport(input: BuildVoiceStatusInput | boolean): VoiceCapabilityReport {
  void LANGS;
  const opts: BuildVoiceStatusInput =
    typeof input === 'boolean' ? { geminiApiKeyConfigured: input } : input;

  const configured = opts.geminiApiKeyConfigured;
  const models = opts.models ?? ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];
  const voices = opts.voices ?? ['Kore', 'Puck', 'Charon', 'Aoede', 'Zephyr', 'Fenrir', 'Orus'];
  const checkedAt = opts.checkedAt ?? new Date().toISOString();
  const probed = Boolean(opts.liveManifestProbe);

  const userMessage = configured
    ? 'Spoken presenter narration is configured. Select Listen to play the programme, or Ask to pause and explore a question.'
    : 'Spoken presenter narration is not available right now. You can read the transcript, listen to the Qur’an recitation and meaning audio, and ask questions below.';

  return {
    userMessage,
    configuration: {
      provider: 'Google Gemini TTS',
      geminiApiKeyConfigured: configured,
      configuredTtsModels: models,
      configuredVoices: voices,
      meaningAudioEditionKeys: {
        en: 'english_rwwad',
        ta: 'tamil_omar_brief',
        si: 'sinhalese_mahir',
      },
      streamingImplemented: false,
    },
    recordedTestEvidence: {
      recordedOn: '2026-10-21',
      note: 'Historical test observations recorded during repository verification. These are not a live status check of the current request.',
      observations: [
        'QuranEnc audio manifests were recorded on 2026-10-21 for english_rwwad, tamil_omar_brief, and sinhalese_mahir.',
        'HadeethEnc records do not include an audio field on the record payload.',
        'Without GEMINI_API_KEY, presenter narration was not verified and is never replaced by mocked or browser-synthesized speech.',
      ],
    },
    liveCapability: {
      checkedAt,
      probedUpstream: probed,
      presenterNarration: configured ? 'configured_unprobed' : 'unavailable',
      quranRecitationStream: 'external_cdn_configured',
      meaningAudioManifests: {
        en: opts.liveManifestProbe?.en ?? 'unprobed',
        ta: opts.liveManifestProbe?.ta ?? 'unprobed',
        si: opts.liveManifestProbe?.si ?? 'unprobed',
      },
    },
    diagnostics: {
      envVars: {
        GEMINI_API_KEY: configured ? 'present' : 'missing',
        GEMINI_TTS_MODELS: models.join(','),
        EDITORIAL_USERS: opts.editorialAccountsConfigured ? 'present' : 'missing',
      },
      endpoints: {
        '/api/health': {
          httpStatus: 200,
          ai: configured,
        },
        '/api/voice/narrate': {
          httpStatus: configured ? 200 : 503,
          detail: configured
            ? 'GEMINI_API_KEY is present; upstream Gemini TTS call executes on POST /api/voice/narrate.'
            : 'HTTP 503: AI features are not configured on this server (GEMINI_API_KEY missing).',
        },
      },
    },
    separationPolicy: {
      quran_recitation:
        'Played directly from AlQuran Cloud (cdn.islamic.network/quran/audio/128/ar.alafasy). Never sent to presenter TTS.',
      meaning_audio:
        'Played only from QuranEnc edition audio manifests (english_rwwad, tamil_omar_brief, sinhalese_mahir) matching the exact translation edition.',
      original_recording:
        'Played directly from IslamHouse d1.islamhouse.com MP3 URLs with source attribution. Generated introductions stay in separate segments.',
      presenter_narration:
        'Calls POST /api/voice/narrate only when GEMINI_API_KEY is configured; otherwise reports unavailability without substituting browser voices or mocked audio.',
    },
  };
}

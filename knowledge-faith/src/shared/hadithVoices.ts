import type { Lang } from './sources.ts';

export type HadithVoiceProfileId = 'tariq' | 'yusuf' | 'noor';
export type HadithSpeechLang = 'ar' | Lang;
export type HadithPlaybackSpeed = 0.85 | 1 | 1.15;

export interface HadithVoiceProfile {
  id: HadithVoiceProfileId;
  label: string;
  shortLabel: string;
  title: string;
  elevenlabsVoiceId: string;
  geminiVoiceName: 'Orus' | 'Charon' | 'Kore' | 'Fenrir';
  gender: 'M' | 'F';
  arabicStyle: string;
  translationStyle: string;
}

export const ELEVENLABS_HADITH_MODELS = [
  'eleven_v4',
  'eleven_v3',
  'eleven_multilingual_v2',
  'eleven_turbo_v2_5',
] as const;

export type ElevenLabsModelId = (typeof ELEVENLABS_HADITH_MODELS)[number];

export const HADITH_PLAYBACK_SPEEDS: readonly HadithPlaybackSpeed[] = [0.85, 1, 1.15] as const;

export const HADITH_VOICE_PROFILES: readonly HadithVoiceProfile[] = [
  {
    id: 'tariq',
    label: 'Sheikh Tariq — Reverent Arabic & Multilingual',
    shortLabel: 'Sheikh Tariq',
    title: 'Reverent Classical Arabic Matn & Multilingual Narration',
    elevenlabsVoiceId: 'onwK4e9ZLuTAKqWW03F9',
    geminiVoiceName: 'Orus',
    gender: 'M',
    arabicStyle:
      'Reverent, articulate classical Arabic muhaddith reciting prophetic Hadith matn and isnad with clear tajwid-like diction, measured pauses, and scholarly dignity.',
    translationStyle:
      'Warm, measured, authoritative scholarly narrator delivering the Hadith translation with clarity and reverence.',
  },
  {
    id: 'yusuf',
    label: 'Ustadh Yusuf — Deep Scholarly',
    shortLabel: 'Ustadh Yusuf',
    title: 'Deep Scholarly Matn & Fiqh Explanation',
    elevenlabsVoiceId: 'N2lVS1w4EtoT3dr4eOWO',
    geminiVoiceName: 'Charon',
    gender: 'M',
    arabicStyle:
      'Deep, serene classical Arabic jurist reading the Hadith text with deliberate cadence and solemn clarity.',
    translationStyle:
      'Measured, calm, academic voice explaining the Hadith meaning and legal wisdom.',
  },
  {
    id: 'noor',
    label: 'Noor — Warm Clear',
    shortLabel: 'Noor',
    title: 'Warm Clear Multilingual Teacher',
    elevenlabsVoiceId: 'XB0fDUnXU5powFXDhCwa',
    geminiVoiceName: 'Kore',
    gender: 'F',
    arabicStyle:
      'Poised, crystal-clear classical Arabic teacher reading the prophetic narration with gentle precision.',
    translationStyle:
      'Warm, articulate educator reading the Hadith translation and lessons with clarity.',
  },
] as const;

export function resolveHadithVoiceProfile(id?: string | null): HadithVoiceProfile {
  if (!id) return HADITH_VOICE_PROFILES[0];
  const normalized = id.toLowerCase().trim();
  return (
    HADITH_VOICE_PROFILES.find(
      p => p.id === normalized || p.elevenlabsVoiceId.toLowerCase() === normalized,
    ) ?? HADITH_VOICE_PROFILES[0]
  );
}

export interface HadithTtsResponse {
  audioBase64: string;
  mimeType: string;
  voiceProfile: HadithVoiceProfileId;
  voiceLabel: string;
  modelUsed: string;
  engine: 'elevenlabs-v4' | 'elevenlabs' | 'gemini-tts' | 'neural-stream';
  lang: HadithSpeechLang;
  cached: boolean;
}

export interface HadithTtsStatusResponse {
  configured: boolean;
  elevenlabsConfigured: boolean;
  geminiConfigured: boolean;
  defaultModel: 'eleven_v4';
  fallbackModels: readonly string[];
  voices: readonly HadithVoiceProfile[];
  supportedLanguages: readonly HadithSpeechLang[];
}

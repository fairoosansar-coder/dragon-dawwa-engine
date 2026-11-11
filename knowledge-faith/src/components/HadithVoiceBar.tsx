import { useEffect, useState } from 'react';
import { Headphones, Loader2, Pause, Play, Sparkles, Volume2 } from 'lucide-react';
import {
  base64ToObjectUrl,
  pauseAudio,
  playAudio,
  resumeAudio,
  setAudioPlaybackRate,
  useAudioState,
} from '../lib/audio.ts';
import { useStored } from '../lib/store.tsx';
import {
  HADITH_PLAYBACK_SPEEDS,
  HADITH_VOICE_PROFILES,
  resolveHadithVoiceProfile,
  type HadithPlaybackSpeed,
  type HadithSpeechLang,
  type HadithTtsResponse,
  type HadithVoiceProfileId,
} from '../shared/hadithVoices.ts';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';

const clientAudioUrlCache = new Map<string, string>();

async function requestHadithAudioUrl(
  text: string,
  lang: HadithSpeechLang,
  voiceProfile: HadithVoiceProfileId,
  speed: HadithPlaybackSpeed,
): Promise<string | null> {
  const clean = text.trim().slice(0, 2600);
  if (!clean) return null;
  const cacheKey = `${voiceProfile}|${lang}|${speed}|${clean}`;
  const existing = clientAudioUrlCache.get(cacheKey);
  if (existing) return existing;

  try {
    const res = await fetch('/api/tts/hadith', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: clean,
        lang,
        voiceProfile,
        speed,
        modelId: 'eleven_v4',
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as HadithTtsResponse;
    if (!payload?.audioBase64) return null;
    const url = base64ToObjectUrl(payload.audioBase64, payload.mimeType || 'audio/mpeg');
    clientAudioUrlCache.set(cacheKey, url);
    return url;
  } catch {
    return null;
  }
}

function speakWithBrowserFallback(
  text: string,
  lang: HadithSpeechLang,
  speed: HadithPlaybackSpeed,
  onDone?: () => void,
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang =
      lang === 'ar'
        ? 'ar-SA'
        : lang === 'ta'
          ? 'ta-IN'
          : lang === 'si'
            ? 'si-LK'
            : 'en-US';
    utterance.rate = speed;
    if (onDone) {
      utterance.onend = () => onDone();
      utterance.onerror = () => onDone();
    }
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export type ActiveHadithSpeechPart = 'arabic' | 'translation' | null;

export function HadithVoiceBar({
  hadithKey,
  arabicText,
  translationText,
  explanationText,
  lang,
  variant = 'light',
  compact = false,
  onActivePartChange,
}: {
  hadithKey: string;
  arabicText?: string | null;
  translationText?: string | null;
  explanationText?: string | null;
  lang: Lang;
  variant?: 'light' | 'dark';
  compact?: boolean;
  onActivePartChange?: (part: ActiveHadithSpeechPart) => void;
}) {
  const audio = useAudioState();
  const [voiceProfile, setVoiceProfile] = useStored<HadithVoiceProfileId>(
    'kf-hadith-voice-profile',
    'tariq',
  );
  const [speed, setSpeed] = useStored<HadithPlaybackSpeed>('kf-hadith-voice-speed', 1);
  const [loadingTarget, setLoadingTarget] = useState<'arabic' | 'translation' | 'both' | null>(null);

  const arabicAudioId = `hadith-v4-ar-${hadithKey}`;
  const translationAudioId = `hadith-v4-tr-${hadithKey}`;
  const bothArabicAudioId = `hadith-v4-both-ar-${hadithKey}`;
  const bothTranslationAudioId = `hadith-v4-both-tr-${hadithKey}`;

  const isArabicPlaying =
    (audio.id === arabicAudioId || audio.id === bothArabicAudioId) &&
    (audio.status === 'playing' || audio.status === 'loading');
  const isArabicPaused =
    (audio.id === arabicAudioId || audio.id === bothArabicAudioId) && audio.status === 'paused';

  const isTranslationPlaying =
    (audio.id === translationAudioId || audio.id === bothTranslationAudioId) &&
    (audio.status === 'playing' || audio.status === 'loading');
  const isTranslationPaused =
    (audio.id === translationAudioId || audio.id === bothTranslationAudioId) &&
    audio.status === 'paused';

  const isBothPlaying =
    (audio.id === bothArabicAudioId || audio.id === bothTranslationAudioId) &&
    (audio.status === 'playing' || audio.status === 'loading');

  useEffect(() => {
    if (!onActivePartChange) return;
    if (isArabicPlaying) onActivePartChange('arabic');
    else if (isTranslationPlaying) onActivePartChange('translation');
    else onActivePartChange(null);
  }, [isArabicPlaying, isTranslationPlaying, onActivePartChange]);

  const arabicClean = (arabicText ?? '').trim();
  const translationCombined = [translationText?.trim(), explanationText?.trim()]
    .filter(Boolean)
    .join('. ');

  const profile = resolveHadithVoiceProfile(voiceProfile);
  const langName = LANGUAGE_NAMES[lang]?.native ?? 'English';

  const handleSpeedChange = (nextSpeed: HadithPlaybackSpeed) => {
    setSpeed(nextSpeed);
    setAudioPlaybackRate(nextSpeed);
  };

  const handlePlayArabic = async () => {
    if (!arabicClean) return;
    if (audio.id === arabicAudioId && audio.status === 'playing') {
      pauseAudio();
      return;
    }
    if (audio.id === arabicAudioId && audio.status === 'paused') {
      setAudioPlaybackRate(speed);
      resumeAudio();
      return;
    }
    setLoadingTarget('arabic');
    setAudioPlaybackRate(speed);
    const url = await requestHadithAudioUrl(arabicClean, 'ar', profile.id, speed);
    setLoadingTarget(null);
    if (url) {
      await playAudio(arabicAudioId, url);
    } else {
      speakWithBrowserFallback(arabicClean, 'ar', speed);
    }
  };

  const handlePlayTranslation = async () => {
    if (!translationCombined) return;
    if (audio.id === translationAudioId && audio.status === 'playing') {
      pauseAudio();
      return;
    }
    if (audio.id === translationAudioId && audio.status === 'paused') {
      setAudioPlaybackRate(speed);
      resumeAudio();
      return;
    }
    setLoadingTarget('translation');
    setAudioPlaybackRate(speed);
    const url = await requestHadithAudioUrl(translationCombined, lang, profile.id, speed);
    setLoadingTarget(null);
    if (url) {
      await playAudio(translationAudioId, url);
    } else {
      speakWithBrowserFallback(translationCombined, lang, speed);
    }
  };

  const handlePlayBoth = async () => {
    if (isBothPlaying) {
      pauseAudio();
      return;
    }
    if (!arabicClean && translationCombined) {
      await handlePlayTranslation();
      return;
    }
    if (arabicClean && !translationCombined) {
      await handlePlayArabic();
      return;
    }
    if (!arabicClean && !translationCombined) return;

    setLoadingTarget('both');
    setAudioPlaybackRate(speed);
    const [arUrl, trUrl] = await Promise.all([
      requestHadithAudioUrl(arabicClean, 'ar', profile.id, speed),
      requestHadithAudioUrl(translationCombined, lang, profile.id, speed),
    ]);
    setLoadingTarget(null);

    if (arUrl && trUrl) {
      await playAudio(bothArabicAudioId, arUrl, () => {
        setAudioPlaybackRate(speed);
        void playAudio(bothTranslationAudioId, trUrl);
      });
    } else if (arUrl) {
      await playAudio(bothArabicAudioId, arUrl, () => {
        speakWithBrowserFallback(translationCombined, lang, speed);
      });
    } else {
      speakWithBrowserFallback(arabicClean, 'ar', speed, () => {
        speakWithBrowserFallback(translationCombined, lang, speed);
      });
    }
  };

  const isDark = variant === 'dark';

  return (
    <div
      data-testid="hadith-voice-selector"
      data-hadith-voice-bar={hadithKey}
      style={{
        backgroundColor: isDark ? 'rgba(4, 27, 20, 0.86)' : '#F8F5EC',
        color: isDark ? '#FBF9F5' : '#1C1917',
      }}
      className={`rounded-2xl border p-3 transition ${
        isDark
          ? 'border-[#E7C98A]/35 bg-[#041B14]/85 text-[#FBF9F5]'
          : 'border-[#0E382B]/15 bg-[#F8F5EC] text-stone-900'
      }`}
    >
      {/* Top Row: ElevenLabs v4 Badge + Voice Selector + Speed Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            style={{
              backgroundColor: isDark ? 'rgba(231, 201, 138, 0.18)' : '#073C30',
              color: isDark ? '#F9E7B9' : '#F9E7B9',
            }}
            className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/45 px-2.5 py-0.5 text-[11px] font-bold tracking-wide"
          >
            <Sparkles className="h-3 w-3 text-[#D4AF37]" aria-hidden />
            <span>ElevenLabs v4 Voice</span>
          </span>

          {!compact && (
            <label className="inline-flex items-center gap-1.5 text-xs font-medium">
              <span className="sr-only">Select Hadith Voice Profile</span>
              <select
                data-testid="hadith-voice-profile-select"
                aria-label="Hadith voice profile"
                value={profile.id}
                onChange={e => setVoiceProfile(e.target.value as HadithVoiceProfileId)}
                style={{
                  backgroundColor: isDark ? '#0A3528' : '#FFFFFF',
                  color: isDark ? '#FBF9F5' : '#1C1917',
                }}
                className={`rounded-xl border px-2.5 py-1 text-xs font-semibold outline-none ${
                  isDark
                    ? 'border-[#E7C98A]/40 bg-[#0A3528] text-[#FBF9F5]'
                    : 'border-stone-300 bg-white text-stone-900'
                }`}
              >
                {HADITH_VOICE_PROFILES.map(v => (
                  <option
                    key={v.id}
                    value={v.id}
                    style={{ backgroundColor: '#FFFFFF', color: '#1C1917' }}
                  >
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Speed Selector Pills (0.85x, 1x, 1.15x) */}
        <div
          role="group"
          aria-label="Playback speed"
          className="inline-flex items-center gap-1 rounded-xl border border-[#D4AF37]/30 bg-black/10 p-0.5"
        >
          {HADITH_PLAYBACK_SPEEDS.map(rate => {
            const active = speed === rate;
            return (
              <button
                key={rate}
                type="button"
                data-testid={`hadith-voice-speed-${rate}`}
                aria-pressed={active}
                onClick={() => handleSpeedChange(rate)}
                style={{
                  backgroundColor: active ? '#D4AF37' : 'transparent',
                  color: active ? '#041B14' : isDark ? '#FBF9F5' : '#1C1917',
                }}
                className="rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold transition cursor-pointer"
              >
                {rate}x
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: 1-Tap Action Buttons (Read Arabic · Read Translation · Arabic + Translation) */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {arabicClean && (
          <button
            type="button"
            data-testid="hadith-play-arabic-btn"
            aria-pressed={isArabicPlaying}
            onClick={() => void handlePlayArabic()}
            style={{
              backgroundColor: isArabicPlaying
                ? '#D4AF37'
                : isDark
                  ? '#FBF9F5'
                  : '#073C30',
              color: isArabicPlaying
                ? '#041B14'
                : isDark
                  ? '#073C30'
                  : '#FFFFFF',
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-2xs transition cursor-pointer hover:opacity-95"
          >
            {loadingTarget === 'arabic' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : isArabicPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            )}
            <span>
              {isArabicPlaying
                ? 'Pause Arabic (عربي)'
                : isArabicPaused
                  ? 'Resume Arabic (عربي)'
                  : 'Read Arabic (عربي)'}
            </span>
          </button>
        )}

        {translationCombined && (
          <button
            type="button"
            data-testid="hadith-play-translation-btn"
            aria-pressed={isTranslationPlaying}
            onClick={() => void handlePlayTranslation()}
            style={{
              backgroundColor: isTranslationPlaying
                ? '#D4AF37'
                : isDark
                  ? '#0E4D3B'
                  : '#FFFFFF',
              color: isTranslationPlaying
                ? '#041B14'
                : isDark
                  ? '#FFFFFF'
                  : '#073C30',
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-2xs transition cursor-pointer ${
              isDark ? 'border-[#E7C98A]/50' : 'border-[#073C30]/35'
            }`}
          >
            {loadingTarget === 'translation' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : isTranslationPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
            ) : (
              <Volume2 className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>
              {isTranslationPlaying
                ? `Pause ${langName}`
                : isTranslationPaused
                  ? `Resume ${langName}`
                  : `Read Translation (${langName})`}
            </span>
          </button>
        )}

        {arabicClean && translationCombined && (
          <button
            type="button"
            data-testid="hadith-play-both-btn"
            aria-pressed={isBothPlaying}
            onClick={() => void handlePlayBoth()}
            style={{
              backgroundColor: isBothPlaying
                ? '#D4AF37'
                : isDark
                  ? 'rgba(231, 201, 138, 0.16)'
                  : '#EFE9DA',
              color: isBothPlaying
                ? '#041B14'
                : isDark
                  ? '#F9E7B9'
                  : '#073C30',
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 px-3.5 py-1.5 text-xs font-bold transition cursor-pointer hover:border-[#D4AF37]"
          >
            {loadingTarget === 'both' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : isBothPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
            ) : (
              <Headphones className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>
              {isBothPlaying ? 'Playing Arabic + Translation…' : 'Arabic + Translation'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

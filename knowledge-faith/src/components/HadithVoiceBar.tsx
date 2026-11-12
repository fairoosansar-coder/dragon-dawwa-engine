import { useEffect } from 'react';
import {
  BookOpen,
  Headphones,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { setAudioPlaybackRate } from '../lib/audio.ts';
import { splitTextIntoSpeechLines, useLineByLineTts } from '../lib/lineByLineTts.ts';
import { useStored } from '../lib/store.tsx';
import {
  HADITH_PLAYBACK_SPEEDS,
  HADITH_VOICE_PROFILES,
  resolveHadithVoiceProfile,
  type HadithPlaybackSpeed,
  type HadithSpeechLang,
  type HadithVoiceProfileId,
} from '../shared/hadithVoices.ts';
import { segmentHadithRecord } from '../shared/hadithSegmentation.ts';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';

export type ActiveHadithSpeechPart = 'arabic' | 'translation' | 'explanation' | 'lessons' | null;
export type HadithTtsScopeMode = 'matn' | 'full';

export function HadithVoiceBar({
  hadithKey,
  arabicText,
  translationText,
  explanationText,
  lessonsList,
  lang,
  variant = 'light',
  compact = false,
  onActivePartChange,
  onActiveLineChange,
}: {
  hadithKey: string;
  arabicText?: string | null;
  translationText?: string | null;
  explanationText?: string | null;
  lessonsList?: string[] | null;
  lang: Lang;
  variant?: 'light' | 'dark';
  compact?: boolean;
  onActivePartChange?: (part: ActiveHadithSpeechPart) => void;
  onActiveLineChange?: (info: {
    part: ActiveHadithSpeechPart;
    lineIndex: number;
    lineText: string | null;
  }) => void;
}) {
  const [voiceProfile, setVoiceProfile] = useStored<HadithVoiceProfileId>(
    'kf-hadith-voice-profile',
    'tariq',
  );
  const [speed, setSpeed] = useStored<HadithPlaybackSpeed>('kf-hadith-voice-speed', 1);
  const [ttsMode, setTtsMode] = useStored<HadithTtsScopeMode>('kf-hadith-tts-mode', 'matn');

  const segmented = segmentHadithRecord({
    arabic: arabicText,
    text: translationText,
    lang,
  });
  const hasSeparatedChain = Boolean(
    segmented.arabic.isnad || segmented.translation.companion_attribution,
  );

  const sessionPrefix = `hadith-v4:${hadithKey}:`;
  const arSessionId = `${sessionPrefix}arabic`;
  const trSessionId = `${sessionPrefix}translation`;
  const exSessionId = `${sessionPrefix}explanation`;
  const lsSessionId = `${sessionPrefix}lessons`;
  const bothSessionId = `${sessionPrefix}both`;

  const lineTts = useLineByLineTts(sessionPrefix);

  const activePart: ActiveHadithSpeechPart = !lineTts.active
    ? null
    : lineTts.sessionId === arSessionId
      ? 'arabic'
      : lineTts.sessionId === trSessionId
        ? 'translation'
        : lineTts.sessionId === exSessionId
          ? 'explanation'
          : lineTts.sessionId === lsSessionId
            ? 'lessons'
            : lineTts.sessionId === bothSessionId
              ? 'translation'
              : null;

  useEffect(() => {
    onActivePartChange?.(activePart);
    onActiveLineChange?.({
      part: activePart,
      lineIndex: lineTts.currentIndex,
      lineText: lineTts.currentLineText,
    });
  }, [activePart, lineTts.currentIndex, lineTts.currentLineText, onActivePartChange, onActiveLineChange]);

  const arabicClean =
    ttsMode === 'matn' && segmented.audio_targets.elevenlabs_short
      ? segmented.audio_targets.elevenlabs_short.trim()
      : (arabicText ?? '').trim();
  const translationClean =
    ttsMode === 'matn' && segmented.audio_targets.translation_short
      ? segmented.audio_targets.translation_short.trim()
      : (translationText ?? '').trim();
  const explanationClean = (explanationText ?? '').trim();
  const lessonsClean = (lessonsList ?? []).map(s => s.trim()).filter(Boolean).join('\n');

  const profile = resolveHadithVoiceProfile(voiceProfile);
  const langName = LANGUAGE_NAMES[lang]?.native ?? 'English';

  const handleSpeedChange = (nextSpeed: HadithPlaybackSpeed) => {
    setSpeed(nextSpeed);
    setAudioPlaybackRate(nextSpeed);
  };

  const togglePart = async (
    targetSessionId: string,
    textToRead: string,
    speechLang: HadithSpeechLang,
    onComplete?: () => void,
  ) => {
    if (!textToRead.trim()) return;
    if (lineTts.sessionId === targetSessionId && lineTts.status === 'playing') {
      lineTts.pause();
      return;
    }
    if (lineTts.sessionId === targetSessionId && lineTts.status === 'paused') {
      await lineTts.jumpToLine(Math.max(0, lineTts.currentIndex));
      return;
    }
    setAudioPlaybackRate(speed);
    await lineTts.start({
      sessionId: targetSessionId,
      lines: splitTextIntoSpeechLines(textToRead),
      lang: speechLang,
      voiceProfile: profile.id,
      speed,
      onComplete,
    });
  };

  const handlePlayArabic = () => void togglePart(arSessionId, arabicClean, 'ar');

  const handlePlayTranslation = () => void togglePart(trSessionId, translationClean, lang);

  const handlePlayExplanation = () => void togglePart(exSessionId, explanationClean, lang);

  const handlePlayLessons = () => void togglePart(lsSessionId, lessonsClean, lang);

  const handlePlayBoth = async () => {
    if (
      (lineTts.sessionId === bothSessionId || lineTts.sessionId === `${bothSessionId}-ar`) &&
      lineTts.status === 'playing'
    ) {
      lineTts.pause();
      return;
    }
    const fullTargetText = [translationClean, explanationClean, lessonsClean]
      .filter(Boolean)
      .join('\n');
    if (arabicClean && fullTargetText) {
      setAudioPlaybackRate(speed);
      await lineTts.start({
        sessionId: `${bothSessionId}-ar`,
        lines: splitTextIntoSpeechLines(arabicClean),
        lang: 'ar',
        voiceProfile: profile.id,
        speed,
        onComplete: () => {
          void lineTts.start({
            sessionId: bothSessionId,
            lines: splitTextIntoSpeechLines(fullTargetText),
            lang,
            voiceProfile: profile.id,
            speed,
          });
        },
      });
    } else if (fullTargetText) {
      await togglePart(bothSessionId, fullTargetText, lang);
    } else if (arabicClean) {
      await togglePart(arSessionId, arabicClean, 'ar');
    }
  };

  const isDark = variant === 'dark';
  const isArPlaying = lineTts.sessionId === arSessionId && lineTts.status === 'playing';
  const isTrPlaying = lineTts.sessionId === trSessionId && lineTts.status === 'playing';
  const isExPlaying = lineTts.sessionId === exSessionId && lineTts.status === 'playing';
  const isLsPlaying = lineTts.sessionId === lsSessionId && lineTts.status === 'playing';
  const isBothPlaying =
    (lineTts.sessionId === bothSessionId || lineTts.sessionId === `${bothSessionId}-ar`) &&
    lineTts.status === 'playing';

  return (
    <div
      data-testid="hadith-voice-selector"
      data-hadith-voice-bar={hadithKey}
      style={{
        backgroundColor: isDark ? 'rgba(4, 27, 20, 0.88)' : '#F8F5EC',
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
              color: '#F9E7B9',
            }}
            className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/45 px-2.5 py-0.5 text-[11px] font-bold tracking-wide"
          >
            <Sparkles className="h-3 w-3 text-[#D4AF37]" aria-hidden />
            <span>ElevenLabs v4 Voice · Line-by-Line</span>
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

        {/* Mode B (Matn Only) vs Mode A (Full Chain) + Speed Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {hasSeparatedChain && (
            <div
              role="group"
              aria-label="Hadith recitation scope"
              data-testid="hadith-tts-mode-toggle"
              className="inline-flex items-center gap-0.5 rounded-xl border border-[#D4AF37]/35 bg-black/10 p-0.5"
            >
              <button
                type="button"
                data-testid="hadith-tts-mode-matn"
                aria-pressed={ttsMode === 'matn'}
                onClick={() => setTtsMode('matn')}
                style={{
                  backgroundColor: ttsMode === 'matn' ? '#073C30' : 'transparent',
                  color: ttsMode === 'matn' ? '#F9E7B9' : isDark ? '#FBF9F5' : '#1C1917',
                }}
                className="rounded-lg px-2 py-0.5 text-[11px] font-bold transition cursor-pointer"
                title="Mode B: Recite only the core Prophetic Matn (saves 40–60% voice quota)"
              >
                {lang === 'ta'
                  ? 'சுருக்கமான மத்ன் (Matn Only)'
                  : lang === 'si'
                    ? 'මූලික හදීස් පාඨය (Matn Only)'
                    : 'Matn Only'}
              </button>
              <button
                type="button"
                data-testid="hadith-tts-mode-full"
                aria-pressed={ttsMode === 'full'}
                onClick={() => setTtsMode('full')}
                style={{
                  backgroundColor: ttsMode === 'full' ? '#073C30' : 'transparent',
                  color: ttsMode === 'full' ? '#F9E7B9' : isDark ? '#FBF9F5' : '#1C1917',
                }}
                className="rounded-lg px-2 py-0.5 text-[11px] font-bold transition cursor-pointer"
                title="Mode A: Recite Full Narrator Chain (Isnad) + Prophetic Matn"
              >
                {lang === 'ta'
                  ? 'இஸ்னாத் + மத்ன் (Full Chain)'
                  : lang === 'si'
                    ? 'සම්පූර්ණ දාමය (Full Chain)'
                    : 'Full Chain (Isnad + Matn)'}
              </button>
            </div>
          )}

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
      </div>

      {/* Action Buttons Row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {arabicClean && (
          <button
            type="button"
            data-testid="hadith-play-arabic-btn"
            aria-pressed={isArPlaying}
            onClick={handlePlayArabic}
            style={{
              backgroundColor: isArPlaying ? '#D4AF37' : isDark ? '#FBF9F5' : '#073C30',
              color: isArPlaying ? '#041B14' : isDark ? '#073C30' : '#FFFFFF',
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-2xs transition cursor-pointer hover:opacity-95"
          >
            {lineTts.sessionId === arSessionId && lineTts.status === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : isArPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            )}
            <span>{isArPlaying ? 'Pause Arabic (عربي)' : 'Read Arabic (عربي)'}</span>
          </button>
        )}

        {translationClean && (
          <button
            type="button"
            data-testid="hadith-play-translation-btn"
            aria-pressed={isTrPlaying}
            onClick={handlePlayTranslation}
            style={{
              backgroundColor: isTrPlaying ? '#D4AF37' : isDark ? '#0E4D3B' : '#FFFFFF',
              color: isTrPlaying ? '#041B14' : isDark ? '#FFFFFF' : '#073C30',
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-2xs transition cursor-pointer ${
              isDark ? 'border-[#E7C98A]/50' : 'border-[#073C30]/35'
            }`}
          >
            {lineTts.sessionId === trSessionId && lineTts.status === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : isTrPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
            ) : (
              <Volume2 className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>
              {isTrPlaying ? `Pause ${langName}` : `Read Translation (${langName})`}
            </span>
          </button>
        )}

        {explanationClean && (
          <button
            type="button"
            data-testid="hadith-play-explanation-btn"
            aria-pressed={isExPlaying}
            onClick={handlePlayExplanation}
            style={{
              backgroundColor: isExPlaying ? '#D4AF37' : isDark ? '#0E4D3B' : '#FFFFFF',
              color: isExPlaying ? '#041B14' : isDark ? '#FFFFFF' : '#073C30',
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-2xs transition cursor-pointer ${
              isDark ? 'border-[#E7C98A]/50' : 'border-[#073C30]/35'
            }`}
          >
            {lineTts.sessionId === exSessionId && lineTts.status === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : isExPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
            ) : (
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>
              {isExPlaying ? `Pause Explanation` : `Read Explanation (${langName})`}
            </span>
          </button>
        )}

        {lessonsClean && (
          <button
            type="button"
            data-testid="hadith-play-lessons-btn"
            aria-pressed={isLsPlaying}
            onClick={handlePlayLessons}
            style={{
              backgroundColor: isLsPlaying ? '#D4AF37' : isDark ? '#0E4D3B' : '#FFFFFF',
              color: isLsPlaying ? '#041B14' : isDark ? '#FFFFFF' : '#073C30',
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-2xs transition cursor-pointer ${
              isDark ? 'border-[#E7C98A]/50' : 'border-[#073C30]/35'
            }`}
          >
            {lineTts.sessionId === lsSessionId && lineTts.status === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : isLsPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>
              {isLsPlaying ? `Pause Lessons` : `Read Lessons (${langName})`}
            </span>
          </button>
        )}

        {arabicClean && (translationClean || explanationClean) && (
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
            {isBothPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
            ) : (
              <Headphones className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>
              {isBothPlaying ? 'Playing Full Hadith…' : 'Arabic + Translation'}
            </span>
          </button>
        )}
      </div>

      {/* Active Line-by-Line Progress Strip */}
      {lineTts.active && (
        <div
          data-testid="line-tts-progress-strip"
          style={{
            backgroundColor: isDark ? 'rgba(3, 24, 18, 0.85)' : '#FFFFFF',
            color: isDark ? '#F9E7B9' : '#073C30',
          }}
          className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D4AF37]/40 px-3 py-1.5 text-xs"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
            <span className="font-mono text-[11px] font-bold">
              Reading Line {lineTts.currentIndex + 1} of {lineTts.lines.length}
            </span>
            {lineTts.nextLineReady && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Next line ready
              </span>
            )}
            {lineTts.currentLineText && (
              <span className="hidden truncate text-[11px] opacity-80 sm:inline">
                — “{lineTts.currentLineText}”
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Previous line"
              disabled={lineTts.currentIndex <= 0}
              onClick={() => void lineTts.jumpToLine(lineTts.currentIndex - 1)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-stone-300/60 disabled:opacity-40 cursor-pointer"
            >
              <SkipBack className="h-3 w-3" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next line"
              disabled={lineTts.currentIndex + 1 >= lineTts.lines.length}
              onClick={() => void lineTts.jumpToLine(lineTts.currentIndex + 1)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-stone-300/60 disabled:opacity-40 cursor-pointer"
            >
              <SkipForward className="h-3 w-3" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Stop reading"
              onClick={() => lineTts.stop()}
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-300/60 text-red-600 cursor-pointer"
            >
              <Square className="h-3 w-3 fill-current" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

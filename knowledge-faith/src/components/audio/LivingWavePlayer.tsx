import { useEffect, useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Pause, Play, Sparkles } from 'lucide-react';
import {
  getAudioPlaybackRate,
  pauseAudio,
  playAudio,
  seekAudio,
  setAudioPlaybackRate,
  useAudioState,
} from '../../lib/audio.ts';
import type { Lang } from '../../shared/sources.ts';
import { AudioLoadingSpinner, loadingAudioLabel } from '../AudioLoadingSpinner.tsx';

const SPEED_OPTIONS = [1, 1.15, 0.85] as const;

export function parseDurationSeconds(label?: string): number {
  if (!label) return 350;
  const parts = label.trim().split(':').map(Number);
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return Math.max(1, parts[0] * 60 + parts[1]);
  }
  return 350;
}

export function formatClockLabel(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function localizedStudioLabel(lang: Lang | string | undefined, isPlaying: boolean): string {
  if (lang === 'ta') {
    return isPlaying ? 'உயிரோட்டமான ஒலி அலை · ஒலிக்கிறது' : 'உயிரோட்டமான ஒலி அலை';
  }
  if (lang === 'si') {
    return isPlaying ? 'සජීවී හඬ තරංගය · වාදනය වේ' : 'සජීවී හඬ තරංගය';
  }
  return isPlaying ? 'LIVE HARMONIC STREAM' : 'LIVING AUDIO STUDIO';
}

interface WaveGeometry {
  primaryStroke: string;
  primaryArea: string;
  mirrorStroke: string;
  secondaryStroke: string;
  secondaryArea: string;
  crestNodes: Array<{ x: number; y: number; r: number }>;
  playheadY: number;
}

function buildHarmonicPaths(
  phase: number,
  isPlaying: boolean,
  progressRatio: number,
  seedOffset: number,
): WaveGeometry {
  const width = 360;
  const midY = 27;
  const steps = 48;
  const dx = width / steps;

  const ampScale = isPlaying ? 1.0 : 0.58;
  const primaryPts: Array<{ x: number; y: number }> = [];
  const mirrorPts: Array<{ x: number; y: number }> = [];
  const secondaryPts: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const x = i * dx;
    const norm = i / steps;
    // Window envelope so the wave tapers gracefully at both ends
    const envelope = Math.sin(norm * Math.PI);
    const edgeBoost = 0.22 + 0.78 * envelope;

    const w1 = Math.sin(norm * Math.PI * 5.5 + phase + seedOffset) * 10.5;
    const w2 = Math.sin(norm * Math.PI * 11.0 - phase * 1.45 + seedOffset * 0.7) * 5.2;
    const w3 = Math.cos(norm * Math.PI * 3.0 + phase * 0.8) * 3.8;
    const deltaPrimary = (w1 + w2 + w3) * edgeBoost * ampScale;

    const yPrimary = Number((midY - deltaPrimary).toFixed(2));
    const yMirror = Number((midY + deltaPrimary * 0.68).toFixed(2));

    const c1 = Math.sin(norm * Math.PI * 4.5 - phase * 1.15 + 1.2 + seedOffset) * 8.5;
    const c2 = Math.cos(norm * Math.PI * 8.5 + phase * 1.6) * 4.4;
    const deltaSecondary = (c1 + c2) * edgeBoost * (isPlaying ? 0.92 : 0.52);
    const ySecondary = Number((midY - deltaSecondary).toFixed(2));

    primaryPts.push({ x: Number(x.toFixed(2)), y: yPrimary });
    mirrorPts.push({ x: Number(x.toFixed(2)), y: yMirror });
    secondaryPts.push({ x: Number(x.toFixed(2)), y: ySecondary });
  }

  const toSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cx = Number(((prev.x + curr.x) / 2).toFixed(2));
      d += ` Q ${prev.x} ${prev.y}, ${cx} ${Number(((prev.y + curr.y) / 2).toFixed(2))}`;
    }
    const last = pts[pts.length - 1];
    d += ` T ${last.x} ${last.y}`;
    return d;
  };

  const primaryStroke = toSmoothPath(primaryPts);
  const mirrorStroke = toSmoothPath(mirrorPts);
  const secondaryStroke = toSmoothPath(secondaryPts);

  const reverseMirror = [...mirrorPts]
    .reverse()
    .map(p => `L ${p.x} ${p.y}`)
    .join(' ');
  const primaryArea = `${primaryStroke} ${reverseMirror} Z`;
  const secondaryArea = `${secondaryStroke} L ${width} ${midY} L 0 ${midY} Z`;

  const crestNodes: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 4; i < steps; i += 6) {
    const pt = primaryPts[i];
    if (pt) {
      crestNodes.push({
        x: pt.x,
        y: pt.y,
        r: i % 12 === 4 ? 2.1 : 1.5,
      });
    }
  }

  const playheadIdx = Math.min(
    steps,
    Math.max(0, Math.round(Math.max(0, Math.min(1, progressRatio)) * steps)),
  );
  const playheadY = primaryPts[playheadIdx]?.y ?? midY;

  return {
    primaryStroke,
    primaryArea,
    mirrorStroke,
    secondaryStroke,
    secondaryArea,
    crestNodes,
    playheadY,
  };
}

export interface LivingWaveExternalControl {
  isPlaying: boolean;
  isLoading?: boolean;
  currentTime: number;
  duration: number;
  onToggle: () => void;
  onSeek?: (targetSeconds: number) => void;
  rate?: number;
  onRateChange?: (nextRate: number) => void;
}

export interface LivingWavePlayerProps {
  audioId: string;
  audioUrl?: string;
  durationLabel?: string;
  lang?: Lang | string;
  speakerLabel?: string;
  playButtonDataId?: string;
  externalControl?: LivingWaveExternalControl;
  compact?: boolean;
  className?: string;
}

export function LivingWavePlayer({
  audioId,
  audioUrl = 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',
  durationLabel = '05:50',
  lang = 'en',
  speakerLabel,
  playButtonDataId,
  externalControl,
  compact = false,
  className = '',
}: LivingWavePlayerProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sharedAudio = useAudioState();
  const stageRef = useRef<SVGSVGElement | null>(null);

  const isActiveShared = !externalControl && sharedAudio.id === audioId;
  const isPlaying = externalControl
    ? externalControl.isPlaying
    : isActiveShared && sharedAudio.status === 'playing';
  const isLoading = externalControl
    ? Boolean(externalControl.isLoading)
    : isActiveShared && sharedAudio.status === 'loading';

  const fallbackTotalSeconds = useMemo(
    () => parseDurationSeconds(durationLabel),
    [durationLabel],
  );

  const rawDuration = externalControl
    ? externalControl.duration
    : isActiveShared
      ? sharedAudio.duration
      : 0;
  const totalSeconds = rawDuration > 0 ? rawDuration : fallbackTotalSeconds;

  const [syntheticElapsed, setSyntheticElapsed] = useState(0);
  const rawCurrentTime = externalControl
    ? externalControl.currentTime
    : isActiveShared
      ? sharedAudio.currentTime
      : 0;

  const effectiveCurrentTime =
    rawCurrentTime > 0 ? rawCurrentTime : isPlaying ? syntheticElapsed : 0;

  const progressRatio = useMemo(() => {
    if (totalSeconds <= 0) return 0;
    const ratio = effectiveCurrentTime / totalSeconds;
    if (ratio > 0) return Math.max(0.02, Math.min(1, ratio));
    return isPlaying ? 0.08 : 0.24;
  }, [effectiveCurrentTime, isPlaying, totalSeconds]);

  const progressPct = Math.round(progressRatio * 100);

  const [localRate, setLocalRate] = useState<number>(() => getAudioPlaybackRate() || 1);
  const activeRate = externalControl?.rate ?? localRate;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const [phase, setPhase] = useState(0.65);

  useEffect(() => {
    if (!isPlaying) {
      if (!isActiveShared) setSyntheticElapsed(0);
      return;
    }
    if (prefersReducedMotion) return;

    let rafId = 0;
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.06, Math.max(0.004, (now - lastTs) / 1000));
      lastTs = now;
      setPhase(prev => (prev + dt * 3.8 * activeRate) % (Math.PI * 20));
      setSyntheticElapsed(prev => (prev + dt * activeRate) % totalSeconds);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying, isActiveShared, prefersReducedMotion, activeRate, totalSeconds]);

  const seedOffset = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < audioId.length; i++) {
      hash = (hash * 31 + audioId.charCodeAt(i)) % 997;
    }
    return (hash / 997) * Math.PI * 2;
  }, [audioId]);

  const geometry = useMemo(
    () => buildHarmonicPaths(phase, isPlaying, progressRatio, seedOffset),
    [phase, isPlaying, progressRatio, seedOffset],
  );

  const handleTogglePlay = () => {
    if (externalControl) {
      externalControl.onToggle();
      return;
    }
    if (isPlaying || isLoading) {
      pauseAudio();
    } else {
      void playAudio(audioId, audioUrl);
    }
  };

  const handleStageSeek = (event: ReactMouseEvent<SVGSVGElement>) => {
    const svg = stageRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const width = rect.width || 360;
    const clickX = Math.max(0, Math.min(width, event.clientX - rect.left));
    const fraction = clickX / width;
    const targetSec = fraction * totalSeconds;

    if (externalControl) {
      externalControl.onSeek?.(targetSec);
      if (!externalControl.isPlaying) externalControl.onToggle();
      return;
    }

    setSyntheticElapsed(targetSec);
    if (!isActiveShared || (!isPlaying && !isLoading)) {
      void playAudio(audioId, audioUrl).then(() => {
        seekAudio(audioId, targetSec);
      });
    } else {
      seekAudio(audioId, targetSec);
    }
  };

  const handleCycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.findIndex(s => Math.abs(s - activeRate) < 0.03);
    const nextRate = SPEED_OPTIONS[(currentIndex + 1) % SPEED_OPTIONS.length];
    if (externalControl?.onRateChange) {
      externalControl.onRateChange(nextRate);
    } else {
      setLocalRate(nextRate);
      setAudioPlaybackRate(nextRate);
    }
  };

  const statusText = isLoading
    ? loadingAudioLabel(lang)
    : speakerLabel && isPlaying
      ? speakerLabel
      : localizedStudioLabel(lang, isPlaying);

  const timeDisplay =
    isPlaying || effectiveCurrentTime > 0
      ? `${formatClockLabel(effectiveCurrentTime)} / ${durationLabel || formatClockLabel(totalSeconds)}`
      : durationLabel || formatClockLabel(totalSeconds);

  const playheadX = Number((progressRatio * 360).toFixed(2));

  return (
    <div
      data-testid="living-wave-player"
      data-playing={isPlaying ? 'true' : 'false'}
      data-loading={isLoading ? 'true' : 'false'}
      className={`group/wave relative mt-2.5 overflow-hidden rounded-2xl border transition-all duration-300 ${
        isPlaying
          ? 'border-[#D4AF37]/75 bg-gradient-to-r from-[#02150F] via-[#062C21] to-[#031A13] shadow-[0_0_28px_-6px_rgba(212,175,55,0.38),inset_0_1px_0_rgba(249,231,185,0.22)]'
          : 'border-[#D4AF37]/40 bg-gradient-to-r from-[#02130E]/95 via-[#042018]/95 to-[#031812]/95 shadow-[inset_0_1px_0_rgba(249,231,185,0.12)] hover:border-[#D4AF37]/65'
      } ${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'} ${className}`}
    >
      {/* Subtle Ambient Aurora Glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-10 left-1/3 h-24 w-48 -translate-x-1/2 rounded-full bg-[#D4AF37]/15 blur-2xl transition-opacity duration-500 ${
          isPlaying ? 'opacity-100' : 'opacity-40 group-hover/wave:opacity-75'
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute -bottom-10 right-1/4 h-24 w-48 rounded-full bg-emerald-400/15 blur-2xl transition-opacity duration-500 ${
          isPlaying ? 'opacity-90' : 'opacity-30'
        }`}
      />

      {/* Micro-Header Row: Live Acoustic Status Badge + Speed & Time Capsule */}
      <div className="relative z-10 mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div
          data-testid="living-wave-status-badge"
          className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-bold tracking-wider text-[#F9E7B9]"
        >
          {isLoading ? (
            <AudioLoadingSpinner size={11} className="text-[#D4AF37]" />
          ) : isPlaying ? (
            <span className="relative flex h-2 w-2 shrink-0">
              {!prefersReducedMotion && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </span>
          ) : (
            <Sparkles className="h-3 w-3 shrink-0 text-[#D4AF37]" aria-hidden />
          )}
          <span className="truncate">{statusText}</span>
        </div>

        <div
          data-testid="living-wave-telemetry"
          className="flex shrink-0 items-center gap-1.5"
        >
          <button
            type="button"
            data-testid="living-wave-speed-pill"
            onClick={handleCycleSpeed}
            title="Cycle playback speed (1x · 1.15x · 0.85x)"
            className="rounded-full border border-[#D4AF37]/35 bg-[#073C30]/80 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-[#F9E7B9] transition hover:border-[#D4AF37] hover:bg-[#0A4A3B] cursor-pointer"
          >
            {activeRate}x
          </button>

          <span
            data-testid="living-wave-time-pill"
            className="rounded-full border border-[#D4AF37]/40 bg-[#02100C]/85 px-2.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-[#D4AF37] shadow-2xs"
          >
            {timeDisplay}
          </span>
        </div>
      </div>

      {/* Main Stage: Luminous Play/Pause Resonance Orb + 3-Layer Living Harmonic Wave SVG */}
      <div className="relative z-10 flex items-center gap-3">
        {/* 1. Luminous Resonance Play/Pause Orb */}
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
          {/* Outer Harmonic Ripple Ring 1 */}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 rounded-full border border-[#D4AF37]/45 transition-transform duration-500 ${
              isPlaying && !prefersReducedMotion
                ? 'scale-115 animate-ping border-emerald-400/50 duration-1000'
                : 'scale-100 group-hover/wave:scale-105'
            }`}
          />
          {/* Outer Concentric Halo Ring 2 */}
          <span
            aria-hidden
            className={`pointer-events-none absolute -inset-1 rounded-full border transition-all duration-300 ${
              isPlaying
                ? 'border-[#D4AF37]/60 bg-[#D4AF37]/10 shadow-[0_0_16px_rgba(212,175,55,0.4)]'
                : 'border-[#D4AF37]/25 bg-[#D4AF37]/5'
            }`}
          />

          {/* Orbital Loading Arc when audio is loading */}
          {isLoading && (
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 flex items-center justify-center text-[#F9E7B9]"
            >
              <AudioLoadingSpinner size={44} className="text-[#D4AF37]" />
            </span>
          )}

          <button
            type="button"
            data-testid="living-wave-play-orb"
            data-wall-podcast-play={playButtonDataId}
            aria-label={
              isLoading
                ? loadingAudioLabel(lang)
                : isPlaying
                  ? 'Pause podcast'
                  : 'Play podcast'
            }
            onClick={handleTogglePlay}
            style={{
              background: isPlaying
                ? 'linear-gradient(135deg, #F9E7B9 0%, #D4AF37 55%, #0E6B50 100%)'
                : 'linear-gradient(135deg, #F9E7B9 0%, #D4AF37 65%, #B68D2C 100%)',
              color: '#031812',
            }}
            className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full text-[#031812] shadow-[0_0_18px_rgba(212,175,55,0.45)] transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            {isLoading ? (
              <AudioLoadingSpinner size={16} className="text-[#031812]" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4 fill-current text-[#031812]" aria-hidden />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current text-[#031812]" aria-hidden />
            )}

            {/* Live Glowing Status Dot on Orb Rim */}
            {isPlaying && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-[#031812] bg-emerald-400 shadow-[0_0_6px_#34d399]"
              />
            )}
          </button>
        </div>

        {/* 2. Multi-Layer Living Harmonic Wave SVG (Interactive Scrubbable Stage) */}
        <div className="relative min-w-0 flex-1">
          <svg
            ref={stageRef}
            data-testid="living-wave-svg"
            viewBox="0 0 360 54"
            preserveAspectRatio="none"
            role="slider"
            aria-label="Audio resonance wave scrubber"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            tabIndex={0}
            onClick={handleStageSeek}
            onKeyDown={event => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                handleTogglePlay();
              }
            }}
            className="h-12 w-full cursor-pointer select-none overflow-visible sm:h-13"
          >
            <defs>
              <linearGradient id={`livingGoldGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F9E7B9" />
                <stop offset="50%" stopColor="#D4AF37" />
                <stop offset="100%" stopColor="#34D399" />
              </linearGradient>

              <linearGradient id={`livingGoldMuted-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.48" />
                <stop offset="60%" stopColor="#C6A15A" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.38" />
              </linearGradient>

              <linearGradient id={`livingGoldAreaGrad-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#D4AF37" stopOpacity={isPlaying ? '0.42' : '0.24'} />
                <stop offset="50%" stopColor="#10B981" stopOpacity={isPlaying ? '0.22' : '0.10'} />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.04" />
              </linearGradient>

              <linearGradient id={`livingEmeraldGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#34D399" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#F9E7B9" stopOpacity="0.5" />
              </linearGradient>

              <linearGradient id={`livingEmeraldArea-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#04241C" stopOpacity="0.0" />
              </linearGradient>

              <clipPath id={`playedClip-${uid}`}>
                <rect x="0" y="0" width={playheadX} height="54" />
              </clipPath>

              <clipPath id={`unplayedClip-${uid}`}>
                <rect x={playheadX} y="0" width={Math.max(0, 360 - playheadX)} height="54" />
              </clipPath>
            </defs>

            {/* Horizon Centerline Axis */}
            <line
              x1="0"
              y1="27"
              x2="360"
              y2="27"
              stroke="rgba(212, 175, 55, 0.22)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Layer 2: Emerald/Teal Counter-Harmonic Wave Ribbon */}
            <path
              d={geometry.secondaryArea}
              fill={`url(#livingEmeraldArea-${uid})`}
            />
            <path
              d={geometry.secondaryStroke}
              fill="none"
              stroke={`url(#livingEmeraldGrad-${uid})`}
              strokeWidth="1.5"
              strokeLinecap="round"
            />

            {/* Layer 1A: Unplayed Portion of Primary Harmonic Wave */}
            <g clipPath={`url(#unplayedClip-${uid})`}>
              <path
                d={geometry.primaryArea}
                fill={`url(#livingGoldAreaGrad-${uid})`}
                opacity="0.55"
              />
              <path
                d={geometry.mirrorStroke}
                fill="none"
                stroke="rgba(212, 175, 55, 0.24)"
                strokeWidth="1.15"
                strokeLinecap="round"
              />
              <path
                d={geometry.primaryStroke}
                fill="none"
                stroke={`url(#livingGoldMuted-${uid})`}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>

            {/* Layer 1B: Illuminated Played Portion of Primary Harmonic Wave */}
            <g clipPath={`url(#playedClip-${uid})`}>
              <path
                d={geometry.primaryArea}
                fill={`url(#livingGoldAreaGrad-${uid})`}
              />
              <path
                d={geometry.mirrorStroke}
                fill="none"
                stroke="rgba(249, 231, 185, 0.45)"
                strokeWidth="1.35"
                strokeLinecap="round"
              />
              <path
                d={geometry.primaryStroke}
                fill="none"
                stroke={`url(#livingGoldGrad-${uid})`}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>

            {/* Layer 3: Luminous Acoustic Crest Nodes */}
            {geometry.crestNodes.map((node, idx) => {
              const reached = node.x <= playheadX;
              return (
                <circle
                  key={idx}
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={reached ? '#F9E7B9' : '#D4AF37'}
                  fillOpacity={reached ? 0.95 : 0.45}
                />
              );
            })}

            {/* Glowing Progress Playhead Beam & Orb */}
            <line
              x1={playheadX}
              y1="6"
              x2={playheadX}
              y2="48"
              stroke="#F9E7B9"
              strokeOpacity={isPlaying ? '0.65' : '0.35'}
              strokeWidth="1.2"
            />
            <circle
              cx={playheadX}
              cy={geometry.playheadY}
              r={isPlaying ? 6.5 : 5}
              fill="rgba(249, 231, 185, 0.24)"
            />
            <circle
              data-testid="living-wave-playhead"
              cx={playheadX}
              cy={geometry.playheadY}
              r={isPlaying ? 3.6 : 3}
              fill="#F9E7B9"
              stroke="#031812"
              strokeWidth="1.2"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

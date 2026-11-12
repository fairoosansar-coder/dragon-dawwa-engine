import type { Lang } from '../shared/sources.ts';

export function loadingAudioLabel(lang?: Lang | string): string {
  if (lang === 'ta') return 'குரல் ஏற்றப்படுகிறது…';
  if (lang === 'si') return 'හඬ පූරණය වෙමින්…';
  return 'Loading audio…';
}

/**
 * High-contrast circular loading spinner shown on every audio/TTS Play button
 * from the moment the user clicks Play until audio playback actually starts.
 */
export function AudioLoadingSpinner({
  size = 14,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      data-testid="audio-loading-spinner"
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`shrink-0 animate-spin ${className}`}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

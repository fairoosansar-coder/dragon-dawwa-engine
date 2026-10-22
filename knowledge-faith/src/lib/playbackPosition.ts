/** Resume the same clip from the paused time. A different clip starts at the beginning. */
export function keepPlaybackPosition(currentSrc: string, nextSrc: string, currentTime: number): { src: string; time: number } {
  if (currentSrc && currentSrc === nextSrc && currentTime > 0) return { src: currentSrc, time: currentTime };
  return { src: nextSrc, time: 0 };
}

import { useSyncExternalStore } from 'react';

/** One shared audio element so only a single recitation or narration plays at a time. */
const audio = typeof Audio !== 'undefined' ? new Audio() : null;
let currentId: string | null = null;
let playing = false;
let onEnded: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

if (audio) {
  audio.preload = 'none';
  audio.addEventListener('play', () => {
    playing = true;
    emit();
  });
  audio.addEventListener('pause', () => {
    playing = false;
    emit();
  });
  audio.addEventListener('ended', () => {
    playing = false;
    const next = onEnded;
    onEnded = null;
    emit();
    next?.();
  });
  audio.addEventListener('error', () => {
    playing = false;
    emit();
  });
}

export function playAudio(id: string, src: string, then?: () => void): Promise<void> {
  if (!audio) return Promise.resolve();
  if (currentId === id && audio.paused && audio.src) {
    onEnded = then ?? null;
    return audio.play();
  }
  audio.pause();
  currentId = id;
  onEnded = then ?? null;
  audio.src = src;
  emit();
  return audio.play();
}

export function pauseAudio() {
  onEnded = null;
  audio?.pause();
}

export function useAudioState(): { id: string | null; playing: boolean } {
  const snapshot = useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => `${currentId ?? ''}|${playing}`,
  );
  const [id, isPlaying] = snapshot.split('|');
  return { id: id || null, playing: isPlaying === 'true' };
}

export function base64ToObjectUrl(base64: string, mimeType: string): string {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

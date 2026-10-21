import { useSyncExternalStore } from 'react';

/** One shared audio element so only a single recitation or narration plays at a time. */
const audio = typeof Audio !== 'undefined' ? new Audio() : null;
export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'unavailable';

let currentId: string | null = null;
let status: AudioStatus = audio ? 'idle' : 'unavailable';
let onEnded: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

function setStatus(next: AudioStatus) {
  status = next;
  emit();
}

if (audio) {
  audio.preload = 'none';
  audio.addEventListener('waiting', () => {
    if (status !== 'error') setStatus('loading');
  });
  audio.addEventListener('playing', () => setStatus('playing'));
  audio.addEventListener('pause', () => {
    if (status !== 'error' && status !== 'unavailable') setStatus('paused');
  });
  audio.addEventListener('ended', () => {
    setStatus('paused');
    const next = onEnded;
    onEnded = null;
    next?.();
  });
  audio.addEventListener('error', () => setStatus('error'));
}

function start(then?: () => void): Promise<void> {
  if (!audio) {
    setStatus('unavailable');
    return Promise.resolve();
  }
  onEnded = then ?? null;
  setStatus('loading');
  return audio.play().then(
    () => undefined,
    () => {
      setStatus('error');
    },
  );
}

export function playAudio(id: string, src: string, then?: () => void): Promise<void> {
  if (!audio) {
    setStatus('unavailable');
    return Promise.resolve();
  }
  if (currentId === id && audio.paused && audio.src && status !== 'error') return start(then);
  audio.pause();
  currentId = id;
  audio.src = src;
  return start(then);
}

export function pauseAudio() {
  onEnded = null;
  audio?.pause();
}

/** Continue the current recitation after a pause or a failed play. No duration is tracked. */
export function resumeAudio() {
  if (!audio || !currentId || !audio.src) {
    setStatus(audio ? status : 'unavailable');
    return;
  }
  void start();
}

export function useAudioState(): { id: string | null; playing: boolean; status: AudioStatus } {
  const snapshot = useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => `${currentId ?? ''}|${status}`,
  );
  const splitAt = snapshot.lastIndexOf('|');
  const id = snapshot.slice(0, splitAt);
  const current = snapshot.slice(splitAt + 1) as AudioStatus;
  return { id: id || null, playing: current === 'playing', status: current };
}

export function base64ToObjectUrl(base64: string, mimeType: string): string {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

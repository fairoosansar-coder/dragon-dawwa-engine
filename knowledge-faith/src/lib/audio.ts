import { useSyncExternalStore } from 'react';

/** One shared recitation element. Episode and generated narration register separately and must not overlap it. */
export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error' | 'unavailable';

interface Playable {
  src: string;
  paused: boolean;
  preload: string;
  play: () => Promise<void>;
  pause: () => void;
  addEventListener: (type: string, listener: () => void) => void;
}

let media: Playable | null = null;
let bound = false;
let currentId: string | null = null;
let status: AudioStatus = typeof Audio === 'undefined' ? 'unavailable' : 'idle';
let continuation: (() => void) | null = null;
let externalStop: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

function setStatus(next: AudioStatus) {
  status = next;
  emit();
}

function bind(audio: Playable) {
  if (bound) return;
  bound = true;
  audio.preload = 'none';
  audio.addEventListener('waiting', () => {
    if (currentId && status !== 'error') setStatus('loading');
  });
  audio.addEventListener('playing', () => {
    if (currentId) setStatus('playing');
  });
  audio.addEventListener('pause', () => {
    if (currentId && status !== 'error' && status !== 'unavailable') setStatus('paused');
  });
  audio.addEventListener('ended', () => {
    setStatus('paused');
    const next = continuation;
    continuation = null;
    next?.();
  });
  audio.addEventListener('error', () => {
    if (currentId) setStatus('error');
  });
}

function element(): Playable | null {
  if (media) return media;
  if (typeof Audio === 'undefined') return null;
  media = new Audio();
  bind(media);
  return media;
}

function stopOthers() {
  externalStop?.();
  if (typeof document === 'undefined') return;
  // The shared recitation element is not in the document. Episode audio is stopped through externalStop.
  document.querySelectorAll('audio, video').forEach(node => {
    (node as HTMLMediaElement).pause();
  });
}

function start(then?: () => void): Promise<void> {
  const audio = element();
  if (!audio) {
    setStatus('unavailable');
    return Promise.resolve();
  }
  if (then) continuation = then;
  stopOthers();
  setStatus('loading');
  return audio.play().then(
    () => undefined,
    () => {
      if (currentId) setStatus('error');
    },
  );
}

export function playAudio(id: string, src: string, then?: () => void): Promise<void> {
  const audio = element();
  if (!audio) {
    setStatus('unavailable');
    return Promise.resolve();
  }
  if (currentId === id && audio.paused && audio.src && status !== 'error') return start(then);
  continuation = null;
  currentId = id;
  audio.pause();
  audio.src = src;
  return start(then);
}

/** Pause the current recitation and keep a queued sequential continuation. */
export function pauseAudio() {
  element()?.pause();
}

/** Stop recitation and drop any queued continuation. Used when playback is replaced. */
export function stopAudio() {
  continuation = null;
  currentId = null;
  if (media) {
    media.pause();
    media.src = '';
  }
  setStatus(media || typeof Audio !== 'undefined' ? 'idle' : 'unavailable');
}

/** Continue the current recitation after a pause or a failed play. Keeps the queued continuation. */
export function resumeAudio() {
  const audio = element();
  if (!audio || !currentId || !audio.src) {
    setStatus(audio ? status : 'unavailable');
    return;
  }
  void start();
}

/** Episode playback registers this so recitation can stop it, and the reverse. */
export function bindExternalStop(stop: (() => void) | null) {
  externalStop = stop;
}

export function installMediaForTests(audio: Playable | null) {
  media = audio;
  bound = false;
  if (audio) bind(audio);
  currentId = null;
  continuation = null;
  externalStop = null;
  setStatus(audio ? 'idle' : 'unavailable');
}

export function resetAudioForTests() {
  continuation = null;
  externalStop = null;
  currentId = null;
  if (media) {
    media.pause();
    media.src = '';
  }
  setStatus(media ? 'idle' : 'unavailable');
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

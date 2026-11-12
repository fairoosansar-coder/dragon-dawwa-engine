import { useSyncExternalStore } from 'react';
import { base64ToObjectUrl, pauseAudio, playAudio, stopAudio, useAudioState } from './audio.ts';
import type {
  HadithPlaybackSpeed,
  HadithSpeechLang,
  HadithTtsResponse,
  HadithVoiceProfileId,
} from '../shared/hadithVoices.ts';

/**
 * Segment any sacred passage, Tafsir, Hadith matn/explanation/lessons, or Knowledge Hub article
 * into natural, readable lines / sentences / numbered points.
 * Never loads the entire page as one monolithic TTS payload.
 */
export function splitTextIntoSpeechLines(rawText: string): string[] {
  const cleaned = (rawText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean);

  const lines: string[] = [];
  for (const para of paragraphs) {
    // Split on sentence boundaries (., !, ?, ۔, ؟, ।, ;) while keeping punctuation attached
    const parts = para
      .split(/(?<=[.!?۔؟।;])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const part of parts) {
      if (part.length <= 240) {
        lines.push(part);
      } else {
        // Further split very long sentences by clauses (comma, dash, colon)
        const clauses = part
          .split(/(?<=[،,;:—–])\s+/)
          .map(c => c.trim())
          .filter(Boolean);
        let acc = '';
        for (const clause of clauses) {
          if (!acc) {
            acc = clause;
          } else if (acc.length + 1 + clause.length <= 220) {
            acc += ` ${clause}`;
          } else {
            lines.push(acc);
            acc = clause;
          }
        }
        if (acc) lines.push(acc);
      }
    }
  }

  return lines.filter(line => line.length > 0);
}

export interface LineByLineSessionState {
  sessionId: string | null;
  lines: string[];
  currentIndex: number;
  status: 'idle' | 'loading' | 'playing' | 'paused';
  lang: HadithSpeechLang;
  voiceProfile: HadithVoiceProfileId;
  speed: HadithPlaybackSpeed;
  prefetchedIndices: number[];
  requestedIndices: number[];
}

export interface LineByLineDeps {
  fetchLineAudio: (
    lineText: string,
    lang: HadithSpeechLang,
    voiceProfile: HadithVoiceProfileId,
    speed: HadithPlaybackSpeed,
  ) => Promise<string | null>;
  playAudioLine: (
    audioId: string,
    src: string,
    onStarted: () => void,
    onEnded: () => void,
  ) => Promise<void>;
  pauseCurrent: () => void;
  stopCurrent: () => void;
}

const audioUrlMemoryCache = new Map<string, string>();

async function defaultFetchLineAudio(
  lineText: string,
  lang: HadithSpeechLang,
  voiceProfile: HadithVoiceProfileId,
  speed: HadithPlaybackSpeed,
): Promise<string | null> {
  const clean = lineText.trim().slice(0, 800);
  if (!clean) return null;
  const key = `${voiceProfile}|${lang}|${speed}|${clean}`;
  const cached = audioUrlMemoryCache.get(key);
  if (cached) return cached;

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
    audioUrlMemoryCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

async function defaultPlayAudioLine(
  audioId: string,
  src: string,
  onStarted: () => void,
  onEnded: () => void,
): Promise<void> {
  await playAudio(audioId, src, onEnded);
  onStarted();
}

/**
 * Pure state machine controller for Line-by-Line Sequential Prefetch TTS:
 * - When starting at line `i` (default 0):
 *   1. Requests TTS ONLY for line `i`.
 *   2. Starts playing line `i`.
 *   3. As soon as line `i` starts playing (`onStarted`), triggers background prefetch for line `i + 1` ONLY and waits until line `i` completes (`onEnded`).
 *   4. When line `i` completes (`onEnded`), immediately plays the prefetched line `i + 1` (which in turn prefetches `i + 2`), continuing until all lines finish.
 */
export class LineByLineTtsController {
  private state: LineByLineSessionState = {
    sessionId: null,
    lines: [],
    currentIndex: -1,
    status: 'idle',
    lang: 'en',
    voiceProfile: 'tariq',
    speed: 1,
    prefetchedIndices: [],
    requestedIndices: [],
  };

  private runToken = 0;
  private prefetchPromises = new Map<number, Promise<string | null>>();
  private resolvedUrls = new Map<number, string>();
  private listeners = new Set<() => void>();
  private deps: LineByLineDeps;

  constructor(deps?: Partial<LineByLineDeps>) {
    this.deps = {
      fetchLineAudio: deps?.fetchLineAudio ?? defaultFetchLineAudio,
      playAudioLine: deps?.playAudioLine ?? defaultPlayAudioLine,
      pauseCurrent: deps?.pauseCurrent ?? pauseAudio,
      stopCurrent: deps?.stopCurrent ?? (() => stopAudio()),
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): LineByLineSessionState => this.state;

  private emit(patch: Partial<LineByLineSessionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l());
  }

  private ensureLineFetch(index: number, token: number): Promise<string | null> {
    if (index < 0 || index >= this.state.lines.length) {
      return Promise.resolve(null);
    }
    const existing = this.prefetchPromises.get(index);
    if (existing) return existing;

    const lineText = this.state.lines[index];
    const { lang, voiceProfile, speed } = this.state;

    if (!this.state.requestedIndices.includes(index)) {
      this.emit({
        requestedIndices: [...this.state.requestedIndices, index],
      });
    }

    const promise = this.deps
      .fetchLineAudio(lineText, lang, voiceProfile, speed)
      .then(url => {
        if (token !== this.runToken) return null;
        if (url) {
          this.resolvedUrls.set(index, url);
          if (!this.state.prefetchedIndices.includes(index)) {
            this.emit({
              prefetchedIndices: [...this.state.prefetchedIndices, index],
            });
          }
        }
        return url;
      });

    this.prefetchPromises.set(index, promise);
    return promise;
  }

  async startSession(input: {
    sessionId: string;
    text?: string;
    lines?: string[];
    startIndex?: number;
    lang: HadithSpeechLang;
    voiceProfile?: HadithVoiceProfileId;
    speed?: HadithPlaybackSpeed;
    onComplete?: () => void;
  }): Promise<void> {
    const lines = (input.lines ?? splitTextIntoSpeechLines(input.text ?? '')).filter(Boolean);
    if (lines.length === 0) return;

    const token = ++this.runToken;
    this.prefetchPromises.clear();
    this.resolvedUrls.clear();

    const startIndex = Math.max(0, Math.min(lines.length - 1, input.startIndex ?? 0));
    this.emit({
      sessionId: input.sessionId,
      lines,
      currentIndex: startIndex,
      status: 'loading',
      lang: input.lang,
      voiceProfile: input.voiceProfile ?? 'tariq',
      speed: input.speed ?? 1,
      prefetchedIndices: [],
      requestedIndices: [],
    });

    await this.playLineAtIndex(startIndex, token, input.onComplete);
  }

  private async playLineAtIndex(
    index: number,
    token: number,
    onComplete?: () => void,
  ): Promise<void> {
    if (token !== this.runToken) return;
    if (index < 0 || index >= this.state.lines.length) {
      this.emit({
        status: 'idle',
        currentIndex: -1,
      });
      onComplete?.();
      return;
    }

    this.emit({
      currentIndex: index,
      status: 'loading',
    });

    // Step 1: Load ONLY the current line `index` (if not already prefetched)
    const src = await this.ensureLineFetch(index, token);
    if (token !== this.runToken) return;

    if (!src) {
      // Fallback to browser SpeechSynthesis for this line if audio URL is unavailable
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(this.state.lines[index]);
          u.lang =
            this.state.lang === 'ar'
              ? 'ar-SA'
              : this.state.lang === 'ta'
                ? 'ta-IN'
                : this.state.lang === 'si'
                  ? 'si-LK'
                  : 'en-US';
          u.rate = this.state.speed;
          this.emit({ currentIndex: index, status: 'playing' });
          // Prefetch next line `index + 1` as soon as current line starts reading
          if (index + 1 < this.state.lines.length) {
            void this.ensureLineFetch(index + 1, token);
          }
          u.onend = () => {
            if (token !== this.runToken) return;
            void this.playLineAtIndex(index + 1, token, onComplete);
          };
          u.onerror = () => {
            if (token !== this.runToken) return;
            void this.playLineAtIndex(index + 1, token, onComplete);
          };
          window.speechSynthesis.speak(u);
          return;
        } catch {
          /* continue */
        }
      }
      this.emit({ status: 'idle', currentIndex: -1 });
      return;
    }

    const audioId = `line-tts:${this.state.sessionId}:${index}`;

    // Step 2: Start playing line `index`. Inside `onStarted`, prefetch ONLY line `index + 1` and wait until `onEnded`.
    await this.deps.playAudioLine(
      audioId,
      src,
      () => {
        if (token !== this.runToken) return;
        this.emit({
          currentIndex: index,
          status: 'playing',
        });
        if (index + 1 < this.state.lines.length) {
          void this.ensureLineFetch(index + 1, token);
        }
      },
      () => {
        if (token !== this.runToken) return;
        void this.playLineAtIndex(index + 1, token, onComplete);
      },
    );
  }

  pause(): void {
    if (this.state.status !== 'playing') return;
    this.deps.pauseCurrent();
    this.emit({ status: 'paused' });
  }

  async jumpToLine(index: number): Promise<void> {
    if (!this.state.sessionId || index < 0 || index >= this.state.lines.length) return;
    const token = ++this.runToken;
    await this.playLineAtIndex(index, token);
  }

  stop(): void {
    this.runToken++;
    this.prefetchPromises.clear();
    this.resolvedUrls.clear();
    this.deps.stopCurrent();
    this.emit({
      sessionId: null,
      lines: [],
      currentIndex: -1,
      status: 'idle',
      prefetchedIndices: [],
      requestedIndices: [],
    });
  }
}

export const sharedLineTts = new LineByLineTtsController();

export function useLineByLineTts(sessionPrefix?: string) {
  const snapshot = useSyncExternalStore(
    sharedLineTts.subscribe,
    sharedLineTts.getSnapshot,
    sharedLineTts.getSnapshot,
  );
  const audio = useAudioState();
  const isMatchingSession = sessionPrefix
    ? Boolean(snapshot.sessionId && snapshot.sessionId.startsWith(sessionPrefix))
    : Boolean(snapshot.sessionId);

  const effectiveStatus =
    isMatchingSession && snapshot.status === 'playing' && audio.status === 'paused'
      ? 'paused'
      : isMatchingSession && snapshot.status === 'playing' && audio.status === 'loading'
        ? 'loading'
        : isMatchingSession
          ? snapshot.status
          : 'idle';

  const isLoadingSession = (targetSessionId: string): boolean =>
    snapshot.sessionId === targetSessionId && effectiveStatus === 'loading';

  const isPlayingSession = (targetSessionId: string): boolean =>
    snapshot.sessionId === targetSessionId && effectiveStatus === 'playing';

  return {
    ...snapshot,
    active: isMatchingSession && snapshot.status !== 'idle',
    status: effectiveStatus,
    isLoadingAudio: isMatchingSession && effectiveStatus === 'loading',
    isPlaying: isMatchingSession && effectiveStatus === 'playing',
    isLoadingSession,
    isPlayingSession,
    currentLineText:
      isMatchingSession && snapshot.currentIndex >= 0
        ? snapshot.lines[snapshot.currentIndex] ?? null
        : null,
    nextLineReady:
      isMatchingSession &&
      snapshot.currentIndex >= 0 &&
      snapshot.prefetchedIndices.includes(snapshot.currentIndex + 1),
    start: (opts: Parameters<LineByLineTtsController['startSession']>[0]) =>
      sharedLineTts.startSession(opts),
    pause: () => sharedLineTts.pause(),
    stop: () => sharedLineTts.stop(),
    jumpToLine: (idx: number) => sharedLineTts.jumpToLine(idx),
  };
}

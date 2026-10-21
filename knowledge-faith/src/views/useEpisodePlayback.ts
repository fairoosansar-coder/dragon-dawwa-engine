import { useEffect, useMemo, useRef, useState } from 'react';
import type { PodcastLine, TtsResult } from '../shared/types.ts';
import { postJson } from '../lib/api.ts';
import { base64ToObjectUrl, bindExternalStop, stopAudio } from '../lib/audio.ts';
import { chunkEpisodeLines } from '../engine/utils/episodeChunks.ts';

export type PlaybackPhase = 'idle' | 'loading' | 'playing';

export function useEpisodePlayback(lines: PodcastLine[], hostVoice: string, guestVoice: string, resetKey: string) {
  const chunks = useMemo(() => chunkEpisodeLines(lines), [lines]);
  const chunksRef = useRef(chunks);
  const voicesRef = useRef({ hostVoice, guestVoice });
  chunksRef.current = chunks;
  voicesRef.current = { hostVoice, guestVoice };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urls = useRef<Map<number, string>>(new Map());
  const inflight = useRef<Map<number, Promise<string>>>(new Map());
  const token = useRef(0);
  const [index, setIndex] = useState(-1);
  const [phase, setPhase] = useState<PlaybackPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const clearCache = () => {
    for (const url of urls.current.values()) URL.revokeObjectURL(url);
    urls.current.clear();
    inflight.current.clear();
  };

  useEffect(() => {
    const el = new Audio();
    audioRef.current = el;
    bindExternalStop(() => {
      token.current += 1;
      el.pause();
      setPhase('idle');
    });
    return () => {
      bindExternalStop(null);
      token.current += 1;
      el.pause();
      el.src = '';
      clearCache();
    };
  }, []);

  useEffect(() => {
    token.current += 1;
    audioRef.current?.pause();
    clearCache();
    setIndex(-1);
    setPhase('idle');
    setError(null);
  }, [resetKey, hostVoice, guestVoice]);

  function load(i: number): Promise<string | null> {
    const chunk = chunksRef.current[i];
    if (!chunk) return Promise.resolve(null);
    const cached = urls.current.get(i);
    if (cached) return Promise.resolve(cached);
    const pending = inflight.current.get(i);
    if (pending) return pending;
    const voice = chunk.speaker === 'Host' ? voicesRef.current.hostVoice : voicesRef.current.guestVoice;
    const task = postJson<TtsResult>('/api/voice/narrate', {
      text: chunk.text,
      voice,
    })
      .then(result => {
        const url = base64ToObjectUrl(result.audioBase64, result.mimeType || 'audio/wav');
        urls.current.set(i, url);
        inflight.current.delete(i);
        return url;
      })
      .catch(err => {
        inflight.current.delete(i);
        throw err;
      });
    inflight.current.set(i, task);
    return task;
  }

  function prefetchAhead(i: number, run: number) {
    void load(i + 1)
      .then(url => {
        if (url && run === token.current) void load(i + 2).catch(() => undefined);
      })
      .catch(() => undefined);
  }

  async function playAt(i: number, run: number) {
    if (run !== token.current) return;
    if (i >= chunksRef.current.length) {
      setPhase('idle');
      setIndex(-1);
      return;
    }
    setIndex(i);
    setPhase(urls.current.has(i) ? 'playing' : 'loading');
    let url: string | null;
    try {
      url = await load(i);
    } catch (err) {
      if (run !== token.current) return;
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'Gemini voice failed.');
      return;
    }
    if (run !== token.current || !url) return;
    const el = audioRef.current;
    if (!el) return;
    prefetchAhead(i, run);
    setPhase('playing');
    el.src = url;
    el.onended = () => {
      if (run === token.current) void playAt(i + 1, run);
    };
    el.onerror = () => {
      if (run !== token.current) return;
      setPhase('idle');
      setError('Gemini audio could not play. Press Play to retry.');
    };
    stopAudio();
    try {
      await el.play();
    } catch (err) {
      if (run !== token.current) return;
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'Gemini audio could not play.');
    }
  }

  function toggle() {
    if (phase !== 'idle') {
      token.current += 1;
      audioRef.current?.pause();
      setPhase('idle');
      return;
    }
    setError(null);
    const run = token.current + 1;
    token.current = run;
    const start = index >= 0 && index < chunks.length ? index : 0;
    void playAt(start, run);
  }

  const activeLines = index >= 0 ? (chunks[index]?.lineIndexes ?? []) : [];

  return { phase, index, activeLines, error, toggle, chunkCount: chunks.length };
}

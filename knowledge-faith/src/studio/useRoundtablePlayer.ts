import { useCallback, useEffect, useRef, useState } from 'react';
import { base64ToObjectUrl, bindExternalStop, claimPlayback, stopAudio } from '../lib/audio.ts';
import { postJson } from '../lib/api.ts';
import type { Lang } from '../shared/sources.ts';
import type { StudioEpisode, StudioSegment } from '../shared/studio/contracts.ts';
import type { PlayPhase } from '../shared/studio/roundtable.ts';
import type { TtsResult } from '../shared/types.ts';

const POINT_KEY = 'kf-roundtable-point';

export interface PlaybackPoint {
  episodeId: string;
  segmentIndex: number;
  offsetSeconds: number;
}

function readPoint(episodeId: string): PlaybackPoint | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(POINT_KEY) || 'null') as PlaybackPoint | null;
    if (!raw || raw.episodeId !== episodeId) return null;
    if (!Number.isFinite(raw.segmentIndex) || !Number.isFinite(raw.offsetSeconds)) return null;
    return raw;
  } catch {
    return null;
  }
}

function writePoint(point: PlaybackPoint) {
  sessionStorage.setItem(POINT_KEY, JSON.stringify(point));
}

export function useRoundtablePlayer(episode: StudioEpisode | null, lang: Lang, aiConfigured: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runRef = useRef(0);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const episodeRef = useRef(episode);
  episodeRef.current = episode;
  const [phase, setPhase] = useState<PlayPhase>('idle');
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [offsetSeconds, setOffsetSeconds] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const audio = new Audio();
    audioRef.current = audio;
    bindExternalStop(() => {
      audio.pause();
      setPhase(current => (current === 'preparing' || current === 'error' || current === 'ended' ? current : 'paused'));
    });
    const onTime = () => setOffsetSeconds(audio.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : null);
    const onWaiting = () => setPhase(current => (current === 'error' ? current : 'buffering'));
    const onPlaying = () => setPhase('playing');
    const onPause = () => {
      if (!audio.paused) return;
      setPhase(current => (current === 'ended' || current === 'error' || current === 'preparing' ? current : 'paused'));
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    return () => {
      bindExternalStop(null);
      audio.pause();
      audio.src = '';
      for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
      cacheRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!episode) return;
    const saved = readPoint(episode.id);
    setSegmentIndex(saved?.segmentIndex ?? 0);
    setOffsetSeconds(saved?.offsetSeconds ?? 0);
    setDuration(null);
    setError(null);
    setPhase('idle');
    audioRef.current?.pause();
  }, [episode?.id, lang]);

  const remember = useCallback((index: number, offset: number) => {
    const current = episodeRef.current;
    if (!current) return;
    const point = { episodeId: current.id, segmentIndex: index, offsetSeconds: offset };
    writePoint(point);
  }, []);

  const resolveUrl = useCallback(
    async (segment: StudioSegment): Promise<string> => {
      if (
        (segment.audioKind === 'quran_recitation' || segment.audioKind === 'meaning_audio' || segment.audioKind === 'original_recording') &&
        segment.directAudioUrl
      ) {
        return segment.directAudioUrl;
      }
      if (!aiConfigured) {
        throw new Error('Live Gemini narration is not configured on this server (GEMINI_API_KEY missing). Playback was not simulated.');
      }
      const voice = segment.speakerId === 'researcher' ? 'Charon' : 'Kore';
      const cacheKey = `${voice}:${lang}:${segment.text}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) return cached;
      const res = await postJson<TtsResult>('/api/voice/narrate', { text: segment.text, voice, lang });
      const url = base64ToObjectUrl(res.audioBase64, res.mimeType || 'audio/wav');
      cacheRef.current.set(cacheKey, url);
      return url;
    },
    [aiConfigured, lang],
  );

  const playAt = useCallback(
    async (index: number, offset: number) => {
      const current = episodeRef.current;
      const audio = audioRef.current;
      if (!current || !audio || !current.segments.length) return;
      const clamped = Math.max(0, Math.min(current.segments.length - 1, index));
      const segment = current.segments[clamped];
      const token = ++runRef.current;
      setError(null);
      setPhase('preparing');
      setSegmentIndex(clamped);
      setDuration(null);
      remember(clamped, offset);
      stopAudio();
      let url: string;
      try {
        url = await resolveUrl(segment);
      } catch (err) {
        if (runRef.current !== token) return;
        setPhase('error');
        setError(err instanceof Error ? err.message : 'Audio could not be prepared.');
        return;
      }
      if (runRef.current !== token) return;
      claimPlayback(audio);
      if (audio.src !== url) audio.src = url;
      const applyOffset = () => {
        if (offset > 0.2 && Number.isFinite(audio.duration) && offset < audio.duration) audio.currentTime = offset;
      };
      if (audio.readyState >= 1) applyOffset();
      else audio.addEventListener('loadedmetadata', applyOffset, { once: true });
      audio.onended = () => {
        if (runRef.current !== token) return;
        const next = clamped + 1;
        if (next < current.segments.length) void playAt(next, 0);
        else {
          setPhase('ended');
          setOffsetSeconds(0);
          remember(0, 0);
        }
      };
      try {
        await audio.play();
      } catch (err) {
        if (runRef.current !== token) return;
        setPhase('error');
        setError(err instanceof Error ? err.message : 'Playback failed.');
      }
    },
    [remember, resolveUrl],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (phase === 'playing' || phase === 'preparing' || phase === 'buffering') {
      runRef.current += 1;
      const offset = audio?.currentTime || offsetSeconds;
      audio?.pause();
      setOffsetSeconds(offset);
      remember(segmentIndex, offset);
      setPhase('paused');
      return;
    }
    void playAt(phase === 'ended' ? 0 : segmentIndex, phase === 'ended' ? 0 : offsetSeconds);
  }, [offsetSeconds, phase, playAt, remember, segmentIndex]);

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio || duration == null) return;
      const next = Math.max(0, Math.min(duration, seconds));
      audio.currentTime = next;
      setOffsetSeconds(next);
      remember(segmentIndex, next);
    },
    [duration, remember, segmentIndex],
  );

  const pauseForAsk = useCallback((): PlaybackPoint | null => {
    const current = episodeRef.current;
    if (!current) return null;
    const offset = audioRef.current?.currentTime || offsetSeconds;
    runRef.current += 1;
    audioRef.current?.pause();
    setOffsetSeconds(offset);
    setPhase('paused');
    const point = { episodeId: current.id, segmentIndex, offsetSeconds: offset };
    writePoint(point);
    return point;
  }, [offsetSeconds, segmentIndex]);

  return {
    phase,
    segmentIndex,
    offsetSeconds,
    duration,
    error,
    toggle,
    seek,
    pauseForAsk,
    segment: episode?.segments[segmentIndex] ?? null,
  };
}

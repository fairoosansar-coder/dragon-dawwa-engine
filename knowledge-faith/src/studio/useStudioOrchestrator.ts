import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { postJson } from '../lib/api.ts';
import { base64ToObjectUrl, bindExternalStop, claimPlayback, stopAudio } from '../lib/audio.ts';
import { useStored } from '../lib/store.tsx';
import type { Lang } from '../shared/sources.ts';
import type { TtsResult } from '../shared/types.ts';
import type { StudioAskAnswer, StudioEpisode, StudioSegment } from '../shared/studio/contracts.ts';
import {
  DEFAULT_LISTENER_PREFERENCES,
  sanitizeListenerPreferences,
  type SavedListeningPoint,
  type StudioListenerPreferences,
} from '../shared/studio/presenter.ts';
import {
  createInitialStudioSession,
  sessionBroadcastBadge,
  sessionPhaseLabel,
  transitionStudioSession,
} from '../shared/studio/sessionMachine.ts';

interface SpeechResult {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechSession {
  lang: string;
  interimResults: boolean;
  onstart?: (() => void) | null;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: (() => void) | null;
  onend?: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechConstructor(): (new () => SpeechSession) | null {
  if (typeof window === 'undefined') return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechSession;
    webkitSpeechRecognition?: new () => SpeechSession;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export interface StudioTimings {
  lastProgrammeStartMs: number | null;
  lastQuestionResearchMs: number | null;
  lastGeneratedAudioMs: number | null;
  lastResumePlaybackMs: number | null;
}

export function useStudioOrchestrator(episode: StudioEpisode | null, lang: Lang, aiConfigured: boolean) {
  const [session, dispatch] = useReducer(
    transitionStudioSession,
    createInitialStudioSession(episode?.id ?? 'tonight-mercy-ar-rahman', lang),
  );
  const [rawPrefs, setRawPrefs] = useStored<StudioListenerPreferences>('dd-studio-preferences-v1', DEFAULT_LISTENER_PREFERENCES);
  const prefs = sanitizeListenerPreferences(rawPrefs);

  // Also keep a session-scoped saved position so even before opting into persistent profile preferences,
  // "Save position" & "Return to saved position" work within the active session.
  const [sessionSavedPosition, setSessionSavedPosition] = useStored<{
    episodeId: string;
    episodeTitle: string;
    lang: Lang;
    segmentId: string;
    segmentIndex: number;
    offsetSeconds: number;
    updatedAt: string;
  } | null>('dd-studio-last-position-v1', null);

  const [sessionSavedPoints, setSessionSavedPoints] = useStored<SavedListeningPoint[]>('dd-studio-saved-points-v1', []);
  const [sessionSavedEpisodes, setSessionSavedEpisodes] = useStored<string[]>('dd-studio-saved-episodes-v1', []);

  const [answer, setAnswer] = useState<StudioAskAnswer | null>(null);
  const [askBusy, setAskBusy] = useState(false);
  const [askProgress, setAskProgress] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [timings, setTimings] = useState<StudioTimings>({
    lastProgrammeStartMs: null,
    lastQuestionResearchMs: null,
    lastGeneratedAudioMs: null,
    lastResumePlaybackMs: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const answerAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());
  const askAbortRef = useRef<AbortController | null>(null);
  const speechRef = useRef<SpeechSession | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const episodeRef = useRef(episode);
  episodeRef.current = episode;

  useEffect(() => {
    setMicSupported(Boolean(getSpeechConstructor()));
  }, []);

  // Setup shared audio element and external stop binding so Studio and Recitation never overlap
  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const progAudio = new Audio();
    const ansAudio = new Audio();
    audioRef.current = progAudio;
    answerAudioRef.current = ansAudio;

    bindExternalStop(() => {
      progAudio.pause();
      ansAudio.pause();
      dispatch({ type: 'PAUSE', offsetSeconds: progAudio.currentTime || 0 });
    });

    const onVisibility = () => {
      dispatch({
        type: 'VISIBILITY_CHANGE',
        hidden: document.hidden,
        offsetSeconds: progAudio.currentTime || sessionRef.current.offsetSeconds,
      });
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      bindExternalStop(null);
      askAbortRef.current?.abort();
      speechRef.current?.stop();
      progAudio.pause();
      progAudio.src = '';
      ansAudio.pause();
      ansAudio.src = '';
      for (const url of ttsCacheRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      ttsCacheRef.current.clear();
      dispatch({ type: 'UNMOUNT' });
    };
  }, []);

  // SyncplaybackRate whenever speed changes
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = session.playbackSpeed;
    if (answerAudioRef.current) answerAudioRef.current.playbackRate = session.playbackSpeed;
  }, [session.playbackSpeed]);

  // Handle language or episode change cleanly
  useEffect(() => {
    if (!episode) return;
    if (sessionRef.current.episodeId !== episode.id) {
      audioRef.current?.pause();
      answerAudioRef.current?.pause();
      askAbortRef.current?.abort();
      const savedForEp =
        sessionSavedPosition && sessionSavedPosition.episodeId === episode.id
          ? sessionSavedPosition
          : prefs.optIn && prefs.lastListeningPosition?.episodeId === episode.id
            ? prefs.lastListeningPosition
            : null;
      dispatch({
        type: 'CHANGE_EPISODE',
        episodeId: episode.id,
        segmentIndex: savedForEp?.segmentIndex ?? 0,
        offsetSeconds: savedForEp?.offsetSeconds ?? 0,
      });
      setAnswer(null);
    } else if (sessionRef.current.lang !== lang) {
      audioRef.current?.pause();
      answerAudioRef.current?.pause();
      askAbortRef.current?.abort();
      dispatch({ type: 'CHANGE_LANGUAGE', lang, newEpisodeId: episode.id });
    }
  }, [episode?.id, lang]);

  const persistPosition = useCallback(
    (segIdx: number, offsetSec: number) => {
      const ep = episodeRef.current;
      if (!ep) return;
      const seg = ep.segments[segIdx] ?? ep.segments[0];
      const pos = {
        episodeId: ep.id,
        episodeTitle: ep.title,
        lang: ep.lang,
        segmentId: seg?.id ?? 'seg-1',
        segmentIndex: segIdx,
        offsetSeconds: Math.round(offsetSec * 10) / 10,
        updatedAt: new Date().toISOString(),
      };
      setSessionSavedPosition(pos);
      if (prefs.optIn) {
        setRawPrefs(prev =>
          sanitizeListenerPreferences({
            ...prev,
            lastListeningPosition: pos,
          }),
        );
      }
    },
    [prefs.optIn, setRawPrefs, setSessionSavedPosition],
  );

  /**
   * Resolves the audio URL for a segment while respecting the 4-way audio separation policy:
   * - quran_recitation -> direct verified Qari MP3 URL (never presenter TTS)
   * - meaning_audio -> direct verified QuranEnc meaning MP3 URL
   * - original_recording -> direct verified IslamHouse scholar MP3 URL
   * - presenter_narration -> Gemini neural TTS (/api/voice/narrate) when configured
   */
  const resolveSegmentAudioUrl = useCallback(
    async (segment: StudioSegment, episodeLang: Lang): Promise<string> => {
      if (
        (segment.audioKind === 'quran_recitation' ||
          segment.audioKind === 'meaning_audio' ||
          segment.audioKind === 'original_recording') &&
        segment.directAudioUrl
      ) {
        return segment.directAudioUrl;
      }

      if (!aiConfigured) {
        throw new Error(
          'Live Gemini presenter narration requires GEMINI_API_KEY on the server (/api/health reports "ai": false). Select a Qur’an recitation or archival recording segment to hear direct source audio, or follow the synchronized transcript and sources.',
        );
      }

      const voice = segment.speakerId === 'tariq' ? 'Charon' : 'Kore';
      const cacheKey = `${voice}:${episodeLang}:${segment.text}`;
      const cached = ttsCacheRef.current.get(cacheKey);
      if (cached) return cached;

      const t0 = performance.now();
      const res = await postJson<TtsResult>('/api/voice/narrate', {
        text: segment.text,
        voice,
        lang: episodeLang,
      });
      const elapsed = Math.round(performance.now() - t0);
      setTimings(prev => ({ ...prev, lastGeneratedAudioMs: elapsed }));
      const url = base64ToObjectUrl(res.audioBase64, res.mimeType || 'audio/wav');
      ttsCacheRef.current.set(cacheKey, url);
      return url;
    },
    [aiConfigured],
  );

  const playSegmentAt = useCallback(
    async (segIndex: number, offsetSec = 0, isResume = false) => {
      const ep = episodeRef.current;
      if (!ep || !ep.segments.length) return;
      const clampedIdx = Math.max(0, Math.min(ep.segments.length - 1, segIndex));
      const segment = ep.segments[clampedIdx];
      const startPerf = performance.now();

      // Stop any answer audio or external recitation immediately so streams never overlap
      answerAudioRef.current?.pause();
      stopAudio();

      const nextToken = sessionRef.current.activeRunToken + 1;
      dispatch({
        type: 'LOAD_PROGRAMME',
        episodeId: ep.id,
        segmentIndex: clampedIdx,
        offsetSeconds: offsetSec,
      });
      persistPosition(clampedIdx, offsetSec);

      let url: string;
      try {
        url = await resolveSegmentAudioUrl(segment, ep.lang);
      } catch (err) {
        const elapsed = Math.round(performance.now() - startPerf);
        setTimings(prev => ({
          ...prev,
          ...(isResume ? { lastResumePlaybackMs: elapsed } : { lastProgrammeStartMs: elapsed }),
        }));
        dispatch({
          type: 'PROVIDER_FAILURE',
          runToken: nextToken,
          message: err instanceof Error ? err.message : 'Audio stream could not be loaded.',
        });
        return;
      }

      if (sessionRef.current.activeRunToken !== nextToken) return;
      const el = audioRef.current;
      if (!el) return;

      claimPlayback(el);
      if (el.src !== url) {
        el.src = url;
      }
      el.playbackRate = sessionRef.current.playbackSpeed;

      if (offsetSec > 0) {
        const applyOffset = () => {
          try {
            if (Math.abs(el.currentTime - offsetSec) > 0.25) el.currentTime = offsetSec;
          } catch {
            /* ignore seek before metadata */
          }
        };
        if (el.readyState >= 1) applyOffset();
        else el.addEventListener('loadedmetadata', applyOffset, { once: true });
      }

      el.onplaying = () => {
        if (sessionRef.current.activeRunToken !== nextToken) return;
        const elapsed = Math.round(performance.now() - startPerf);
        setTimings(prev => ({
          ...prev,
          ...(isResume ? { lastResumePlaybackMs: elapsed } : { lastProgrammeStartMs: elapsed }),
        }));
        dispatch({ type: 'AUDIO_READY', runToken: nextToken });
      };

      el.ontimeupdate = () => {
        if (sessionRef.current.activeRunToken !== nextToken) return;
        dispatch({ type: 'SEEK', segmentIndex: clampedIdx, offsetSeconds: el.currentTime });
      };

      el.onended = () => {
        if (sessionRef.current.activeRunToken !== nextToken) return;
        if (clampedIdx + 1 < ep.segments.length) {
          void playSegmentAt(clampedIdx + 1, 0, false);
        } else {
          dispatch({ type: 'PAUSE', offsetSeconds: 0 });
        }
      };

      el.onerror = () => {
        if (sessionRef.current.activeRunToken !== nextToken) return;
        dispatch({
          type: 'PROVIDER_FAILURE',
          runToken: nextToken,
          message: 'Audio stream could not be played in this browser.',
        });
      };

      try {
        await el.play();
      } catch (err) {
        if (sessionRef.current.activeRunToken !== nextToken) return;
        const msg = err instanceof Error ? err.message : '';
        if (/notallowed|gesture|interact/i.test(msg)) {
          dispatch({
            type: 'AUTOPLAY_BLOCKED',
            runToken: nextToken,
            message: 'Browser autoplay restriction: press Listen to start playback.',
          });
        } else {
          dispatch({
            type: 'PROVIDER_FAILURE',
            runToken: nextToken,
            message: msg || 'Audio playback could not start.',
          });
        }
      }
    },
    [persistPosition, resolveSegmentAudioUrl],
  );

  const pauseProgramme = useCallback(() => {
    const currentOff = audioRef.current?.currentTime ?? sessionRef.current.offsetSeconds;
    audioRef.current?.pause();
    answerAudioRef.current?.pause();
    persistPosition(sessionRef.current.segmentIndex, currentOff);
    dispatch({ type: 'PAUSE', offsetSeconds: currentOff });
  }, [persistPosition]);

  const toggleListen = useCallback(() => {
    const cur = sessionRef.current;
    if (cur.phase === 'playing_programme' || cur.phase === 'loading' || cur.phase === 'playing_answer') {
      pauseProgramme();
      return;
    }
    void playSegmentAt(cur.segmentIndex, cur.offsetSeconds, cur.resumePoint !== null);
  }, [pauseProgramme, playSegmentAt]);

  const resumeProgramme = useCallback(() => {
    const cur = sessionRef.current;
    const ep = episodeRef.current;
    const targetSeg =
      cur.resumePoint && cur.resumePoint.episodeId === ep?.id
        ? cur.resumePoint.segmentIndex
        : cur.segmentIndex;
    const targetOff =
      cur.resumePoint && cur.resumePoint.episodeId === ep?.id
        ? cur.resumePoint.offsetSeconds
        : cur.offsetSeconds;

    answerAudioRef.current?.pause();
    dispatch({ type: 'RESUME_PROGRAMME' });
    void playSegmentAt(targetSeg, targetOff, true);
  }, [playSegmentAt]);

  const seekToSegment = useCallback(
    (segIndex: number, offsetSec = 0, autoPlay = false) => {
      const ep = episodeRef.current;
      if (!ep) return;
      const clamped = Math.max(0, Math.min(ep.segments.length - 1, segIndex));
      persistPosition(clamped, offsetSec);
      dispatch({ type: 'SEEK', segmentIndex: clamped, offsetSeconds: offsetSec });
      if (autoPlay || sessionRef.current.phase === 'playing_programme') {
        void playSegmentAt(clamped, offsetSec, false);
      }
    },
    [persistPosition, playSegmentAt],
  );

  const setSpeed = useCallback((speed: number) => {
    dispatch({ type: 'SET_SPEED', speed });
  }, []);

  const prepareAsk = useCallback(() => {
    const currentOff = audioRef.current?.currentTime ?? sessionRef.current.offsetSeconds;
    audioRef.current?.pause();
    answerAudioRef.current?.pause();
    persistPosition(sessionRef.current.segmentIndex, currentOff);
    dispatch({ type: 'OPEN_ASK', offsetSeconds: currentOff });
  }, [persistPosition]);

  const cancelAsk = useCallback(() => {
    askAbortRef.current?.abort();
    askAbortRef.current = null;
    answerAudioRef.current?.pause();
    setAskBusy(false);
    setAskProgress(null);
    dispatch({ type: 'CANCEL_RESEARCH' });
  }, []);

  const askQuestion = useCallback(
    async (questionText: string, targetLang?: Lang): Promise<StudioAskAnswer | null> => {
      const trimmed = questionText.trim();
      const ep = episodeRef.current;
      if (!trimmed || !ep) return null;

      // Pause programme immediately before answering and capture current segment & offset
      const currentOff = audioRef.current?.currentTime ?? sessionRef.current.offsetSeconds;
      audioRef.current?.pause();
      answerAudioRef.current?.pause();
      persistPosition(sessionRef.current.segmentIndex, currentOff);

      // Abort any previous in-flight research request
      askAbortRef.current?.abort();
      const controller = new AbortController();
      askAbortRef.current = controller;

      const reqId = sessionRef.current.activeAskRequestId + 1;
      dispatch({ type: 'SUBMIT_QUESTION', offsetSeconds: currentOff });
      setAskBusy(true);
      setAskProgress('Pausing programme & inspecting current segment citations…');

      const activeSeg = ep.segments[sessionRef.current.segmentIndex] ?? ep.segments[0];
      const t0 = performance.now();

      const progressTimer = window.setTimeout(() => {
        if (!controller.signal.aborted) {
          setAskProgress('Querying verified QuranEnc, HadeethEnc & IslamHouse catalogues…');
        }
      }, 350);

      try {
        const res = await fetch('/api/studio/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            episodeId: ep.id,
            segmentId: activeSeg?.id ?? 'seg-1',
            question: trimmed,
            lang: ep.lang,
            ...(targetLang ? { targetLang } : {}),
          }),
        });
        window.clearTimeout(progressTimer);

        if (controller.signal.aborted || sessionRef.current.activeAskRequestId !== reqId) {
          return null;
        }

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }

        const data = (await res.json()) as StudioAskAnswer;
        if (controller.signal.aborted || sessionRef.current.activeAskRequestId !== reqId) {
          return null;
        }

        const elapsed = Math.round(performance.now() - t0);
        setTimings(prev => ({ ...prev, lastQuestionResearchMs: elapsed }));
        setAnswer(data);
        setAskBusy(false);
        setAskProgress(null);

        dispatch({ type: 'RESEARCH_RESOLVED', requestId: reqId, speakAnswer: false });
        return data;
      } catch (err) {
        window.clearTimeout(progressTimer);
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          return null;
        }
        setAskBusy(false);
        setAskProgress(null);
        dispatch({
          type: 'PROVIDER_FAILURE',
          requestId: reqId,
          message: err instanceof Error ? err.message : 'Could not complete source research for this question.',
        });
        return null;
      }
    },
    [persistPosition],
  );

  const speakAnswer = useCallback(
    async (ans: StudioAskAnswer) => {
      if (!aiConfigured) return;
      audioRef.current?.pause();
      stopAudio();
      const spokenText = ans.paragraphs.map(p => p.text).join(' ');
      const nextToken = sessionRef.current.activeRunToken + 1;
      dispatch({
        type: 'LOAD_PROGRAMME',
        episodeId: sessionRef.current.episodeId,
        segmentIndex: sessionRef.current.segmentIndex,
        offsetSeconds: sessionRef.current.offsetSeconds,
      });
      try {
        const res = await postJson<TtsResult>('/api/voice/narrate', {
          text: spokenText.slice(0, 2800),
          voice: 'Kore',
          lang: ans.lang,
        });
        if (sessionRef.current.activeRunToken !== nextToken) return;
        const url = base64ToObjectUrl(res.audioBase64, res.mimeType || 'audio/wav');
        const ansEl = answerAudioRef.current;
        if (!ansEl) return;
        claimPlayback(ansEl);
        ansEl.src = url;
        ansEl.onplaying = () => {
          dispatch({ type: 'ANSWER_AUDIO_PLAYING', runToken: nextToken });
        };
        ansEl.onended = () => {
          URL.revokeObjectURL(url);
          dispatch({ type: 'ANSWER_AUDIO_ENDED', runToken: nextToken });
        };
        await ansEl.play();
      } catch (err) {
        dispatch({
          type: 'PROVIDER_FAILURE',
          runToken: nextToken,
          message: err instanceof Error ? err.message : 'Answer narration failed.',
        });
      }
    },
    [aiConfigured],
  );

  const startMicrophone = useCallback(
    (onTranscript: (text: string) => void) => {
      const Ctor = getSpeechConstructor();
      if (!Ctor) return;
      if (speechRef.current) {
        speechRef.current.stop();
        speechRef.current = null;
        dispatch({ type: 'STOP_MIC' });
        return;
      }
      const currentOff = audioRef.current?.currentTime ?? sessionRef.current.offsetSeconds;
      audioRef.current?.pause();
      answerAudioRef.current?.pause();
      dispatch({ type: 'START_MIC', offsetSeconds: currentOff });

      const recognition = new Ctor();
      recognition.lang = lang === 'ta' ? 'ta-IN' : lang === 'si' ? 'si-LK' : 'en-US';
      recognition.interimResults = true;
      recognition.onstart = () => {
        dispatch({ type: 'MIC_READY' });
      };
      recognition.onresult = event => {
        let text = '';
        for (let i = 0; i < event.results.length; i += 1) {
          text += event.results[i][0]?.transcript ?? '';
        }
        onTranscript(text.trim());
      };
      recognition.onerror = () => {
        speechRef.current = null;
        dispatch({ type: 'STOP_MIC' });
      };
      recognition.onend = () => {
        speechRef.current = null;
        if (sessionRef.current.phase === 'listening_to_user') {
          dispatch({ type: 'STOP_MIC' });
        }
      };
      speechRef.current = recognition;
      try {
        recognition.start();
        // If browser does not fire onstart separately, transition after start() succeeds
        dispatch({ type: 'MIC_READY' });
      } catch {
        speechRef.current = null;
        dispatch({ type: 'STOP_MIC' });
      }
    },
    [lang],
  );

  const stopMicrophone = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;
    dispatch({ type: 'STOP_MIC' });
  }, []);

  const saveCurrentPoint = useCallback(() => {
    const ep = episodeRef.current;
    if (!ep) return null;
    const seg = ep.segments[sessionRef.current.segmentIndex] ?? ep.segments[0];
    if (!seg) return null;
    const point: SavedListeningPoint = {
      id: `pt-${Date.now().toString(36)}`,
      episodeId: ep.id,
      episodeTitle: ep.title,
      segmentId: seg.id,
      segmentIndex: seg.index,
      offsetSeconds: Math.round((audioRef.current?.currentTime ?? sessionRef.current.offsetSeconds) * 10) / 10,
      excerpt: seg.text.slice(0, 220),
      citations: seg.citations,
      savedAt: new Date().toISOString(),
    };
    setSessionSavedPoints(prev => [point, ...prev.filter(p => p.segmentId !== point.segmentId || p.episodeId !== point.episodeId)].slice(0, 30));
    persistPosition(seg.index, point.offsetSeconds);
    if (prefs.optIn) {
      setRawPrefs(prev =>
        sanitizeListenerPreferences({
          ...prev,
          savedPoints: [point, ...prev.savedPoints],
        }),
      );
    }
    return point;
  }, [persistPosition, prefs.optIn, setRawPrefs, setSessionSavedPoints]);

  const toggleSaveEpisode = useCallback(
    (episodeId: string) => {
      setSessionSavedEpisodes(prev =>
        prev.includes(episodeId) ? prev.filter(id => id !== episodeId) : [episodeId, ...prev],
      );
      if (prefs.optIn) {
        setRawPrefs(prev => {
          const exists = prev.savedEpisodes.includes(episodeId);
          return sanitizeListenerPreferences({
            ...prev,
            savedEpisodes: exists ? prev.savedEpisodes.filter(id => id !== episodeId) : [episodeId, ...prev.savedEpisodes],
          });
        });
      }
    },
    [prefs.optIn, setRawPrefs, setSessionSavedEpisodes],
  );

  const updatePreferences = useCallback(
    (next: Partial<StudioListenerPreferences>) => {
      setRawPrefs(prev => sanitizeListenerPreferences({ ...prev, ...next }));
    },
    [setRawPrefs],
  );

  const resetPreferences = useCallback(() => {
    setRawPrefs({ ...DEFAULT_LISTENER_PREFERENCES });
    setSessionSavedPosition(null);
    setSessionSavedPoints([]);
    setSessionSavedEpisodes([]);
  }, [setRawPrefs, setSessionSavedEpisodes, setSessionSavedPoints, setSessionSavedPosition]);

  const broadcastBadge = sessionBroadcastBadge(session.phase, episode?.broadcastLabel ?? 'Recorded programme');
  const phaseLabel = sessionPhaseLabel(session.phase);

  return {
    session,
    broadcastBadge,
    phaseLabel,
    answer,
    setAnswer,
    askBusy,
    askProgress,
    micSupported,
    timings,
    prefs,
    savedPosition: sessionSavedPosition ?? prefs.lastListeningPosition,
    savedPoints: prefs.optIn && prefs.savedPoints.length ? prefs.savedPoints : sessionSavedPoints,
    savedEpisodes: prefs.optIn && prefs.savedEpisodes.length ? prefs.savedEpisodes : sessionSavedEpisodes,
    toggleListen,
    pauseProgramme,
    resumeProgramme,
    playSegmentAt,
    seekToSegment,
    setSpeed,
    prepareAsk,
    askQuestion,
    cancelAsk,
    speakAnswer,
    startMicrophone,
    stopMicrophone,
    saveCurrentPoint,
    toggleSaveEpisode,
    persistPosition,
    updatePreferences,
    resetPreferences,
  };
}

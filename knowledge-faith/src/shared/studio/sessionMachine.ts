import type { Lang } from '../sources.ts';

/**
 * Studio Session & Playback State Machine.
 * Covers all 10 required operational states:
 * - idle
 * - loading
 * - playing_programme
 * - paused
 * - listening_to_user
 * - researching
 * - playing_answer
 * - ready_to_resume
 * - error
 * - cancelled
 */
export type StudioSessionPhase =
  | 'idle'
  | 'loading'
  | 'playing_programme'
  | 'paused'
  | 'listening_to_user'
  | 'researching'
  | 'playing_answer'
  | 'ready_to_resume'
  | 'error'
  | 'cancelled';

export interface SavedResumePoint {
  episodeId: string;
  segmentIndex: number;
  offsetSeconds: number;
  capturedAt: number;
}

export interface StudioSessionSnapshot {
  phase: StudioSessionPhase;
  episodeId: string;
  lang: Lang;
  segmentIndex: number;
  offsetSeconds: number;
  playbackSpeed: number;
  resumePoint: SavedResumePoint | null;
  activeRunToken: number;
  activeAskRequestId: number;
  micReady: boolean;
  audioReady: boolean;
  errorMessage: string | null;
  backgrounded: boolean;
}

export type StudioSessionEvent =
  | { type: 'LOAD_PROGRAMME'; episodeId: string; segmentIndex?: number; offsetSeconds?: number }
  | { type: 'AUDIO_READY'; runToken: number }
  | { type: 'PAUSE'; offsetSeconds?: number }
  | { type: 'SEEK'; segmentIndex: number; offsetSeconds: number }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'START_MIC'; offsetSeconds?: number }
  | { type: 'MIC_READY' }
  | { type: 'STOP_MIC' }
  | { type: 'OPEN_ASK'; offsetSeconds?: number }
  | { type: 'SUBMIT_QUESTION'; offsetSeconds?: number }
  | { type: 'RESEARCH_RESOLVED'; requestId: number; speakAnswer?: boolean }
  | { type: 'ANSWER_AUDIO_PLAYING'; runToken: number }
  | { type: 'ANSWER_AUDIO_ENDED'; runToken: number }
  | { type: 'CANCEL_RESEARCH' }
  | { type: 'RESUME_PROGRAMME' }
  | { type: 'CHANGE_LANGUAGE'; lang: Lang; newEpisodeId?: string }
  | { type: 'CHANGE_EPISODE'; episodeId: string; segmentIndex?: number; offsetSeconds?: number }
  | { type: 'PROVIDER_FAILURE'; runToken?: number; requestId?: number; message: string }
  | { type: 'AUTOPLAY_BLOCKED'; runToken: number; message?: string }
  | { type: 'VISIBILITY_CHANGE'; hidden: boolean; offsetSeconds?: number }
  | { type: 'UNMOUNT' };

export function createInitialStudioSession(episodeId = 'tonight-mercy-ar-rahman', lang: Lang = 'en'): StudioSessionSnapshot {
  return {
    phase: 'idle',
    episodeId,
    lang,
    segmentIndex: 0,
    offsetSeconds: 0,
    playbackSpeed: 1,
    resumePoint: null,
    activeRunToken: 0,
    activeAskRequestId: 0,
    micReady: false,
    audioReady: false,
    errorMessage: null,
    backgrounded: false,
  };
}

function captureResume(state: StudioSessionSnapshot, offsetOverride?: number): SavedResumePoint {
  // If already in an Ask/Research/Answer flow with a captured resume point for this episode, preserve it!
  if (
    state.resumePoint &&
    state.resumePoint.episodeId === state.episodeId &&
    (state.phase === 'paused' ||
      state.phase === 'listening_to_user' ||
      state.phase === 'researching' ||
      state.phase === 'playing_answer' ||
      state.phase === 'ready_to_resume' ||
      state.phase === 'cancelled')
  ) {
    return state.resumePoint;
  }
  return {
    episodeId: state.episodeId,
    segmentIndex: state.segmentIndex,
    offsetSeconds: offsetOverride !== undefined ? Math.max(0, offsetOverride) : state.offsetSeconds,
    capturedAt: Date.now(),
  };
}

/**
 * Pure, deterministic state transition function for Studio session & playback reliability.
 */
export function transitionStudioSession(state: StudioSessionSnapshot, event: StudioSessionEvent): StudioSessionSnapshot {
  switch (event.type) {
    case 'LOAD_PROGRAMME': {
      const nextToken = state.activeRunToken + 1;
      const seg = event.segmentIndex !== undefined ? Math.max(0, event.segmentIndex) : state.segmentIndex;
      const off = event.offsetSeconds !== undefined ? Math.max(0, event.offsetSeconds) : state.offsetSeconds;
      return {
        ...state,
        phase: 'loading',
        episodeId: event.episodeId || state.episodeId,
        segmentIndex: seg,
        offsetSeconds: off,
        activeRunToken: nextToken,
        micReady: false,
        audioReady: false,
        errorMessage: null,
      };
    }

    case 'AUDIO_READY': {
      // Ignore stale audio ready callbacks from superseded play tokens
      if (event.runToken !== state.activeRunToken) return state;
      return {
        ...state,
        phase: 'playing_programme',
        audioReady: true,
        micReady: false,
        errorMessage: null,
      };
    }

    case 'PAUSE': {
      const off = event.offsetSeconds !== undefined ? Math.max(0, event.offsetSeconds) : state.offsetSeconds;
      return {
        ...state,
        phase: 'paused',
        offsetSeconds: off,
        resumePoint: {
          episodeId: state.episodeId,
          segmentIndex: state.segmentIndex,
          offsetSeconds: off,
          capturedAt: Date.now(),
        },
        activeRunToken: state.activeRunToken + 1,
        audioReady: false,
        micReady: false,
      };
    }

    case 'SEEK': {
      const seg = Math.max(0, event.segmentIndex);
      const off = Math.max(0, event.offsetSeconds);
      return {
        ...state,
        segmentIndex: seg,
        offsetSeconds: off,
        resumePoint: state.resumePoint
          ? { ...state.resumePoint, segmentIndex: seg, offsetSeconds: off }
          : null,
      };
    }

    case 'SET_SPEED': {
      const clamped = Math.min(2, Math.max(0.5, Number(event.speed) || 1));
      return { ...state, playbackSpeed: clamped };
    }

    case 'START_MIC': {
      const resumePoint = captureResume(state, event.offsetSeconds);
      return {
        ...state,
        phase: 'paused',
        offsetSeconds: resumePoint.offsetSeconds,
        resumePoint,
        activeRunToken: state.activeRunToken + 1,
        audioReady: false,
        micReady: false,
        errorMessage: null,
      };
    }

    case 'MIC_READY': {
      return {
        ...state,
        phase: 'listening_to_user',
        micReady: true,
        audioReady: false,
        errorMessage: null,
      };
    }

    case 'STOP_MIC': {
      return {
        ...state,
        phase: state.resumePoint ? 'ready_to_resume' : 'paused',
        micReady: false,
      };
    }

    case 'OPEN_ASK': {
      const resumePoint = captureResume(state, event.offsetSeconds);
      return {
        ...state,
        phase: 'paused',
        offsetSeconds: resumePoint.offsetSeconds,
        resumePoint,
        activeRunToken: state.activeRunToken + 1,
        audioReady: false,
        micReady: false,
        errorMessage: null,
      };
    }

    case 'SUBMIT_QUESTION': {
      const resumePoint = captureResume(state, event.offsetSeconds);
      return {
        ...state,
        phase: 'researching',
        offsetSeconds: resumePoint.offsetSeconds,
        resumePoint,
        activeRunToken: state.activeRunToken + 1,
        activeAskRequestId: state.activeAskRequestId + 1,
        audioReady: false,
        micReady: false,
        errorMessage: null,
      };
    }

    case 'RESEARCH_RESOLVED': {
      // Stale response protection: ignore responses whose requestId does not match the latest activeAskRequestId
      // or if the session was cancelled/changed.
      if (event.requestId !== state.activeAskRequestId || state.phase !== 'researching') {
        return state;
      }
      if (event.speakAnswer) {
        return {
          ...state,
          phase: 'loading',
          activeRunToken: state.activeRunToken + 1,
          audioReady: false,
          errorMessage: null,
        };
      }
      return {
        ...state,
        phase: 'ready_to_resume',
        audioReady: false,
        errorMessage: null,
      };
    }

    case 'ANSWER_AUDIO_PLAYING': {
      if (event.runToken !== state.activeRunToken) return state;
      return {
        ...state,
        phase: 'playing_answer',
        audioReady: true,
        micReady: false,
        errorMessage: null,
      };
    }

    case 'ANSWER_AUDIO_ENDED': {
      if (event.runToken !== state.activeRunToken) return state;
      return {
        ...state,
        phase: 'ready_to_resume',
        audioReady: false,
      };
    }

    case 'CANCEL_RESEARCH': {
      return {
        ...state,
        phase: 'cancelled',
        activeAskRequestId: state.activeAskRequestId + 1,
        activeRunToken: state.activeRunToken + 1,
        micReady: false,
        audioReady: false,
        errorMessage: null,
      };
    }

    case 'RESUME_PROGRAMME': {
      const seg = state.resumePoint?.episodeId === state.episodeId ? state.resumePoint.segmentIndex : state.segmentIndex;
      const off = state.resumePoint?.episodeId === state.episodeId ? state.resumePoint.offsetSeconds : state.offsetSeconds;
      return {
        ...state,
        phase: 'loading',
        segmentIndex: seg,
        offsetSeconds: off,
        activeRunToken: state.activeRunToken + 1,
        activeAskRequestId: state.activeAskRequestId + 1,
        audioReady: false,
        micReady: false,
        errorMessage: null,
      };
    }

    case 'CHANGE_LANGUAGE': {
      const nextEpisodeId = event.newEpisodeId ?? state.episodeId;
      return {
        ...state,
        phase: 'idle',
        lang: event.lang,
        episodeId: nextEpisodeId,
        offsetSeconds: 0,
        activeRunToken: state.activeRunToken + 1,
        activeAskRequestId: state.activeAskRequestId + 1,
        audioReady: false,
        micReady: false,
        errorMessage: null,
      };
    }

    case 'CHANGE_EPISODE': {
      const seg = event.segmentIndex ?? 0;
      const off = event.offsetSeconds ?? 0;
      return {
        ...state,
        phase: 'idle',
        episodeId: event.episodeId,
        segmentIndex: seg,
        offsetSeconds: off,
        resumePoint: null,
        activeRunToken: state.activeRunToken + 1,
        activeAskRequestId: state.activeAskRequestId + 1,
        audioReady: false,
        micReady: false,
        errorMessage: null,
      };
    }

    case 'PROVIDER_FAILURE': {
      if (event.runToken !== undefined && event.runToken !== state.activeRunToken) return state;
      if (event.requestId !== undefined && event.requestId !== state.activeAskRequestId) return state;
      return {
        ...state,
        phase: 'error',
        audioReady: false,
        micReady: false,
        errorMessage: event.message,
      };
    }

    case 'AUTOPLAY_BLOCKED': {
      if (event.runToken !== state.activeRunToken) return state;
      return {
        ...state,
        phase: 'paused',
        audioReady: false,
        errorMessage: event.message ?? 'Browser autoplay is restricted. Press Listen to start audio playback.',
      };
    }

    case 'VISIBILITY_CHANGE': {
      const off = event.offsetSeconds !== undefined ? Math.max(0, event.offsetSeconds) : state.offsetSeconds;
      if (event.hidden) {
        return {
          ...state,
          backgrounded: true,
          offsetSeconds: off,
          resumePoint:
            state.phase === 'playing_programme'
              ? {
                  episodeId: state.episodeId,
                  segmentIndex: state.segmentIndex,
                  offsetSeconds: off,
                  capturedAt: Date.now(),
                }
              : state.resumePoint,
        };
      }
      return {
        ...state,
        backgrounded: false,
      };
    }

    case 'UNMOUNT': {
      return {
        ...state,
        phase: 'idle',
        activeRunToken: state.activeRunToken + 1,
        activeAskRequestId: state.activeAskRequestId + 1,
        audioReady: false,
        micReady: false,
      };
    }
  }
}

/**
 * Returns "On Air" ONLY when there is an actual active programme stream or session.
 * Returns "Recorded programme" or "On demand" when idle/paused.
 */
export function sessionBroadcastBadge(
  phase: StudioSessionPhase,
  fallback: 'Recorded programme' | 'On demand' = 'Recorded programme',
): 'On Air' | 'Recorded programme' | 'On demand' {
  if (
    phase === 'playing_programme' ||
    phase === 'playing_answer' ||
    phase === 'listening_to_user' ||
    phase === 'researching'
  ) {
    return 'On Air';
  }
  return fallback;
}

export function sessionPhaseLabel(phase: StudioSessionPhase): string {
  switch (phase) {
    case 'idle':
      return 'Idle · Ready to listen';
    case 'loading':
      return 'Loading audio…';
    case 'playing_programme':
      return 'Playing programme';
    case 'paused':
      return 'Paused';
    case 'listening_to_user':
      return 'Listening to your question…';
    case 'researching':
      return 'Researching sources…';
    case 'playing_answer':
      return 'Speaking cited answer';
    case 'ready_to_resume':
      return 'Answer ready · Ready to resume programme';
    case 'cancelled':
      return 'Cancelled · Ready to resume';
    case 'error':
      return 'Audio or research notice';
  }
}

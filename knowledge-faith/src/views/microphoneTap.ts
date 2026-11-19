/** Shown only after the tap's getUserMedia rejects with a real permission denial. */
export const MICROPHONE_DENIED_MESSAGE =
  'Microphone permission denied. Please allow microphone access in your browser.';

export function isMicrophoneDenial(error: unknown): boolean {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name) : '';
  return name === 'NotAllowedError' || name === 'PermissionDeniedError';
}

export interface SpeechEngine {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechHost {
  SpeechRecognition?: new () => SpeechEngine;
  webkitSpeechRecognition?: new () => SpeechEngine;
}

export function speechRecognitionConstructor(): (new () => SpeechEngine) | null {
  if (typeof window === 'undefined') return null;
  const host = window as unknown as SpeechHost;
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

/**
 * Call this as the first line of the tap handler, before any await.
 * iOS Safari shows the microphone prompt only for getUserMedia invoked in that gesture.
 */
export function requestMicrophoneFromTap(): Promise<MediaStream> {
  const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!media?.getUserMedia) {
    return Promise.reject(new DOMException('Audio recording is not supported in this browser.', 'NotSupportedError'));
  }
  return media.getUserMedia({ audio: true });
}

function stopTracksOf(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch { /* The rest of the capture still has to release. */ }
  }
}

function trackIsOpen(track: MediaStreamTrack) {
  return track.readyState !== 'ended';
}

/**
 * `microphone` must be the promise created in the tap via requestMicrophoneFromTap.
 * This function does not call getUserMedia again. A later call would sit outside the
 * gesture, and iOS would reject it without a prompt.
 * Web Speech may start in this same turn. Its not-allowed error is not a denial:
 * a missing grant stays on the getUserMedia promise until the browser answers.
 */
export function beginDictationTap(options: {
  microphone: Promise<MediaStream>;
  lang: string;
  preferWebSpeech: boolean;
  isActive?: () => boolean;
  onArmed?: (stop: () => void) => void;
  onSpeechStart: (recognition: SpeechEngine) => void;
  onSpeechResult: (event: { results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }> }) => void;
  onSpeechEnd: () => void;
  onNoSpeech: () => void;
  onGemini: (stream: MediaStream) => void;
  onDenied: () => void;
  onUnavailable: (message: string) => void;
}): { stop: () => void } {
  const active = () => options.isActive?.() !== false;
  let stopped = false;
  let settled = false;
  let heard = false;
  let speechFailed = false;
  let speechListening = false;
  let ownsStream = true;
  let recognition: SpeechEngine | null = null;
  let stream: MediaStream | null = null;
  let recognitionStopped = false;

  const stopRecognition = () => {
    if (recognitionStopped) return;
    recognitionStopped = true;
    try { recognition?.stop(); } catch { /* Already stopped. */ }
  };

  const stopOwnedStream = () => {
    if (!ownsStream) return;
    stopTracksOf(stream);
  };

  const stop = () => {
    stopped = true;
    stopRecognition();
    stopOwnedStream();
  };

  const useGemini = (granted: MediaStream) => {
    if (settled || stopped || !active()) {
      if (ownsStream) stopTracksOf(granted);
      return;
    }
    settled = true;
    ownsStream = false;
    stream = granted;
    options.onGemini(granted);
  };

  const failGrant = (error: unknown) => {
    if (stopped || settled || heard || speechListening || !active()) return;
    settled = true;
    stopRecognition();
    const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name) : '';
    if (isMicrophoneDenial(error)) options.onDenied();
    else if (name === 'NotSupportedError') options.onUnavailable('Audio recording is not supported in this browser.');
    else options.onUnavailable('Microphone access or audio recording failed. Please try again.');
  };

  void options.microphone.then(granted => {
    if (stopped || !active()) {
      if (ownsStream) stopTracksOf(granted);
      return;
    }
    if (speechListening) {
      stopTracksOf(granted);
      return;
    }
    stream = granted;
    if (speechFailed || !recognition) useGemini(granted);
  }).catch(error => {
    failGrant(error);
  });

  options.onArmed?.(stop);

  const Ctor = options.preferWebSpeech ? speechRecognitionConstructor() : null;
  if (Ctor) {
    try {
      recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = options.lang;
      recognition.onstart = () => {
        if (stopped || speechFailed || !active()) return;
        speechListening = true;
        heard = true;
        stopOwnedStream();
        stream = null;
        ownsStream = false;
        options.onSpeechStart(recognition as SpeechEngine);
      };
      recognition.onresult = event => {
        if (stopped || settled || speechFailed || !active()) return;
        heard = true;
        options.onSpeechResult(event);
      };
      recognition.onerror = event => {
        if (stopped || settled || speechFailed || !active()) return;
        if (event.error === 'no-speech') {
          settled = true;
          stopRecognition();
          options.onNoSpeech();
          return;
        }
        // not-allowed and service-not-allowed mean Web Speech never asked.
        // They are not a denial. The tap's getUserMedia promise still decides.
        speechFailed = true;
        stopRecognition();
        if (!heard && stream && stream.getTracks().some(trackIsOpen)) {
          useGemini(stream);
          return;
        }
        if (!heard) return;
        settled = true;
        options.onUnavailable('Voice recognition stopped. Press the microphone to try again.');
      };
      recognition.onend = () => {
        if (stopped || settled || speechFailed || !heard || !active()) return;
        settled = true;
        options.onSpeechEnd();
      };
      recognition.start();
    } catch {
      recognition = null;
      speechFailed = true;
    }
  }

  return { stop };
}

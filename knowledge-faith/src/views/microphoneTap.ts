/** Shown only after getUserMedia rejects with a real permission denial. */
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
 * Call from the tap handler and do not await anything before it.
 * iOS Safari shows the microphone prompt only for getUserMedia invoked in that gesture.
 * Web Speech starts after the grant, so a missing prior grant is not reported as a denial.
 * If that start fails, the already-open stream is handed to the Gemini recorder.
 */
export function beginDictationTap(options: {
  lang: string;
  preferWebSpeech: boolean;
  isActive?: () => boolean;
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
  let listening = false;
  let ownsStream = true;
  let recognition: SpeechEngine | null = null;
  let stream: MediaStream | null = null;

  const stopTracks = () => {
    if (!ownsStream || !stream) return;
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch { /* The rest of the capture still has to release. */ }
    }
  };

  const stop = () => {
    stopped = true;
    try { recognition?.stop(); } catch { /* Already stopped. */ }
    stopTracks();
  };

  const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  const request = media?.getUserMedia
    ? media.getUserMedia({ audio: true })
    : Promise.reject(new DOMException('Audio recording is not supported in this browser.', 'NotSupportedError'));

  const useGemini = (granted: MediaStream) => {
    if (settled || stopped || !active()) {
      if (ownsStream) granted.getTracks().forEach(track => { try { track.stop(); } catch { /* continue */ } });
      return;
    }
    settled = true;
    ownsStream = false;
    options.onGemini(granted);
  };

  void request.then(granted => {
    stream = granted;
    if (stopped || !active()) {
      stopTracks();
      return;
    }
    const Ctor = options.preferWebSpeech ? speechRecognitionConstructor() : null;
    if (!Ctor) {
      useGemini(granted);
      return;
    }
    try {
      recognition = new Ctor();
    } catch {
      useGemini(granted);
      return;
    }
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = options.lang;
    recognition.onstart = () => {
      if (stopped || !active()) return;
      listening = true;
      // Web Speech captures on its own. Keep the grant stream until then so a failed start can record it.
      stopTracks();
      ownsStream = false;
      options.onSpeechStart(recognition as SpeechEngine);
    };
    recognition.onresult = event => {
      if (stopped || settled || !listening || !active()) return;
      options.onSpeechResult(event);
    };
    recognition.onerror = event => {
      if (stopped || settled || !active()) return;
      if (event.error === 'no-speech') {
        settled = true;
        options.onNoSpeech();
        return;
      }
      // The start() below is the real attempt. It runs only after the grant.
      try { recognition?.stop(); } catch { /* continue into the recorder */ }
      recognition = null;
      if (!listening && granted.getTracks().some(track => track.readyState === 'live')) {
        useGemini(granted);
        return;
      }
      const again = media?.getUserMedia?.({ audio: true });
      if (!again) {
        options.onUnavailable('Audio recording is not supported in this browser.');
        return;
      }
      void again.then(next => {
        if (stopped || !active()) {
          next.getTracks().forEach(track => { try { track.stop(); } catch { /* continue */ } });
          return;
        }
        ownsStream = true;
        stream = next;
        useGemini(next);
      }).catch(error => {
        if (stopped || !active()) return;
        if (isMicrophoneDenial(error)) options.onDenied();
        else options.onUnavailable('Microphone access or audio recording failed. Please try again.');
      });
    };
    recognition.onend = () => {
      if (stopped || settled || !listening || !active()) return;
      settled = true;
      options.onSpeechEnd();
    };
    try {
      recognition.start();
    } catch {
      useGemini(granted);
    }
  }).catch(error => {
    if (stopped || !active()) return;
    const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name) : '';
    if (isMicrophoneDenial(error)) options.onDenied();
    else if (name === 'NotSupportedError') options.onUnavailable('Audio recording is not supported in this browser.');
    else options.onUnavailable('Microphone access or audio recording failed. Please try again.');
  });

  return { stop };
}

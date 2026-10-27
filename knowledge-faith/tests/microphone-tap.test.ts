import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginDictationTap,
  isMicrophoneDenial,
  MICROPHONE_DENIED_MESSAGE,
  requestMicrophoneFromTap,
  type SpeechEngine,
} from '../src/views/microphoneTap.ts';

interface FakeTrack {
  readyState: 'live' | 'ended';
  stop: () => void;
}

function liveStream() {
  const tracks: FakeTrack[] = [0, 1].map(() => {
    const track: FakeTrack = {
      readyState: 'live',
      stop() { track.readyState = 'ended'; },
    };
    return track;
  });
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks };
}

function withBrowser(options: {
  speech?: new () => SpeechEngine;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
}, run: () => Promise<void>) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: { SpeechRecognition: options.speech },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: { mediaDevices: { getUserMedia: options.getUserMedia ?? (() => Promise.reject(new DOMException('missing', 'NotSupportedError'))) } },
  });
  return run().finally(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });
}

test('a missing microphone grant is not a denial', () => {
  assert.equal(isMicrophoneDenial(undefined), false);
  assert.equal(isMicrophoneDenial(new Error('denied')), false);
  assert.equal(isMicrophoneDenial(new DOMException('no device', 'NotFoundError')), false);
  assert.equal(isMicrophoneDenial(new DOMException('no', 'NotAllowedError')), true);
  assert.equal(isMicrophoneDenial(new DOMException('no', 'PermissionDeniedError')), true);
  assert.equal(MICROPHONE_DENIED_MESSAGE, 'Microphone permission denied. Please allow microphone access in your browser.');
});

test('requestMicrophoneFromTap calls getUserMedia in the same turn', async () => {
  let calls = 0;
  await withBrowser({
    getUserMedia: constraints => {
      calls += 1;
      assert.deepEqual(constraints, { audio: true });
      return new Promise(() => { /* The prompt is still open. */ });
    },
  }, async () => {
    requestMicrophoneFromTap();
    assert.equal(calls, 1);
  });
});

test('Web Speech not-allowed waits for the tap grant and does not deny', async () => {
  let resolveMedia!: (stream: MediaStream) => void;
  let requests = 0;
  let recognition!: SpeechEngine;
  class Speech implements SpeechEngine {
    continuous = false;
    interimResults = false;
    lang = '';
    onstart: SpeechEngine['onstart'] = null;
    onresult: SpeechEngine['onresult'] = null;
    onerror: SpeechEngine['onerror'] = null;
    onend: SpeechEngine['onend'] = null;
    constructor() { recognition = this; }
    start() {}
    stop() {}
  }
  const { stream, tracks } = liveStream();
  await withBrowser({
    speech: Speech,
    getUserMedia: () => {
      requests += 1;
      return new Promise(resolve => { resolveMedia = resolve; });
    },
  }, async () => {
    let denied = 0;
    let gemini = 0;
    let unavailable = 0;
    const microphone = requestMicrophoneFromTap();
    assert.equal(requests, 1);
    beginDictationTap({
      microphone,
      lang: 'ta-IN',
      preferWebSpeech: true,
      onSpeechStart() {},
      onSpeechResult() {},
      onSpeechEnd() {},
      onNoSpeech() {},
      onGemini() { gemini += 1; },
      onDenied() { denied += 1; },
      onUnavailable() { unavailable += 1; },
    });
    assert.equal(recognition.lang, 'ta-IN');
    recognition.onerror?.({ error: 'not-allowed' });
    recognition.onerror?.({ error: 'service-not-allowed' });
    assert.equal(requests, 1);
    assert.equal(denied, 0);
    assert.equal(gemini, 0);
    assert.equal(unavailable, 0);
    resolveMedia(stream);
    await microphone;
    assert.equal(gemini, 1);
    assert.equal(denied, 0);
    assert.equal(tracks.every(track => track.readyState === 'live'), true);
  });
});

test('NotAllowedError from the tap grant is the denial', async () => {
  let rejectMedia!: (error: unknown) => void;
  class Speech implements SpeechEngine {
    continuous = false;
    interimResults = false;
    lang = '';
    onstart: SpeechEngine['onstart'] = null;
    onresult: SpeechEngine['onresult'] = null;
    onerror: SpeechEngine['onerror'] = null;
    onend: SpeechEngine['onend'] = null;
    start() {}
    stop() {}
  }
  await withBrowser({
    speech: Speech,
    getUserMedia: () => new Promise((_, reject) => { rejectMedia = reject; }),
  }, async () => {
    let denied = 0;
    let gemini = 0;
    const microphone = requestMicrophoneFromTap();
    beginDictationTap({
      microphone,
      lang: 'ta-IN',
      preferWebSpeech: true,
      onSpeechStart() {},
      onSpeechResult() {},
      onSpeechEnd() {},
      onNoSpeech() {},
      onGemini() { gemini += 1; },
      onDenied() { denied += 1; },
      onUnavailable() {},
    });
    rejectMedia(new DOMException('The request is not allowed by the user agent.', 'NotAllowedError'));
    await microphone.catch(() => undefined);
    assert.equal(denied, 1);
    assert.equal(gemini, 0);
  });
});

test('a generic getUserMedia failure is not shown as a permission denial', async () => {
  let rejectMedia!: (error: unknown) => void;
  await withBrowser({
    getUserMedia: () => new Promise((_, reject) => { rejectMedia = reject; }),
  }, async () => {
    let denied = 0;
    let unavailable = '';
    const microphone = requestMicrophoneFromTap();
    beginDictationTap({
      microphone,
      lang: 'en-US',
      preferWebSpeech: false,
      onSpeechStart() {},
      onSpeechResult() {},
      onSpeechEnd() {},
      onNoSpeech() {},
      onGemini() {},
      onDenied() { denied += 1; },
      onUnavailable(message) { unavailable = message; },
    });
    rejectMedia(new Error('denied'));
    await microphone.catch(() => undefined);
    assert.equal(denied, 0);
    assert.match(unavailable, /failed/i);
  });
});

test('no-speech is not a denial, and cancelling the tap stops a late grant', async () => {
  let resolveMedia!: (stream: MediaStream) => void;
  let recognition!: SpeechEngine;
  let stops = 0;
  class Speech implements SpeechEngine {
    continuous = false;
    interimResults = false;
    lang = '';
    onstart: SpeechEngine['onstart'] = null;
    onresult: SpeechEngine['onresult'] = null;
    onerror: SpeechEngine['onerror'] = null;
    onend: SpeechEngine['onend'] = null;
    constructor() { recognition = this; }
    start() {}
    stop() { stops += 1; }
  }
  const { stream, tracks } = liveStream();
  await withBrowser({
    speech: Speech,
    getUserMedia: () => new Promise(resolve => { resolveMedia = resolve; }),
  }, async () => {
    let denied = 0;
    let noSpeech = 0;
    let gemini = 0;
    const microphone = requestMicrophoneFromTap();
    const tap = beginDictationTap({
      microphone,
      lang: 'ta-IN',
      preferWebSpeech: true,
      onSpeechStart() {},
      onSpeechResult() {},
      onSpeechEnd() {},
      onNoSpeech() { noSpeech += 1; },
      onGemini() { gemini += 1; },
      onDenied() { denied += 1; },
      onUnavailable() {},
    });
    recognition.onerror?.({ error: 'no-speech' });
    assert.equal(noSpeech, 1);
    assert.equal(denied, 0);
    assert.equal(stops, 1);
    tap.stop();
    assert.equal(stops, 1);
    resolveMedia(stream);
    await microphone;
    assert.equal(gemini, 0);
    assert.equal(tracks.every(track => track.readyState === 'ended'), true);
  });
});

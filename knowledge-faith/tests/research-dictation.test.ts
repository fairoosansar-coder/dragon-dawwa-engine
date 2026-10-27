import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from '../src/lib/store.tsx';
import { ResearchCapture } from '../src/views/ResearchCapture.tsx';
import { DictationSession } from '../src/views/dictationSession.ts';

const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };

async function fixture() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const put = (key: string, value: unknown) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  for (const key of ['window', 'document', 'navigator', 'localStorage', 'FileReader', 'Blob']) put(key, (dom.window as unknown as Record<string, unknown>)[key]);
  put('IS_REACT_ACT_ENVIRONMENT', true);
  let resolveMedia!: (stream: unknown) => void;
  let rejectMedia!: (error: Error) => void;
  let requests = 0;
  const stops = [0, 0];
  const stream = { getTracks: () => stops.map((_, i) => ({ stop: () => { stops[i]++; } })) };
  Object.defineProperty(dom.window.navigator, 'mediaDevices', { value: { getUserMedia: () => {
    requests++;
    return new Promise((resolve, reject) => { resolveMedia = resolve; rejectMedia = reject; });
  } } });
  let constructionFails = false;
  let startFails = false;
  class Recorder {
    static instances: Recorder[] = [];
    state = 'inactive'; mimeType = 'audio/webm';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { if (constructionFails) throw Error('constructor'); Recorder.instances.push(this); }
    start() { if (startFails) throw Error('start'); this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(['fake audio']) });
        this.onstop?.();
      });
    }
  }
  put('MediaRecorder', Recorder);
  let transcriptionCalls = 0;
  let transcribe: () => Promise<Response> = async () => new Response(JSON.stringify({ text: 'தமிழ் العربية' }));
  put('fetch', async (url: string) => {
    if (url === '/api/transcribe-audio') { transcriptionCalls++; return transcribe(); }
    return new Response(JSON.stringify({}));
  });
  const root = createRoot(dom.window.document.getElementById('root')!);
  let value = 'Existing question';
  let disabled = false;
  const render = async (next = false) => {
    disabled = next;
    await act(async () => {
      root.render(React.createElement(AppProvider, null, React.createElement(ResearchCapture, { value, disabled, onChange: nextValue => { value = nextValue; } })));
      await flush();
    });
  };
  await render();
  const click = async () => { await act(async () => { (dom.window.document.querySelector('[data-research-capture="mic"]') as HTMLButtonElement).click(); await flush(); }); };
  return {
    dom, render, click, stops, Recorder,
    get requests() { return requests; }, get value() { return value; }, get transcriptionCalls() { return transcriptionCalls; },
    failConstruction() { constructionFails = true; }, failStart() { startFails = true; },
    setTranscribe(fn: () => Promise<Response>) { transcribe = fn; },
    async grant() { await act(async () => { resolveMedia(stream); await flush(); }); },
    async deny() { await act(async () => { rejectMedia(Error('denied')); await flush(); }); },
    async event(name: string) { await act(async () => { dom.window.dispatchEvent(new dom.window.Event(name)); await flush(); }); },
    async unmount() { await act(async () => root.unmount()); },
    async close() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

test('session releases all tracks even when one stop throws, and releases late streams', () => {
  const session = new DictationSession(); let stopped = 0;
  session.ownStream({ getTracks: () => [{ stop() { throw Error('ended'); } }, { stop() { stopped++; } }] } as unknown as MediaStream);
  session.cancel(); session.cancel();
  session.ownStream({ getTracks: () => [{ stop() { stopped++; } }] } as unknown as MediaStream);
  assert.equal(stopped, 2);
});

for (const action of ['disabled', 'hashchange', 'pagehide', 'unmount', 'click']) {
  test(`pending permission is cancelled by ${action} and late tracks are stopped`, async () => {
    const f = await fixture();
    try {
      await f.click();
      assert.equal(f.requests, 1);
      if (action === 'disabled') await f.render(true);
      else if (action === 'unmount') await f.unmount();
      else if (action === 'click') await f.click();
      else await f.event(action);
      await f.grant();
      assert.deepEqual(f.stops, [1, 1]);
      assert.equal(f.Recorder.instances.length, 0);
      assert.equal(f.transcriptionCalls, 0);
      assert.equal(f.value, 'Existing question');
    } finally { await f.close(); }
  });
}
for (const action of ['disabled', 'hashchange', 'pagehide', 'unmount', 'error']) {
  test(`active recording releases every track on ${action} without transcription`, async () => {
    const f = await fixture();
    try {
      await f.click(); await f.grant();
      if (action === 'disabled') await f.render(true);
      else if (action === 'unmount') await f.unmount();
      else if (action === 'error') await act(async () => { f.Recorder.instances[0].onerror?.(); });
      else await f.event(action);
      assert.deepEqual(f.stops, [1, 1]);
      assert.equal(f.Recorder.instances[0].state, 'inactive');
      assert.equal(f.transcriptionCalls, 0);
    } finally { await f.close(); }
  });
}
for (const failure of ['permission', 'constructor', 'start']) {
  test(`capture recovers from ${failure} failure`, async () => {
    const f = await fixture();
    try {
      if (failure === 'constructor') f.failConstruction();
      if (failure === 'start') f.failStart();
      await f.click();
      if (failure === 'permission') await f.deny(); else await f.grant();
      assert.deepEqual(f.stops, failure === 'permission' ? [0, 0] : [1, 1]);
      assert.ok(f.dom.window.document.querySelector('[aria-label="Start dictation"]'));
    } finally { await f.close(); }
  });
}
test('manual stop preserves existing text and multilingual transcript; repeated stop cannot start again', async () => {
  const f = await fixture();
  try {
    await f.click(); await f.grant(); await f.click(); await f.click();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.equal(f.requests, 1);
    assert.equal(f.transcriptionCalls, 1);
    assert.equal(f.value, 'Existing question\n\nதமிழ் العربية');
    assert.ok(f.stops.every(count => count >= 1));
  } finally { await f.close(); }
});
test('late transcription cannot change the submitted question', async () => {
  const f = await fixture(); let respond!: (response: Response) => void;
  try {
    f.setTranscribe(() => new Promise(resolve => { respond = resolve; }));
    await f.click(); await f.grant(); await f.click();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    await f.render(true);
    await act(async () => { respond(new Response(JSON.stringify({ text: 'late' }))); await flush(); });
    assert.equal(f.value, 'Existing question');
  } finally { await f.close(); }
});
for (const action of ['click', 'disabled', 'hashchange', 'unmount', 'error']) {
  test(`Web Speech ${action} stops recognition and ignores stale callbacks`, async () => {
    const f = await fixture(); let stopped = 0;
    let recognition: any;
    class Speech {
      onstart: any; onresult: any; onerror: any; onend: any;
      constructor() { recognition = this; }
      start() {} // Deliberately pending: another click must cancel, not create a second recognizer.
      stop() { stopped++; }
    }
    Object.assign(f.dom.window, { SpeechRecognition: Speech });
    try {
      await f.click();
      const lateResult = recognition.onresult;
      const lateStart = recognition.onstart;
      await act(async () => recognition.onresult({ results: [[{ transcript: 'مرحبا' }]] }));
      assert.equal(f.value, 'Existing question مرحبا');
      if (action === 'click') await f.click();
      else if (action === 'disabled') await f.render(true);
      else if (action === 'unmount') await f.unmount();
      else if (action === 'error') await act(async () => recognition.onerror({ error: 'not-allowed' }));
      else await f.event(action);
      await act(async () => { lateStart(); lateResult({ results: [[{ transcript: 'late' }]] }); });
      assert.equal(stopped, 1);
      // The tap asks once, in the click. Web Speech not-allowed is not a second request or a denial.
      assert.equal(f.requests, 1);
      assert.equal((f.dom.window.document.body.textContent ?? '').includes('Microphone permission denied'), false);
      assert.equal(f.value, 'Existing question مرحبا');
    } finally { await f.close(); }
  });
}
test('Web Speech fallback is owned by the same cancellable session', async () => {
  const f = await fixture(); let recognition: any; let stopped = 0;
  Object.assign(f.dom.window, { SpeechRecognition: class {
    onerror: any; constructor() { recognition = this; } start() {} stop() { stopped++; }
  } });
  try {
    await f.click();
    await act(async () => recognition.onerror({ error: 'network' }));
    assert.equal(f.requests, 1); assert.equal(stopped, 1);
    await f.click(); await f.grant();
    assert.deepEqual(f.stops, [1, 1]);
    assert.equal(f.Recorder.instances.length, 0);
  } finally { await f.close(); }
});
test('transcription failure returns to a usable start control', async () => {
  const f = await fixture();
  try {
    f.setTranscribe(async () => new Response('', { status: 500 }));
    await f.click(); await f.grant(); await f.click();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.match(f.dom.window.document.body.textContent ?? '', /Transcription returned 500/);
    assert.equal(f.value, 'Existing question');
    assert.ok(f.dom.window.document.querySelector('[aria-label="Start dictation"]'));
  } finally { await f.close(); }
});

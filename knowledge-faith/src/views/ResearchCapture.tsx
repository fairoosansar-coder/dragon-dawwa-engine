import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Image as ImageIcon, Loader2, Mic, MicOff } from 'lucide-react';
import { HadithMediaUploadModal } from '../engine/components/HadithMediaUploadModal.tsx';
import { dictationCode, languageLabel } from '../engine/utils/contentLanguage.ts';
import { useApp } from '../lib/store.tsx';
import { DictationSession } from './dictationSession.ts';
import { beginDictationTap, MICROPHONE_DENIED_MESSAGE, requestMicrophoneFromTap, type SpeechEngine } from './microphoneTap.ts';

type CaptureMode = 'camera' | 'upload_photo' | 'upload_file';
type DictationLang = 'en-US' | 'ta-IN' | 'si-LK' | 'ar-SA';

const ribbonButton =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm';

/** Photo, file, and microphone controls from the Hadith desk, writing into one question. */
export function ResearchCapture({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { lang } = useApp();
  const [mode, setMode] = useState<CaptureMode | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ label: string; excerpt: string } | null>(null);
  const [engine, setEngine] = useState<'webspeech' | 'ai_gemini'>('webspeech');
  const [dictationLang, setDictationLang] = useState<DictationLang>(dictationCode(lang));
  const sessionRef = useRef<DictationSession | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const baseRef = useRef('');
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setDictationLang(dictationCode(lang));
  }, [lang]);

  function cancelCapture() {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    stopRef.current = null;
  }

  useEffect(() => {
    const leave = () => {
      cancelCapture();
      setRecording(false);
      setTranscribing(false);
      setFeedback(null);
    };
    window.addEventListener('pagehide', leave);
    window.addEventListener('hashchange', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('hashchange', leave);
      cancelCapture();
    };
  }, []);
  useEffect(() => {
    if (!disabled) return;
    cancelCapture();
    setRecording(false);
    setTranscribing(false);
    setFeedback(null);
  }, [disabled]);

  function showPreview(label: string, text: string) {
    const excerpt = text.replace(/\s+/g, ' ').trim().slice(0, 160);
    if (excerpt) setPreview({ label, excerpt });
  }

  function appendText(incoming: string) {
    const next = incoming.replace(/\s+/g, ' ').trim();
    if (!next) return;
    const base = valueRef.current.trim();
    onChange(base ? `${base}\n\n${next}` : next);
  }

  function open(next: CaptureMode) {
    if (disabled) return;
    setMode(next);
  }

  function releaseUnused(microphone: Promise<MediaStream>) {
    void microphone.then(stream => {
      stream.getTracks().forEach(track => { try { track.stop(); } catch { /* continue */ } });
    }).catch(() => { /* The browser already closed this request. */ });
  }

  function toggleMic(microphone: Promise<MediaStream>) {
    // Stop/cancel remains usable even before permission or onstart resolves.
    if (stopRef.current) {
      stopRef.current();
      releaseUnused(microphone);
      return;
    }
    if (disabled || sessionRef.current) {
      releaseUnused(microphone);
      return;
    }
    const session = new DictationSession();
    sessionRef.current = session;
    const current = () => sessionRef.current === session && !session.cancelled && !disabledRef.current;
    const finish = (message: string) => {
      if (!current()) return;
      cancelCapture();
      setRecording(false);
      setTranscribing(false);
      setFeedback(message);
    };
    setRecording(true);
    baseRef.current = valueRef.current.trim();
    setFeedback('Requesting microphone access.');

    function recordWithGemini(stream: MediaStream) {
      if (!current()) {
        stream.getTracks().forEach(track => { try { track.stop(); } catch { /* continue */ } });
        return;
      }
      try {
        session.ownStream(stream);
        if (!current()) { session.cancel(); return; }
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream);
        session.own(() => {
          recorder.ondataavailable = null;
          recorder.onstop = null;
          recorder.onerror = null;
          if (recorder.state !== 'inactive') recorder.stop();
        });
        recorder.ondataavailable = event => {
          if (current() && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => finish('Audio recording failed. Please try again.');
        recorder.onstop = () => {
          session.release();
          if (!current()) return;
          stopRef.current = null;
          setRecording(false);
          setTranscribing(true);
          setFeedback('Transcribing speech.');
          const reader = new FileReader();
          const abort = new AbortController();
          session.own(() => abort.abort());
          session.own(() => {
            reader.onloadend = null;
            reader.onerror = null;
            reader.onabort = null;
            if (reader.readyState === FileReader.LOADING) reader.abort();
          });
          reader.onerror = () => finish('The recording could not be read.');
          reader.onabort = () => finish('Transcription cancelled.');
          reader.onloadend = () => {
            if (!current()) return;
            void (async () => {
              try {
                const audio = String(reader.result ?? '').split(',')[1] ?? '';
                if (!audio) throw new Error('The recording could not be read.');
                const response = await fetch('/api/transcribe-audio', {
                  method: 'POST',
                  signal: abort.signal,
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ audio_base64: audio, mime_type: recorder.mimeType || 'audio/webm', language: dictationLang }),
                });
                if (!response.ok) throw new Error(`Transcription returned ${response.status}.`);
                const result = (await response.json()) as { text?: string };
                if (!current()) return;
                const spoken = result.text?.trim() ?? '';
                if (spoken) {
                  appendText(spoken);
                  showPreview('Dictation', spoken);
                }
                finish(spoken ? 'Speech added to the question.' : 'No speech was detected.');
              } catch (err) {
                finish(err instanceof Error ? err.message : 'Transcription failed.');
              }
            })();
          };
          try {
            reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
          } catch { finish('The recording could not be read.'); }
        };
        stopRef.current = () => {
          // Release tracks synchronously; transcription waits for the final data event.
          stopRef.current = null;
          setRecording(false);
          setTranscribing(true);
          try { recorder.stop(); }
          catch { finish('Audio recording failed. Please try again.'); }
          finally { stream.getTracks().forEach(track => { try { track.stop(); } catch { /* continue */ } }); }
        };
        recorder.start();
        setFeedback('Listening. Press the microphone again to transcribe.');
      } catch {
        finish('Microphone access or audio recording failed. Please try again.');
      }
    }

    beginDictationTap({
      microphone,
      lang: dictationLang,
      preferWebSpeech: engine === 'webspeech',
      isActive: current,
      onArmed: stop => {
        session.own(stop);
        stopRef.current = () => finish('Microphone stopped.');
      },
      onSpeechStart: recognition => {
        if (!current()) return;
        session.own(() => {
          recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
        });
        setFeedback('Listening. Speak the question or the passage.');
      },
      onSpeechResult: event => {
        if (!current()) return;
        let spoken = '';
        for (let i = 0; i < event.results.length; i += 1) spoken += event.results[i]?.[0]?.transcript ?? '';
        const text = spoken.trim();
        if (text) onChange(baseRef.current ? `${baseRef.current} ${text}` : text);
      },
      onSpeechEnd: () => {
        const full = valueRef.current.trim();
        const base = baseRef.current.trim();
        const added = base && full.startsWith(base) ? full.slice(base.length).trim() : full;
        if (added) showPreview('Dictation', added);
        finish('Voice dictation captured.');
      },
      onNoSpeech: () => finish('No speech detected. Press the microphone to try again.'),
      onGemini: stream => recordWithGemini(stream),
      onDenied: () => finish(MICROPHONE_DENIED_MESSAGE),
      onUnavailable: message => finish(message),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/90 bg-[var(--surface-modal)] p-3 shadow-inner sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
            <span className="inline-block h-2 w-2 animate-ping rounded-full bg-emerald-400" />
            Optical Input & OCR:
          </span>
          <span className="hidden text-[11px] text-slate-400 sm:inline">Upload book photos, capture live manuscripts, or scan files</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" data-research-capture="photo" disabled={disabled} onClick={() => open('camera')} className={`${ribbonButton} border-amber-500/40 bg-amber-500/15 text-amber-300 hover:border-amber-400 hover:bg-amber-500/25`} title="Take photo of a page">
            <Camera className="h-3.5 w-3.5 text-amber-400" />
            <span>Take Photo</span>
          </button>
          <button type="button" data-research-capture="upload-photo" disabled={disabled} onClick={() => open('upload_photo')} className={`${ribbonButton} border-slate-700 bg-slate-900/90 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-white`} title="Upload a photo">
            <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
            <span>Upload Photo</span>
          </button>
          <button type="button" data-research-capture="upload-file" disabled={disabled} onClick={() => open('upload_file')} className={`${ribbonButton} border-slate-700 bg-slate-900/90 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-white`} title="Upload a document or PDF">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            <span>Upload File / PDF</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
        <span>{feedback ?? 'Speak a question, or a passage, in your own words.'}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDictationLang(current => (current === 'ar-SA' ? dictationCode(lang) : 'ar-SA'))}
            className="rounded-lg border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
          >
            {dictationLang === 'ar-SA' ? 'Dictation: Arabic' : `Dictation: ${languageLabel(lang)}`}
          </button>
          <button
            type="button"
            onClick={() => setEngine(current => (current === 'webspeech' ? 'ai_gemini' : 'webspeech'))}
            className="rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400"
          >
            {engine === 'webspeech' ? 'Web Speech' : 'Gemini AI'}
          </button>
        </div>
      </div>

      <div className="relative">
        <textarea
          id="research-question"
          data-research-question
          value={value}
          onChange={event => onChange(event.target.value)}
          rows={5}
          maxLength={4000}
          disabled={disabled}
          placeholder="What is your question, or what passage are you looking at?"
          className={`w-full rounded-2xl border bg-[var(--surface-inset)] px-4 py-3 pr-16 text-base leading-relaxed text-slate-100 placeholder:text-slate-500 ${
            recording ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-[var(--gold-border)]'
          }`}
        />
        <button
          type="button"
          data-research-capture="mic"
          onClick={() => {
            if (stopRef.current) {
              stopRef.current();
              return;
            }
            if (disabled || transcribing) return;
            // The permission prompt is tied to this tap. Do not await before this call.
            const microphone = requestMicrophoneFromTap();
            toggleMic(microphone);
          }}
          disabled={!recording && (disabled || transcribing)}
          aria-label={recording ? 'Stop dictation' : 'Start dictation'}
          title={recording ? 'Stop dictation' : 'Dictate the question'}
          className={`absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl border ${
            recording ? 'animate-pulse border-rose-500 bg-rose-600 text-white' : 'border-slate-700 bg-slate-800/90 text-slate-300 hover:border-amber-500/50 hover:text-amber-400'
          }`}
        >
          {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      </div>
      {preview && (
        <p data-testid="research-extract-preview" className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
          <span className="shrink-0 font-semibold">{preview.label}</span>
          <span className="truncate">{preview.excerpt}</span>
        </p>
      )}

      <HadithMediaUploadModal
        isOpen={mode != null}
        initialMode={mode ?? 'upload_photo'}
        onClose={() => setMode(null)}
        onApplyExtracted={(matn, isnad) => {
          const extracted = [matn, isnad].map(part => part.trim()).filter(Boolean).join('\n\n');
          if (extracted) {
            appendText(extracted);
            showPreview('Extracted text', extracted);
          }
          setMode(null);
        }}
      />
    </div>
  );
}

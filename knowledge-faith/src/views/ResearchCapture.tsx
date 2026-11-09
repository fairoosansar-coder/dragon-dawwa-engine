import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Image as ImageIcon, Loader2, Mic, MicOff, Paperclip } from 'lucide-react';
import { HadithMediaUploadModal } from '../engine/components/HadithMediaUploadModal.tsx';
import { dictationCode, languageChip, languageLabel } from '../engine/utils/contentLanguage.ts';
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
  variant = 'studio',
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  variant?: 'studio' | 'omni';
}) {
  const { lang, setLang } = useApp();
  const [mode, setMode] = useState<CaptureMode | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const attachRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    if (!attachOpen) return;
    const close = (event: PointerEvent) => {
      if (!attachRef.current?.contains(event.target as Node)) setAttachOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [attachOpen]);

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

  function pressMic() {
    if (stopRef.current) {
      stopRef.current();
      return;
    }
    if (disabled || transcribing) return;
    // The permission prompt is tied to this tap. Do not await before this call.
    const microphone = requestMicrophoneFromTap();
    toggleMic(microphone);
  }

  function chooseCapture(next: CaptureMode) {
    setAttachOpen(false);
    open(next);
  }

  const uploadModal = (
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
  );

  const [isnadOpen, setIsnadOpen] = useState(false);
  const [isnadChain, setIsnadChain] = useState('');
  const ready = value.trim().length >= 3;
  const darkSurface = variant === 'studio';

  return (
    <div
      data-omni-console={variant}
      className={`rounded-2xl border p-3.5 shadow-sm sm:p-4 ${
        darkSurface
          ? 'border-stone-800 bg-stone-900 text-stone-100'
          : 'border-stone-200 bg-white text-stone-900'
      }`}
    >
      {/* Collapsible Isnad Accordion */}
      <div className="mb-2">
        <button
          type="button"
          data-omni-isnad-toggle
          aria-expanded={isnadOpen}
          onClick={() => setIsnadOpen(open => !open)}
          className={`inline-flex items-center gap-1 text-[11px] font-semibold transition ${
            darkSurface ? 'text-amber-300 hover:text-amber-200' : 'text-emerald-800 hover:text-emerald-950'
          }`}
        >
          <span>{isnadOpen ? '− Hide narrator chain / Isnad' : '+ Add specific narrator chain / Isnad (Optional)'}</span>
        </button>
        {isnadOpen && (
          <input
            type="text"
            data-omni-isnad-input
            value={isnadChain}
            onChange={event => setIsnadChain(event.target.value)}
            onBlur={() => {
              if (isnadChain.trim() && !value.includes(isnadChain.trim())) {
                appendText(`Isnad: ${isnadChain.trim()}`);
              }
            }}
            placeholder="e.g. Qutaybah → Yahya ibn Hamza → Thawran ibn Yazid"
            className={`mt-1.5 w-full rounded-xl border px-3 py-1.5 font-mono text-xs focus:outline-none ${
              darkSurface
                ? 'border-stone-700 bg-stone-950/80 text-stone-200 placeholder:text-stone-500 focus:border-amber-500'
                : 'border-stone-200 bg-stone-50 text-stone-800 placeholder:text-stone-400 focus:border-emerald-700'
            }`}
          />
        )}
      </div>

      <label className="sr-only" htmlFor="research-question">
        Ask any question across Qur&apos;an, Hadith, Fiqh, or classical sciences
      </label>
      <textarea
        id="research-question"
        data-research-question
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={2}
        maxLength={4000}
        disabled={disabled}
        placeholder="Ask any question across Qur'an, Hadith, Fiqh, or classical sciences..."
        className={`min-h-[60px] w-full resize-none bg-transparent pb-2 pt-0.5 text-xs leading-relaxed outline-none sm:text-[13px] ${
          darkSurface
            ? 'text-stone-100 placeholder:text-stone-500'
            : 'text-stone-800 placeholder:text-stone-400'
        }`}
      />

      {/* Integrated Bottom Action Dock (Single Row) */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 ${
          darkSurface ? 'border-stone-800' : 'border-stone-100'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <div className="relative" ref={attachRef}>
            <button
              type="button"
              data-research-capture="attach"
              aria-expanded={attachOpen}
              aria-haspopup="menu"
              disabled={disabled}
              onClick={() => setAttachOpen(open => !open)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition disabled:opacity-50 ${
                darkSurface
                  ? 'border-stone-700 bg-stone-800/80 text-stone-200 hover:bg-stone-800'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Paperclip className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              <span>Attach / OCR</span>
            </button>
            {attachOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-20 mb-1.5 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 text-stone-800 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  data-research-capture="photo"
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs text-stone-700 hover:bg-stone-50"
                  onClick={() => chooseCapture('camera')}
                >
                  <Camera className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                  Take Photo
                </button>
                <button
                  type="button"
                  role="menuitem"
                  data-research-capture="upload-photo"
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs text-stone-700 hover:bg-stone-50"
                  onClick={() => chooseCapture('upload_photo')}
                >
                  <ImageIcon className="h-3.5 w-3.5 text-stone-500" aria-hidden />
                  Upload Photo
                </button>
                <button
                  type="button"
                  role="menuitem"
                  data-research-capture="upload-file"
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-xs text-stone-700 hover:bg-stone-50"
                  onClick={() => chooseCapture('upload_file')}
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                  Upload File / PDF
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            data-research-capture="mic"
            onClick={pressMic}
            disabled={!recording && (disabled || transcribing)}
            aria-label={recording ? 'Stop dictation' : 'Start dictation'}
            title={recording ? 'Stop dictation' : 'Dictate the question'}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition ${
              recording
                ? 'animate-pulse border-emerald-500 bg-emerald-600 text-white shadow-sm'
                : darkSurface
                  ? 'border-stone-700 bg-stone-800/80 text-stone-400 hover:text-stone-200'
                  : 'border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-700'
            }`}
          >
            {transcribing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : recording ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="content-language-chip"
            title="Content language used for research"
            onClick={() => setLang(lang === 'en' ? 'ta' : lang === 'ta' ? 'si' : 'en')}
            className={`h-8 rounded-xl border px-2.5 text-[11px] font-semibold tracking-wide ${
              darkSurface
                ? 'border-stone-700 bg-stone-800 text-stone-200'
                : 'border-stone-200 bg-stone-50 text-stone-700'
            }`}
          >
            {languageChip(lang)} · {languageLabel(lang)}
          </button>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsnadChain('');
            }}
            disabled={disabled || !value}
            className={`h-8 rounded-xl px-2.5 text-xs font-medium transition disabled:opacity-40 ${
              darkSurface ? 'text-stone-400 hover:text-white' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Clear
          </button>
          <button
            type="submit"
            data-testid="run-research-btn"
            disabled={disabled || !ready}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-600/30 bg-[#0A3D2E] px-4 py-2 text-xs font-semibold tracking-wide text-white shadow-md transition-all hover:bg-[#0E4D3B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden>✨</span>
            <span>{disabled ? 'Researching…' : 'Run 7-Agent Research →'}</span>
          </button>
        </div>
      </div>

      {(recording || transcribing || feedback || preview) && (
        <p
          data-testid="research-extract-preview"
          className="mt-2 text-[11px] text-stone-500"
        >
          {preview ? `${preview.label}: ${preview.excerpt}` : feedback}
        </p>
      )}
      {uploadModal}
    </div>
  );
}

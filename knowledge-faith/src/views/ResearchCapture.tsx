import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Image as ImageIcon, Loader2, Mic, MicOff } from 'lucide-react';
import { HadithMediaUploadModal } from '../engine/components/HadithMediaUploadModal.tsx';
import { dictationCode, languageLabel } from '../engine/utils/contentLanguage.ts';
import { useApp } from '../lib/store.tsx';

type CaptureMode = 'camera' | 'upload_photo' | 'upload_file';
type DictationLang = 'en-US' | 'ta-IN' | 'si-LK' | 'ar-SA';

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

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
  const [engine, setEngine] = useState<'webspeech' | 'ai_gemini'>('webspeech');
  const [dictationLang, setDictationLang] = useState<DictationLang>(dictationCode(lang));
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const baseRef = useRef('');
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setDictationLang(dictationCode(lang));
  }, [lang]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* already stopped */
      }
      if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop();
    };
  }, []);

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

  async function toggleMic() {
    if (disabled || transcribing) return;
    if (recording) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* already stopped */
      }
      if (recorderRef.current && recorderRef.current.state === 'recording') recorderRef.current.stop();
      setRecording(false);
      setFeedback('Microphone stopped.');
      window.setTimeout(() => setFeedback(null), 3000);
      return;
    }
    baseRef.current = valueRef.current.trim();
    const SpeechRecognitionCtor = (
      window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }
    ).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (SpeechRecognitionCtor && engine === 'webspeech') {
      try {
        const recognition = new SpeechRecognitionCtor();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = dictationLang;
        recognition.onstart = () => {
          setRecording(true);
          setFeedback('Listening. Speak the question or the passage.');
        };
        recognition.onresult = event => {
          let spoken = '';
          for (let i = 0; i < event.results.length; i += 1) {
            spoken += event.results[i]?.[0]?.transcript ?? '';
          }
          const current = spoken.trim();
          if (!current) return;
          const base = baseRef.current;
          onChange(base ? `${base} ${current}` : current);
        };
        recognition.onerror = event => {
          setRecording(false);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setFeedback('Microphone permission is required.');
            return;
          }
          if (event.error === 'no-speech') {
            setFeedback('No speech detected. Press the microphone to try again.');
            window.setTimeout(() => setFeedback(null), 3500);
            return;
          }
          void recordWithGemini();
        };
        recognition.onend = () => {
          setRecording(false);
          setFeedback('Voice dictation captured.');
          window.setTimeout(() => setFeedback(null), 3500);
        };
        recognition.start();
        return;
      } catch {
        await recordWithGemini();
        return;
      }
    }
    await recordWithGemini();
  }

  async function recordWithGemini() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFeedback('This browser cannot record audio.');
      window.setTimeout(() => setFeedback(null), 4000);
      return;
    }
    setFeedback('Requesting microphone access.');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setRecording(false);
      setFeedback('Microphone permission is required.');
      window.setTimeout(() => setFeedback(null), 4000);
      return;
    }
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      setRecording(false);
      setTranscribing(true);
      setFeedback('Transcribing speech.');
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        void (async () => {
          try {
            const dataUrl = String(reader.result ?? '');
            const audio = dataUrl.split(',')[1] ?? '';
            if (!audio) throw new Error('The recording could not be read.');
            const response = await fetch('/api/transcribe-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio_base64: audio, mime_type: recorder.mimeType || 'audio/webm' }),
            });
            if (!response.ok) throw new Error(`Transcription returned ${response.status}.`);
            const result = (await response.json()) as { text?: string };
            const spoken = result.text?.trim() ?? '';
            if (spoken) appendText(spoken);
            setFeedback(spoken ? 'Speech added to the question.' : 'No speech was detected.');
          } catch (err) {
            setFeedback(err instanceof Error ? err.message : 'Transcription failed.');
          } finally {
            setTranscribing(false);
            window.setTimeout(() => setFeedback(null), 4000);
          }
        })();
      };
      reader.readAsDataURL(blob);
    };
    recorder.start();
    setRecording(true);
    setFeedback('Listening. Press the microphone again to transcribe.');
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
          onClick={() => void toggleMic()}
          disabled={disabled || transcribing}
          aria-label={recording ? 'Stop dictation' : 'Start dictation'}
          title={recording ? 'Stop dictation' : 'Dictate the question'}
          className={`absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl border ${
            recording ? 'animate-pulse border-rose-500 bg-rose-600 text-white' : 'border-slate-700 bg-slate-800/90 text-slate-300 hover:border-amber-500/50 hover:text-amber-400'
          }`}
        >
          {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      </div>

      <HadithMediaUploadModal
        isOpen={mode != null}
        initialMode={mode ?? 'upload_photo'}
        onClose={() => setMode(null)}
        onApplyExtracted={(matn, isnad) => {
          const extracted = [matn, isnad].map(part => part.trim()).filter(Boolean).join('\n\n');
          if (extracted) appendText(extracted);
          setMode(null);
        }}
      />
    </div>
  );
}

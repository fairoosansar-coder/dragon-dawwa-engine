import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  Sparkles, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  Flame, 
  ArrowRight, 
  RefreshCw,
  Wand2,
  BookOpen,
  Camera,
  FileText,
  Image as ImageIcon,
  UploadCloud,
  Mic,
  MicOff,
  Loader2,
  History,
  Clock
} from 'lucide-react';
import { BenchmarkCorpusItem, FuzzyNormalizationResult } from '../types/normalization';
import { BENCHMARK_CORPUS, normalizeHadithQuery } from '../utils/fuzzyNormalizer';
import { HadithMediaUploadModal } from './HadithMediaUploadModal';
import { SupportedLanguage, TRANSLATIONS } from '../utils/localization';
import { dictationCode, languageChip, languageLabel } from '../utils/contentLanguage.ts';
import { beginDictationTap, isMicrophoneDenial, MICROPHONE_DENIED_MESSAGE, requestMicrophoneFromTap } from '../../views/microphoneTap.ts';
import {
  podcastAvailability,
  readSavedResearch,
  upsertSavedResearch,
  writeSavedResearch,
  type SavedResearchRecord,
} from '../utils/savedResearch.ts';
import type { Lang } from '../../shared/sources.ts';

export interface RecentSearchItem {
  id: string;
  matn: string;
  isnad?: string;
  timestamp: number;
  language?: SupportedLanguage;
}

interface HadithSearchFormProps {
  initialMatn?: string;
  initialIsnad?: string;
  isAnalyzing: boolean;
  analysisError: string | null;
  onRunEngine: (matn: string, isnad: string) => void;
  onOpenSaved?: (record: SavedResearchRecord) => void;
  onResearchAgain?: (record: SavedResearchRecord) => void;
  onOpenFullReport?: () => void;
  onClearInputs?: () => void;
  onSelectBenchmark?: (benchmarkId: string) => void;
  currentLanguage?: SupportedLanguage;
  activeQuestion?: string;
}

export function HadithSearchForm({
  initialMatn = "Do not fast on Saturdays except for what has been made obligatory for you...",
  initialIsnad = '',
  isAnalyzing,
  analysisError,
  onRunEngine,
  onOpenSaved,
  onResearchAgain,
  onOpenFullReport,
  onClearInputs,
  onSelectBenchmark,
  currentLanguage = 'en',
  activeQuestion = '',
}: HadithSearchFormProps) {
  const t = TRANSLATIONS[currentLanguage];
  const [hadithMatn, setHadithMatn] = useState<string>(initialMatn);
  const [isnad, setIsnad] = useState<string>(initialIsnad);
  const [isnadOpen, setIsnadOpen] = useState(Boolean(initialIsnad.trim()));
  const matnRef = useRef<HTMLTextAreaElement>(null);
  const [activeBenchmark, setActiveBenchmark] = useState<string | null>("saturday_fast");
  const [normalizationData, setNormalizationData] = useState<FuzzyNormalizationResult | null>(null);

  // Local Storage Recent Searches State
  const [recentSearches, setRecentSearches] = useState<SavedResearchRecord[]>([]);

  // Optical Media (Photo / Camera / Document) Modal State
  const [isMediaModalOpen, setIsMediaModalOpen] = useState<boolean>(false);
  const [mediaModalMode, setMediaModalMode] = useState<'camera' | 'upload_photo' | 'upload_file'>('upload_photo');

  // Microphone Voice-to-Text Speech Recognition State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [voiceSpeechMode, setVoiceSpeechMode] = useState<'webspeech' | 'ai_gemini'>('webspeech');
  const [dictationLang, setDictationLang] = useState<'en-US' | 'ta-IN' | 'si-LK' | 'ar-SA'>(dictationCode(currentLanguage));
  const [speechFeedback, setSpeechFeedback] = useState<string | null>(null);
  const [extractPreview, setExtractPreview] = useState<{ label: string; excerpt: string } | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const tapRef = useRef<{ stop: () => void } | null>(null);
  const baseMatnAtStartRef = useRef<string>('');
  const lastSpeechRef = useRef<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const handleOpenMediaModal = (mode: 'camera' | 'upload_photo' | 'upload_file') => {
    setMediaModalMode(mode);
    setIsMediaModalOpen(true);
  };

  const getLocalizedBenchmark = (item: BenchmarkCorpusItem, lang: SupportedLanguage) => {
    if (lang === 'si') {
      if (item.id === 'intentions') {
        return {
          ...item,
          title: "ක්‍රියාවන් චේතනාවන් මත රඳා පවතී (මුත්තෆකුන් අලයිහි)",
          tag: "මූලික සහීහ් (බුහාරි #1, මුස්ලිම් #1907)",
          matn: "ක්‍රියාවන් සියල්ල චේතනාවන් මත රඳා පවතී. සෑම මිනිසෙකුටම ඔහු චේතනා කළ දේ පමණක් හිමි වේ. කෙනෙකුගේ හිජ්රතය අල්ලාහ් සහ ඔහුගේ රසූල්වරයා වෙනුවෙන් වී නම්..."
        };
      }
      if (item.id === 'saturday_fast') {
        return {
          ...item,
          title: "සෙනසුරාදා උපවාස තහනම (විවාදාත්මක / ෂාද්)",
          tag: "ෆික්හ් සහ විවාදාත්මක දාම (අබූ දාවූද්, තිර්මිදි)",
          matn: "ඔබට අනිවාර්ය කරන ලද උපවාස හැර සෙනසුරාදා දිනවල උපවාසයේ නොයෙදෙන්න; ඔබගෙන් කෙනෙකුට මිදි ලෙල්ලක් හෝ ගසක අත්තක් හැර අන් කිසිවක් හමු නොවන්නේ නම්, ඔහු එය හෝ හපනු ලැබේවා."
        };
      }
      if (item.id === 'china_knowledge') {
        return {
          ...item,
          title: "චීනයට ගොස් හෝ දැනුම සොයන්න (ව්‍යාජ / ගොතන ලද්දක්)",
          tag: "ප්‍රසිද්ධ ගොතන ලද වාර්තාව (ඉබ්නුල් ජව්සී, දහබී)",
          matn: "චීනයට ගොස් හෝ දැනුම සොයන්න, මන්ද දැනුම සෙවීම සෑම මුස්ලිම්වරයෙකුටම අනිවාර්ය වේ."
        };
      }
    } else if (lang === 'ta') {
      if (item.id === 'intentions') {
        return {
          ...item,
          title: "செயல்கள் எண்ணங்களைப் பொறுத்தே (முத்தஃபகுன் அலைஹி)",
          tag: "அடிப்படை ஆதாரபூர்வ ஹதீஸ் (புகாரி #1, முஸ்லிம் #1907)",
          matn: "செயல்கள் அனைத்தும் எண்ணங்களைப் பொறுத்தே அமைகின்றன; ஒவ்வொரு மனிதனுக்கும் அவன் எண்ணியதே கிடைக்கிறது..."
        };
      }
      if (item.id === 'saturday_fast') {
        return {
          ...item,
          title: "சனிக்கிழமை நோன்பு தடை (விவாதத்திற்குரியது / ஷாத்)",
          tag: "பிக்ஹ் மற்றும் முரண்பட்ட தொடர்கள் (அபூ தாவூத், திர்மிதி)",
          matn: "கடமையாக்கப்பட்ட நோன்பைத் தவிர வேறு எதற்காகவும் சனிக்கிழமை நோன்பு நோற்காதீர்கள்; ஒரு திராட்சைத் தோல் அல்லது மரத்தின் கிளையைத் தவிர வேறெதுவும் கிடைக்காவிட்டாலும் அதனை மென்று விடவும்."
        };
      }
      if (item.id === 'china_knowledge') {
        return {
          ...item,
          title: "சீனா சென்றேனும் கல்வி கற்க (இட்டுக்கட்டப்பட்டது)",
          tag: "பிரபலமான பலவீனமான செய்தி (இப்னுல் ஜவ்ஸி, தஹபி)",
          matn: "சீனா சென்றேனும் கல்வி கற்க; ஏனெனில் கல்வி தேடுவது ஒவ்வொரு முஸ்லிமுக்கும் கடமையாகும்."
        };
      }
    }
    return item;
  };

  useEffect(() => {
    setDictationLang(dictationCode(currentLanguage));
  }, [currentLanguage]);

  // Load saved research from this device. Do not invent starter dossiers.
  useEffect(() => {
    const load = () => setRecentSearches(readSavedResearch());
    load();
    window.addEventListener('hadith_search_updated', load);
    return () => window.removeEventListener('hadith_search_updated', load);
  }, []);

  const saveSearchToLocalStorage = (matnText: string, isnadText: string, status: SavedResearchRecord['status'] = 'idle') => {
    const question = matnText.trim();
    if (!question) return;
    const language = (currentLanguage === 'ta' || currentLanguage === 'si' ? currentLanguage : 'en') as Lang;
    const updated = upsertSavedResearch(readSavedResearch(), {
      question,
      isnad: isnadText.trim(),
      language,
      status,
    });
    writeSavedResearch(updated);
    setRecentSearches(updated);
  };

  const handleRemoveRecentSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter(item => item.id !== id);
    setRecentSearches(updated);
    writeSavedResearch(updated);
  };

  const handleClearAllRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('dragon_dawwa_recent_searches');
      window.dispatchEvent(new Event('hadith_search_updated'));
    } catch (err) {
      console.warn(err);
    }
  };

  const handleSelectRecentSearch = (item: SavedResearchRecord) => {
    setHadithMatn(item.question);
    setIsnad(item.isnad || '');
    onOpenSaved?.(item);
  };

  const formatSavedDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleApplyExtractedMedia = (matn: string, extractedIsnad: string, autoRun?: boolean) => {
    setHadithMatn(matn);
    if (extractedIsnad) {
      setIsnad(extractedIsnad);
      setIsnadOpen(true);
    }
    const excerpt = [matn, extractedIsnad].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (excerpt) setExtractPreview({ label: 'Extracted text', excerpt });
    if (autoRun) {
      saveSearchToLocalStorage(matn, extractedIsnad || isnad);
      onRunEngine(matn, extractedIsnad || isnad);
    }
  };

  // Sync state if props change from outside
  useEffect(() => {
    if (initialMatn !== undefined) setHadithMatn(initialMatn);
    if (initialIsnad !== undefined) {
      setIsnad(initialIsnad);
      if (initialIsnad.trim()) setIsnadOpen(true);
    }
  }, [initialMatn, initialIsnad]);

  useEffect(() => {
    const node = matnRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.max(node.scrollHeight, 88)}px`;
  }, [hadithMatn]);

  // Reactive fuzzy intent normalization check
  useEffect(() => {
    if (!hadithMatn || hadithMatn.trim().length < 4) {
      setNormalizationData(null);
      return;
    }

    const timer = setTimeout(() => {
      const result = normalizeHadithQuery(hadithMatn);
      setNormalizationData(result);
    }, 250);

    return () => clearTimeout(timer);
  }, [hadithMatn]);

  // Handle speech transcription cleanup on unmount
  useEffect(() => {
    return () => {
      tapRef.current?.stop();
      tapRef.current = null;
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Web Speech API / AI Voice Recognition. The click calls getUserMedia before this function does anything else.
  const handleToggleVoiceInput = (microphone?: Promise<MediaStream>) => {
    if (isRecording) {
      tapRef.current?.stop();
      tapRef.current = null;
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
      setSpeechFeedback('Microphone stopped.');
      setTimeout(() => setSpeechFeedback(null), 3000);
      return;
    }

    baseMatnAtStartRef.current = hadithMatn.trim();
    lastSpeechRef.current = '';
    setIsRecording(true);
    setSpeechFeedback('Requesting microphone access...');
    const tap = beginDictationTap({
      microphone: microphone ?? requestMicrophoneFromTap(),
      lang: dictationLang,
      preferWebSpeech: voiceSpeechMode === 'webspeech',
      onArmed: stop => {
        tapRef.current = { stop };
      },
      onSpeechStart: recognition => {
        speechRecognitionRef.current = recognition;
        setIsRecording(true);
        setSpeechFeedback(
          dictationLang === 'ar-SA'
            ? '🎤 جاري الاستماع باللغة العربية... اقرأ متن الحديث أو السؤال'
            : dictationLang === 'ta-IN'
              ? '🎤 கேட்டுக்கொண்டிருக்கிறது... தமிழில் பேசுங்கள்'
              : '🎤 Listening... Speak Hadith narration or topic now',
        );
      },
      onSpeechResult: event => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          const piece = event.results[i]?.[0]?.transcript ?? '';
          if (event.results[i]?.isFinal) finalTranscript += piece;
          else interimTranscript += piece;
        }
        const currentSpeech = `${finalTranscript} ${interimTranscript}`.trim();
        if (currentSpeech) {
          lastSpeechRef.current = currentSpeech;
          const base = baseMatnAtStartRef.current;
          setHadithMatn(base ? `${base} ${currentSpeech}` : currentSpeech);
        }
      },
      onSpeechEnd: () => {
        setIsRecording(false);
        const spoken = lastSpeechRef.current.trim();
        if (spoken) setExtractPreview({ label: 'Dictation', excerpt: spoken.slice(0, 160) });
        setSpeechFeedback('Voice dictation captured!');
        setTimeout(() => setSpeechFeedback(null), 3500);
      },
      onNoSpeech: () => {
        setIsRecording(false);
        setSpeechFeedback('No speech detected. Click mic to speak again.');
        setTimeout(() => setSpeechFeedback(null), 3500);
      },
      onGemini: stream => {
        void startGeminiAudioRecorder(stream);
      },
      onDenied: () => {
        setIsRecording(false);
        setSpeechFeedback(MICROPHONE_DENIED_MESSAGE);
      },
      onUnavailable: message => {
        setIsRecording(false);
        setSpeechFeedback(message);
        setTimeout(() => setSpeechFeedback(null), 4000);
      },
    });
    tapRef.current = tap;
  };

  const startGeminiAudioRecorder = async (stream: MediaStream) => {
    try {
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setIsTranscribing(true);
        setSpeechFeedback('Transcribing speech with Gemini AI...');

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            if (!base64Data) {
              setIsTranscribing(false);
              setSpeechFeedback('Could not read audio data.');
              return;
            }

            const response = await fetch('/api/transcribe-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audio_base64: base64Data,
                mime_type: mediaRecorder.mimeType || 'audio/webm'
              })
            });

            if (!response.ok) {
              throw new Error(`Server returned ${response.status}`);
            }

            const result = await response.json();
            setIsTranscribing(false);

            if (result.text && result.text.trim().length > 0) {
              setHadithMatn(result.text.trim());
              setExtractPreview({ label: 'Dictation', excerpt: result.text.trim().slice(0, 160) });
              setSpeechFeedback('Transcribed successfully with Gemini!');
            } else {
              setSpeechFeedback('No speech detected in audio clip.');
            }
            setTimeout(() => setSpeechFeedback(null), 4000);
          };
        } catch (transcribeErr: any) {
          console.error('Audio transcription error:', transcribeErr);
          setIsTranscribing(false);
          setSpeechFeedback(`Transcription error: ${transcribeErr.message || 'Failed'}`);
          setTimeout(() => setSpeechFeedback(null), 4000);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setSpeechFeedback('Listening... Speak Hadith text (English, Arabic, or narrator name)');

      // Automatically stop after 15 seconds if user forgot to click stop
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 15000);

    } catch (micErr: any) {
      console.error('Microphone error:', micErr);
      stream.getTracks().forEach(track => { try { track.stop(); } catch { /* continue */ } });
      setIsRecording(false);
      setIsTranscribing(false);
      setSpeechFeedback(isMicrophoneDenial(micErr) ? MICROPHONE_DENIED_MESSAGE : 'Audio recording failed. Please try again.');
      setTimeout(() => setSpeechFeedback(null), 4500);
    }
  };

  // Handler to clear form inputs instantly
  const handleClearInputs = () => {
    setHadithMatn("");
    setIsnad("");
    setIsnadOpen(false);
    setActiveBenchmark(null);
    setNormalizationData(null);
    setExtractPreview(null);
    if (onClearInputs) {
      onClearInputs();
    }
  };

  // Handler to load benchmark datasets
  const handleSelectBenchmark = (item: BenchmarkCorpusItem) => {
    const loc = getLocalizedBenchmark(item, currentLanguage);
    setHadithMatn(loc.matn);
    setIsnad(loc.isnad);
    setIsnadOpen(Boolean(loc.isnad.trim()));
    setActiveBenchmark(item.id);
    saveSearchToLocalStorage(loc.matn, loc.isnad);
    if (onSelectBenchmark) {
      onSelectBenchmark(item.id);
    }
  };

  // Apply canonical normalization data to inputs
  const handleApplyCanonicalCorrection = () => {
    if (!normalizationData) return;
    setHadithMatn(normalizationData.canonical_english);
    if (normalizationData.canonical_isnad) {
      setIsnad(normalizationData.canonical_isnad);
      setIsnadOpen(true);
    }
    setActiveBenchmark(normalizationData.matched_hadith_id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hadithMatn.trim()) return;
    saveSearchToLocalStorage(hadithMatn, isnad);
    onRunEngine(hadithMatn, isnad);
  };

  return (
    <div className="space-y-6">
      {/* TOP ROW: BENCHMARK DOSSIERS / RECENT SEARCHES */}
      <div className="bg-[var(--surface-raised)] border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
            <span className="inline-block animate-pulse">⚡</span>
            Sample Hadith Benchmark Dossiers (Click to Load)
          </span>
          <span className="text-xs text-slate-400">
            Pre-indexed narrations with 7-agent verification & HadeethEnc source retrieval
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {BENCHMARK_CORPUS.map((item) => {
            const loc = getLocalizedBenchmark(item, currentLanguage);
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`benchmark-card-${item.id}`}
                onClick={() => handleSelectBenchmark(item)}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  activeBenchmark === item.id
                    ? "border-amber-500/80 bg-amber-500/15 shadow-md shadow-amber-950/40 ring-1 ring-amber-500/30"
                    : "border-slate-800 bg-[var(--surface-raised)] hover:border-slate-700 hover:bg-[var(--surface-hover)]"
                }`}
              >
                <div className="flex justify-between items-start mb-1.5 gap-2">
                  <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{loc.title}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${
                    item.scoreType === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    item.scoreType === 'warning' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {item.score}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">{loc.tag}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* HADITH DEEP SEARCH & TRANSMISSION AUDIT FORM */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[var(--surface-raised)] p-4 shadow-2xl sm:p-5">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 mb-4">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Hadith 7-Agent Research</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Retrieves HadeethEnc records (Agent 7) and feeds them into Takhrij, Isnad, Rijal, Shawahid, Scholars & Synthesis.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative z-10 space-y-3">
          <label htmlFor="hadith-matn" className="sr-only">Hadith matn</label>
          <div
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              handleOpenMediaModal('upload_photo');
            }}
          >
            <textarea
              id="hadith-matn"
              ref={matnRef}
              rows={3}
              value={hadithMatn}
              onChange={event => setHadithMatn(event.target.value)}
              placeholder={dictationLang === 'ar-SA' ? 'اكتب أو اضغط على الميكروفون للتحدث بالمتن أو ألصق نص الحديث...' : 'Type, speak, or paste the hadith matn...'}
              className={`max-h-72 min-h-[5.5rem] w-full resize-none overflow-y-auto rounded-2xl border bg-[var(--surface-inset)] p-4 text-sm leading-relaxed text-slate-100 placeholder-slate-500 focus:outline-none ${
                isRecording
                  ? 'border-rose-500 bg-rose-950/10 ring-2 ring-rose-500/30'
                  : isTranscribing
                    ? 'border-amber-500 ring-2 ring-amber-500/30'
                    : 'border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50'
              }`}
              required
            />
          </div>

          <div>
            <button
              type="button"
              aria-expanded={isnadOpen}
              aria-controls="hadith-isnad"
              onClick={() => setIsnadOpen(open => !open)}
              className="min-h-11 text-left text-xs font-semibold text-amber-300 hover:text-amber-200"
            >
              {isnadOpen ? '− Hide Isnad / Sanad' : '+ Add specific Isnad / Sanad (Optional)'}
            </button>
            {isnadOpen && (
              <input
                id="hadith-isnad"
                type="text"
                value={isnad}
                onChange={event => setIsnad(event.target.value)}
                placeholder="e.g. Qutaybah → Yahya ibn Hamza → Thawran ibn Yazid"
                className="mt-2 w-full rounded-xl border border-slate-700/80 bg-[var(--surface-inset)] px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 sm:text-sm"
              />
            )}
          </div>

          {/* FUZZY INTENT-NORMALIZATION BANNER (IF MATCH FOUND) */}
          {normalizationData && (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 shadow-xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 font-semibold text-amber-300">
                  <Wand2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Fuzzy Intent Normalized: Canonical Match Identified ({Math.round(normalizationData.fuzzy_similarity_ratio * 100)}% match)</span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyCanonicalCorrection}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/50 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Apply Canonical Text
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-amber-500/20">
                <div className="space-y-0.5">
                  <span className="text-amber-400/80 uppercase font-mono text-[10px]">Canonical Arabic:</span>
                  <p className="font-arabic text-xs text-amber-100 text-right dir-rtl leading-relaxed font-semibold">
                    {normalizationData.canonical_arabic}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-amber-400/80 uppercase font-mono text-[10px]">Canonical Source & Isnad:</span>
                  <p className="text-slate-300">
                    <span className="text-emerald-400 font-medium">{normalizationData.canonical_primary_source}</span>
                    <span className="block text-slate-400 text-[10px] font-mono truncate">{normalizationData.canonical_isnad}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <p role="status" className="text-amber-300">
              Research is running. The six-agent check often takes one to two minutes.
            </p>
          )}
          {/* ERROR / STATUS NOTIFICATION IF ANY */}
          {analysisError && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300">System Notice: </span>
                  <span>{analysisError}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => onRunEngine(hadithMatn, isnad)}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-[var(--on-gold)] font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  Retry
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-label="Take Photo"
                title="Take photo of a hadith page"
                onClick={() => handleOpenMediaModal('camera')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
              >
                <Camera className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Take Photo</span>
              </button>
              <button
                type="button"
                aria-label="Upload Photo"
                title="Upload a hadith image"
                onClick={() => handleOpenMediaModal('upload_photo')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-2.5 text-xs font-semibold text-slate-300 hover:text-white"
              >
                <ImageIcon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Upload Photo</span>
              </button>
              <button
                type="button"
                aria-label="Upload File / PDF"
                title="Upload a hadith document or PDF"
                onClick={() => handleOpenMediaModal('upload_file')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-2.5 text-xs font-semibold text-slate-300 hover:text-white"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Upload File / PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isRecording) {
                    handleToggleVoiceInput();
                    return;
                  }
                  if (isTranscribing) return;
                  const microphone = requestMicrophoneFromTap();
                  handleToggleVoiceInput(microphone);
                }}
                disabled={isTranscribing}
                aria-label="Toggle voice Hadith search"
                title={
                  isRecording
                    ? 'Click to stop listening'
                    : isTranscribing
                      ? 'Transcribing audio...'
                      : `Hands-free speech dictation via ${voiceSpeechMode === 'webspeech' ? 'Web Speech API' : 'Gemini AI Voice'} (${dictationLang === 'ar-SA' ? 'Arabic' : languageLabel(currentLanguage)})`
                }
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border ${
                  isRecording
                    ? 'border-rose-500 bg-rose-600 text-white'
                    : isTranscribing
                      ? 'cursor-wait border-amber-500/50 bg-amber-600/40 text-amber-200'
                      : 'border-slate-700 bg-slate-800/90 text-slate-300 hover:border-amber-500/50 hover:text-amber-300'
                }`}
              >
                {isTranscribing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setDictationLang(current => current === 'ar-SA' ? dictationCode(currentLanguage) : 'ar-SA')}
                className="min-h-11 rounded-lg border border-slate-700 px-2 text-[10px] font-mono text-slate-300"
                title="Dictation language follows the content language. Switch only when speaking Arabic."
              >
                {dictationLang === 'ar-SA' ? 'Arabic' : languageLabel(currentLanguage)}
              </button>
              <button
                type="button"
                onClick={() => setVoiceSpeechMode(voiceSpeechMode === 'webspeech' ? 'ai_gemini' : 'webspeech')}
                className="min-h-11 rounded-lg border border-slate-800 bg-slate-900/90 px-2 text-[10px] font-mono font-bold text-amber-400"
                title={voiceSpeechMode === 'webspeech' ? 'Web Speech API active (Click for Gemini Multimodal Audio)' : 'Gemini AI Voice active (Click for Web Speech API)'}
              >
                {voiceSpeechMode === 'webspeech' ? 'Web Speech' : 'Gemini AI'}
              </button>
              {(speechFeedback || isRecording || isTranscribing) && (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-[11px] text-slate-300">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${isRecording ? 'animate-ping bg-rose-500' : isTranscribing ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className="truncate font-mono">
                    {speechFeedback || (isRecording ? 'Listening…' : 'Transcribing…')}
                  </span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                data-testid="content-language-chip"
                className="rounded-lg border border-[#c4a46a] bg-[#f6efe2] px-2 py-1 text-[10px] font-bold tracking-wide text-[#0c3d2e]"
                title="Content language used for research, the transcript, and narration"
              >
                {languageChip(currentLanguage)} · {languageLabel(currentLanguage)}
              </span>
              <button
                type="button"
                onClick={handleClearInputs}
                className="min-h-11 rounded-xl border border-slate-700/80 bg-slate-900 px-3 text-xs font-medium text-slate-300 hover:text-white"
              >
                Clear
              </button>
              <button
                type="submit"
                data-testid="run-research-btn"
                disabled={isAnalyzing || !hadithMatn.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 px-4 text-sm font-bold text-[var(--on-gold)] shadow-xl shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Researching…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 fill-slate-950" />
                    <span>Run Research</span>
                  </>
                )}
              </button>
              {onOpenFullReport && (
                <button
                  type="button"
                  data-testid="form-open-full-report-btn"
                  onClick={onOpenFullReport}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-500/70 bg-slate-900 px-3 text-sm font-bold text-amber-300 hover:bg-amber-500/20"
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Open Full Report</span>
                </button>
              )}
            </div>
          </div>

          {extractPreview && (
            <p data-testid="hadith-extract-preview" className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
              <span className="shrink-0 font-semibold">{extractPreview.label}</span>
              <span className="truncate">{extractPreview.excerpt}</span>
            </p>
          )}
        </form>
      </div>

      {/* =========================================================================
          RECENT SEARCH QUERIES (LOCAL STORAGE PERSISTENCE & QUICK ACCESS)
          ========================================================================= */}
      <div data-testid="saved-research-library" className="rounded-2xl border border-[#c4a46a] bg-[#f6efe2] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e4d3ae] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#c4a46a] bg-[#fffaf3] text-[#0f6b4c]">
              <History className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-wide text-[#0c3d2e]">Saved research</h3>
                <span className="rounded-full border border-[#c4a46a] bg-[#fffaf3] px-2 py-0.5 text-[10px] font-semibold text-[#0c3d2e]">
                  {recentSearches.length} saved
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#3d3428]">
                Open a card to load its question, report, and podcast. Research does not run again.
              </p>
            </div>
          </div>
          {recentSearches.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllRecentSearches}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[#c4a46a] bg-[#fffaf3] px-2.5 py-1.5 text-[11px] font-medium text-[#3d3428] hover:border-[#9b2c2c] hover:text-[#9b2c2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f6b4c]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear history
            </button>
          )}
        </div>

        {recentSearches.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-7 text-center text-xs text-[#3d3428]">
            <Clock className="h-6 w-6 text-[#8a7040]" />
            <span>No saved research yet. A finished question is kept on this device.</span>
          </div>
        ) : (
          <div className="mt-3.5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recentSearches.map((item) => {
              const selected = activeQuestion.trim() === item.question.trim() && item.language === currentLanguage;
              return (
                <div key={item.id} className="relative">
                  <div
                    data-testid="saved-research-card"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('button')) return;
                      handleSelectRecentSearch(item);
                    }}
                    className={`flex h-full w-full flex-col gap-2 rounded-xl border bg-[#fffaf3] p-3.5 text-left shadow-sm transition hover:border-[#0f6b4c] hover:bg-white ${
                      selected ? 'border-[#0f6b4c] ring-2 ring-[#0f6b4c]' : 'border-[#d4bc86]'
                    }`}
                  >
                    <span className="flex items-center gap-1 text-[10px] font-medium text-[#3d3428]">
                      <Clock className="h-3 w-3" />
                      {formatSavedDate(item.savedAt || item.timestamp)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectRecentSearch(item)}
                      className="line-clamp-3 break-words text-left text-sm font-semibold leading-snug text-[#0c3d2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f6b4c]"
                    >
                      {item.question}
                    </button>
                    <span className="text-[11px] text-[#3d3428]">Content language: {languageLabel(item.language)}</span>
                    <span className="text-[11px] font-semibold text-[#0f6b4c]">{podcastAvailability(item)}</span>
                    <span className="mt-1 flex flex-wrap gap-2 border-t border-[#eadcbe] pt-2">
                      <button
                        type="button"
                        onClick={() => handleSelectRecentSearch(item)}
                        className="rounded-lg border border-[#0f6b4c] bg-[#0f6b4c] px-2.5 py-1.5 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0c3d2e]"
                      >
                        Open podcast
                      </button>
                      <button
                        type="button"
                        data-testid="saved-view-report"
                        className="rounded-lg px-2 py-1 text-[10px] font-semibold text-[#3d3428] underline decoration-[#c4a46a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f6b4c]"
                        onClick={() => {
                          handleSelectRecentSearch(item);
                          onOpenFullReport?.();
                        }}
                      >
                        View Full Report
                      </button>
                      <button
                        type="button"
                        data-testid="saved-research-again"
                        className="rounded-lg px-2 py-1 text-[10px] font-semibold text-[#3d3428] underline decoration-[#c4a46a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f6b4c]"
                        onClick={() => onResearchAgain?.(item)}
                      >
                        Run Research Again
                      </button>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => handleRemoveRecentSearch(item.id, event)}
                    className="absolute right-2 top-2 rounded p-1 text-[#3d3428] hover:text-[#9b2c2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0f6b4c]"
                    title="Remove from history"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Optical Hadith & Manuscript Scanner Modal (Live Camera / Photo Upload / Document OCR) */}
      <HadithMediaUploadModal
        isOpen={isMediaModalOpen}
        initialMode={mediaModalMode}
        onClose={() => setIsMediaModalOpen(false)}
        onApplyExtracted={handleApplyExtractedMedia}
      />
    </div>
  );
}

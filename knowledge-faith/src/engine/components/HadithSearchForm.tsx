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
    if (initialIsnad !== undefined) setIsnad(initialIsnad);
  }, [initialMatn, initialIsnad]);

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

  // Web Speech API / AI Voice Recognition
  const handleToggleVoiceInput = async () => {
    // If currently recording, stop it
    if (isRecording) {
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

    // Capture starting text to prevent duplication during continuous interim recognition
    baseMatnAtStartRef.current = hadithMatn.trim();

    // Check if Browser SpeechRecognition is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition && voiceSpeechMode === 'webspeech') {
      try {
        const recognition = new SpeechRecognition();
        speechRecognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = dictationLang; // 'en-US' or 'ar-SA'

        recognition.onstart = () => {
          setIsRecording(true);
          setSpeechFeedback(
            dictationLang === 'ar-SA'
              ? '🎤 جاري الاستماع باللغة العربية... اقرأ متن الحديث أو السؤال'
              : '🎤 Listening... Speak Hadith narration or topic now'
          );
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const currentSpeech = `${finalTranscript} ${interimTranscript}`.trim();
          if (currentSpeech) {
            lastSpeechRef.current = currentSpeech;
            const base = baseMatnAtStartRef.current;
            setHadithMatn(base ? `${base} ${currentSpeech}` : currentSpeech);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          setIsRecording(false);
          // If browser speech recognition failed or blocked, prompt AI Gemini recording fallback
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setSpeechFeedback('Microphone permission denied. Please allow microphone access in your browser.');
          } else if (event.error === 'no-speech') {
            setSpeechFeedback('No speech detected. Click mic to speak again.');
            setTimeout(() => setSpeechFeedback(null), 3500);
          } else {
            setSpeechFeedback(`Speech recognition notice: ${event.error}. Switching to AI audio fallback...`);
            startGeminiAudioRecorder();
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
          const spoken = lastSpeechRef.current.trim();
          if (spoken) setExtractPreview({ label: 'Dictation', excerpt: spoken.slice(0, 160) });
          setSpeechFeedback('Voice dictation captured!');
          setTimeout(() => setSpeechFeedback(null), 3500);
        };

        recognition.start();
        return;
      } catch (e) {
        console.warn('Web Speech API start error, fallback to audio recording:', e);
        startGeminiAudioRecorder();
        return;
      }
    }

    // Otherwise use MediaRecorder with Gemini Multimodal Audio-to-Text
    startGeminiAudioRecorder();
  };

  const startGeminiAudioRecorder = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setSpeechFeedback('Audio recording is not supported in this browser.');
        setTimeout(() => setSpeechFeedback(null), 4000);
        return;
      }

      setSpeechFeedback('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      setIsRecording(false);
      setIsTranscribing(false);
      setSpeechFeedback('Microphone permission required for voice search.');
      setTimeout(() => setSpeechFeedback(null), 4500);
    }
  };

  // Handler to clear form inputs instantly
  const handleClearInputs = () => {
    setHadithMatn("");
    setIsnad("");
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
      <div className="bg-[var(--surface-raised)] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-amber-400">🔍</span> Enter a Hadith for 7-Agent Research
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Retrieves HadeethEnc records (Agent 7) and feeds them into Takhrij, Isnad, Rijal, Shawahid, Scholars & Synthesis.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Action button to clear both inputs */}
            <button
              type="button"
              onClick={handleClearInputs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-rose-300 text-xs font-medium border border-slate-700/80 hover:border-rose-500/40 transition-all cursor-pointer shadow-sm group"
              title="Clear Hadith Matn and Transmission Chain"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-400 transition-colors" />
              <span>Clear Inputs</span>
            </button>

            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-600/30">
              7-Agent Engine + HadeethEnc
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          {/* OPTICAL MEDIA & MULTIMODAL CAPTURE RIBBON */}
          <div className="p-3 rounded-2xl bg-[var(--surface-modal)] border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Optical Input & OCR:
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Upload book photos, capture live manuscripts, or scan files
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenMediaModal('camera')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer shadow-sm group"
                title="Take photo of Hadith page or manuscript with live camera"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Take Photo</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenMediaModal('upload_photo')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 hover:border-slate-600 transition-all cursor-pointer shadow-sm group"
                title="Upload Hadith image or screenshot"
              >
                <ImageIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-300 transition-colors" />
                <span>Upload Photo</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenMediaModal('upload_file')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 hover:border-slate-600 transition-all cursor-pointer shadow-sm group"
                title="Upload Hadith document or PDF"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-300 transition-colors" />
                <span>Upload File / PDF</span>
              </button>
            </div>
          </div>

          {/* HADITH MATN / NARRATION TEXT */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-300">
              <label htmlFor="hadith-matn" className="flex items-center gap-1.5">
                <span>HADITH MATN / NARRATION TEXT</span>
                {isRecording && (
                  <span className="flex items-center gap-1 text-[10px] text-rose-400 font-mono lowercase bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    recording mic...
                  </span>
                )}
                {isTranscribing && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono lowercase bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                    <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400" />
                    ai transcribing...
                  </span>
                )}
              </label>

              <div className="flex items-center gap-2">
                <span
                  data-testid="content-language-chip"
                  className="rounded-lg border border-[#c4a46a] bg-[#f6efe2] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#0c3d2e]"
                  title="Content language used for research, the transcript, and narration"
                >
                  {languageChip(currentLanguage)} · {languageLabel(currentLanguage)}
                </span>
                <button
                  type="button"
                  onClick={() => setDictationLang(current => current === 'ar-SA' ? dictationCode(currentLanguage) : 'ar-SA')}
                  className="rounded-lg border border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-300"
                  title="Dictation language follows the content language. Switch only when speaking Arabic."
                >
                  {dictationLang === 'ar-SA' ? 'Dictation: Arabic' : `Dictation: ${languageLabel(currentLanguage)}`}
                </button>

                {/* Voice Input Engine Switch */}
                <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-800">
                  <span>Engine:</span>
                  <button
                    type="button"
                    onClick={() => setVoiceSpeechMode(voiceSpeechMode === 'webspeech' ? 'ai_gemini' : 'webspeech')}
                    className="text-amber-400 font-bold hover:underline cursor-pointer"
                    title={voiceSpeechMode === 'webspeech' ? 'Web Speech API active (Click for Gemini Multimodal Audio)' : 'Gemini AI Voice active (Click for Web Speech API)'}
                  >
                    {voiceSpeechMode === 'webspeech' ? 'Web Speech' : 'Gemini AI'}
                  </button>
                </div>

                <span className="text-[11px] font-normal text-slate-500 lowercase">
                  Question in {languageLabel(currentLanguage)}
                </span>
              </div>
            </div>

            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleOpenMediaModal('upload_photo');
              }}
              className="relative group"
            >
              <textarea
                id="hadith-matn"
                rows={3}
                value={hadithMatn}
                onChange={(e) => setHadithMatn(e.target.value)}
                placeholder={dictationLang === 'ar-SA' ? "اكتب أو اضغط على الميكروفون للتحدث بالمتن أو ألصق نص الحديث..." : "Type, click the mic to speak hands-free, or paste Hadith narration..."}
                className={`w-full bg-[var(--surface-inset)] border ${
                  isRecording 
                    ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-950/10' 
                    : isTranscribing
                    ? 'border-amber-500 ring-2 ring-amber-500/30'
                    : 'border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50'
                } rounded-2xl p-4 pr-24 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all font-sans leading-relaxed`}
                required
              />

              {/* Floating Hands-Free Microphone Action Button & Live Visualizer */}
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                {isRecording && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/60 border border-rose-800/60">
                    <span className="w-1 h-2.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleToggleVoiceInput}
                  disabled={isTranscribing}
                  className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                    isRecording
                      ? 'bg-rose-600 text-white hover:bg-rose-700 ring-4 ring-rose-500/40 animate-pulse'
                      : isTranscribing
                      ? 'bg-amber-600/50 text-amber-200 cursor-wait'
                      : 'bg-slate-800/90 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border border-slate-700 hover:border-amber-500/50'
                  }`}
                  title={
                    isRecording
                      ? 'Click to stop listening'
                      : isTranscribing
                      ? 'Transcribing audio...'
                      : `Hands-free speech dictation via ${voiceSpeechMode === 'webspeech' ? 'Web Speech API' : 'Gemini AI Voice'} (${dictationLang === 'ar-SA' ? 'Arabic' : languageLabel(currentLanguage)})`
                  }
                  aria-label="Toggle voice Hadith search"
                >
                  {isTranscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  ) : isRecording ? (
                    <MicOff className="w-4 h-4 text-white animate-bounce" />
                  ) : (
                    <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>
            </div>

            {/* Voice Feedback Banner */}
            {extractPreview && (
              <p data-testid="hadith-extract-preview" className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                <span className="shrink-0 font-semibold">{extractPreview.label}</span>
                <span className="truncate">{extractPreview.excerpt}</span>
              </p>
            )}

            {speechFeedback && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 animate-fadeIn">
                <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : isTranscribing ? 'bg-amber-400 animate-spin' : 'bg-emerald-400'}`} />
                <span className="font-mono">{speechFeedback}</span>
              </div>
            )}
          </div>

          {/* TRANSMISSION CHAIN (ISNAD / SANAD) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-300">
              <label htmlFor="hadith-isnad">TRANSMISSION CHAIN (ISNAD / SANAD) - OPTIONAL</label>
              <span className="text-[11px] font-normal text-slate-500 lowercase">
                Leave blank to auto-infer from Kutub al-Sittah
              </span>
            </div>
            <input
              id="hadith-isnad"
              type="text"
              value={isnad}
              onChange={(e) => setIsnad(e.target.value)}
              placeholder="e.g. Qutaybah -> Yahya ibn Hamza -> Thawran ibn Yazid -> Khalid ibn Ma'dan -> 'Abdullah ibn Busr..."
              className="w-full bg-[var(--surface-inset)] border border-slate-700/80 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono"
            />
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

          {/* ACTION BUTTON ROW — One clear journey: Enter a hadith -> Research -> Open Full Report */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Full 7-agent audit: Takhrij, Isnad, Rijal, Shawahid, Scholars, Synthesis & HadeethEnc Source Research.</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleClearInputs}
                className="px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-xs border border-slate-700/80 transition-colors cursor-pointer"
              >
                Clear Inputs
              </button>

              <button
                type="submit"
                data-testid="run-research-btn"
                disabled={isAnalyzing || !hadithMatn.trim()}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-[var(--on-gold)] font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[var(--on-gold)]" />
                    <span>Researching…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-slate-950" />
                    <span>Research</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {onOpenFullReport && (
                <button
                  type="button"
                  data-testid="form-open-full-report-btn"
                  onClick={onOpenFullReport}
                  className="px-5 py-3.5 rounded-xl border border-amber-500/70 bg-slate-900 hover:bg-amber-500/20 text-amber-300 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>Open Full Report</span>
                </button>
              )}
            </div>
          </div>
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

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward,
  SkipBack,
  Volume2, 
  Radio, 
  Copy, 
  Check, 
  FileText, 
  Mic, 
  Music, 
  Disc3, 
  Sparkles,
  Sliders,
  Bell,
  Activity,
  Layers,
  Download,
  Bot,
  Zap,
  Loader2,
  Share2
} from 'lucide-react';
import { audioStudio, StudioFxType } from '../utils/audioStudio';

interface PodcastScriptPlayerProps {
  script: string;
  executiveReport: string;
  onShare?: () => void;
}

export type PersonaId = 
  | 'Host' 
  | 'Dr. Tariq al-Mansoor' 
  | 'Dr. Layla al-Qasimi' 
  | 'Sheikh Imran al-Hasani' 
  | 'Dr. Zainab al-Mubarak' 
  | 'Sheikh Yusuf al-Azhari' 
  | 'Narrator';

interface DialogueItem {
  id: number;
  type: 'speech' | 'cue';
  speaker: PersonaId;
  speakerName: string;
  role: string;
  text: string;
  soundEffect: StudioFxType;
  cueDetail?: string;
  addressedTo?: string;
}

export const PodcastScriptPlayer: React.FC<PodcastScriptPlayerProps> = ({
  script,
  executiveReport,
  onShare,
}) => {
  const [activeTab, setActiveTab] = useState<'podcast' | 'report'>('podcast');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1);
  const [copied, setCopied] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [soundFxEnabled, setSoundFxEnabled] = useState<boolean>(true);
  const useGeminiVoice = true;
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [testingPersonaVoice, setTestingPersonaVoice] = useState<PersonaId | null>(null);
  const [imranVoice, setImranVoice] = useState<string>('Orus');

  const isPlayingRef = useRef<boolean>(false);
  const currentItemIndexRef = useRef<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioCacheRef = useRef<Map<number, string>>(new Map());
  const pendingFetchesRef = useRef<Map<number, Promise<string | null>>>(new Map());
  const preloadedAudioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map());

  // Allows switching Sheikh Imran's voice profile with instant cache invalidation
  const handleImranVoiceChange = (newVoice: string) => {
    setImranVoice(newVoice);
    audioCacheRef.current.clear();
    preloadedAudioElementsRef.current.clear();
    pendingFetchesRef.current.clear();
  };

  // Persona configurations matching master Python Voice Map and Gemini Prebuilt Voices
  const personasConfig: Record<PersonaId, { 
    name: string; 
    role: string; 
    geminiVoice: string;
    voiceTag: string; 
    gender: 'M' | 'F';
    color: string; 
    bg: string; 
    border: string; 
    pitch: number; 
    rate: number;
    avatar: string;
    isAnchor?: boolean;
  }> = {
    'Host': {
      name: 'Brother Feroz (Host)',
      role: 'Executive Anchor & Lead Moderator',
      geminiVoice: 'Puck',
      voiceTag: 'Gemini Puck (Deep, warm, executive)',
      gender: 'M',
      color: 'text-amber-400',
      bg: 'bg-amber-950/60',
      border: 'border-amber-500/50',
      pitch: 1.0,
      rate: 1.02,
      avatar: '🎙️',
      isAnchor: true
    },
    'Dr. Tariq al-Mansoor': {
      name: 'Dr. Tariq al-Mansoor',
      role: 'Takhrij & Source Detective (Agent 1)',
      geminiVoice: 'Fenrir',
      voiceTag: 'Gemini Fenrir (Energetic male analyst)',
      gender: 'M',
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/60',
      border: 'border-emerald-500/50',
      pitch: 0.90,
      rate: 1.0,
      avatar: 'T'
    },
    'Dr. Layla al-Qasimi': {
      name: 'Dr. Layla al-Qasimi',
      role: 'Senior Transmission Specialist (Agent 2)',
      geminiVoice: 'Kore',
      voiceTag: 'Gemini Kore (Articulate female specialist)',
      gender: 'F',
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/60',
      border: 'border-cyan-500/50',
      pitch: 1.25,
      rate: 1.0,
      avatar: 'L'
    },
    'Sheikh Imran al-Hasani': {
      name: 'Sheikh Imran al-Hasani',
      role: 'Character Judge & Rijal Critic (Agent 3)',
      geminiVoice: imranVoice,
      voiceTag: imranVoice === 'Orus' 
        ? 'Gemini Orus (Dignified classical orator)' 
        : `Gemini ${imranVoice} (Biographical Rijal Critic)`,
      gender: 'M',
      color: 'text-purple-400',
      bg: 'bg-purple-950/60',
      border: 'border-purple-500/50',
      pitch: 0.95,
      rate: 1.0,
      avatar: 'I'
    },
    'Dr. Zainab al-Mubarak': {
      name: 'Dr. Zainab al-Mubarak',
      role: 'Shawahid & Defect Scanner (Agent 4)',
      geminiVoice: 'Zephyr',
      voiceTag: 'Gemini Zephyr (Sharp female investigator)',
      gender: 'F',
      color: 'text-pink-400',
      bg: 'bg-pink-950/60',
      border: 'border-pink-500/50',
      pitch: 1.20,
      rate: 1.0,
      avatar: 'Z'
    },
    'Sheikh Yusuf al-Azhari': {
      name: 'Sheikh Yusuf al-Azhari',
      role: 'Legal Weight & Verdicts Specialist (Agent 5)',
      geminiVoice: 'Fenrir',
      voiceTag: 'Gemini Fenrir (Measured, authoritative scholar)',
      gender: 'M',
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/60',
      border: 'border-indigo-500/50',
      pitch: 0.85,
      rate: 0.95,
      avatar: 'Y'
    },
    'Narrator': {
      name: 'Prime Dragon Radio Desk',
      role: 'Studio Announcer',
      geminiVoice: 'Puck',
      voiceTag: 'Gemini Puck (Standard Studio)',
      gender: 'M',
      color: 'text-slate-300',
      bg: 'bg-slate-900',
      border: 'border-slate-700',
      pitch: 1.0,
      rate: 1.0,
      avatar: '📻'
    }
  };

  // Helper to map text lines to structured audio FX
  const detectFx = (line: string): StudioFxType => {
    const l = line.toLowerCase();
    if (l.includes('intro up') || l.includes('intro music') || l.includes('intro theme')) return 'intro_music';
    if (l.includes('bismillah') || l.includes('opening cue') || l.includes('vocal cue') || l.includes('spiritual cue')) return 'bismillah_cue';
    if (l.includes('outro music') || l.includes('outro theme')) return 'outro_music';
    if (l.includes('drum') || l.includes('thud')) return 'dramatic_drum';
    if (l.includes('chime') || l.includes('bell')) return 'soft_chime';
    if (l.includes('paper') || l.includes('pencil') || l.includes('rustle')) return 'paper_rustle';
    return 'none';
  };

  // Parse structured script lines into dialogues and audio cues
  const dialogueItems: DialogueItem[] = React.useMemo(() => {
    if (!script) return [];

    const rawBlocks = script.split('\n').filter((l) => l.trim().length > 0);
    const result: DialogueItem[] = [];

    for (let i = 0; i < rawBlocks.length; i++) {
      const line = rawBlocks[i].trim();

      // Check if line is an audio cue
      if (line.startsWith('[AUDIO CUE:') || line.startsWith('[FX:') || line.startsWith('[CUE:')) {
        const cueDetail = line.replace(/^\[(AUDIO CUE|FX|CUE):\s*/i, '').replace(/\]$/, '');
        const soundEffect = detectFx(line);
        result.push({
          id: i,
          type: 'cue',
          speaker: 'Narrator',
          speakerName: 'Sound Design & Studio FX',
          role: 'Atmosphere Engine',
          text: line,
          soundEffect,
          cueDetail
        });
        continue;
      }

      // Check personas
      const upper = line.toUpperCase();
      let detectedSpeaker: PersonaId = 'Narrator';
      let speechText = line;

      if (
        upper.startsWith('BROTHER FEROZ (HOST):') ||
        upper.startsWith('BROTHER FEROZ:') ||
        upper.startsWith('FEROZ:') ||
        upper.startsWith('ANCHOR:') ||
        upper.startsWith('HOST (BROTHER FEROZ):') ||
        upper.startsWith('HOST:') ||
        upper.startsWith('HOST (') ||
        upper.startsWith('HOST 2:') ||
        upper.startsWith('HOST 2 (')
      ) {
        detectedSpeaker = 'Host';
        speechText = line.replace(/^(BROTHER\s+FEROZ(\s*\([^)]*\))?|FEROZ|ANCHOR|HOST\s*2(\s*\([^)]*\))?|HOST(\s*\([^)]*\))?):\s*/i, '');
      } else if (
        upper.startsWith('DR. TARIQ:') ||
        upper.startsWith('DR. TARIQ AL-MANSOOR:') ||
        upper.startsWith('TARIQ:') ||
        upper.startsWith('HOST 1 (DR. TARIQ):') ||
        upper.startsWith('HOST 1:')
      ) {
        detectedSpeaker = 'Dr. Tariq al-Mansoor';
        speechText = line.replace(/^(HOST\s*1(\s*\([^)]*\))?|(DR\.\s*)?TARIQ(\s+AL-MANSOOR)?):\s*/i, '');
      } else if (
        upper.startsWith('DR. LAYLA:') ||
        upper.startsWith('DR. LAYLA AL-QASIMI:') ||
        upper.startsWith('LAYLA:')
      ) {
        detectedSpeaker = 'Dr. Layla al-Qasimi';
        speechText = line.replace(/^((DR\.\s*)?LAYLA(\s+AL-QASIMI)?):\s*/i, '');
      } else if (
        upper.startsWith('SHEIKH IMRAN:') ||
        upper.startsWith('SHEIKH IMRAN AL-HASANI:') ||
        upper.startsWith('IMRAN:')
      ) {
        detectedSpeaker = 'Sheikh Imran al-Hasani';
        speechText = line.replace(/^((SHEIKH\s*)?IMRAN(\s+AL-HASANI)?):\s*/i, '');
      } else if (
        upper.startsWith('DR. ZAINAB:') ||
        upper.startsWith('DR. ZAINAB AL-MUBARAK:') ||
        upper.startsWith('ZAINAB:')
      ) {
        detectedSpeaker = 'Dr. Zainab al-Mubarak';
        speechText = line.replace(/^((DR\.\s*)?ZAINAB(\s+AL-MUBARAK)?):\s*/i, '');
      } else if (
        upper.startsWith('SHEIKH YUSUF:') ||
        upper.startsWith('SHEIKH YUSUF AL-AZHARI:') ||
        upper.startsWith('YUSUF:')
      ) {
        detectedSpeaker = 'Sheikh Yusuf al-Azhari';
        speechText = line.replace(/^((SHEIKH\s*)?YUSUF(\s+AL-AZHARI)?):\s*/i, '');
      }

      // Detect if a specific scholar or the anchor is addressed in this speech
      let addressedTo: string | undefined = undefined;
      const lowerText = speechText.toLowerCase();
      if (detectedSpeaker !== 'Host' && (lowerText.includes('brother feroz') || lowerText.includes('feroz') || lowerText.includes('anchor'))) {
        addressedTo = 'Brother Feroz (Anchor)';
      } else if (lowerText.includes('tariq')) {
        addressedTo = 'Dr. Tariq al-Mansoor';
      } else if (lowerText.includes('layla')) {
        addressedTo = 'Dr. Layla al-Qasimi';
      } else if (lowerText.includes('imran')) {
        addressedTo = 'Sheikh Imran al-Hasani';
      } else if (lowerText.includes('zainab')) {
        addressedTo = 'Dr. Zainab al-Mubarak';
      } else if (lowerText.includes('yusuf')) {
        addressedTo = 'Sheikh Yusuf al-Azhari';
      }

      const pConfig = personasConfig[detectedSpeaker];
      result.push({
        id: i,
        type: 'speech',
        speaker: detectedSpeaker,
        speakerName: pConfig.name,
        role: pConfig.role,
        text: speechText,
        soundEffect: 'none',
        addressedTo
      });
    }

    return result;
  }, [script]);

  // Pre-fetch next Gemini TTS audio clip in the background for 0ms latency
  // Automatically pre-loads host 2 / next speaker as soon as host 1 starts speaking
  const prefetchNextGeminiVoice = async (nextIndex: number) => {
    if (!useGeminiVoice || nextIndex >= dialogueItems.length) return;
    const nextItem = dialogueItems[nextIndex];
    if (nextItem.type !== 'speech') {
      // If next is a cue, also prefetch the one right after it
      if (nextIndex + 1 < dialogueItems.length) {
        prefetchNextGeminiVoice(nextIndex + 1);
      }
      return;
    }

    if (audioCacheRef.current.has(nextIndex) || pendingFetchesRef.current.has(nextIndex)) return;

    const clean = nextItem.text.replace(/\[[^\]]+\]/g, '').trim();
    if (!clean) return;

    const targetVoice = personasConfig[nextItem.speaker]?.geminiVoice;

    const fetchPromise = (async () => {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: clean,
            speaker: nextItem.speaker,
            voiceName: targetVoice
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.audioBase64) {
            audioCacheRef.current.set(nextIndex, data.audioBase64);
            // Pre-create and buffer the HTMLAudioElement so it is 100% ready to run instantly
            const preloadedAudio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
            preloadedAudio.preload = 'auto';
            preloadedAudioElementsRef.current.set(nextIndex, preloadedAudio);
            return data.audioBase64;
          }
        }
        return null;
      } catch (err) {
        console.warn(`Background pre-fetch for speaker ${nextItem.speaker} failed:`, err);
        return null;
      } finally {
        pendingFetchesRef.current.delete(nextIndex);
      }
    })();

    pendingFetchesRef.current.set(nextIndex, fetchPromise);
  };

  // Fetch or retrieve Gemini Neural voice audio
  const getGeminiAudioForLine = async (index: number, text: string, speaker: string): Promise<string | null> => {
    if (audioCacheRef.current.has(index)) {
      return audioCacheRef.current.get(index)!;
    }

    // If already in flight via background prefetch, await the ongoing promise!
    if (pendingFetchesRef.current.has(index)) {
      const ongoing = await pendingFetchesRef.current.get(index);
      if (ongoing) return ongoing;
    }

    try {
      setIsSynthesizing(true);
      const targetVoice = personasConfig[speaker as PersonaId]?.geminiVoice;
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speaker, voiceName: targetVoice })
      });

      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.error || `Gemini voice request failed (${res.status}).`);
      }

      const data = await res.json();
      if (data.audioBase64) {
        audioCacheRef.current.set(index, data.audioBase64);
        return data.audioBase64;
      }
      return null;
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Gemini voice unavailable. Press Play to retry.');
      return null;
    } finally {
      setIsSynthesizing(false);
    }
  };

  const stopForVoiceError = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setVoiceError(previous => previous || 'Gemini audio could not play. Press Play to retry.');
  };

  // Animated Audio Visualizer Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barCount = 38;
      const barWidth = canvas.width / barCount - 2;

      for (let i = 0; i < barCount; i++) {
        let height = 4;
        if (isPlaying) {
          const factor = Math.sin(i * 0.35 + phase) * Math.cos(i * 0.15 - phase * 0.5);
          height = Math.max(4, Math.abs(factor) * 24 + (Math.random() * 8));
        }

        const x = i * (barWidth + 2);
        const y = (canvas.height - height) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(0.5, '#10b981');
        gradient.addColorStop(1, '#06b6d4');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, height);
      }

      phase += 0.12;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const sampleVoicePhrases: Record<PersonaId, string> = {
    'Host': 'Peace be upon you and welcome to Dragon Dawwa Live. I am Brother Feroz.',
    'Dr. Tariq al-Mansoor': 'Greetings, I am Dr. Tariq al-Mansoor, source detective analyzing Hadith variants.',
    'Dr. Layla al-Qasimi': 'Peace be upon you. I am Dr. Layla al-Qasimi, senior transmission chain specialist.',
    'Sheikh Imran al-Hasani': 'Greetings. I am Sheikh Imran al-Hasani, biographical critic of narrator integrity.',
    'Dr. Zainab al-Mubarak': 'Hello, I am Dr. Zainab al-Mubarak, investigating hidden textual defects.',
    'Sheikh Yusuf al-Azhari': 'Peace and blessings. I am Sheikh Yusuf al-Azhari, scholars verdicts and legal grading master.',
    'Narrator': 'Prime Dragon Radio Studio audio desk online.'
  };

  // Main playback step: Gemini Voice Model first with audio FX and seamless chain progression
  const playDialogueStep = async (index: number) => {
    // If playback has been paused or cancelled, stop immediately
    if (!isPlayingRef.current) return;

    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (index >= dialogueItems.length) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentItemIndex(-1);
      currentItemIndexRef.current = -1;
      return;
    }

    setCurrentItemIndex(index);
    currentItemIndexRef.current = index;
    const item = dialogueItems[index];

    // Scroll active line into view smoothly
    const activeEl = document.getElementById(`dialogue-item-${index}`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Handle audio cue block (Intro sting, chimes, drums, outro)
    if (item.type === 'cue') {
      // Pre-fetch the upcoming speaker line in the background while music plays
      if (index + 1 < dialogueItems.length) {
        prefetchNextGeminiVoice(index + 1);
      }

      if (soundFxEnabled && item.soundEffect !== 'none') {
        setIsSynthesizing(true);
        try {
          await audioStudio.playFx(item.soundEffect);
        } catch (fxErr) {
          console.warn('Audio FX error:', fxErr);
        } finally {
          setIsSynthesizing(false);
        }
      }

      // CRITICAL: Immediately advance to the first speech line if playback is still active!
      if (isPlayingRef.current) {
        playDialogueStep(index + 1);
      }
      return;
    }

    // Clean text of parenthetical stage directions
    const cleanSpeech = item.text.replace(/\[[^\]]+\]/g, '').trim();
    if (!cleanSpeech) {
      if (isPlayingRef.current) playDialogueStep(index + 1);
      return;
    }

    // Trigger pre-fetch of the next line (Host 2 / subsequent speaker) and lookahead line
    prefetchNextGeminiVoice(index + 1);
    if (index + 2 < dialogueItems.length) {
      prefetchNextGeminiVoice(index + 2);
    }

    const onStepEnded = () => {
      if (isPlayingRef.current) {
        playDialogueStep(index + 1);
      }
    };

    // 1. Try Gemini Multilingual Voice Model
    if (useGeminiVoice) {
      // Check if preloaded audio element is already buffered
      let audio: HTMLAudioElement | null = preloadedAudioElementsRef.current.get(index) || null;

      if (!audio) {
        const base64Audio = await getGeminiAudioForLine(index, cleanSpeech, item.speaker);
        // If user paused while fetching, abort playback
        if (!isPlayingRef.current) return;

        if (base64Audio) {
          audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
        }
      }

      if (audio) {
        currentAudioRef.current = audio;
        audio.playbackRate = speechRate;
        audio.onended = onStepEnded;
        audio.onerror = (e) => {
          console.warn('Gemini audio playback failed:', e);
          if (isPlayingRef.current) {
            stopForVoiceError();
          }
        };
        try {
          await audio.play();
          return;
        } catch (playErr) {
          console.warn('Gemini playback blocked:', playErr);
          if (isPlayingRef.current) {
            stopForVoiceError();
          }
          return;
        }
      }
    }

    // Stop visibly when Gemini is unavailable
    if (isPlayingRef.current) {
      stopForVoiceError();
    }
  };

  const handleTogglePlay = () => {
    setVoiceError(null);
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      const nextIdx = currentItemIndexRef.current >= 0 ? currentItemIndexRef.current : 0;
      playDialogueStep(nextIdx);
    }
  };

  const handlePlayFromLine = (index: number) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isPlayingRef.current = true;
    setIsPlaying(true);
    playDialogueStep(index);
  };

  const handleNextLine = () => {
    const nextIdx = currentItemIndexRef.current + 1;
    if (nextIdx < dialogueItems.length) {
      handlePlayFromLine(nextIdx);
    }
  };

  const handlePrevLine = () => {
    const prevIdx = Math.max(0, currentItemIndexRef.current - 1);
    handlePlayFromLine(prevIdx);
  };

  const handleTestPersonaVoice = async (personaId: PersonaId) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setVoiceError(null);
    setTestingPersonaVoice(personaId);
    try {
      const phrase = sampleVoicePhrases[personaId];
      const targetVoice = personasConfig[personaId]?.geminiVoice;
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: phrase, speaker: personaId, voiceName: targetVoice })
      });
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        throw new Error(problem.error || `Gemini voice failed (${res.status}).`);
      }
      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
          currentAudioRef.current = audio;
          audio.onended = () => setTestingPersonaVoice(null);
          audio.onerror = () => setTestingPersonaVoice(null);
          await audio.play();
          return;
        }
      }
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Gemini voice preview failed.');
    }
    setTestingPersonaVoice(null);
  };

  const handleReset = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentItemIndex(-1);
    currentItemIndexRef.current = -1;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Helper to highlight addressed names in radio conversation
  const renderDialogueTextWithHighlights = (text: string) => {
    const namePattern = /\b(Brother Feroz|Feroz|Dr\.\s*Tariq(\s+al-Mansoor)?|Tariq|Dr\.\s*Layla(\s+al-Qasimi)?|Layla|Sheikh\s*Imran(\s+al-Hasani)?|Imran|Dr\.\s*Zainab(\s+al-Mubarak)?|Zainab|Sheikh\s*Yusuf(\s+al-Azhari)?|Yusuf)\b/gi;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = namePattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const matchedName = match[0];
      const isAnchor = /feroz/i.test(matchedName);
      parts.push(
        <span
          key={match.index}
          className={`font-semibold px-1.5 py-0.5 rounded text-[13px] sm:text-[14px] transition-colors inline-block ${
            isAnchor
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
              : 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/40 shadow-sm'
          }`}
          title={isAnchor ? 'Addressing Anchor Brother Feroz' : `Addressing ${matchedName}`}
        >
          {matchedName}
        </span>
      );
      lastIndex = match.index + matchedName.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscript = () => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dragon-dawwa-radio-script.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTestFx = (fx: StudioFxType) => {
    audioStudio.playFx(fx);
  };

  return (
    <div className="space-y-6">
      
      {voiceError && <div role="alert" className="rounded-xl border border-amber-500 p-4 text-amber-200">{voiceError}</div>}
      {/* Radio Studio Master Control Console */}
      <div className="bg-[var(--surface-panel)] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80 relative z-10">
          
          {/* Studio Broadcast Header */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/90 border border-red-600/70 text-red-400 text-xs font-mono font-bold shadow-md shadow-red-950/50">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                LIVE BROADCAST
              </span>

              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                Prime Dragon Audio Labs • Studio A
              </span>

              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/70 px-2.5 py-1 rounded-lg border border-emerald-800/50 flex items-center gap-1.5 font-bold shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Gemini Multilingual Voice Model (3.8 Flash TTS)
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
              <Radio className="w-7 h-7 text-amber-400" />
              <span>Dragon Dawwa Live: Roundtable Studio</span>
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Multi-person studio roundtable debate with Host Brother Feroz and all 5 specialist scholarly agents examining prophetic transmission across Kutub al-Sittah.
            </p>
          </div>

          {/* Toggle between Studio Broadcast & Dossier Text */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('podcast')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'podcast'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Disc3 className={`w-4 h-4 ${isPlaying ? 'animate-spin text-amber-400' : ''}`} />
              Radio Studio Broadcast
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              Technical Dossier
            </button>
          </div>
        </div>

        {/* Studio Panelists Showcase */}
        {activeTab === 'podcast' && (
          <div className="pt-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                Gemini Voice Cast (Puck, Fenrir, Kore, Orus, Zephyr)
              </span>

              {/* Realtime Waveform Visualizer */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-mono text-slate-400">Audio Stream:</span>
                <canvas 
                  ref={canvasRef} 
                  width={140} 
                  height={20} 
                  className="rounded"
                />
              </div>
            </div>

            {/* Panelists Microphone Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {([
                'Host', 
                'Dr. Tariq al-Mansoor', 
                'Dr. Layla al-Qasimi', 
                'Sheikh Imran al-Hasani', 
                'Dr. Zainab al-Mubarak', 
                'Sheikh Yusuf al-Azhari'
              ] as PersonaId[]).map((pId) => {
                const p = personasConfig[pId];
                const isCurrentSpeaker = currentItemIndex >= 0 && dialogueItems[currentItemIndex]?.speaker === pId;
                const isTestingThisVoice = testingPersonaVoice === pId;

                return (
                  <div
                    key={pId}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                      p.isAnchor
                        ? isCurrentSpeaker
                          ? `${p.bg} border-amber-400 ring-2 ring-amber-400/80 scale-105 shadow-2xl`
                          : 'bg-gradient-to-b from-amber-950/30 to-slate-900/80 border-amber-500/40 hover:border-amber-400 shadow-md'
                        : isCurrentSpeaker
                        ? `${p.bg} ${p.border} ring-2 ring-amber-400/60 scale-105 shadow-xl`
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {p.isAnchor && (
                        <div className="mb-1">
                          <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 tracking-wider shadow-sm">
                            🎙️ Anchor
                          </span>
                        </div>
                      )}
                      <div className="w-9 h-9 rounded-full mx-auto flex items-center justify-center font-bold text-xs mb-1.5 bg-slate-950 border border-slate-700 shadow-sm">
                        <span className={p.color}>{p.avatar}</span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">{p.name.split('(')[0].trim()}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{p.role.split('(')[0].trim()}</div>
                      
                      {pId === 'Sheikh Imran al-Hasani' ? (
                        <div className="mt-1 space-y-0.5">
                          <label className="text-[9px] font-mono text-purple-300 block text-left px-0.5">
                            Voice:
                          </label>
                          <select
                            value={imranVoice}
                            onChange={(e) => handleImranVoiceChange(e.target.value)}
                            className="w-full text-[10px] font-mono font-bold bg-purple-950/90 text-amber-300 py-1 px-1 rounded-md border border-purple-500/60 hover:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer shadow-inner"
                            title="Switch Sheikh Imran al-Hasani's voice profile"
                          >
                            <option value="Orus">✨ Orus (Orator)</option>
                            <option value="Fenrir">✨ Fenrir (Jurist)</option>
                            <option value="Puck">✨ Puck (Baritone)</option>
                            <option value="Aoede">✨ Aoede (Academic)</option>
                            <option value="Charon">✨ Charon (Critic)</option>
                          </select>
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-300 font-mono font-semibold truncate mt-1 bg-slate-950/80 py-0.5 px-1.5 rounded border border-slate-800">
                          ✨ {p.geminiVoice}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTestPersonaVoice(pId)}
                      disabled={isTestingThisVoice}
                      className="mt-2.5 py-1 px-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-[10px] font-mono text-amber-300 border border-slate-800 hover:border-amber-500/50 flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title={`Preview voice of ${p.name}`}
                    >
                      {isTestingThisVoice ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                          <span>Speaking...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3 text-amber-400" />
                          <span>Hear Voice</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Master Playback & Mixing Controls Bar */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-[var(--surface-raised)] via-slate-900 to-[var(--surface-raised)] border border-slate-800/90 flex flex-wrap items-center justify-between gap-4 shadow-lg">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-[var(--on-gold)] font-extrabold text-xs flex items-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-slate-950" />
                      Pause Broadcast
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-slate-950" />
                      Start Studio Broadcast
                    </>
                  )}
                </button>

                {/* Skip to First Dialogue / Next Line */}
                <button
                  type="button"
                  onClick={handlePrevLine}
                  disabled={currentItemIndex <= 0}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition-colors border border-slate-700 cursor-pointer"
                  title="Previous Line (⏮)"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleNextLine}
                  disabled={currentItemIndex >= dialogueItems.length - 1}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition-colors border border-slate-700 cursor-pointer"
                  title="Skip to Next Line / Scholar (⏭)"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
                  title="Restart Broadcast from Beginning"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Gemini Neural Voice Toggle */}
                <button
                  type="button"
                  disabled
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                    useGeminiVoice
                      ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                  title="Gemini voice only"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Voice: Gemini</span>
                </button>

                {/* Sound FX Toggle */}
                <button
                  type="button"
                  onClick={() => setSoundFxEnabled(!soundFxEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    soundFxEnabled
                      ? 'bg-amber-950/50 border-amber-600/50 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                  title="Toggle Procedural Audio Cues"
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>Audio Cues: {soundFxEnabled ? 'ON' : 'OFF'}</span>
                </button>

                {/* Speed Toggle */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-400">
                  <span>Speed:</span>
                  <button
                    type="button"
                    onClick={() => setSpeechRate(speechRate === 1.0 ? 1.25 : speechRate === 1.25 ? 0.9 : 1.0)}
                    className="text-amber-400 font-bold hover:underline"
                  >
                    {speechRate}x
                  </button>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center gap-3">
                {isSynthesizing && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Gemini Audio Streaming...</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Script</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTranscript}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download Raw Dialogue Text"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Download .TXT</span>
                </button>

                {onShare && (
                  <button
                    type="button"
                    onClick={onShare}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-amber-500/40 hover:border-amber-400 flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/10"
                    title="Share episode and script via Web Share API"
                  >
                    <Share2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Share Episode</span>
                  </button>
                )}
              </div>
            </div>

            {/* Procedural Sound FX Soundboard Preview */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sliders className="w-3 h-3 text-amber-400" />
                Studio Soundboard FX Test:
              </span>
              <button
                type="button"
                onClick={() => handleTestFx('intro_music')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Music className="w-3.5 h-3.5 text-amber-400" /> Intro Theme
              </button>
              <button
                type="button"
                onClick={() => handleTestFx('soft_chime')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-emerald-400" /> Bell Chime
              </button>
              <button
                type="button"
                onClick={() => handleTestFx('dramatic_drum')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Disc3 className="w-3.5 h-3.5 text-rose-400" /> Sub Drum Thud
              </button>
              <button
                type="button"
                onClick={() => handleTestFx('paper_rustle')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Paper Rustle
              </button>
              <button
                type="button"
                onClick={() => handleTestFx('outro_music')}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Music className="w-3.5 h-3.5 text-purple-400" /> Outro Theme
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Broadcast Dialogue Stream */}
      {activeTab === 'podcast' ? (
        <div ref={containerRef} className="space-y-4">
          {dialogueItems.map((item, idx) => {
            const isCurrent = currentItemIndex === idx;

            // Render Audio Cue Block
            if (item.type === 'cue') {
              return (
                <div
                  id={`dialogue-item-${idx}`}
                  key={idx}
                  className={`my-3 p-3.5 rounded-2xl border text-center transition-all ${
                    isCurrent
                      ? 'bg-amber-950/70 border-amber-500/80 shadow-lg shadow-amber-950/60 scale-[1.01]'
                      : 'bg-[var(--surface-modal)]/70 border-dashed border-amber-500/25 hover:border-amber-500/40'
                  }`}
                >
                  <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-amber-300 tracking-wider uppercase">
                    <Music className={`w-3.5 h-3.5 text-amber-400 ${isCurrent ? 'animate-bounce' : ''}`} />
                    <span>{item.cueDetail || item.text}</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    {isCurrent && idx + 1 < dialogueItems.length && (
                      <button
                        type="button"
                        onClick={() => handlePlayFromLine(idx + 1)}
                        className="ml-2.5 px-2.5 py-0.5 rounded-lg bg-amber-400 text-[var(--on-gold)] font-bold text-[10px] hover:bg-amber-300 transition-all cursor-pointer shadow-md shadow-amber-400/20"
                      >
                        Skip to Speech ⏭
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Render Dialogue Block
            const pMeta = personasConfig[item.speaker];

            return (
              <div
                id={`dialogue-item-${idx}`}
                key={idx}
                className={`p-5 rounded-2xl border transition-all duration-300 ${
                  isCurrent
                    ? `${pMeta.bg} ${pMeta.border} shadow-2xl scale-[1.01] ring-2 ring-amber-400/50`
                    : 'bg-[var(--surface-panel)]/90 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Persona Avatar */}
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border shadow-md ${
                      pMeta.bg
                    } ${pMeta.border} ${pMeta.color} ${pMeta.isAnchor ? 'ring-1 ring-amber-400/50' : ''}`}
                  >
                    {pMeta.avatar}
                  </div>

                  {/* Speech Body */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-extrabold uppercase tracking-wider ${pMeta.color}`}>
                          {item.speakerName}
                        </span>

                        {pMeta.isAnchor ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm">
                            <Radio className="w-2.5 h-2.5 text-amber-400" /> Executive Anchor
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                            ({pMeta.role})
                          </span>
                        )}

                        {item.addressedTo && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900/90 text-slate-300 border border-slate-700/80 flex items-center gap-1 shadow-sm">
                            <Mic className="w-2.5 h-2.5 text-amber-400" /> Addressing: <span className="font-bold text-amber-300">{item.addressedTo}</span>
                          </span>
                        )}

                        <span className="text-[9px] text-amber-300/80 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          ✨ {pMeta.geminiVoice}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 animate-pulse font-bold shadow-md ${
                            pMeta.isAnchor 
                              ? 'bg-amber-950 text-amber-300 border-amber-500/50 shadow-amber-950/60'
                              : 'bg-red-950 text-red-300 border-red-500/40 shadow-red-950/60'
                          }`}>
                            <Volume2 className="w-3 h-3 text-amber-400" />
                            {pMeta.isAnchor ? 'ANCHOR ON AIR' : 'ON MIC'}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handlePlayFromLine(idx)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono flex items-center gap-1 border transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-amber-400 text-[var(--on-gold)] border-amber-400 font-bold shadow-md shadow-amber-400/20'
                              : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/50'
                          }`}
                          title="Play speech from this line"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>{isCurrent ? 'Playing' : 'Play Line'}</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-sans">
                      {renderDialogueTextWithHighlights(item.text)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Technical Dossier Render */
        <div className="bg-[var(--surface-panel)] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              Technical Executive Authentication Report
            </h4>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-md border border-emerald-800">
              Verified Dossier
            </span>
          </div>

          <div className="prose prose-invert max-w-none space-y-4 text-slate-300 text-sm leading-relaxed">
            {executiveReport.split('\n\n').map((paragraph, idx) => {
              if (paragraph.startsWith('# ')) {
                return (
                  <h2 key={idx} className="text-2xl font-bold text-white border-b border-slate-800 pb-2">
                    {paragraph.replace(/^#\s*/, '')}
                  </h2>
                );
              }
              if (paragraph.startsWith('## ')) {
                return (
                  <h3 key={idx} className="text-lg font-bold text-amber-300 pt-3">
                    {paragraph.replace(/^##\s*/, '')}
                  </h3>
                );
              }
              if (paragraph.startsWith('### ')) {
                return (
                  <h4 key={idx} className="text-base font-bold text-emerald-300 pt-2">
                    {paragraph.replace(/^###\s*/, '')}
                  </h4>
                );
              }
              return (
                <p key={idx} className="text-slate-200 leading-relaxed">
                  {paragraph}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

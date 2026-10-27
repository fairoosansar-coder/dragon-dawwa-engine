import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Compass,
  HelpCircle,
  Mic,
  MicOff,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  SkipForward,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react';
import type { ViewProps } from '../App.tsx';
import { ErrorNote, Loading } from '../components/ui.tsx';
import { useRemote } from '../lib/api.ts';
import { useShell } from '../lib/shell.tsx';
import { useApp } from '../lib/store.tsx';
import { LANGS, LANGUAGE_NAMES, toLang, type Lang } from '../shared/sources.ts';
import { PROGRAMME_FAMILIES, STUDIO_EPISODE_BLUEPRINTS } from '../shared/studio/catalogue.ts';
import type {
  AudioStreamKind,
  StatementKind,
  StudioEpisode,
  VoiceCapabilityReport,
} from '../shared/studio/contracts.ts';
import { buildPresenterGreeting, STUDIO_PRESENTERS } from '../shared/studio/presenter.ts';
import { EditorialProductionDesk } from '../studio/EditorialProductionDesk.tsx';
import { ListenerPreferencesDrawer } from '../studio/ListenerPreferencesDrawer.tsx';
import { SourceReaderPanel } from '../studio/SourceReaderPanel.tsx';
import { ProgrammeMedallion } from '../studio/StudioArtwork.tsx';
import { useStudioOrchestrator } from '../studio/useStudioOrchestrator.ts';

const Roundtable = lazy(() => import('../engine/Roundtable.tsx'));
const LivingPilot = lazy(() => import('./LivingPilot.tsx'));

function audioStreamBadgeLabel(kind: AudioStreamKind): string {
  switch (kind) {
    case 'quran_recitation':
      return 'Original Qur’an recitation';
    case 'meaning_audio':
      return 'Published meaning audio';
    case 'original_recording':
      return 'Original scholar recording';
    case 'presenter_narration':
      return 'Generated presenter narration';
  }
}

function statementKindLabel(kind: StatementKind): string {
  switch (kind) {
    case 'exact_quotation':
      return 'Exact quotation';
    case 'published_translation':
      return 'Published translation';
    case 'faithful_paraphrase':
      return 'Faithful paraphrase';
    case 'scholarly_interpretation':
      return 'Scholarly explanation';
    case 'presenter_reflection':
      return 'Presenter reflection';
    case 'scientific_evidence':
      return 'Scientific evidence';
  }
}

const QUICK_ASK_PROMPTS = [
  { label: 'Explain that simply.', question: 'Explain that simply.' },
  { label: 'Explain that in Tamil.', question: 'Explain that in Tamil.', targetLang: 'ta' as Lang },
  { label: 'Which hadith supports this?', question: 'Which hadith supports this?' },
  { label: 'What does this Arabic term mean?', question: 'What does this Arabic term mean?' },
  { label: 'Show the reference.', question: 'Show the reference.' },
] as const;

function DragonDawwaRadioStudio() {
  const { lang, setLang, config } = useApp();
  const { query } = useShell();
  const aiConfigured = Boolean(config?.ai);

  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('tonight-mercy-ar-rahman');
  const [customEpisode, setCustomEpisode] = useState<StudioEpisode | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<'ask' | 'explore' | 'both' | null>(null);
  const [selectedCitationId, setSelectedCitationId] = useState<string | null>(null);
  const [questionInput, setQuestionInput] = useState('');
  const [pointSavedToast, setPointSavedToast] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showEditorialDesk, setShowEditorialDesk] = useState(false);

  const remoteEpisode = useRemote<StudioEpisode>(
    customEpisode?.id === selectedEpisodeId && customEpisode.lang === lang
      ? null
      : `/api/studio/episodes/${encodeURIComponent(selectedEpisodeId)}?lang=${lang}`,
  );
  const remoteVoiceStatus = useRemote<VoiceCapabilityReport>('/api/studio/voice-status');

  const episode = useMemo(() => {
    if (customEpisode && customEpisode.id === selectedEpisodeId && customEpisode.lang === lang) {
      return customEpisode;
    }
    if (remoteEpisode.data && remoteEpisode.data.lang === lang) {
      return remoteEpisode.data;
    }
    return null;
  }, [customEpisode, lang, remoteEpisode.data, selectedEpisodeId]);

  const orchestrator = useStudioOrchestrator(episode, lang, aiConfigured);
  const {
    session,
    broadcastBadge,
    phaseLabel,
    answer,
    setAnswer,
    askBusy,
    askProgress,
    micSupported,
    timings,
    prefs,
    savedPosition,
    savedPoints,
    savedEpisodes,
    toggleListen,
    resumeProgramme,
    playSegmentAt,
    seekToSegment,
    setSpeed,
    prepareAsk,
    askQuestion,
    cancelAsk,
    speakAnswer,
    startMicrophone,
    stopMicrophone,
    saveCurrentPoint,
    toggleSaveEpisode,
    updatePreferences,
    resetPreferences,
  } = orchestrator;

  const activeFamily = useMemo(() => {
    const famId = episode?.familyId ?? 'daily-reflection';
    return PROGRAMME_FAMILIES.find(f => f.id === famId) ?? PROGRAMME_FAMILIES[0];
  }, [episode?.familyId]);

  const activeSegment = episode?.segments[session.segmentIndex] ?? episode?.segments[0] ?? null;

  const scheduleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STUDIO_EPISODE_BLUEPRINTS.filter(
      b =>
        !q ||
        b.titles[lang].toLowerCase().includes(q) ||
        b.subtitles[lang].toLowerCase().includes(q) ||
        b.summaries[lang].toLowerCase().includes(q),
    );
  }, [lang, query]);

  useEffect(() => {
    if (session.phase !== 'playing_programme') return;
    document.getElementById(`studio-seg-${session.segmentIndex}`)?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [session.phase, session.segmentIndex]);

  function handleNextProgramme() {
    const currentIndex = STUDIO_EPISODE_BLUEPRINTS.findIndex(b => b.id === selectedEpisodeId);
    const nextBlueprint = STUDIO_EPISODE_BLUEPRINTS[(currentIndex + 1) % STUDIO_EPISODE_BLUEPRINTS.length];
    if (nextBlueprint) {
      setSelectedEpisodeId(nextBlueprint.id);
      setCustomEpisode(null);
    }
  }

  function handleOpenAsk() {
    prepareAsk();
    setActiveDrawer(prev => (prev === 'explore' ? 'both' : 'ask'));
  }

  function handleOpenExplore(citationId: string | null = null) {
    setSelectedCitationId(citationId);
    setActiveDrawer(prev => (prev === 'ask' || prev === 'both' ? 'both' : 'explore'));
    window.setTimeout(() => {
      document.getElementById('studio-explore-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }

  async function handleQuickPrompt(promptText: string, targetLang?: Lang) {
    setQuestionInput(promptText);
    setActiveDrawer(prev => (prev === 'explore' ? 'both' : 'ask'));
    if (promptText === 'Show the reference.') {
      const firstCite = activeSegment?.citations[0] ?? null;
      setSelectedCitationId(firstCite);
      setActiveDrawer('both');
    }
    await askQuestion(promptText, targetLang);
  }

  async function handleSubmitQuestion(e: FormEvent) {
    e.preventDefault();
    if (!questionInput.trim()) return;
    await askQuestion(questionInput);
  }

  function handleSavePoint() {
    const pt = saveCurrentPoint();
    if (pt) {
      setPointSavedToast(`Saved point at Segment #${pt.segmentIndex + 1} (${pt.offsetSeconds.toFixed(1)}s)`);
      window.setTimeout(() => setPointSavedToast(null), 3500);
    }
  }

  const combinedReferences = useMemo(() => {
    if (!episode) return [];
    const base = [...episode.references];
    if (answer?.references) {
      for (const ref of answer.references) {
        if (!base.some(r => r.id === ref.id)) {
          base.push(ref);
        }
      }
    }
    return base;
  }, [answer?.references, episode]);

  const greeting = useMemo(() => buildPresenterGreeting(lang, prefs), [lang, prefs]);
  const isEpisodeSaved = episode ? savedEpisodes.includes(episode.id) : false;

  return (
    <div
      className="space-y-6 pb-8"
      data-studio="dragon-dawwa-studio"
      data-session-phase={session.phase}
      data-broadcast-badge={broadcastBadge}
      data-active-segment={session.segmentIndex}
    >
      {/* 1. Studio Masthead — Calm Classic Radio & Library Identity */}
      <header className="rounded-3xl border border-gold/60 bg-gradient-to-br from-[#064936] via-[#07533f] to-[#172720] p-5 text-sand shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-black/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                DRAGON DAWWA STUDIO
              </span>
              <span className="text-xs italic text-sand/85">By Aegis Intelligence</span>
              <span
                data-testid="studio-broadcast-badge"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  broadcastBadge === 'On Air'
                    ? 'bg-gold text-[#172720] shadow-xs'
                    : 'border border-sand/30 bg-white/10 text-sand'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    broadcastBadge === 'On Air' ? 'bg-[#064936]' : 'bg-gold/70'
                  }`}
                  aria-hidden="true"
                />
                {broadcastBadge}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sand/85">
              Listen to a sourced programme, follow the segment-linked transcript, pause to ask a question, and inspect every cited verse and narration inside Dragon Dawwa.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-full border border-gold/50 bg-[#07533f] px-3.5 py-1.5 text-xs font-semibold text-sand">
              <span className="text-gold">Spoken & Script Language:</span>
              <select
                aria-label="Studio content language"
                data-testid="studio-language-select"
                value={lang}
                onChange={e => setLang(toLang(e.target.value))}
                className="bg-transparent font-bold text-sand focus:outline-none"
              >
                {LANGS.map(code => (
                  <option key={code} value={code} className="bg-[#064936] text-sand">
                    {LANGUAGE_NAMES[code].english} ({LANGUAGE_NAMES[code].native})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              data-testid="toggle-preferences-btn"
              onClick={() => setShowPreferences(v => !v)}
              className="rounded-full border border-gold/40 bg-white/10 px-3 py-1.5 text-xs font-medium text-sand hover:bg-white/20"
            >
              <Settings2 className="mr-1 inline h-3.5 w-3.5 text-gold" aria-hidden="true" />
              Preferences {prefs.optIn ? '(On)' : ''}
            </button>
          </div>
        </div>
      </header>

      {showPreferences && (
        <ListenerPreferencesDrawer
          prefs={prefs}
          savedPosition={savedPosition}
          savedPoints={savedPoints}
          savedEpisodes={savedEpisodes}
          onUpdatePrefs={updatePreferences}
          onResetPrefs={resetPreferences}
          onJumpToPoint={(epId, segIdx, offSec) => {
            if (epId !== selectedEpisodeId) {
              setSelectedEpisodeId(epId);
              setCustomEpisode(null);
            }
            seekToSegment(segIdx, offSec, false);
          }}
          onSelectEpisode={epId => {
            setSelectedEpisodeId(epId);
            setCustomEpisode(null);
          }}
        />
      )}

      {remoteEpisode.loading && !episode && <Loading label="Loading programme & retrieving verified sources…" />}
      {remoteEpisode.error && !episode && <ErrorNote message={remoteEpisode.error} onRetry={remoteEpisode.reload} />}

      {/* 2. Featured Programme Console & Primary Actions (LISTEN · ASK · EXPLORE) */}
      {episode && (
        <section
          aria-label="Featured programme console"
          data-testid="featured-programme-console"
          className="rounded-3xl border border-gold/60 bg-parchment p-5 shadow-xs sm:p-7"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <ProgrammeMedallion
              familyId={episode.familyId}
              channelNumber={activeFamily.channelNumber}
              dialFrequency={activeFamily.dialFrequency}
              size="lg"
            />

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-pine px-3 py-0.5 font-semibold text-gold">
                  {episode.featuredTonight ? 'Tonight at Dragon Dawwa · Featured Programme' : activeFamily.title}
                </span>
                <span className="rounded-full border border-pine/20 bg-white px-3 py-0.5 font-medium text-pine">
                  {activeFamily.channelNumber} · {activeFamily.dialFrequency} MHz · {activeFamily.title}
                </span>
                <span
                  data-testid="session-phase-indicator"
                  className="rounded-full bg-mint px-3 py-0.5 font-semibold text-pine"
                >
                  {phaseLabel}
                </span>
              </div>

              <h1
                lang={episode.lang}
                data-testid="current-episode-title"
                className="font-display text-2xl font-bold leading-snug text-pine sm:text-3xl"
              >
                {episode.title}
              </h1>
              <p lang={episode.lang} className="text-sm font-medium text-ink/85">
                {episode.subtitle}
              </p>
              <p lang={episode.lang} className="max-w-3xl text-sm leading-relaxed text-muted">
                {episode.summary}
              </p>

              {/* Presenter Identity Card — No scholarly titles */}
              <div
                data-testid="presenter-identity-card"
                className="rounded-2xl border border-gold/50 bg-sand/90 p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-pine">
                      {episode.presenters.map(p => p.name).join(' & ')}
                    </span>
                    <span className="rounded-full bg-gold/25 px-2.5 py-0.5 text-[11px] font-semibold text-ink">
                      Generated AI Presenter · Not a human scholar or mufti
                    </span>
                  </div>
                  <span className="text-[11px] text-muted">
                    Configured voice: {STUDIO_PRESENTERS.presenter.voiceName}
                  </span>
                </div>
                <p lang={lang} className="mt-1.5 leading-relaxed text-ink/90">
                  “{greeting}”
                </p>
              </div>

              {/* PRIMARY USER ACTIONS: LISTEN · ASK · EXPLORE */}
              <div className="pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    data-testid="primary-listen-btn"
                    onClick={toggleListen}
                    className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-pine px-6 py-3 text-sm font-bold tracking-wider text-sand shadow-xs transition-colors hover:bg-moss"
                  >
                    {session.phase === 'playing_programme' ? (
                      <>
                        <Pause className="h-4 w-4 text-gold" aria-hidden="true" />
                        PAUSE
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 text-gold" aria-hidden="true" />
                        {session.offsetSeconds > 0 || session.segmentIndex > 0 ? 'LISTEN / RESUME' : 'LISTEN'}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="primary-ask-btn"
                    onClick={handleOpenAsk}
                    className={`inline-flex min-h-12 items-center gap-2.5 rounded-full border-2 px-6 py-3 text-sm font-bold tracking-wider transition-colors ${
                      activeDrawer === 'ask' || activeDrawer === 'both'
                        ? 'border-gold bg-gold text-[#172720]'
                        : 'border-pine bg-white text-pine hover:bg-mint'
                    }`}
                  >
                    <HelpCircle className="h-4 w-4" aria-hidden="true" />
                    ASK
                  </button>

                  <button
                    type="button"
                    data-testid="primary-explore-btn"
                    onClick={() => handleOpenExplore(null)}
                    aria-expanded={activeDrawer === 'explore' || activeDrawer === 'both'}
                    className={`inline-flex min-h-12 items-center gap-2.5 rounded-full border-2 px-6 py-3 text-sm font-bold tracking-wider transition-colors ${
                      activeDrawer === 'explore' || activeDrawer === 'both'
                        ? 'border-gold bg-gold text-[#172720]'
                        : 'border-pine bg-white text-pine hover:bg-mint'
                    }`}
                  >
                    <Compass className="h-4 w-4" aria-hidden="true" />
                    EXPLORE ({episode.references.length})
                  </button>

                  {(session.phase === 'ready_to_resume' ||
                    session.phase === 'paused' ||
                    (savedPosition && savedPosition.episodeId === episode.id)) && (
                    <button
                      type="button"
                      data-testid="resume-saved-position-btn"
                      onClick={() => {
                        if (
                          savedPosition &&
                          savedPosition.episodeId === episode.id &&
                          session.phase === 'idle'
                        ) {
                          seekToSegment(savedPosition.segmentIndex, savedPosition.offsetSeconds, false);
                        } else {
                          resumeProgramme();
                        }
                      }}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold bg-sand px-4 py-2 text-xs font-semibold text-pine hover:bg-gold/20"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      {session.phase === 'idle' && savedPosition?.episodeId === episode.id
                        ? `Return to saved position (Seg #${savedPosition.segmentIndex + 1})`
                        : `Continue programme (Seg #${(session.resumePoint?.segmentIndex ?? session.segmentIndex) + 1})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Scrubber, Seek, Speed & Save Controls */}
              {activeSegment && (
                <div className="mt-4 rounded-2xl border border-pine/15 bg-white p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-pine">
                        Segment {session.segmentIndex + 1} of {episode.segments.length}:
                      </span>{' '}
                      <span className="text-ink">{activeSegment.sectionLabel}</span>
                      <span className="ml-2 rounded-full bg-mint px-2 py-0.5 text-[11px] font-medium text-pine">
                        {audioStreamBadgeLabel(activeSegment.audioKind)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1 text-xs text-muted">
                        <span>Speed</span>
                        <select
                          aria-label="Playback speed"
                          data-testid="playback-speed-select"
                          value={String(session.playbackSpeed)}
                          onChange={e => setSpeed(Number(e.target.value))}
                          className="rounded-lg border border-pine/20 bg-sand px-2 py-1 text-xs font-semibold text-pine"
                        >
                          <option value="0.85">0.85x</option>
                          <option value="1">1.0x</option>
                          <option value="1.15">1.15x</option>
                          <option value="1.25">1.25x</option>
                        </select>
                      </label>

                      <button
                        type="button"
                        data-testid="save-point-btn"
                        onClick={handleSavePoint}
                        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-pine/20 bg-sand px-3 py-1 text-xs font-semibold text-pine hover:border-gold"
                      >
                        <Bookmark className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                        Save this point
                      </button>

                      <button
                        type="button"
                        data-testid="save-episode-btn"
                        aria-pressed={isEpisodeSaved}
                        onClick={() => toggleSaveEpisode(episode.id)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-pine/20 bg-sand px-3 py-1 text-xs font-semibold text-pine hover:border-gold"
                      >
                        {isEpisodeSaved ? (
                          <>
                            <BookmarkCheck className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                            Saved Episode
                          </>
                        ) : (
                          <>
                            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                            Save Episode
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        data-testid="next-programme-btn"
                        onClick={handleNextProgramme}
                        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-pine/20 bg-white px-3 py-1 text-xs font-semibold text-pine hover:bg-mint"
                      >
                        <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                        Next programme
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <span className="w-12 text-right font-mono text-[11px] text-muted">
                      Seg {session.segmentIndex + 1}/{episode.segments.length}
                    </span>
                    <input
                      type="range"
                      aria-label="Seek programme segment"
                      data-testid="segment-seek-slider"
                      min={0}
                      max={Math.max(0, episode.segments.length - 1)}
                      value={session.segmentIndex}
                      onChange={e => seekToSegment(Number(e.target.value), 0, false)}
                      className="h-2 flex-1 cursor-pointer accent-[#064936]"
                    />
                    <span className="w-16 font-mono text-[11px] text-muted">
                      {session.offsetSeconds.toFixed(1)}s / {activeSegment.durationSeconds}s
                    </span>
                  </div>
                </div>
              )}

              {pointSavedToast && (
                <p
                  role="status"
                  data-testid="saved-point-toast"
                  className="rounded-xl bg-mint px-3.5 py-2 text-xs font-semibold text-pine"
                >
                  {pointSavedToast}
                </p>
              )}

              {!aiConfigured && remoteVoiceStatus.data && (
                <div
                  role="status"
                  data-testid="voice-blocker-notice"
                  className="rounded-2xl border border-gold/60 bg-white/90 px-4 py-3 text-xs leading-relaxed text-ink"
                >
                  <p className="font-semibold text-pine">
                    <Volume2 className="mr-1.5 inline h-4 w-4 text-gold" aria-hidden="true" />
                    {remoteVoiceStatus.data.userMessage}
                  </p>
                  <details className="mt-2 border-t border-pine/10 pt-2 text-[11px] text-muted">
                    <summary
                      data-testid="voice-diagnostics-summary"
                      className="cursor-pointer font-semibold text-pine"
                    >
                      Technical diagnostics (configuration, recorded test evidence & live status)
                    </summary>
                    <div className="mt-2 space-y-1.5 font-mono">
                      <p>
                        Configuration: provider={remoteVoiceStatus.data.configuration.provider} · models=
                        {remoteVoiceStatus.data.configuration.configuredTtsModels.join(',')}
                      </p>
                      <p>
                        Live capability: presenterNarration={remoteVoiceStatus.data.liveCapability.presenterNarration} · probedUpstream=
                        {String(remoteVoiceStatus.data.liveCapability.probedUpstream)}
                      </p>
                      <p>
                        Diagnostics: GEMINI_API_KEY={remoteVoiceStatus.data.diagnostics.envVars.GEMINI_API_KEY} · /api/voice/narrate=HTTP{' '}
                        {remoteVoiceStatus.data.diagnostics.endpoints['/api/voice/narrate'].httpStatus} (
                        {remoteVoiceStatus.data.diagnostics.endpoints['/api/voice/narrate'].detail})
                      </p>
                      <p className="font-sans text-ink/70">
                        Recorded test note ({remoteVoiceStatus.data.recordedTestEvidence.recordedOn}):{' '}
                        {remoteVoiceStatus.data.recordedTestEvidence.note}
                      </p>
                    </div>
                  </details>
                </div>
              )}

              {session.errorMessage && (
                <div
                  role="alert"
                  data-testid="session-error-banner"
                  className="rounded-2xl border border-amber-700/40 bg-amber-50/90 px-4 py-3 text-xs text-amber-950"
                >
                  {session.errorMessage}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3. Interactive "Ask While Listening" Panel */}
      {episode && (activeDrawer === 'ask' || activeDrawer === 'both') && (
        <section
          aria-label="Ask about this programme"
          data-testid="studio-ask-panel"
          className="rounded-3xl border-2 border-gold bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-pine/10 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pine">
                Interactive Studio Companion · Programme Paused at Seg #{(session.resumePoint?.segmentIndex ?? session.segmentIndex) + 1}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-pine">
                Ask About This Segment or Programme
              </h2>
              {activeSegment && (
                <p className="mt-1 text-xs text-muted">
                  Active context: <span className="font-medium text-ink">{activeSegment.sectionLabel}</span> · Citations:{' '}
                  {activeSegment.citations.map(c => `[${c}]`).join(', ') || 'None'}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="ask-continue-programme-btn"
                onClick={resumeProgramme}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-pine px-4 py-1.5 text-xs font-bold text-sand hover:bg-moss"
              >
                <Play className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                Continue the programme
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawer(prev => (prev === 'both' ? 'explore' : null))}
                className="min-h-10 rounded-full border border-pine/20 px-3 py-1.5 text-xs font-semibold text-pine"
              >
                Close Ask
              </button>
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold text-pine">Quick questions while listening:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ASK_PROMPTS.map(item => (
                <button
                  key={item.label}
                  type="button"
                  disabled={askBusy}
                  data-testid={`quick-ask-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  onClick={() => void handleQuickPrompt(item.question, 'targetLang' in item ? item.targetLang : undefined)}
                  className="min-h-9 rounded-full border border-pine/25 bg-sand px-3.5 py-1.5 text-xs font-semibold text-pine hover:border-gold hover:bg-gold/20 disabled:opacity-50"
                >
                  “{item.label}”
                </button>
              ))}
              <button
                type="button"
                onClick={handleSavePoint}
                className="min-h-9 rounded-full border border-pine/25 bg-sand px-3.5 py-1.5 text-xs font-semibold text-pine hover:border-gold"
              >
                “Save this point.”
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmitQuestion} className="mt-4 flex flex-wrap gap-2">
            <label htmlFor="studio-question-input" className="sr-only">
              Ask a question about this programme
            </label>
            <input
              id="studio-question-input"
              data-testid="studio-question-input"
              type="text"
              value={questionInput}
              maxLength={500}
              onChange={e => setQuestionInput(e.target.value)}
              placeholder="Ask about the current verse, hadith grade, Arabic term, or topic…"
              className="min-h-11 min-w-0 flex-1 rounded-2xl border border-pine/25 bg-sand/40 px-4 text-sm text-ink"
            />
            {micSupported && (
              <button
                type="button"
                data-testid="studio-mic-btn"
                onClick={() =>
                  session.phase === 'listening_to_user'
                    ? stopMicrophone()
                    : startMicrophone(transcript => setQuestionInput(transcript))
                }
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold ${
                  session.phase === 'listening_to_user'
                    ? 'border-red-700 bg-red-50 text-red-900'
                    : 'border-pine/25 bg-white text-pine'
                }`}
              >
                {session.phase === 'listening_to_user' ? (
                  <>
                    <MicOff className="h-4 w-4" aria-hidden="true" />
                    Stop Mic (Listening…)
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" aria-hidden="true" />
                    Speak
                  </>
                )}
              </button>
            )}
            <button
              type="submit"
              data-testid="studio-submit-question-btn"
              disabled={askBusy || !questionInput.trim()}
              className="min-h-11 rounded-full bg-pine px-5 text-sm font-bold text-sand hover:bg-moss disabled:opacity-50"
            >
              {askBusy ? 'Researching…' : 'Ask Studio'}
            </button>
            {askBusy && (
              <button
                type="button"
                data-testid="studio-cancel-ask-btn"
                onClick={cancelAsk}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-red-800/30 bg-red-50 px-4 text-xs font-semibold text-red-900"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Cancel
              </button>
            )}
          </form>

          {askBusy && askProgress && (
            <div
              role="status"
              data-testid="studio-ask-progress"
              className="mt-3 flex items-center justify-between rounded-2xl bg-mint/60 px-4 py-2.5 text-xs font-medium text-pine"
            >
              <span>{askProgress}</span>
              <span className="font-mono text-[11px]">Searching verified sources…</span>
            </div>
          )}

          {answer && (
            <div
              data-testid="studio-ask-answer"
              data-kind={answer.kind}
              className="mt-4 space-y-3 rounded-2xl border border-gold/60 bg-sand/70 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-pine px-2.5 py-0.5 text-[11px] font-bold text-sand">
                    {answer.originBadge}
                  </span>
                  <span className="rounded-full border border-pine/25 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-pine">
                    Live answer · Not reviewed
                  </span>
                  <span className="text-xs text-muted">{answer.note}</span>
                </div>

                {aiConfigured && answer.paragraphs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void speakAnswer(answer)}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-pine px-3 py-1 text-xs font-semibold text-sand"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    Speak Answer
                  </button>
                )}
              </div>

              {answer.arabicTermExplanation && (
                <div className="rounded-xl border border-gold/50 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-pine">{answer.arabicTermExplanation.term}</p>
                    {answer.arabicTermExplanation.readerRoute && (
                      <a
                        href={answer.arabicTermExplanation.readerRoute}
                        data-testid="open-name-detail-link"
                        className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-pine hover:bg-pine hover:text-sand"
                      >
                        Open Name Detail in Dragon Dawwa
                      </a>
                    )}
                  </div>
                  <p lang="ar" dir="rtl" className="arabic mt-1 text-2xl text-ink">
                    {answer.arabicTermExplanation.arabic}
                  </p>
                </div>
              )}

              {answer.researchJob && answer.researchJob.subquestions.length > 0 && (
                <div
                  data-testid="studio-research-job-summary"
                  className="rounded-xl border border-pine/15 bg-white/80 p-3 text-xs text-muted"
                >
                  <p className="font-semibold text-pine">
                    Shared Research Engine (v{answer.contractVersion}) · {answer.researchJob.timingsMs.totalMs} ms
                  </p>
                  <p className="mt-1">
                    Queries run:{' '}
                    <span className="font-mono text-ink">
                      {answer.researchJob.subquestions.flatMap(sq => sq.queries).join(', ') || 'none'}
                    </span>
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {answer.paragraphs.map((para, i) => (
                  <div key={i} className="rounded-xl bg-white p-3.5">
                    <p
                      lang={answer.lang}
                      className="whitespace-pre-wrap text-sm leading-relaxed text-ink sm:text-base"
                    >
                      {para.text}
                    </p>
                    {para.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-muted">Evidence:</span>
                        {para.citations.map(cid => (
                          <button
                            key={cid}
                            type="button"
                            data-testid={`answer-citation-chip-${cid}`}
                            onClick={() => handleOpenExplore(cid)}
                            className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-pine hover:bg-pine hover:text-sand"
                          >
                            [{cid}] Open in Reader
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {answer.kind === 'limitation' && answer.relatedReferences.length > 0 && (
                <div className="rounded-xl border border-pine/15 bg-white p-3 text-xs">
                  <p className="font-semibold text-pine">
                    Relevant Sourced Material Available in This Programme:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {answer.relatedReferences.map(sr => (
                      <button
                        key={sr.id}
                        type="button"
                        onClick={() => handleOpenExplore(sr.id)}
                        className="rounded-full border border-pine/25 bg-sand px-3 py-1 font-semibold text-pine hover:bg-mint"
                      >
                        [{sr.id}] {sr.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-pine/10 pt-3">
                <button
                  type="button"
                  data-testid="answer-resume-programme-btn"
                  onClick={resumeProgramme}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-pine px-5 py-2 text-xs font-bold text-sand hover:bg-moss"
                >
                  <Play className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                  Continue the programme from Seg #{(session.resumePoint?.segmentIndex ?? session.segmentIndex) + 1}
                </button>
                <button
                  type="button"
                  onClick={() => setAnswer(null)}
                  className="text-xs font-medium text-muted underline"
                >
                  Clear answer
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. In-App Source & Evidence Reader (`EXPLORE`) */}
      <div id="studio-explore-anchor">
        {episode && (activeDrawer === 'explore' || activeDrawer === 'both') && (
          <SourceReaderPanel
            references={combinedReferences}
            selectedId={selectedCitationId}
            onSelectId={setSelectedCitationId}
            gaps={episode.gaps}
            disagreements={episode.disagreements}
            onClose={() => setActiveDrawer(prev => (prev === 'both' ? 'ask' : null))}
          />
        )}
      </div>

      {/* 5. Main Studio Columns: Synchronized Segment Transcript (Left) + Up Next Schedule & Sources (Right) */}
      {episode && (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <section
            aria-label="Synchronized programme transcript"
            data-testid="studio-transcript-section"
            className="space-y-4 rounded-3xl border border-pine/15 bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pine/10 pb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pine">
                  Synchronized Segment Transcript
                </p>
                <h2 className="mt-0.5 font-display text-xl font-bold text-pine">
                  Programme Script & Citation Links ({episode.segments.length} Segments)
                </h2>
              </div>
              <span className="text-xs text-muted">
                Click any citation chip to inspect the source
              </span>
            </div>

            <ol className="space-y-3">
              {episode.segments.map((seg, idx) => {
                const isActive = session.segmentIndex === idx;
                return (
                  <li
                    key={seg.id}
                    id={`studio-seg-${idx}`}
                    data-testid={`transcript-segment-${idx}`}
                    data-active={isActive ? 'true' : undefined}
                    className={`rounded-2xl border p-4 transition-colors ${
                      isActive
                        ? 'border-gold bg-sand/90 ring-2 ring-gold/40'
                        : 'border-pine/10 bg-sand/30 hover:border-pine/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-pine px-2.5 py-0.5 font-bold text-sand">
                          #{idx + 1} · {seg.sectionLabel}
                        </span>
                        <span className="rounded-full border border-pine/20 bg-white px-2.5 py-0.5 font-semibold text-pine">
                          {seg.speakerName}
                        </span>
                        <span className="rounded-full bg-mint px-2.5 py-0.5 text-[11px] font-medium text-pine">
                          {audioStreamBadgeLabel(seg.audioKind)}
                        </span>
                        <span className="rounded-full border border-gold/50 bg-white px-2.5 py-0.5 text-[11px] text-ink/80">
                          {statementKindLabel(seg.statementKind)} · {seg.originBadge}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid={`play-segment-btn-${idx}`}
                          onClick={() => void playSegmentAt(idx, 0, false)}
                          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-pine px-3 py-1 text-xs font-semibold text-sand hover:bg-moss"
                        >
                          <Play className="h-3 w-3 text-gold" aria-hidden="true" />
                          Listen
                        </button>
                        <button
                          type="button"
                          data-testid={`ask-segment-btn-${idx}`}
                          onClick={() => {
                            seekToSegment(idx, 0, false);
                            handleOpenAsk();
                          }}
                          className="inline-flex min-h-8 items-center gap-1 rounded-full border border-pine/25 bg-white px-3 py-1 text-xs font-semibold text-pine hover:bg-mint"
                        >
                          Ask
                        </button>
                      </div>
                    </div>

                    {seg.arabicText && (
                      <p
                        lang="ar"
                        dir="rtl"
                        className="arabic mt-3 rounded-xl bg-white/80 p-3 text-2xl leading-loose text-ink"
                      >
                        {seg.arabicText}
                      </p>
                    )}

                    <p
                      lang={seg.sourceLanguage}
                      className="mt-2.5 whitespace-pre-wrap text-base leading-relaxed text-ink"
                    >
                      {seg.text}
                    </p>

                    {seg.citations.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-pine/10 pt-2.5">
                        <span className="text-[11px] font-semibold text-muted">Citations:</span>
                        {seg.citations.map(cid => (
                          <button
                            key={cid}
                            type="button"
                            data-testid={`segment-${idx}-citation-${cid}`}
                            onClick={() => handleOpenExplore(cid)}
                            className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-pine hover:bg-pine hover:text-sand"
                          >
                            <BookOpen className="h-3 w-3" aria-hidden="true" />
                            [{cid}]
                          </button>
                        ))}
                        {seg.translationEdition && (
                          <span className="ml-auto text-[11px] text-muted">
                            {seg.translationEdition}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Right Column: Up Next Schedule & Episode Sources */}
          <aside className="space-y-6" aria-label="Programme schedule and sources">
            <section
              data-testid="studio-schedule-panel"
              className="rounded-3xl border border-pine/15 bg-white p-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pine">
                Editorial Schedule · Up Next
              </p>
              <h2 className="mt-0.5 font-display text-xl font-bold text-pine">
                Sourced Programmes
              </h2>
              <p className="mt-1 text-xs text-muted">
                Recorded & on-demand programmes hydrated from live QuranEnc, HadeethEnc, and IslamHouse passages.
              </p>

              <ul className="mt-4 space-y-2.5">
                {scheduleItems.map(item => {
                  const fam = PROGRAMME_FAMILIES.find(f => f.id === item.familyId);
                  const isCurrent = item.id === episode.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        data-testid={`schedule-episode-${item.id}`}
                        onClick={() => {
                          setSelectedEpisodeId(item.id);
                          setCustomEpisode(null);
                        }}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${
                          isCurrent
                            ? 'border-gold bg-parchment ring-1 ring-gold'
                            : 'border-pine/10 bg-sand/40 hover:border-pine/30 hover:bg-sand'
                        }`}
                      >
                        <ProgrammeMedallion
                          familyId={item.familyId}
                          channelNumber={fam?.channelNumber ?? 'CH'}
                          dialFrequency={fam?.dialFrequency ?? '88.1'}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-pine">
                            <span>{fam?.title}</span>
                            <span>·</span>
                            <span className="text-muted">{item.broadcastLabel}</span>
                            {isCurrent && (
                              <span className="rounded-full bg-pine px-2 py-0.5 text-[10px] text-gold">
                                Active
                              </span>
                            )}
                          </div>
                          <p lang={lang} className="mt-1 line-clamp-2 font-display text-sm font-bold text-ink">
                            {item.titles[lang]}
                          </p>
                          <p className="mt-1 text-[11px] text-muted">
                            {item.brief.durationMinutes} min · {item.format.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Reusable Programme Families in preparation */}
              <details className="mt-4 rounded-2xl border border-pine/10 bg-sand/50 px-3.5 py-2.5 text-xs">
                <summary className="cursor-pointer font-semibold text-pine">
                  All 7 Programme Families (Reusable Studio System)
                </summary>
                <ul className="mt-2 space-y-1.5 text-ink/85">
                  {PROGRAMME_FAMILIES.map(f => (
                    <li key={f.id} className="flex items-center justify-between gap-2 py-0.5">
                      <span>
                        <span className="font-mono text-[11px] text-pine">{f.channelNumber}</span> · {f.title}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-muted">
                        {f.status === 'active_release_slice' ? 'Active slice' : 'In preparation'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </section>

            {/* Compact Source List Card */}
            <section className="rounded-3xl border border-pine/15 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-pine">
                  Episode Evidence ({episode.references.length})
                </h2>
                <button
                  type="button"
                  onClick={() => handleOpenExplore(null)}
                  className="text-xs font-semibold text-pine underline"
                >
                  Open full reader
                </button>
              </div>
              <ul className="mt-3 space-y-2 text-xs">
                {episode.references.map(ref => (
                  <li key={ref.id}>
                    <button
                      type="button"
                      data-testid={`sidebar-source-${ref.id}`}
                      onClick={() => handleOpenExplore(ref.id)}
                      className="flex w-full items-start justify-between gap-2 rounded-xl border border-pine/10 bg-sand/50 p-2.5 text-left hover:border-gold"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-pine">[{ref.id}]</span>{' '}
                        <span className="font-medium text-ink">{ref.title}</span>
                        <p className="mt-0.5 truncate text-muted">{ref.locator}</p>
                      </div>
                      {ref.grade && (
                        <span className="shrink-0 rounded-full bg-gold/25 px-2 py-0.5 text-[10px] font-semibold text-ink">
                          {ref.grade}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {(timings.lastProgrammeStartMs !== null ||
              timings.lastQuestionResearchMs !== null ||
              timings.lastResumePlaybackMs !== null ||
              timings.lastGeneratedAudioMs !== null) && (
              <section
                data-testid="studio-measured-timings"
                className="rounded-2xl border border-pine/15 bg-sand/60 p-4 text-xs text-muted"
              >
                <p className="font-semibold uppercase tracking-wider text-pine">
                  Session Telemetry
                </p>
                <ul className="mt-1.5 space-y-1 font-mono text-[11px]">
                  {timings.lastProgrammeStartMs !== null && (
                    <li>Start programme: {timings.lastProgrammeStartMs} ms</li>
                  )}
                  {timings.lastQuestionResearchMs !== null && (
                    <li>Research question: {timings.lastQuestionResearchMs} ms</li>
                  )}
                  {timings.lastGeneratedAudioMs !== null && (
                    <li>First generated audio: {timings.lastGeneratedAudioMs} ms</li>
                  )}
                  {timings.lastResumePlaybackMs !== null && (
                    <li>Resume playback: {timings.lastResumePlaybackMs} ms</li>
                  )}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}

      {/* 6. Expandable Editorial & Script Production Studio */}
      {episode && (
        <details
          open={showEditorialDesk}
          onToggle={e => setShowEditorialDesk((e.currentTarget as HTMLDetailsElement).open)}
          className="group rounded-3xl border border-pine/15 bg-parchment/60 p-4"
        >
          <summary
            data-testid="editorial-desk-summary"
            className="flex min-h-11 cursor-pointer list-none items-center justify-between font-display text-lg font-bold text-pine [&::-webkit-details-marker]:hidden"
          >
            <span>Editorial Studio & Script Production Pipeline (Draft · Verify · Review · Publish)</span>
            <span className="rounded-full bg-pine px-3 py-1 font-sans text-xs font-semibold text-sand">
              {showEditorialDesk ? 'Hide Desk' : 'Open Desk'}
            </span>
          </summary>
          <div className="mt-4">
            <EditorialProductionDesk
              episode={episode}
              lang={lang}
              onEpisodeUpdated={updated => {
                setCustomEpisode(updated);
                setSelectedEpisodeId(updated.id);
              }}
            />
          </div>
        </details>
      )}
    </div>
  );
}

export default function PodcastStudio({ sub }: ViewProps) {
  const { t } = useApp();
  if (sub === 'pilot') {
    return (
      <Suspense fallback={<Loading />}>
        <LivingPilot />
      </Suspense>
    );
  }
  if (sub === 'roundtable') {
    return (
      <>
        <p className="mb-4 text-sm text-ink/70">{t.roundtableHint}</p>
        <Suspense fallback={<Loading />}>
          <Roundtable />
        </Suspense>
      </>
    );
  }
  return <DragonDawwaRadioStudio />;
}

import { useEffect, useRef, useState } from 'react';
import {productWordmark} from '../../lib/productBrand.ts';
import {
  Award,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Headphones,
  Layers,
  Mic,
  MoreHorizontal,
  Pause,
  Play,
  Radio,
  Scale,
  ScrollText,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { setAudioPlaybackRate } from '../../lib/audio.ts';
import { splitTextIntoSpeechLines, useLineByLineTts } from '../../lib/lineByLineTts.ts';
import { useApp, useStored } from '../../lib/store.tsx';
import { profileFontClass, wallFontClass } from '../../lib/typography.ts';
import { publishFaithWallPost } from '../../lib/verseShare.ts';
import { AudioLoadingSpinner, loadingAudioLabel } from '../AudioLoadingSpinner.tsx';
import {
  HADITH_PLAYBACK_SPEEDS,
  HADITH_VOICE_PROFILES,
  resolveHadithVoiceProfile,
  type HadithPlaybackSpeed,
  type HadithVoiceProfileId,
} from '../../shared/hadithVoices.ts';
import {
  isSourcesOnlyOrUnavailable,
  reportOriginLabel,
  type SevenAgentResearchDossier,
  type SpecialistAgentFinding,
} from '../../shared/sevenAgentTypes.ts';
import { LANGUAGE_NAMES, type Lang } from '../../shared/sources.ts';

function agentVisualSpec(agentId: SpecialistAgentFinding['agentId']) {
  switch (agentId) {
    case 'quran_tafsir':
      return {
        Icon: BookOpen,
        accentHex: '#B45309',
        badgeBg: '#FEF3C7',
        badgeText: '#78350F',
        badgeBorder: '#F59E0B',
        iconBg: '#78350F',
        iconText: '#FDE68A',
      };
    case 'hadith_sunnah':
      return {
        Icon: ScrollText,
        accentHex: '#0F5132',
        badgeBg: '#D1FAE5',
        badgeText: '#064E3B',
        badgeBorder: '#10B981',
        iconBg: '#073C30',
        iconText: '#F9E7B9',
      };
    case 'isnad_rijal':
      return {
        Icon: ShieldCheck,
        accentHex: '#1E3A8A',
        badgeBg: '#DBEAFE',
        badgeText: '#1E3A8A',
        badgeBorder: '#60A5FA',
        iconBg: '#1E3A8A',
        iconText: '#EFF6FF',
      };
    case 'fiqh_consensus':
      return {
        Icon: Scale,
        accentHex: '#92400E',
        badgeBg: '#FFEDD5',
        badgeText: '#7C2D12',
        badgeBorder: '#F97316',
        iconBg: '#7C2D12',
        iconText: '#FFEDD5',
      };
    case 'linguistic_maqasid':
      return {
        Icon: Layers,
        accentHex: '#6B21A8',
        badgeBg: '#F3E8FF',
        badgeText: '#581C87',
        badgeBorder: '#C084FC',
        iconBg: '#581C87',
        iconText: '#F3E8FF',
      };
    case 'modern_science':
      return {
        Icon: FlaskConical,
        accentHex: '#0F766E',
        badgeBg: '#CCFBF1',
        badgeText: '#134E4A',
        badgeBorder: '#14B8A6',
        iconBg: '#115E59',
        iconText: '#CCFBF1',
      };
    case 'executive_synthesis':
      return {
        Icon: Award,
        accentHex: '#073C30',
        badgeBg: '#FEF3C7',
        badgeText: '#78350F',
        badgeBorder: '#D4AF37',
        iconBg: '#073C30',
        iconText: '#D4AF37',
      };
  }
}

const PILLAR_ACCENTS = [
  {
    stripeHex: '#C89D54',
    badgeBg: '#78350F',
    badgeText: '#FEF3C7',
    domainColor: '#78350F',
    boxBg: '#FFFBEB',
    boxBorder: '#F59E0B',
    boxTitle: '#92400E',
    boxText: '#451A03',
  },
  {
    stripeHex: '#0F5132',
    badgeBg: '#064E3B',
    badgeText: '#ECFDF5',
    domainColor: '#064E3B',
    boxBg: '#ECFDF5',
    boxBorder: '#10B981',
    boxTitle: '#065F46',
    boxText: '#064E3B',
  },
  {
    stripeHex: '#1E4E5F',
    badgeBg: '#1E3A8A',
    badgeText: '#EFF6FF',
    domainColor: '#1E3A8A',
    boxBg: '#F0F9FF',
    boxBorder: '#38BDF8',
    boxTitle: '#075985',
    boxText: '#0C4A6E',
  },
] as const;

export function SevenAgentResearchBoard({
  dossier,
  lang,
  roundtableOpen = false,
  onToggleRoundtable,
  /** When true (e.g. Saved Library already expanded), show full 7-agent detail without a second Expand gate. */
  initialDetailExpanded = false,
}: {
  dossier: SevenAgentResearchDossier;
  lang: Lang;
  roundtableOpen?: boolean;
  onToggleRoundtable?: (open: boolean) => void;
  initialDetailExpanded?: boolean;
}) {
  const { isDossierSaved, toggleDossier, lang: uiLang, t } = useApp();
  const [internalRoundtableOpen, setInternalRoundtableOpen] = useState(roundtableOpen);
  // Progressive disclosure: Studio defaults to verdict; Saved Library can open detail immediately.
  const [detailExpanded, setDetailExpanded] = useState(
    Boolean(initialDetailExpanded || roundtableOpen),
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [voiceProfile, setVoiceProfile] = useStored<HadithVoiceProfileId>(
    'kf-hadith-voice-profile',
    'tariq',
  );
  const [speed, setSpeed] = useStored<HadithPlaybackSpeed>('kf-hadith-voice-speed', 1);
  const [wallToast, setWallToast] = useState<string | null>(null);

  const closeMorePanel = (restoreFocus = false) => {
    setMoreOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => moreTriggerRef.current?.focus(), 0);
    }
  };

  useEffect(() => {
    setInternalRoundtableOpen(roundtableOpen);
    if (roundtableOpen) setDetailExpanded(true);
  }, [roundtableOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) closeMorePanel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMorePanel(true);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const isRoundtableVisible = onToggleRoundtable ? roundtableOpen : internalRoundtableOpen;
  const setRoundtableVisible = (next: boolean) => {
    setInternalRoundtableOpen(next);
    onToggleRoundtable?.(next);
    if (next) {
      setDetailExpanded(true);
      window.setTimeout(() => {
        // scroll-mt on the studio clears the sticky top header (h-14 / z-40).
        document
          .getElementById('seven-agent-roundtable-studio')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  };

  const sessionPrefix = `7agent:${dossier.id}:`;
  const roundtableSessionId = `${sessionPrefix}roundtable`;
  const scienceSessionId = `${sessionPrefix}science`;
  const lineTts = useLineByLineTts(sessionPrefix);
  const profile = resolveHadithVoiceProfile(voiceProfile);
  // Chrome labels always follow the active UI language — never hardcode (English).
  const labelLang: Lang = uiLang || lang;
  const langLabel = LANGUAGE_NAMES[labelLang]?.native ?? 'English';
  const listenLabel = t.listen;

  const playLines = (
    sessionId: string,
    lines: string[],
    lineSpeakers?: Array<string | null | undefined>,
  ) => {
    if (!lines.length) return;
    if (lineTts.sessionId === sessionId && lineTts.status === 'playing') {
      lineTts.pause();
      return;
    }
    if (lineTts.sessionId === sessionId && lineTts.status === 'paused') {
      void lineTts.jumpToLine(Math.max(0, lineTts.currentIndex));
      return;
    }
    setAudioPlaybackRate(speed);
    void lineTts.start({
      sessionId,
      lines,
      lineSpeakers,
      lang,
      voiceProfile: profile.id,
      speed,
    });
  };

  const handlePlayAgent = (agent: SpecialistAgentFinding) => {
    const sid = `${sessionPrefix}agent-${agent.agentNumber}`;
    const lines = splitTextIntoSpeechLines(
      [agent.title, agent.summary, ...agent.keyPoints].join('. '),
    );
    // One speaker for every line of this agent card → distinct Gemini voice.
    playLines(
      sid,
      lines,
      lines.map(() => agent.personaName),
    );
  };

  const verdictSessionId = `${sessionPrefix}verdict`;

  const handlePlayVerdict = () => {
    const lines = splitTextIntoSpeechLines(
      [dossier.verdictHeadline, dossier.executiveSummary].join('. '),
    );
    playLines(
      verdictSessionId,
      lines,
      lines.map(() => 'Sheikh Yusuf al-Azhari'),
    );
  };

  const handlePlayScienceSpotlight = () => {
    const sci = dossier.scienceForesight;
    // Line-by-line: split long summary / pillars so TTS never truncates a paragraph.
    const lines = splitTextIntoSpeechLines(
      [
        sci.headline,
        sci.summary,
        ...sci.empiricalPillars.map(
          p => `${p.domain}: ${p.finding} ${p.oneStepAheadNote}`,
        ),
      ].join('\n\n'),
    );
    // Science spotlight is Zainab's foresight lane.
    playLines(
      scienceSessionId,
      lines,
      lines.map(() => 'Dr. Zainab al-Mubarak'),
    );
  };

  const handlePlayRoundtable = (startTurnIdx = 0) => {
    // Speak turn text only (no "Speaker:" prefix); voice comes from lineSpeakers.
    // Controller expands long turns into sequential same-speaker chunks and maps
    // currentSourceIndex → original turn for highlight / click-to-play.
    const lines = dossier.roundtableTurns.map(t => t.text);
    const lineSpeakers = dossier.roundtableTurns.map(t => t.speaker);
    if (!lines.some(t => t.trim())) return;
    if (
      startTurnIdx === 0 &&
      lineTts.sessionId === roundtableSessionId &&
      lineTts.status === 'playing'
    ) {
      lineTts.pause();
      return;
    }
    setAudioPlaybackRate(speed);
    void lineTts.start({
      sessionId: roundtableSessionId,
      lines,
      lineSpeakers,
      startIndex: startTurnIdx,
      lang,
      voiceProfile: profile.id,
      speed,
    });
  };

  const handleShareToFaithWall = async () => {
    const hadithAgent = dossier.agents.find(a => a.agentId === 'hadith_sunnah');
    await publishFaithWallPost({
      type: 'podcast',
      podcastId: dossier.id,
      podcastTitle: dossier.verdictHeadline.slice(0, 140),
      podcastDuration: '06:15',
      podcastCitations: [
        ...(hadithAgent?.citations ?? []),
        '🔬 1 Step Ahead of Modern Science',
      ].slice(0, 4),
      verse: {
        surah: 59,
        ayah: 7,
        surahName: '7-Agent Research & Science Studio',
        arabic:
          hadithAgent?.arabicQuote ||
          'وَمَآ ءَاتَىٰكُمُ ٱلرَّسُولُ فَخُذُوهُ وَمَا نَهَىٰكُمْ عَنْهُ فَٱنتَهُوا۟',
        translation: dossier.executiveSummary,
      },
      lang,
      url: `#/hub`,
      reflection: `${dossier.verdictHeadline} — ${dossier.scienceForesight.headline}`,
      theme: 'emerald',
    });
    setWallToast('Published 7-Agent Research & Roundtable to the Community Faith Wall!');
    window.setTimeout(() => setWallToast(null), 4000);
  };

  const isRoundtablePlaying = lineTts.isPlayingSession(roundtableSessionId);
  const isRoundtableLoading = lineTts.isLoadingSession(roundtableSessionId);
  const isSciencePlaying = lineTts.isPlayingSession(scienceSessionId);
  const isScienceLoading = lineTts.isLoadingSession(scienceSessionId);
  const isVerdictPlaying = lineTts.isPlayingSession(verdictSessionId);
  const isVerdictLoading = lineTts.isLoadingSession(verdictSessionId);
  const loadingText = loadingAudioLabel(labelLang);
  const savedInLibrary = isDossierSaved(dossier.id) || isDossierSaved(dossier.question);
  // Chrome copy follows active UI language (labelLang), never dossier content lang.
  const saveButtonLabel = savedInLibrary
    ? labelLang === 'ta'
      ? 'நூலகத்தில் சேமிக்கப்பட்டது ✓'
      : labelLang === 'si'
        ? 'පුස්තකාලයේ සුරකින ලදී ✓'
        : 'Saved in Library ✓'
    : labelLang === 'ta'
      ? 'ஆய்வை சேமி'
      : labelLang === 'si'
        ? 'පර්යේෂණය සුරකින්න'
        : 'Save Research to Library';
  const expandDetailLabel = detailExpanded
    ? labelLang === 'ta'
      ? 'விவரத்தை மறை'
      : labelLang === 'si'
        ? 'විස්තර සඟවන්න'
        : 'Hide full detail'
    : labelLang === 'ta'
      ? 'முழு 7-முகவர் விவரத்தை விரிவாக்கு →'
      : labelLang === 'si'
        ? 'සම්පූර්ණ නියෝජිත 7 විස්තරය විහිදුවන්න →'
        : 'Expand for full 7-agent detail →';
  const roundtableLabel = isRoundtableLoading
    ? loadingText
    : isRoundtablePlaying
      ? labelLang === 'ta'
        ? 'வட்டமேசையை இடைநிறுத்து'
        : labelLang === 'si'
          ? 'වටමේසය විරාම කරන්න'
          : 'Pause Roundtable'
      : labelLang === 'ta'
        ? 'வட்டமேசை'
        : labelLang === 'si'
          ? 'වටමේසය'
          : 'Open Roundtable';
  const moreLabel = labelLang === 'ta' ? 'மேலும்' : labelLang === 'si' ? 'තවත්' : 'More';
  const shareLabel =
    labelLang === 'ta'
      ? 'Faith Wall-இல் பகிர்'
      : labelLang === 'si'
        ? 'Faith Wall වෙත බෙදාගන්න'
        : 'Share to Faith Wall';
  const viewSavedLabel =
    labelLang === 'ta'
      ? 'சேமித்தவற்றில் காண்க →'
      : labelLang === 'si'
        ? 'සුරැකි ලැයිස්තුව බලන්න →'
        : 'View in Saved →';
  const listenVerdictLabel = isVerdictLoading
    ? loadingText
    : isVerdictPlaying
      ? t.pause
      : listenLabel;

  return (
    <div data-testid="seven-agent-research-board" className={`${profileFontClass(lang)} space-y-6`}>
      {/* 1. Light & Prestigious Executive Verdict Card */}
      <section
        data-testid="seven-agent-executive-banner"
        style={{ backgroundColor: '#FFFFFF', color: '#1C1917', borderColor: '#E2D5B5' }}
        className="relative overflow-visible rounded-3xl border bg-white p-5 text-stone-900 shadow-sm sm:p-7"
      >
        {/* Top Gilded Accent Bar — clip here so the More menu is not trapped by section overflow */}
        <div
          aria-hidden
          style={{
            background: 'linear-gradient(90deg, #073C30 0%, #C89D54 50%, #073C30 100%)',
          }}
          className="pointer-events-none absolute inset-x-0 top-0 h-1.5 overflow-hidden rounded-t-[1.4rem]"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wider"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              <span>
                {isSourcesOnlyOrUnavailable(dossier)
                  ? (dossier.retrievedPassages?.length ?? 0) > 0
                    ? 'Sources Found · Executive Verdict Unavailable'
                    : 'Executive Verdict Unavailable'
                  : 'Executive Verdict'}
              </span>
            </span>
            {isSourcesOnlyOrUnavailable(dossier) || dossier.confidenceScore == null ? (
              <span
                data-testid="seven-agent-sources-only-banner"
                style={{ backgroundColor: '#FEF3C7', color: '#78350F', borderColor: '#F59E0B' }}
                className="rounded-full border px-3 py-1 text-xs font-extrabold"
              >
                {dossier.verdictClassification}
              </span>
            ) : (
              <span
                style={{ backgroundColor: '#FEF3C7', color: '#78350F', borderColor: '#F59E0B' }}
                className="rounded-full border px-3 py-1 font-mono text-xs font-extrabold"
              >
                {dossier.confidenceScore}% · {dossier.verdictClassification}
              </span>
            )}
            <span
              data-testid="seven-agent-report-origin-badge"
              style={{ backgroundColor: '#F8F5EE', color: '#57534E', borderColor: '#E7E0D2' }}
              className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              title="Report origin"
            >
              {reportOriginLabel(dossier.reportOrigin)}
            </span>
          </div>

          <span
            style={{ backgroundColor: '#F5EFE2', color: '#073C30' }}
            className="rounded-full border border-[#D4AF37]/40 px-3 py-0.5 text-xs font-bold"
          >
            {langLabel}
          </span>
        </div>

        <h2
          lang={lang}
          style={{ color: '#0F2922' }}
          className={`${wallFontClass(lang, dossier.verdictHeadline)} mt-3.5 text-xl font-extrabold leading-snug sm:text-2xl`}
        >
          {dossier.verdictHeadline}
        </h2>

        <p
          lang={lang}
          style={{ color: '#3F3A32' }}
          className="mt-2.5 max-w-4xl text-sm leading-relaxed sm:text-base"
        >
          {dossier.executiveSummary}
        </p>

        {/* Compact secondary actions — Listen / Roundtable visible; Save / Share / voice in More */}
        <div
          data-testid="board-secondary-actions"
          style={{ borderColor: '#EDE6D6' }}
          className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4"
        >
          <button
            type="button"
            data-testid="board-listen-verdict-btn"
            onClick={handlePlayVerdict}
            style={{
              backgroundColor: isVerdictPlaying || isVerdictLoading ? '#FEF3C7' : '#FFFFFF',
              color: '#073C30',
              borderColor: '#D6C8A9',
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:bg-stone-50 cursor-pointer"
          >
            {isVerdictLoading ? (
              <AudioLoadingSpinner size={14} className="text-[#B45309]" />
            ) : isVerdictPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current text-[#B45309]" aria-hidden />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-[#B45309]" aria-hidden />
            )}
            <span>{listenVerdictLabel}</span>
          </button>

          <button
            type="button"
            data-testid="board-open-roundtable-btn"
            onClick={() => {
              setRoundtableVisible(true);
              handlePlayRoundtable(0);
            }}
            style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm transition hover:opacity-95 cursor-pointer"
          >
            {isRoundtableLoading ? (
              <AudioLoadingSpinner size={14} className="text-[#D4AF37]" />
            ) : (
              <Radio className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            )}
            <span>{roundtableLabel}</span>
          </button>

          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              ref={moreTriggerRef}
              data-testid="board-more-actions-btn"
              id="board-more-actions-btn"
              aria-expanded={moreOpen}
              aria-controls="board-more-panel"
              onClick={() => setMoreOpen(open => !open)}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#073C30',
                borderColor: '#D6C8A9',
              }}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition hover:bg-stone-50 cursor-pointer"
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
              <span>{moreLabel}</span>
            </button>
            {moreOpen && (
              <div
                id="board-more-panel"
                data-testid="board-more-menu"
                aria-labelledby="board-more-actions-btn"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2D5B5',
                  color: '#1C1917',
                }}
                className="absolute right-0 z-30 mt-1.5 w-56 rounded-xl border p-2 shadow-md"
              >
                <button
                  type="button"
                  data-testid="save-seven-agent-report-btn"
                  aria-pressed={savedInLibrary}
                  onClick={() => {
                    toggleDossier(dossier);
                    closeMorePanel(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#073C30] hover:bg-stone-50 cursor-pointer"
                >
                  {savedInLibrary ? (
                    <BookmarkCheck className="h-3.5 w-3.5 text-[#B45309]" aria-hidden />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span>{saveButtonLabel}</span>
                </button>
                {savedInLibrary && (
                  <a
                    href="#/saved"
                    data-testid="view-in-saved-link"
                    onClick={() => closeMorePanel()}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#073C30] underline hover:bg-stone-50"
                  >
                    {viewSavedLabel}
                  </a>
                )}
                <button
                  type="button"
                  data-testid="board-share-wall-btn"
                  onClick={() => {
                    void handleShareToFaithWall();
                    closeMorePanel(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#073C30] hover:bg-stone-50 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#B45309]" aria-hidden />
                  <span>{shareLabel}</span>
                </button>
                <button
                  type="button"
                  data-testid="board-listen-science-btn"
                  onClick={() => {
                    setDetailExpanded(true);
                    handlePlayScienceSpotlight();
                    closeMorePanel(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#073C30] hover:bg-stone-50 cursor-pointer"
                >
                  <FlaskConical className="h-3.5 w-3.5 text-[#B45309]" aria-hidden />
                  <span>
                    {isSciencePlaying
                      ? `${t.pause} · Science`
                      : `${listenLabel} · Science`}
                  </span>
                </button>
                <div
                  style={{ borderColor: '#EDE6D6' }}
                  className="mt-1 border-t pt-2"
                >
                  <label className="block px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    Voice · Speed
                  </label>
                  <select
                    aria-label="Select voice profile"
                    value={profile.id}
                    onChange={e => setVoiceProfile(e.target.value as HadithVoiceProfileId)}
                    style={{
                      backgroundColor: '#FAF7F0',
                      color: '#1C1917',
                      borderColor: '#D6C8A9',
                    }}
                    className="mx-2 mb-2 w-[calc(100%-1rem)] rounded-lg border px-2 py-1 text-xs font-semibold outline-none"
                  >
                    {HADITH_VOICE_PROFILES.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <div className="mx-2 flex flex-wrap gap-1 pb-1">
                    {HADITH_PLAYBACK_SPEEDS.map(rate => {
                      const active = speed === rate;
                      return (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => {
                            setSpeed(rate);
                            setAudioPlaybackRate(rate);
                          }}
                          style={{
                            backgroundColor: active ? '#073C30' : '#FAF7F0',
                            color: active ? '#F9E7B9' : '#3F3A32',
                            borderColor: '#D6C8A9',
                          }}
                          className="rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold cursor-pointer"
                        >
                          {rate}x
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            data-testid="board-expand-detail-btn"
            aria-expanded={detailExpanded}
            onClick={() => setDetailExpanded(open => !open)}
            style={{
              backgroundColor: detailExpanded ? '#F5EFE2' : '#073C30',
              color: detailExpanded ? '#073C30' : '#F9E7B9',
              borderColor: detailExpanded ? '#D6C8A9' : '#073C30',
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-extrabold transition hover:opacity-95 cursor-pointer"
          >
            <span>{expandDetailLabel}</span>
            {detailExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>

        {wallToast && (
          <div
            role="status"
            style={{ backgroundColor: '#ECFDF5', color: '#064E3B', borderColor: '#10B981' }}
            className="mt-3 flex items-center justify-between rounded-xl border px-4 py-2 text-xs font-bold"
          >
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-700" aria-hidden />
              <span>{wallToast}</span>
            </span>
            <a href="#/quran/wall" className="underline">
              Open Faith Wall →
            </a>
          </div>
        )}

        {/* Active Line-by-Line TTS Progress Strip */}
        {lineTts.active && (
          <div
            data-testid="seven-agent-tts-progress"
            style={{
              backgroundColor: '#FFFBEB',
              color: '#78350F',
              borderColor: '#F59E0B',
            }}
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-2 text-xs"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-600" />
              <span className="font-mono text-[11px] font-bold">
                Reading line {lineTts.currentIndex + 1} of {lineTts.lines.length}
              </span>
              {lineTts.nextLineReady && (
                <span
                  style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                >
                  Next line ready
                </span>
              )}
              {lineTts.currentLineText && (
                <span className="hidden truncate text-[11px] text-amber-900 sm:inline">
                  — “{lineTts.currentLineText}”
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous line"
                disabled={lineTts.currentIndex <= 0}
                onClick={() => void lineTts.jumpToLine(lineTts.currentIndex - 1)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-amber-400 bg-white text-amber-900 disabled:opacity-40 cursor-pointer"
              >
                <SkipBack className="h-3 w-3" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next line"
                disabled={lineTts.currentIndex + 1 >= lineTts.lines.length}
                onClick={() => void lineTts.jumpToLine(lineTts.currentIndex + 1)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-amber-400 bg-white text-amber-900 disabled:opacity-40 cursor-pointer"
              >
                <SkipForward className="h-3 w-3" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Stop"
                onClick={() => lineTts.stop()}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-300 bg-white text-red-700 cursor-pointer"
              >
                <Square className="h-3 w-3 fill-current" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </section>

      {detailExpanded && (
      <div data-testid="seven-agent-expanded-detail" className="space-y-6">
      {/* 2. Luminous Warm Ivory Spotlight Card: Modern Science & Prophetic Foresight (1 Step Ahead of Modern Science) */}
      <section
        data-testid="modern-science-foresight-card"
        style={{
          background: 'linear-gradient(135deg, #FFFDF9 0%, #FAF6EC 55%, #F3EFE2 100%)',
          color: '#1C1917',
          borderColor: '#E2D5B5',
        }}
        className="rounded-3xl border p-5 shadow-sm sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            style={{
              backgroundColor: '#FFFBEB',
              color: '#78350F',
              borderColor: '#F59E0B',
            }}
            className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-extrabold tracking-wide shadow-2xs"
          >
            <FlaskConical className="h-3.5 w-3.5 text-[#B45309]" aria-hidden />
            <span>{dossier.scienceForesight.badge}</span>
          </span>

          <button
            type="button"
            data-testid="science-card-listen-btn"
            onClick={handlePlayScienceSpotlight}
            style={{
              backgroundColor: isSciencePlaying || isScienceLoading ? '#D4AF37' : '#073C30',
              color: isSciencePlaying || isScienceLoading ? '#031812' : '#FFFFFF',
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-2xs cursor-pointer"
          >
            {isScienceLoading ? (
              <AudioLoadingSpinner size={14} />
            ) : isSciencePlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            )}
            <span>
              {isScienceLoading
                ? loadingText
                : isSciencePlaying
                  ? t.pause
                  : `${listenLabel} (${langLabel})`}
            </span>
          </button>
        </div>

        <h3
          lang={lang}
          style={{ color: '#0F2922' }}
          className="mt-3 font-display text-lg font-extrabold sm:text-xl"
        >
          {dossier.scienceForesight.headline}
        </h3>
        <p
          lang={lang}
          style={{ color: '#44403C' }}
          className="mt-1.5 text-sm leading-relaxed"
        >
          {dossier.scienceForesight.summary}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {dossier.scienceForesight.empiricalPillars.map((pillar, idx) => {
            const accent = PILLAR_ACCENTS[idx % PILLAR_ACCENTS.length];
            return (
              <div
                key={idx}
                data-testid={`science-pillar-${idx + 1}`}
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#1C1917',
                  borderColor: '#E7E0D0',
                  borderTopWidth: '4px',
                  borderTopColor: accent.stripeHex,
                }}
                className="flex flex-col justify-between rounded-2xl border p-4 shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{
                        backgroundColor: accent.badgeBg,
                        color: accent.badgeText,
                      }}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold"
                    >
                      0{idx + 1}
                    </span>
                    <h4
                      lang={lang}
                      style={{ color: accent.domainColor }}
                      className="text-xs font-extrabold uppercase tracking-wide"
                    >
                      {pillar.domain}
                    </h4>
                  </div>
                  <p
                    lang={lang}
                    style={{ color: '#292524' }}
                    className="mt-2.5 text-xs leading-relaxed sm:text-[13px]"
                  >
                    {pillar.finding}
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: accent.boxBg,
                    borderColor: accent.boxBorder,
                  }}
                  className="mt-3.5 rounded-xl border p-3"
                >
                  <p
                    style={{ color: accent.boxTitle }}
                    className="text-[10px] font-extrabold uppercase tracking-wider"
                  >
                    ✦ 1 Step Ahead of Modern Science
                  </p>
                  <p
                    lang={lang}
                    style={{ color: accent.boxText }}
                    className="mt-1 text-xs font-medium leading-snug"
                  >
                    {pillar.oneStepAheadNote}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <p
          lang={lang}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#44403C',
            borderColor: '#E5DEC9',
          }}
          className="mt-4 rounded-xl border px-4 py-2.5 text-xs italic"
        >
          {dossier.scienceForesight.methodologicalNote}
        </p>
      </section>

      {/* 3. All 7 Specialist Agent Result Cards (Bright White Cards with Distinct Discipline Accents) */}
      <section className="space-y-4">
        <div
          style={{
            backgroundColor: '#FFFFFF',
            color: '#1C1917',
            borderColor: '#E5DEC9',
          }}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-5 py-3.5 shadow-2xs"
        >
          <div>
            <p
              style={{ color: '#B45309' }}
              className="text-[11px] font-extrabold uppercase tracking-widest"
            >
              ✦ COMPLETE 7-AGENT VERIFICATION & EVIDENCE MATRIX
            </p>
            <h3
              style={{ color: '#1C1917' }}
              className="font-display text-lg font-bold sm:text-xl"
            >
              Individual Findings from All 7 Specialist Agents ({langLabel})
            </h3>
          </div>
          <span
            style={{
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              borderColor: '#A7F3D0',
            }}
            className="rounded-full border px-3.5 py-1 text-xs font-extrabold"
          >
            7 / 7 Agents Completed ✓
          </span>
        </div>

        <div
          data-testid="seven-agent-cards-grid"
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          {dossier.agents.map(agent => {
            const spec = agentVisualSpec(agent.agentId);
            const Icon = spec.Icon;
            const agentSid = `${sessionPrefix}agent-${agent.agentNumber}`;
            const isAgentPlaying = lineTts.isPlayingSession(agentSid);
            const isAgentLoading = lineTts.isLoadingSession(agentSid);
            const isSpotlight = Boolean(agent.isScienceSpotlight);

            return (
              <article
                key={agent.agentId}
                data-testid={`specialist-agent-card-${agent.agentNumber}`}
                style={{
                  backgroundColor: isSpotlight ? '#FFFDF9' : '#FFFFFF',
                  color: '#1C1917',
                  borderColor: '#E5DEC9',
                  borderLeftWidth: '4px',
                  borderLeftColor: spec.accentHex,
                }}
                className={`flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition sm:p-5 ${
                  isSpotlight ? 'lg:col-span-2' : ''
                }`}
              >
                <div>
                  {/* Agent Card Top Header */}
                  <div
                    style={{ borderColor: '#F3EFE6' }}
                    className="flex flex-wrap items-start justify-between gap-2 border-b pb-3"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        style={{
                          backgroundColor: spec.iconBg,
                          color: spec.iconText,
                        }}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs"
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div>
                        <h4
                          lang={lang}
                          style={{ color: '#1C1917' }}
                          className="font-display text-sm font-extrabold sm:text-base"
                        >
                          {agent.title}
                        </h4>
                        <p style={{ color: '#57534E' }} className="text-xs font-medium">
                          {agent.personaName} ·{' '}
                          <span style={{ color: spec.accentHex }} className="font-semibold">
                            {agent.roleBadge}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        style={{
                          backgroundColor: spec.badgeBg,
                          color: spec.badgeText,
                          borderColor: spec.badgeBorder,
                        }}
                        className="rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-extrabold"
                      >
                        {agent.confidenceScore}
                      </span>
                      <button
                        type="button"
                        data-testid={`listen-agent-${agent.agentNumber}-btn`}
                        aria-label={
                          isAgentLoading
                            ? loadingText
                            : isAgentPlaying
                              ? t.pause
                              : `${listenLabel} · ${agent.personaName}`
                        }
                        title={
                          isAgentLoading
                            ? loadingText
                            : isAgentPlaying
                              ? t.pause
                              : `${listenLabel} (${langLabel})`
                        }
                        onClick={() => handlePlayAgent(agent)}
                        style={{
                          backgroundColor: isAgentPlaying || isAgentLoading ? '#FEF3C7' : '#FAF7F0',
                          color: isAgentPlaying || isAgentLoading ? '#78350F' : '#073C30',
                          borderColor: isAgentPlaying || isAgentLoading ? '#F59E0B' : '#D6C8A9',
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border cursor-pointer"
                      >
                        {isAgentLoading ? (
                          <AudioLoadingSpinner size={12} className="text-[#B45309]" />
                        ) : isAgentPlaying ? (
                          <Pause className="h-3 w-3 fill-current" aria-hidden />
                        ) : (
                          <Volume2 className="h-3 w-3 text-[#B45309]" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Verdict Pill */}
                  <div className="mt-2.5">
                    <span
                      style={{
                        backgroundColor: spec.badgeBg,
                        color: spec.badgeText,
                        borderColor: spec.badgeBorder,
                      }}
                      className="inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                    >
                      {agent.verdictBadge}
                    </span>
                  </div>

                  {/* Arabic Primary Text Quote (Light Parchment Callout) */}
                  {agent.arabicQuote && (
                    <div
                      lang="ar"
                      dir="rtl"
                      style={{
                        backgroundColor: '#FAF6EC',
                        color: '#1C1917',
                        borderColor: '#E5DEC9',
                      }}
                      className="mt-3 rounded-xl border p-3.5"
                    >
                      <p
                        style={{ color: '#1C1917' }}
                        className="arabic text-lg font-bold leading-loose sm:text-xl"
                      >
                        « {agent.arabicQuote} »
                      </p>
                      {agent.arabicReference && (
                        <p
                          dir="ltr"
                          style={{ color: '#78350F' }}
                          className="mt-1 text-left font-mono text-[11px] font-semibold"
                        >
                          ✦ {agent.arabicReference}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Agent Summary */}
                  <p
                    lang={lang}
                    style={{ color: '#1C1917' }}
                    className="mt-3 text-sm font-semibold leading-relaxed"
                  >
                    {agent.summary}
                  </p>

                  {/* Key Findings Bullet List */}
                  <ul
                    lang={lang}
                    className="mt-2.5 space-y-1.5 text-xs leading-relaxed sm:text-[13px]"
                  >
                    {agent.keyPoints.map((pt, idx) => (
                      <li
                        key={idx}
                        style={{
                          backgroundColor: '#FAF8F3',
                          color: '#292524',
                          borderColor: '#EFECE4',
                        }}
                        className="flex items-start gap-2.5 rounded-xl border px-3 py-2"
                      >
                        <span
                          style={{
                            backgroundColor: spec.badgeBg,
                            color: spec.badgeText,
                          }}
                          className="mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-extrabold"
                        >
                          {idx + 1}
                        </span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Citations Footer */}
                <div
                  style={{ borderColor: '#F3EFE6' }}
                  className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t pt-2.5"
                >
                  {agent.citations.map(cite => (
                    <span
                      key={cite}
                      style={{
                        backgroundColor: '#FAF7F0',
                        color: '#57534E',
                        borderColor: '#E5DEC9',
                      }}
                      className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold"
                    >
                      ✦ {cite}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. Light Editorial 7-Agent Scholarly Roundtable Studio */}
      <section
        id="seven-agent-roundtable-studio"
        data-testid="seven-agent-roundtable-studio"
        style={{
          backgroundColor: '#FCF9F2',
          color: '#1C1917',
          borderColor: '#E2D5B5',
        }}
        className="relative z-10 scroll-mt-20 rounded-3xl border p-5 shadow-sm sm:scroll-mt-24 sm:p-7"
      >
        <div
          style={{ borderColor: '#E5DEC9' }}
          className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"
        >
          <div className="flex items-center gap-3">
            <span
              style={{ backgroundColor: '#073C30', color: '#D4AF37' }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl shadow-xs"
            >
              <Radio className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p
                style={{ color: '#B45309' }}
                className="text-[11px] font-extrabold uppercase tracking-widest"
              >
                ✦ {productWordmark} Live · Multi-voice Roundtable Studio
              </p>
              <h3
                style={{ color: '#0F2922' }}
                className="font-display text-lg font-extrabold sm:text-xl"
              >
                7-Agent Scholarly & Scientific Roundtable ({langLabel})
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="roundtable-play-all-btn"
              onClick={() => handlePlayRoundtable(0)}
              style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-extrabold shadow-xs transition hover:opacity-95 cursor-pointer"
            >
              {isRoundtableLoading ? (
                <AudioLoadingSpinner size={15} className="text-[#D4AF37]" />
              ) : isRoundtablePlaying ? (
                <Pause className="h-4 w-4 fill-current text-[#D4AF37]" aria-hidden />
              ) : (
                <Play className="h-4 w-4 fill-current text-[#D4AF37]" aria-hidden />
              )}
              <span>
                {isRoundtableLoading
                  ? loadingText
                  : isRoundtablePlaying
                    ? 'Pause'
                    : `Play (${dossier.roundtableTurns.length})`}
              </span>
            </button>

            <button
              type="button"
              data-testid="roundtable-toggle-transcript-btn"
              onClick={() => setRoundtableVisible(!isRoundtableVisible)}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#073C30',
                borderColor: '#D6C8A9',
              }}
              className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-stone-50 cursor-pointer"
            >
              {isRoundtableVisible ? 'Hide speakers' : 'Show speakers'}
            </button>
          </div>
        </div>

        {isRoundtableVisible && (
        <div className="mt-4 space-y-3" data-testid="roundtable-speaker-list">
          {dossier.roundtableTurns.map((turn, idx) => {
            const isTurnActive =
              lineTts.sessionId === roundtableSessionId &&
              lineTts.status !== 'idle' &&
              lineTts.currentSourceIndex === idx;
            const isTurnLoading =
              isTurnActive && lineTts.status === 'loading';
            const turnAccent =
              turn.voiceProfile === 'noor'
                ? { badgeBg: '#CCFBF1', badgeText: '#115E59', borderHex: '#14B8A6' }
                : turn.voiceProfile === 'yusuf'
                  ? { badgeBg: '#FEF3C7', badgeText: '#78350F', borderHex: '#F59E0B' }
                  : { badgeBg: '#D1FAE5', badgeText: '#064E3B', borderHex: '#10B981' };

            return (
              <div
                key={idx}
                data-testid={`roundtable-turn-${idx + 1}`}
                data-tts-line-active={isTurnActive ? 'true' : undefined}
                onClick={() => handlePlayRoundtable(idx)}
                style={{
                  backgroundColor: isTurnActive ? '#FFFBEB' : '#FFFFFF',
                  color: '#1C1917',
                  borderColor: isTurnActive ? '#F59E0B' : '#E7E0D0',
                  borderLeftWidth: '4px',
                  borderLeftColor: isTurnActive ? '#D97706' : turnAccent.borderHex,
                }}
                className="cursor-pointer rounded-2xl border p-4 shadow-2xs transition hover:shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      style={{
                        backgroundColor: turnAccent.badgeBg,
                        color: turnAccent.badgeText,
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-extrabold"
                    >
                      <Mic className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span style={{ color: '#1C1917' }} className="text-xs font-extrabold">
                      {turn.speaker}
                    </span>
                    <span
                      style={{
                        backgroundColor: turnAccent.badgeBg,
                        color: turnAccent.badgeText,
                      }}
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                    >
                      {turn.role}
                    </span>
                  </div>

                  <span
                    style={{ color: isTurnActive ? '#B45309' : '#073C30' }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold"
                    aria-hidden={!isTurnActive}
                  >
                    {isTurnLoading ? (
                      <>
                        <AudioLoadingSpinner size={13} className="text-[#B45309]" />
                        <span>{loadingText}</span>
                      </>
                    ) : isTurnActive ? (
                      <>
                        <Headphones className="h-3 w-3" aria-hidden />
                        <span>Speaking…</span>
                      </>
                    ) : (
                      <Headphones className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    )}
                  </span>
                </div>

                <p
                  lang={lang}
                  style={{ color: '#292524', lineHeight: 1.8 }}
                  className="mt-2 text-sm sm:text-[15px]"
                >
                  “{turn.text}”
                </p>
              </div>
            );
          })}
        </div>
        )}
      </section>
      </div>
      )}
    </div>
  );
}

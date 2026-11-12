import { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  FlaskConical,
  Headphones,
  Layers,
  Mic,
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
import { useStored } from '../../lib/store.tsx';
import { publishFaithWallPost } from '../../lib/verseShare.ts';
import {
  HADITH_PLAYBACK_SPEEDS,
  HADITH_VOICE_PROFILES,
  resolveHadithVoiceProfile,
  type HadithPlaybackSpeed,
  type HadithVoiceProfileId,
} from '../../shared/hadithVoices.ts';
import type {
  SevenAgentResearchDossier,
  SpecialistAgentFinding,
} from '../../shared/sevenAgentTypes.ts';
import { LANGUAGE_NAMES, type Lang } from '../../shared/sources.ts';

function agentIcon(agentId: SpecialistAgentFinding['agentId']) {
  switch (agentId) {
    case 'quran_tafsir':
      return BookOpen;
    case 'hadith_sunnah':
      return ScrollText;
    case 'isnad_rijal':
      return ShieldCheck;
    case 'fiqh_consensus':
      return Scale;
    case 'linguistic_maqasid':
      return Layers;
    case 'modern_science':
      return FlaskConical;
    case 'executive_synthesis':
      return Award;
  }
}

export function SevenAgentResearchBoard({
  dossier,
  lang,
  roundtableOpen = false,
  onToggleRoundtable,
}: {
  dossier: SevenAgentResearchDossier;
  lang: Lang;
  roundtableOpen?: boolean;
  onToggleRoundtable?: (open: boolean) => void;
}) {
  const [internalRoundtableOpen, setInternalRoundtableOpen] = useState(roundtableOpen);
  const [voiceProfile, setVoiceProfile] = useStored<HadithVoiceProfileId>(
    'kf-hadith-voice-profile',
    'tariq',
  );
  const [speed, setSpeed] = useStored<HadithPlaybackSpeed>('kf-hadith-voice-speed', 1);
  const [wallToast, setWallToast] = useState<string | null>(null);

  useEffect(() => {
    setInternalRoundtableOpen(roundtableOpen);
  }, [roundtableOpen]);

  const isRoundtableVisible = onToggleRoundtable ? roundtableOpen : internalRoundtableOpen;
  const setRoundtableVisible = (next: boolean) => {
    setInternalRoundtableOpen(next);
    onToggleRoundtable?.(next);
    if (next) {
      window.setTimeout(() => {
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
  const langLabel = LANGUAGE_NAMES[lang]?.native ?? 'English';

  const playLines = (sessionId: string, lines: string[]) => {
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
    playLines(sid, lines);
  };

  const handlePlayScienceSpotlight = () => {
    const sci = dossier.scienceForesight;
    const lines = [
      sci.headline,
      sci.summary,
      ...sci.empiricalPillars.map(
        p => `${p.domain}: ${p.finding} ${p.oneStepAheadNote}`,
      ),
    ];
    playLines(scienceSessionId, lines);
  };

  const handlePlayRoundtable = (startIdx = 0) => {
    const lines = dossier.roundtableTurns.map(t => `${t.speaker}: ${t.text}`);
    if (
      startIdx === 0 &&
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
      startIndex: startIdx,
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

  const isRoundtablePlaying =
    lineTts.sessionId === roundtableSessionId && lineTts.status === 'playing';
  const isSciencePlaying =
    lineTts.sessionId === scienceSessionId && lineTts.status === 'playing';

  return (
    <div data-testid="seven-agent-research-board" className="space-y-6">
      {/* 1. Executive 7-Agent Synthesis Header Card */}
      <section
        data-testid="seven-agent-executive-banner"
        style={{ backgroundColor: '#041B14', color: '#FFFFFF' }}
        className="relative overflow-hidden rounded-3xl border-2 border-[#D4AF37]/60 bg-gradient-to-br from-[#041B14] via-[#073C30] to-[#041B14] p-5 text-white shadow-xl sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              style={{ backgroundColor: 'rgba(212,175,55,0.2)', color: '#F9E7B9' }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/60 px-3 py-1 text-xs font-bold tracking-wider"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              <span>7-AGENT MULTIDISCIPLINARY DOSSIER</span>
            </span>
            <span
              style={{ backgroundColor: '#064E3B', color: '#FFFFFF', borderColor: '#10B981' }}
              className="rounded-full border px-3 py-1 font-mono text-xs font-extrabold"
            >
              {dossier.confidenceScore}% CONFIDENCE · {dossier.verdictClassification}
            </span>
          </div>

          <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-semibold text-[#E6C665]">
            {langLabel}
          </span>
        </div>

        <h2
          lang={lang}
          style={{ color: '#F9E7B9' }}
          className="mt-3.5 font-display text-xl font-extrabold leading-snug text-[#F9E7B9] sm:text-2xl"
        >
          {dossier.verdictHeadline}
        </h2>

        <p
          lang={lang}
          style={{ color: '#F3E8C8' }}
          className="mt-2.5 max-w-4xl text-sm leading-relaxed text-[#F3E8C8] sm:text-base"
        >
          {dossier.executiveSummary}
        </p>

        {/* Voice Selector + Primary Action Bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="board-open-roundtable-btn"
              onClick={() => {
                setRoundtableVisible(true);
                handlePlayRoundtable(0);
              }}
              style={{ backgroundColor: '#D4AF37', color: '#031812' }}
              className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-extrabold text-[#031812] shadow-md transition hover:bg-[#e3c14d] cursor-pointer"
            >
              <Radio className="h-4 w-4" aria-hidden />
              <span>
                {isRoundtablePlaying
                  ? `Pause Roundtable (${langLabel})`
                  : `Open & Play 7-Agent Roundtable (${langLabel})`}
              </span>
            </button>

            <button
              type="button"
              data-testid="board-listen-science-btn"
              onClick={handlePlayScienceSpotlight}
              style={{ backgroundColor: '#0E4D3B', color: '#FFFFFF' }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#0E4D3B] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#13634C] cursor-pointer"
            >
              {isSciencePlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current text-[#D4AF37]" aria-hidden />
              ) : (
                <FlaskConical className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              )}
              <span>
                {isSciencePlaying ? 'Pause Science Audio' : 'Listen: 1 Step Ahead of Science'}
              </span>
            </button>

            <button
              type="button"
              data-testid="board-share-wall-btn"
              onClick={() => void handleShareToFaithWall()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3.5 py-2 text-xs font-bold text-[#F9E7B9] transition hover:bg-white/20 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              <span>Share to Faith Wall</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select ElevenLabs v4 Voice"
              value={profile.id}
              onChange={e => setVoiceProfile(e.target.value as HadithVoiceProfileId)}
              style={{ backgroundColor: '#0A3528', color: '#FBF9F5' }}
              className="rounded-xl border border-[#D4AF37]/40 bg-[#0A3528] px-2.5 py-1 text-xs font-semibold text-[#FBF9F5] outline-none"
            >
              {HADITH_VOICE_PROFILES.map(v => (
                <option
                  key={v.id}
                  value={v.id}
                  style={{ backgroundColor: '#FFFFFF', color: '#1C1917' }}
                >
                  {v.label}
                </option>
              ))}
            </select>

            <div className="inline-flex items-center gap-1 rounded-xl border border-[#D4AF37]/30 bg-black/25 p-0.5">
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
                      backgroundColor: active ? '#D4AF37' : 'transparent',
                      color: active ? '#041B14' : '#FBF9F5',
                    }}
                    className="rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold cursor-pointer"
                  >
                    {rate}x
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {wallToast && (
          <div
            role="status"
            className="mt-3 flex items-center justify-between rounded-xl border border-[#D4AF37] bg-[#0A2E23] px-4 py-2 text-xs font-bold text-[#F9E7B9]"
          >
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-400" aria-hidden />
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
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4AF37]/50 bg-[#031812]/90 px-4 py-2 text-xs text-[#F9E7B9]"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />
              <span className="font-mono text-[11px] font-bold">
                ElevenLabs v4 · Reading Line {lineTts.currentIndex + 1} of {lineTts.lines.length}
              </span>
              {lineTts.nextLineReady && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Next line ready
                </span>
              )}
              {lineTts.currentLineText && (
                <span className="hidden truncate text-[11px] text-stone-300 sm:inline">
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
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/25 disabled:opacity-40 cursor-pointer"
              >
                <SkipBack className="h-3 w-3" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next line"
                disabled={lineTts.currentIndex + 1 >= lineTts.lines.length}
                onClick={() => void lineTts.jumpToLine(lineTts.currentIndex + 1)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/25 disabled:opacity-40 cursor-pointer"
              >
                <SkipForward className="h-3 w-3" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Stop"
                onClick={() => lineTts.stop()}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-400/50 text-red-300 cursor-pointer"
              >
                <Square className="h-3 w-3 fill-current" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. Highlighted Spotlight Card: Modern Science & Prophetic Foresight (1 Step Ahead of Modern Science) */}
      <section
        data-testid="modern-science-foresight-card"
        className="rounded-3xl border-2 border-[#073C30] bg-gradient-to-br from-[#F4EFE4] via-[#FFFFFF] to-[#E8F2EC] p-5 text-stone-900 shadow-md sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#073C30] px-3.5 py-1 text-xs font-extrabold tracking-wide text-[#F9E7B9]"
          >
            <FlaskConical className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span>{dossier.scienceForesight.badge}</span>
          </span>

          <button
            type="button"
            onClick={handlePlayScienceSpotlight}
            style={{
              backgroundColor: isSciencePlaying ? '#D4AF37' : '#073C30',
              color: isSciencePlaying ? '#031812' : '#FFFFFF',
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-2xs cursor-pointer"
          >
            {isSciencePlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            )}
            <span>{isSciencePlaying ? 'Pause' : `Listen (${langLabel})`}</span>
          </button>
        </div>

        <h3
          lang={lang}
          className="mt-3 font-display text-lg font-extrabold text-[#073C30] sm:text-xl"
        >
          {dossier.scienceForesight.headline}
        </h3>
        <p lang={lang} className="mt-1.5 text-sm leading-relaxed text-stone-700">
          {dossier.scienceForesight.summary}
        </p>

        <div className="mt-4 grid gap-3.5 md:grid-cols-3">
          {dossier.scienceForesight.empiricalPillars.map((pillar, idx) => (
            <div
              key={idx}
              data-testid={`science-pillar-${idx + 1}`}
              className="flex flex-col justify-between rounded-2xl border border-[#073C30]/20 bg-white p-4 shadow-2xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold"
                  >
                    0{idx + 1}
                  </span>
                  <h4 lang={lang} className="text-xs font-extrabold uppercase tracking-wide text-[#073C30]">
                    {pillar.domain}
                  </h4>
                </div>
                <p lang={lang} className="mt-2 text-xs leading-relaxed text-stone-800 sm:text-[13px]">
                  {pillar.finding}
                </p>
              </div>

              <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-50/90 p-2.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                  ✦ 1 Step Ahead of Modern Science
                </p>
                <p lang={lang} className="mt-0.5 text-xs font-medium leading-snug text-amber-950">
                  {pillar.oneStepAheadNote}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p
          lang={lang}
          className="mt-3.5 rounded-xl border border-[#073C30]/15 bg-[#FAF7F0] px-3.5 py-2 text-xs italic text-stone-700"
        >
          {dossier.scienceForesight.methodologicalNote}
        </p>
      </section>

      {/* 3. All 7 Specialist Agent Result Cards (Agents 01 – 07) */}
      <section className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#073C30]">
              ✦ COMPLETE 7-AGENT VERIFICATION & EVIDENCE MATRIX
            </p>
            <h3 className="font-display text-lg font-bold text-stone-900 sm:text-xl">
              Individual Findings from All 7 Specialist Agents ({langLabel})
            </h3>
          </div>
          <span className="rounded-full border border-emerald-700/30 bg-emerald-50 px-3 py-1 text-xs font-bold text-[#073C30]">
            7 / 7 Agents Completed ✓
          </span>
        </div>

        <div
          data-testid="seven-agent-cards-grid"
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          {dossier.agents.map(agent => {
            const Icon = agentIcon(agent.agentId);
            const agentSid = `${sessionPrefix}agent-${agent.agentNumber}`;
            const isAgentPlaying =
              lineTts.sessionId === agentSid && lineTts.status === 'playing';
            const isSpotlight = Boolean(agent.isScienceSpotlight);

            return (
              <article
                key={agent.agentId}
                data-testid={`specialist-agent-card-${agent.agentNumber}`}
                className={`flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition sm:p-5 ${
                  isSpotlight
                    ? 'border-2 border-[#073C30] bg-gradient-to-br from-[#FAF7F0] to-[#E8F2EC] lg:col-span-2'
                    : 'border-stone-200/90 bg-white'
                }`}
              >
                <div>
                  {/* Agent Card Top Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 pb-3">
                    <div className="flex items-start gap-3">
                      <span
                        style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#073C30] text-[#F9E7B9] shadow-2xs"
                      >
                        <Icon className="h-4 w-4 text-[#D4AF37]" aria-hidden />
                      </span>
                      <div>
                        <h4
                          lang={lang}
                          className="font-display text-sm font-extrabold text-stone-900 sm:text-base"
                        >
                          {agent.title}
                        </h4>
                        <p className="text-xs font-medium text-stone-600">
                          {agent.personaName} · <span className="text-[#073C30]">{agent.roleBadge}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        style={{ backgroundColor: '#042F2E', color: '#FFFFFF', borderColor: '#10B981' }}
                        className="rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-extrabold text-white"
                      >
                        {agent.confidenceScore}
                      </span>
                      <button
                        type="button"
                        data-testid={`listen-agent-${agent.agentNumber}-btn`}
                        onClick={() => handlePlayAgent(agent)}
                        style={{
                          backgroundColor: isAgentPlaying ? '#D4AF37' : '#073C30',
                          color: isAgentPlaying ? '#031812' : '#FFFFFF',
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                      >
                        {isAgentPlaying ? (
                          <Pause className="h-3 w-3 fill-current" aria-hidden />
                        ) : (
                          <Volume2 className="h-3 w-3 text-[#D4AF37]" aria-hidden />
                        )}
                        <span>{isAgentPlaying ? 'Pause' : 'Listen'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Verdict Pill */}
                  <div className="mt-2.5">
                    <span className="inline-block rounded-full border border-amber-400/60 bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-950">
                      {agent.verdictBadge}
                    </span>
                  </div>

                  {/* Arabic Primary Text Quote (if present) */}
                  {agent.arabicQuote && (
                    <div
                      lang="ar"
                      dir="rtl"
                      className="mt-3 rounded-xl border border-[#D4AF37]/40 bg-[#FAF7F0] p-3"
                    >
                      <p className="arabic text-lg font-bold leading-loose text-stone-950 sm:text-xl">
                        « {agent.arabicQuote} »
                      </p>
                      {agent.arabicReference && (
                        <p dir="ltr" className="mt-1 text-left font-mono text-[11px] font-semibold text-[#073C30]">
                          ✦ {agent.arabicReference}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Agent Summary */}
                  <p
                    lang={lang}
                    className="mt-3 text-sm font-semibold leading-relaxed text-stone-900"
                  >
                    {agent.summary}
                  </p>

                  {/* Key Findings Bullet List */}
                  <ul lang={lang} className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-stone-700 sm:text-[13px]">
                    {agent.keyPoints.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-2 rounded-lg bg-stone-50/90 px-2.5 py-1.5">
                        <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#073C30] font-mono text-[9px] font-bold text-[#F9E7B9]">
                          {idx + 1}
                        </span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Citations Footer */}
                <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-2.5">
                  {agent.citations.map(cite => (
                    <span
                      key={cite}
                      className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[10px] font-semibold text-stone-700"
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

      {/* 4. Interactive 7-Agent Scholarly Roundtable Studio */}
      <section
        id="seven-agent-roundtable-studio"
        data-testid="seven-agent-roundtable-studio"
        style={{ backgroundColor: '#041B14', color: '#FFFFFF' }}
        className="rounded-3xl border-2 border-[#D4AF37]/65 bg-gradient-to-br from-[#041B14] via-[#073C30] to-[#041B14] p-5 text-white shadow-xl sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D4AF37] text-[#031812] shadow-md">
              <Radio className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#E6C665]">
                ✦ DRAGON DAWWA LIVE · MULTI-VOICE ROUNDTABLE STUDIO
              </p>
              <h3 className="font-display text-lg font-bold text-white sm:text-xl">
                7-Agent Scholarly & Scientific Roundtable ({langLabel})
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="roundtable-play-all-btn"
              onClick={() => handlePlayRoundtable(0)}
              style={{ backgroundColor: '#D4AF37', color: '#031812' }}
              className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-extrabold text-[#031812] shadow-md transition hover:bg-[#e3c14d] cursor-pointer"
            >
              {isRoundtablePlaying ? (
                <Pause className="h-4 w-4 fill-current" aria-hidden />
              ) : (
                <Play className="h-4 w-4 fill-current" aria-hidden />
              )}
              <span>
                {isRoundtablePlaying
                  ? 'Pause Roundtable Broadcast'
                  : `Play Roundtable Broadcast (${dossier.roundtableTurns.length} Speakers)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRoundtableVisible(!isRoundtableVisible)}
              className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#F9E7B9] hover:bg-white/20 cursor-pointer"
            >
              {isRoundtableVisible ? 'Compact View' : 'Expand Transcript'}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {dossier.roundtableTurns.map((turn, idx) => {
            const isTurnActive =
              lineTts.sessionId === roundtableSessionId &&
              lineTts.status !== 'idle' &&
              lineTts.currentIndex === idx;
            return (
              <div
                key={idx}
                data-testid={`roundtable-turn-${idx + 1}`}
                data-tts-line-active={isTurnActive ? 'true' : undefined}
                onClick={() => handlePlayRoundtable(idx)}
                style={{
                  backgroundColor: isTurnActive
                    ? 'rgba(212, 175, 55, 0.22)'
                    : 'rgba(3, 24, 18, 0.72)',
                }}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  isTurnActive
                    ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]'
                    : 'border-white/15 hover:border-[#D4AF37]/50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#D4AF37] font-mono text-[11px] font-extrabold text-[#031812]">
                      <Mic className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="text-xs font-extrabold text-[#F9E7B9]">
                      {turn.speaker}
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#E6C665]">
                      {turn.role}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E6C665]">
                    <Headphones className="h-3 w-3" aria-hidden />
                    <span>{isTurnActive ? 'Speaking now…' : 'Tap to hear speaker'}</span>
                  </span>
                </div>

                <p
                  lang={lang}
                  style={{ color: '#FFFFFF', lineHeight: 1.8 }}
                  className="mt-2 text-sm text-white sm:text-[15px]"
                >
                  “{turn.text}”
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

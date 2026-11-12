import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Pause,
  Radio,
  ScrollText,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useRemote } from '../lib/api.ts';
import { setAudioPlaybackRate } from '../lib/audio.ts';
import { splitTextIntoSpeechLines, useLineByLineTts } from '../lib/lineByLineTts.ts';
import { usePronunciation, withPronunciation } from '../lib/pronunciation.ts';
import { useQuranEdition } from '../lib/quranEdition.ts';
import { useApp } from '../lib/store.tsx';
import { profileFontClass, wallFontClass } from '../lib/typography.ts';
import { shownVerses, translationRequest } from '../shared/quranenc.ts';
import type { SevenAgentResearchDossier } from '../shared/sevenAgentTypes.ts';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';
import type { Hadith, Verse } from '../shared/types.ts';
import { AudioLoadingSpinner, loadingAudioLabel } from '../components/AudioLoadingSpinner.tsx';
import { HadithCard, VerseCard } from '../components/cards.tsx';
import { SevenAgentResearchBoard } from '../components/research/SevenAgentResearchBoard.tsx';
import { EmptyState } from '../components/shell/widgets.tsx';
import { ErrorNote, Loading } from '../components/ui.tsx';

function SavedVerseList({ refs }: { refs: string[] }) {
  const { lang, t } = useApp();
  const [pronunciation] = usePronunciation();
  const quranEdition = useQuranEdition();
  const request = translationRequest(
    refs.length ? `/api/quran/verses?refs=${encodeURIComponent(refs.join(','))}&lang=${lang}` : null,
    lang,
    lang,
    quranEdition.edition,
    quranEdition.loading,
  );
  const url = request ? withPronunciation(request.url, pronunciation) : null;
  const { data, error, loading, reload } = useRemote<Verse[]>(url);
  const verses = loading || quranEdition.loading ? null : shownVerses(data, lang, request?.editionKey ?? null);
  if (loading || quranEdition.loading || (request && data && !verses && !error)) return <Loading />;
  if (quranEdition.error) return <ErrorNote message={quranEdition.error} onRetry={quranEdition.reload} />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (request && data && !verses) return <p className="text-sm text-muted">{t.quranEncUnread}</p>;
  return <div>{verses?.map(v => <VerseCard key={v.key} verse={v} compact />)}</div>;
}

function SavedHadithItem({ collection, number }: { collection: string; number: number }) {
  const { lang } = useApp();
  const { data, error, loading, reload } = useRemote<Hadith>(`/api/hadith/${collection}/${number}?lang=${lang}`);
  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  return data ? <HadithCard hadith={data} /> : null;
}

interface HistoryPayload {
  items: SevenAgentResearchDossier[];
  saved: SevenAgentResearchDossier[];
  savedIds: string[];
}

export function SavedLibraryView() {
  const { t, lang, uiTheme, saved, toggleDossier } = useApp();
  const isObsidian = uiTheme === 'obsidian';
  const [filter, setFilter] = useState<'all' | 'research' | 'quran' | 'hadith'>('all');
  const [expandedDossierId, setExpandedDossierId] = useState<string | null>(null);
  const [openRoundtableForId, setOpenRoundtableForId] = useState<string | null>(null);

  const serverHistory = useRemote<HistoryPayload>(`/api/research/seven-agents/history?lang=${lang}`);
  const lineTts = useLineByLineTts('saved-dossier-tts:');
  const loadingText = loadingAudioLabel(lang);

  const savedDossiers = useMemo(() => {
    const map = new Map<string, SevenAgentResearchDossier>();
    for (const d of saved.dossiers ?? []) {
      map.set(d.question.trim().toLowerCase(), d);
    }
    for (const d of serverHistory.data?.saved ?? []) {
      const k = d.question.trim().toLowerCase();
      if (!map.has(k)) map.set(k, d);
    }
    return [...map.values()];
  }, [saved.dossiers, serverHistory.data]);

  // Auto-expand the first saved dossier if there is one and the user opened #/saved
  useEffect(() => {
    if (savedDossiers.length > 0 && !expandedDossierId) {
      setExpandedDossierId(savedDossiers[0].id);
    }
  }, [savedDossiers, expandedDossierId]);

  const totalCount =
    savedDossiers.length + saved.verses.length + saved.hadith.length;

  const handleListenDossierSummary = (dossier: SevenAgentResearchDossier) => {
    const sid = `saved-dossier-tts:${dossier.id}`;
    if (lineTts.isPlayingSession(sid)) {
      lineTts.pause();
      return;
    }
    const lines = splitTextIntoSpeechLines(
      [
        dossier.verdictHeadline,
        dossier.executiveSummary,
        dossier.scienceForesight.headline,
        dossier.scienceForesight.summary,
      ].join('. '),
    );
    setAudioPlaybackRate(1);
    void lineTts.start({
      sessionId: sid,
      lines,
      lang: dossier.lang ?? lang,
    });
  };

  return (
    <div
      data-testid="saved-library-view"
      className={`${profileFontClass(lang)} mx-auto max-w-5xl space-y-6`}
    >
      {/* Header Banner */}
      <header
        style={
          isObsidian
            ? { backgroundColor: '#0A2920', color: '#F7F2E4', borderColor: 'rgba(212,175,55,0.4)' }
            : { backgroundColor: '#FFFFFF', color: '#1C1917', borderColor: '#E2D5B5' }
        }
        className="relative overflow-hidden rounded-3xl border p-5 shadow-sm sm:p-7"
      >
        <div
          aria-hidden
          style={{
            background: 'linear-gradient(90deg, #073C30 0%, #C89D54 50%, #073C30 100%)',
          }}
          className="absolute inset-x-0 top-0 h-1.5"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div>
            <span
              style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wider"
            >
              <Bookmark className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              <span>PERSONAL SAVED LIBRARY & DOSSIERS</span>
            </span>

            <h1
              style={{ color: isObsidian ? '#F9E7B9' : '#0F2922' }}
              className={`${wallFontClass(lang)} mt-2.5 text-xl font-extrabold sm:text-2xl`}
            >
              {lang === 'ta'
                ? 'சேமிக்கப்பட்ட 7-முகவர் ஆய்வுகள், குர்ஆன் & ஹதீஸ்கள்'
                : lang === 'si'
                  ? 'සුරැකි නියෝජිත 7 පර්යේෂණ වාර්තා, අල්-කුර්ආන් සහ හදීස්'
                  : 'Saved 7-Agent Research Dossiers, Qur’an Verses & Hadiths'}
            </h1>
          </div>

          <a
            href="#/hub/research"
            style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold shadow-xs hover:opacity-95"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span>+ Run New 7-Agent Research →</span>
          </a>
        </div>

        {/* Category Filter Tabs */}
        <div
          role="group"
          aria-label="Filter saved items"
          className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-200/30 pt-3.5"
        >
          {(
            [
              { id: 'all', label: `All Saved (${totalCount})` },
              {
                id: 'research',
                label: `7-Agent Research (${savedDossiers.length})`,
              },
              { id: 'quran', label: `Qur’an Verses (${saved.verses.length})` },
              { id: 'hadith', label: `Hadiths (${saved.hadith.length})` },
            ] as const
          ).map(tab => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`saved-filter-${tab.id}`}
                aria-pressed={active}
                onClick={() => setFilter(tab.id)}
                style={
                  active
                    ? { backgroundColor: '#D4AF37', color: '#031812', borderColor: '#D4AF37' }
                    : isObsidian
                      ? { backgroundColor: '#0D3529', color: '#F5EEDC', borderColor: 'rgba(212,175,55,0.3)' }
                      : { backgroundColor: '#FAF7F0', color: '#292524', borderColor: '#D6C8A9' }
                }
                className="rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition cursor-pointer"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {totalCount === 0 && (
        <EmptyState>{t.savedEmpty}</EmptyState>
      )}

      {/* 1. Saved 7-Agent Research Dossiers & Roundtables */}
      {(filter === 'all' || filter === 'research') && savedDossiers.length > 0 && (
        <section className="space-y-4" data-testid="saved-dossiers-section">
          {savedDossiers.map(dossier => {
            const isExpanded = expandedDossierId === dossier.id;
            const sid = `saved-dossier-tts:${dossier.id}`;
            const isPlaying = lineTts.isPlayingSession(sid);
            const isLoading = lineTts.isLoadingSession(sid);
            const dLang: Lang = dossier.lang ?? lang;

            return (
              <div
                key={dossier.id}
                data-testid="saved-seven-agent-card"
                style={
                  isObsidian
                    ? { backgroundColor: '#0A2920', color: '#F7F2E4', borderColor: 'rgba(212,175,55,0.4)' }
                    : { backgroundColor: '#FFFFFF', color: '#1C1917', borderColor: '#E2D5B5' }
                }
                className="rounded-3xl border p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        style={{ backgroundColor: '#FEF3C7', color: '#78350F', borderColor: '#F59E0B' }}
                        className="rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-extrabold"
                      >
                        {dossier.confidenceScore}% CONFIDENCE · 7/7 AGENTS
                      </span>
                      <span
                        style={{ backgroundColor: '#CCFBF1', color: '#115E59', borderColor: '#14B8A6' }}
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold"
                      >
                        <FlaskConical className="h-3 w-3" aria-hidden />
                        <span>1 Step Ahead of Modern Science</span>
                      </span>
                      <span
                        style={
                          isObsidian
                            ? { backgroundColor: '#0D3529', color: '#E5C158' }
                            : { backgroundColor: '#F5EFE2', color: '#073C30' }
                        }
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      >
                        {LANGUAGE_NAMES[dLang]?.native ?? 'English'}
                      </span>
                    </div>

                    <h2
                      lang={dLang}
                      style={{ color: isObsidian ? '#F9E7B9' : '#0F2922' }}
                      className={`${wallFontClass(dLang, dossier.question)} text-lg font-extrabold sm:text-xl`}
                    >
                      “{dossier.question}”
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="listen-saved-dossier-btn"
                      onClick={() => handleListenDossierSummary(dossier)}
                      style={{
                        backgroundColor: isPlaying || isLoading ? '#D4AF37' : '#073C30',
                        color: isPlaying || isLoading ? '#031812' : '#F9E7B9',
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold shadow-2xs cursor-pointer"
                    >
                      {isLoading ? (
                        <AudioLoadingSpinner size={14} />
                      ) : isPlaying ? (
                        <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                      )}
                      <span>{isLoading ? loadingText : isPlaying ? 'Pause' : 'Listen'}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="remove-saved-dossier-btn"
                      title="Remove from Saved Library"
                      onClick={() => toggleDossier(dossier)}
                      style={
                        isObsidian
                          ? { backgroundColor: '#0D3529', color: '#FCA5A5', borderColor: 'rgba(248,113,113,0.35)' }
                          : { backgroundColor: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' }
                      }
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                {/* Executive Verdict & Science Preview */}
                <p
                  lang={dLang}
                  style={{ color: isObsidian ? '#F7F2E4' : '#1C1917' }}
                  className="mt-2.5 text-sm font-bold leading-snug sm:text-base"
                >
                  {dossier.verdictHeadline}
                </p>
                <p
                  lang={dLang}
                  style={{ color: isObsidian ? '#EAE3D2' : '#44403C' }}
                  className="mt-1.5 text-xs leading-relaxed sm:text-sm"
                >
                  {dossier.executiveSummary}
                </p>

                {/* Action Row: Reopen Full 7-Agent Report & Roundtable */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/30 pt-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="reopen-saved-dossier-btn"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedDossierId(curr => (curr === dossier.id ? null : dossier.id))
                      }
                      style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold shadow-xs hover:opacity-95 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                      <span>
                        {isExpanded
                          ? 'Hide Full 7-Agent Report & Roundtable'
                          : 'Reopen Full 7-Agent Report & Roundtable →'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExpandedDossierId(dossier.id);
                        setOpenRoundtableForId(dossier.id);
                      }}
                      style={{
                        backgroundColor: isObsidian ? '#0D3529' : '#FFFBEB',
                        color: isObsidian ? '#F9E7B9' : '#78350F',
                        borderColor: '#D4AF37',
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-extrabold cursor-pointer"
                    >
                      <Radio className="h-3.5 w-3.5 text-[#B45309]" aria-hidden />
                      <span>Open Roundtable Studio</span>
                    </button>
                  </div>

                  <a
                    href={`#/hub/research?lang=${dLang}&q=${encodeURIComponent(dossier.question)}`}
                    style={{ color: isObsidian ? '#E5C158' : '#073C30' }}
                    className="text-xs font-bold underline"
                  >
                    Open in Research Studio →
                  </a>
                </div>

                {/* Inline Expanded Full 7-Agent Research Board & Roundtable Studio */}
                {isExpanded && (
                  <div className="mt-5 border-t border-stone-200/40 pt-5">
                    <SevenAgentResearchBoard
                      dossier={dossier}
                      lang={dLang}
                      roundtableOpen={openRoundtableForId === dossier.id}
                      onToggleRoundtable={open =>
                        setOpenRoundtableForId(open ? dossier.id : null)
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* 2. Saved Qur'an Verses */}
      {(filter === 'all' || filter === 'quran') && saved.verses.length > 0 && (
        <section
          style={
            isObsidian
              ? { backgroundColor: '#0A2920', color: '#F7F2E4', borderColor: 'rgba(212,175,55,0.35)' }
              : { backgroundColor: '#FFFFFF', color: '#1C1917', borderColor: '#E5DEC9' }
          }
          className="rounded-3xl border p-5 shadow-xs sm:p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            <h2 className="font-display text-base font-extrabold sm:text-lg">
              Saved Qur’an Verses ({saved.verses.length})
            </h2>
          </div>
          <SavedVerseList refs={saved.verses.slice(0, 60)} />
        </section>
      )}

      {/* 3. Saved Hadiths */}
      {(filter === 'all' || filter === 'hadith') && saved.hadith.length > 0 && (
        <section
          style={
            isObsidian
              ? { backgroundColor: '#0A2920', color: '#F7F2E4', borderColor: 'rgba(212,175,55,0.35)' }
              : { backgroundColor: '#FFFFFF', color: '#1C1917', borderColor: '#E5DEC9' }
          }
          className="rounded-3xl border p-5 shadow-xs sm:p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            <h2 className="font-display text-base font-extrabold sm:text-lg">
              Saved Prophetic Hadiths ({saved.hadith.length})
            </h2>
          </div>
          {saved.hadith.map(item => (
            <SavedHadithItem
              key={`${item.collection}-${item.number}`}
              collection={item.collection}
              number={item.number}
            />
          ))}
        </section>
      )}
    </div>
  );
}

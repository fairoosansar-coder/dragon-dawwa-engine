import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Copy, Search, Sparkles } from 'lucide-react';
import { StudioMark } from '../components/shell/studioMarks.tsx';
import type { ViewProps } from '../App.tsx';
import { TOPICS, verseOfTheDay } from '../shared/topics.ts';
import type { AskResult, Hadith, SurahInfo, Verse } from '../shared/types.ts';
import { postJson, useRemote } from '../lib/api.ts';
import { beginResearch, researchHref } from '../lib/researchDesk.ts';
import { useShell } from '../lib/shell.tsx';
import { displayAyah, displaySurah, useReadingPlace } from '../lib/readingPlace.ts';
import { useQuranEdition } from '../lib/quranEdition.ts';
import { usePronunciation, withPronunciation } from '../lib/pronunciation.ts';
import { shownVerses, translationRequest } from '../shared/quranenc.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { CitationChips, EvidenceList, HadithCard, VerseCard } from '../components/cards.tsx';
import { FaithWallFeed } from '../components/FaithWallFeed.tsx';
import { ADMIN_SETTINGS_EVENT, readAdminSettings, submitScholarQuestion } from '../lib/verseShare.ts';
import { KnowledgeShelf } from './KnowledgePaths.tsx';
import { LibraryReader } from './LibraryReader.tsx';
import { SavedLibraryView } from './SavedLibraryView.tsx';
import { EmptyState, FeatureCard, PrayerStrip } from '../components/shell/widgets.tsx';
import { Button, Card, ErrorNote, Loading, Notice, SectionTitle } from '../components/ui.tsx';
import { DomainResearchForm } from './DomainResearchForm.tsx';
import { readerQuestion } from './domainQuestion.ts';
import { MODERN_WORLD_BENCHMARKS } from '../shared/modernWorldBenchmarks.ts';

function VerseList({ refs }: { refs: string[] }) {
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

function SavedHadith({ collection, number }: { collection: string; number: number }) {
  const { lang } = useApp();
  const { data, error, loading, reload } = useRemote<Hadith>(`/api/hadith/${collection}/${number}?lang=${lang}`);
  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  return data ? <HadithCard hadith={data} /> : null;
}

function AskPanel() {
  const { t, lang, config } = useApp();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await postJson<AskResult>('/api/ask', { question, lang }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cited = useMemo(() => new Set(result?.paragraphs.flatMap(p => p.citations) ?? []), [result]);
  const disabled = config ? !config.ai : false;

  return (
    <Card>
      <SectionTitle sub={t.askHint}>{t.askTitle}</SectionTitle>
      {disabled && <Notice>{t.aiOff}</Notice>}
      <form onSubmit={submit} className="mt-3 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="ask-input">
          {t.askTitle}
        </label>
        <input
          id="ask-input"
          value={question}
          maxLength={500}
          onChange={e => setQuestion(e.target.value)}
          placeholder={t.askPlaceholder}
          disabled={disabled}
          className="flex-1 rounded-full border border-pine/20 bg-white px-5 py-3 text-sm"
        />
        <Button type="submit" disabled={disabled || busy || !question.trim()} className="py-3">
          <Search className="h-4 w-4" aria-hidden /> {busy ? t.asking : t.ask}
        </Button>
      </form>
      {busy && <Loading label={t.asking} />}
      {error && (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      )}
      {result && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div aria-live="polite">
            <p className="mb-3 flex items-center gap-2 text-xs font-medium text-pine">
              <Sparkles className="h-4 w-4" aria-hidden /> {t.aiGenerated}
            </p>
            {result.insufficientEvidence && <Notice>{t.insufficient}</Notice>}
            <div className="mt-3 space-y-3 leading-relaxed">
              {result.paragraphs.map((p, i) => (
                <p key={i} lang={result.lang}>
                  {p.text}
                  <CitationChips ids={p.citations} />
                </p>
              ))}
            </div>
          </div>
          {result.evidence.length > 0 && (
            <div>
              <h3 className="mb-3 font-display text-lg font-bold text-pine">{t.sourcesRetrieved}</h3>
              <EvidenceList evidence={result.evidence} cited={cited} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ScholarDraft({ focus }: { focus: boolean }) {
  const { t, lang } = useApp();
  const [draft, setDraft] = useStored<string>('kf-scholar-draft', '');
  const [copied, setCopied] = useState(false);
  const [flaggedToScholar, setFlaggedToScholar] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [focus]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleSendToScholarInbox() {
    if (draft.trim().length < 5) return;
    submitScholarQuestion({
      question: draft.trim(),
      language: lang,
    });
    setFlaggedToScholar(true);
    setTimeout(() => setFlaggedToScholar(false), 3500);
  }

  return (
    <section ref={ref} id="ask-scholar" className="scroll-mt-24 rounded-3xl border border-pine/10 bg-parchment p-5 shadow-sm sm:p-6">
      <SectionTitle sub={t.scholarHint}>{t.scholarTitle}</SectionTitle>
      <label htmlFor="scholar-draft" className="sr-only">
        {t.scholarTitle}
      </label>
      <textarea
        id="scholar-draft"
        value={draft}
        onChange={e => setDraft(e.target.value.slice(0, 2000))}
        rows={5}
        placeholder={t.scholarPlaceholder}
        className="w-full rounded-2xl border border-pine/20 bg-white p-3 text-sm"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="soft" onClick={() => void copy()} disabled={!draft.trim()}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? t.scholarCopied : t.sidebarQuestion}
        </Button>
        <Button variant="soft" onClick={handleSendToScholarInbox} disabled={draft.trim().length < 5}>
          <Sparkles className="h-4 w-4" aria-hidden />
          {flaggedToScholar ? 'Queued in Scholar Q&A Inbox' : 'Flag for Verified Scholar Q&A'}
        </Button>
        {draft.trim() && <span className="text-xs text-ink/50">{t.scholarSaved}</span>}
        <span className="ml-auto flex gap-3 text-sm">
          <a href="#/quran/study" className="font-medium text-pine hover:underline">
            {t.quranStudy}
          </a>
          <a href="#/hadith/research" className="font-medium text-pine hover:underline">
            {t.researchHadith}
          </a>
        </span>
      </div>
    </section>
  );
}

export default function KnowledgeHub({ sub, segments = [] }: ViewProps) {
  const { t, lang, saved } = useApp();
  const { query } = useShell();
  const [place] = useReadingPlace();
  const surah = place.surah;
  const surahs = useRemote<SurahInfo[]>('/api/quran/surahs');
  const [topicId, setTopicId] = useState<string | null>(null);
  const [asked, setAsked] = useState('');
  const [askError, setAskError] = useState<string | null>(null);
  const [clarify, setClarify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adminBannerUrl, setAdminBannerUrl] = useState(() => readAdminSettings().heroBannerUrl || '/assets/geometric-emerald.jpg');

  useEffect(() => {
    const syncBanner = () => {
      setAdminBannerUrl(readAdminSettings().heroBannerUrl || '/assets/geometric-emerald.jpg');
    };
    window.addEventListener(ADMIN_SETTINGS_EVENT, syncBanner);
    return () => window.removeEventListener(ADMIN_SETTINGS_EVENT, syncBanner);
  }, []);
  const topic = TOPICS.find(item => item.id === topicId);
  const today = useMemo(() => verseOfTheDay(new Date()), []);
  const savedRef = useRef<HTMLElement>(null);
  const q = query.trim().toLowerCase();
  const topics = TOPICS.filter(item => !q || item.title[lang].toLowerCase().includes(q) || item.refs.some(ref => ref.includes(q)));
  const current = surahs.data?.find(item => item.number === surah);

  useEffect(() => {
    if (sub !== 'saved') return;
    savedRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }, [sub]);

  const cards = [
    { href: '#/quran', title: t.cardQuran, body: t.cardQuranBody, icon: <StudioMark name="quran" className="h-11 w-11 rounded-xl" /> },
    { href: '#/hadith', title: t.cardHadith, body: t.cardHadithBody, icon: <StudioMark name="hadith" className="h-11 w-11 rounded-xl" /> },
    { href: '#/spiritual', title: t.cardPillars, body: t.cardPillarsBody, icon: <StudioMark name="worship" className="h-11 w-11 rounded-xl" /> },
    { href: '#/podcast', title: t.cardPodcast, body: t.cardPodcastBody, icon: <StudioMark name="podcast" className="h-11 w-11 rounded-xl" /> },
  ].filter(card => !q || card.title.toLowerCase().includes(q) || card.body.toLowerCase().includes(q));

  async function research(event: FormEvent, clarified = false) {
    event.preventDefault();
    const question = readerQuestion(asked);
    if (asked.trim().length < 3 || busy) return;
    setBusy(true);
    setAskError(null);
    try {
      const started = await beginResearch({ question, entry: 'knowledge', desk: 'knowledge', lang, clarified });
      if (started.action === 'clarify' || !started.id || !started.scope) {
        window.location.hash = `#/hub/research?lang=${encodeURIComponent(lang)}&q=${encodeURIComponent(question)}`;
        return;
      }
      window.location.hash = researchHref(started.scope, started.id, lang, started.action === 'forward', null, question);
    } catch {
      window.location.hash = `#/hub/research?lang=${encodeURIComponent(lang)}&q=${encodeURIComponent(question)}`;
    } finally {
      setBusy(false);
    }
  }

  if (sub === 'saved') return <SavedLibraryView />;
  if (sub === 'item' && /^\d{1,12}$/.test(segments[1] ?? '')) {
    return <LibraryReader itemId={Number(segments[1])} backHref="#/hub" />;
  }
  if ((sub === 'discover' || sub === 'deepen' || sub === 'prophet') && segments[1] === 'item' && /^\d{1,12}$/.test(segments[2] ?? '')) {
    return <LibraryReader itemId={Number(segments[2])} backHref={`#/hub/${sub}`} />;
  }
  if (sub === 'discover' || sub === 'deepen' || sub === 'prophet') return <KnowledgeShelf pathId={sub} />;
  if (sub === 'wall') return <FaithWallFeed />;

  return (
    <div className="space-y-4">
      <section
        data-knowledge-banner
        style={{ color: '#FFFFFF' }}
        className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-r from-[#041B14] via-[#0A2E23] to-[#041B14] text-[#FFFFFF] shadow-[0_0_25px_rgba(212,175,55,0.08)]"
      >
        <img
          src={adminBannerUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-15 mix-blend-overlay"
        />
        <div className="relative flex min-h-[116px] flex-col justify-between gap-3 px-4 py-3.5 sm:max-h-[128px] sm:flex-row sm:items-center sm:px-6 sm:py-4">
          <div className="min-w-0 max-w-xl text-left">
            <p style={{ color: '#E6C665' }} className="text-[11px] font-semibold tracking-widest text-[#E6C665]">
              ✦ INSTITUTIONAL RESEARCH STUDIO
            </p>
            <h1 style={{ color: '#FFFFFF' }} className="mt-1 font-serif text-lg font-bold tracking-tight text-[#FFFFFF] sm:text-xl">
              Explore Deep Foundations, Sources & Evidence
            </h1>
            <p style={{ color: '#D6D3D1' }} className="mt-0.5 text-xs leading-snug text-stone-300">
              Multidisciplinary AI synthesis across classical Tafsir, Kutub al-Sittah, Fiqh, and verified chains.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start sm:items-end sm:text-right">
            <p
              dir="rtl"
              lang="ar"
              style={{ color: '#F9E7B9' }}
              className="font-serif text-xl font-medium leading-snug text-[#F9E7B9] drop-shadow-sm sm:text-2xl"
            >
              طَلَبُ الْعِلْمِ فَرِيضَةٌ
            </p>
            <p style={{ color: '#D6D3D1' }} className="mt-0.5 text-[11px] text-stone-300">
              “Seeking knowledge is an obligation”
            </p>
          </div>
        </div>
      </section>
      <div data-research-frame>
        <div data-research-inputs>
          <DomainResearchForm
            desk="knowledge"
            variant="omni"
            question={asked}
            running={busy}
            clarify={clarify}
            clarifyText={t.clarifyMeaning}
            onQuestion={setAsked}
            onSubmit={event => void research(event, clarify)}
          />
          {askError && <div className="mt-2"><ErrorNote message={askError} /></div>}
        </div>
      </div>

      <PrayerStrip />

      <section className="space-y-2.5">
        <SectionTitle sub={t.pathNote}>{t.pathsTitle}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <FeatureCard href="#/hub/discover" title={t.discoverTitle} body={t.discoverBody} icon={<StudioMark name="discover" className="h-9 w-9 rounded-xl" />} />
          <FeatureCard href="#/hub/deepen" title={t.deepenTitle} body={t.deepenBody} icon={<StudioMark name="deepen" className="h-9 w-9 rounded-xl" />} />
          <FeatureCard href="#/hub/prophet" title={t.prophetTitle} body={t.prophetBody} icon={<StudioMark name="prophet" className="h-9 w-9 rounded-xl" />} />
        </div>
      </section>

      <section data-testid="modern-world-hub-track" className="space-y-2.5">
        <SectionTitle sub="Preloaded deep-research dossiers for the Institutional Research Studio">
          Qur&apos;an &amp; The Modern World
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODERN_WORLD_BENCHMARKS.map(card => (
            <button
              key={card.id}
              type="button"
              disabled={busy}
              data-testid={`modern-world-card-${card.id}`}
              onClick={() => {
                setAsked(card.question);
                void (async () => {
                  setBusy(true);
                  setAskError(null);
                  try {
                    const started = await beginResearch({
                      question: card.question,
                      entry: 'knowledge',
                      desk: card.desk,
                      lang,
                      clarified: true,
                    });
                    if (started.action === 'clarify' || !started.id || !started.scope) {
                      window.location.hash = `#/hub/research?lang=${encodeURIComponent(lang)}&q=${encodeURIComponent(card.question)}`;
                      return;
                    }
                    window.location.hash = researchHref(started.scope, started.id, lang, started.action === 'forward', null, card.question);
                  } catch {
                    window.location.hash = `#/hub/research?lang=${encodeURIComponent(lang)}&q=${encodeURIComponent(card.question)}`;
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              className="rounded-2xl border border-[#D4AF37]/40 bg-gradient-to-br from-[#F7F1E4] via-[#F4EFE4] to-[#E8F2EC] p-4 text-left shadow-[0_0_18px_rgba(7,60,48,0.06)] transition hover:border-[#073C30]/50 hover:shadow-[0_0_22px_rgba(212,175,55,0.18)] disabled:opacity-60"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0B4B3A]">Benchmark dossier</p>
              <h3 className="mt-1 font-serif text-base font-bold text-[#073C30]">{card.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#3F3F46]">{card.blurb}</p>
              <span className="mt-3 inline-flex rounded-full bg-[#073C30] px-3 py-1 text-[11px] font-bold text-[#F9E7B9]">
                Open deep research
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card>
          <SectionTitle>{t.continueReading}</SectionTitle>
          <p className="font-display text-sm font-bold text-pine sm:text-base">{current ? current.englishName : `${displaySurah(surah)}`}</p>
          {current && (
            <p className="mt-0.5 text-xs text-muted">
              {displaySurah(surah)}:{displayAyah(place.ayah)} · {current.englishNameTranslation} · {current.numberOfAyahs}
            </p>
          )}
          <a href="#/quran/study" className="mt-2.5 inline-flex items-center rounded-full bg-moss px-3 py-1 text-xs font-medium text-white">
            {t.continueReading}
          </a>
        </Card>

        <Card>
          <SectionTitle>{t.verseOfDay}</SectionTitle>
          <VerseList refs={[today]} />
        </Card>
      </div>

      <FaithWallFeed compact />

      <AskPanel />
      <ScholarDraft focus={sub === 'scholar'} />

      <Card>
        {topic ? (
          <>
            <Button variant="ghost" onClick={() => setTopicId(null)} className="-ml-3 mb-2">
              <ArrowLeft className="h-4 w-4" aria-hidden /> {t.back}
            </Button>
            <SectionTitle>{topic.title[lang]}</SectionTitle>
            <VerseList refs={topic.refs} />
          </>
        ) : (
          <>
            <SectionTitle>{t.themes}</SectionTitle>
            {topics.length === 0 ? (
              <EmptyState>{t.noResults}</EmptyState>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-theme-plates>
                {topics.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTopicId(item.id)}
                    className="theme-plate relative min-h-[6.5rem] overflow-hidden rounded-2xl border border-[#1F6B52]/30 bg-[#F7F1E4] p-3.5 text-left sm:p-4"
                  >
                    <img
                      src="/assets/geometric-cream.jpg"
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover object-[8%_100%]"
                    />
                    <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(247,241,228,0.96)_0%,rgba(247,241,228,0.9)_46%,rgba(247,241,228,0.55)_78%,rgba(247,241,228,0.28)_100%)]" />
                    <span className="theme-plate-sheen" aria-hidden="true" />
                    <span lang={lang} className="relative z-10 block pr-6 font-semibold leading-snug text-pine">
                      {item.title[lang]}
                    </span>
                    <span className="relative z-10 mt-1 block pr-8 text-xs leading-relaxed text-muted">{item.refs.join(' · ')}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <section ref={savedRef} id="saved" className="scroll-mt-28">
        <SavedLibraryView />
      </section>
    </div>
  );
}

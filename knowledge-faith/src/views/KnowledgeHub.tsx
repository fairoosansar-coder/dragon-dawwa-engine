import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, BookOpen, Check, Copy, Library, MoonStar, Search, Sparkles } from 'lucide-react';
import type { ViewProps } from '../App.tsx';
import { TOPICS, verseOfTheDay } from '../shared/topics.ts';
import type { AskResult, Hadith, SurahInfo, Verse } from '../shared/types.ts';
import { postJson, useRemote } from '../lib/api.ts';
import { useShell } from '../lib/shell.tsx';
import { displayAyah, displaySurah, useReadingPlace } from '../lib/readingPlace.ts';
import { useQuranEdition } from '../lib/quranEdition.ts';
import { usePronunciation, withPronunciation } from '../lib/pronunciation.ts';
import { shownVerses, translationRequest } from '../shared/quranenc.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { CitationChips, EvidenceList, HadithCard, VerseCard } from '../components/cards.tsx';
import { KnowledgeShelf } from './KnowledgePaths.tsx';
import { EmptyState, FeatureCard, PrayerStrip } from '../components/shell/widgets.tsx';
import { Button, Card, ErrorNote, Loading, Notice, SectionTitle } from '../components/ui.tsx';

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
  const { t } = useApp();
  const [draft, setDraft] = useStored<string>('kf-scholar-draft', '');
  const [copied, setCopied] = useState(false);
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

export default function KnowledgeHub({ sub }: ViewProps) {
  const { t, lang, saved } = useApp();
  const { query } = useShell();
  const [place] = useReadingPlace();
  const surah = place.surah;
  const surahs = useRemote<SurahInfo[]>('/api/quran/surahs');
  const [topicId, setTopicId] = useState<string | null>(null);
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
    { href: '#/quran', title: t.cardQuran, body: t.cardQuranBody, icon: <BookOpen className="h-5 w-5" aria-hidden /> },
    { href: '#/hadith', title: t.cardHadith, body: t.cardHadithBody, icon: <Library className="h-5 w-5" aria-hidden /> },
    { href: '#/spiritual', title: t.cardPillars, body: t.cardPillarsBody, icon: <MoonStar className="h-5 w-5" aria-hidden /> },
    { href: '#/studio', title: t.cardListen, body: t.cardListenBody, icon: <Sparkles className="h-5 w-5" aria-hidden /> },
  ].filter(card => !q || card.title.toLowerCase().includes(q) || card.body.toLowerCase().includes(q));

  if (sub === 'discover' || sub === 'deepen' || sub === 'prophet') return <KnowledgeShelf pathId={sub} />;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{t.hubEyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight text-pine sm:text-5xl">{t.hubHeading}</h1>
      </header>

      <section className="rounded-3xl bg-pine px-6 py-8 text-sand sm:px-8">
        <h3 className="max-w-xl font-display text-3xl font-bold leading-tight">{t.hubHero}</h3>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-sand/85">{t.hubHeroBody}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#/quran" className="inline-flex items-center rounded-full bg-moss px-4 py-2 text-sm font-medium text-white">
            {t.openQuran}
          </a>
          <a href="#/hub/saved" className="inline-flex items-center rounded-full border border-gold px-4 py-2 text-sm font-medium text-sand lg:hidden">
            {t.sidebarSaved}
          </a>
          <a href="#/studio" className="inline-flex items-center rounded-full border border-gold px-4 py-2 text-sm font-medium text-sand">
            {t.listen}
          </a>
        </div>
      </section>

      <PrayerStrip />

      <section className="space-y-3">
        <SectionTitle sub={t.pathNote}>{t.pathsTitle}</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCard href="#/hub/discover" title={t.discoverTitle} body={t.pathCatalogue} icon={<BookOpen className="h-5 w-5" aria-hidden />} />
          <FeatureCard href="#/hub/deepen" title={t.deepenTitle} body={t.pathCatalogue} icon={<Library className="h-5 w-5" aria-hidden />} />
          <FeatureCard href="#/hub/prophet" title={t.prophetTitle} body={t.pathCatalogue} icon={<MoonStar className="h-5 w-5" aria-hidden />} />
        </div>
      </section>

      {cards.length === 0 ? (
        <EmptyState>{t.noResults}</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(card => (
            <FeatureCard key={card.href} href={card.href} title={card.title} body={card.body} icon={card.icon} />
          ))}
        </div>
      )}

      <Card>
        <SectionTitle>{t.continueReading}</SectionTitle>
        <p className="font-display text-2xl font-bold text-pine">{current ? current.englishName : `${displaySurah(surah)}`}</p>
        {current && (
          <p className="mt-1 text-sm text-muted">
            {displaySurah(surah)}:{displayAyah(place.ayah)} · {current.englishNameTranslation} · {current.numberOfAyahs}
          </p>
        )}
        <a href="#/quran/study" className="mt-4 inline-flex items-center rounded-full bg-moss px-4 py-2 text-sm font-medium text-white">
          {t.continueReading}
        </a>
      </Card>

      <Card>
        <SectionTitle>{t.verseOfDay}</SectionTitle>
        <VerseList refs={[today]} />
      </Card>

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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {topics.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTopicId(item.id)}
                    className="rounded-2xl border border-pine/15 bg-sand p-4 text-left transition hover:border-gold"
                  >
                    <span className="block font-semibold text-pine">{item.title[lang]}</span>
                    <span className="mt-1 block text-xs text-muted">{item.refs.join(' · ')}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <section ref={savedRef} id="saved" className="scroll-mt-28">
        <Card>
          <SectionTitle>{t.saved}</SectionTitle>
          {saved.verses.length === 0 && saved.hadith.length === 0 ? (
            <EmptyState>{t.savedEmpty}</EmptyState>
          ) : (
            <>
              <VerseList refs={saved.verses.slice(0, 60)} />
              {saved.hadith.map(item => (
                <SavedHadith key={`${item.collection}-${item.number}`} collection={item.collection} number={item.number} />
              ))}
            </>
          )}
        </Card>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, BookOpen, Check, Copy, MoonStar, Radio, Search, ShieldCheck, Sparkles } from 'lucide-react';
import type { ViewProps } from '../App.tsx';
import { TOPICS, verseOfTheDay } from '../shared/topics.ts';
import type { AskResult, Hadith, Verse } from '../shared/types.ts';
import { postJson, useRemote } from '../lib/api.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { CitationChips, EvidenceList, HadithCard, VerseCard } from '../components/cards.tsx';
import { Button, Card, ErrorNote, Loading, Notice, SectionTitle } from '../components/ui.tsx';

function VerseList({ refs }: { refs: string[] }) {
  const { lang } = useApp();
  const url = refs.length ? `/api/quran/verses?refs=${encodeURIComponent(refs.join(','))}&lang=${lang}` : null;
  const { data, error, loading, reload } = useRemote<Verse[]>(url);
  if (loading) return <Loading />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  return <div>{data?.map(v => <VerseCard key={v.key} verse={v} compact />)}</div>;
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
            <p className="mb-3 flex items-center gap-2 text-xs font-medium text-gold">
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
    if (focus) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          {copied ? t.scholarCopied : t.scholarCopy}
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

function Shortcuts() {
  const { t } = useApp();
  const items = [
    { href: '#/quran/study', icon: BookOpen, label: t.quranStudy, hint: t.navQuran },
    { href: '#/hadith/research', icon: ShieldCheck, label: t.researchHadith, hint: t.navHadith },
    { href: '#/spiritual', icon: MoonStar, label: t.navSpiritual, hint: t.spiritualHint },
    { href: '#/studio/roundtable', icon: Radio, label: t.roundtable, hint: t.navStudio },
  ];
  return (
    <nav aria-label={t.shortcuts} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(item => (
        <a
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 rounded-2xl border border-pine/10 bg-parchment p-4 transition hover:border-pine/40 hover:shadow"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-pine">
            <item.icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-pine">{item.label}</span>
            <span className="block text-xs text-ink/50">{item.hint}</span>
          </span>
        </a>
      ))}
    </nav>
  );
}

export default function KnowledgeHub({ sub }: ViewProps) {
  const { t, lang, saved } = useApp();
  const [topicId, setTopicId] = useState<string | null>(null);
  const topic = TOPICS.find(x => x.id === topicId);
  const today = useMemo(() => verseOfTheDay(new Date()), []);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-3xl bg-pine p-6 text-white sm:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-mint/80">Knowledge &amp; Faith</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">{t.tagline}</h1>
          <p className="mt-4 text-sm text-mint/80">{t.sourcesNote}</p>
        </div>
        <Card>
          <SectionTitle>{t.verseOfDay}</SectionTitle>
          <VerseList refs={[today]} />
        </Card>
      </div>

      <Shortcuts />

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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TOPICS.map(x => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setTopicId(x.id)}
                  className="rounded-2xl border border-pine/15 bg-white p-4 text-left transition hover:border-pine/40 hover:shadow"
                >
                  <span className="block font-semibold text-pine">{x.title[lang]}</span>
                  <span className="mt-1 block text-xs text-ink/50">{x.refs.join(' · ')}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>{t.saved}</SectionTitle>
        {saved.verses.length === 0 && saved.hadith.length === 0 ? (
          <p className="text-sm text-ink/60">{t.savedEmpty}</p>
        ) : (
          <>
            <VerseList refs={saved.verses.slice(0, 60)} />
            {saved.hadith.map(h => (
              <SavedHadith key={`${h.collection}-${h.number}`} collection={h.collection} number={h.number} />
            ))}
          </>
        )}
      </Card>
    </div>
  );
}

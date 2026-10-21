import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { postJson, useRemote } from '../lib/api.ts';
import { useQuranEdition } from '../lib/quranEdition.ts';
import { usePronunciation, withPronunciation } from '../lib/pronunciation.ts';
import { shownVerses, translationRequest } from '../shared/quranenc.ts';
import { useStored } from '../lib/store.tsx';
import type { AskResult, Verse } from '../shared/types.ts';
import { CitationChips, EvidenceList } from '../components/cards.tsx';
import { VerseCard } from '../components/cards.tsx';
import { DHIKR, DUA_CATEGORIES, DUA_ENTRIES, PRAYER_TOPICS, text } from './content.ts';
import { Banner, PageBack, Panel, control, useSp } from './chrome.tsx';
import { useBookmarks, useGuideProgress } from './GuideView.tsx';
import { GUIDES } from './content.ts';

export function TopicsIndex({ segments }: { segments: string[] }) {
  const { lang, s } = useSp();
  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <h1 className="font-display text-3xl font-bold text-dd-emerald">{s.topics}</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PRAYER_TOPICS.map(topic => (
          <li key={topic.id}>
            <a className="block min-h-16 rounded-2xl bg-white p-4 text-dd-emerald shadow-sm" href={`#/spiritual/salah/topics/${topic.id}`}>
              {text(topic.title, lang)}
              {topic.refs.length === 0 ? <span className="mt-1 block text-xs text-dd-ink/60">{s.withheld}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Checklist({ segments, kind }: { segments: string[]; kind: 'hajj' | 'umrah' }) {
  const { s } = useSp();
  const defaults = kind === 'hajj'
    ? ['Ask the group about walking distance, rest, and wheelchair access', 'List medicines with your own clinician', 'Keep copies of bookings you already hold', 'Write an emergency contact']
    : ['Confirm this trip is Umrah, not Hajj', 'Ask the group about walking distance and rest', 'Keep copies of bookings you already hold', 'Write an emergency contact'];
  const [items, setItems] = useStored<{ id: string; text: string; done: boolean }[]>(`kf-checklist-${kind}`, defaults.map(text => ({ id: text, text, done: false })));
  const [extra, setExtra] = useState('');
  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <h1 className="font-display text-3xl font-bold text-dd-emerald">{s.checklist}</h1>
        <Banner>{s.noVisa}</Banner>
        <p className="mt-3">{s.ritual}</p>
        <ul className="mt-4 space-y-2">
          {items.map(item => (
            <li key={item.id}>
              <label className="flex min-h-11 items-start gap-3">
                <input type="checkbox" checked={item.done} onChange={() => setItems(list => list.map(row => (row.id === item.id ? { ...row, done: !row.done } : row)))} />
                <span>{item.text}</span>
              </label>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={event => {
            event.preventDefault();
            if (!extra.trim()) return;
            setItems(list => [...list, { id: crypto.randomUUID(), text: extra.trim().slice(0, 160), done: false }]);
            setExtra('');
          }}
        >
          <input className={`${control} min-w-0 flex-1`} value={extra} onChange={event => setExtra(event.target.value)} />
          <button className="min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory" type="submit">
            {s.addRow}
          </button>
        </form>
      </Panel>
    </div>
  );
}

export function DuaLibrary({ segments }: { segments: string[] }) {
  const { lang, s } = useSp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [count, setCount] = useStored<number>('kf-tasbih', 0);
  const [target, setTarget] = useStored<number>('kf-tasbih-target', 33);
  const [phrase, setPhrase] = useStored<number>('kf-tasbih-phrase', 0);
  const entries = DUA_ENTRIES.filter(entry => (category === 'all' || entry.category === category) && (!query.trim() || entry.id.includes(query.trim()) || entry.category.includes(query.trim().toLowerCase())));
  const [pronunciation] = usePronunciation();
  const quranEdition = useQuranEdition();
  const refs = entries.flatMap(entry => entry.refs);
  const request = translationRequest(
    refs.length ? `/api/quran/verses?refs=${encodeURIComponent(refs.join(','))}&lang=${lang}` : null,
    lang,
    lang,
    quranEdition.edition,
    quranEdition.loading,
  );
  const remote = useRemote<Verse[]>(request ? withPronunciation(request.url, pronunciation) : null);
  const verses = remote.loading || quranEdition.loading ? null : shownVerses(remote.data, lang, request?.editionKey ?? null);
  const current = DHIKR[phrase] ?? DHIKR[0];
  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <h1 className="font-display text-3xl font-bold text-dd-emerald">{s.quranKind}</h1>
        <p className="mt-2 text-sm">{s.propheticMissing}</p>
        <p className="text-sm">{s.generalKind}</p>
        <p className="text-sm">{s.audioNotSpoken}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={`min-h-11 rounded-full px-3 ${category === 'all' ? 'bg-dd-emerald text-dd-ivory' : 'bg-white'}`} onClick={() => setCategory('all')}>
            {s.tools}
          </button>
          {DUA_CATEGORIES.map(item => (
            <button key={item} type="button" className={`min-h-11 rounded-full px-3 ${category === item ? 'bg-dd-emerald text-dd-ivory' : 'bg-white'}`} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
        <input className={`${control} mt-3 w-full`} value={query} placeholder={s.search} onChange={event => setQuery(event.target.value)} />
        {entries.length === 0 && <p className="mt-4">{s.dhikrEmpty}</p>}
        {(remote.loading || quranEdition.loading) && <p>{s.loading}</p>}
        {quranEdition.error && <p>{quranEdition.error}</p>}
        {remote.error && <p>{remote.error}</p>}
        {verses?.map(verse => (
          <article key={verse.key}>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-dd-lapis">{s.quranKind}</p>
            <VerseCard verse={verse} />
          </article>
        ))}
      </Panel>
      <Panel>
        <h2 className="font-display text-2xl font-bold text-dd-emerald">{s.counter}</h2>
        <p className="text-sm">{s.counterHint}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DHIKR.map((item, index) => (
            <button key={item.arabic} type="button" lang="ar" className={`min-h-11 rounded-full px-3 text-lg ${phrase === index ? 'bg-dd-emerald text-dd-ivory' : 'bg-white'}`} onClick={() => setPhrase(index)}>
              {item.arabic}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm">{text(current.meaning, lang)}</p>
        <button type="button" className="mx-auto mt-4 flex h-40 w-40 flex-col items-center justify-center rounded-full bg-dd-emerald text-dd-ivory" onClick={() => setCount(value => value + 1)}>
          <span lang="ar">{current.arabic}</span>
          <span className="text-4xl font-bold tabular-nums">{count}</span>
          <span className="text-xs">/ {target}</span>
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm">
            {s.counter}
            <select className={`${control} ml-2`} value={String(target)} onChange={event => setTarget(Number(event.target.value))}>
              {[33, 99, 100].map(value => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => setCount(0)}>
            {s.reset}
          </button>
        </div>
      </Panel>
    </div>
  );
}

export function Questions({ segments }: { segments: string[] }) {
  const { s, lang, config } = useSp();
  const [draft, setDraft] = useStored<string>('kf-scholar-draft', '');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.trim());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([`${s.notSent}\n\n${draft.trim()}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'scholar-question-draft.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      setResult(await postJson<AskResult>('/api/ask', { question: draft.slice(0, 500), lang }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <h1 className="font-display text-3xl font-bold text-dd-emerald">{s.questions}</h1>
        <Banner>{s.notSent}</Banner>
        <label className="mt-4 block">
          {s.question}
          <textarea className={`${control} mt-1 w-full`} rows={8} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory" onClick={() => void copy()} disabled={!draft.trim()}>
            {copied ? <Check className="inline h-4 w-4" aria-hidden /> : <Copy className="inline h-4 w-4" aria-hidden />} {copied ? s.copied : s.copyRef}
          </button>
          <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={download} disabled={!draft.trim()}>
            {s.download}
          </button>
        </div>
      </Panel>
      <Panel>
        <h2 className="font-display text-2xl font-bold text-dd-emerald">{s.study}</h2>
        <p className="mt-2 text-sm">{s.studyHint}</p>
        {config && !config.ai && <Banner>{s.studyOff}</Banner>}
        <button type="button" className="mt-3 min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory disabled:opacity-50" disabled={!draft.trim() || busy || config?.ai === false} onClick={() => void ask()}>
          {busy ? s.loading : s.ask}
        </button>
        {error && <p className="mt-2 text-sm">{error}</p>}
        {result && (
          <div className="mt-4 space-y-3">
            {result.insufficientEvidence && <Banner>{s.studyHint}</Banner>}
            {result.paragraphs.map((paragraph, index) => (
              <p key={index}>
                {paragraph.text}
                <CitationChips ids={paragraph.citations} />
              </p>
            ))}
            {result.evidence.length > 0 && <EvidenceList evidence={result.evidence} cited={new Set(result.paragraphs.flatMap(item => item.citations))} />}
            <button
              type="button"
              className="min-h-11 rounded-full bg-white px-4"
              onClick={() => setDraft(value => `${value.trim()}\n\n${result.evidence.map(item => item.label).join('\n')}`.trim())}
            >
              {s.append}
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function SavedView({ segments }: { segments: string[] }) {
  const { lang, s } = useSp();
  const [bookmarks, setBookmarks] = useBookmarks();
  const [progress] = useGuideProgress();
  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <h1 className="font-display text-3xl font-bold text-dd-emerald">{s.saved}</h1>
        <p className="text-sm">{s.progressNote}</p>
        {!bookmarks.length && <p className="mt-4">{s.savedEmpty}</p>}
        <ul className="mt-3 space-y-2">
          {bookmarks.map(item => {
            const guide = GUIDES.find(entry => entry.id === item.guideId);
            const href = guide ? `#/spiritual/${guide.path.join('/')}` : '#/spiritual';
            return (
              <li key={`${item.guideId}-${item.section}`} className="flex items-center justify-between gap-3">
                <a className="underline" href={href}>
                  {guide ? text(guide.title, lang) : item.guideId}
                </a>
                <button type="button" className="min-h-11 text-sm" onClick={() => setBookmarks(list => list.filter(row => row.guideId !== item.guideId))}>
                  {s.remove}
                </button>
              </li>
            );
          })}
        </ul>
        <h2 className="mt-6 font-semibold">{s.progressOpened}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {progress.map(item => (
            <li key={`${item.guideId}-${item.section}`}>{GUIDES.find(entry => entry.id === item.guideId) ? text(GUIDES.find(entry => entry.id === item.guideId)!.title, lang) : item.guideId}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

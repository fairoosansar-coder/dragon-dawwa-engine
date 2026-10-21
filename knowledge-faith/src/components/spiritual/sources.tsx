import { createContext, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Pause, Play } from 'lucide-react';
import { HADITH_COLLECTIONS, recitationUrl, RECITERS, type Lang } from '../../shared/sources.ts';
import type { ResolvedSource } from '../../shared/spiritual/registry.ts';
import { sourceId, type SourceRef } from '../../shared/spiritual/sourceRefs.ts';
import { getJson } from '../../lib/api.ts';
import { pauseAudio, playAudio, useAudioState } from '../../lib/audio.ts';
import { useReciter } from '../cards.tsx';
import { fmt } from '../../lib/i18nSpiritual.ts';
import { useSp } from '../../lib/spiritualStore.ts';

const BATCH = 24;
const cache = new Map<string, Promise<ResolvedSource[]>>();

function fetchBatch(ids: string[], lang: Lang): Promise<ResolvedSource[]> {
  const key = `${lang}|${ids.join(',')}`;
  let p = cache.get(key);
  if (!p) {
    p = getJson<ResolvedSource[]>(`/api/spiritual/sources?lang=${lang}&ids=${encodeURIComponent(ids.join(','))}`);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export function useSources(refs: readonly SourceRef[], lang: Lang) {
  const ids = useMemo(() => [...new Set(refs.map(sourceId))], [refs]);
  const idKey = ids.join(',');
  const [state, setState] = useState<{ data: Map<string, ResolvedSource> | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: ids.length > 0,
  });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!ids.length) {
      setState({ data: new Map(), error: null, loading: false });
      return;
    }
    let live = true;
    setState(s => ({ ...s, loading: true, error: null }));
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
    Promise.all(batches.map(b => fetchBatch(b, lang)))
      .then(all => live && setState({ data: new Map(all.flat().map(s => [s.id, s])), error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, lang, nonce]);
  return { ...state, reload: () => setNonce(n => n + 1) };
}

/* ---------- In-article search highlighting ---------- */

const HighlightContext = createContext('');

export function HighlightProvider({ query, children }: { query: string; children: ReactNode }) {
  return <HighlightContext.Provider value={query.trim()}>{children}</HighlightContext.Provider>;
}

export function Highlight({ text }: { text: string }) {
  const query = useContext(HighlightContext);
  if (!query || query.length < 2) return <>{text}</>;
  const lower = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  const parts: ReactNode[] = [];
  let at = 0;
  let i = lower.indexOf(needle);
  while (i !== -1) {
    if (i > at) parts.push(text.slice(at, i));
    parts.push(
      <mark key={i} data-sp-match="">
        {text.slice(i, i + needle.length)}
      </mark>,
    );
    at = i + needle.length;
    i = lower.indexOf(needle, at);
  }
  parts.push(text.slice(at));
  return (
    <>
      {parts.map((p, k) => (
        <Fragment key={k}>{p}</Fragment>
      ))}
    </>
  );
}

/* ---------- Source display ---------- */

export function sourceLabel(ref: SourceRef, s: ReturnType<typeof useSp>['s']): string {
  if (ref.kind === 'quran') return fmt(s.quranRef, { ref: ref.ref });
  const name = HADITH_COLLECTIONS.find(c => c.id === ref.collection)?.name ?? ref.collection;
  return ref.conventional ? `${name} ${ref.conventional.number}` : `${name} ${ref.number}`;
}

function RecitationButton({ number, label }: { number: number; label: string }) {
  const { s } = useSp();
  const [reciter] = useReciter();
  const audio = useAudioState();
  const id = `ayah-${number}`;
  const active = audio.id === id && audio.playing;
  const name = RECITERS.find(r => r.id === reciter)?.name ?? RECITERS[0].name;
  return (
    <button
      type="button"
      onClick={() => (active ? pauseAudio() : void playAudio(id, recitationUrl(reciter, number)))}
      className="sp-no-print inline-flex items-center gap-1.5 rounded-full bg-emerald/8 px-3 py-1 text-xs font-medium text-emerald ring-1 ring-emerald/15 hover:bg-emerald/12"
      aria-label={`${active ? s.pauseRecitation : s.playRecitation}: ${label}`}
    >
      {active ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
      {fmt(s.recitationBy, { name })}
    </button>
  );
}

export function SourceBlock({ source, refDef, compact = false }: { source?: ResolvedSource; refDef: SourceRef; compact?: boolean }) {
  const { s, lang } = useSp();
  const [showArabic, setShowArabic] = useState(refDef.kind === 'quran');
  const label = sourceLabel(refDef, s);
  const langName = (l: Lang) => s[`langName_${l}`];

  if (!source || source.unavailable) {
    return (
      <article className="rounded-2xl border border-emerald/10 bg-white/60 p-4">
        <p className="text-sm font-semibold text-emerald">{label}</p>
        <p className="mt-1 text-sm text-ink/60">{s.unavailableSource}</p>
      </article>
    );
  }

  if (source.verses) {
    const first = source.verses[0];
    return (
      <article className="rounded-2xl border border-emerald/10 bg-white/70 p-4 sm:p-5" aria-label={label}>
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-emerald">
            {label} <span className="font-normal text-ink/60">· {first.surahName}</span>
          </p>
          <a href={`#/quran`} className="sp-no-print inline-flex items-center gap-1 text-xs text-lapis underline-offset-2 hover:underline">
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> {s.openInQuran}
          </a>
        </header>
        <div className="space-y-4">
          {source.verses.map(v => (
            <div key={v.key}>
              <p lang="ar" dir="rtl" className={`arabic text-ink ${compact ? 'text-2xl' : 'text-[1.75rem]'}`}>
                {v.arabic} <span className="text-base text-gilt-deep">﴿{v.ayah}﴾</span>
              </p>
              <p lang={v.lang} className="mt-1 leading-relaxed">
                <Highlight text={v.translation} />
              </p>
              <div className="mt-2">
                <RecitationButton number={v.number} label={`${s.quranRef.replace('{ref}', v.key)}`} />
              </div>
            </div>
          ))}
        </div>
        <footer className="mt-3 text-xs text-ink/60">
          {fmt(s.translationBy, { name: first.translator })}
          {first.lang !== lang && <span className="ml-1">· {fmt(s.fallbackLang, { lang: langName(lang), shown: langName(first.lang) })}</span>}
        </footer>
      </article>
    );
  }

  const hd = source.hadith!;
  const hRef = refDef.kind === 'hadith' ? refDef : null;
  return (
    <article className="rounded-2xl border border-emerald/10 bg-white/70 p-4 sm:p-5" aria-label={label}>
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-emerald">{label}</p>
        <p className="text-xs text-ink/55">
          {hRef?.conventional
            ? `${fmt(s.numbering, { system: hRef.conventional.system, n: hRef.conventional.number })} · ${fmt(s.apiNumbering, { n: hd.number })}`
            : fmt(s.apiNumbering, { n: hd.number })}
        </p>
      </header>
      {source.fallback && (
        <p className="mb-2 rounded-xl bg-vellum px-3 py-2 text-xs text-ink/75">{fmt(s.fallbackLang, { lang: langName(lang), shown: langName(hd.lang) })}</p>
      )}
      <p lang={hd.lang} className="leading-relaxed">
        <Highlight text={hd.text} />
      </p>
      {hd.arabic && (
        <div className="mt-2">
          <button
            type="button"
            className="sp-no-print inline-flex items-center gap-1 text-xs font-medium text-lapis"
            aria-expanded={showArabic}
            onClick={() => setShowArabic(v => !v)}
          >
            {showArabic ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />} {s.arabicText}
          </button>
          {showArabic && (
            <p lang="ar" dir="rtl" className="arabic mt-2 text-xl text-ink">
              {hd.arabic}
            </p>
          )}
        </div>
      )}
      <footer className="mt-3 space-y-1.5 text-xs text-ink/60">
        <p>{fmt(s.translationBy, { name: hd.translation })}</p>
        {source.grades.length ? (
          <div>
            <p className="mb-1 font-medium text-ink/70">{s.grading}</p>
            <ul className="flex flex-wrap gap-1.5">
              {source.grades.map(g => (
                <li key={`${g.name}-${g.grade}`} className="rounded-full border border-emerald/15 px-2.5 py-0.5">
                  <span className="font-semibold text-emerald">{g.grade}</span> — {g.name}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>{s.noGrading}</p>
        )}
      </footer>
    </article>
  );
}

/** A list of primary texts, fetched in the reader's language. */
export function SourceList({ refs, compact }: { refs: readonly SourceRef[]; compact?: boolean }) {
  const { s, lang } = useSp();
  const { data, error, loading, reload } = useSources(refs, lang);
  if (!refs.length) return null;
  if (loading) return <p role="status" className="py-4 text-sm text-ink/60">{s.loading}</p>;
  if (error)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-900">
        <span className="flex-1">{error}</span>
        <button type="button" onClick={reload} className="rounded-full bg-white px-3 py-1 text-red-900 ring-1 ring-red-200">
          {s.retry}
        </button>
      </div>
    );
  const hasHadith = refs.some(r => r.kind === 'hadith');
  return (
    <div className="space-y-3">
      {refs.map(r => (
        <SourceBlock key={sourceId(r)} refDef={r} source={data?.get(sourceId(r))} compact={compact} />
      ))}
      {hasHadith && <p className="text-xs text-ink/55">{s.gradingNote}</p>}
    </div>
  );
}

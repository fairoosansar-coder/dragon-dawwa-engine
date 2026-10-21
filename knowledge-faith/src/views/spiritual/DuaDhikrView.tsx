import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bookmark, BookmarkCheck, Pin, PinOff, RotateCcw, Search, Trash2 } from 'lucide-react';
import { DUA_CATEGORIES, DUAS, findTopic, type DuaCategory, type DuaEntry } from '../../shared/spiritual/catalog.ts';
import { sourceId } from '../../shared/spiritual/sourceRefs.ts';
import type { ResolvedSource } from '../../shared/spiritual/registry.ts';
import { fmt, type SpKey } from '../../lib/i18nSpiritual.ts';
import { spHref, useGuideIndex } from '../../lib/spiritualFormat.ts';
import { newId, PREFIX, useBookmarks, useLocal, usePersonalDuas, useSp, useTodayPrefs } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Field, inputClass, Panel, PanelTitle, Pill, SectionBand, SpButton, StatusBadge } from '../../components/spiritual/ornaments.tsx';
import { HighlightProvider, SourceBlock, sourceLabel, useSources } from '../../components/spiritual/sources.tsx';

export const duaBookmark = (id: string) => `dua:${id}`;

interface Follow {
  duaId: string;
  step: number;
}

function searchText(source: ResolvedSource | undefined): string {
  if (!source) return '';
  if (source.verses) return source.verses.map(v => `${v.translation} ${v.arabic}`).join(' ');
  return `${source.hadith?.text ?? ''} ${source.hadith?.arabic ?? ''}`;
}

function Counter({ follow, setFollow }: { follow: Follow | null; setFollow: (f: Follow | null) => void }) {
  const { s } = useSp();
  const [count, setCount] = useLocal<number>('kf-tasbih', 0);
  const [target, setTarget] = useLocal<number>('kf-tasbih-target', 0);
  const entry = follow ? DUAS.find(d => d.id === follow.duaId) : undefined;
  const steps = entry?.count?.steps ?? [];
  const current = steps[follow?.step ?? 0];
  const complete = Boolean(entry && follow && follow.step >= steps.length);

  function tap() {
    if (current && follow) {
      const next = count + 1;
      if (next >= current.count) {
        setCount(0);
        setFollow({ ...follow, step: follow.step + 1 });
      } else setCount(next);
      return;
    }
    setCount(c => c + 1);
  }

  return (
    <Panel id="sp-counter">
      <PanelTitle as="h3">{s.dCounter}</PanelTitle>
      {entry ? (
        <div className="mb-4 rounded-2xl bg-ivory px-4 py-3 text-sm">
          <p className="text-xs font-semibold text-gilt-deep">{s.dSourcedCount}</p>
          <p className="text-xs text-ink/60">{fmt(s.dSourcedScope, { scope: s[entry.count!.scopeKey as SpKey], ref: sourceLabel(entry.source, s) })}</p>
          {!complete && current && (
            <>
              <p className="mt-2 text-xs text-ink/60">{fmt(s.dStep, { n: follow!.step + 1, total: steps.length })}</p>
              <p lang="ar" dir="rtl" className="arabic mt-1 text-2xl">
                {current.phrase}
              </p>
            </>
          )}
          <button type="button" className="mt-2 text-xs text-lapis underline" onClick={() => setFollow(null)}>
            {s.dPersonalTarget}
          </button>
        </div>
      ) : (
        <Field label={s.dPersonalTarget} hint={s.dPersonalTargetHint} htmlFor="sp-target">
          <select id="sp-target" className={`${inputClass} w-40`} value={target} onChange={e => setTarget(Number(e.target.value))}>
            <option value={0}>{s.dNoTarget}</option>
            {[10, 33, 34, 99, 100, 500, 1000].map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="mt-4 flex flex-col items-center gap-3">
        <p className="font-display text-6xl font-bold tabular-nums text-emerald" aria-live="polite">
          {complete ? '✓' : count}
          {!complete && (current ? <span className="text-2xl text-ink/40"> / {current.count}</span> : target > 0 && <span className="text-2xl text-ink/40"> / {target}</span>)}
        </p>
        {complete && <p className="font-semibold text-emerald">{s.dComplete}</p>}
        {!entry && target > 0 && count >= target && <p className="font-semibold text-emerald">{s.dComplete}</p>}
        <button
          type="button"
          disabled={complete}
          onClick={tap}
          className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald text-lg font-semibold text-ivory shadow-lg ring-4 ring-gilt/40 transition active:scale-95 disabled:opacity-40"
        >
          {s.dTap}
        </button>
        <SpButton
          variant="ghost"
          onClick={() => {
            setCount(0);
            if (follow) setFollow({ ...follow, step: 0 });
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> {s.dReset}
        </SpButton>
      </div>
    </Panel>
  );
}

function DuaCard({ entry, source, onFollow }: { entry: DuaEntry; source?: ResolvedSource; onFollow: () => void }) {
  const { s } = useSp();
  const [today, setToday] = useTodayPrefs();
  const [bookmarks, setBookmarks] = useBookmarks();
  const pinned = today.pinnedDua === entry.id;
  const saved = bookmarks.includes(duaBookmark(entry.id));
  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-emerald/10 px-2.5 py-0.5 font-semibold text-emerald">{s[`kind_${entry.kind}`]}</span>
        <span className="text-ink/60">{s[`dcat_${entry.category}`]}</span>
      </div>
      <SourceBlock refDef={entry.source} source={source} compact />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/55">
        <span>
          {s.dTranslit}: {s.dTranslitNone}
        </span>
        {entry.kind === 'prophetic' && <span>{s.dAudioNone}</span>}
      </div>
      {entry.count && (
        <div className="rounded-2xl bg-ivory px-4 py-3 text-sm">
          <p className="text-xs font-semibold text-gilt-deep">{s.dSourcedCount}</p>
          <p className="text-xs text-ink/60">{fmt(s.dSourcedScope, { scope: s[entry.count.scopeKey as SpKey], ref: sourceLabel(entry.source, s) })}</p>
          <ol className="mt-2 space-y-1">
            {entry.count.steps.map((st, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span lang="ar" dir="rtl" className="arabic text-lg">
                  {st.phrase}
                </span>
                <span className="font-semibold tabular-nums">× {st.count}</span>
              </li>
            ))}
          </ol>
          <SpButton variant="soft" className="mt-2" onClick={onFollow}>
            {s.dFollowCount}
          </SpButton>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <SpButton variant={pinned ? 'primary' : 'soft'} aria-pressed={pinned} onClick={() => setToday(t => ({ ...t, pinnedDua: pinned ? null : entry.id }))}>
          {pinned ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />} {pinned ? s.dPinned : s.dPin}
        </SpButton>
        <SpButton
          variant={saved ? 'primary' : 'soft'}
          aria-pressed={saved}
          onClick={() => setBookmarks(b => (saved ? b.filter(x => x !== duaBookmark(entry.id)) : [duaBookmark(entry.id), ...b]))}
        >
          {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />} {saved ? s.bookmarked : s.bookmark}
        </SpButton>
      </div>
    </li>
  );
}

function PersonalDuas() {
  const { s } = useSp();
  const [list, setList] = usePersonalDuas();
  const [today, setToday] = useTodayPrefs();
  const [text, setText] = useState('');
  function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setList(l => [{ id: newId(), text: text.trim() }, ...l]);
    setText('');
  }
  return (
    <Panel>
      <PanelTitle as="h3" sub={s.dPersonalHint}>
        {s.dPersonalTitle}
      </PanelTitle>
      <form onSubmit={add} className="space-y-2">
        <label htmlFor="sp-personal" className="sr-only">
          {s.dPersonalPlaceholder}
        </label>
        <textarea id="sp-personal" rows={3} maxLength={1000} className={inputClass} placeholder={s.dPersonalPlaceholder} value={text} onChange={e => setText(e.target.value)} />
        <SpButton type="submit" disabled={!text.trim()}>
          {s.save}
        </SpButton>
      </form>
      <ul className="mt-4 space-y-2">
        {list.map(d => {
          const pinKey = `personal:${d.id}`;
          const pinned = today.pinnedDua === pinKey;
          return (
            <li key={d.id} className="rounded-2xl bg-ivory/70 px-4 py-3 text-sm">
              <p className="text-xs font-semibold text-gilt-deep">{s.kind_personal}</p>
              <p className="mt-1 whitespace-pre-wrap">{d.text}</p>
              <div className="mt-2 flex gap-2">
                <SpButton variant={pinned ? 'primary' : 'ghost'} aria-pressed={pinned} onClick={() => setToday(t => ({ ...t, pinnedDua: pinned ? null : pinKey }))}>
                  <Pin className="h-4 w-4" aria-hidden /> {pinned ? s.dPinned : s.dPin}
                </SpButton>
                <SpButton
                  variant="danger"
                  onClick={() => {
                    setList(l => l.filter(x => x.id !== d.id));
                    if (pinned) setToday(t => ({ ...t, pinnedDua: null }));
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> {s.delete}
                </SpButton>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export default function DuaDhikrView() {
  const { s, lang } = useSp();
  const topic = findTopic('dua-dhikr')!;
  const etiquette = topic.groups[0].guides[0];
  const index = useGuideIndex();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<DuaCategory | 'all'>('all');
  const [follow, setFollow] = useLocal<Follow | null>(`${PREFIX}counter-follow`, null);
  const refs = useMemo(() => DUAS.map(d => d.source), []);
  const { data, loading, error, reload } = useSources(refs, lang);

  useEffect(() => {
    document.title = `${s.dTitle} · ${s.title} · ${s.brand}`;
  }, [s]);

  const needle = query.trim().toLocaleLowerCase();
  const shown = DUAS.filter(d => {
    if (cat !== 'all' && d.category !== cat) return false;
    if (!needle) return true;
    const src = data?.get(sourceId(d.source));
    return `${searchText(src)} ${s[`dcat_${d.category}`]} ${sourceLabel(d.source, s)}`.toLocaleLowerCase().includes(needle);
  });

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { label: s.dTitle }]} />
      <SectionBand title={s.dTitle} subtitle={s.dIntro} topic="dua-dhikr" arabic={topic.arabic}>
        <label className="relative block max-w-xl">
          <span className="sr-only">{s.dSearch}</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald/60" aria-hidden />
          <input
            type="search"
            className="w-full rounded-full border-0 bg-ivory py-3 pl-11 pr-4 text-sm text-ink placeholder:text-ink/45 focus:outline-none focus:ring-2 focus:ring-gilt"
            placeholder={s.dSearch}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
      </SectionBand>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div role="group" aria-label={s.dSearch} className="flex flex-wrap gap-2">
            <Pill active={cat === 'all'} onClick={() => setCat('all')}>
              {s.dAll}
            </Pill>
            {DUA_CATEGORIES.map(c => (
              <Pill key={c} active={cat === c} onClick={() => setCat(c)}>
                {s[`dcat_${c}`]}
              </Pill>
            ))}
          </div>
          <Panel>
            {loading && <p role="status" className="text-sm text-ink/60">{s.loading}</p>}
            {error && (
              <div role="alert" className="flex items-center gap-3 rounded-2xl bg-red-50 p-3 text-sm text-red-900">
                <span className="flex-1">{error}</span>
                <SpButton variant="soft" onClick={reload}>
                  {s.retry}
                </SpButton>
              </div>
            )}
            {!loading && shown.length === 0 && <p className="text-sm text-ink/60">{s.dNoResults}</p>}
            <HighlightProvider query={query}>
              <ul className="space-y-8">
                {!loading &&
                  shown.map(d => (
                    <DuaCard
                      key={d.id}
                      entry={d}
                      source={data?.get(sourceId(d.source))}
                      onFollow={() => {
                        setFollow({ duaId: d.id, step: 0 });
                        document.getElementById('sp-counter')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    />
                  ))}
              </ul>
            </HighlightProvider>
            <p className="mt-6 text-xs text-ink/55">{s.dOutcomeNote}</p>
          </Panel>
        </div>
        <div className="space-y-6">
          <div className="lg:sticky lg:top-4">
            <Counter follow={follow} setFollow={setFollow} />
          </div>
          <PersonalDuas />
          <Panel>
            <PanelTitle as="h3">{s.guidesTitle}</PanelTitle>
            <a href={spHref(`guide/${etiquette.slug}`)} className="block rounded-2xl bg-ivory px-4 py-3 hover:bg-vellum">
              <span className="block font-medium text-emerald">{etiquette.title[lang]}</span>
              <span className="mt-1 block">
                <StatusBadge status={index.data?.[etiquette.slug]?.status ?? 'in-preparation'} scholarReviewed={index.data?.[etiquette.slug]?.scholarReviewed ?? false} />
              </span>
            </a>
          </Panel>
          <Callout tone="privacy">{s.privacyFooter}</Callout>
        </div>
      </div>
    </div>
  );
}

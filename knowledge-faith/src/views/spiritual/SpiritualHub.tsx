import { useEffect, useMemo, useState } from 'react';
import { Bookmark, CalendarDays, Clock, Compass, Download, HelpCircle, Landmark, ListChecks, NotebookPen, Search, Sparkles } from 'lucide-react';
import { ALL_GUIDES, DUAS, PILLARS, TOOL_ROUTES, TOPICS, findGuide, findTopic, type ToolId, type TopicDef } from '../../shared/spiritual/catalog.ts';
import { describeDay, todayIn } from '../../shared/spiritual/calendar.ts';
import type { PrayerCalendar } from '../../shared/spiritual/prayerSettings.ts';
import { minutesInZone, nextPrayer } from '../../shared/spiritual.ts';
import { useRemote } from '../../lib/api.ts';
import { fmt, type SpKey } from '../../lib/i18nSpiritual.ts';
import { formatIso, hijriMonthName, spHref, useGuideIndex } from '../../lib/spiritualFormat.ts';
import {
  useCalendarPrefs,
  usePersonalDuas,
  usePlace,
  usePrayerPrefs,
  useProgress,
  useSp,
  useTodayPrefs,
} from '../../lib/spiritualStore.ts';
import { Callout, Panel, PanelTitle, PillarIcon, SectionBand, inputClass } from '../../components/spiritual/ornaments.tsx';
import { SourceList } from '../../components/spiritual/sources.tsx';
import { prayerQuery } from './PrayerTimesView.tsx';

const QUICK_TOOLS: { id: ToolId | 'calendar'; icon: typeof Clock }[] = [
  { id: 'prayer-times', icon: Clock },
  { id: 'qibla', icon: Compass },
  { id: 'zakah-calculator', icon: Landmark },
  { id: 'fasting-calendar', icon: CalendarDays },
  { id: 'dua-dhikr', icon: Sparkles },
  { id: 'hajj-checklist', icon: ListChecks },
];

const toolHref = (id: ToolId | 'calendar') => spHref(id === 'calendar' ? 'calendar' : TOOL_ROUTES[id]);

function useSearch(query: string) {
  const { s, lang } = useSp();
  return useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (q.length < 2) return [];
    const items: { key: string; label: string; context: string; href: string }[] = [];
    for (const topic of TOPICS) {
      items.push({ key: `t-${topic.id}`, label: topic.title[lang], context: topic.subtitle[lang], href: spHref(topic.id) });
      for (const g of topic.groups)
        for (const guide of g.guides)
          items.push({ key: `g-${guide.slug}`, label: guide.title[lang], context: `${topic.title[lang]} · ${g.title[lang]}`, href: spHref(`guide/${guide.slug}`) });
    }
    for (const id of Object.keys(TOOL_ROUTES) as ToolId[]) {
      items.push({ key: `tool-${id}`, label: s[`tool_${id}` as SpKey], context: s.toolsTitle, href: toolHref(id) });
    }
    items.push({ key: 'calendar', label: s.tool_calendar, context: s.toolsTitle, href: spHref('calendar') });
    items.push({ key: 'saved', label: s.svTitle, context: s.title, href: spHref('saved') });
    const english = (key: string) => {
      if (key.startsWith('t-')) return findTopic(key.slice(2))?.title.en ?? '';
      if (key.startsWith('g-')) return findGuide(key.slice(2))?.guide.title.en ?? '';
      return '';
    };
    return items.filter(i => `${i.label} ${i.context} ${english(i.key)}`.toLocaleLowerCase().includes(q)).slice(0, 20);
  }, [query, s, lang]);
}

function PillarCard({ topic, published, total }: { topic: TopicDef; published: number; total: number }) {
  const { s, lang } = useSp();
  return (
    <a
      href={spHref(topic.id)}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-emerald/10 bg-ivory p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gilt/60 hover:shadow-md focus-visible:-translate-y-0.5"
    >
      <span className="sp-lattice pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-60" aria-hidden />
      <span className="flex items-start justify-between gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald text-gilt shadow-inner">
          <PillarIcon topic={topic.id} className="h-9 w-9" />
        </span>
        <span lang="ar" dir="rtl" className="font-[family-name:var(--font-arabic)] text-2xl text-gilt-deep">
          {topic.arabic}
        </span>
      </span>
      <span className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-gilt-deep">{fmt(s.pillarN, { n: topic.pillar ?? '' })}</span>
      <span className="mt-1 font-display text-2xl font-bold text-emerald">{topic.title[lang]}</span>
      <span className="text-sm text-ink/70">{topic.subtitle[lang]}</span>
      <span className="mt-4 flex items-center justify-between text-xs text-ink/60">
        <span>
          {total} {s.guidesTitle.toLocaleLowerCase()} · {published} {s.statusPublished.toLocaleLowerCase()}
        </span>
        <span className="font-semibold text-emerald group-hover:underline">{s.explore} →</span>
      </span>
    </a>
  );
}

function TodayPanel() {
  const { s, lang } = useSp();
  const [prefs, setPrefs] = useTodayPrefs();
  const [place] = usePlace();
  const [prayer] = usePrayerPrefs();
  const [cal] = useCalendarPrefs();
  const [personal] = usePersonalDuas();
  const tz = cal.timezone;
  const today = todayIn(tz);
  const [y, m] = today.split('-').map(Number);
  const url = prefs.enabled && prefs.prayer && place ? `/api/spiritual/prayer/calendar?${prayerQuery(place, prayer, y, m)}` : null;
  const month = useRemote<PrayerCalendar>(url);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!prefs.enabled) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [prefs.enabled]);

  const pinned = DUAS.find(d => d.id === prefs.pinnedDua);
  const pinnedPersonal = personal.find(d => `personal:${d.id}` === prefs.pinnedDua);
  const day = describeDay(today, cal);

  const toggle = (key: 'prayer' | 'dhikr' | 'occasion' | 'goal') => setPrefs(p => ({ ...p, [key]: !p[key] }));

  let next: string | null = null;
  if (month.data) {
    const zone = month.data.timezone;
    const localToday = todayIn(zone, now);
    const entry = month.data.days.find(d => d.date === localToday);
    if (entry) {
      const n = nextPrayer(entry.timings, minutesInZone(now, zone));
      const params = { name: s[`p_${n.name}` as SpKey], h: Math.floor(n.minutesUntil / 60), m: n.minutesUntil % 60 };
      next = fmt(n.tomorrow ? s.ptNextTomorrow : s.ptNext, params);
    }
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PanelTitle sub={s.todayHint}>{s.todayTitle}</PanelTitle>
        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input type="checkbox" className="h-4 w-4 accent-emerald" checked={prefs.enabled} onChange={e => setPrefs(p => ({ ...p, enabled: e.target.checked }))} />
          {s.todayShow}
        </label>
      </div>
      {prefs.enabled && (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-xs text-ink/70">
            {(['prayer', 'dhikr', 'occasion', 'goal'] as const).map(k => (
              <label key={k} className="flex items-center gap-1.5">
                <input type="checkbox" className="accent-emerald" checked={prefs[k]} onChange={() => toggle(k)} />
                {{ prayer: s.todayPrayer, dhikr: s.todayDhikr, occasion: s.todayOccasion, goal: s.todayGoal }[k]}
              </label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {prefs.prayer && (
              <div className="rounded-2xl bg-emerald p-4 text-ivory">
                <p className="text-xs uppercase tracking-wider text-gilt">{s.todayPrayer}</p>
                {!place ? (
                  <p className="mt-2 text-sm">
                    <a className="underline" href={spHref('salah/times')}>
                      {s.todayNoPlace}
                    </a>
                  </p>
                ) : (
                  <>
                    <p className="mt-1 font-display text-2xl font-bold">{next ?? s.loading}</p>
                    <p className="mt-1 text-xs text-ivory/75">
                      {place.name} · {s.ptCalculated}
                    </p>
                  </>
                )}
              </div>
            )}
            {prefs.occasion && (
              <div className="rounded-2xl border border-emerald/10 bg-ivory p-4">
                <p className="text-xs uppercase tracking-wider text-gilt-deep">{s.todayOccasion}</p>
                <p className="mt-1 font-display text-xl font-bold text-emerald">
                  {day.hijri.day} {hijriMonthName(lang, day.hijri.month)} {day.hijri.year}
                </p>
                <p className="text-xs text-ink/60">
                  {formatIso(lang, today)} · {day.hijriStatus === 'confirmed' ? s.fcConfirmed : s.fcProvisional}
                </p>
                <p className="mt-2 text-sm text-ink/80">
                  {day.occasions.length ? day.occasions.map(o => s[`oc_${o}` as SpKey]).join(' · ') : s.todayOrdinary}
                </p>
                <a className="mt-1 inline-block text-xs text-lapis underline" href={spHref('calendar')}>
                  {s.tool_calendar}
                </a>
              </div>
            )}
            {prefs.dhikr && (
              <div className="rounded-2xl border border-emerald/10 bg-white p-4 md:col-span-2">
                <p className="mb-2 text-xs uppercase tracking-wider text-gilt-deep">{s.todayDhikr}</p>
                {pinned ? (
                  <SourceList refs={[pinned.source]} compact />
                ) : pinnedPersonal ? (
                  <div className="text-sm">
                    <p className="text-xs font-semibold text-gilt-deep">{s.kind_personal}</p>
                    <p className="mt-1 whitespace-pre-wrap">{pinnedPersonal.text}</p>
                  </div>
                ) : (
                  <a className="text-sm text-lapis underline" href={spHref('dua-dhikr')}>
                    {s.todayNoDhikr}
                  </a>
                )}
              </div>
            )}
            {prefs.goal && (
              <div className="rounded-2xl border border-emerald/10 bg-white p-4 md:col-span-2">
                <label htmlFor="sp-goal" className="text-xs uppercase tracking-wider text-gilt-deep">
                  {s.todayGoal}
                </label>
                <input
                  id="sp-goal"
                  className={`${inputClass} mt-2`}
                  value={prefs.goalText}
                  maxLength={200}
                  placeholder={s.todayGoalPlaceholder}
                  onChange={e => setPrefs(p => ({ ...p, goalText: e.target.value }))}
                />
              </div>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

function ContinuePanel() {
  const { s, lang } = useSp();
  const [progress, setProgress] = useProgress();
  const recent = Object.entries(progress.opened)
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 4)
    .map(([slug, at]) => ({ found: findGuide(slug), at }))
    .filter(x => x.found);
  const starters = ['new-muslim-welcome', 'shahadah-testimony', 'wudu', 'salah-sequence'].map(slug => findGuide(slug)!);
  return (
    <Panel>
      <PanelTitle>{s.continueTitle}</PanelTitle>
      {progress.enabled && recent.length ? (
        <ul className="space-y-2">
          {recent.map(({ found, at }) => (
            <li key={found!.guide.slug}>
              <a href={spHref(`guide/${found!.guide.slug}`)} className="flex items-center justify-between gap-3 rounded-2xl bg-ivory px-4 py-3 hover:bg-vellum">
                <span className="font-medium text-emerald">{found!.guide.title[lang]}</span>
                <span className="text-xs text-ink/55">{fmt(s.lastOpened, { date: formatIso(lang, at.slice(0, 10)) })}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink/70">{s.continueEmpty}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {starters.map(g => (
              <li key={g.guide.slug}>
                <a href={spHref(`guide/${g.guide.slug}`)} className="block rounded-2xl bg-ivory px-4 py-3 text-sm font-medium text-emerald hover:bg-vellum">
                  {g.guide.title[lang]}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 border-t border-emerald/10 pt-3">
        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input type="checkbox" className="h-4 w-4 accent-emerald" checked={progress.enabled} onChange={e => setProgress(p => ({ ...p, enabled: e.target.checked }))} />
          {s.progressToggle}
        </label>
        {progress.enabled && (
          <p className="mt-1 text-xs text-ink/60">{fmt(s.progressOf, { read: Object.keys(progress.opened).length, total: ALL_GUIDES.length })}</p>
        )}
        <p className="mt-1 text-xs text-ink/55">{s.progressNote}</p>
      </div>
    </Panel>
  );
}

export default function SpiritualHub() {
  const { s, lang } = useSp();
  const [query, setQuery] = useState('');
  const results = useSearch(query);
  const index = useGuideIndex();
  const counts = (topic: TopicDef) => {
    const slugs = topic.groups.flatMap(g => g.guides.map(x => x.slug));
    return { total: slugs.length, published: slugs.filter(sl => index.data?.[sl]?.status === 'published').length };
  };
  const supporting = TOPICS.filter(t => !t.pillar);

  useEffect(() => {
    document.title = `${s.title} · ${s.brand}`;
  }, [s]);

  return (
    <div className="space-y-6">
      <SectionBand title={s.title} subtitle={s.tagline}>
        <form role="search" onSubmit={e => e.preventDefault()} className="max-w-2xl">
          <label htmlFor="sp-search" className="sr-only">
            {s.searchLabel}
          </label>
          <div className="flex items-center gap-2 rounded-full bg-ivory px-4 py-2.5 text-ink shadow-inner">
            <Search className="h-4 w-4 text-emerald" aria-hidden />
            <input
              id="sp-search"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={s.searchPlaceholder}
              className="w-full bg-transparent text-sm placeholder:text-ink/45 focus:outline-none"
            />
          </div>
        </form>
      </SectionBand>

      {query.trim().length >= 2 && (
        <Panel>
          <h2 className="sr-only">{s.searchLabel}</h2>
          {results.length ? (
            <ul className="divide-y divide-emerald/10" aria-live="polite">
              {results.map(r => (
                <li key={r.key}>
                  <a href={r.href} className="block px-1 py-2.5 hover:bg-ivory">
                    <span className="font-medium text-emerald">{r.label}</span>
                    <span className="block text-xs text-ink/55">{r.context}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/70" aria-live="polite">
              {s.searchEmpty}
            </p>
          )}
        </Panel>
      )}

      <p className="max-w-3xl text-sm leading-relaxed text-ink/75">{s.intro}</p>

      <section aria-labelledby="sp-pillars">
        <h2 id="sp-pillars" className="mb-3 font-display text-2xl font-bold text-emerald">
          {s.pillarsTitle}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PILLARS.map(t => (
            <PillarCard key={t.id} topic={t} {...counts(t)} />
          ))}
        </div>
      </section>

      <section aria-labelledby="sp-tools">
        <h2 id="sp-tools" className="mb-3 font-display text-xl font-bold text-emerald">
          {s.quickTools}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_TOOLS.map(({ id, icon: Icon }) => (
            <li key={id}>
              <a href={toolHref(id)} className="flex h-full flex-col items-start gap-2 rounded-2xl border border-emerald/10 bg-white p-4 text-sm font-medium text-emerald hover:border-gilt/60 hover:bg-ivory">
                <Icon className="h-5 w-5 text-gilt-deep" aria-hidden />
                {s[`tool_${id}` as SpKey]}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <TodayPanel />
        <ContinuePanel />
      </div>

      <section aria-labelledby="sp-support">
        <h2 id="sp-support" className="mb-3 font-display text-xl font-bold text-emerald">
          {s.supportTitle}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {supporting.map(t => (
            <a key={t.id} href={spHref(t.id)} className="flex items-center gap-4 rounded-3xl border border-emerald/10 bg-white p-4 hover:border-gilt/60 hover:bg-ivory">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ivory text-emerald ring-1 ring-gilt/40">
                <PillarIcon topic={t.id} className="h-8 w-8" />
              </span>
              <span>
                <span className="block font-semibold text-emerald">{t.title[lang]}</span>
                <span className="block text-xs text-ink/60">{t.subtitle[lang]}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <a href={spHref('saved')} className="flex items-center gap-3 rounded-2xl bg-ivory px-4 py-3 text-sm font-medium text-emerald hover:bg-vellum">
          <Bookmark className="h-4 w-4" aria-hidden /> {s.savedTitle}
        </a>
        <a href={spHref('questions')} className="flex items-center gap-3 rounded-2xl bg-ivory px-4 py-3 text-sm font-medium text-emerald hover:bg-vellum">
          <HelpCircle className="h-4 w-4" aria-hidden /> {s.questionsTitle}
        </a>
        <a href={spHref('editorial')} className="flex items-center gap-3 rounded-2xl bg-ivory px-4 py-3 text-sm font-medium text-emerald hover:bg-vellum">
          <NotebookPen className="h-4 w-4" aria-hidden /> {s.editorialLink}
        </a>
      </div>

      <Callout tone="privacy">
        <span className="inline-flex items-center gap-2">
          <Download className="h-4 w-4 shrink-0" aria-hidden /> {s.privacyFooter}
        </span>
      </Callout>
    </div>
  );
}

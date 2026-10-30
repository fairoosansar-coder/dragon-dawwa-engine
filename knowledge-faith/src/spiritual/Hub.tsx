import { useMemo, useState } from 'react';
import { Calculator, Clock, Compass, Library, ListChecks, Moon, Settings, Sparkles, type LucideIcon } from 'lucide-react';
import { useShell } from '../lib/shell.tsx';
import { useRemote } from '../lib/api.ts';
import { useStored } from '../lib/store.tsx';
import { minutesInZone, nextPrayer } from '../shared/spiritual.ts';
import type { PrayerDay } from '../shared/types.ts';
import { DHIKR, GUIDES, guideById, occasionById, searchSpiritual, text } from './content.ts';
import { evaluateHijriDay } from './fasting.ts';
import { gregorianToHijri, hijriWithShift, isoDateInZone, parseIsoDate } from './hijri.ts';
import { Geometry, Panel, useSp } from './chrome.tsx';
import { useCalendarPrefs } from './FastingView.tsx';
import { usePlace } from './place.ts';
import { useBookmarks, useGuideProgress } from './GuideView.tsx';
const PILLARS = [
  { id: 'shahadah', href: '#/spiritual/shahadah', guides: ['shahadah'] },
  { id: 'salah', href: '#/spiritual/salah', guides: ['salah', 'salah-learn', 'salah-purification'] },
  { id: 'zakah', href: '#/spiritual/zakah', guides: ['zakah', 'zakah-recipients'] },
  { id: 'fasting', href: '#/spiritual/fasting', guides: ['fasting'] },
  { id: 'hajj', href: '#/spiritual/hajj', guides: ['hajj', 'umrah'] },
];

const TOOLS: { href: string; key: 'prayerTimes' | 'qibla' | 'toolZakah' | 'toolFasting' | 'toolDua' | 'sourceLibrary' | 'toolChecklist'; icon: LucideIcon }[] = [
  { href: '#/spiritual/salah/times', key: 'prayerTimes', icon: Clock },
  { href: '#/spiritual/salah/qibla', key: 'qibla', icon: Compass },
  { href: '#/spiritual/zakah/calculator', key: 'toolZakah', icon: Calculator },
  { href: '#/spiritual/fasting/calendar', key: 'toolFasting', icon: Moon },
  { href: '#/spiritual/dua-dhikr', key: 'toolDua', icon: Sparkles },
  { href: '#/spiritual/library', key: 'sourceLibrary', icon: Library },
  { href: '#/spiritual/hajj/checklist', key: 'toolChecklist', icon: ListChecks },
];

interface TodayPrefs {
  prayer: boolean;
  dhikr: boolean;
  occasion: boolean;
  goal: boolean;
}

export function Hub() {
  const { lang, s } = useSp();
  const { query } = useShell();
  const [progress] = useGuideProgress();
  const hits = searchSpiritual(query, lang);
  return (
    <div className="dd-spiritual space-y-6">
      <header data-worship-hero className="relative overflow-hidden rounded-[2rem] border border-[#D4AF37]/30 bg-[#12725A] px-6 pt-8 pb-16 text-dd-ivory sm:py-10 sm:pr-16 sm:pl-40">
        <img
          src="/assets/geometric-worship.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        <div className="relative max-w-[16.5rem] sm:max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-dd-gold-soft">{s.brand}</p>
          <p className="mt-1 text-sm text-dd-gold-soft">{s.byline}</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">{s.title}</h1>
          <p className="mt-4 text-lg text-dd-ivory">{s.tagline}</p>
        </div>
      </header>
      {query.trim().length >= 2 && (
        <ul className="space-y-2">
          {hits.length === 0 && <li>{s.searchEmpty}</li>}
          {hits.map(hit => (
            <li key={hit.href}>
              <a className="font-medium text-dd-emerald underline" href={hit.href}>
                {hit.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      <section aria-label={s.pillars}>
        <h2 className="mb-3 font-display text-2xl font-bold text-dd-emerald">{s.pillars}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {PILLARS.map(pillar => {
            const guide = GUIDES.find(item => item.id === pillar.id || item.id === (pillar.id === 'fasting' ? 'fasting' : pillar.id));
            const opened = progress.filter(item => pillar.guides.some(id => item.guideId === id || item.guideId.startsWith(`${pillar.id}-`))).length;
            const title = guide ? text(guide.title, lang) : pillar.id;
            const summary = guide ? text(guide.summary, lang) : '';
            return (
              <a key={pillar.id} href={pillar.href} className="flex min-h-44 flex-col gap-3 rounded-3xl border border-dd-emerald/10 bg-white p-4 shadow-sm hover:border-dd-gold">
                <Geometry name={pillar.id} />
                <span className="font-display text-xl font-bold text-dd-emerald">{title}</span>
                <span className="text-sm leading-snug text-dd-ink/80">{summary}</span>
                <span className="mt-auto text-sm font-semibold text-dd-emerald">{s.open}</span>
                {opened > 0 && (
                  <span className="text-xs text-dd-ink/60">
                    {s.progressOpened}: {opened}
                  </span>
                )}
              </a>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-dd-ink/60">{s.progressNote}</p>
      </section>
      <section aria-label={s.tools}>
        <h2 className="mb-3 font-display text-2xl font-bold text-dd-emerald">{s.tools}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map(tool => {
            const Icon = tool.icon;
            return (
              <a key={tool.href} href={tool.href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-dd-emerald/10 bg-white px-4 py-3 leading-snug text-dd-ink shadow-sm transition-colors hover:border-dd-gold">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dd-emerald/10 text-dd-emerald">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-semibold">{s[tool.key]}</span>
              </a>
            );
          })}
        </div>
      </section>
      <Continue />
      <Today />
      <section aria-label={s.support} className="grid gap-3 sm:grid-cols-2">
        <h2 className="sm:col-span-2 font-display text-2xl font-bold text-dd-emerald">{s.support}</h2>
        {[
          ['#/spiritual/new-muslim', s.newMuslim],
          ['#/spiritual/akhlaq', s.akhlaq],
          ['#/spiritual/saved', s.saved],
          ['#/spiritual/questions', s.questions],
        ].map(([href, label]) => (
          <a key={href} href={href} className="min-h-16 rounded-2xl border border-dd-lapis/30 bg-white px-4 py-4 font-semibold text-dd-emerald">
            {label}
          </a>
        ))}
      </section>
      <p className="text-xs text-dd-ink/50">{DHIKR.length > 0 ? s.todayNoDhikr : ''}</p>
    </div>
  );
}

function Continue() {
  const { lang, s } = useSp();
  const [progress] = useGuideProgress();
  const [bookmarks] = useBookmarks();
  const items = progress.slice(0, 4);
  return (
    <Panel>
      <h2 className="font-display text-2xl font-bold text-dd-emerald">{s.continueTitle}</h2>
      {items.length === 0 ? (
        <div className="mt-3 space-y-2">
          <p>{s.progressEmpty}</p>
          <a className="inline-flex min-h-11 items-center font-semibold text-dd-emerald underline" href="#/spiritual/shahadah">
            {s.open}
          </a>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map(item => (
            <li key={`${item.guideId}-${item.section}`}>
              <a className="underline" href={`#/spiritual/${pathFor(item.guideId)}`}>
                {text(guideById(item.guideId)?.title ?? { en: item.guideId, ta: item.guideId, si: item.guideId }, lang)}
              </a>
            </li>
          ))}
        </ul>
      )}
      {bookmarks.length > 0 && (
        <p className="mt-3 text-sm">
          <a className="underline" href="#/spiritual/saved">
            {s.saved}
          </a>
        </p>
      )}
    </Panel>
  );
}

function pathFor(id: string): string {
  return GUIDES.find(item => item.id === id)?.path.join('/') ?? id;
}

interface HijriMonthDay {
  iso: string;
  year: number;
  month: number;
  day: number;
}

function Today() {
  const { lang, s } = useSp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefs, setPrefs] = useStored<TodayPrefs>('kf-today-panels', { prayer: true, dhikr: true, occasion: true, goal: true });
  const [goal, setGoal] = useStored<string>('kf-spiritual-goal', '');
  const [draft, setDraft] = useState(goal);
  const [place] = usePlace();
  const [cal] = useCalendarPrefs();
  const zone = cal.timezone || 'UTC';
  const todayIso = isoDateInZone(new Date(), zone);
  const date = parseIsoDate(todayIso);
  const monthUrl = prefs.occasion && cal.authority === 'aladhan' && date ? `/api/hijri-month?year=${date.year}&month=${date.month}` : null;
  const month = useRemote<{ days: HijriMonthDay[] }>(monthUrl);
  const hijri = useMemo(() => {
    if (!date) return null;
    if (cal.authority === 'shifted') return hijriWithShift(date, cal.shift);
    if (cal.authority === 'aladhan') {
      const day = month.data?.days.find(item => item.iso === todayIso);
      return day ? { year: day.year, month: day.month, day: day.day } : null;
    }
    return gregorianToHijri(date);
  }, [cal.authority, cal.shift, date, month.data, todayIso]);
  const evaluation = hijri && date ? evaluateHijriDay(hijri, date) : null;
  const panelLabel: Record<keyof TodayPrefs, string> = {
    prayer: s.todayNext,
    dhikr: s.todayDhikr,
    occasion: s.todayOccasion,
    goal: s.todayGoal,
  };
  const url = prefs.prayer && place ? `/api/prayer?lat=${place.lat}&lng=${place.lng}&method=3&school=0` : null;
  const remote = useRemote<PrayerDay>(url);
  const upcoming = useMemo(() => {
    if (!remote.data) return null;
    return nextPrayer(remote.data.timings, minutesInZone(new Date(), remote.data.timezone));
  }, [remote.data]);
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-dd-emerald">{s.today}</h2>
        <button
          type="button"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dd-emerald/15 bg-white text-dd-emerald transition-colors hover:border-dd-gold"
          aria-expanded={settingsOpen}
          aria-controls="today-worship-settings"
          aria-label={`${s.today} settings`}
          onClick={() => setSettingsOpen(open => !open)}
        >
          <Settings className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {settingsOpen && (
        <fieldset id="today-worship-settings" className="mt-3 space-y-1 rounded-2xl border border-dd-emerald/10 bg-white p-3">
          <legend className="sr-only">{s.today}</legend>
          {(Object.keys(prefs) as (keyof TodayPrefs)[]).map(key => (
            <label key={key} className="flex min-h-11 items-center gap-3 text-sm text-dd-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-dd-emerald"
                checked={prefs[key]}
                onChange={() => setPrefs({ ...prefs, [key]: !prefs[key] })}
              />
              {panelLabel[key]}
            </label>
          ))}
        </fieldset>
      )}
      {prefs.prayer && (
        <div className="mt-4">
          <h3 className="font-semibold">{s.todayNext}</h3>
          {!place && <p>{s.todayNoPlace}</p>}
          {upcoming && remote.data && (
            <p>
              <a className="font-semibold text-dd-emerald underline" href="#/spiritual/salah/times">
                {s[upcoming.name]}
              </a>{' '}
              {remote.data.timings[upcoming.name]} · {remote.data.method}
            </p>
          )}
        </div>
      )}
      {prefs.dhikr && (
        <div className="mt-4">
          <h3 className="font-semibold">{s.todayDhikr}</h3>
          <p>{s.todayNoDhikr}</p>
          <a className="underline" href="#/spiritual/dua-dhikr">
            {s.open}
          </a>
        </div>
      )}
      {prefs.occasion && (
        <div className="mt-4">
          <h3 className="font-semibold">{s.todayOccasion}</h3>
          <p className="text-xs">{s.provisional}</p>
          {cal.authority === 'aladhan' && month.loading && <p>{s.loading}</p>}
          {cal.authority === 'aladhan' && month.error && (
            <p>
              {month.error}{' '}
              <button type="button" onClick={month.reload}>
                {s.retry}
              </button>
            </p>
          )}
          {cal.authority === 'aladhan' && !month.loading && !month.error && !hijri && <p>{s.pendingDate}</p>}
          {evaluation && evaluation.occasions.length > 0 && (
            <ul>
              {evaluation.occasions.map(item => (
                <li key={item.id}>
                  <a className="underline" href={`#/spiritual/fasting/occasions/${item.id}`}>
                    {text(occasionById(item.id)?.title ?? { en: item.id, ta: item.id, si: item.id }, lang)}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {hijri && evaluation && evaluation.occasions.length === 0 && <p>{s.todayNone}</p>}
        </div>
      )}
      {prefs.goal && (
        <form
          className="mt-4"
          onSubmit={event => {
            event.preventDefault();
            setGoal(draft.slice(0, 240));
          }}
        >
          <h3 className="font-semibold">{s.todayGoal}</h3>
          <input className="mt-2 min-h-11 w-full rounded-2xl border border-dd-emerald/20 px-3" value={draft} placeholder={s.goalPlaceholder} onChange={event => setDraft(event.target.value)} />
          <button className="mt-2 min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory" type="submit">
            {s.save}
          </button>
          {!goal && <p className="mt-2 text-sm">{s.todayGoalEmpty}</p>}
          {goal && <p className="mt-2">{goal}</p>}
        </form>
      )}
    </Panel>
  );
}

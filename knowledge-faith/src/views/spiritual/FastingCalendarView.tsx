import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bell, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import {
  addDays,
  describeDay,
  hijriFor,
  hijriKey,
  OCCASIONS,
  planReminders,
  todayIn,
  type DayInfo,
  type DayStatus,
  type HijriBasis,
} from '../../shared/spiritual/calendar.ts';
import { findGuide, findTopic } from '../../shared/spiritual/catalog.ts';
import { validTimeZone } from '../../shared/spiritual/prayerSettings.ts';
import { fmt, type SpKey, type SpStrings } from '../../lib/i18nSpiritual.ts';
import { formatInstant, formatIso, hijriMonthName, spHref, weekdayShort } from '../../lib/spiritualFormat.ts';
import { useCalendarPrefs, useMakeup, useReminderPrefs, useSp } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Field, inputClass, Panel, PanelTitle, Pill, SectionBand, SpButton } from '../../components/spiritual/ornaments.tsx';
import { SourceList } from '../../components/spiritual/sources.tsx';
import type { Lang } from '../../shared/sources.ts';

export const STATUS_STYLE: Record<DayStatus, { cell: string; mark: string }> = {
  obligatory: { cell: 'bg-emerald text-ivory', mark: '◆' },
  prohibited: { cell: 'bg-red-100 text-red-900 ring-1 ring-red-300', mark: '✕' },
  recommended: { cell: 'bg-gilt/25 text-emerald-deep ring-1 ring-gilt/60', mark: '●' },
  restricted: { cell: 'bg-lapis/10 text-lapis ring-1 ring-lapis/30', mark: '!' },
  ordinary: { cell: 'bg-white text-ink', mark: '' },
};

const OCCASION_GUIDE: Record<string, string> = {
  ramadan: 'ramadan',
  'eid-fitr': 'prohibited-days',
  'eid-adha': 'prohibited-days',
  tashriq: 'prohibited-days',
  'friday-alone': 'prohibited-days',
  'pre-ramadan': 'prohibited-days',
};
export const occasionGuide = (id: string) => OCCASION_GUIDE[id] ?? 'voluntary-fasting';
export const occasionName = (s: SpStrings, id: string) => s[`oc_${id}` as SpKey] ?? id;

export function hijriLabel(lang: Lang, d: DayInfo['hijri']) {
  return `${d.day} ${hijriMonthName(lang, d.month)} ${d.year}`;
}

function monthDays(anchor: string, view: 'gregorian' | 'hijri', prefs: Parameters<typeof hijriFor>[1]): string[] {
  if (view === 'gregorian') {
    const [y, m] = anchor.split('-').map(Number);
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: n }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
  }
  const target = hijriFor(anchor, prefs).date;
  const same = (iso: string) => {
    const h = hijriFor(iso, prefs).date;
    return h.year === target.year && h.month === target.month;
  };
  let start = anchor;
  for (let i = 0; i < 31 && same(addDays(start, -1)); i++) start = addDays(start, -1);
  const out: string[] = [];
  for (let d = start; out.length < 31 && same(d); d = addDays(d, 1)) out.push(d);
  return out;
}

function DayDetail({ day }: { day: DayInfo }) {
  const { s, lang } = useSp();
  const evidence = useMemo(() => OCCASIONS.filter(o => day.occasions.includes(o.id)).flatMap(o => o.evidence), [day]);
  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-xl font-bold text-emerald">{formatIso(lang, day.iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p className="text-sm">
          {hijriLabel(lang, day.hijri)} <span className="text-xs text-ink/60">· {day.hijriStatus === 'confirmed' ? s.fcConfirmed : s.fcProvisional}</span>
        </p>
      </div>
      <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[day.status].cell}`}>
        <span aria-hidden>{STATUS_STYLE[day.status].mark}</span> {s[`status_${day.status}` as SpKey]}
      </p>
      {day.occasions.length > 0 && (
        <ul className="space-y-1 text-sm">
          {day.occasions.map(o => (
            <li key={o}>
              <a href={spHref(`guide/${occasionGuide(o)}`)} className="font-medium text-lapis underline-offset-2 hover:underline">
                {occasionName(s, o)}
              </a>
            </li>
          ))}
        </ul>
      )}
      {day.notes.map(n => (
        <Callout key={n} tone="caution">
          {s[n as SpKey] ?? n}
        </Callout>
      ))}
      {evidence.length > 0 && (
        <details className="rounded-2xl bg-ivory/60 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-emerald">{s.evidence}</summary>
          <div className="mt-3">
            <SourceList refs={evidence} compact />
          </div>
        </details>
      )}
    </div>
  );
}

function CalendarSettings() {
  const { s, lang } = useSp();
  const [prefs, setPrefs] = useCalendarPrefs();
  const [month, setMonth] = useState(9);
  const [year, setYear] = useState(() => hijriFor(todayIn(prefs.timezone), prefs).date.year);
  const [date, setDate] = useState('');
  const [tz, setTz] = useState(prefs.timezone);

  function confirm(e: FormEvent) {
    e.preventDefault();
    if (!date) return;
    setPrefs(p => ({ ...p, confirmedStarts: { ...p.confirmedStarts, [hijriKey(year, month)]: date } }));
    setDate('');
  }

  const starts = Object.entries(prefs.confirmedStarts).sort(([a], [b]) => b.localeCompare(a));
  return (
    <Panel>
      <PanelTitle as="h3">{s.fcSettings}</PanelTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={s.fcBasis} htmlFor="fc-basis">
          <select id="fc-basis" className={inputClass} value={prefs.basis} onChange={e => setPrefs(p => ({ ...p, basis: e.target.value as HijriBasis }))}>
            {(['islamic-umalqura', 'islamic-civil'] as const).map(b => (
              <option key={b} value={b}>
                {s[`basis_${b}`]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={s.fcOffset} htmlFor="fc-offset">
          <select id="fc-offset" className={inputClass} value={prefs.offsetDays} onChange={e => setPrefs(p => ({ ...p, offsetDays: Number(e.target.value) }))}>
            {[-2, -1, 0, 1, 2].map(n => (
              <option key={n} value={n}>
                {fmt(s.fcOffsetDays, { n: n > 0 ? `+${n}` : n })}
              </option>
            ))}
          </select>
        </Field>
        <Field label={s.fcAuthority} htmlFor="fc-auth">
          <input
            id="fc-auth"
            className={inputClass}
            maxLength={120}
            placeholder={s.fcAuthorityPlaceholder}
            value={prefs.authority}
            onChange={e => setPrefs(p => ({ ...p, authority: e.target.value }))}
          />
        </Field>
        <Field label={s.ptTimezone} htmlFor="fc-tz" hint={validTimeZone(tz) ? undefined : s.ptTzInvalid}>
          <input
            id="fc-tz"
            className={inputClass}
            value={tz}
            onChange={e => {
              setTz(e.target.value);
              if (validTimeZone(e.target.value)) setPrefs(p => ({ ...p, timezone: e.target.value }));
            }}
          />
        </Field>
      </div>

      <form onSubmit={confirm} className="mt-5 rounded-2xl bg-ivory/60 p-4">
        <p className="text-sm font-semibold text-emerald">{s.fcConfirm}</p>
        <p className="mb-3 text-xs text-ink/65">{s.fcConfirmHint}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={s.fcMonth} htmlFor="fc-m">
            <select id="fc-m" className={inputClass} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {hijriMonthName(lang, i + 1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={s.fcYear} htmlFor="fc-y">
            <input id="fc-y" type="number" min={1400} max={1600} className={inputClass} value={year} onChange={e => setYear(Number(e.target.value))} />
          </Field>
          <Field label={s.fcStartedOn} htmlFor="fc-d">
            <input id="fc-d" type="date" className={inputClass} value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <SpButton type="submit" disabled={!date}>
              {s.save}
            </SpButton>
          </div>
        </div>
      </form>
      {starts.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-emerald">{s.fcConfirmedStarts}</p>
          <ul className="divide-y divide-emerald/10 text-sm">
            {starts.map(([key, start]) => {
              const [y, m] = key.split('-').map(Number);
              return (
                <li key={key} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    1 {hijriMonthName(lang, m)} {y} = {formatIso(lang, start)}
                  </span>
                  <button
                    type="button"
                    aria-label={`${s.remove}: ${hijriMonthName(lang, m)} ${y}`}
                    className="text-red-800"
                    onClick={() =>
                      setPrefs(p => {
                        const next = { ...p.confirmedStarts };
                        delete next[key];
                        return { ...p, confirmedStarts: next };
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function RemindersPanel() {
  const { s, lang } = useSp();
  const [prefs] = useCalendarPrefs();
  const [rem, setRem] = useReminderPrefs();
  const [makeup] = useMakeup();
  const [perm, setPerm] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const today = todayIn(prefs.timezone);
  const upcoming = useMemo(
    () => planReminders(today, 60, prefs, rem, makeup.dates.filter(d => !makeup.done.includes(d))),
    [today, prefs, rem, makeup],
  );
  const recommended = OCCASIONS.filter(o => o.kind === 'recommended');
  return (
    <Panel>
      <PanelTitle as="h3" sub={s.rmHint}>
        <span className="inline-flex items-center gap-2">
          <Bell className="h-5 w-5 text-gilt-deep" aria-hidden /> {s.rmTitle}
        </span>
      </PanelTitle>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={rem.enabled} onChange={e => setRem(r => ({ ...r, enabled: e.target.checked }))} />
        {s.rmEnable}
      </label>
      {rem.enabled && (
        <div className="mt-4 space-y-4">
          <Field label={s.rmTime} htmlFor="rm-time">
            <input id="rm-time" type="time" className={`${inputClass} w-36`} value={rem.time} onChange={e => e.target.value && setRem(r => ({ ...r, time: e.target.value }))} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-ink/75">{s.rmOccasions}</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {recommended.map(o => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rem.occasions.includes(o.id)}
                    onChange={e =>
                      setRem(r => ({ ...r, occasions: e.target.checked ? [...r.occasions, o.id] : r.occasions.filter(x => x !== o.id) }))
                    }
                  />
                  {occasionName(s, o.id)}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={rem.includeMakeup} onChange={e => setRem(r => ({ ...r, includeMakeup: e.target.checked }))} />
                {s.rmMakeup}
              </label>
            </div>
          </fieldset>
          {perm === 'default' && (
            <SpButton variant="soft" onClick={() => void Notification.requestPermission().then(setPerm)}>
              {s.rmPermission}
            </SpButton>
          )}
          {(perm === 'denied' || perm === 'unsupported') && <p className="text-xs text-ink/60">{s.rmPermissionDenied}</p>}
          <div>
            <p className="mb-2 text-sm font-semibold text-emerald">{s.rmUpcoming}</p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-ink/60">{s.rmNone}</p>
            ) : (
              <ul className="divide-y divide-emerald/10 text-sm">
                {upcoming.slice(0, 12).map(r => (
                  <li key={r.key} className="py-2">
                    <span className="font-medium">{fmt(s.rmFor, { date: formatIso(lang, r.forDate, { weekday: 'short', day: 'numeric', month: 'short' }) })}</span>
                    <span className="block text-xs text-ink/60">
                      {[...r.occasions.map(o => occasionName(s, o)), ...(r.makeup ? [s.rmMakeupLabel] : [])].join(' · ')} · {formatInstant(lang, r.fireAt, prefs.timezone)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink/55">{s.rmRecalc}</p>
          </div>
        </div>
      )}
    </Panel>
  );
}

function OccasionGuides() {
  const { s, lang } = useSp();
  return (
    <Panel>
      <PanelTitle sub={s.ocWhatAndWho}>{s.ocGuides}</PanelTitle>
      <div className="space-y-2">
        {OCCASIONS.map(o => {
          const guide = findGuide(occasionGuide(o.id))!.guide;
          return (
            <details key={o.id} className="rounded-2xl border border-emerald/10 bg-white px-4 py-3">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-emerald">{occasionName(s, o.id)}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.kind].cell}`}>
                  <span aria-hidden>{STATUS_STYLE[o.kind].mark}</span> {s[`status_${o.kind}` as SpKey]}
                </span>
              </summary>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-ink/60">{s.ocDateBasis}</dt>
                  <dd>{s[o.dateBasisKey as SpKey]}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink/60">{s.ocWhatAndWho}</dt>
                  <dd>
                    {fmt(s.ocPending, { guide: guide.title[lang] })}{' '}
                    <a className="text-lapis underline" href={spHref(`guide/${guide.slug}`)}>
                      {s.open}
                    </a>
                  </dd>
                </div>
                {o.kind === 'recommended' && (
                  <div>
                    <dt className="text-xs font-semibold text-ink/60">{s.ocRestrictions}</dt>
                    <dd>{s.ocRestrictionsText}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-ink/60">{s.evidence}</p>
                <SourceList refs={o.evidence} compact />
              </div>
            </details>
          );
        })}
      </div>
    </Panel>
  );
}

export default function FastingCalendarView({ mode }: { mode: 'fasting' | 'calendar' }) {
  const { s, lang } = useSp();
  const [prefs] = useCalendarPrefs();
  const today = todayIn(prefs.timezone);
  const [view, setView] = useState<'gregorian' | 'hijri'>(mode === 'calendar' ? 'hijri' : 'gregorian');
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const title = mode === 'fasting' ? s.fcTitle : s.calTitle;

  useEffect(() => {
    document.title = `${title} · ${s.title} · ${s.brand}`;
  }, [title, s]);

  const days = useMemo(() => monthDays(anchor, view, prefs).map(iso => describeDay(iso, prefs)), [anchor, view, prefs]);
  const first = days[0];
  const last = days[days.length - 1];
  const lead = first ? new Date(`${first.iso}T00:00:00Z`).getUTCDay() : 0;
  const heading =
    view === 'gregorian'
      ? formatIso(lang, anchor, { month: 'long', year: 'numeric' })
      : `${hijriMonthName(lang, first.hijri.month)} ${first.hijri.year}`;
  const sub = view === 'gregorian' ? `${hijriLabel(lang, first.hijri)} – ${hijriLabel(lang, last.hijri)}` : `${formatIso(lang, first.iso)} – ${formatIso(lang, last.iso)}`;

  const step = (dir: 1 | -1) => {
    if (view === 'gregorian') {
      const [y, m] = anchor.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + dir, 1));
      setAnchor(d.toISOString().slice(0, 10));
    } else {
      setAnchor(dir === 1 ? addDays(last.iso, 1) : addDays(first.iso, -1));
    }
  };

  const selectedDay = describeDay(selected, prefs);
  const crumbs =
    mode === 'fasting'
      ? [{ href: spHref(), label: s.sectionHome }, { href: spHref('fasting'), label: findTopic('fasting')!.title[lang] }, { label: title }]
      : [{ href: spHref(), label: s.sectionHome }, { label: title }];

  return (
    <div>
      <Breadcrumbs items={crumbs} />
      <SectionBand title={title} subtitle={s.fcDisclaimer} topic="fasting" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div role="group" aria-label={s.fcView} className="flex gap-2">
                <Pill active={view === 'gregorian'} onClick={() => setView('gregorian')}>
                  {s.fcGregorian}
                </Pill>
                <Pill active={view === 'hijri'} onClick={() => setView('hijri')}>
                  {s.fcHijri}
                </Pill>
              </div>
              <div className="flex items-center gap-1">
                <SpButton variant="ghost" aria-label={s.fcPrev} onClick={() => step(-1)}>
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </SpButton>
                <SpButton
                  variant="soft"
                  onClick={() => {
                    setAnchor(today);
                    setSelected(today);
                  }}
                >
                  {s.today}
                </SpButton>
                <SpButton variant="ghost" aria-label={s.fcNext} onClick={() => step(1)}>
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </SpButton>
              </div>
            </div>
            <h2 className="font-display text-2xl font-bold text-emerald" aria-live="polite">
              {heading}
            </h2>
            <p className="mb-4 text-xs text-ink/60">{sub}</p>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-ink/55" aria-hidden>
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i}>{weekdayShort(lang, i)}</span>
              ))}
            </div>
            <ol className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: lead }, (_, i) => (
                <li key={`lead-${i}`} aria-hidden />
              ))}
              {days.map(d => {
                const st = STATUS_STYLE[d.status];
                const primary = view === 'gregorian' ? Number(d.iso.slice(8)) : d.hijri.day;
                const secondary = view === 'gregorian' ? d.hijri.day : Number(d.iso.slice(8));
                const label = `${formatIso(lang, d.iso, { weekday: 'long', day: 'numeric', month: 'long' })}, ${hijriLabel(lang, d.hijri)}${d.status !== 'ordinary' ? `, ${s[`status_${d.status}` as SpKey]}` : ''}`;
                return (
                  <li key={d.iso}>
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={selected === d.iso}
                      onClick={() => setSelected(d.iso)}
                      className={`relative flex aspect-square w-full flex-col items-center justify-center rounded-xl text-sm transition ${st.cell} ${selected === d.iso ? 'outline-2 outline-offset-1 outline-emerald' : ''} ${d.iso === today ? 'font-bold underline decoration-gilt decoration-2 underline-offset-4' : ''}`}
                    >
                      <span>{primary}</span>
                      <span className="text-[10px] opacity-70">{secondary}</span>
                      {st.mark && (
                        <span className="absolute right-1 top-0.5 text-[9px]" aria-hidden>
                          {st.mark}
                        </span>
                      )}
                      {d.hijriStatus === 'confirmed' && <span className="absolute bottom-0.5 left-1 h-1 w-1 rounded-full bg-current" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold text-ink/60">{s.fcKey}</p>
              <ul className="flex flex-wrap gap-2 text-xs">
                {(['obligatory', 'prohibited', 'recommended', 'restricted'] as const).map(k => (
                  <li key={k} className={`rounded-full px-2.5 py-0.5 ${STATUS_STYLE[k].cell}`}>
                    <span aria-hidden>{STATUS_STYLE[k].mark}</span> {s[`status_${k}`]}
                  </li>
                ))}
                <li className="rounded-full bg-white px-2.5 py-0.5 ring-1 ring-emerald/15">• {s.fcConfirmed}</li>
              </ul>
              <p className="mt-2 text-xs text-ink/60">{prefs.authority ? fmt(s.fcAuthorityShown, { name: prefs.authority }) : s.fcAuthorityNone}</p>
            </div>
          </Panel>
          {mode === 'fasting' && <OccasionGuides />}
        </div>
        <div className="space-y-6">
          <Panel>
            <PanelTitle as="h3">{s.fcSelected}</PanelTitle>
            <DayDetail day={selectedDay} />
          </Panel>
          {mode === 'fasting' && <RemindersPanel />}
          <CalendarSettings />
          {mode === 'fasting' && (
            <a href={spHref('fasting/planner')} className="block rounded-2xl bg-emerald px-5 py-4 font-semibold text-ivory hover:bg-emerald-deep">
              {s['tool_fasting-planner']} →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

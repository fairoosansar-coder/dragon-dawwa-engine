import { useMemo, useState } from 'react';
import { useRemote } from '../lib/api.ts';
import { useStored } from '../lib/store.tsx';
import { OCCASIONS, occasionById, text } from './content.ts';
import {
  buildReminders,
  canSchedule,
  evaluateHijriDay,
  hijriKey,
  isRestrictedHijri,
  resolveIntentionIso,
  type FastingIntention,
} from './fasting.ts';
import {
  gregorianToHijri,
  hijriWithShift,
  isoDateInZone,
  monthGrid,
  parseIsoDate,
  toIsoDate,
  type HijriDate,
} from './hijri.ts';
import { HIJRI_MONTHS_EN } from './hijri.ts';
import { Banner, Field, PageBack, Panel, Prose, control, useSp } from './chrome.tsx';
import { VerseCard } from '../components/cards.tsx';
import type { Verse } from '../shared/types.ts';

interface CalPrefs {
  authority: 'tabular' | 'shifted' | 'aladhan';
  shift: number;
  timezone: string;
}

interface Plan {
  intentions: FastingIntention[];
  notes: Record<string, string>;
  tracking: boolean;
  reminders: boolean;
  makeup: { id: string; text: string }[];
}

interface AladhanMonth {
  method: string;
  lunarSighting: boolean;
  source: string;
  days: { iso: string; year: number; month: number; day: number; monthName: string }[];
}

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

function zoneOk(zone: string): boolean {
  try {
    Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function useCalendarPrefs() {
  return useStored<CalPrefs>('kf-calendar-pref', { authority: 'tabular', shift: 0, timezone: deviceZone() });
}

function usePlan() {
  return useStored<Plan>('kf-fasting-plan', { intentions: [], notes: {}, tracking: false, reminders: false, makeup: [] });
}

export function FastingCalendar({ segments, mode }: { segments: string[]; mode: 'calendar' | 'planner' }) {
  const { lang, s } = useSp();
  const [prefs, setPrefs] = useCalendarPrefs();
  const [plan, setPlan] = usePlan();
  const zone = zoneOk(prefs.timezone) ? prefs.timezone : 'UTC';
  const todayIso = isoDateInZone(new Date(), zone);
  const today = parseIsoDate(todayIso) ?? { year: 2026, month: 10, day: 21 };
  const [cursor, setCursor] = useState({ year: today.year, month: today.month });
  const [selected, setSelected] = useState(todayIso);
  const remote = useRemote<AladhanMonth>(prefs.authority === 'aladhan' ? `/api/hijri-month?year=${cursor.year}&month=${cursor.month}` : null);
  const aladhan = useMemo(() => {
    const map = new Map<string, HijriDate>();
    const reverse = new Map<string, string>();
    for (const day of remote.data?.days ?? []) {
      const hijri = { year: day.year, month: day.month, day: day.day };
      map.set(day.iso, hijri);
      reverse.set(hijriKey(hijri), day.iso);
    }
    return { map, reverse };
  }, [remote.data]);

  function labelFor(iso: string): HijriDate | null {
    const date = parseIsoDate(iso);
    if (!date) return null;
    if (prefs.authority === 'aladhan') return aladhan.map.get(iso) ?? null;
    if (prefs.authority === 'shifted') return hijriWithShift(date, prefs.shift);
    return gregorianToHijri(date);
  }

  const days = monthGrid(cursor.year, cursor.month);
  const selectedHijri = labelFor(selected);
  const selectedGregorian = parseIsoDate(selected);
  const evaluation = selectedHijri && selectedGregorian ? evaluateHijriDay(selectedHijri, selectedGregorian) : null;
  const resolved = plan.intentions.map(item => {
    const iso = resolveIntentionIso(item.hijri, prefs.authority, prefs.shift, prefs.authority === 'aladhan' ? aladhan.reverse : null);
    const gregorian = iso ? parseIsoDate(iso) : null;
    const blocked = gregorian ? !canSchedule(item.hijri, gregorian).ok : isRestrictedHijri(item.hijri);
    return { ...item, iso, blocked, pending: iso === null };
  });
  const reminders = plan.reminders && plan.tracking ? buildReminders(
    resolved.filter(item => item.iso).map(item => ({ ...item, iso: item.iso as string })),
    true,
  ) : [];

  function addIntention(kind: 'voluntary' | 'makeup') {
    if (!selectedHijri || !selectedGregorian) return;
    if (!canSchedule(selectedHijri, selectedGregorian).ok) return;
    const id = `${kind}:${hijriKey(selectedHijri)}`;
    setPlan(current => (current.intentions.some(item => item.id === id) ? current : { ...current, intentions: [...current.intentions, { id, kind, hijri: selectedHijri }] }));
  }

  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <h1 className="font-display text-3xl font-bold text-dd-emerald">{mode === 'planner' ? s.makeup : s.toolFasting}</h1>
        <Banner>{s.provisional}</Banner>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={s.authority}>
            <select className={control} value={prefs.authority} onChange={event => setPrefs({ ...prefs, authority: event.target.value as CalPrefs['authority'] })}>
              <option value="tabular">{s.tabular}</option>
              <option value="shifted">{s.shifted}</option>
              <option value="aladhan">{s.aladhan}</option>
            </select>
          </Field>
          <Field label={s.timezone}>
            <input className={control} value={prefs.timezone} onChange={event => setPrefs({ ...prefs, timezone: event.target.value })} />
          </Field>
          {prefs.authority === 'shifted' && (
            <Field label={s.shift}>
              <input className={control} type="number" min={-3} max={3} value={prefs.shift} onChange={event => setPrefs({ ...prefs, shift: Number(event.target.value) })} />
            </Field>
          )}
        </div>
        <p className="mt-2 text-sm">
          {s.calculated}
          {prefs.authority === 'aladhan' && remote.data ? ` · ${remote.data.source} · ${remote.data.method}` : ''}
          {prefs.authority === 'aladhan' && remote.data && !remote.data.lunarSighting ? ` · ${s.provisional}` : ''}
        </p>
        {remote.error && (
          <p className="mt-2 text-sm">
            {remote.error}{' '}
            <button type="button" onClick={remote.reload}>
              {s.retry}
            </button>
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => setCursor(current => stepMonth(current, -1))}>
            {s.prev}
          </button>
          <p className="flex items-center font-semibold">
            {cursor.year}-{String(cursor.month).padStart(2, '0')}
          </p>
          <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => setCursor(current => stepMonth(current, 1))}>
            {s.next}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs sm:text-sm">
          {days.map(day => {
            const iso = toIsoDate(day);
            const hijri = labelFor(iso);
            const blocked = hijri ? isRestrictedHijri(hijri) : false;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={`min-h-14 rounded-xl px-1 py-2 ${iso === selected ? 'bg-dd-emerald text-dd-ivory' : blocked ? 'bg-dd-gold/30' : 'bg-white'} ${iso === todayIso ? 'ring-2 ring-dd-lapis' : ''}`}
              >
                <span className="block font-semibold">{day.day}</span>
                <span className="block text-[10px] leading-tight">{hijri ? hijri.day : '…'}</span>
              </button>
            );
          })}
        </div>
      </Panel>
      <Panel>
        <h2 className="font-display text-2xl font-bold text-dd-emerald">{selected}</h2>
        {selectedHijri ? (
          <p>
            {selectedHijri.day} {HIJRI_MONTHS_EN[selectedHijri.month - 1]} {selectedHijri.year}
          </p>
        ) : (
          <p>{s.pendingDate}</p>
        )}
        {evaluation?.blocksVoluntaryFast && <Banner>{s.restricted}</Banner>}
        {evaluation && evaluation.overridden.length > 0 && (
          <p className="mt-2 text-sm">
            {s.override} {evaluation.overridden.join(', ')}
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {evaluation?.occasions.map(item => {
            const copy = occasionById(item.id);
            return (
              <li key={item.id}>
                <a className="font-medium text-dd-emerald underline" href={`#/spiritual/fasting/occasions/${item.id}`}>
                  {copy ? text(copy.title, lang) : item.id}
                </a>
              </li>
            );
          })}
        </ul>
        {mode === 'planner' && (
          <div className="mt-4 space-y-3">
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={plan.tracking} onChange={event => setPlan({ ...plan, tracking: event.target.checked })} />
              {s.tracking}
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={plan.reminders} onChange={event => setPlan({ ...plan, reminders: event.target.checked })} />
              {s.reminders}
            </label>
            <p className="text-sm">{plan.tracking ? s.remindersHint : s.trackingOff}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory disabled:opacity-40" disabled={!selectedHijri || !selectedGregorian || !canSchedule(selectedHijri, selectedGregorian).ok} onClick={() => addIntention('voluntary')}>
                {s.schedule}
              </button>
              <button
                type="button"
                className="min-h-11 rounded-full bg-white px-4"
                onClick={() => selectedHijri && setPlan(current => ({ ...current, intentions: current.intentions.filter(item => hijriKey(item.hijri) !== hijriKey(selectedHijri)) }))}
              >
                {s.unschedule}
              </button>
            </div>
            <label className="block text-sm">
              {s.note}
              <textarea className={`${control} mt-1 w-full`} rows={3} value={plan.notes[selected] ?? ''} onChange={event => setPlan({ ...plan, notes: { ...plan.notes, [selected]: event.target.value.slice(0, 500) } })} />
            </label>
          </div>
        )}
      </Panel>
      {mode === 'planner' && (
        <Panel>
          <h2 className="font-display text-2xl font-bold text-dd-emerald">{s.makeup}</h2>
          <p className="text-sm">{s.makeupHint}</p>
          <button type="button" className="mt-3 min-h-11 rounded-full bg-white px-4" onClick={() => setPlan({ ...plan, makeup: [...plan.makeup, { id: crypto.randomUUID(), text: '' }] })}>
            {s.addMakeup}
          </button>
          <ul className="mt-3 space-y-2">
            {plan.makeup.map(item => (
              <li key={item.id} className="flex gap-2">
                <input className={`${control} flex-1`} value={item.text} onChange={event => setPlan({ ...plan, makeup: plan.makeup.map(row => (row.id === item.id ? { ...row, text: event.target.value.slice(0, 160) } : row)) })} />
                <button type="button" className="min-h-11 px-3" onClick={() => setPlan({ ...plan, makeup: plan.makeup.filter(row => row.id !== item.id) })}>
                  {s.remove}
                </button>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 font-semibold">{s.reminders}</h3>
          {!plan.reminders || !plan.tracking ? <p className="text-sm">{s.trackingOff}</p> : null}
          <ul className="mt-2 text-sm">
            {reminders.map(item => (
              <li key={item.iso}>
                {item.iso}: {item.ids.join(', ')}
              </li>
            ))}
            {resolved.filter(item => item.pending).map(item => (
              <li key={item.id}>{s.pendingDate}</li>
            ))}
          </ul>
        </Panel>
      )}
      {mode === 'calendar' && (
        <Panel>
          <h2 className="font-display text-2xl font-bold text-dd-emerald">{s.occasions}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {OCCASIONS.map(item => (
              <li key={item.id}>
                <a className="block min-h-11 rounded-2xl bg-dd-ivory px-3 py-3 text-dd-emerald" href={`#/spiritual/fasting/occasions/${item.id}`}>
                  {text(item.title, lang)}
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function stepMonth(cursor: { year: number; month: number }, delta: number) {
  const month = cursor.month + delta;
  if (month < 1) return { year: cursor.year - 1, month: 12 };
  if (month > 12) return { year: cursor.year + 1, month: 1 };
  return { year: cursor.year, month };
}

export function OccasionView({ segments, id }: { segments: string[]; id: string }) {
  const { lang, s } = useSp();
  const occasion = occasionById(id);
  const refs = occasion?.verseRefs ?? [];
  const remote = useRemote<Verse[]>(refs.length ? `/api/quran/verses?refs=${encodeURIComponent(refs.join(','))}&lang=${lang}` : null);
  if (!occasion) {
    return (
      <Panel>
        <PageBack segments={segments} />
        <p>{s.searchEmpty}</p>
      </Panel>
    );
  }
  const blocks: [string, typeof occasion.meaning][] = [
    [s.slotMeaning, occasion.meaning],
    [s.sources, occasion.evidence],
    [s.slotPreparation, occasion.conditions],
    [s.slotWho, occasion.who],
    [s.date, occasion.dateBasis],
    [s.slotOpinions, occasion.differences],
    [s.restricted, occasion.restrictions],
  ];
  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <article className="dd-plain">
        <p className="text-xs font-semibold uppercase tracking-widest text-dd-emerald">{s.notReviewed}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-dd-emerald">{text(occasion.title, lang)}</h1>
        <Banner>{s.provisional}</Banner>
        {blocks.map(([title, copy]) => (
          <section key={title} className="mt-5">
            <h2 className="font-display text-xl font-bold text-dd-emerald">{title}</h2>
            <Prose copy={copy} />
          </section>
        ))}
        {remote.data?.map(verse => (
          <VerseCard key={verse.key} verse={verse} />
        ))}
        <p className="mt-4 text-xs">{s.audioNotSpoken}</p>
      </article>
    </div>
  );
}


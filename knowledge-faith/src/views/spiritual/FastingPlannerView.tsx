import { useEffect, useMemo, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { checkFastDate, describeRange, OCCASIONS, suggestMakeupDates, todayIn, voluntarySuggestions } from '../../shared/spiritual/calendar.ts';
import { findTopic } from '../../shared/spiritual/catalog.ts';
import { fmt } from '../../lib/i18nSpiritual.ts';
import { formatIso, spHref } from '../../lib/spiritualFormat.ts';
import { deleteSectionData, KEYS, useCalendarPrefs, useFastingLog, useMakeup, useSp, useVoluntary } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Field, inputClass, Panel, PanelTitle, SectionBand, SpButton } from '../../components/spiritual/ornaments.tsx';
import { hijriLabel, occasionName } from './FastingCalendarView.tsx';

const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };

function LogPanel({ today }: { today: string }) {
  const { s, lang } = useSp();
  const [prefs] = useCalendarPrefs();
  const [log, setLog] = useFastingLog();
  const [date, setDate] = useState(today);
  const check = date ? checkFastDate(date, prefs) : null;
  const entries = Object.entries(log.entries).sort(([a], [b]) => b.localeCompare(a));

  const mark = (value: 'fasted' | 'makeup' | null) =>
    setLog(l => {
      const next = { ...l.entries };
      if (value) next[date] = value;
      else delete next[date];
      return { ...l, entries: next };
    });

  return (
    <Panel>
      <PanelTitle as="h3">{s.fpLog}</PanelTitle>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={log.enabled} onChange={e => setLog(l => ({ ...l, enabled: e.target.checked }))} />
        {s.fpTracking}
      </label>
      {!log.enabled ? (
        <p className="mt-2 text-sm text-ink/60">{s.fpTrackingOff}</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Field label={s.date} htmlFor="fp-date">
              <input id="fp-date" type="date" max={today} className={inputClass} value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <SpButton variant={log.entries[date] === 'fasted' ? 'primary' : 'soft'} disabled={!date} onClick={() => mark('fasted')}>
              {s.fpMarkFasted}
            </SpButton>
            <SpButton variant={log.entries[date] === 'makeup' ? 'primary' : 'soft'} disabled={!date} onClick={() => mark('makeup')}>
              {s.fpMarkMakeup}
            </SpButton>
            <SpButton variant="ghost" disabled={!date || !log.entries[date]} onClick={() => mark(null)}>
              {s.fpClear}
            </SpButton>
          </div>
          {check && !check.ok && <Callout tone="caution">{check.code === 'prohibited' ? s.fpProhibited : s.fpRamadan}</Callout>}
          {date && (
            <Field label={s.fpNote} htmlFor="fp-note">
              <input
                id="fp-note"
                className={inputClass}
                maxLength={200}
                value={log.notes[date] ?? ''}
                onChange={e => setLog(l => ({ ...l, notes: { ...l.notes, [date]: e.target.value } }))}
              />
            </Field>
          )}
          {entries.length === 0 ? (
            <p className="text-sm text-ink/60">{s.fpNoEntries}</p>
          ) : (
            <ul className="divide-y divide-emerald/10 text-sm">
              {entries.map(([iso, kind]) => (
                <li key={iso} className="py-2">
                  <span className="font-medium">{formatIso(lang, iso, dateOpts)}</span> · {kind === 'fasted' ? s.fpMarkFasted : s.fpMarkMakeup}
                  {log.notes[iso] && <span className="block text-xs text-ink/60">{log.notes[iso]}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function MakeupPanel({ today }: { today: string }) {
  const { s, lang } = useSp();
  const [prefs] = useCalendarPrefs();
  const [plan, setPlan] = useMakeup();
  const [suggested, setSuggested] = useState<string[]>([]);
  const [pick, setPick] = useState('');
  const pickCheck = pick ? checkFastDate(pick, prefs) : null;
  const remaining = plan.dates.filter(d => !plan.done.includes(d)).length;
  const needed = Math.max(0, plan.intended - plan.dates.length);

  const add = (dates: string[]) => setPlan(p => ({ ...p, dates: [...new Set([...p.dates, ...dates])].sort() }));

  return (
    <Panel>
      <PanelTitle as="h3">{s.fpMakeupTitle}</PanelTitle>
      <Field label={s.fpOwed} hint={s.fpOwedHint} htmlFor="fp-owed">
        <input
          id="fp-owed"
          type="number"
          min={0}
          max={400}
          className={`${inputClass} w-32`}
          value={plan.intended}
          onChange={e => setPlan(p => ({ ...p, intended: Math.max(0, Math.min(400, Math.floor(Number(e.target.value) || 0))) }))}
        />
      </Field>
      <div className="mt-4 flex flex-wrap gap-2">
        <SpButton variant="soft" disabled={needed === 0} onClick={() => setSuggested(suggestMakeupDates(today, needed, prefs, plan.dates))}>
          {s.fpSuggest}
        </SpButton>
      </div>
      {suggested.length > 0 && (
        <div className="mt-4 rounded-2xl bg-ivory/60 p-4">
          <p className="mb-2 text-sm font-semibold text-emerald">{s.fpSuggested}</p>
          <ul className="flex flex-wrap gap-1.5 text-xs">
            {suggested.map(d => (
              <li key={d} className="rounded-full bg-white px-2.5 py-1 ring-1 ring-emerald/15">
                {formatIso(lang, d, dateOpts)}
              </li>
            ))}
          </ul>
          <SpButton
            className="mt-3"
            onClick={() => {
              add(suggested);
              setSuggested([]);
            }}
          >
            {s.fpPlan}
          </SpButton>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field label={s.fpPick} htmlFor="fp-pick">
          <input id="fp-pick" type="date" min={today} className={inputClass} value={pick} onChange={e => setPick(e.target.value)} />
        </Field>
        <SpButton
          variant="soft"
          disabled={!pickCheck?.ok}
          onClick={() => {
            add([pick]);
            setPick('');
          }}
        >
          {s.add}
        </SpButton>
      </div>
      {pickCheck && !pickCheck.ok && (
        <p role="alert" className="mt-2 text-sm text-red-900">
          {pickCheck.code === 'prohibited' ? s.fpProhibited : s.fpRamadan}
        </p>
      )}
      {plan.dates.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-emerald">{s.fpPlanned}</p>
          <p className="mb-2 text-xs text-ink/60">{fmt(s.fpRemaining, { n: remaining })}</p>
          <ul className="divide-y divide-emerald/10 text-sm">
            {plan.dates.map(d => {
              const done = plan.done.includes(d);
              return (
                <li key={d} className="flex items-center justify-between gap-2 py-2">
                  <span className={done ? 'text-ink/50 line-through' : ''}>{formatIso(lang, d, dateOpts)}</span>
                  <span className="flex items-center gap-2">
                    <SpButton
                      variant={done ? 'primary' : 'soft'}
                      aria-pressed={done}
                      onClick={() => setPlan(p => ({ ...p, done: done ? p.done.filter(x => x !== d) : [...p.done, d] }))}
                    >
                      <Check className="h-4 w-4" aria-hidden /> {s.fpDone}
                    </SpButton>
                    <button
                      type="button"
                      className="text-red-800"
                      aria-label={`${s.remove}: ${formatIso(lang, d)}`}
                      onClick={() => setPlan(p => ({ ...p, dates: p.dates.filter(x => x !== d), done: p.done.filter(x => x !== d) }))}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function VoluntaryPanel({ today }: { today: string }) {
  const { s, lang } = useSp();
  const [prefs] = useCalendarPrefs();
  const [wanted, setWanted] = useVoluntary();
  const upcoming = useMemo(() => voluntarySuggestions(describeRange(today, 60, prefs), wanted).slice(0, 12), [today, prefs, wanted]);
  return (
    <Panel>
      <PanelTitle as="h3" sub={s.fpVoluntaryHint}>
        {s.fpVoluntaryTitle}
      </PanelTitle>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {OCCASIONS.filter(o => o.kind === 'recommended').map(o => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wanted.includes(o.id)}
              onChange={e => setWanted(w => (e.target.checked ? [...w, o.id] : w.filter(x => x !== o.id)))}
            />
            {occasionName(s, o.id)}
          </label>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-emerald/10 text-sm">
        {upcoming.map(d => (
          <li key={d.iso} className="py-2">
            <span className="font-medium">{formatIso(lang, d.iso, dateOpts)}</span>
            <span className="block text-xs text-ink/60">
              {hijriLabel(lang, d.hijri)} ({d.hijriStatus === 'confirmed' ? s.fcConfirmed : s.fcProvisional}) ·{' '}
              {d.occasions.filter(o => wanted.includes(o)).map(o => occasionName(s, o)).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export default function FastingPlannerView() {
  const { s, lang } = useSp();
  const [prefs] = useCalendarPrefs();
  const today = todayIn(prefs.timezone);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    document.title = `${s.fpTitle} · ${s.title} · ${s.brand}`;
  }, [s]);

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { href: spHref('fasting'), label: findTopic('fasting')!.title[lang] }, { label: s.fpTitle }]} />
      <SectionBand title={s.fpTitle} subtitle={s.fpIntro} topic="fasting" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Callout tone="caution">{s.fpMedical}</Callout>
          <MakeupPanel today={today} />
          <Callout tone="info">{s.fpFidyah}</Callout>
        </div>
        <div className="space-y-6">
          <VoluntaryPanel today={today} />
          <LogPanel today={today} />
          <Panel>
            <Callout tone="privacy">{s.privacyFooter}</Callout>
            <SpButton
              variant="danger"
              className="mt-3"
              onClick={() => {
                if (!window.confirm(s.fpConfirmDelete)) return;
                deleteSectionData([KEYS.fastingLog, KEYS.makeup, KEYS.voluntary]);
                setDeleted(true);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> {s.fpDeleteAll}
            </SpButton>
            {deleted && (
              <p role="status" className="mt-2 text-sm text-emerald">
                {s.svDeleted}
              </p>
            )}
          </Panel>
        </div>
      </div>
      <p className="mt-6 text-sm">
        <a href={spHref('fasting/calendar')} className="font-semibold text-lapis underline">
          {s.fcTitle} →
        </a>
      </p>
    </div>
  );
}

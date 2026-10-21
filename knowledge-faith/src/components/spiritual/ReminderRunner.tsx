import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { addDays, dueReminders, planReminders, todayIn, type Reminder } from '../../shared/spiritual/calendar.ts';
import { fmt, type SpKey } from '../../lib/i18nSpiritual.ts';
import { formatIso, spHref } from '../../lib/spiritualFormat.ts';
import { useCalendarPrefs, useFiredReminders, useMakeup, useReminderPrefs, useSp } from '../../lib/spiritualStore.ts';

const CHECK_MS = 60_000;
const KEEP_FIRED = 200;

/**
 * Shows fasting reminders while the app is open. Reminders are planned from the current calendar settings each
 * time, so a change of authority, offset or timezone takes effect immediately; nothing is sent to a server.
 */
export function ReminderRunner() {
  const { s, lang } = useSp();
  const [prefs] = useCalendarPrefs();
  const [rem] = useReminderPrefs();
  const [makeup] = useMakeup();
  const [fired, setFired] = useFiredReminders();
  const [shown, setShown] = useState<Reminder[]>([]);

  useEffect(() => {
    if (!rem.enabled) return;
    const check = () => {
      const today = todayIn(prefs.timezone);
      const plan = planReminders(addDays(today, -1), 3, prefs, rem, makeup.dates.filter(d => !makeup.done.includes(d)));
      const due = dueReminders(plan, Date.now(), fired);
      if (!due.length) return;
      for (const r of due) {
        const what = [...r.occasions.map(o => s[`oc_${o}` as SpKey]), ...(r.makeup ? [s.rmMakeupLabel] : [])].join(' · ');
        const body = fmt(s.rmTomorrow, { what });
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(s.rmDue, { body, tag: r.key });
          } catch {
            /* some browsers only allow notifications from a service worker */
          }
        }
      }
      setShown(cur => [...cur, ...due.filter(d => !cur.some(c => c.key === d.key))]);
      setFired(f => [...f, ...due.map(d => d.key)].slice(-KEEP_FIRED));
    };
    check();
    const id = setInterval(check, CHECK_MS);
    return () => clearInterval(id);
  }, [rem, prefs, makeup, fired, setFired, s]);

  if (!shown.length) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md space-y-2 lg:bottom-6" role="region" aria-label={s.rmTitle}>
      {shown.map(r => (
        <div key={r.key} role="status" className="flex items-start gap-3 rounded-2xl bg-emerald px-4 py-3 text-sm text-ivory shadow-xl ring-1 ring-gilt/40">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-gilt" aria-hidden />
          <a href={spHref('fasting/calendar')} className="flex-1">
            <span className="block font-semibold">{fmt(s.rmFor, { date: formatIso(lang, r.forDate, { weekday: 'long', day: 'numeric', month: 'long' }) })}</span>
            <span className="block text-ivory/85">
              {[...r.occasions.map(o => s[`oc_${o}` as SpKey]), ...(r.makeup ? [s.rmMakeupLabel] : [])].join(' · ')}
            </span>
          </a>
          <button type="button" aria-label={s.rmDismiss} onClick={() => setShown(cur => cur.filter(c => c.key !== r.key))} className="rounded-full p-1 hover:bg-ivory/15">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

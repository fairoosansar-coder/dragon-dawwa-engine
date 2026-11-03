import React from 'react';
import { SupportedLanguage } from '../utils/localization';
import { widgetText } from './widgetI18n';
import { prayers, prayerUrl, parsePrayerResponse, PrayerResult } from './prayerTimes';
const input = 'w-full min-w-0 rounded-lg border border-slate-700 bg-[var(--surface-panel)] p-2 text-sm';
export function PrayerWidget({ language }: { language: SupportedLanguage }) {
  const t = (key: Parameters<typeof widgetText>[1]) => widgetText(language, key);
  const [latitude, setLatitude] = React.useState('');
  const [longitude, setLongitude] = React.useState('');
  const [date, setDate] = React.useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [method, setMethod] = React.useState('3');
  const [school, setSchool] = React.useState('0');
  const [result, setResult] = React.useState<PrayerResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<'locationError' | 'prayerError' | null>(null);
  const controller = React.useRef<AbortController | null>(null);
  const sequence = React.useRef(0);
  const invalidate = () => { sequence.current++; controller.current?.abort(); setResult(null); setError(null); setBusy(false); };
  React.useEffect(() => () => { sequence.current++; controller.current?.abort(); }, []);
  function locate() {
    invalidate(); const request = sequence.current; setBusy(true);
    if (!navigator.geolocation) { setError('locationError'); setBusy(false); return; }
    navigator.geolocation.getCurrentPosition(p => {
      if (request !== sequence.current) return;
      setLatitude(p.coords.latitude.toFixed(5)); setLongitude(p.coords.longitude.toFixed(5)); setBusy(false);
    }, () => { if (request === sequence.current) { setError('locationError'); setBusy(false); } }, { timeout: 10000, maximumAge: 300000 });
  }
  async function load(e: React.FormEvent) {
    e.preventDefault(); invalidate(); const request = sequence.current;
    const abort = new AbortController(); controller.current = abort; setBusy(true);
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const { url, day } = prayerUrl(latitude, longitude, date, method, school);
      const response = await fetch(url, { signal: abort.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Provider unavailable');
      const data = parsePrayerResponse(await response.json(), day);
      if (request === sequence.current) setResult(data);
    } catch { if (request === sequence.current) setError('prayerError'); }
    finally { clearTimeout(timeout); if (request === sequence.current) setBusy(false); }
  }
  return <form onSubmit={load} className="space-y-3" data-testid="prayer-widget">
    <button type="button" className={`${input} cursor-pointer`} disabled={busy} onClick={locate}>{t('location')}</button>
    <div className="grid grid-cols-2 gap-2">{[[latitude, setLatitude, 'latitude', 90], [longitude, setLongitude, 'longitude', 180]].map(([value, setter, label, limit]) => <label key={label as string} className="text-xs min-w-0">{t(label as 'latitude' | 'longitude')}<input required className={input} type="number" step="any" min={-(limit as number)} max={limit as number} value={value as string} onChange={e => { invalidate(); (setter as typeof setLatitude)(e.target.value); }} /></label>)}</div>
    <label className="block text-xs">{t('date')}<input required className={input} type="date" value={date} onChange={e => { invalidate(); setDate(e.target.value); }} /></label>
    <label className="block text-xs">{t('method')}<select className={input} value={method} onChange={e => { invalidate(); setMethod(e.target.value); }}><option value="3">Muslim World League</option><option value="1">University of Islamic Sciences, Karachi</option><option value="4">Umm Al-Qura, Makkah</option><option value="16">Dubai</option></select></label>
    <label className="block text-xs">{t('asr')}<select className={input} value={school} onChange={e => { invalidate(); setSchool(e.target.value); }}><option value="0">{t('standard')}</option><option value="1">{t('hanafi')}</option></select></label>
    <p className="text-xs text-slate-400">{t('privacy')}</p>
    <button disabled={busy} className="w-full rounded-lg bg-amber-500 text-[var(--on-gold)] p-2 text-sm disabled:opacity-50">{t(busy ? 'loading' : 'load')}</button>
    {error && <p role="alert" className="text-sm text-red-400">{t(error)}</p>}
    {result && <div aria-live="polite" className="space-y-2"><p className="text-xs">{result.date} · {t('timezone')}: {result.timezone}</p>{prayers.map(name => <div key={name} className="flex justify-between border-b border-slate-700 pb-1 text-sm"><span>{t(name)}</span><time>{result.timings[name]}</time></div>)}</div>}
    <p className="text-xs text-slate-400">{t('prayerNote')}</p><a className="text-xs underline" href="https://aladhan.com/prayer-times-api" target="_blank" rel="noreferrer">{t('source')}</a>
  </form>;
}

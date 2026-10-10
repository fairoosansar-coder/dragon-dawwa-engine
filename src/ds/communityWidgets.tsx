import React from 'react';
import { SupportedLanguage } from '../utils/localization';

type Widget = 'calendar' | 'prayers' | 'pillars' | 'zakat' | 'daily';
type Placement = { id: Widget; side: 'left' | 'right'; visible: boolean };
const defaults: Placement[] = [
  { id: 'calendar', side: 'left', visible: true },
  { id: 'pillars', side: 'left', visible: true },
  { id: 'prayers', side: 'right', visible: true },
  { id: 'zakat', side: 'right', visible: true },
  { id: 'daily', side: 'right', visible: true },
];
const titles: Record<Widget, string[]> = {
  calendar: ['Islamic calendar', 'இஸ்லாமிய நாட்காட்டி', 'ඉස්ලාමීය දින දර්ශනය'],
  prayers: ['Prayer timetable', 'தொழுகை நேரங்கள்', 'සලාත් වේලාවන්'],
  pillars: ['Five pillars', 'ஐந்து கடமைகள்', 'ඉස්ලාමයේ කුලුනු පහ'],
  zakat: ['Zakat estimate', 'ஸகாத் மதிப்பீடு', 'සකාත් ඇස්තමේන්තුව'],
  daily: ['Daily inspiration & community', 'தினசரி நினைவூட்டல்கள்', 'දෛනික මතක් කිරීම්'],
};
const input = 'w-full min-w-0 rounded-lg border border-slate-700 bg-[var(--surface-panel)] p-2 text-sm';
const button = 'rounded-lg border border-slate-700 px-2 py-1 text-xs hover:border-amber-500 disabled:opacity-30';
const key = 'dd-community-panels-v1';
function readLayout(): Placement[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (Array.isArray(saved) && saved.length === defaults.length && new Set(saved.map(x => x.id)).size === defaults.length && saved.every(x => defaults.some(d => d.id === x.id) && ['left', 'right'].includes(x.side) && typeof x.visible === 'boolean')) return saved;
  } catch { /* storage is optional */ }
  return defaults.map(x => ({ ...x }));
}

function CalendarWidget({ language }: { language: SupportedLanguage }) {
  const [month, setMonth] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const locale = language === 'ta' ? 'ta-LK' : language === 'si' ? 'si-LK' : 'en-GB';
  const today = new Date();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return <div className="space-y-3">
    <p className="text-amber-400">{new Intl.DateTimeFormat(`${locale}-u-ca-islamic-civil`, { day: 'numeric', month: 'long', year: 'numeric' }).format(today)}</p>
    <div className="flex items-center justify-between gap-2"><button className={button} aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><span>{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</span><button className={button} aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs">{Array.from({ length: 7 }, (_, i) => <span key={`w${i}`}>{new Date(2026, 0, 4 + i).toLocaleDateString(locale, { weekday: 'narrow' })}</span>)}{Array.from({ length: month.getDay() }, (_, i) => <span key={`blank${i}`} />)}{Array.from({ length: days }, (_, i) => <span key={i} className={`rounded p-1 ${today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth() && today.getDate() === i + 1 ? 'bg-amber-500 text-[var(--on-gold)]' : ''}`}>{i + 1}</span>)}</div>
    <p className="text-xs text-slate-400">Calculated Hijri date; local moon sighting may differ. Grid shows Gregorian dates.</p>
  </div>;
}
function PrayerWidget() {
  const [place, setPlace] = React.useState('');
  const [date, setDate] = React.useState('');
  const [times, setTimes] = React.useState<Record<string, string>>({});
  return <div className="space-y-2"><p className="text-xs text-slate-400">Enter your mosque’s timetable for one date. These are not live calculated times.</p><label className="block text-xs">Mosque / city<input className={input} value={place} onChange={e => setPlace(e.target.value)} placeholder="Mosque or city" /></label><label className="block text-xs">Timetable date<input type="date" className={input} value={date} onChange={e => setDate(e.target.value)} /></label>{['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map(name => <label key={name} className="flex items-center justify-between gap-2 text-sm">{name}<input aria-label={`${name} time`} className={`${input} max-w-32`} type="time" value={times[name] || ''} onChange={e => setTimes(t => ({ ...t, [name]: e.target.value }))} /></label>)}<p className="text-xs text-slate-400">Temporary entries for this visit. Follow your local mosque for adhan and congregation times.</p></div>;
}
function ZakatWidget() {
  const [wealth, setWealth] = React.useState('');
  const [nisab, setNisab] = React.useState('');
  const [hawl, setHawl] = React.useState(false);
  const valid = wealth !== '' && nisab !== '' && Number.isFinite(+wealth) && Number.isFinite(+nisab) && +wealth >= 0 && +nisab > 0;
  return <div className="space-y-3"><p className="text-xs text-slate-400">Simple monetary-wealth estimate. Use the same currency for both amounts.</p><label className="block text-xs">Net zakatable wealth<input className={input} type="number" min="0" step="any" value={wealth} onChange={e => setWealth(e.target.value)} /></label><label className="block text-xs">Current nisab value<input className={input} type="number" min="0.01" step="any" value={nisab} onChange={e => setNisab(e.target.value)} /></label><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={hawl} onChange={e => setHawl(e.target.checked)} />I have confirmed the lunar-year (hawl) condition applies.</label><p aria-live="polite" className="font-semibold text-amber-400">{!valid ? 'Enter wealth and a positive nisab value.' : !hawl ? 'Confirm the hawl condition to estimate.' : +wealth < +nisab ? 'Below your entered nisab.' : `Estimated zakat: ${(+wealth * 0.025).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`}</p><p className="text-xs text-slate-400">2.5% estimate; asset treatment and deductions vary. Confirm eligibility and your chosen nisab with a qualified adviser. Values are not saved.</p><a href="https://islamic-relief.org/zakat/" target="_blank" rel="noreferrer" className="text-xs underline">Calculation guidance · Islamic Relief</a></div>;
}
export function useCommunityWidgets(language: SupportedLanguage, daily: React.ReactNode) {
  const [layout, setLayout] = React.useState(readLayout);
  const [editing, setEditing] = React.useState(false);
  const [saved, setSaved] = React.useState(true);
  const index = language === 'ta' ? 1 : language === 'si' ? 2 : 0;
  React.useEffect(() => { try { localStorage.setItem(key, JSON.stringify(layout)); setSaved(true); } catch { setSaved(false); } }, [layout]);
  const title = (id: Widget) => titles[id][index];
  const move = (id: Widget, direction: number) => setLayout(old => {
    const next = [...old]; const at = next.findIndex(x => x.id === id);
    const peers = next.map((x, i) => x.side === next[at].side ? i : -1).filter(i => i >= 0);
    const target = peers[peers.indexOf(at) + direction];
    if (target !== undefined) [next[at], next[target]] = [next[target], next[at]];
    return next;
  });
  const settings = <div className="rounded-2xl border border-slate-700 bg-[var(--surface-panel)] p-3 space-y-3"><button className={button} aria-expanded={editing} onClick={() => setEditing(!editing)}>{['Customize panels', 'பலகைகளைத் தனிப்பயனாக்கு', 'පැනල සකසන්න'][index]}</button>{editing && <><p className="text-xs text-slate-400">Show, move and reorder your widgets. {saved ? 'Layout saved in this browser.' : 'Storage unavailable; layout lasts for this visit.'}</p>{layout.map(w => <div key={w.id} className="flex flex-wrap items-center gap-2 border-b border-slate-700 pb-2"><label className="flex flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={w.visible} onChange={e => setLayout(l => l.map(x => x.id === w.id ? { ...x, visible: e.target.checked } : x))} />{title(w.id)}</label><select aria-label={`${title(w.id)} panel`} className="rounded border border-slate-700 bg-[var(--surface-panel)] p-1 text-xs" value={w.side} onChange={e => setLayout(l => l.map(x => x.id === w.id ? { ...x, side: e.target.value as Placement['side'] } : x))}><option value="left">Left</option><option value="right">Right</option></select>{[-1, 1].map(d => <button key={d} className={button} aria-label={`Move ${title(w.id)} ${d < 0 ? 'up' : 'down'}`} disabled={layout.filter(x => x.side === w.side)[d < 0 ? 0 : layout.filter(x => x.side === w.side).length - 1].id === w.id} onClick={() => move(w.id, d)}>{d < 0 ? '↑' : '↓'}</button>)}</div>)}<button className={button} onClick={() => setLayout(defaults.map(x => ({ ...x })))}>Reset layout</button></>}</div>;
  const panel = (side: Placement['side']) => <div className="space-y-5">{layout.filter(w => w.side === side && w.visible).map(w => <section key={w.id} className="rounded-2xl border border-slate-700 bg-[var(--surface-panel)] p-4 space-y-3 min-w-0"><h2 className="font-display text-lg text-amber-400">{title(w.id)}</h2>{w.id === 'calendar' ? <CalendarWidget language={language} /> : w.id === 'prayers' ? <PrayerWidget /> : w.id === 'zakat' ? <ZakatWidget /> : w.id === 'daily' ? daily : <ol className="space-y-3 text-sm">{['Shahadah · Declaration of faith', 'Salah · Five daily prayers', 'Zakat · Obligatory charity', 'Sawm · Fasting in Ramadan', 'Hajj · Pilgrimage for those able'].map((p, i) => <li key={p}><span className="text-amber-400">{i + 1}. </span>{p}</li>)}</ol>}</section>)}</div>;
  return { settings, panel };
}

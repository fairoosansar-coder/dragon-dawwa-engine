import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LocateFixed, MapPin, RotateCcw } from 'lucide-react';
import type { Lang } from '../../shared/sources.ts';
import { findTopic } from '../../shared/spiritual/catalog.ts';
import { todayIn, addDays } from '../../shared/spiritual/calendar.ts';
import {
  CALC_METHODS,
  HIGH_LATITUDE_RULES,
  MAX_TUNE_MINUTES,
  TUNABLE,
  validTimeZone,
  type PrayerCalendar,
  type PrayerCalendarDay,
} from '../../shared/spiritual/prayerSettings.ts';
import { minutesInZone, nextPrayer } from '../../shared/spiritual.ts';
import { useRemote } from '../../lib/api.ts';
import { fmt, type SpKey } from '../../lib/i18nSpiritual.ts';
import { formatIso, spHref } from '../../lib/spiritualFormat.ts';
import { deviceTimeZone, usePlace, usePrayerPrefs, useSp, type Place, type PrayerPrefs } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Field, Panel, PanelTitle, SectionBand, SpButton, inputClass } from '../../components/spiritual/ornaments.tsx';

export const CITIES: (Place & { names: Record<Lang, string> })[] = [
  { name: 'Colombo', lat: 6.9271, lng: 79.8612, names: { en: 'Colombo', ta: 'கொழும்பு', si: 'කොළඹ' } },
  { name: 'Kandy', lat: 7.2906, lng: 80.6337, names: { en: 'Kandy', ta: 'கண்டி', si: 'මහනුවර' } },
  { name: 'Galle', lat: 6.0535, lng: 80.221, names: { en: 'Galle', ta: 'காலி', si: 'ගාල්ල' } },
  { name: 'Anuradhapura', lat: 8.3114, lng: 80.4037, names: { en: 'Anuradhapura', ta: 'அனுராதபுரம்', si: 'අනුරාධපුරය' } },
  { name: 'Jaffna', lat: 9.6615, lng: 80.0255, names: { en: 'Jaffna', ta: 'யாழ்ப்பாணம்', si: 'යාපනය' } },
  { name: 'Trincomalee', lat: 8.5874, lng: 81.2152, names: { en: 'Trincomalee', ta: 'திருகோணமலை', si: 'ත්‍රිකුණාමලය' } },
  { name: 'Batticaloa', lat: 7.731, lng: 81.6747, names: { en: 'Batticaloa', ta: 'மட்டக்களப்பு', si: 'මඩකලපුව' } },
  { name: 'Kattankudy', lat: 7.6764, lng: 81.7302, names: { en: 'Kattankudy', ta: 'காத்தான்குடி', si: 'කාත්තන්කුඩි' } },
  { name: 'Puttalam', lat: 8.0362, lng: 79.8283, names: { en: 'Puttalam', ta: 'புத்தளம்', si: 'පුත්තලම' } },
  { name: 'Makkah', lat: 21.3891, lng: 39.8579, names: { en: 'Makkah', ta: 'மக்கா', si: 'මක්කම' } },
  { name: 'Madinah', lat: 24.4672, lng: 39.6112, names: { en: 'Madinah', ta: 'மதீனா', si: 'මදීනාව' } },
  { name: 'Riyadh', lat: 24.7136, lng: 46.6753, names: { en: 'Riyadh', ta: 'ரியாத்', si: 'රියාද්' } },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, names: { en: 'Dubai', ta: 'துபாய்', si: 'ඩුබායි' } },
  { name: 'Doha', lat: 25.2854, lng: 51.531, names: { en: 'Doha', ta: 'தோஹா', si: 'දෝහා' } },
  { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869, names: { en: 'Kuala Lumpur', ta: 'கோலாலம்பூர்', si: 'ක්වාලාලම්පූර්' } },
  { name: 'London', lat: 51.5074, lng: -0.1278, names: { en: 'London', ta: 'லண்டன்', si: 'ලන්ඩන්' } },
];

export function placeName(place: Place, lang: Lang, s: ReturnType<typeof useSp>['s']) {
  const city = CITIES.find(c => c.name === place.name && c.lat === place.lat);
  if (city) return city.names[lang];
  if (place.name === '__device') return s.ptMyLocation;
  if (place.name === '__custom') return `${s.ptCustomPlace} (${place.lat.toFixed(2)}, ${place.lng.toFixed(2)})`;
  return place.name;
}

export function prayerQuery(place: Place, prefs: PrayerPrefs, year: number, month: number): string {
  const p = new URLSearchParams({
    lat: String(place.lat),
    lng: String(place.lng),
    year: String(year),
    month: String(month),
    method: String(prefs.method),
    school: String(prefs.school),
    highLatitude: String(prefs.highLatitude),
  });
  const tune = TUNABLE.filter(k => prefs.tune[k]).map(k => `${k}:${prefs.tune[k]}`);
  if (tune.length) p.set('tune', tune.join(','));
  if (prefs.timezone !== 'auto') p.set('timezone', prefs.timezone);
  return p.toString();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function LocationChooser({ onDone }: { onDone?: () => void }) {
  const { s, lang } = useSp();
  const [place, setPlace] = usePlace();
  const [lat, setLat] = useState(place ? String(place.lat) : '');
  const [lng, setLng] = useState(place ? String(place.lng) : '');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = (p: Place) => {
    setPlace(p);
    onDone?.();
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const la = Number(lat);
    const lo = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return;
    choose({ name: '__custom', lat: round2(la), lng: round2(lo) });
  }

  function locate() {
    if (!('geolocation' in navigator)) {
      setGeoError(s.ptGeoUnavailable);
      return;
    }
    setBusy(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setBusy(false);
        choose({ name: '__device', lat: round2(pos.coords.latitude), lng: round2(pos.coords.longitude) });
      },
      err => {
        setBusy(false);
        setGeoError(err.code === err.PERMISSION_DENIED ? s.ptDenied : s.ptGeoUnavailable);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  }

  return (
    <div className="space-y-4">
      <Field label={s.ptCity} htmlFor="sp-city">
        <select
          id="sp-city"
          className={inputClass}
          value={place && CITIES.some(c => c.name === place.name) ? place.name : ''}
          onChange={e => {
            const c = CITIES.find(x => x.name === e.target.value);
            if (c) choose({ name: c.name, lat: c.lat, lng: c.lng });
          }}
        >
          <option value="">{s.ptSelectCity}</option>
          {CITIES.map(c => (
            <option key={c.name} value={c.name}>
              {c.names[lang]}
            </option>
          ))}
        </select>
      </Field>
      <form onSubmit={submit} className="space-y-2">
        <p className="text-xs font-semibold text-ink/75">{s.ptOrCoords}</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label={s.ptLatitude} htmlFor="sp-lat">
            <input id="sp-lat" inputMode="decimal" className={inputClass} value={lat} onChange={e => setLat(e.target.value)} placeholder="6.93" />
          </Field>
          <Field label={s.ptLongitude} htmlFor="sp-lng">
            <input id="sp-lng" inputMode="decimal" className={inputClass} value={lng} onChange={e => setLng(e.target.value)} placeholder="79.86" />
          </Field>
        </div>
        <SpButton type="submit" variant="soft">
          <MapPin className="h-4 w-4" aria-hidden /> {s.ptUseCoords}
        </SpButton>
      </form>
      <div>
        <SpButton variant="soft" onClick={locate} disabled={busy}>
          <LocateFixed className="h-4 w-4" aria-hidden /> {busy ? s.loading : s.ptDevice}
        </SpButton>
        <p className="mt-1 text-xs text-ink/60">{s.ptDeviceHint}</p>
        {geoError && (
          <p role="alert" className="mt-2 text-sm text-red-800">
            {geoError}
          </p>
        )}
      </div>
    </div>
  );
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function Settings() {
  const { s } = useSp();
  const [prefs, setPrefs] = usePrayerPrefs();
  const [tzDraft, setTzDraft] = useState(prefs.timezone === 'auto' ? '' : prefs.timezone);
  const tzValid = !tzDraft || validTimeZone(tzDraft);
  const method = CALC_METHODS.find(m => m.id === prefs.method);

  return (
    <div className="space-y-4">
      <Field label={s.ptMethod} htmlFor="sp-method" hint={method?.params}>
        <select id="sp-method" className={inputClass} value={prefs.method} onChange={e => setPrefs(p => ({ ...p, method: Number(e.target.value) }))}>
          {CALC_METHODS.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={s.ptAsr} htmlFor="sp-asr">
        <select id="sp-asr" className={inputClass} value={prefs.school} onChange={e => setPrefs(p => ({ ...p, school: e.target.value === '1' ? 1 : 0 }))}>
          <option value="0">{s.ptAsrStandard}</option>
          <option value="1">{s.ptAsrHanafi}</option>
        </select>
      </Field>
      <Field label={s.ptHighLat} htmlFor="sp-hl" hint={s.ptHighLatHint}>
        <select
          id="sp-hl"
          className={inputClass}
          value={prefs.highLatitude}
          onChange={e => setPrefs(p => ({ ...p, highLatitude: Number(e.target.value) as PrayerPrefs['highLatitude'] }))}
        >
          {HIGH_LATITUDE_RULES.map(r => (
            <option key={r.id} value={r.id}>
              {s[r.key]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={s.ptTimezone} htmlFor="sp-tz" hint={tzValid ? undefined : s.ptTzInvalid}>
        <div className="flex flex-wrap gap-2">
          <input
            id="sp-tz"
            className={`${inputClass} flex-1`}
            value={tzDraft}
            placeholder={s.ptTzAuto}
            aria-invalid={!tzValid}
            onChange={e => setTzDraft(e.target.value)}
            onBlur={() => {
              if (!tzDraft) setPrefs(p => ({ ...p, timezone: 'auto' }));
              else if (validTimeZone(tzDraft)) setPrefs(p => ({ ...p, timezone: tzDraft }));
            }}
          />
          <SpButton
            variant="ghost"
            onClick={() => {
              const tz = deviceTimeZone();
              setTzDraft(tz);
              setPrefs(p => ({ ...p, timezone: tz }));
            }}
          >
            {deviceTimeZone()}
          </SpButton>
        </div>
      </Field>
      <fieldset>
        <legend className="text-xs font-semibold text-ink/75">{s.ptAdjust}</legend>
        <p className="mb-2 text-xs text-ink/60">{s.ptAdjustHint}</p>
        <div className="grid grid-cols-3 gap-2">
          {TUNABLE.map(k => (
            <label key={k} className="flex flex-col gap-1 text-xs text-ink/70">
              {s[`p_${k}` as SpKey]}
              <input
                type="number"
                min={-MAX_TUNE_MINUTES}
                max={MAX_TUNE_MINUTES}
                className={inputClass}
                value={prefs.tune[k] ?? 0}
                onChange={e => {
                  const v = Math.max(-MAX_TUNE_MINUTES, Math.min(MAX_TUNE_MINUTES, Math.trunc(Number(e.target.value) || 0)));
                  setPrefs(p => ({ ...p, tune: { ...p.tune, [k]: v } }));
                }}
              />
            </label>
          ))}
        </div>
        <SpButton variant="ghost" className="mt-2" onClick={() => setPrefs(p => ({ ...p, tune: {} }))}>
          <RotateCcw className="h-4 w-4" aria-hidden /> {s.ptResetAdjust}
        </SpButton>
      </fieldset>
    </div>
  );
}

function DayRow({ day, highlight, lang }: { day: PrayerCalendarDay; highlight?: string; lang: Lang }) {
  return (
    <tr className="border-b border-emerald/10 last:border-0">
      <th scope="row" className="py-2 pr-3 text-left text-xs font-medium text-ink/70">
        {formatIso(lang, day.date, { weekday: 'short', day: 'numeric', month: 'short' })}
      </th>
      {TUNABLE.map(k => (
        <td key={k} className={`py-2 text-center tabular-nums ${highlight === k ? 'font-bold text-emerald' : 'text-ink/85'}`}>
          {day.timings[k]}
        </td>
      ))}
    </tr>
  );
}

export default function PrayerTimesView() {
  const { s, lang } = useSp();
  const topic = findTopic('salah')!;
  const [place] = usePlace();
  const [prefs] = usePrayerPrefs();
  const [changing, setChanging] = useState(false);
  const now = useNow(30_000);
  const tzGuess = prefs.timezone === 'auto' ? deviceTimeZone() : prefs.timezone;
  const today = todayIn(tzGuess, now);
  const [y, m] = today.split('-').map(Number);
  const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const needNext = Number(today.slice(8)) > 22;
  const cur = useRemote<PrayerCalendar>(place ? `/api/spiritual/prayer/calendar?${prayerQuery(place, prefs, y, m)}` : null);
  const nxt = useRemote<PrayerCalendar>(place && needNext ? `/api/spiritual/prayer/calendar?${prayerQuery(place, prefs, nextMonth.y, nextMonth.m)}` : null);

  const days = useMemo(() => [...(cur.data?.days ?? []), ...(nxt.data?.days ?? [])], [cur.data, nxt.data]);
  const zone = cur.data?.timezone ?? tzGuess;
  const localToday = todayIn(zone, now);
  const todayEntry = days.find(d => d.date === localToday);
  const upcoming = days.filter(d => d.date > localToday && d.date <= addDays(localToday, 7));
  const next = todayEntry ? nextPrayer(todayEntry.timings, minutesInZone(now, zone)) : null;
  const method = cur.data ? cur.data.method.name : CALC_METHODS.find(x => x.id === prefs.method)?.name ?? '';
  const hlKey = HIGH_LATITUDE_RULES.find(r => r.id === prefs.highLatitude)?.key ?? 'hlAngle';
  const adjusted = TUNABLE.filter(k => prefs.tune[k]).map(k => `${s[`p_${k}` as SpKey]} ${prefs.tune[k]! > 0 ? '+' : ''}${prefs.tune[k]}`);

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { href: spHref('salah'), label: topic.title[lang] }, { label: s.ptTitle }]} />
      <SectionBand title={s.ptTitle} subtitle={s.ptNotMosque} topic="salah" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {!place || changing ? (
            <Panel>
              <PanelTitle sub={s.ptNoLocation}>{s.ptChooseLocation}</PanelTitle>
              <LocationChooser onDone={() => setChanging(false)} />
            </Panel>
          ) : (
            <Panel>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gilt-deep">{s.ptLocation}</p>
                  <p className="font-display text-xl font-bold text-emerald">{placeName(place, lang, s)}</p>
                  <p className="text-xs text-ink/60">{fmt(s.ptTzShown, { tz: zone })}</p>
                </div>
                <SpButton variant="soft" onClick={() => setChanging(true)}>
                  <MapPin className="h-4 w-4" aria-hidden /> {s.ptChange}
                </SpButton>
              </div>
              {cur.loading && <p role="status" className="text-sm text-ink/60">{s.loading}</p>}
              {cur.error && (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 p-3 text-sm text-red-900">
                  <span className="flex-1">{cur.error}</span>
                  <SpButton variant="danger" onClick={cur.reload}>
                    {s.retry}
                  </SpButton>
                </div>
              )}
              {todayEntry && (
                <>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink/55">
                    {s.ptToday} · {formatIso(lang, todayEntry.date, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {next && (
                    <p className="mb-3 rounded-2xl bg-emerald px-4 py-3 font-display text-lg font-bold text-ivory" aria-live="polite">
                      {fmt(next.tomorrow ? s.ptNextTomorrow : s.ptNext, {
                        name: s[`p_${next.name}` as SpKey],
                        h: Math.floor(next.minutesUntil / 60),
                        m: next.minutesUntil % 60,
                      })}
                    </p>
                  )}
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {TUNABLE.map(k => (
                      <li
                        key={k}
                        className={`rounded-2xl px-4 py-3 ${next && !next.tomorrow && next.name === k ? 'bg-vellum ring-2 ring-gilt' : 'bg-ivory'} ${k === 'Sunrise' ? 'opacity-80' : ''}`}
                      >
                        <span className="block text-xs text-ink/60">{s[`p_${k}` as SpKey]}</span>
                        <span className="font-display text-2xl font-bold tabular-nums text-emerald">{todayEntry.timings[k]}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {upcoming.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <h3 className="mb-2 text-sm font-semibold text-emerald">{s.ptUpcoming}</h3>
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="text-xs text-ink/55">
                        <th scope="col" className="pb-1 text-left font-medium">
                          {s.date}
                        </th>
                        {TUNABLE.map(k => (
                          <th key={k} scope="col" className="pb-1 font-medium">
                            {s[`p_${k}` as SpKey]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map(d => (
                        <DayRow key={d.date} day={d} lang={lang} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-4 text-xs text-ink/60">
                {fmt(s.ptSourceLine, { method, asr: prefs.school === 1 ? s.ptAsrHanafi : s.ptAsrStandard, hl: s[hlKey] })}
                {adjusted.length > 0 && <> · {fmt(s.ptAdjusted, { list: adjusted.join(', ') })}</>}
              </p>
            </Panel>
          )}
          <Callout tone="caution">
            <p>{s.ptNotMosque}</p>
            <p className="mt-1 text-xs text-ink/60">{s.ptMosqueNone}</p>
          </Callout>
        </div>
        <Panel>
          <PanelTitle as="h2">{s.ptSettings}</PanelTitle>
          <Settings />
        </Panel>
      </div>
    </div>
  );
}

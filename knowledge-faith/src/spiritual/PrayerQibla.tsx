import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { PrayerDay } from '../shared/types.ts';
import { minutesInZone, nextPrayer, qiblaBearing, type PrayerName } from '../shared/spiritual.ts';
import { useRemote } from '../lib/api.ts';
import { useStored } from '../lib/store.tsx';
import { applyPrayerOffsets, latitudeAdjustmentId, type ClockName, type PrayerOffsets } from './prayerAdjust.ts';
import { Banner, Field, PageBack, Panel, control, useSp } from './chrome.tsx';

interface Place {
  name: string;
  lat: number;
  lng: number;
}

const CITIES: Place[] = [
  { name: 'Colombo', lat: 6.9271, lng: 79.8612 },
  { name: 'Kandy', lat: 7.2906, lng: 80.6337 },
  { name: 'Anuradhapura', lat: 8.3114, lng: 80.4037 },
  { name: 'Jaffna', lat: 9.6615, lng: 80.0255 },
  { name: 'Batticaloa', lat: 7.731, lng: 81.6747 },
  { name: 'Kattankudy', lat: 7.6764, lng: 81.7302 },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { name: 'Makkah', lat: 21.3891, lng: 39.8579 },
  { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
];

const CLOCKS: ClockName[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function usePlace() {
  return useStored<Place | null>('kf-place', null);
}

export function PrayerTimesView({ segments }: { segments: string[] }) {
  const { s, config } = useSp();
  const [place, setPlace] = usePlace();
  const [method, setMethod] = useStored<number>('kf-method', 3);
  const [school, setSchool] = useStored<number>('kf-school', 0);
  const [latAdj, setLatAdj] = useStored<number>('kf-lat-adj', 0);
  const [offsets, setOffsets] = useStored<PrayerOffsets>('kf-prayer-offsets', {});
  const [mosque, setMosque] = useStored<string>('kf-mosque-note', '');
  const [geoError, setGeoError] = useState<string | null>(null);
  const now = useNow();
  const today = isoDate(now);
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const adjustment = latitudeAdjustmentId(latAdj);
  const url = place
    ? `/api/prayer?lat=${place.lat}&lng=${place.lng}&method=${method}&school=${school}&date=${date}&latAdj=${adjustment}`
    : null;
  const remote = useRemote<PrayerDay>(url);
  const timings = remote.data ? applyPrayerOffsets(remote.data.timings, offsets) : null;
  const upcoming = useMemo(() => {
    if (!timings || !remote.data || date !== today) return null;
    return nextPrayer(
      { Fajr: timings.Fajr, Dhuhr: timings.Dhuhr, Asr: timings.Asr, Maghrib: timings.Maghrib, Isha: timings.Isha },
      minutesInZone(now, remote.data.timezone),
    );
  }, [timings, remote.data, date, today, now]);
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const high = place ? Math.abs(place.lat) >= 48 : false;

  function locate() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError(s.qiblaBad);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setPlace({ name: s.myLocation, lat: +pos.coords.latitude.toFixed(2), lng: +pos.coords.longitude.toFixed(2) }),
      () => setGeoError(s.qiblaDenied),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <h1 className="font-display text-3xl font-bold text-dd-emerald">{s.prayerTimes}</h1>
        <p className="mt-2 text-sm">{s.locationHint}</p>
        <Banner>{s.calculatedNote}</Banner>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={s.city}>
            <select
              className={control}
              value={place && CITIES.some(city => city.name === place.name) ? place.name : place ? '__custom' : ''}
              onChange={event => {
                const city = CITIES.find(item => item.name === event.target.value);
                if (city) setPlace(city);
              }}
            >
              <option value="">{s.choosePlace}</option>
              {place && !CITIES.some(city => city.name === place.name) && <option value="__custom">{place.name}</option>}
              {CITIES.map(city => (
                <option key={city.name} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button type="button" className="min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory" onClick={locate}>
              {s.useLocation}
            </button>
          </div>
          <Field label={s.method}>
            <select className={control} value={String(method)} onChange={event => setMethod(Number(event.target.value))}>
              {(config?.prayerMethods ?? [{ id: 3, name: 'Muslim World League' }]).map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={s.asr}>
            <select className={control} value={String(school)} onChange={event => setSchool(Number(event.target.value))}>
              <option value="0">{s.asrStandard}</option>
              <option value="1">{s.asrHanafi}</option>
            </select>
          </Field>
          <Field label={s.latAdj}>
            <select className={control} value={String(adjustment)} onChange={event => setLatAdj(Number(event.target.value))}>
              <option value="0">{s.latDefault}</option>
              <option value="1">{s.latMiddle}</option>
              <option value="2">{s.latSeventh}</option>
              <option value="3">{s.latAngle}</option>
            </select>
          </Field>
          <Field label={s.date}>
            <input className={control} type="date" value={date} onChange={event => setPicked(event.target.value && event.target.value !== today ? event.target.value : null)} />
          </Field>
        </div>
        {place && <CoordForm place={place} onApply={setPlace} />}
        {high && adjustment === 0 && <p className="mt-3 text-sm">{s.highLat}</p>}
        {geoError && <p className="mt-3 text-sm">{geoError}</p>}
        {!place && <p className="mt-4">{s.todayNoPlace}</p>}
        {remote.loading && <p>{s.loading}</p>}
        {remote.error && (
          <p>
            {remote.error}{' '}
            <button type="button" onClick={remote.reload}>
              {s.retry}
            </button>
          </p>
        )}
        {remote.data && timings && place && (
          <>
            <div className="mt-5 rounded-3xl bg-dd-emerald p-5 text-dd-ivory">
              <p className="text-xs uppercase tracking-widest text-dd-gold-soft">{date === today ? s.todayNext : s.date}</p>
              <p className="font-display text-3xl font-bold">{date === today ? s[upcoming?.name ?? 'Fajr'] : remote.data.gregorian}</p>
              {date === today && upcoming && (
                <p className="tabular-nums">
                  {s.inTime} {Math.floor(upcoming.minutesUntil / 60)}h {upcoming.minutesUntil % 60}m
                  {upcoming.tomorrow ? ` · ${s.next}` : ''}
                </p>
              )}
            </div>
            <ul className="mt-4 divide-y divide-dd-emerald/10">
              {CLOCKS.map(name => (
                <li key={name} className="flex items-center justify-between gap-3 py-3">
                  <span>{s[name]}</span>
                  <span className="flex items-center gap-3">
                    <input
                      aria-label={`${s.adjust} ${s[name]}`}
                      className="w-20 rounded-xl border border-dd-emerald/20 px-2 py-1 text-center"
                      type="number"
                      min={-180}
                      max={180}
                      value={offsets[name] ?? 0}
                      onChange={event => setOffsets({ ...offsets, [name]: Number(event.target.value) })}
                    />
                    <span className="tabular-nums font-semibold">{timings[name]}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-dd-ink/60">{s.adjustHint}</p>
            <p className="mt-3 text-sm">
              {place.name} · {s.zone}: {remote.data.timezone}
              {deviceZone !== remote.data.timezone ? ` · ${s.deviceZone} ${deviceZone}` : ''} · {remote.data.method}
              {remote.data.latitudeAdjustment ? ` · ${s.latAdj} ${remote.data.latitudeAdjustment}` : ` · ${s.latDefault}`} · Aladhan
            </p>
            <p className="mt-2 text-sm">
              {s.hijri}: {remote.data.hijri.day} {remote.data.hijri.month} {remote.data.hijri.year}{' '}
              <span lang="ar">
                {remote.data.hijri.monthArabic} {remote.data.hijri.year}
              </span>
            </p>
            <p className="text-xs text-dd-ink/60">{s.provisional}</p>
          </>
        )}
        <Field label={s.mosque}>
          <textarea className={`${control} mt-3`} rows={3} value={mosque} onChange={event => setMosque(event.target.value.slice(0, 500))} />
        </Field>
        <p className="mt-1 text-xs text-dd-ink/60">{s.mosqueHint}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => setPicked(shiftDate(date, -1))}>
            {s.prev}
          </button>
          <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => setPicked(null)}>
            {s.todayWord}
          </button>
          <button type="button" className="min-h-11 rounded-full bg-white px-4" onClick={() => setPicked(shiftDate(date, 1))}>
            {s.next}
          </button>
        </div>
      </Panel>
    </div>
  );
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function CoordForm({ place, onApply }: { place: Place; onApply: (place: Place) => void }) {
  const { s } = useSp();
  const [lat, setLat] = useState(String(place.lat));
  const [lng, setLng] = useState(String(place.lng));
  useEffect(() => {
    setLat(String(place.lat));
    setLng(String(place.lng));
  }, [place.lat, place.lng]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (Math.abs(+lat) > 90 || Math.abs(+lng) > 180) return;
    onApply({ name: s.customPlace, lat: +(+lat).toFixed(4), lng: +(+lng).toFixed(4) });
  }
  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-3">
      <Field label={s.latitude}>
        <input className={control} required type="number" step="any" min={-90} max={90} value={lat} onChange={event => setLat(event.target.value)} />
      </Field>
      <Field label={s.longitude}>
        <input className={control} required type="number" step="any" min={-180} max={180} value={lng} onChange={event => setLng(event.target.value)} />
      </Field>
      <button className="min-h-11 rounded-full bg-dd-gold px-4 text-dd-ink" type="submit">
        {s.apply}
      </button>
    </form>
  );
}

export function QiblaView({ segments }: { segments: string[] }) {
  const { s } = useSp();
  const [place, setPlace] = usePlace();
  const [geoError, setGeoError] = useState<string | null>(null);

  function locate() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError(s.qiblaBad);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setPlace({ name: s.myLocation, lat: +pos.coords.latitude.toFixed(2), lng: +pos.coords.longitude.toFixed(2) }),
      () => setGeoError(s.qiblaDenied),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }
  const [heading, setHeading] = useState<number | null>(null);
  const [sensor, setSensor] = useState<'idle' | 'live' | 'unsupported' | 'denied' | 'unreliable'>('idle');
  const bearing = place ? qiblaBearing(place.lat, place.lng) : null;

  function listen() {
    const request = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
    const start = () => {
      const onEvent = (event: DeviceOrientationEvent) => {
        const extra = event as DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
        if (typeof extra.webkitCompassAccuracy === 'number' && extra.webkitCompassAccuracy > 25) {
          setSensor('unreliable');
          setHeading(null);
          return;
        }
        if (typeof extra.webkitCompassHeading === 'number' && Number.isFinite(extra.webkitCompassHeading)) {
          setHeading(extra.webkitCompassHeading);
          setSensor('live');
          return;
        }
        setSensor('unreliable');
        setHeading(null);
      };
      window.addEventListener('deviceorientation', onEvent);
      window.setTimeout(() => setSensor(current => (current === 'idle' ? 'unsupported' : current)), 1200);
    };
    if (typeof request === 'function') {
      void request()
        .then(result => (result === 'granted' ? start() : setSensor('denied')))
        .catch(() => setSensor('denied'));
    } else if ('DeviceOrientationEvent' in window) start();
    else setSensor('unsupported');
  }

  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <h1 className="font-display text-3xl font-bold text-dd-emerald">{s.qibla}</h1>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label={s.city}>
            <select
              className={control}
              value={place && CITIES.some(city => city.name === place.name) ? place.name : place ? '__custom' : ''}
              onChange={event => {
                const city = CITIES.find(item => item.name === event.target.value);
                if (city) setPlace(city);
              }}
            >
              <option value="">{s.choosePlace}</option>
              {place && !CITIES.some(city => city.name === place.name) && <option value="__custom">{place.name}</option>}
              {CITIES.map(city => (
                <option key={city.name} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
          </Field>
          <button type="button" className="min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory" onClick={locate}>
            {s.useLocation}
          </button>
        </div>
        {geoError && <p className="mt-3 text-sm">{geoError}</p>}
        {!place || bearing === null ? (
          <p className="mt-3">
            {s.qiblaNeed}{' '}
            <a className="underline" href="#/spiritual/salah/times">
              {s.choosePlace}
            </a>
          </p>
        ) : (
          <>
            <p className="mt-3 text-4xl font-bold tabular-nums text-dd-emerald">{bearing.toFixed(1)}°</p>
            <p className="text-sm">{s.qiblaDegrees}</p>
            <div className="relative mx-auto mt-6 h-48 w-48 rounded-full border-4 border-dd-lapis" aria-hidden>
              <span className="absolute left-1/2 top-2 -translate-x-1/2 text-xs font-bold">{s.north}</span>
              <span className="absolute left-1/2 top-1/2 h-16 w-1 origin-bottom bg-dd-gold" style={{ transform: `translate(-50%, -100%) rotate(${bearing}deg)` }} />
            </div>
            <p className="mt-3 text-sm">{s.qiblaStatic}</p>
            {sensor === 'live' && heading !== null && (
              <div className="mt-4">
                <p className="text-sm">{s.qiblaLive}</p>
                <div className="relative mx-auto mt-3 h-40 w-40 rounded-full border-4 border-dd-emerald" style={{ transform: `rotate(${-heading}deg)` }} aria-hidden>
                  <span className="absolute left-1/2 top-1/2 h-12 w-1 origin-bottom bg-dd-gold" style={{ transform: `translate(-50%, -100%) rotate(${bearing}deg)` }} />
                </div>
              </div>
            )}
            {sensor === 'unreliable' || sensor === 'unsupported' ? <p className="mt-3 text-sm">{s.qiblaBad}</p> : null}
            {sensor === 'denied' && <p className="mt-3 text-sm">{s.qiblaDenied}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="min-h-11 rounded-full bg-dd-emerald px-4 text-dd-ivory" onClick={listen}>
                {s.qiblaButton}
              </button>
              <a className="inline-flex min-h-11 items-center rounded-full bg-white px-4" href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=14/${place.lat}/${place.lng}`}>
                {s.qiblaMap}
              </a>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

export type { PrayerName };

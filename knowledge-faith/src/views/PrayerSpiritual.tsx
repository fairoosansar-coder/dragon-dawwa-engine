import { useEffect, useMemo, useState } from 'react';
import { Compass, LocateFixed, RotateCcw } from 'lucide-react';
import type { PrayerDay } from '../shared/types.ts';
import { minutesInZone, nextPrayer, qiblaBearing } from '../shared/spiritual.ts';
import { useRemote } from '../lib/api.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { Button, Card, ErrorNote, Loading, SectionTitle, Select } from '../components/ui.tsx';

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

const DHIKR = ['سُبْحَانَ ٱللَّٰهِ', 'ٱلْحَمْدُ لِلَّٰهِ', 'ٱللَّٰهُ أَكْبَرُ', 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', 'أَسْتَغْفِرُ ٱللَّٰهَ'];

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Tasbih() {
  const { t } = useApp();
  const [count, setCount] = useStored<number>('kf-tasbih', 0);
  const [target, setTarget] = useStored<number>('kf-tasbih-target', 33);
  const [phrase, setPhrase] = useStored<number>('kf-tasbih-phrase', 0);
  const reached = target > 0 && count > 0 && count % target === 0;

  function tap() {
    const next = count + 1;
    setCount(next);
    if (target > 0 && next % target === 0) navigator.vibrate?.(120);
  }

  return (
    <Card>
      <SectionTitle>{t.tasbih}</SectionTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        {DHIKR.map((d, i) => (
          <button
            key={d}
            type="button"
            lang="ar"
            onClick={() => setPhrase(i)}
            aria-pressed={phrase === i}
            className={`rounded-full px-3 py-1 font-[family-name:var(--font-arabic)] text-lg ${phrase === i ? 'bg-pine text-white' : 'bg-mint text-pine'}`}
          >
            {d}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={tap}
        aria-label={`${t.tasbih}: ${count}`}
        className={`mx-auto flex h-48 w-48 flex-col items-center justify-center rounded-full border-8 text-white shadow-lg transition active:scale-95 ${reached ? 'border-gold bg-moss' : 'border-mint bg-pine'}`}
      >
        <span lang="ar" className="font-[family-name:var(--font-arabic)] text-xl">
          {DHIKR[phrase] ?? DHIKR[0]}
        </span>
        <span className="font-display text-5xl font-bold tabular-nums">{count}</span>
        {target > 0 && <span className="text-xs text-mint">/ {target}</span>}
      </button>
      <div className="mt-4 flex items-end justify-center gap-3">
        <Select
          label={t.target}
          value={String(target)}
          onChange={v => setTarget(Number(v))}
          options={[
            { value: '33', label: '33' },
            { value: '99', label: '99' },
            { value: '100', label: '100' },
            { value: '0', label: '∞' },
          ]}
        />
        <Button variant="soft" onClick={() => setCount(0)}>
          <RotateCcw className="h-4 w-4" aria-hidden /> {t.reset}
        </Button>
      </div>
    </Card>
  );
}

export default function PrayerSpiritual() {
  const { t, config } = useApp();
  const [place, setPlace] = useStored<Place>('kf-place', CITIES[0]);
  const [method, setMethod] = useStored<number>('kf-method', 3);
  const [school, setSchool] = useStored<number>('kf-school', 0);
  const [geoError, setGeoError] = useState<string | null>(null);
  const now = useNow(30_000);
  const url = `/api/prayer?lat=${place.lat}&lng=${place.lng}&method=${method}&school=${school}`;
  const { data, error, loading, reload } = useRemote<PrayerDay>(url);

  const upcoming = useMemo(
    () => (data ? nextPrayer(data.timings, minutesInZone(now, data.timezone)) : null),
    [data, now],
  );
  const bearing = qiblaBearing(place.lat, place.lng);

  function locate() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setPlace({ name: t.myLocation, lat: +pos.coords.latitude.toFixed(2), lng: +pos.coords.longitude.toFixed(2) }),
      err => setGeoError(err.message || 'Location permission was denied.'),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <Card>
        <SectionTitle sub={t.locationHint}>{t.prayerTimes}</SectionTitle>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label={t.city}
            value={CITIES.some(c => c.name === place.name) ? place.name : '__custom'}
            onChange={v => {
              const city = CITIES.find(c => c.name === v);
              if (city) setPlace(city);
            }}
            options={[
              ...(CITIES.some(c => c.name === place.name) ? [] : [{ value: '__custom', label: place.name }]),
              ...CITIES.map(c => ({ value: c.name, label: c.name })),
            ]}
          />
          <Button variant="soft" onClick={locate}>
            <LocateFixed className="h-4 w-4" aria-hidden /> {t.useLocation}
          </Button>
          <Select
            label={t.method}
            value={String(method)}
            onChange={v => setMethod(Number(v))}
            options={(config?.prayerMethods ?? [{ id: 3, name: 'Muslim World League' }]).map(m => ({ value: String(m.id), label: m.name }))}
          />
          <Select
            label={t.asrSchool}
            value={String(school)}
            onChange={v => setSchool(Number(v))}
            options={[
              { value: '0', label: t.asrStandard },
              { value: '1', label: t.asrHanafi },
            ]}
          />
        </div>
        {geoError && (
          <div className="mt-3">
            <ErrorNote message={geoError} />
          </div>
        )}
        {loading && <Loading />}
        {error && (
          <div className="mt-3">
            <ErrorNote message={error} onRetry={reload} />
          </div>
        )}
        {data && (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-pine p-5 text-white">
              <div>
                <p className="text-xs uppercase tracking-widest text-mint/80">{t.nextPrayer}</p>
                <p className="font-display text-3xl font-bold">{upcoming?.name}</p>
              </div>
              {upcoming && (
                <p className="text-lg tabular-nums">
                  {t.inTime} {Math.floor(upcoming.minutesUntil / 60)}h {upcoming.minutesUntil % 60}m
                </p>
              )}
            </div>
            <ul className="mt-4 divide-y divide-pine/10">
              {(['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const).map(name => (
                <li
                  key={name}
                  className={`flex justify-between px-2 py-3 ${upcoming?.name === name ? 'font-semibold text-pine' : ''} ${name === 'Sunrise' ? 'text-ink/50' : ''}`}
                >
                  <span>{name}</span>
                  <span className="tabular-nums">{data.timings[name]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink/50">
              {place.name} · {data.timezone} · {data.method} · Aladhan
            </p>
          </>
        )}
      </Card>

      <div className="space-y-6">
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-pine">{t.hijri}</h2>
              {data ? (
                <>
                  <p className="mt-2 text-2xl font-semibold">
                    {data.hijri.day} {data.hijri.month}
                  </p>
                  <p lang="ar" className="font-[family-name:var(--font-arabic)] text-lg">
                    {data.hijri.monthArabic} {data.hijri.year} هـ
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink/50">—</p>
              )}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-pine">{t.qibla}</h2>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative h-16 w-16 rounded-full border-2 border-pine/20" aria-hidden>
                  <span className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[10px] font-bold text-ink/50">N</span>
                  <Compass
                    className="absolute inset-0 m-auto h-9 w-9 text-gold"
                    style={{ transform: `rotate(${bearing - 45}deg)` }}
                  />
                </div>
                <p>
                  <span className="text-2xl font-semibold tabular-nums">{bearing.toFixed(0)}°</span>
                  <span className="block text-xs text-ink/50">{t.qiblaHint}</span>
                </p>
              </div>
            </div>
          </div>
        </Card>
        <Tasbih />
      </div>
    </div>
  );
}

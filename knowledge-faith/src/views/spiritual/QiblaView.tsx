import { useEffect, useRef, useState } from 'react';
import { Compass, ExternalLink, MapPin } from 'lucide-react';
import { findTopic } from '../../shared/spiritual/catalog.ts';
import { qiblaBearing } from '../../shared/spiritual.ts';
import { fmt } from '../../lib/i18nSpiritual.ts';
import { spHref } from '../../lib/spiritualFormat.ts';
import { useLocal, KEYS, usePlace, useSp } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Field, Panel, PanelTitle, SectionBand, SpButton, inputClass } from '../../components/spiritual/ornaments.tsx';
import { LocationChooser, placeName } from './PrayerTimesView.tsx';

const KAABA = { lat: 21.4225, lng: 39.8262 };

function distanceKm(lat: number, lng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(KAABA.lat - lat) / 2) ** 2 + Math.cos(r(lat)) * Math.cos(r(KAABA.lat)) * Math.sin(r(KAABA.lng - lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type SensorState = 'off' | 'waiting' | 'live' | 'none' | 'denied';

interface OrientationWithCompass extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

function useCompass() {
  const [state, setState] = useState<SensorState>('off');
  const [heading, setHeading] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (state !== 'waiting' && state !== 'live') return;
    const onOrient = (e: Event) => {
      const ev = e as OrientationWithCompass;
      let h: number | null = null;
      if (typeof ev.webkitCompassHeading === 'number') h = ev.webkitCompassHeading;
      else if (ev.absolute && typeof ev.alpha === 'number') h = (360 - ev.alpha) % 360;
      if (h === null) return;
      window.clearTimeout(timer.current);
      setHeading(h);
      setState('live');
    };
    const absolute = 'ondeviceorientationabsolute' in window;
    window.addEventListener(absolute ? 'deviceorientationabsolute' : 'deviceorientation', onOrient);
    timer.current = window.setTimeout(() => setState(st => (st === 'waiting' ? 'none' : st)), 3500);
    return () => {
      window.removeEventListener(absolute ? 'deviceorientationabsolute' : 'deviceorientation', onOrient);
      window.clearTimeout(timer.current);
    };
  }, [state]);

  async function enable() {
    if (typeof DeviceOrientationEvent === 'undefined') {
      setState('none');
      return;
    }
    const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }).requestPermission;
    if (req) {
      try {
        if ((await req()) !== 'granted') {
          setState('denied');
          return;
        }
      } catch {
        setState('denied');
        return;
      }
    }
    setState('waiting');
  }

  return { state, heading, enable };
}

function Rose({ bearing, heading }: { bearing: number; heading: number | null }) {
  const rotate = heading === null ? 0 : -heading;
  return (
    <svg viewBox="0 0 220 220" className="mx-auto h-64 w-64" role="img" aria-hidden>
      <defs>
        <radialGradient id="sp-rose" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="100%" stopColor="#f3ecdb" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="110" r="104" fill="url(#sp-rose)" stroke="#c9a14e" strokeWidth="2" />
      <circle cx="110" cy="110" r="92" fill="none" stroke="#c9a14e" strokeOpacity=".5" />
      <g transform={`rotate(${rotate} 110 110)`} style={{ transition: 'transform 200ms linear' }}>
        {Array.from({ length: 72 }, (_, i) => (
          <line
            key={i}
            x1="110"
            y1={i % 18 === 0 ? 20 : i % 2 === 0 ? 24 : 26}
            x2="110"
            y2="30"
            stroke="#064936"
            strokeOpacity={i % 18 === 0 ? 0.9 : 0.35}
            strokeWidth={i % 18 === 0 ? 2 : 1}
            transform={`rotate(${i * 5} 110 110)`}
          />
        ))}
        {(['N', 'E', 'S', 'W'] as const).map((d, i) => (
          <text
            key={d}
            x="110"
            y="48"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill={d === 'N' ? '#8a6a24' : '#064936'}
            transform={`rotate(${i * 90} 110 110)`}
            fontFamily="Inter, sans-serif"
          >
            {d}
          </text>
        ))}
        <g transform={`rotate(${bearing} 110 110)`}>
          <path d="M110 34 L118 110 L110 104 L102 110 Z" fill="#064936" />
          <rect x="102" y="22" width="16" height="16" rx="2" fill="#1b2620" stroke="#c9a14e" strokeWidth="1.5" />
          <path d="M102 27h16" stroke="#c9a14e" strokeWidth="1.5" />
        </g>
      </g>
      <circle cx="110" cy="110" r="5" fill="#c9a14e" />
      {heading !== null && <path d="M110 4 l6 10 h-12 z" fill="#23407e" />}
    </svg>
  );
}

export default function QiblaView() {
  const { s, lang } = useSp();
  const topic = findTopic('salah')!;
  const [place] = usePlace();
  const [changing, setChanging] = useState(false);
  const [declination, setDeclination] = useLocal<number>(KEYS.declination, 0);
  const compass = useCompass();
  const bearing = place ? qiblaBearing(place.lat, place.lng) : 0;
  const trueHeading = compass.heading === null ? null : (compass.heading + declination + 360) % 360;
  const diff = trueHeading === null ? null : ((bearing - trueHeading + 540) % 360) - 180;

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { href: spHref('salah'), label: topic.title[lang] }, { label: s.qbTitle }]} />
      <SectionBand title={s.qbTitle} topic="salah" />
      {!place || changing ? (
        <Panel>
          <PanelTitle sub={s.ptNoLocation}>{s.ptChooseLocation}</PanelTitle>
          <LocationChooser onDone={() => setChanging(false)} />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-xl font-bold text-emerald">{placeName(place, lang, s)}</p>
              <SpButton variant="soft" onClick={() => setChanging(true)}>
                <MapPin className="h-4 w-4" aria-hidden /> {s.ptChange}
              </SpButton>
            </div>
            <Rose bearing={bearing} heading={trueHeading} />
            <p className="mt-3 text-center font-display text-3xl font-bold text-emerald">{fmt(s.qbBearing, { deg: bearing.toFixed(1) })}</p>
            <p className="text-center text-sm text-ink/65">{fmt(s.qbDistance, { km: Math.round(distanceKm(place.lat, place.lng)).toLocaleString() })}</p>
            <p className="mt-2 text-center text-xs font-medium text-ink/60" aria-live="polite">
              {compass.state === 'live' ? s.qbCompassOn : s.qbStatic}
            </p>
            {diff !== null && (
              <p className={`mt-3 rounded-2xl px-4 py-3 text-center font-semibold ${Math.abs(diff) <= 5 ? 'bg-emerald text-ivory' : 'bg-vellum text-emerald'}`} aria-live="polite">
                {Math.abs(diff) <= 5
                  ? s.qbFacing
                  : diff > 0
                    ? fmt(s.qbTurnRight, { deg: Math.round(diff) })
                    : fmt(s.qbTurnLeft, { deg: Math.round(-diff) })}
                <span className="block text-xs font-normal opacity-80">{fmt(s.qbHeading, { deg: Math.round(trueHeading!) })}</span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {compass.state !== 'live' && (
                <SpButton onClick={compass.enable}>
                  <Compass className="h-4 w-4" aria-hidden /> {s.qbEnable}
                </SpButton>
              )}
              <a
                className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-lapis ring-1 ring-lapis/20 hover:bg-lapis/5"
                href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=16/${place.lat}/${place.lng}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink className="h-4 w-4" aria-hidden /> {s.qbMap}
              </a>
            </div>
            {compass.state === 'none' && (
              <p role="status" className="mt-3 text-sm text-ink/75">
                {s.qbNoSensor}
              </p>
            )}
            {compass.state === 'denied' && (
              <p role="alert" className="mt-3 text-sm text-red-800">
                {s.qbPermissionDenied} {s.qbNoSensor}
              </p>
            )}
          </Panel>
          <div className="space-y-4">
            <Panel>
              <PanelTitle as="h2">{s.qbGuidanceTitle}</PanelTitle>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink/85">
                <li>{s.qbG1}</li>
                <li>{s.qbG2}</li>
                <li>{s.qbG3}</li>
                <li>{s.qbG4}</li>
              </ol>
            </Panel>
            <Panel>
              <Field label={s.qbDeclination} htmlFor="sp-decl" hint={s.qbMagnetic}>
                <input
                  id="sp-decl"
                  type="number"
                  step="0.1"
                  min={-60}
                  max={60}
                  className={inputClass}
                  value={declination}
                  onChange={e => setDeclination(Math.max(-60, Math.min(60, Number(e.target.value) || 0)))}
                />
              </Field>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

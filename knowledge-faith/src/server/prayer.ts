import { fetchJson, HOUR, UpstreamError } from './http.ts';
import { PRAYER_METHODS } from '../shared/sources.ts';
import type { PrayerDay } from '../shared/types.ts';
import {
  CALC_METHODS,
  HIGH_LATITUDE_RULES,
  MAX_TUNE_MINUTES,
  TUNABLE,
  validTimeZone,
  type PrayerCalendar,
  type PrayerCalendarDay,
  type PrayerTimings,
  type Tune,
} from '../shared/spiritual/prayerSettings.ts';

interface RawTimings {
  data: {
    timings: Record<string, string>;
    date: {
      gregorian: { date: string };
      hijri: { day: string; month: { en: string; ar: string }; year: string };
    };
    meta: { timezone: string; method: { name: string } };
  };
}

const KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

/** Converts an ISO `YYYY-MM-DD` date to Aladhan's `DD-MM-YYYY`, or returns null when absent. */
export function aladhanDate(date: string | undefined): string | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsed = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!m || !parsed || parsed.getUTCMonth() !== +m[2] - 1 || parsed.getUTCDate() !== +m[3]) {
    throw new UpstreamError('date must be YYYY-MM-DD', 400);
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function getPrayerTimes(
  lat: number,
  lng: number,
  method: number,
  school: number,
  date?: string,
): Promise<PrayerDay> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new UpstreamError('Latitude/longitude out of range', 400);
  }
  const methodId = PRAYER_METHODS.some(m => m.id === method) ? method : 3;
  const schoolId = school === 1 ? 1 : 0;
  const day = aladhanDate(date);
  // Coordinates are rounded to ~1 km so the cache is shared and precise locations are not forwarded.
  const query = `latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&method=${methodId}&school=${schoolId}`;
  const url = `https://api.aladhan.com/v1/timings${day ? `/${day}` : ''}?${query}`;
  const { data } = await fetchJson<RawTimings>(url, HOUR);
  if (day && data.date.gregorian.date !== day) throw new UpstreamError('Prayer provider returned a different date', 502);
  const timings = Object.fromEntries(KEYS.map(k => [k, data.timings[k]?.slice(0, 5) ?? ''])) as PrayerDay['timings'];
  return {
    timings,
    timezone: data.meta.timezone,
    method: data.meta.method.name,
    hijri: {
      day: data.date.hijri.day,
      month: data.date.hijri.month.en,
      monthArabic: data.date.hijri.month.ar,
      year: data.date.hijri.year,
    },
    gregorian: data.date.gregorian.date,
  };
}

interface RawCalendar {
  data: {
    timings: Record<string, string>;
    date: { gregorian: { date: string }; hijri: { day: string; month: { number: number }; year: string } };
    meta: { timezone: string; method: { id: number; name: string }; latitudeAdjustmentMethod: string };
  }[];
}

export interface CalendarOptions {
  method: number;
  school: number;
  highLatitude?: number;
  tune?: Tune;
  timezone?: string;
}

/** One month of calculated times. Coordinates are rounded to ~1 km before leaving the server. */
export async function getPrayerCalendar(lat: number, lng: number, year: number, month: number, opts: CalendarOptions): Promise<PrayerCalendar> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new UpstreamError('Latitude/longitude out of range', 400);
  }
  if (!Number.isInteger(year) || year < 1900 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new UpstreamError('year/month out of range', 400);
  }
  const method = CALC_METHODS.find(m => m.id === opts.method);
  if (!method) throw new UpstreamError('Unknown calculation method', 400);
  const school = opts.school === 1 ? 1 : 0;
  const highLatitude = HIGH_LATITUDE_RULES.some(r => r.id === opts.highLatitude) ? (opts.highLatitude as number) : 3;
  if (opts.timezone !== undefined && !validTimeZone(opts.timezone)) throw new UpstreamError('Unknown timezone', 400);
  const tune: Tune = {};
  for (const key of TUNABLE) {
    const v = opts.tune?.[key];
    if (v === undefined) continue;
    if (!Number.isInteger(v) || Math.abs(v) > MAX_TUNE_MINUTES) throw new UpstreamError(`Adjustment for ${key} must be a whole number of minutes within ±${MAX_TUNE_MINUTES}`, 400);
    if (v) tune[key] = v;
  }
  // Aladhan's tune order: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight.
  const tuneParam = [0, tune.Fajr ?? 0, tune.Sunrise ?? 0, tune.Dhuhr ?? 0, tune.Asr ?? 0, tune.Maghrib ?? 0, 0, tune.Isha ?? 0, 0].join(',');
  const query = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lng.toFixed(2),
    method: String(method.id),
    school: String(school),
    latitudeAdjustmentMethod: String(highLatitude),
    tune: tuneParam,
    ...(opts.timezone ? { timezonestring: opts.timezone } : {}),
  });
  const { data } = await fetchJson<RawCalendar>(`https://api.aladhan.com/v1/calendar/${year}/${month}?${query}`, HOUR * 6);
  if (!Array.isArray(data) || !data.length) throw new UpstreamError('Prayer provider returned no days', 502);
  const clock = (s: string | undefined) => /^\d{2}:\d{2}/.exec(s ?? '')?.[0] ?? '';
  const days: PrayerCalendarDay[] = data.map(d => {
    const [dd, mm, yyyy] = d.date.gregorian.date.split('-');
    return {
      date: `${yyyy}-${mm}-${dd}`,
      timings: Object.fromEntries(KEYS.map(k => [k, clock(d.timings[k])])) as unknown as PrayerTimings,
      hijri: { day: d.date.hijri.day, month: d.date.hijri.month.number, year: d.date.hijri.year },
    };
  });
  if (days.some(d => !d.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))) {
    throw new UpstreamError('Prayer provider returned a different month', 502);
  }
  return {
    days,
    timezone: data[0].meta.timezone,
    method: { id: method.id, name: method.name },
    school,
    highLatitude: data[0].meta.latitudeAdjustmentMethod,
    tune,
    source: 'aladhan-calculated',
  };
}

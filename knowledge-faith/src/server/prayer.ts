import { fetchJson, HOUR, UpstreamError } from './http.ts';
import { PRAYER_METHODS } from '../shared/sources.ts';
import type { PrayerDay } from '../shared/types.ts';

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

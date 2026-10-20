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

export async function getPrayerTimes(lat: number, lng: number, method: number, school: number): Promise<PrayerDay> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new UpstreamError('Latitude/longitude out of range', 400);
  }
  const methodId = PRAYER_METHODS.some(m => m.id === method) ? method : 3;
  const schoolId = school === 1 ? 1 : 0;
  // Coordinates are rounded to ~1 km so the cache is shared and precise locations are not forwarded.
  const url = `https://api.aladhan.com/v1/timings?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&method=${methodId}&school=${schoolId}`;
  const { data } = await fetchJson<RawTimings>(url, HOUR);
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

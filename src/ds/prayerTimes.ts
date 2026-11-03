export const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerResult = { timings: Record<typeof prayers[number], string>; timezone: string; date: string };
export function parsePrayerResponse(payload: unknown, expectedDate: string): PrayerResult {
  const p = payload as any;
  if (p?.code !== 200 || p?.data?.date?.gregorian?.date !== expectedDate || typeof p?.data?.meta?.timezone !== 'string') throw new Error('Invalid prayer response');
  const timings = {} as PrayerResult['timings'];
  for (const name of prayers) {
    const time = p.data.timings?.[name];
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?:\s|$)/.test(time)) throw new Error('Invalid prayer time');
    timings[name] = time.slice(0, 5);
  }
  return { timings, timezone: p.data.meta.timezone, date: expectedDate };
}
export function prayerUrl(latitude: string, longitude: string, date: string, method: string, school: string) {
  if (!latitude.trim() || !longitude.trim() || !Number.isFinite(+latitude) || !Number.isFinite(+longitude) || Math.abs(+latitude) > 90 || Math.abs(+longitude) > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['1','3','4','16'].includes(method) || !['0','1'].includes(school)) throw new Error('Invalid prayer parameters');
  const day = date.split('-').reverse().join('-');
  const params = new URLSearchParams({ latitude, longitude, method, school });
  return { url: `https://api.aladhan.com/v1/timings/${day}?${params}`, day };
}

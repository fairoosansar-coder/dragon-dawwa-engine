const KAABA = { lat: 21.4225, lng: 39.8262 };

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Initial great-circle bearing from the given point to the Kaaba, in degrees clockwise from true north. */
export function qiblaBearing(lat: number, lng: number): number {
  const φ1 = rad(lat);
  const φ2 = rad(KAABA.lat);
  const Δλ = rad(KAABA.lng - lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerName = (typeof PRAYER_ORDER)[number];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Next obligatory prayer after `nowMinutes` (minutes since local midnight); wraps to tomorrow's Fajr. */
export function nextPrayer(
  timings: Record<PrayerName, string>,
  nowMinutes: number,
): { name: PrayerName; minutesUntil: number; tomorrow: boolean } {
  for (const name of PRAYER_ORDER) {
    const at = toMinutes(timings[name]);
    if (at > nowMinutes) return { name, minutesUntil: at - nowMinutes, tomorrow: false };
  }
  return { name: 'Fajr', minutesUntil: 24 * 60 - nowMinutes + toMinutes(timings.Fajr), tomorrow: true };
}

/** Current minutes since midnight in an IANA timezone, so times match the location rather than the device. */
export function minutesInZone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    return Number(parts.hour) * 60 + Number(parts.minute);
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

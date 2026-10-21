import type { PrayerName } from '../shared/spiritual.ts';

export type ClockName = PrayerName | 'Sunrise';

export type PrayerOffsets = Partial<Record<ClockName, number>>;

const CLOCKS: ClockName[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export function clampOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-180, Math.min(180, Math.trunc(value)));
}

/** Shifts an HH:MM clock time by whole minutes, wrapping at midnight. */
export function shiftClock(hhmm: string, deltaMinutes: number): string {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return hhmm;
  const delta = clampOffset(deltaMinutes);
  const total = (Number(match[1]) * 60 + Number(match[2]) + delta + 1440 * 4) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function applyPrayerOffsets<T extends Record<ClockName, string>>(timings: T, offsets: PrayerOffsets): T {
  const next = { ...timings };
  for (const name of CLOCKS) {
    const delta = offsets[name] ?? 0;
    if (delta) next[name] = shiftClock(timings[name], delta) as T[typeof name];
  }
  return next;
}

export const LATITUDE_ADJUSTMENTS = [
  { id: 0, key: 'default' },
  { id: 1, key: 'middle' },
  { id: 2, key: 'seventh' },
  { id: 3, key: 'angle' },
] as const;

export function latitudeAdjustmentId(value: number): 0 | 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3 ? value : 0;
}

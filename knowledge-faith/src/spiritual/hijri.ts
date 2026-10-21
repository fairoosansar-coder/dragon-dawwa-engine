/**
 * Tabular civil Hijri dates.
 * This is an arithmetic calendar. It is not a moon-sighting determination
 * and it is not claimed to match Umm al-Qura.
 *
 * Epoch follows the civil Islamic calendar used by Calendrical Calculations:
 * 1 Muharram 1 AH = Julian day 1948439 (astronomical JDN at noon),
 * which is 19 July 622 CE (proleptic Gregorian) for the day count used here.
 */

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

export interface GregorianDate {
  year: number;
  month: number;
  day: number;
}

export const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabiʿ al-Awwal',
  'Rabiʿ al-Thani',
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  'Shaʿban',
  'Ramadan',
  'Shawwal',
  'Dhul Qaʿdah',
  'Dhul Hijjah',
] as const;

const HIJRI_EPOCH = 1948439;

export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function jdnToGregorian(jdn: number): GregorianDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

function isValidGregorian(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || year < 1) return false;
  return jdnToGregorian(gregorianToJdn(year, month, day)).day === day;
}

export function hijriToJdn(year: number, month: number, day: number): number {
  return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + HIJRI_EPOCH;
}

export function jdnToHijri(jdn: number): HijriDate {
  let year = Math.floor((30 * (jdn - HIJRI_EPOCH) + 10646) / 10631);
  if (hijriToJdn(year, 1, 1) > jdn) year -= 1;
  for (let month = 1; month <= 12; month++) {
    const start = hijriToJdn(year, month, 1);
    const next = month === 12 ? hijriToJdn(year + 1, 1, 1) : hijriToJdn(year, month + 1, 1);
    if (jdn >= start && jdn < next) return { year, month, day: jdn - start + 1 };
  }
  return { year, month: 12, day: jdn - hijriToJdn(year, 12, 1) + 1 };
}

export function gregorianToHijri(date: GregorianDate): HijriDate {
  if (!isValidGregorian(date.year, date.month, date.day)) throw new Error('Invalid Gregorian date');
  return jdnToHijri(gregorianToJdn(date.year, date.month, date.day));
}

export function hijriToGregorian(date: HijriDate): GregorianDate {
  if (date.month < 1 || date.month > 12 || date.day < 1 || date.day > 30 || date.year < 1) {
    throw new Error('Invalid Hijri date');
  }
  const g = jdnToGregorian(hijriToJdn(date.year, date.month, date.day));
  const back = gregorianToHijri(g);
  if (back.year !== date.year || back.month !== date.month || back.day !== date.day) {
    throw new Error('Invalid Hijri date');
  }
  return g;
}

export function addGregorianDays(date: GregorianDate, days: number): GregorianDate {
  return jdnToGregorian(gregorianToJdn(date.year, date.month, date.day) + days);
}

/** Shift the tabular label by whole days. Positive means the local label is ahead of the tabular date. */
export function hijriWithShift(date: GregorianDate, shiftDays: number): HijriDate {
  const shift = Math.max(-3, Math.min(3, Math.trunc(shiftDays)));
  return gregorianToHijri(addGregorianDays(date, shift));
}

export function parseIsoDate(iso: string): GregorianDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const date = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  try {
    if (!isValidGregorian(date.year, date.month, date.day)) return null;
  } catch {
    return null;
  }
  return date;
}

export function toIsoDate(date: GregorianDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function isoDateInZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function weekdayIndex(date: GregorianDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function monthGrid(year: number, month: number): GregorianDate[] {
  const count = jdnToGregorian(gregorianToJdn(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1) - 1).day;
  return Array.from({ length: count }, (_, i) => ({ year, month, day: i + 1 }));
}

import { h, type SourceRef } from './sourceRefs.ts';

/**
 * Hijri dates and fasting occasions. Calculated calendars (Umm al-Qura, tabular) are only provisional:
 * month starts depend on local moon sighting, so a user can record the start their local authority announced.
 */
export type HijriBasis = 'islamic-umalqura' | 'islamic-civil';

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

export interface CalendarPrefs {
  basis: HijriBasis;
  /** Whole-day shift applied to calculated dates, e.g. -1 where the local authority usually starts a day later. */
  offsetDays: number;
  /** Free-text name of the authority whose announcements the user follows. */
  authority: string;
  /** Hijri "YYYY-MM" → Gregorian ISO date the month began, as announced and entered by the user. */
  confirmedStarts: Record<string, string>;
  /** IANA timezone used for "today" and reminders. */
  timezone: string;
}

export const DEFAULT_CALENDAR: CalendarPrefs = {
  basis: 'islamic-umalqura',
  offsetDays: 0,
  authority: '',
  confirmedStarts: {},
  timezone: 'UTC',
};

export const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qa'dah",
  'Dhu al-Hijjah',
];

export const HIJRI_MONTHS_AR = [
  'مُحَرَّم',
  'صَفَر',
  'رَبِيع الأَوَّل',
  'رَبِيع الآخِر',
  'جُمَادَى الأُولَى',
  'جُمَادَى الآخِرَة',
  'رَجَب',
  'شَعْبَان',
  'رَمَضَان',
  'شَوَّال',
  'ذُو القَعْدَة',
  'ذُو الحِجَّة',
];

const DAY_MS = 86_400_000;

export function parseIso(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new RangeError(`Invalid date ${iso}`);
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new RangeError(`Invalid date ${iso}`);
  return t;
}

export const isoFromTime = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => isoFromTime(parseIso(iso) + n * DAY_MS);
export const daysBetween = (a: string, b: string) => Math.round((parseIso(b) - parseIso(a)) / DAY_MS);
/** 0 = Sunday … 6 = Saturday. */
export const weekday = (iso: string) => new Date(parseIso(iso)).getUTCDay();

const formatters = new Map<HijriBasis, Intl.DateTimeFormat>();

export function calculatedHijri(iso: string, basis: HijriBasis, offsetDays = 0): HijriDate {
  let f = formatters.get(basis);
  if (!f) {
    f = new Intl.DateTimeFormat(`en-u-ca-${basis}-nu-latn`, { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
    formatters.set(basis, f);
  }
  const parts = f.formatToParts(new Date(parseIso(iso) + offsetDays * DAY_MS));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export const hijriKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

export interface ResolvedHijri {
  date: HijriDate;
  status: 'confirmed' | 'provisional';
}

/** Uses the latest user-confirmed month start on or before `iso` when it covers the date, else the calculated date. */
export function hijriFor(iso: string, prefs: CalendarPrefs): ResolvedHijri {
  let best: { start: string; year: number; month: number } | null = null;
  for (const [key, start] of Object.entries(prefs.confirmedStarts)) {
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m) continue;
    let diff: number;
    try {
      diff = daysBetween(start, iso);
    } catch {
      continue;
    }
    if (diff < 0 || diff > 29) continue;
    if (!best || start > best.start) best = { start, year: +m[1], month: +m[2] };
  }
  if (best) {
    const diff = daysBetween(best.start, iso);
    // Day 30 exists only if the next crescent was not sighted, so it stays provisional until the next start is entered.
    return { date: { year: best.year, month: best.month, day: diff + 1 }, status: diff === 29 ? 'provisional' : 'confirmed' };
  }
  const calculated = calculatedHijri(iso, prefs.basis, prefs.offsetDays);
  // A confirmed start a day or two after `iso` means the calculation began that month too early.
  for (const [key, start] of Object.entries(prefs.confirmedStarts)) {
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m) continue;
    let ahead: number;
    try {
      ahead = daysBetween(iso, start);
    } catch {
      continue;
    }
    const [year, month] = [+m[1], +m[2]];
    if (ahead < 1 || ahead > 2 || calculated.year !== year || calculated.month !== month) continue;
    const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    let prevStart = prefs.confirmedStarts[hijriKey(prev.year, prev.month)];
    if (!prevStart) {
      for (let i = 1; i <= 32; i++) {
        const d = addDays(start, -i);
        const c = calculatedHijri(d, prefs.basis, prefs.offsetDays);
        if (c.year === prev.year && c.month === prev.month && c.day === 1) {
          prevStart = d;
          break;
        }
      }
    }
    // A month has at most 30 days; a larger count means the previous start was also later than calculated.
    if (prevStart) return { date: { ...prev, day: Math.min(daysBetween(prevStart, iso) + 1, 31 - ahead) }, status: 'provisional' };
  }
  return { date: calculated, status: 'provisional' };
}

export type OccasionKind = 'obligatory' | 'recommended' | 'prohibited' | 'restricted';

export interface OccasionDef {
  id: string;
  kind: OccasionKind;
  /** i18n key of the plain-language date basis, e.g. "9 Dhu al-Hijjah". */
  dateBasisKey: string;
  evidence: SourceRef[];
  /** Occasion-specific (not merely weekly) — relevant when weighing the Friday restriction. */
  specific: boolean;
  matches(hijri: HijriDate, dow: number): boolean;
}

export const OCCASIONS: readonly OccasionDef[] = [
  { id: 'ramadan', kind: 'obligatory', dateBasisKey: 'ocBasisRamadan', specific: true, evidence: [h('bukhari', 1909), h('bukhari', 38)], matches: d => d.month === 9 },
  { id: 'eid-fitr', kind: 'prohibited', dateBasisKey: 'ocBasisEidFitr', specific: true, evidence: [h('bukhari', 1990), h('bukhari', 1991)], matches: d => d.month === 10 && d.day === 1 },
  { id: 'six-shawwal', kind: 'recommended', dateBasisKey: 'ocBasisShawwal', specific: true, evidence: [h('muslim', 2758, '1164')], matches: d => d.month === 10 && d.day >= 2 },
  { id: 'dhul-hijjah', kind: 'recommended', dateBasisKey: 'ocBasisDhulHijjah', specific: true, evidence: [h('bukhari', 969), h('abudawud', 2437)], matches: d => d.month === 12 && d.day <= 8 },
  { id: 'arafah', kind: 'recommended', dateBasisKey: 'ocBasisArafah', specific: true, evidence: [h('muslim', 2746, '1162')], matches: d => d.month === 12 && d.day === 9 },
  { id: 'eid-adha', kind: 'prohibited', dateBasisKey: 'ocBasisEidAdha', specific: true, evidence: [h('bukhari', 1990), h('muslim', 2672, '1138')], matches: d => d.month === 12 && d.day === 10 },
  { id: 'tashriq', kind: 'prohibited', dateBasisKey: 'ocBasisTashriq', specific: true, evidence: [h('muslim', 2677, '1141')], matches: d => d.month === 12 && d.day >= 11 && d.day <= 13 },
  { id: 'tasua', kind: 'recommended', dateBasisKey: 'ocBasisTasua', specific: true, evidence: [h('muslim', 2667, '1134')], matches: d => d.month === 1 && d.day === 9 },
  { id: 'ashura', kind: 'recommended', dateBasisKey: 'ocBasisAshura', specific: true, evidence: [h('muslim', 2746, '1162'), h('muslim', 2637, '1125')], matches: d => d.month === 1 && d.day === 10 },
  { id: 'white-days', kind: 'recommended', dateBasisKey: 'ocBasisWhite', specific: true, evidence: [h('tirmidhi', 761), h('nasai', 2420)], matches: d => d.day >= 13 && d.day <= 15 },
  { id: 'monday', kind: 'recommended', dateBasisKey: 'ocBasisMonday', specific: false, evidence: [h('muslim', 2747, '1162'), h('tirmidhi', 747)], matches: (_d, dow) => dow === 1 },
  { id: 'thursday', kind: 'recommended', dateBasisKey: 'ocBasisThursday', specific: false, evidence: [h('tirmidhi', 747), h('tirmidhi', 745)], matches: (_d, dow) => dow === 4 },
  { id: 'friday-alone', kind: 'restricted', dateBasisKey: 'ocBasisFriday', specific: false, evidence: [h('bukhari', 1985), h('muslim', 2683, '1144')], matches: (_d, dow) => dow === 5 },
  { id: 'pre-ramadan', kind: 'restricted', dateBasisKey: 'ocBasisPreRamadan', specific: false, evidence: [h('bukhari', 1914), h('muslim', 2518, '1082')], matches: d => d.month === 8 && d.day >= 29 },
];

export const findOccasion = (id: string) => OCCASIONS.find(o => o.id === id);

export type DayStatus = 'obligatory' | 'prohibited' | 'recommended' | 'restricted' | 'ordinary';

export interface DayInfo {
  iso: string;
  hijri: HijriDate;
  hijriStatus: 'confirmed' | 'provisional';
  occasions: string[];
  status: DayStatus;
  /** i18n keys explaining overlaps and overrides on this day. */
  notes: string[];
}

export function describeDay(iso: string, prefs: CalendarPrefs): DayInfo {
  const { date, status: hijriStatus } = hijriFor(iso, prefs);
  const dow = weekday(iso);
  const matched = OCCASIONS.filter(o => o.matches(date, dow));
  const ids = matched.map(o => o.id);
  const kinds = new Set(matched.map(o => o.kind));
  const notes: string[] = [];
  let status: DayStatus = 'ordinary';

  if (kinds.has('prohibited')) {
    status = 'prohibited';
    if (kinds.has('recommended') || kinds.has('restricted')) notes.push('noteProhibitedOverrides');
  } else if (kinds.has('obligatory')) {
    status = 'obligatory';
    if (kinds.has('recommended') || kinds.has('restricted')) notes.push('noteRamadanOverrides');
  } else if (kinds.has('restricted') && kinds.has('recommended')) {
    const specific = matched.some(o => o.kind === 'recommended' && o.specific);
    if (ids.includes('friday-alone') && specific) {
      status = 'recommended';
      notes.push('noteFridayCoincides');
    } else {
      status = 'restricted';
      notes.push('noteRestrictedOverlap');
    }
  } else if (kinds.has('restricted')) {
    status = 'restricted';
  } else if (kinds.has('recommended')) {
    status = 'recommended';
  }
  if (hijriStatus === 'provisional' && matched.some(o => o.specific)) notes.push('noteProvisionalDate');
  if (ids.includes('arafah')) notes.push('noteArafahPilgrims');
  return { iso, hijri: date, hijriStatus, occasions: ids, status, notes };
}

export function describeRange(startIso: string, days: number, prefs: CalendarPrefs): DayInfo[] {
  return Array.from({ length: days }, (_, i) => describeDay(addDays(startIso, i), prefs));
}

/** Voluntary-fast suggestions never include prohibited days, Ramadan, or restricted days. */
export function voluntarySuggestions(days: DayInfo[], wanted: string[]): DayInfo[] {
  return days.filter(d => d.status === 'recommended' && d.occasions.some(o => wanted.includes(o)));
}

export interface PlanCheck {
  ok: boolean;
  code?: 'prohibited' | 'ramadan';
  occasions: string[];
}

/** Checks a date the user picked for a make-up or voluntary fast. */
export function checkFastDate(iso: string, prefs: CalendarPrefs): PlanCheck {
  const day = describeDay(iso, prefs);
  if (day.status === 'prohibited') return { ok: false, code: 'prohibited', occasions: day.occasions };
  if (day.status === 'obligatory') return { ok: false, code: 'ramadan', occasions: day.occasions };
  return { ok: true, occasions: day.occasions };
}

/** Next `count` dates from `fromIso` that are neither prohibited nor in Ramadan and not already taken. */
export function suggestMakeupDates(fromIso: string, count: number, prefs: CalendarPrefs, taken: string[] = [], horizonDays = 400): string[] {
  const out: string[] = [];
  const skip = new Set(taken);
  for (let i = 0; i < horizonDays && out.length < count; i++) {
    const iso = addDays(fromIso, i);
    if (skip.has(iso)) continue;
    if (checkFastDate(iso, prefs).ok) out.push(iso);
  }
  return out;
}

/** "YYYY-MM-DD" of `now` in an IANA timezone, so day boundaries follow the user's location. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = (t: string) => parts.find(p => p.type === t)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function offsetMinutes(timeZone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((asUtc - instant) / 60_000);
}

/** UTC instant of a wall-clock time in `timeZone` (DST-aware). */
export function zonedInstant(iso: string, hhmm: string, timeZone: string): number {
  const [hh, mm] = hhmm.split(':').map(Number);
  const wall = parseIso(iso) + (hh * 60 + mm) * 60_000;
  let guess = wall - offsetMinutes(timeZone, wall) * 60_000;
  guess = wall - offsetMinutes(timeZone, guess) * 60_000;
  return guess;
}

export interface ReminderPrefs {
  enabled: boolean;
  occasions: string[];
  includeMakeup: boolean;
  /** Local time on the evening before the fast. */
  time: string;
}

export const DEFAULT_REMINDERS: ReminderPrefs = { enabled: false, occasions: [], includeMakeup: true, time: '20:00' };

export interface Reminder {
  /** One reminder per fasting date, so overlapping occasions never produce duplicates. */
  key: string;
  forDate: string;
  fireAt: number;
  occasions: string[];
  makeup: boolean;
}

/**
 * Reminders are derived from the current calendar settings rather than stored, so changing the authority,
 * offset or timezone recalculates them and stale ones disappear.
 */
export function planReminders(
  fromIso: string,
  days: number,
  prefs: CalendarPrefs,
  reminders: ReminderPrefs,
  makeupDates: string[] = [],
): Reminder[] {
  if (!reminders.enabled) return [];
  const makeup = new Set(reminders.includeMakeup ? makeupDates : []);
  const out: Reminder[] = [];
  for (const day of describeRange(fromIso, days, prefs)) {
    const occasions = day.status === 'recommended' ? day.occasions.filter(o => reminders.occasions.includes(o)) : [];
    const isMakeup = makeup.has(day.iso) && checkFastDate(day.iso, prefs).ok;
    if (!occasions.length && !isMakeup) continue;
    out.push({
      key: `fast@${day.iso}`,
      forDate: day.iso,
      fireAt: zonedInstant(addDays(day.iso, -1), reminders.time, prefs.timezone),
      occasions,
      makeup: isMakeup,
    });
  }
  return out;
}

/** Reminders that are due and have not fired yet; `fired` holds keys already shown. */
export function dueReminders(all: Reminder[], now: number, fired: string[]): Reminder[] {
  const done = new Set(fired);
  return all.filter(r => r.fireAt <= now && now - r.fireAt < DAY_MS && !done.has(r.key));
}

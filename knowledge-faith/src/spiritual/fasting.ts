import { addGregorianDays, hijriToGregorian, toIsoDate, weekdayIndex, type GregorianDate, type HijriDate } from './hijri.ts';

export type OccasionId =
  | 'ramadan'
  | 'shawwal-six'
  | 'monday-thursday'
  | 'white-days'
  | 'arafah'
  | 'ashura'
  | 'dhul-hijjah'
  | 'eid-fitr'
  | 'eid-adha'
  | 'tashreeq';

export interface OccasionMatch {
  id: OccasionId;
  /** Planner must not offer a voluntary or make-up fast. */
  blocksFast: boolean;
}

export interface DayEvaluation {
  occasions: OccasionMatch[];
  blocksVoluntaryFast: boolean;
  /** Occasions that would otherwise be suggested, but a restriction overrides them. */
  overridden: OccasionId[];
  notes: string[];
}

const WHITE = new Set([13, 14, 15]);

/** Planner safety default for Eid and the days of Tashreeq on the selected calculated calendar. */
export function isRestrictedHijri(hijri: HijriDate): boolean {
  if (hijri.month === 10 && hijri.day === 1) return true;
  if (hijri.month === 12 && hijri.day >= 10 && hijri.day <= 13) return true;
  return false;
}

export function evaluateHijriDay(hijri: HijriDate, gregorian: GregorianDate): DayEvaluation {
  const weekday = weekdayIndex(gregorian);
  const occasions: OccasionMatch[] = [];
  const notes: string[] = [];

  if (hijri.month === 9) occasions.push({ id: 'ramadan', blocksFast: false });
  if (hijri.month === 10 && hijri.day === 1) occasions.push({ id: 'eid-fitr', blocksFast: isRestrictedHijri(hijri) });
  if (hijri.month === 10 && hijri.day >= 2 && hijri.day <= 7) occasions.push({ id: 'shawwal-six', blocksFast: false });
  if (WHITE.has(hijri.day)) occasions.push({ id: 'white-days', blocksFast: false });
  if (hijri.month === 12 && hijri.day === 9) occasions.push({ id: 'arafah', blocksFast: false });
  if (hijri.month === 12 && hijri.day === 10) occasions.push({ id: 'eid-adha', blocksFast: true });
  if (hijri.month === 12 && hijri.day >= 11 && hijri.day <= 13) occasions.push({ id: 'tashreeq', blocksFast: true });
  if (hijri.month === 12 && hijri.day >= 1 && hijri.day <= 9) occasions.push({ id: 'dhul-hijjah', blocksFast: false });
  if (hijri.month === 1 && (hijri.day === 9 || hijri.day === 10 || hijri.day === 11)) occasions.push({ id: 'ashura', blocksFast: false });
  if (weekday === 1 || weekday === 4) occasions.push({ id: 'monday-thursday', blocksFast: false });

  const blocksVoluntaryFast = occasions.some(item => item.blocksFast);
  const overridden = blocksVoluntaryFast ? occasions.filter(item => !item.blocksFast).map(item => item.id) : [];
  if (blocksVoluntaryFast && overridden.length) {
    notes.push('restriction-overrides');
  }
  if (occasions.filter(item => item.id === 'white-days' || item.id === 'tashreeq').length === 2) {
    notes.push('white-and-tashreeq');
  }
  return { occasions, blocksVoluntaryFast, overridden, notes };
}

export interface FastingIntention {
  id: string;
  kind: 'voluntary' | 'makeup';
  hijri: HijriDate;
}

export interface ResolvedIntention {
  id: string;
  kind: 'voluntary' | 'makeup';
  hijri: HijriDate;
  iso: string;
  blocked: boolean;
}

export function resolveIntentions(
  intentions: FastingIntention[],
  toIso: (hijri: HijriDate) => string,
  evaluate: (hijri: HijriDate, iso: string) => boolean,
): ResolvedIntention[] {
  return intentions.map(item => {
    const iso = toIso(item.hijri);
    return { ...item, iso, blocked: evaluate(item.hijri, iso) };
  });
}

export interface ReminderFire {
  iso: string;
  ids: string[];
}

/** One reminder per civil date. Tracking off yields none. Ids stay unique inside a date. */
export function buildReminders(resolved: ResolvedIntention[], trackingEnabled: boolean): ReminderFire[] {
  if (!trackingEnabled) return [];
  const map = new Map<string, string[]>();
  for (const item of resolved) {
    if (item.blocked) continue;
    const ids = map.get(item.iso) ?? [];
    if (!ids.includes(item.id)) ids.push(item.id);
    map.set(item.iso, ids);
  }
  return [...map.entries()].map(([iso, ids]) => ({ iso, ids }));
}

export function hijriKey(hijri: HijriDate): string {
  return `${hijri.year}-${hijri.month}-${hijri.day}`;
}

/** Civil date for a Hijri day on the on-device calendar. `shiftDays` moves the label ahead of the tabular date. */
export function civilIsoForIntention(hijri: HijriDate, shiftDays: number): string {
  const shift = Math.max(-3, Math.min(3, Math.trunc(shiftDays)));
  return toIsoDate(addGregorianDays(hijriToGregorian(hijri), -shift));
}

export function resolveIntentionIso(
  hijri: HijriDate,
  authority: 'tabular' | 'shifted' | 'aladhan',
  shiftDays: number,
  aladhanIso: ReadonlyMap<string, string> | null,
): string | null {
  if (authority === 'aladhan') return aladhanIso?.get(hijriKey(hijri)) ?? null;
  return civilIsoForIntention(hijri, authority === 'shifted' ? shiftDays : 0);
}

export function canSchedule(hijri: HijriDate, gregorian: GregorianDate): { ok: boolean; reason: 'restricted' | null } {
  const day = evaluateHijriDay(hijri, gregorian);
  return day.blocksVoluntaryFast ? { ok: false, reason: 'restricted' } : { ok: true, reason: null };
}

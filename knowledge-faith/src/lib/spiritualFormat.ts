import type { Lang } from '../shared/sources.ts';
import { HIJRI_MONTHS_EN } from '../shared/spiritual/calendar.ts';
import type { PublicGuide } from '../shared/spiritual/governance.ts';
import { useRemote } from './api.ts';

const HIJRI_MONTHS: Record<Lang, readonly string[]> = {
  en: HIJRI_MONTHS_EN,
  ta: ['முஹர்ரம்', 'ஸஃபர்', 'ரபீஉல் அவ்வல்', 'ரபீஉல் ஆகிர்', 'ஜுமாதல் ஊலா', 'ஜுமாதல் ஆகிரா', 'ரஜப்', 'ஷஅபான்', 'ரமழான்', 'ஷவ்வால்', 'துல்கஅதா', 'துல்ஹஜ்'],
  si: ['මුහර්රම්', 'සෆර්', 'රබීඋල් අව්වල්', 'රබීඋල් ආකිර්', 'ජුමාදල් ඌලා', 'ජුමාදල් ආකිරා', 'රජබ්', 'ෂඃබාන්', 'රමළාන්', 'ෂව්වාල්', 'දුල් කඃදා', 'දුල් හජ්ජා'],
};

export const hijriMonthName = (lang: Lang, month: number) => HIJRI_MONTHS[lang][month - 1] ?? String(month);

const LOCALE: Record<Lang, string> = { en: 'en-GB', ta: 'ta-LK', si: 'si-LK' };
export const localeOf = (lang: Lang) => LOCALE[lang];

/** Formats a YYYY-MM-DD date without shifting it through the device timezone. */
export function formatIso(lang: Lang, iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  const [y, m, d] = iso.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return iso;
  }
}

export function formatInstant(lang: Lang, value: string | number, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'medium', timeStyle: 'short', ...(timeZone ? { timeZone } : {}) }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function weekdayShort(lang: Lang, dow: number): string {
  // 2023-01-01 was a Sunday.
  return formatIso(lang, `2023-01-0${dow + 1}`, { weekday: 'short' });
}

/** Groups the digits of an exact decimal string for display without converting it to a float. */
export function formatAmount(lang: Lang, value: string, currency: string): string {
  const neg = value.startsWith('-');
  const [int, frac] = (neg ? value.slice(1) : value).split('.');
  const sep = lang === 'en' ? ',' : ',';
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${neg ? '−' : ''}${currency} ${grouped}${frac ? `.${frac}` : ''}`;
}

export type GuideIndex = Record<string, { status: PublicGuide['status']; scholarReviewed: boolean; languages: Lang[]; updatedAt?: string }>;

export function useGuideIndex() {
  return useRemote<GuideIndex>('/api/spiritual/guides');
}

export const spHref = (path = '') => `#/spiritual${path ? `/${path}` : ''}`;

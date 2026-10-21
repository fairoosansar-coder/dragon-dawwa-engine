import { fetchJson, DAY, UpstreamError } from './http.ts';

export interface HijriMonthDay {
  iso: string;
  year: number;
  month: number;
  day: number;
  monthName: string;
}

export interface HijriMonth {
  method: string;
  lunarSighting: boolean;
  source: 'Aladhan';
  days: HijriMonthDay[];
}

interface RawDay {
  hijri?: {
    day?: string;
    year?: string;
    month?: { number?: number; en?: string };
    method?: string;
  };
  gregorian?: { date?: string; lunarSighting?: boolean };
}

function isoFromAladhan(value: string | undefined): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value ?? '');
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** Aladhan's Gregorian-month Hijri labels. They are a calculated calendar, not a moon sighting. */
export async function getHijriMonth(year: number, month: number): Promise<HijriMonth> {
  if (!Number.isInteger(year) || year < 1900 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new UpstreamError('Month must be between 1900 and 2100', 400);
  }
  const payload = await fetchJson<{ data?: RawDay[] }>(`https://api.aladhan.com/v1/gToHCalendar/${month}/${year}`, DAY);
  const days = (payload.data ?? []).flatMap(row => {
    const iso = isoFromAladhan(row.gregorian?.date);
    const day = Number(row.hijri?.day);
    const hijriMonth = Number(row.hijri?.month?.number);
    const hijriYear = Number(row.hijri?.year);
    if (!iso || !day || !hijriMonth || !hijriYear) return [];
    return [{ iso, year: hijriYear, month: hijriMonth, day, monthName: row.hijri?.month?.en || '' }];
  });
  if (!days.length) throw new UpstreamError('Hijri calendar did not return any days', 502);
  return {
    method: payload.data?.[0]?.hijri?.method || 'Aladhan',
    lunarSighting: false,
    source: 'Aladhan',
    days,
  };
}

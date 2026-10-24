import { isoDateInZone } from '../spiritual/hijri.ts';

/** Calendar date at the saved place. Unknown timezone omits the date so the provider can name the zone. */
export function prayerQueryDate(now: Date, timeZone: string | null | undefined): string | null {
  if (!timeZone) return null;
  try {
    return isoDateInZone(now, timeZone);
  } catch {
    return null;
  }
}

/**
 * Calculation settings for prayer times. Method ids and parameters are those published by the Aladhan API
 * (GET /v1/methods), which performs the calculation; the app labels every result as calculated.
 */
export interface CalcMethod {
  id: number;
  name: string;
  params: string;
}

export const CALC_METHODS: readonly CalcMethod[] = [
  { id: 3, name: 'Muslim World League', params: 'Fajr 18°, Isha 17°' },
  { id: 2, name: 'Islamic Society of North America (ISNA)', params: 'Fajr 15°, Isha 15°' },
  { id: 5, name: 'Egyptian General Authority of Survey', params: 'Fajr 19.5°, Isha 17.5°' },
  { id: 4, name: 'Umm Al-Qura University, Makkah', params: 'Fajr 18.5°, Isha 90 min' },
  { id: 1, name: 'University of Islamic Sciences, Karachi', params: 'Fajr 18°, Isha 18°' },
  { id: 8, name: 'Gulf Region', params: 'Fajr 19.5°, Isha 90 min' },
  { id: 9, name: 'Kuwait', params: 'Fajr 18°, Isha 17.5°' },
  { id: 10, name: 'Qatar', params: 'Fajr 18°, Isha 90 min' },
  { id: 11, name: 'Majlis Ugama Islam Singapura, Singapore', params: 'Fajr 20°, Isha 18°' },
  { id: 12, name: 'Union Organization Islamic de France', params: 'Fajr 12°, Isha 12°' },
  { id: 13, name: 'Diyanet İşleri Başkanlığı, Turkey (experimental)', params: 'Fajr 18°, Isha 17°' },
  { id: 14, name: 'Spiritual Administration of Muslims of Russia', params: 'Fajr 16°, Isha 15°' },
  { id: 15, name: 'Moonsighting Committee Worldwide', params: 'Seasonal (shafaq general)' },
  { id: 16, name: 'Dubai (experimental)', params: 'Fajr 18.2°, Isha 18.2°' },
  { id: 17, name: 'JAKIM, Malaysia', params: 'Fajr 20°, Isha 18°' },
  { id: 18, name: 'Tunisia', params: 'Fajr 18°, Isha 18°' },
  { id: 19, name: 'Algeria', params: 'Fajr 18°, Isha 17°' },
  { id: 20, name: 'Kementerian Agama, Indonesia', params: 'Fajr 20°, Isha 18°' },
  { id: 21, name: 'Morocco', params: 'Fajr 19°, Isha 17°' },
  { id: 22, name: 'Comunidade Islamica de Lisboa', params: 'Fajr 18°, Maghrib +3 min, Isha 77 min' },
  { id: 23, name: 'Ministry of Awqaf, Jordan', params: 'Fajr 18°, Maghrib +5 min, Isha 18°' },
  { id: 0, name: 'Shia Ithna-Ashari, Leva Institute, Qum', params: 'Fajr 16°, Maghrib 4°, Isha 14°' },
  { id: 7, name: 'Institute of Geophysics, University of Tehran', params: 'Fajr 17.7°, Maghrib 4.5°, Isha 14°' },
];

/** Aladhan latitudeAdjustmentMethod: how Fajr/Isha are estimated where twilight never fully ends. */
export const HIGH_LATITUDE_RULES = [
  { id: 3, key: 'hlAngle' },
  { id: 1, key: 'hlMiddle' },
  { id: 2, key: 'hlSeventh' },
] as const;
export type HighLatitudeRule = (typeof HIGH_LATITUDE_RULES)[number]['id'];

export const TUNABLE = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type Tunable = (typeof TUNABLE)[number];
/** Minutes added to each calculated time, e.g. to match a mosque's published safety margins. */
export type Tune = Partial<Record<Tunable, number>>;

export const MAX_TUNE_MINUTES = 30;

export function validTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface PrayerCalendarDay {
  /** YYYY-MM-DD */
  date: string;
  timings: PrayerTimings;
  hijri: { day: string; month: number; year: string };
}

export interface PrayerCalendar {
  days: PrayerCalendarDay[];
  timezone: string;
  method: { id: number; name: string };
  school: 0 | 1;
  highLatitude: string;
  tune: Tune;
  /** Every value is calculated by Aladhan from coordinates; it is not a mosque timetable. */
  source: 'aladhan-calculated';
}

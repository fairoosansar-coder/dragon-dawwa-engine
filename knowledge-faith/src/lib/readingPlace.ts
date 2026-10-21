import { useEffect, useState } from 'react';

/** Existing key. Older builds stored a surah number; it now stores `{ surah, ayah }`. */
export const READING_PLACE_KEY = 'kf-last-surah';
export const TEXT_SIZE_KEY = 'kf-text-size';

export interface ReadingPlace {
  surah: number;
  ayah: number;
}

export type TextSize = 'sm' | 'md' | 'lg';

export function clampSurah(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(114, Math.max(1, Math.trunc(value)));
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function coerceSurah(value: unknown): number {
  const parsed = finiteNumber(value);
  return parsed == null ? 1 : clampSurah(parsed);
}

function coerceAyah(value: unknown): number {
  const parsed = finiteNumber(value);
  if (parsed == null || parsed < 1) return 1;
  return Math.trunc(parsed);
}

/**
 * Accept a legacy surah number, a numeric string, `{ surah, ayah }`, or a wrapped copy of that object.
 * Malformed input falls back to 1:1. The result is always two numbers.
 */
export function migrateReadingPlace(raw: unknown): ReadingPlace {
  if (typeof raw === 'number') return { surah: clampSurah(raw), ayah: 1 };
  if (typeof raw === 'string') {
    const parsed = finiteNumber(raw);
    return parsed == null ? { surah: 1, ayah: 1 } : { surah: clampSurah(parsed), ayah: 1 };
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) return { surah: 1, ayah: 1 };
    return { surah: coerceSurah(raw[0]), ayah: raw.length > 1 ? coerceAyah(raw[1]) : 1 };
  }
  if (raw && typeof raw === 'object') {
    const rec = raw as { surah?: unknown; ayah?: unknown };
    if (rec.surah && typeof rec.surah === 'object') {
      const nested = migrateReadingPlace(rec.surah);
      const ayah = finiteNumber(rec.ayah);
      return { surah: nested.surah, ayah: ayah != null && ayah >= 1 ? Math.trunc(ayah) : nested.ayah };
    }
    if (rec.surah == null && rec.ayah == null) return { surah: 1, ayah: 1 };
    return { surah: coerceSurah(rec.surah), ayah: coerceAyah(rec.ayah) };
  }
  return { surah: 1, ayah: 1 };
}

/** Parse storage text. Invalid JSON is returned as text so migration can still read a legacy number. */
export function parseStoredReadingPlace(raw: string): unknown {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'string') {
      try {
        return JSON.parse(parsed) as unknown;
      } catch {
        return parsed;
      }
    }
    return parsed;
  } catch {
    return raw;
  }
}

type PlaceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readReadingPlace(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): ReadingPlace {
  try {
    const raw = storage?.getItem(READING_PLACE_KEY);
    if (raw == null || raw === '') return { surah: 1, ayah: 1 };
    return migrateReadingPlace(parseStoredReadingPlace(raw));
  } catch {
    return { surah: 1, ayah: 1 };
  }
}

/** Write the migrated place. A legacy number becomes `{ surah, ayah }` without dropping the surah. */
export function rememberReadingPlace(place: ReadingPlace, storage: PlaceStorage | undefined = globalThis.localStorage): ReadingPlace {
  const safe = migrateReadingPlace(place);
  try {
    const next = JSON.stringify(safe);
    if (storage && storage.getItem(READING_PLACE_KEY) !== next) storage.setItem(READING_PLACE_KEY, next);
  } catch {
    /* storage full or disabled: keep the place in memory */
  }
  return safe;
}

/** A string, so a stored place is never passed to React as an object child. */
export function readingPlaceLabel(surah: unknown, ayah?: unknown): string {
  const place = migrateReadingPlace(ayah === undefined ? surah : { surah, ayah });
  return `${place.surah}:${place.ayah}`;
}

/** Surah index shown beside the page count. Always a finite surah number. */
export function displaySurah(value: unknown): number {
  return migrateReadingPlace(typeof value === 'number' || typeof value === 'string' ? value : { surah: value }).surah;
}

/** Ayah index for text. A missing or unusable value stays at 1. */
export function displayAyah(value: unknown): number {
  if (typeof value === 'number' || typeof value === 'string') return coerceAyah(value);
  return migrateReadingPlace(value).ayah;
}

/**
 * Normalize an ayah only against the surah that was actually requested.
 * A value below 1 means “last ayah” and must wait until that surah’s count is loaded.
 */
export function ayahForLoadedSurah(
  selectedSurah: number,
  loadedSurah: number | null | undefined,
  loadedCount: number | null | undefined,
  ayah: number,
): number | null {
  if (loadedSurah == null || loadedCount == null) return null;
  if (loadedSurah !== selectedSurah || loadedCount < 1) return null;
  if (!Number.isFinite(ayah) || ayah < 1 || ayah > loadedCount) return loadedCount;
  return Math.trunc(ayah);
}

export function readTextSize(raw: unknown): TextSize {
  return raw === 'sm' || raw === 'md' || raw === 'lg' ? raw : 'md';
}

export function useReadingPlace(): [ReadingPlace, (value: ReadingPlace | ((prev: ReadingPlace) => ReadingPlace)) => void] {
  const [place, setPlace] = useState<ReadingPlace>(() => readReadingPlace());
  useEffect(() => {
    rememberReadingPlace(place);
  }, [place]);
  return [place, setPlace];
}

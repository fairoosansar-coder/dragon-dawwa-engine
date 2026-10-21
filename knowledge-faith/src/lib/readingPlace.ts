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

/** Accept a legacy surah number or a place object. Invalid input falls back to 1:1. */
export function migrateReadingPlace(raw: unknown): ReadingPlace {
  if (typeof raw === 'number') return { surah: clampSurah(raw), ayah: 1 };
  if (raw && typeof raw === 'object') {
    const rec = raw as { surah?: unknown; ayah?: unknown };
    const surah = typeof rec.surah === 'number' ? clampSurah(rec.surah) : 1;
    const ayah = typeof rec.ayah === 'number' && Number.isFinite(rec.ayah) && rec.ayah >= 1 ? Math.trunc(rec.ayah) : 1;
    return { surah, ayah };
  }
  return { surah: 1, ayah: 1 };
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

function readPlace(): ReadingPlace {
  try {
    const raw = localStorage.getItem(READING_PLACE_KEY);
    return raw === null ? { surah: 1, ayah: 1 } : migrateReadingPlace(JSON.parse(raw));
  } catch {
    return { surah: 1, ayah: 1 };
  }
}

export function useReadingPlace(): [ReadingPlace, (value: ReadingPlace | ((prev: ReadingPlace) => ReadingPlace)) => void] {
  const [place, setPlace] = useState<ReadingPlace>(readPlace);
  useEffect(() => {
    try {
      const next = JSON.stringify(place);
      if (localStorage.getItem(READING_PLACE_KEY) !== next) localStorage.setItem(READING_PLACE_KEY, next);
    } catch {
      /* storage full or disabled: keep the place in memory */
    }
  }, [place]);
  return [place, setPlace];
}

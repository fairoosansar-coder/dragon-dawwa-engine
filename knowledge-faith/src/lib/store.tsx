import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toLang, type Lang } from '../shared/sources.ts';
import type { HadithRef } from '../shared/refs.ts';
import { STRINGS, type Strings } from './i18n.ts';
import { useRemote } from './api.ts';

const storedListeners = new Map<string, Set<(value: unknown) => void>>();

export function useStored<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    const listeners = storedListeners.get(key) ?? new Set<(value: unknown) => void>();
    const onStore = (next: unknown) => setValue(next as T);
    listeners.add(onStore);
    storedListeners.set(key, listeners);
    return () => {
      listeners.delete(onStore);
    };
  }, [key]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or disabled: keep in memory only */
    }
  }, [key, value]);
  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
      queueMicrotask(() => storedListeners.get(key)?.forEach(listener => listener(resolved)));
      return resolved;
    });
  }, [key]);
  return [value, update];
}

export interface AppConfig {
  ai: boolean;
  reciters: { id: string; name: string }[];
  voices: string[];
  prayerMethods: { id: number; name: string }[];
  hadithCollections: { id: string; name: string; tamil: boolean }[];
}

interface Saved {
  verses: string[];
  hadith: HadithRef[];
  notes?: Record<string, string>;
}

export type UiThemeId = 'parchment' | 'obsidian' | 'sepia';
export type UiFontScaleId = 'compact' | 'standard' | 'comfortable' | 'large';

export const UI_FONT_SCALES: Record<UiFontScaleId, { label: string; badge: string; htmlPx: string; bodyPx: string }> = {
  compact: { label: 'Compact', badge: '13px', htmlPx: '14.5px', bodyPx: '13px' },
  standard: { label: 'Standard', badge: '14px', htmlPx: '15.25px', bodyPx: '13.75px' },
  comfortable: { label: 'Comfortable', badge: '15.5px', htmlPx: '16.5px', bodyPx: '15.5px' },
  large: { label: 'Large Reading', badge: '17px', htmlPx: '18px', bodyPx: '17px' },
};

export const UI_THEMES: Record<UiThemeId, { label: string; subtitle: string; sand: string; parchment: string; pine: string; ink: string; muted: string; swatch: string }> = {
  parchment: {
    label: 'Parchment (Light)',
    subtitle: 'Warm ivory & classic emerald',
    sand: '#F8F5EC',
    parchment: '#F5EEDC',
    pine: '#073C30',
    ink: '#172720',
    muted: '#57534E',
    swatch: 'linear-gradient(135deg, #F8F5EC 0%, #073C30 100%)',
  },
  obsidian: {
    label: 'Obsidian Emerald (Dark)',
    subtitle: 'Deep masjid emerald & gilded ivory',
    sand: '#061F18',
    parchment: '#0A2E23',
    pine: '#E5C158',
    ink: '#F5EEDC',
    muted: '#C8D6CE',
    swatch: 'linear-gradient(135deg, #04241C 0%, #C6A15A 100%)',
  },
  sepia: {
    label: 'Warm Sepia (Manuscript)',
    subtitle: 'Mushaf cream & gilded ink',
    sand: '#EFE2C6',
    parchment: '#E4D3AF',
    pine: '#0B3B2D',
    ink: '#1E1810',
    muted: '#5C4B35',
    swatch: 'linear-gradient(135deg, #F2E6CE 0%, #C6A15A 100%)',
  },
};

interface AppState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  uiTheme: UiThemeId;
  setUiTheme: (theme: UiThemeId) => void;
  fontScale: UiFontScaleId;
  setFontScale: (scale: UiFontScaleId) => void;
  t: Strings;
  config: AppConfig | null;
  saved: Saved;
  toggleVerse: (key: string) => void;
  toggleHadith: (ref: HadithRef) => void;
  isVerseSaved: (key: string) => boolean;
  isHadithSaved: (ref: HadithRef) => boolean;
  notes: Record<string, string>;
  setVerseNote: (key: string, note: string) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [storedLang, setLang] = useStored<Lang>('kf-lang', 'en');
  const lang = toLang(storedLang);
  const [storedTheme, setUiTheme] = useStored<UiThemeId>('kf-ui-theme', 'parchment');
  const uiTheme: UiThemeId = storedTheme === 'obsidian' || storedTheme === 'sepia' ? storedTheme : 'parchment';
  const [storedScale, setFontScale] = useStored<UiFontScaleId>('kf-font-scale', 'standard');
  const fontScale: UiFontScaleId =
    storedScale === 'compact' || storedScale === 'comfortable' || storedScale === 'large'
      ? storedScale
      : 'standard';
  const [saved, setSaved] = useStored<Saved>('kf-saved', { verses: [], hadith: [] });
  const { data: config } = useRemote<AppConfig>('/api/config');

  useEffect(() => {
    document.documentElement.lang = 'en';
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const themeSpec = UI_THEMES[uiTheme] ?? UI_THEMES.parchment;
    const root = document.documentElement;
    root.dataset.uiTheme = uiTheme;
    root.style.setProperty('--color-sand', themeSpec.sand);
    root.style.setProperty('--color-parchment', themeSpec.parchment);
    root.style.setProperty('--color-pine', themeSpec.pine);
    root.style.setProperty('--color-ink', themeSpec.ink);
    root.style.setProperty('--color-muted', themeSpec.muted);
  }, [uiTheme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const scaleSpec = UI_FONT_SCALES[fontScale] ?? UI_FONT_SCALES.standard;
    const root = document.documentElement;
    root.dataset.fontScale = fontScale;
    root.style.fontSize = scaleSpec.htmlPx;
    if (document.body) {
      document.body.style.fontSize = scaleSpec.bodyPx;
    }
  }, [fontScale]);

  const toggleVerse = useCallback(
    (key: string) =>
      setSaved(s => ({
        ...s,
        verses: s.verses.includes(key) ? s.verses.filter(k => k !== key) : [key, ...s.verses],
      })),
    [setSaved],
  );

  const sameHadith = (a: HadithRef, b: HadithRef) => a.collection === b.collection && a.number === b.number;

  const setVerseNote = useCallback((key: string, note: string) => {
    const text = note.trim().slice(0, 2000);
    setSaved(current => {
      const notes = { ...(current.notes ?? {}) };
      if (text) notes[key] = text;
      else delete notes[key];
      return { ...current, notes };
    });
  }, [setSaved]);

  const toggleHadith = useCallback(
    (ref: HadithRef) =>
      setSaved(s => ({
        ...s,
        hadith: s.hadith.some(h => sameHadith(h, ref)) ? s.hadith.filter(h => !sameHadith(h, ref)) : [ref, ...s.hadith],
      })),
    [setSaved],
  );

  const value = useMemo<AppState>(
    () => ({
      lang,
      setLang,
      uiTheme,
      setUiTheme,
      fontScale,
      setFontScale,
      t: STRINGS.en,
      config,
      saved,
      toggleVerse,
      toggleHadith,
      isVerseSaved: key => saved.verses.includes(key),
      isHadithSaved: ref => saved.hadith.some(h => sameHadith(h, ref)),
      notes: saved.notes ?? {},
      setVerseNote,
    }),
    [lang, setLang, uiTheme, setUiTheme, fontScale, setFontScale, config, saved, toggleVerse, toggleHadith, setVerseNote],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

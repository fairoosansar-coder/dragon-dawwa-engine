import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toLang, type Lang } from '../shared/sources.ts';
import type { HadithRef } from '../shared/refs.ts';
import { STRINGS, type Strings } from './i18n.ts';
import { useRemote } from './api.ts';

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
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or disabled: keep in memory only */
    }
  }, [key, value]);
  return [value, setValue];
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
}

interface AppState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Strings;
  config: AppConfig | null;
  saved: Saved;
  toggleVerse: (key: string) => void;
  toggleHadith: (ref: HadithRef) => void;
  isVerseSaved: (key: string) => boolean;
  isHadithSaved: (ref: HadithRef) => boolean;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [storedLang, setLang] = useStored<Lang>('kf-lang', 'en');
  const lang = toLang(storedLang);
  const [saved, setSaved] = useStored<Saved>('kf-saved', { verses: [], hadith: [] });
  const { data: config } = useRemote<AppConfig>('/api/config');

  useEffect(() => {
    document.documentElement.lang = 'en';
  }, []);

  const toggleVerse = useCallback(
    (key: string) =>
      setSaved(s => ({
        ...s,
        verses: s.verses.includes(key) ? s.verses.filter(k => k !== key) : [key, ...s.verses],
      })),
    [setSaved],
  );

  const sameHadith = (a: HadithRef, b: HadithRef) => a.collection === b.collection && a.number === b.number;

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
      t: STRINGS.en,
      config,
      saved,
      toggleVerse,
      toggleHadith,
      isVerseSaved: key => saved.verses.includes(key),
      isHadithSaved: ref => saved.hadith.some(h => sameHadith(h, ref)),
    }),
    [lang, setLang, config, saved, toggleVerse, toggleHadith],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

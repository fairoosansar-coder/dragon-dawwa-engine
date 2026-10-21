import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_CALENDAR, DEFAULT_REMINDERS, type CalendarPrefs, type ReminderPrefs } from '../shared/spiritual/calendar.ts';
import type { ZakahInput, ZakahResult } from '../shared/spiritual/zakah.ts';
import type { Tune } from '../shared/spiritual/prayerSettings.ts';
import { useApp } from './store.tsx';
import { SP_STRINGS } from './i18nSpiritual.ts';

/**
 * Private, device-local data for the Five Pillars section. Every key starts with PREFIX so the whole set can be
 * exported or deleted together. Values are shared between components through a small subscription store.
 */
export const PREFIX = 'dd-sp-';

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const cache = new Map<string, unknown>();

function storageFor(session: boolean): Storage | null {
  try {
    return session ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string, initial: T, session: boolean): T {
  const id = `${session ? 's:' : 'l:'}${key}`;
  if (cache.has(id)) return cache.get(id) as T;
  let value = initial;
  try {
    const raw = storageFor(session)?.getItem(key);
    if (raw !== null && raw !== undefined) value = JSON.parse(raw) as T;
  } catch {
    /* unreadable: use the initial value */
  }
  cache.set(id, value);
  return value;
}

function write<T>(key: string, value: T, session: boolean) {
  const id = `${session ? 's:' : 'l:'}${key}`;
  if (value === undefined) cache.delete(id);
  else cache.set(id, value);
  try {
    if (value === undefined) storageFor(session)?.removeItem(key);
    else storageFor(session)?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled: keep in memory */
  }
  listeners.get(id)?.forEach(l => l());
}

function subscribe(id: string, l: Listener) {
  let set = listeners.get(id);
  if (!set) listeners.set(id, (set = new Set()));
  set.add(l);
  return () => set!.delete(l);
}

export function useLocal<T>(key: string, initial: T, opts: { session?: boolean } = {}): [T, (v: T | ((prev: T) => T)) => void] {
  const session = Boolean(opts.session);
  const id = `${session ? 's:' : 'l:'}${key}`;
  const value = useSyncExternalStore(
    useCallback(l => subscribe(id, l), [id]),
    () => read(key, initial, session),
    () => initial,
  );
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      const prev = read(key, initial, session);
      write(key, typeof v === 'function' ? (v as (p: T) => T)(prev) : v, session);
    },
    // `initial` is only a default; changing its identity must not recreate the setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, session],
  );
  return [value, set];
}

/* ---------- Shapes ---------- */

export interface Place {
  name: string;
  lat: number;
  lng: number;
}

export interface PrayerPrefs {
  method: number;
  school: 0 | 1;
  highLatitude: 1 | 2 | 3;
  tune: Tune;
  /** "auto" uses the provider's timezone for the coordinates. */
  timezone: string;
}

export interface ReadingPrefs {
  mode: 'book' | 'plain';
  border: boolean;
  size: number;
}

export interface SavedCalculation {
  id: string;
  name: string;
  savedAt: string;
  input: ZakahInput;
  result: ZakahResult;
}

export interface QuestionDraft {
  id: string;
  topic: string;
  question: string;
  context: string;
  school: string;
  updatedAt: string;
}

export interface FastingLog {
  enabled: boolean;
  entries: Record<string, 'fasted' | 'makeup'>;
  notes: Record<string, string>;
}

export interface MakeupPlan {
  intended: number;
  dates: string[];
  done: string[];
}

export interface TodayPrefs {
  enabled: boolean;
  prayer: boolean;
  dhikr: boolean;
  occasion: boolean;
  goal: boolean;
  goalText: string;
  pinnedDua: string | null;
}

export const KEYS = {
  place: `${PREFIX}place`,
  prayer: `${PREFIX}prayer`,
  bookmarks: `${PREFIX}bookmarks`,
  progress: `${PREFIX}progress`,
  reading: `${PREFIX}reading`,
  positions: `${PREFIX}positions`,
  calendar: `${PREFIX}calendar`,
  reminders: `${PREFIX}reminders`,
  remindersFired: `${PREFIX}reminders-fired`,
  fastingLog: `${PREFIX}fasting-log`,
  makeup: `${PREFIX}makeup`,
  voluntary: `${PREFIX}voluntary`,
  zakahSaved: `${PREFIX}zakah-saved`,
  zakahDraft: `${PREFIX}zakah-draft`,
  today: `${PREFIX}today`,
  checklists: `${PREFIX}checklists`,
  questions: `${PREFIX}questions`,
  personalDuas: `${PREFIX}personal-duas`,
  declination: `${PREFIX}declination`,
  migrated: `${PREFIX}migrated`,
  editorToken: `${PREFIX}editor-token`,
  prefill: `${PREFIX}question-prefill`,
} as const;

export interface QuestionPrefill {
  topic: string;
  question: string;
  context: string;
}

/** Hands a draft to the question composer for this tab only. */
export function setQuestionPrefill(p: QuestionPrefill) {
  write(KEYS.prefill, p, true);
}
export const useQuestionPrefill = () => useLocal<QuestionPrefill | null>(KEYS.prefill, null, { session: true });

export const DEFAULT_PRAYER: PrayerPrefs = { method: 3, school: 0, highLatitude: 3, tune: {}, timezone: 'auto' };
export const DEFAULT_READING: ReadingPrefs = { mode: 'book', border: true, size: 2 };
export const DEFAULT_LOG: FastingLog = { enabled: false, entries: {}, notes: {} };
export const DEFAULT_MAKEUP: MakeupPlan = { intended: 0, dates: [], done: [] };
export const DEFAULT_TODAY: TodayPrefs = { enabled: false, prayer: true, dhikr: true, occasion: true, goal: false, goalText: '', pinnedDua: null };

export const usePlace = () => useLocal<Place | null>(KEYS.place, null);
export const usePrayerPrefs = () => useLocal<PrayerPrefs>(KEYS.prayer, DEFAULT_PRAYER);
export const useBookmarks = () => useLocal<string[]>(KEYS.bookmarks, []);
export const useProgress = () => useLocal<{ enabled: boolean; opened: Record<string, string> }>(KEYS.progress, { enabled: false, opened: {} });
export const useReading = () => useLocal<ReadingPrefs>(KEYS.reading, DEFAULT_READING);
export const usePositions = () => useLocal<Record<string, string>>(KEYS.positions, {});
export const useCalendarPrefs = () => useLocal<CalendarPrefs>(KEYS.calendar, { ...DEFAULT_CALENDAR, timezone: deviceTimeZone() });
export const useReminderPrefs = () => useLocal<ReminderPrefs>(KEYS.reminders, DEFAULT_REMINDERS);
export const useFiredReminders = () => useLocal<string[]>(KEYS.remindersFired, []);
export const useFastingLog = () => useLocal<FastingLog>(KEYS.fastingLog, DEFAULT_LOG);
export const useMakeup = () => useLocal<MakeupPlan>(KEYS.makeup, DEFAULT_MAKEUP);
export const useVoluntary = () => useLocal<string[]>(KEYS.voluntary, ['monday', 'thursday', 'white-days']);
export const useSavedCalculations = () => useLocal<SavedCalculation[]>(KEYS.zakahSaved, []);
export const useTodayPrefs = () => useLocal<TodayPrefs>(KEYS.today, DEFAULT_TODAY);
export const useChecklists = () => useLocal<Record<string, Record<string, { done: boolean; checkedOn?: string }>>>(KEYS.checklists, {});
export const useQuestions = () => useLocal<QuestionDraft[]>(KEYS.questions, []);
export const usePersonalDuas = () => useLocal<{ id: string; text: string }[]>(KEYS.personalDuas, []);

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function useSp() {
  const { lang } = useApp();
  return useMemo(() => ({ s: SP_STRINGS[lang], lang }), [lang]);
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/* ---------- Migration from the previous Prayer & Spiritual page ---------- */

/** The old page stored Colombo as a default before anyone chose it, so that exact value is not treated as a choice. */
const OLD_DEFAULT_PLACE = { name: 'Colombo', lat: 6.9271, lng: 79.8612 };

/** Additive: copies values from the old keys into the new ones once. The old keys are left in place. */
export function migrateSpiritualStorage() {
  const ls = storageFor(false);
  if (!ls || ls.getItem(KEYS.migrated)) return;
  const get = (k: string) => {
    try {
      const raw = ls.getItem(k);
      return raw === null ? undefined : (JSON.parse(raw) as unknown);
    } catch {
      return undefined;
    }
  };
  const place = get('kf-place') as Place | undefined;
  if (
    place &&
    !ls.getItem(KEYS.place) &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng) &&
    !(place.name === OLD_DEFAULT_PLACE.name && place.lat === OLD_DEFAULT_PLACE.lat && place.lng === OLD_DEFAULT_PLACE.lng)
  ) {
    write(KEYS.place, place, false);
  }
  const method = get('kf-method');
  const school = get('kf-school');
  if (!ls.getItem(KEYS.prayer) && (typeof method === 'number' || typeof school === 'number')) {
    write(KEYS.prayer, { ...DEFAULT_PRAYER, method: typeof method === 'number' ? method : 3, school: school === 1 ? 1 : 0 }, false);
  }
  const draft = get('kf-scholar-draft');
  if (typeof draft === 'string' && draft.trim() && !ls.getItem(KEYS.questions)) {
    write(KEYS.questions, [{ id: newId(), topic: '', question: draft, context: '', school: '', updatedAt: new Date().toISOString() }], false);
  }
  write(KEYS.migrated, 1, false);
}

/** Every section key, for export and deletion. The shared tasbih counter keys predate the section and are included. */
export function sectionKeys(): string[] {
  const ls = storageFor(false);
  if (!ls) return [];
  const keys: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith(PREFIX) && k !== KEYS.migrated) keys.push(k);
  }
  return keys.concat(['kf-tasbih', 'kf-tasbih-target', 'kf-tasbih-phrase'].filter(k => ls.getItem(k) !== null));
}

export function exportSectionData(): string {
  const ls = storageFor(false);
  const out: Record<string, unknown> = {};
  for (const k of sectionKeys()) {
    try {
      out[k] = JSON.parse(ls!.getItem(k) ?? 'null');
    } catch {
      out[k] = ls!.getItem(k);
    }
  }
  return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'Dragon Dawwa · Five Pillars & Spiritual Life', data: out }, null, 2);
}

export function deleteSectionData(keys: string[] = sectionKeys()) {
  for (const k of keys) write(k, undefined, false);
}

export function downloadText(filename: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

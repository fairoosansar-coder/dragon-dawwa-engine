// Quran — Home, Reader, Ayah Study and My Quran Collection (Dragon Dawwa redesign).
// Text: Uthmani Hafs (King Fahd Complex print, via QuranEnc), verified word-for-word against the Quran.ai reader page.
// Translations, tafsir and word-by-word come from Quran.ai (quran.com) — see quranGrounded.ts. Saheeh International is also
// bundled for offline reading (Tanzil revision). Tamil and Sinhala editions are not in the Quran.ai catalogue yet.
// Reading, bookmarks, notes and study happen inside Dragon Dawwa; original-source links are optional.
import React from 'react';
import {
  BookOpen, Play, Pause, SkipBack, SkipForward, Repeat1, Bookmark, BookmarkCheck, NotebookPen, Copy, Share2,
  GraduationCap, LibraryBig, House, Search, ChevronLeft, ExternalLink, X, CloudOff, WifiOff, RefreshCw, Hourglass,
  ShieldCheck, Mic, Upload, Languages, Headphones, ChevronDown, Check, Minus, Plus, Podcast, CalendarCheck,
  MessageCircleQuestion, Info, Eye, EyeOff, FileText,
} from 'lucide-react';
import { SupportedLanguage } from '../utils/localization';
import { RubElHizb, PatternSurface, StarDivider } from './ornaments';
import { SURAH_INDEX, EMBEDDED_SURAHS, EMBEDDED_AYAT, EMBEDDED_META, JUZ_START_PAGES } from './quranData';
import { QURAN_STRINGS, QuranStrings } from './quranI18n';
import { BOOK_STRINGS } from './quranBookI18n';
import { GROUNDED_TR, QURAN_AI_TRANSLATIONS, QURAN_AI_TAFSIR, trCitation } from './quranGrounded';

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const toArabicDigits = (n: number | string) => String(n).replace(/\d/g, d => AR_DIGITS[+d]);
const key = (s: number, a: number) => `${s}:${a}`;

/* ---------- catalogues: named translations, reciters, tafsir ---------- */
export type TrProvider = 'bundled' | 'quran-ai' | 'none';
export interface TranslationOption { id: string; language: 'English' | 'Tamil' | 'Sinhala'; name: string; by: string; available: boolean; source: string; provider: TrProvider; edition?: string; }
const qai = (id: string, edition: string): TranslationOption => {
  const e = QURAN_AI_TRANSLATIONS.find(x => x.id === edition)!;
  return { id, language: 'English', name: e.by === 'Sahih International' ? 'Saheeh International' : e.by, by: `${e.name} — ${e.by}`, available: true, source: `https://quran.com/1?translations=${e.qcId}`, provider: 'quran-ai', edition };
};
export const QURAN_TRANSLATIONS: TranslationOption[] = [
  { id: 'saheeh', language: 'English', name: 'Saheeh International', by: 'The Qur’an: English Translation of the Meanings — Sahih International (offline copy: Tanzil revision)', available: true, source: 'https://quran.com/1?translations=20', provider: 'bundled', edition: 'en-sahih-international' },
  qai('abdel-haleem', 'en-abdel-haleem'),
  qai('taqi-usmani', 'en-taqi-usmani'),
  qai('hilali-khan', 'en-al-hilali-khan'),
  qai('yusufali', 'en-yusufali'),
  qai('pickthall', 'en-pickthall'),
  { id: 'baqavi', language: 'Tamil', name: 'Abdul Hameed Baqavi', by: 'Abdul Hameed Baqavi', available: false, source: 'https://quran.com', provider: 'none' },
  { id: 'jan-trust', language: 'Tamil', name: 'Jan Trust Foundation', by: 'Jan Trust Foundation', available: false, source: 'https://tanzil.net/trans/', provider: 'none' },
  { id: 'ruwwad-si', language: 'Sinhala', name: 'Ruwwad Translation Center', by: 'Ruwwad Translation Center', available: false, source: 'https://quranenc.com/en/home', provider: 'none' },
];
/** translation text for an ayah: Quran.ai text when present, else the bundled copy (Saheeh only), else nothing */
export const trTextFor = (id: string, k: string, bundled?: string): string | undefined => {
  const o = QURAN_TRANSLATIONS.find(x => x.id === id); if (!o) return undefined;
  if (o.edition && GROUNDED_TR[o.edition]?.[k]) return GROUNDED_TR[o.edition][k];
  return o.provider === 'bundled' ? bundled : undefined;
};
export const trCitationFor = (id: string, k: string) => {
  const o = QURAN_TRANSLATIONS.find(x => x.id === id); const e = o?.edition && QURAN_AI_TRANSLATIONS.find(x => x.id === o.edition);
  return e ? trCitation(e.qcId, k) : o?.source ?? 'https://quran.com';
};
export interface ReciterOption { id: string; name: string; style: string; }
export const QURAN_RECITERS: ReciterOption[] = [
  { id: 'alafasy', name: 'Mishary Rashid Alafasy', style: 'Murattal' },
  { id: 'abdulbasit', name: 'Abdul Basit Abdus Samad', style: 'Mujawwad' },
  { id: 'ghamdi', name: 'Saad Al-Ghamdi', style: 'Murattal' },
  { id: 'sudais', name: 'Abdul Rahman Al-Sudais', style: 'Murattal' },
];
export { AYAH_QUESTIONS_EXPORT as AYAH_QUESTIONS };
export const TAFSIR_SOURCES = QURAN_AI_TAFSIR.map(x => ({ id: x.id, name: x.name, note: `${x.by} · ${x.note}` }));

/* reflection prompts are Dragon Dawwa editorial questions, not tafsir */
const AYAH_QUESTIONS_EXPORT: Record<string, string[]> = {
  '1:5': [
    'The ayah says “You alone” twice. What in your day competes with worshipping Allah alone?',
    'Why might asking for help come after worship in this ayah?',
    'The reciter says “we”, not “I”. What does praying in the plural teach you?',
  ],
};

/* ---------- context ---------- */
export type QuranView = 'home' | 'book' | 'reader' | 'search' | 'study' | 'collection';
export type ReadMode = 'mushaf' | 'meaning' | 'cards';
export type BookmarkLabel = 'read' | 'memorise' | 'reflect';
export interface SurahMeta { pg: number[]; jz: number[]; sj: number[] }
export type LoadStatus = 'ready' | 'loading' | 'missing' | 'error';
export type ReviewStatus = 'awaiting' | 'published' | 'changes';
export interface QuranSubmission { id: string; kind: 'explanation' | 'podcast'; ref: string; title: string; status: ReviewStatus; when: string; length?: string; }
export type SelMode = 'ayah' | 'word' | 'phrase';
export interface ReaderSettings { nav: 'page' | 'ayah'; arrows: boolean; pin: boolean; selectFirst: boolean; wbw: boolean; selMode: SelMode }
export interface WordSelection { k: string; from: number; to: number; pending?: boolean }
export const DEFAULT_READER: ReaderSettings = { nav: 'page', arrows: true, pin: false, selectFirst: false, wbw: false, selMode: 'ayah' };
type Audio = { ref: string | null; status: 'idle' | 'buffering' | 'playing' | 'paused'; speed: number; repeat: boolean; error?: string };

interface Ctx {
  t: QuranStrings; lang: SupportedLanguage;
  view: QuranView; go: (v: QuranView, s?: number, a?: number) => void;
  surah: number; ayah: number;
  surahs: Record<number, Array<[string, string]>>; status: Record<number, LoadStatus>; load: (s: number) => void;
  translation: string; setTranslation: (id: string) => void;
  reciter: string; setReciter: (id: string) => void;
  showTr: boolean; setShowTr: (b: boolean) => void; size: number; setSize: (n: number) => void;
  bookmarks: string[]; toggleBookmark: (k: string) => void;
  notes: Record<string, string>; setNote: (k: string, v: string) => void;
  submissions: QuranSubmission[]; submit: (s: QuranSubmission) => void;
  audio: Audio; play: (ref: string) => void; pause: () => void; next: (dir: 1 | -1) => void; setSpeed: (n: number) => void; toggleRepeat: () => void;
  drawer: boolean; setDrawer: (b: boolean) => void;
  meta: Record<number, SurahMeta>; allStatus: LoadStatus | 'idle'; loadAll: () => void; all: any | null;
  page: number; setPage: (n: number) => void; mode: ReadMode; setMode: (m: ReadMode) => void;
  labels: Record<string, BookmarkLabel>; setLabel: (k: string, l: BookmarkLabel) => void;
  pageMarks: number[]; togglePageMark: (p: number) => void;
  sheet: string | null; openSheet: (k: string | null) => void; share: string | null; openShare: (k: string | null) => void;
  ayahText: (k: string) => [string, string] | undefined; dataUrl?: string;
  tr: TranslationOption; trText: (k: string, bundled?: string) => string | undefined;
  rs: ReaderSettings; setRs: (p: Partial<ReaderSettings>) => void;
  sel: WordSelection | null; setSel: (s: WordSelection | null) => void;
  seed: string; searchFor: (text: string) => void;
}
export const QCtx = React.createContext<Ctx | null>(null);
export const useQ = () => React.useContext(QCtx)!;

const SEED_SUBMISSIONS: QuranSubmission[] = [
  { id: 's1', kind: 'explanation', ref: '1:5', title: 'Why “You alone” comes first', status: 'awaiting', when: 'Today' },
  { id: 's2', kind: 'podcast', ref: '1:1–7', title: 'Reflections on Al-Fatihah (12 min)', status: 'awaiting', when: 'Yesterday', length: '12:04' },
  { id: 's3', kind: 'explanation', ref: '112:1', title: 'Tawhid in Surah Al-Ikhlas', status: 'changes', when: '3 days ago' },
  { id: 's4', kind: 'explanation', ref: '94:6', title: 'Ease after hardship', status: 'published', when: 'Last week' },
];

export interface QuranProviderProps {
  language?: SupportedLanguage; initialView?: QuranView; initialSurah?: number; initialAyah?: number;
  dataUrl?: string; initialTranslation?: string; children?: React.ReactNode;
  initialPage?: number; initialMode?: ReadMode; initialSheet?: string | null; initialShare?: string | null;
  initialReader?: Partial<ReaderSettings>; initialSel?: WordSelection | null;
}
export const QuranProvider: React.FC<QuranProviderProps> = ({
  language = 'en', initialView = 'home', initialSurah = 1, initialAyah = 5, dataUrl, initialTranslation = 'saheeh', children,
  initialPage = 1, initialMode = 'mushaf', initialSheet = null, initialShare = null, initialReader, initialSel = null,
}) => {
  const [rs, setRsRaw] = React.useState<ReaderSettings>({ ...DEFAULT_READER, ...initialReader });
  const [sel, setSel] = React.useState<WordSelection | null>(initialSel);
  const [seed, setSeed] = React.useState('');
  const [view, setView] = React.useState<QuranView>(initialView);
  const [surah, setSurah] = React.useState(initialSurah);
  const [ayah, setAyah] = React.useState(initialAyah);
  const [surahs, setSurahs] = React.useState<Record<number, Array<[string, string]>>>(() => {
    const o: Record<number, Array<[string, string]>> = {}; Object.entries(EMBEDDED_SURAHS).forEach(([k, v]) => { o[+k] = v; }); return o;
  });
  const [status, setStatus] = React.useState<Record<number, LoadStatus>>({});
  const [meta, setMeta] = React.useState<Record<number, SurahMeta>>(() => {
    const o: Record<number, SurahMeta> = {}; Object.entries(EMBEDDED_META).forEach(([k, v]) => { o[+k] = v; }); return o;
  });
  const full = React.useRef<any>(null);
  const [all, setAll] = React.useState<any | null>(null);
  const [allStatus, setAllStatus] = React.useState<LoadStatus | 'idle'>('idle');
  const absorb = (j: any) => {
    full.current = j; setAll(j);
    const m: Record<number, SurahMeta> = {}; j.surahs.forEach((x: any) => { m[x.id] = { pg: x.pg, jz: x.jz, sj: x.sj }; });
    setMeta(mm => ({ ...m, ...mm }));
  };
  const loadAll = React.useCallback(() => {
    if (full.current) { setAllStatus('ready'); return; }
    if (!dataUrl) { setAllStatus('loading'); setTimeout(() => setAllStatus('missing'), 700); return; }
    setAllStatus('loading');
    fetch(dataUrl).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(j => { absorb(j); setAllStatus('ready'); }).catch(() => setTimeout(() => setAllStatus('error'), 400));
  }, [dataUrl]);
  const load = React.useCallback((s: number) => {
    if (surahs[s]) { setStatus(st => ({ ...st, [s]: 'ready' })); return; }
    setStatus(st => ({ ...st, [s]: 'loading' }));
    const finish = () => {
      const found = full.current?.surahs?.find((x: any) => x.id === s);
      if (found) { setSurahs(ss => ({ ...ss, [s]: found.v })); setMeta(mm => ({ ...mm, [s]: { pg: found.pg, jz: found.jz, sj: found.sj } })); setStatus(st => ({ ...st, [s]: 'ready' })); }
      else setStatus(st => ({ ...st, [s]: dataUrl ? 'error' : 'missing' }));
    };
    if (!dataUrl) { setTimeout(finish, 900); return; }
    if (full.current) { setTimeout(finish, 350); return; }
    fetch(dataUrl).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(j => { absorb(j); setTimeout(finish, 250); })
      .catch(() => setTimeout(() => setStatus(st => ({ ...st, [s]: 'error' })), 400));
  }, [surahs, dataUrl]);
  const [translation, setTranslation] = React.useState(initialTranslation);
  const [reciter, setReciterRaw] = React.useState('alafasy');
  const [showTr, setShowTr] = React.useState(true);
  const [size, setSize] = React.useState(30);
  const [bookmarks, setBookmarks] = React.useState<string[]>(['1:5', '112:1', '94:6']);
  const [notes, setNotes] = React.useState<Record<string, string>>({
    '1:5': 'Say it slowly in every rak‘ah — I am asking for help to worship Him.',
    '94:6': 'Read this on the hard days. The ease is promised “with” the hardship.',
  });
  const [submissions, setSubmissions] = React.useState<QuranSubmission[]>(SEED_SUBMISSIONS);
  const [audio, setAudio] = React.useState<Audio>({ ref: null, status: 'idle', speed: 1, repeat: false });
  const [drawer, setDrawer] = React.useState(false);
  const [page, setPage] = React.useState(initialPage);
  const [mode, setMode] = React.useState<ReadMode>(initialMode);
  const [labels, setLabels] = React.useState<Record<string, BookmarkLabel>>({ '1:5': 'reflect', '112:1': 'memorise', '94:6': 'reflect' });
  const [pageMarks, setPageMarks] = React.useState<number[]>([1, 604]);
  const [sheet, setSheet] = React.useState<string | null>(initialSheet);
  const [share, setShare] = React.useState<string | null>(initialShare);
  const media = React.useRef<HTMLAudioElement | null>(null);
  const generation = React.useRef(0);
  const abort = React.useRef<AbortController | null>(null);
  const latest = React.useRef(audio); latest.current = audio;
  const selectedReciter = React.useRef(reciter); selectedReciter.current = reciter;
  const len = (s: number) => SURAH_INDEX[s - 1]?.n ?? 0;
  const reciterIds: Record<string, number> = { alafasy: 1, sudais: 2, abdulbasit: 4, ghamdi: 6 };
  const play = async (ref: string, voice = selectedReciter.current) => {
    const run = ++generation.current;
    abort.current?.abort(); media.current?.pause();
    const controller = new AbortController(); abort.current = controller;
    setAudio(a => ({ ...a, ref, status: 'buffering', error: undefined }));
    try {
      const [s, n] = ref.split(':').map(Number);
      if (!Number.isInteger(n) || n < 1 || n > len(s)) throw new Error('reference');
      const response = await fetch(`/api/quran-audio/${s}/${n}`, { signal: controller.signal });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      const recording = data.reciters?.find((r: any) => r.id === reciterIds[voice]);
      if (!recording?.audio_url) throw new Error('recording');
      if (run !== generation.current) return;
      const el = media.current!;
      if (el.src !== recording.audio_url) { el.src = recording.audio_url; el.load(); }
      else if (el.ended) el.currentTime = 0;
      el.playbackRate = latest.current.speed;
      await el.play();
      if (run === generation.current) setAudio(a => ({ ...a, status: 'playing' }));
    } catch {
      if (run === generation.current) setAudio(a => ({ ...a, status: 'paused', error: language === 'ta' ? 'ஒலியை இயக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.' : language === 'si' ? 'හඬ වාදනය කළ නොහැක. නැවත උත්සාහ කරන්න.' : 'Unable to play recitation. Press Play to retry.' }));
    }
  };
  const pause = () => {
    ++generation.current; abort.current?.abort(); media.current?.pause();
    setAudio(a => ({ ...a, status: 'paused' }));
  };
  const next = (dir: 1 | -1) => {
    const current = latest.current;
    if (!current.ref) return;
    const [s, n] = current.ref.split(':').map(Number);
    const ref = key(s, Math.min(Math.max(1, n + dir), len(s)));
    if (current.status === 'playing' || current.status === 'buffering') void play(ref);
    else { pause(); setAudio(a => ({ ...a, ref, error: undefined })); }
  };
  React.useEffect(() => {
    const el = new window.Audio(); media.current = el;
    el.onended = () => {
      const current = latest.current;
      if (!current.ref) return;
      const [s, n] = current.ref.split(':').map(Number);
      if (current.repeat) { el.currentTime = 0; void play(current.ref); }
      else if (n < len(s)) void play(key(s, n + 1));
      else setAudio(a => ({ ...a, status: 'idle' }));
    };
    el.onerror = () => setAudio(a => ({ ...a, status: 'paused', error: 'Audio unavailable. Retry playback.' }));
    return () => { ++generation.current; abort.current?.abort(); el.onended = null; el.onerror = null; el.pause(); el.removeAttribute('src'); el.load(); };
  }, []);
  React.useEffect(() => { if (media.current) media.current.playbackRate = audio.speed; }, [audio.speed]);

  const value: Ctx = {
    t: QURAN_STRINGS[language], lang: language, view,
    go: (v, s, a) => {
      setView(v); if (s) setSurah(s); if (a) setAyah(a); setDrawer(false); setSheet(null); setSel(null);
      if (v === 'book' && s) { const m = meta[s]; const sp = SURAH_INDEX[s - 1].p; setPage(m ? m.pg[(a ?? 1) - 1] : sp); }
    },
    surah, ayah, surahs, status, load, translation, setTranslation,
    reciter, setReciter: id => { pause(); setReciterRaw(id); setAudio(a => ({ ...a, error: undefined })); },
    showTr, setShowTr, size, setSize,
    bookmarks, toggleBookmark: k => setBookmarks(b => b.includes(k) ? b.filter(x => x !== k) : [...b, k]),
    notes, setNote: (k, v) => setNotes(n => { const c = { ...n }; if (v.trim()) c[k] = v; else delete c[k]; return c; }),
    submissions, submit: s => setSubmissions(x => [s, ...x]),
    audio, play, pause, next, setSpeed: n => setAudio(a => ({ ...a, speed: n })), toggleRepeat: () => setAudio(a => ({ ...a, repeat: !a.repeat })),
    drawer, setDrawer,
    meta, allStatus, loadAll, all, page, setPage: n => setPage(Math.min(604, Math.max(1, n))), mode, setMode,
    labels, setLabel: (k, l) => { setLabels(x => ({ ...x, [k]: l })); setBookmarks(b => b.includes(k) ? b : [...b, k]); },
    pageMarks, togglePageMark: p => setPageMarks(x => x.includes(p) ? x.filter(y => y !== p) : [...x, p].sort((a, b) => a - b)),
    sheet, openSheet: setSheet, share, openShare: setShare,
    ayahText: k => { const [a, b] = k.split(':').map(Number); return surahs[a]?.[b - 1] ?? (full.current?.surahs?.[a - 1]?.v?.[b - 1]) ?? EMBEDDED_AYAT[k]; },
    dataUrl,
    tr: QURAN_TRANSLATIONS.find(x => x.id === translation) ?? QURAN_TRANSLATIONS[0],
    trText: (k, bundled) => trTextFor(translation, k, bundled),
    rs, setRs: p => setRsRaw(r => ({ ...r, ...p })), sel, setSel,
    seed, searchFor: text => { setSeed(text); setSel(null); setSheet(null); setView('search'); },
  };
  return <QCtx.Provider value={value}>{children}{audio.error && <div role="alert" className="fixed bottom-36 inset-x-4 z-50 mx-auto max-w-lg rounded-xl border border-amber-500 bg-slate-900 p-3 text-sm text-white">{audio.error}</div>}</QCtx.Provider>;
};

/* ---------- shared bits ---------- */
export const Card: React.FC<{ className?: string; children?: React.ReactNode; gold?: boolean }> = ({ className, children, gold }) => (
  <section className={cx('bg-[var(--surface-panel)] border rounded-3xl shadow-xl', gold ? 'islamic-gold-border' : 'border-slate-800', className)}>{children}</section>
);
export const SectionTitle: React.FC<{ icon: React.FC<any>; children: React.ReactNode; right?: React.ReactNode }> = ({ icon: I, children, right }) => (
  <div className="flex items-center justify-between gap-3">
    <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-white"><I className="w-5 h-5 text-amber-400" />{children}</h3>
    {right}
  </div>
);
export const StarNumber: React.FC<{ n: number; size?: number }> = ({ n, size = 40 }) => (
  <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
    <RubElHizb size={size} />
    <span className="absolute text-[11px] font-mono font-bold text-amber-300">{n}</span>
  </span>
);
export const AyahMark: React.FC<{ n: number }> = ({ n }) => (
  <span className="font-arabic text-amber-400 mx-1" aria-label={`ayah ${n}`}>{'۝'}{toArabicDigits(n)}</span>
);

/* ---------- ReviewStatusChip ---------- */
export const ReviewStatusChip: React.FC<{ status: ReviewStatus; t?: QuranStrings }> = ({ status, t = QURAN_STRINGS.en }) => {
  const m = {
    awaiting: { icon: Hourglass, label: t.awaitingReview, cls: 'bg-amber-950/70 text-amber-300 border-amber-600/50' },
    published: { icon: ShieldCheck, label: t.published, cls: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50' },
    changes: { icon: Info, label: t.changesRequested, cls: 'bg-rose-950/70 text-rose-300 border-rose-600/50' },
  }[status];
  return <span className={cx('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-xl border whitespace-nowrap', m.cls)}><m.icon className="w-3.5 h-3.5" />{m.label}</span>;
};

/* ---------- QuranState — loading, unavailable and error, with retry ---------- */
export interface QuranStateProps {
  kind: 'loading' | 'unavailable' | 'error'; title?: string; body?: string; lines?: number;
  onRetry?: () => void; sourceUrl?: string; action?: { label: string; onClick: () => void }; compact?: boolean; t?: QuranStrings;
}
export const QuranState: React.FC<QuranStateProps> = ({ kind, title, body, lines = 3, onRetry, sourceUrl, action, compact, t = QURAN_STRINGS.en }) => {
  if (kind === 'loading') return (
    <div className={cx('rounded-3xl border border-slate-800 bg-[var(--surface-panel)]', compact ? 'p-4' : 'p-6')} role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span className="animate-spin" style={{ animationDuration: '3s' }}><RubElHizb size={20} /></span>{title ?? t.loading}
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-6 rounded-lg bg-slate-800/80 animate-pulse ml-auto" style={{ width: `${88 - i * 9}%` }} />
            <div className="h-3 rounded bg-slate-800/60 animate-pulse" style={{ width: `${70 - i * 7}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
  const I = kind === 'error' ? WifiOff : CloudOff;
  return (
    <div className={cx('rounded-3xl border bg-[var(--surface-panel)] text-center', compact ? 'p-4' : 'p-7',
      kind === 'error' ? 'border-rose-600/40' : 'islamic-gold-border')} role="alert">
      <div className={cx('mx-auto w-12 h-12 rounded-2xl flex items-center justify-center border', kind === 'error' ? 'bg-rose-950/60 border-rose-600/40 text-rose-300' : 'bg-amber-950/50 border-amber-600/40 text-amber-300')}>
        <I className="w-6 h-6" />
      </div>
      <div className="mt-3 font-display text-lg font-semibold text-white">{title ?? (kind === 'error' ? t.errorTitle : t.unavailableTitle)}</div>
      {(body ?? (kind === 'error' ? t.errorBody : '')) && <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">{body ?? t.errorBody}</p>}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[var(--on-gold)] text-xs font-bold cursor-pointer"><RefreshCw className="w-3.5 h-3.5" />{t.retry}</button>}
        {action && <button type="button" onClick={action.onClick} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer">{action.label}</button>}
        {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-700 text-amber-300 text-xs font-semibold"><ExternalLink className="w-3.5 h-3.5" />{t.openOriginal}</a>}
      </div>
    </div>
  );
};

/* ---------- selectors ---------- */
const Select: React.FC<{ icon: React.FC<any>; label: string; value: string; children: React.ReactNode; onChange: (v: string) => void }> = ({ icon: I, label, value, children, onChange }) => (
  <label className="relative flex items-center gap-2 min-w-0 rounded-xl border border-slate-700 bg-[var(--surface-inset)] pl-3 pr-8 py-2">
    <I className="w-4 h-4 text-amber-400 shrink-0" />
    <span className="sr-only">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
      className="appearance-none bg-transparent text-xs font-semibold text-slate-200 focus:outline-none min-w-0 w-full cursor-pointer">{children}</select>
    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 pointer-events-none" />
  </label>
);
export const TranslationSelect: React.FC = () => {
  const q = useQ();
  return (
    <Select icon={Languages} label={q.t.translation} value={q.translation} onChange={q.setTranslation}>
      {(['English', 'Tamil', 'Sinhala'] as const).map(lang => (
        <optgroup key={lang} label={lang}>
          {QURAN_TRANSLATIONS.filter(x => x.language === lang).map(x => <option key={x.id} value={x.id}>{x.name}{x.provider === 'quran-ai' ? ' · Quran.ai' : x.available ? '' : ' — ' + q.t.notInApp}</option>)}
        </optgroup>
      ))}
    </Select>
  );
};
export const ReciterSelect: React.FC = () => {
  const q = useQ();
  return (
    <Select icon={Headphones} label={q.t.reciter} value={q.reciter} onChange={q.setReciter}>
      {QURAN_RECITERS.map(r => <option key={r.id} value={r.id}>{r.name} · {r.style}</option>)}
    </Select>
  );
};

/* ---------- SourcesDrawer ---------- */
export const SourcesDrawer: React.FC<{ inline?: boolean }> = ({ inline }) => {
  const q = useQ();
  React.useEffect(() => { if (!q.drawer || inline) return; const f = (e: KeyboardEvent) => { if (e.key === 'Escape') q.setDrawer(false); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [q.drawer]);
  if (!q.drawer && !inline) return null;
  const tr = q.tr;
  const rc = QURAN_RECITERS.find(x => x.id === q.reciter)!;
  const k = `${q.surah}:${q.ayah}`;
  const ref = `https://quran.com/${q.surah}/${q.ayah}`;
  const B = BOOK_STRINGS[q.lang];
  type Row = { group: string; name: string; by: string; badge: 'app' | 'qai' | 'none'; url: string; icon: React.FC<any> };
  const rows: Row[] = [
    { group: q.t.text, name: 'Uthmani Hafs — King Fahd Complex print', by: `QuranEnc · ${B.verified}`, badge: 'app', url: `https://quran.com/${q.surah}`, icon: BookOpen },
    { group: q.t.translation, name: tr.name, by: tr.by, badge: tr.provider === 'none' ? 'none' : tr.provider === 'quran-ai' ? 'qai' : 'app', url: trCitationFor(q.translation, k), icon: Languages },
    { group: q.t.wordByWord, name: 'Word morphology', by: 'Quran.ai · quran.com', badge: 'qai', url: ref, icon: Languages },
    { group: q.t.recitation, name: rc.name, by: rc.style, badge: 'app', url: ref, icon: Headphones },
    ...QURAN_AI_TAFSIR.map(x => ({ group: q.t.tafsir, name: x.name, by: `${x.by} · ${x.note}`, badge: 'qai' as const, url: x.qcId ? `https://quran.com/${k}/tafsirs/${x.qcId}` : ref, icon: FileText })),
  ];
  const body = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-display text-xl font-semibold text-white flex items-center gap-2"><RubElHizb size={18} />{q.t.sources}</div>
        {!inline && <button type="button" onClick={() => q.setDrawer(false)} aria-label={q.t.close} className="p-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer"><X className="w-4 h-4" /></button>}
      </div>
      <p className="text-xs text-slate-400 leading-5">{q.t.readingStays}</p>
      {rows.map((r, i) => (
        <div key={i} className="rounded-2xl border border-slate-800 bg-[var(--surface-inset)] p-3 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><r.icon className="w-3.5 h-3.5" />{r.group}</div>
          <div className="text-sm font-semibold text-white">{r.name}</div>
          <div className="text-[11px] text-slate-400">{r.by}</div>
          <div className="flex items-center justify-between gap-2">
            <span className={cx('text-[10px] font-semibold px-2 py-0.5 rounded-lg border', r.badge === 'app' ? 'text-emerald-300 bg-emerald-950/60 border-emerald-600/40' : r.badge === 'qai' ? 'text-amber-300 bg-amber-950/50 border-amber-600/40' : 'text-slate-400 bg-slate-900 border-slate-700')}>
              {r.badge === 'app' ? q.t.bundled : r.badge === 'qai' ? B.viaQuranAi : q.t.notInApp}
            </span>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">{q.t.openOriginal}<ExternalLink className="w-3 h-3" /></a>
          </div>
        </div>
      ))}
    </div>
  );
  if (inline) return <Card className="p-5">{body}</Card>;
  return (
    <div className="fixed inset-0 z-[60] flex md:justify-end items-end md:items-stretch">
      <button type="button" aria-label={q.t.close} className="absolute inset-0 bg-black/50 cursor-default" onClick={() => q.setDrawer(false)} />
      <aside className="relative w-full md:w-[380px] max-h-[85%] md:max-h-none overflow-y-auto bg-[var(--surface-panel)] border-t md:border-t-0 md:border-l islamic-gold-border rounded-t-3xl md:rounded-none p-5 shadow-2xl">
        <div className="md:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700" />{body}
      </aside>
    </div>
  );
};

/* ---------- QuranAudioPlayer ---------- */
export const QuranAudioPlayer: React.FC = () => {
  const q = useQ();
  const rc = QURAN_RECITERS.find(x => x.id === q.reciter)!;
  const a = q.audio;
  const fallback = `${q.surah}:${q.view === 'study' ? q.ayah : 1}`;
  const [s, n] = (a.ref ?? fallback).split(':').map(Number);
  const meta = SURAH_INDEX[s - 1];
  const pct = meta ? Math.round((n / meta.n) * 100) : 0;
  const playing = a.status === 'playing' || a.status === 'buffering';
  return (
    <div className="sticky bottom-[76px] md:bottom-4 z-30">
      <div className="rounded-3xl border islamic-gold-border bg-[var(--surface-header)]/95 backdrop-blur-xl shadow-2xl px-3 md:px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center shrink-0" style={{ background: 'var(--brand-green)' }}><RubElHizb size={24} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{rc.name}</div>
            <div className="text-[11px] text-slate-400 truncate">
              {a.status === 'buffering' ? q.t.buffering : `${meta?.tr ?? ''} · ${s}:${n}`}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous ayah" onClick={() => q.next(-1)} className="p-2 rounded-xl text-slate-300 hover:text-white cursor-pointer"><SkipBack className="w-4 h-4" /></button>
            <button type="button" aria-label={playing ? q.t.pause : q.t.play} onClick={() => playing ? q.pause() : q.play(a.ref ?? fallback)}
              className="w-11 h-11 rounded-2xl flex items-center justify-center cursor-pointer shadow-lg" style={{ background: 'linear-gradient(135deg, var(--color-amber-400), var(--color-amber-600))' }}>
              {a.status === 'buffering' ? <span className="animate-spin"><RubElHizb size={18} /></span> : playing ? <Pause className="w-5 h-5 text-[var(--on-gold)]" /> : <Play className="w-5 h-5 text-[var(--on-gold)] ml-0.5" />}
            </button>
            <button type="button" aria-label="Next ayah" onClick={() => q.next(1)} className="p-2 rounded-xl text-slate-300 hover:text-white cursor-pointer"><SkipForward className="w-4 h-4" /></button>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <button type="button" aria-pressed={a.repeat} title={q.t.repeat} onClick={q.toggleRepeat}
              className={cx('p-2 rounded-xl border cursor-pointer', a.repeat ? 'text-amber-300 border-amber-600/50 bg-amber-950/50' : 'text-slate-400 border-slate-700')}><Repeat1 className="w-4 h-4" /></button>
            <button type="button" title={q.t.speed} onClick={() => q.setSpeed(a.speed === 1 ? 1.25 : a.speed === 1.25 ? 0.75 : 1)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-700 text-[11px] font-mono font-bold text-slate-300 cursor-pointer">{a.speed}×</button>
          </div>
        </div>
        <div className="mt-2 h-1 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${a.ref ? pct : 0}%` }} /></div>
        <div className="mt-1 text-[9px] text-slate-500 text-center">{q.t.audioPreview}</div>
      </div>
    </div>
  );
};

/* ---------- QuranSubNav ---------- */
export const QuranSubNav: React.FC = () => {
  const q = useQ();
  const B = BOOK_STRINGS[q.lang];
  const items: Array<[QuranView, string, React.FC<any>]> = [['home', q.t.home, House], ['book', B.read, BookOpen], ['search', B.search, Search], ['study', q.t.study, GraduationCap], ['collection', q.t.myQuran, LibraryBig]];
  return (
    <nav className="flex gap-1 overflow-x-auto bg-[var(--surface-panel)] border islamic-gold-border rounded-2xl p-1" style={{ scrollbarWidth: 'none' }}>
      {items.map(([id, label, I]) => (
        <button key={id} type="button" onClick={() => q.go(id)} aria-current={(q.view === id || (id === 'book' && q.view === 'reader')) ? 'page' : undefined}
          className={cx('flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap',
            (q.view === id || (id === 'book' && q.view === 'reader')) ? 'bg-amber-500 text-[var(--on-gold)] shadow-md' : 'text-slate-300 hover:text-white')}>
          <I className="w-4 h-4" />{label}
        </button>
      ))}
    </nav>
  );
};

/* ---------- AyahCard ---------- */
export interface AyahCardProps { s: number; a: number; ar: string; en?: string; compact?: boolean; }
export const AyahCard: React.FC<AyahCardProps> = ({ s, a, ar, en, compact }) => {
  const q = useQ();
  const k = key(s, a);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(q.notes[k] ?? '');
  const [copied, setCopied] = React.useState(false);
  const marked = q.bookmarks.includes(k);
  const active = q.audio.ref === k && q.audio.status !== 'idle';
  const tr = q.tr; const te = q.trText(k, en);
  return (
    <article className={cx('rounded-3xl border p-4 md:p-6 space-y-4 transition-colors', active ? 'border-amber-500/70 bg-amber-950/25 shadow-xl' : 'border-slate-800 bg-[var(--surface-panel)]')}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[11px] font-mono text-amber-300"><StarNumber n={a} size={30} />{s}:{a}</span>
        <div className="flex items-center gap-1">
          <IconBtn label={active && q.audio.status === 'playing' ? q.t.pause : q.t.play} onClick={() => active && q.audio.status === 'playing' ? q.pause() : q.play(k)}>
            {active && q.audio.status === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </IconBtn>
          <IconBtn label={marked ? q.t.bookmarked : q.t.bookmark} on={marked} onClick={() => q.toggleBookmark(k)}>
            {marked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </IconBtn>
          <IconBtn label={q.t.note} on={!!q.notes[k]} onClick={() => { setDraft(q.notes[k] ?? ''); setEditing(e => !e); }}><NotebookPen className="w-4 h-4" /></IconBtn>
          {!compact && <IconBtn label={q.t.studyAyah} onClick={() => q.go('study', s, a)}><GraduationCap className="w-4 h-4" /></IconBtn>}
          {!compact && <IconBtn label={q.t.copy} on={copied} onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</IconBtn>}
        </div>
      </div>
      <p className="font-arabic text-right text-amber-100 leading-[2.1]" dir="rtl" lang="ar" style={{ fontSize: compact ? 24 : q.size }}>
        {ar}<AyahMark n={a} />
      </p>
      {q.showTr && te && (
        <p className="text-[15px] leading-relaxed text-slate-300">{te}<span className="block mt-1 text-[10px] font-mono text-slate-500">{tr.name}</span></p>
      )}
      {q.notes[k] && !editing && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-600/30 bg-amber-950/30 px-3 py-2 text-[13px] text-slate-200">
          <NotebookPen className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /><span>{q.notes[k]}</span>
        </div>
      )}
      {editing && (
        <div className="space-y-2">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} placeholder={q.t.notePlaceholder} autoFocus
            className="w-full rounded-2xl border border-slate-700 bg-[var(--surface-inset)] px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300 cursor-pointer">{q.t.cancel}</button>
            <button type="button" onClick={() => { q.setNote(k, draft); setEditing(false); }} className="px-3 py-1.5 rounded-xl bg-amber-500 text-[var(--on-gold)] text-xs font-bold cursor-pointer">{q.t.saveNote}</button>
          </div>
        </div>
      )}
    </article>
  );
};
export const IconBtn: React.FC<{ label: string; on?: boolean; onClick?: () => void; children: React.ReactNode }> = ({ label, on, onClick, children }) => (
  <button type="button" title={label} aria-label={label} aria-pressed={on} onClick={onClick}
    className={cx('p-2 rounded-xl border cursor-pointer transition-colors', on ? 'text-amber-300 border-amber-600/50 bg-amber-950/50' : 'text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600')}>{children}</button>
);

/* ---------- QuranHome ---------- */
export const QuranHome: React.FC = () => {
  const q = useQ();
  const [query, setQuery] = React.useState('');
  const [tab, setTab] = React.useState<'surah' | 'juz'>('surah');
  const list = SURAH_INDEX.filter(s => !query || String(s.id) === query.trim() || s.tr.toLowerCase().includes(query.toLowerCase()) || s.m.toLowerCase().includes(query.toLowerCase()) || s.ar.includes(query));
  const daily = EMBEDDED_AYAT['94:6'];
  const last = EMBEDDED_SURAHS['1'][4];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 md:gap-6 items-start">
      <div className="space-y-5 order-2 lg:order-1">
        <Card className="p-4 md:p-6 space-y-4">
          <SectionTitle icon={BookOpen} right={<span className="text-[11px] font-mono text-slate-400">114 · 6236</span>}>{q.t.surahs}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <label className="flex-1 min-w-[200px] flex items-center gap-2 rounded-xl border border-slate-700 bg-[var(--surface-inset)] px-3 py-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={q.t.searchSurah} className="bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none w-full" />
            </label>
            <div className="flex gap-1 bg-slate-900/70 border border-slate-700 rounded-xl p-1">
              {(['surah', 'juz'] as const).map(x => (
                <button key={x} type="button" onClick={() => setTab(x)} className={cx('px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer', tab === x ? 'bg-amber-500 text-[var(--on-gold)]' : 'text-slate-300')}>{x === 'surah' ? q.t.surahs : q.t.juz}</button>
              ))}
            </div>
          </div>
          {tab === 'surah' ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {list.slice(0, 40).map(s => (
                <button key={s.id} type="button" onClick={() => q.go('book', s.id, 1)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-[var(--surface-inset)] hover:border-amber-500/50 px-3 py-2.5 text-left cursor-pointer transition-colors">
                  <StarNumber n={s.id} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">{s.tr}</div>
                    <div className="text-[11px] text-slate-400 truncate">{s.m} · {s.t === 'meccan' ? q.t.meccan : q.t.medinan} · {s.n} {q.t.ayat} · p.{s.p}</div>
                  </div>
                  <div className="font-arabic text-xl text-amber-200" dir="rtl" lang="ar">{s.ar}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {Array.from({ length: 30 }).map((_, i) => (
                <button key={i} type="button" onClick={() => { q.go('book'); q.setPage(JUZ_START_PAGES[i]); }} className="rounded-2xl border border-slate-800 bg-[var(--surface-inset)] hover:border-amber-500/50 py-3 text-center cursor-pointer">
                  <div className="font-arabic text-lg text-amber-200">{toArabicDigits(i + 1)}</div>
                  <div className="text-[10px] text-slate-400">{q.t.juz} {i + 1}</div>
                </button>
              ))}
            </div>
          )}
          {tab === 'surah' && list.length > 40 && <div className="text-center text-[11px] text-slate-500">+ {list.length - 40} {q.t.surahs.toLowerCase()}</div>}
        </Card>
      </div>
      <div className="space-y-5 order-1 lg:order-2">
        <PatternSurface strong className="p-5 md:p-6 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />{q.t.continueReading}</div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="font-display text-2xl font-semibold text-white">Al-Fatihah</div>
              <div className="text-xs text-slate-400">{q.t.lastRead} · 1:5</div>
            </div>
            <div className="font-arabic text-3xl text-amber-200" dir="rtl">الفاتحة</div>
          </div>
          <p className="font-arabic text-[22px] leading-[42px] text-amber-100 text-right" dir="rtl" lang="ar">{last[0]}</p>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full w-[71%] bg-amber-400 rounded-full" /></div>
          <div className="flex gap-2">
            <button type="button" onClick={() => q.go('book', 1, 5)} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--on-gold)] cursor-pointer shadow-lg" style={{ background: 'linear-gradient(135deg, var(--color-amber-400), var(--color-amber-600))' }}><BookOpen className="w-4 h-4" />{q.t.resume}</button>
            <button type="button" onClick={() => q.play('1:5')} aria-label={q.t.play} className="px-3 rounded-xl border border-slate-700 text-amber-300 cursor-pointer"><Play className="w-4 h-4" /></button>
          </div>
        </PatternSurface>
        <Card gold className="p-5 space-y-3">
          <div className="flex items-center justify-between"><div className="text-[10px] font-mono uppercase tracking-wider text-amber-300">{q.t.dailyAyah}</div><div className="text-[11px] font-mono text-amber-300">94:6</div></div>
          <p className="font-arabic text-[28px] leading-[48px] text-amber-200 text-center" dir="rtl" lang="ar">{daily[0]}</p>
          <p className="font-serif italic text-[16px] text-slate-300 text-center">“{trTextFor('saheeh', '94:6', daily[1])}”</p>
          <div className="text-center text-[10px] font-mono text-slate-500">Saheeh International</div>
          <div className="flex justify-center gap-2">
            <IconBtn label={q.t.play} onClick={() => q.play('94:6')}><Play className="w-4 h-4" /></IconBtn>
            <IconBtn label={q.t.bookmark} on={q.bookmarks.includes('94:6')} onClick={() => q.toggleBookmark('94:6')}><Bookmark className="w-4 h-4" /></IconBtn>
            <IconBtn label={q.t.studyAyah} onClick={() => q.go('study', 94, 6)}><GraduationCap className="w-4 h-4" /></IconBtn>
          </div>
        </Card>
        <Card className="p-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5" />{q.t.khatm}</div>
          <div className="flex items-end justify-between"><div className="font-mono text-3xl font-bold text-amber-300">12%</div><div className="text-xs text-slate-400">{q.t.juz} 4 / 30</div></div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full w-[12%] bg-emerald-500 rounded-full" /></div>
          <div className="text-xs text-slate-400"><span className="font-mono text-emerald-300">9</span> {q.t.daysReading}</div>
        </Card>
      </div>
    </div>
  );
};

/* ---------- QuranReader ---------- */
export interface QuranReaderProps { forceState?: 'loading' | 'error' | 'missing'; }
export const QuranReader: React.FC<QuranReaderProps> = ({ forceState }) => {
  const q = useQ();
  const meta = SURAH_INDEX[q.surah - 1];
  const verses = q.surahs[q.surah];
  const st: LoadStatus = forceState ?? (verses ? 'ready' : q.status[q.surah] ?? 'loading');
  const [limit, setLimit] = React.useState(30);
  React.useEffect(() => { if (!verses && !forceState) q.load(q.surah); setLimit(30); }, [q.surah]);
  React.useEffect(() => {
    if (q.audio.ref && q.audio.status !== 'idle') document.querySelector(`[data-ayah="${q.audio.ref}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [q.audio.ref]);
  const tr = q.tr; const B = BOOK_STRINGS[q.lang];
  const trGap = tr.provider === 'quran-ai' && !!verses && verses.some((_, i) => !q.trText(key(q.surah, i + 1)));
  const showBismillah = q.surah !== 1 && q.surah !== 9;
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Card gold className="overflow-hidden">
        <div className="relative px-5 md:px-8 pt-6 pb-5 text-center" style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, var(--gold-glow), transparent 70%), var(--pattern-star)' }}>
          <button type="button" onClick={() => q.go('home')} className="absolute left-4 top-4 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"><ChevronLeft className="w-4 h-4" />{q.t.surahs}</button>
          <button type="button" onClick={() => q.setDrawer(true)} className="absolute right-4 top-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-600/40 bg-amber-950/40 text-amber-300 text-xs font-semibold cursor-pointer"><FileText className="w-3.5 h-3.5" />{q.t.sources}</button>
          <div className="mt-6 mx-auto inline-flex items-center gap-3 px-6 py-2 rounded-2xl border islamic-gold-border bg-[var(--surface-panel)]">
            <RubElHizb size={18} /><span className="font-arabic text-[32px] leading-[52px] text-amber-200" dir="rtl" lang="ar">سُورَةُ {meta.ar}</span><RubElHizb size={18} />
          </div>
          <div className="mt-2 font-display text-2xl font-semibold text-white">{meta.tr}</div>
          <div className="text-xs text-slate-400">{meta.m} · {meta.t === 'meccan' ? q.t.meccan : q.t.medinan} · {meta.n} {q.t.ayat}</div>
        </div>
        <div className="border-t border-slate-800 p-3 md:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] gap-2">
          <TranslationSelect />
          <ReciterSelect />
          <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-[var(--surface-inset)] px-1.5" title={q.t.fontSize}>
            <button type="button" aria-label="Smaller Arabic" onClick={() => q.setSize(Math.max(22, q.size - 2))} className="p-1.5 text-slate-300 cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
            <span className="font-arabic text-amber-200 text-lg px-1">أ</span>
            <button type="button" aria-label="Larger Arabic" onClick={() => q.setSize(Math.min(44, q.size + 2))} className="p-1.5 text-slate-300 cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
          </div>
          <button type="button" onClick={() => q.setShowTr(!q.showTr)} aria-pressed={q.showTr}
            className={cx('inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer', q.showTr ? 'border-amber-600/50 text-amber-300 bg-amber-950/40' : 'border-slate-700 text-slate-400')}>
            {q.showTr ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}{q.t.showTranslation}
          </button>
        </div>
      </Card>

      {q.showTr && trGap && st === 'ready' && (
        <QuranState kind="unavailable" compact t={q.t} title={`${tr.name} — ${B.liveTitle}`} body={B.liveBody}
          sourceUrl={tr.source} action={{ label: q.t.switchToSaheeh, onClick: () => q.setTranslation('saheeh') }} />
      )}
      {q.showTr && !tr.available && st === 'ready' && (
        <QuranState kind="unavailable" compact t={q.t} title={`${tr.name} — ${q.t.translationUnavailable}`} body={q.t.translationUnavailableBody}
          sourceUrl={tr.source} action={{ label: q.t.switchToSaheeh, onClick: () => q.setTranslation('saheeh') }} />
      )}

      {st === 'loading' && <QuranState kind="loading" t={q.t} title={q.t.loadingSurah} lines={4} />}
      {st === 'missing' && <QuranState kind="unavailable" t={q.t} title={q.t.surahUnavailable} body={q.t.errorBody} onRetry={() => q.load(q.surah)} sourceUrl={`https://quran.com/${q.surah}`} />}
      {st === 'error' && <QuranState kind="error" t={q.t} onRetry={() => q.load(q.surah)} sourceUrl={`https://quran.com/${q.surah}`} />}

      {st === 'ready' && verses && (
        <div className="space-y-4">
          {showBismillah && <div className="text-center font-arabic text-[30px] leading-[56px] text-amber-300" dir="rtl" lang="ar">{EMBEDDED_SURAHS['1'][0][0]}</div>}
          {verses.slice(0, limit).map(([ar, en], i) => (
            <div key={i} data-ayah={key(q.surah, i + 1)} className="scroll-mt-24"><AyahCard s={q.surah} a={i + 1} ar={ar} en={en} /></div>
          ))}
          {verses.length > limit && (
            <button type="button" onClick={() => setLimit(l => l + 30)} className="w-full py-3 rounded-2xl border border-slate-700 text-sm font-semibold text-amber-300 cursor-pointer">
              {verses.length - limit} {q.t.ayat} ·  +30
            </button>
          )}
          <StarDivider />
        </div>
      )}
    </div>
  );
};

export const SubmissionRow: React.FC<{ s: QuranSubmission }> = ({ s }) => {
  const q = useQ();
  return (
    <div className="rounded-2xl border border-slate-800 bg-[var(--surface-inset)] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {s.kind === 'podcast' ? <Podcast className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" /> : <FileText className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{s.title}</div>
            <div className="text-[11px] text-slate-400">{s.ref} · {q.t.submitted} {s.when}{s.length ? ` · ${s.length}` : ''}</div>
          </div>
        </div>
      </div>
      <ReviewStatusChip status={s.status} t={q.t} />
    </div>
  );
};

/* ---------- bookmark labels ---------- */
const LABEL_STYLE: Record<BookmarkLabel, string> = {
  read: 'bg-cyan-950/70 text-cyan-300 border-cyan-600/50', memorise: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50', reflect: 'bg-amber-950/70 text-amber-300 border-amber-600/50',
};
const LabelChip: React.FC<{ l: BookmarkLabel }> = ({ l }) => {
  const q = useQ(); const B = BOOK_STRINGS[q.lang];
  const name = l === 'read' ? B.lblRead : l === 'memorise' ? B.lblMemorise : B.lblReflect;
  return <span className={cx('px-2 py-0.5 rounded-lg border text-[10px] font-semibold font-sans', LABEL_STYLE[l])}>{name}</span>;
};
const BookmarkFilters: React.FC<{ value: BookmarkLabel | null; onChange: (l: BookmarkLabel | null) => void }> = ({ value, onChange }) => {
  const q = useQ(); const B = BOOK_STRINGS[q.lang];
  const opts: Array<[BookmarkLabel | null, string]> = [[null, B.all], ['read', B.lblRead], ['memorise', B.lblMemorise], ['reflect', B.lblReflect]];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(([id, name]) => (
        <button key={name} type="button" onClick={() => onChange(id)} aria-pressed={value === id}
          className={cx('px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer', value === id ? (id ? LABEL_STYLE[id] : 'bg-amber-500 text-[var(--on-gold)] border-amber-500') : 'border-slate-700 text-slate-300')}>{name}</button>
      ))}
    </div>
  );
};

/* ---------- MyQuranCollection ---------- */
export const MyQuranCollection: React.FC<{ initialTab?: 'bookmarks' | 'notes' | 'submissions' | 'progress' }> = ({ initialTab = 'bookmarks' }) => {
  const q = useQ();
  const [tab, setTab] = React.useState(initialTab);
  const [lbl, setLbl] = React.useState<BookmarkLabel | null>(null);
  const ayahText = (k: string): [string, string] | undefined => {
    const [s, a] = k.split(':').map(Number);
    return q.surahs[s]?.[a - 1] ?? EMBEDDED_AYAT[k];
  };
  const tabs: Array<[typeof tab, string, React.FC<any>, number | null]> = [
    ['bookmarks', q.t.bookmarks, Bookmark, q.bookmarks.length], ['notes', q.t.notes, NotebookPen, Object.keys(q.notes).length],
    ['submissions', q.t.submissions, Upload, q.submissions.length], ['progress', q.t.progress, CalendarCheck, null],
  ];
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex gap-1 overflow-x-auto bg-[var(--surface-panel)] border border-slate-800 rounded-2xl p-1" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(([id, label, I, n]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={cx('flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap', tab === id ? 'bg-amber-500 text-[var(--on-gold)]' : 'text-slate-300')}>
            <I className="w-3.5 h-3.5" />{label}{n !== null && <span className="font-mono opacity-75">{n}</span>}
          </button>
        ))}
      </div>
      {tab === 'bookmarks' && <BookmarkFilters value={lbl} onChange={setLbl} />}
      {tab === 'bookmarks' && q.pageMarks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {q.pageMarks.map(p => (
            <button key={p} type="button" onClick={() => { q.go('book'); q.setPage(p); }} className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border islamic-gold-border bg-[var(--surface-panel)] text-xs font-semibold text-amber-300 cursor-pointer">
              <BookmarkCheck className="w-4 h-4" />{BOOK_STRINGS[q.lang].page} {p}
            </button>
          ))}
        </div>
      )}
      {tab === 'bookmarks' && (q.bookmarks.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {q.bookmarks.filter(k => !lbl || q.labels[k] === lbl).map(k => {
            const v = ayahText(k); const [s, a] = k.split(':').map(Number); const meta = SURAH_INDEX[s - 1];
            return (
              <Card key={k} className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-amber-300 flex items-center gap-2">{meta.tr} · {k}{q.labels[k] && <LabelChip l={q.labels[k]} />}</span>
                  <div className="flex gap-1">
                    <IconBtn label={q.t.share} onClick={() => q.openShare(k)}><Share2 className="w-4 h-4" /></IconBtn>
                    <IconBtn label={q.t.open} onClick={() => q.go('book', s, a)}><BookOpen className="w-4 h-4" /></IconBtn>
                    <IconBtn label={q.t.studyAyah} onClick={() => q.go('study', s, a)}><GraduationCap className="w-4 h-4" /></IconBtn>
                    <IconBtn label={q.t.bookmarked} on onClick={() => q.toggleBookmark(k)}><BookmarkCheck className="w-4 h-4" /></IconBtn>
                  </div>
                </div>
                {v ? <>
                  <p className="font-arabic text-[24px] leading-[44px] text-amber-100 text-right" dir="rtl" lang="ar">{v[0]}<AyahMark n={a} /></p>
                  <p className="text-sm text-slate-300">{v[1]}</p>
                </> : <QuranState kind="loading" compact t={q.t} lines={1} />}
              </Card>
            );
          })}
        </div>
      ) : <QuranState kind="unavailable" t={q.t} title={q.t.empty} body="" />)}
      {tab === 'notes' && (Object.keys(q.notes).length ? (
        <div className="space-y-3">
          {Object.entries(q.notes).map(([k, v]) => {
            const [s, a] = k.split(':').map(Number);
            return (
              <Card key={k} className="p-5 flex items-start gap-4">
                <StarNumber n={a} size={36} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-[11px] font-mono text-amber-300">{SURAH_INDEX[s - 1].tr} · {k}</div>
                  <p className="text-[15px] text-slate-200 whitespace-pre-line">{v}</p>
                </div>
                <IconBtn label={q.t.open} onClick={() => q.go('study', s, a)}><GraduationCap className="w-4 h-4" /></IconBtn>
              </Card>
            );
          })}
        </div>
      ) : <QuranState kind="unavailable" t={q.t} title={q.t.empty} body="" />)}
      {tab === 'submissions' && (
        <Card className="p-5 space-y-3">
          <p className="text-xs text-slate-400 flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />{q.t.reviewNotice}</p>
          <div className="grid md:grid-cols-2 gap-3">{q.submissions.map(s => <SubmissionRow key={s.id} s={s} />)}</div>
        </Card>
      )}
      {tab === 'progress' && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-5 space-y-2 md:col-span-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">{q.t.khatm}</div>
            <div className="font-mono text-4xl font-bold text-amber-300">12%</div>
            <div className="grid grid-cols-10 gap-1.5 pt-2">
              {Array.from({ length: 30 }).map((_, i) => <div key={i} className={cx('h-7 rounded-lg flex items-center justify-center text-[10px] font-mono', i < 3 ? 'bg-emerald-600 text-white' : i === 3 ? 'bg-amber-500 text-[var(--on-gold)]' : 'bg-slate-800 text-slate-500')}>{i + 1}</div>)}
            </div>
          </Card>
          <Card className="p-5 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300">{q.t.lastRead}</div>
            <div className="font-display text-xl text-white">Al-Fatihah · 1:5</div>
            <div className="text-xs text-slate-400"><span className="font-mono text-emerald-300">9</span> {q.t.daysReading}</div>
            <button type="button" onClick={() => q.go('book', 1, 5)} className="mt-2 w-full px-3 py-2 rounded-xl bg-amber-500 text-[var(--on-gold)] text-xs font-bold cursor-pointer">{q.t.resume}</button>
          </Card>
        </div>
      )}
    </div>
  );
};

/* ---------- QuranStatesGallery — every state side by side (design reference) ---------- */
export const QuranStatesGallery: React.FC<{ language?: SupportedLanguage }> = ({ language = 'en' }) => {
  const t = QURAN_STRINGS[language];
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <QuranState kind="loading" t={t} title={t.loadingSurah} lines={2} />
      <QuranState kind="unavailable" t={t} title={`Abdul Hameed Baqavi — ${t.translationUnavailable}`} body={t.translationUnavailableBody} sourceUrl="https://quran.com" action={{ label: t.switchToSaheeh, onClick: () => {} }} />
      <QuranState kind="error" t={t} onRetry={() => {}} sourceUrl="https://quran.com/18" />
      <div className="rounded-3xl border border-slate-800 bg-[var(--surface-panel)] p-5 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Review status</div>
        <div className="flex flex-wrap gap-2"><ReviewStatusChip status="awaiting" t={t} /><ReviewStatusChip status="published" t={t} /><ReviewStatusChip status="changes" t={t} /></div>
      </div>
    </div>
  );
};

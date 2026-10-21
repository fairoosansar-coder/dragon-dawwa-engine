// Quran e-book — a premium Mushaf reader for Dragon Dawwa.
// Real Madani pages (604) and juz from quran-meta (King Fahd Complex data); text from quran-json (QuranEnc / Saheeh International).
// Easy to read (page spread, three reading modes), listen (play page / from any ayah, page follows audio),
// see the meaning (tap an ayah), bookmark (page ribbon + labelled ayah bookmarks), search and filter (Arabic or English,
// surah / juz / revelation / bookmarked / notes / sajdah), and share (text, link, image card, Community).
import React from 'react';
import {
  ChevronLeft, ChevronRight, Play, Pause, Search, Bookmark, BookmarkCheck, NotebookPen, Share2, GraduationCap, Copy, Check,
  X, Type, Link2, Image as ImageIcon, Users, SlidersHorizontal, BookOpen, Headphones, Languages, Filter,
} from 'lucide-react';
import { RubElHizb } from './ornaments';
import { SURAH_INDEX, JUZ_START_PAGES, EMBEDDED_SURAHS, EMBEDDED_META } from './quranData';
import { BOOK_STRINGS, BookStrings } from './quranBookI18n';
import {
  useQ, QuranState, AyahMark, toArabicDigits, QuranReader, TranslationSelect, ReciterSelect,
  QURAN_TRANSLATIONS, QURAN_RECITERS, ReadMode, BookmarkLabel,
} from './quran';
import { WordText, SelectBar, WordStrip, ReaderSettingsPanel, useStepAyah } from './quranStudy';

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');
const useB = (): BookStrings => BOOK_STRINGS[useQ().lang];
const useWide = () => {
  const q = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  const [w, setW] = React.useState(q());
  React.useEffect(() => { const m = window.matchMedia('(min-width: 1024px)'); const f = () => setW(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return w;
};
const LABELS: Array<[BookmarkLabel, keyof BookStrings, string]> = [
  ['read', 'lblRead', 'bg-cyan-950/70 text-cyan-300 border-cyan-600/50'],
  ['memorise', 'lblMemorise', 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'],
  ['reflect', 'lblReflect', 'bg-amber-950/70 text-amber-300 border-amber-600/50'],
];

/* surahs that can appear on a page, from each surah's first page */
const surahsOnPage = (p: number) => SURAH_INDEX.filter((s, i) => s.p <= p && (i === 113 || SURAH_INDEX[i + 1].p >= p)).map(s => s.id);
export const juzOfPage = (p: number) => { let j = 1; JUZ_START_PAGES.forEach((sp, i) => { if (sp <= p) j = i + 1; }); return j; };

/* ---------- normalisation for search ---------- */
export const normaliseArabic = (t: string) => t
  .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
  .replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
const normaliseLatin = (t: string) => t.toLowerCase().replace(/[\[\]"“”'’.,;:!?()-]/g, ' ').replace(/\s+/g, ' ');
const isArabic = (t: string) => /[؀-ۿ]/.test(t);

/* ---------- PageRibbon ---------- */
const PageRibbon: React.FC<{ on: boolean; onClick: () => void; label: string }> = ({ on, onClick, label }) => (
  <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} title={label}
    className="absolute -top-1 right-6 z-10 cursor-pointer transition-transform hover:translate-y-0.5">
    <svg width="26" height="44" viewBox="0 0 26 44" aria-hidden="true">
      <path d="M1 0h24v42l-12-9-12 9z" style={{ fill: on ? 'var(--color-amber-500)' : 'transparent', stroke: 'var(--gold-leaf)' }} strokeWidth="1.5" />
      {on && <path d="M13 9l2 4.2 4.6.6-3.4 3.1.9 4.6L13 19.3 8.9 21.5l.9-4.6-3.4-3.1 4.6-.6z" fill="var(--on-gold)" />}
    </svg>
  </button>
);

/* ---------- SurahBand — the ornamented surah opening inside a page ---------- */
const SurahBand: React.FC<{ s: number }> = ({ s }) => {
  const m = SURAH_INDEX[s - 1];
  return (
    <div className="my-3">
      <div className="relative mx-auto flex items-center justify-between gap-3 rounded-2xl border islamic-gold-border px-4 py-1.5" style={{ backgroundImage: 'var(--pattern-star-strong)' }}>
        <span className="text-[10px] font-mono text-amber-300">{m.n} {/* ayat */}</span>
        <span className="font-arabic text-[26px] leading-[44px] text-amber-200" dir="rtl" lang="ar">سُورَةُ {m.ar}</span>
        <span className="text-[10px] font-mono text-amber-300">{toArabicDigits(s)}</span>
      </div>
      {s !== 1 && s !== 9 && <div className="text-center font-arabic text-[26px] leading-[48px] text-amber-300 mt-1" dir="rtl" lang="ar">{EMBEDDED_SURAHS['1'][0][0]}</div>}
    </div>
  );
};

/* ---------- one Mushaf page ---------- */
interface PageAyah { s: number; a: number; ar: string; en: string; sj: boolean }
const usePage = (p: number): { status: 'ready' | 'loading' | 'missing' | 'error'; ayat: PageAyah[] } => {
  const q = useQ();
  const cands = surahsOnPage(p);
  React.useEffect(() => { cands.forEach(s => { if (!q.surahs[s] || !q.meta[s]) q.load(s); }); }, [p]);
  const ayat: PageAyah[] = [];
  let status: 'ready' | 'loading' | 'missing' | 'error' = 'ready';
  for (const s of cands) {
    const v = q.surahs[s], m = q.meta[s];
    if (!v || !m) { const st = q.status[s]; status = st === 'missing' ? 'missing' : st === 'error' ? 'error' : 'loading'; break; }
    m.pg.forEach((pg, i) => { if (pg === p) ayat.push({ s, a: i + 1, ar: v[i][0], en: v[i][1], sj: m.sj.includes(i + 1) }); });
  }
  return { status, ayat };
};

const MushafPage: React.FC<{ p: number; side: 'right' | 'left' | 'single' }> = ({ p, side }) => {
  const q = useQ(); const b = useB();
  const { status, ayat } = usePage(p);
  const tr = q.tr;
  const first = ayat[0];
  const groups: PageAyah[][] = [];
  ayat.forEach(x => { const g = groups[groups.length - 1]; if (g && g[0].s === x.s) g.push(x); else groups.push([x]); });
  const playing = q.audio.status !== 'idle' ? q.audio.ref : null;
  const AyahSpan: React.FC<{ x: PageAyah; children: React.ReactNode }> = ({ x, children }) => {
    const k = `${x.s}:${x.a}`;
    return (
      <span role="button" tabIndex={0} data-ayah={k} onClick={() => { if (q.rs.selMode === 'ayah') { q.setSel(null); q.openSheet(k); } }} onKeyDown={e => { if (e.key === 'Enter' && q.rs.selMode === 'ayah') q.openSheet(k); }}
        className={cx('cursor-pointer rounded-lg transition-colors box-decoration-clone px-0.5',
          playing === k ? 'bg-amber-500/25 text-amber-50' : q.sheet === k ? 'bg-emerald-500/20' : 'hover:bg-amber-500/10',
          q.bookmarks.includes(k) && 'underline decoration-amber-500/50 decoration-dotted underline-offset-[10px]')}>
        {children}
      </span>
    );
  };
  return (
    <article className={cx('relative rounded-[28px] p-1.5 shadow-2xl min-w-0', side === 'right' ? 'lg:rounded-l-md' : side === 'left' ? 'lg:rounded-r-md' : '')}
      style={{ background: 'var(--surface-panel)', border: '1px solid var(--gold-border)' }} aria-label={`${b.page} ${p}`}>
      <div className={cx('relative h-full rounded-[22px] px-5 md:px-8 pt-9 pb-14 flex flex-col', side === 'right' ? 'lg:rounded-l-sm' : side === 'left' ? 'lg:rounded-r-sm' : '')}
        style={{ border: '1px solid var(--gold-border)', minHeight: side === 'single' ? 560 : 820 }}>
        <PageRibbon on={q.pageMarks.includes(p)} onClick={() => q.togglePageMark(p)} label={q.pageMarks.includes(p) ? b.pageBookmarked : b.bookmarkPage} />
        <header className="absolute top-3 left-6 right-16 grid grid-cols-3 items-center text-[11px] text-slate-400">
          <span className="font-mono">{b.juzLabel} {juzOfPage(p)}</span>
          {first ? <span className="text-center font-arabic text-[15px] text-amber-300" dir="rtl">{SURAH_INDEX[first.s - 1].ar}</span> : <span />}
          <span />
        </header>
        {status !== 'ready' ? (
          <div className="flex-1 flex items-center">
            <div className="w-full">
              {status === 'loading' && <QuranState kind="loading" compact t={q.t} title={q.t.loadingSurah} lines={4} />}
              {status === 'missing' && <QuranState kind="unavailable" compact t={q.t} title={q.t.surahUnavailable} body={q.t.errorBody} onRetry={() => surahsOnPage(p).forEach(q.load)} sourceUrl={`https://quran.com/page/${p}`} />}
              {status === 'error' && <QuranState kind="error" compact t={q.t} onRetry={() => surahsOnPage(p).forEach(q.load)} sourceUrl={`https://quran.com/page/${p}`} />}
            </div>
          </div>
        ) : q.mode === 'mushaf' ? (
          <div className="flex-1">
            {groups.map((g, gi) => (
              <div key={gi}>
                {g[0].a === 1 && <SurahBand s={g[0].s} />}
                <p className="font-arabic text-amber-100" dir="rtl" lang="ar" style={{ fontSize: q.size, lineHeight: q.rs.wbw ? 1.7 : 2.15, textAlign: 'justify', textAlignLast: 'center' }}>
                  {g.map(x => (
                    <AyahSpan key={x.a} x={x}>{q.rs.selMode === 'ayah' && !q.rs.wbw ? x.ar : <WordText k={`${x.s}:${x.a}`} text={x.ar} gloss={q.rs.wbw} />}{x.sj && <span className="text-amber-400 mx-0.5" title={b.sajdahAyah}>۩</span>}<AyahMark n={x.a} /> </AyahSpan>
                  ))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 space-y-4">
            {groups.map((g, gi) => (
              <div key={gi} className="space-y-4">
                {g[0].a === 1 && <SurahBand s={g[0].s} />}
                {g.map(x => (
                  <div key={x.a} className={cx('rounded-2xl px-3 py-2 cursor-pointer transition-colors', playing === `${x.s}:${x.a}` ? 'bg-amber-500/15' : 'hover:bg-amber-500/5')}
                    onClick={() => q.openSheet(`${x.s}:${x.a}`)} data-ayah={`${x.s}:${x.a}`}>
                    {q.mode === 'meaning' && (
                      <p className="font-arabic text-right text-amber-100" dir="rtl" lang="ar" style={{ fontSize: Math.round(q.size * 0.85), lineHeight: 2 }}>
                        {x.ar}{x.sj && <span className="text-amber-400 mx-0.5">۩</span>}<AyahMark n={x.a} />
                      </p>
                    )}
                    {q.trText(`${x.s}:${x.a}`, x.en)
                      ? <p className="text-[15px] leading-relaxed text-slate-300"><span className="font-mono text-[11px] text-amber-300 mr-2">{x.s}:{x.a}</span>{q.trText(`${x.s}:${x.a}`, x.en)}</p>
                      : gi === 0 && x === g[0] && <p className="text-xs text-slate-400">{tr.name} — {tr.provider === 'quran-ai' ? BOOK_STRINGS[q.lang].liveTitle : q.t.translationUnavailable}</p>}
                  </div>
                ))}
              </div>
            ))}
            {ayat.some(x => q.trText(`${x.s}:${x.a}`, x.en)) && <div className="text-[10px] font-mono text-slate-500 text-center">{tr.name}{tr.provider !== 'none' && ' · Quran.ai'}</div>}
          </div>
        )}
        <footer className="absolute bottom-3 inset-x-0 flex justify-center">
          <span className="relative inline-flex items-center justify-center w-12 h-12">
            <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" className="absolute inset-0">
              <g fill="var(--surface-panel)" stroke="var(--gold-leaf)" strokeWidth="1.3">
                <rect x="10" y="10" width="28" height="28" /><rect x="10" y="10" width="28" height="28" transform="rotate(45 24 24)" />
              </g>
            </svg>
            <span className="relative text-[14px] leading-none font-arabic text-amber-300 pt-1">{toArabicDigits(p)}</span>
          </span>
        </footer>
      </div>
    </article>
  );
};

/* ---------- AyahSheet — tap an ayah: meaning, listen, bookmark, note, share, study ---------- */
export const AyahSheet: React.FC = () => {
  const q = useQ(); const b = useB();
  const stepAyah = useStepAyah();
  const [note, setNote] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { if (!q.sheet || q.share) return; const f = (e: KeyboardEvent) => { if (e.key === 'Escape') q.openSheet(null); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [q.sheet, q.share]);
  if (!q.sheet) return null;
  const k = q.sheet; const [s, a] = k.split(':').map(Number);
  const v = q.ayahText(k); const m = SURAH_INDEX[s - 1];
  const tr = q.tr; const te = q.trText(k, v?.[1]);
  const marked = q.bookmarks.includes(k);
  const btn = 'flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-[11px] font-semibold cursor-pointer transition-colors';
  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-stretch lg:justify-end">
      <button type="button" aria-label={q.t.close} className="absolute inset-0 bg-black/40 cursor-default" onClick={() => q.openSheet(null)} />
      <aside className="relative w-full lg:w-[420px] max-h-[88%] lg:max-h-none overflow-y-auto bg-[var(--surface-panel)] border-t lg:border-t-0 lg:border-l islamic-gold-border rounded-t-3xl lg:rounded-none p-5 shadow-2xl space-y-4" role="dialog" aria-label={`${m.tr} ${k}`}>
        <div className="lg:hidden mx-auto h-1 w-10 rounded-full bg-slate-700" />
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-xl font-semibold text-white">{m.tr} <span className="font-mono text-sm text-amber-300">{k}</span></div>
            <div className="text-[11px] text-slate-400">{m.m} · {b.page} {q.meta[s]?.pg[a - 1] ?? '—'} · {b.juzLabel} {q.meta[s]?.jz[a - 1] ?? '—'}</div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => stepAyah(1, k)} aria-label={b.nextAyah} title={b.nextAyah} className="p-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => stepAyah(-1, k)} aria-label={b.prevAyah} title={b.prevAyah} className="p-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
            <button type="button" onClick={() => q.openSheet(null)} aria-label={q.t.close} className="p-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        </div>
        {v ? (
          <div className="rounded-2xl border islamic-gold-border p-4 space-y-3" style={{ backgroundImage: 'var(--pattern-star)' }}>
            <p className="font-arabic text-[28px] leading-[2] text-amber-100 text-right" dir="rtl" lang="ar">{v[0]}<AyahMark n={a} /></p>
            {te
              ? <div><p className="text-[16px] leading-relaxed text-slate-200">{te}</p><div className="mt-1 text-[10px] font-mono text-slate-500">{tr.name}{tr.provider !== 'none' && ' · Quran.ai'}</div></div>
              : <QuranState kind="unavailable" compact t={q.t} title={`${tr.name} — ${tr.provider === 'quran-ai' ? b.liveTitle : q.t.translationUnavailable}`} sourceUrl={tr.source} action={{ label: q.t.switchToSaheeh, onClick: () => q.setTranslation('saheeh') }} />}
          </div>
        ) : <QuranState kind="loading" compact t={q.t} lines={2} />}
        {v && <WordStrip k={k} text={v[0]} />}
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => q.play(k)} className={cx(btn, 'border-amber-500 text-[var(--on-gold)]')} style={{ background: 'linear-gradient(135deg, var(--color-amber-400), var(--color-amber-600))' }}><Play className="w-5 h-5" />{b.playFromHere}</button>
          <button type="button" onClick={() => q.toggleBookmark(k)} className={cx(btn, marked ? 'border-amber-600/60 bg-amber-950/50 text-amber-300' : 'border-slate-700 text-slate-200')}>{marked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}{marked ? q.t.bookmarked : q.t.bookmark}</button>
          <button type="button" onClick={() => q.openShare(k)} className={cx(btn, 'border-slate-700 text-slate-200')}><Share2 className="w-5 h-5" />{q.t.share}</button>
          <button type="button" onClick={() => { setDraft(q.notes[k] ?? ''); setNote(n => !n); }} className={cx(btn, q.notes[k] ? 'border-amber-600/50 text-amber-300' : 'border-slate-700 text-slate-200')}><NotebookPen className="w-5 h-5" />{q.t.note}</button>
          <button type="button" onClick={() => q.go('study', s, a)} className={cx(btn, 'border-slate-700 text-slate-200')}><GraduationCap className="w-5 h-5" />{q.t.studyAyah}</button>
          <button type="button" onClick={() => { try { navigator.clipboard?.writeText(`${v?.[0] ?? ''}\n${v?.[1] ?? ''} (${m.tr} ${k})`); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1300); }} className={cx(btn, 'border-slate-700 text-slate-200')}>{copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}{copied ? b.copied : q.t.copy}</button>
        </div>
        {marked && (
          <div className="flex flex-wrap gap-2">
            {LABELS.map(([id, key, cls]) => (
              <button key={id} type="button" onClick={() => q.setLabel(k, id)} aria-pressed={q.labels[k] === id}
                className={cx('px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer', q.labels[k] === id ? cls : 'border-slate-700 text-slate-400')}>{b[key]}</button>
            ))}
          </div>
        )}
        {note && (
          <div className="space-y-2">
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} placeholder={q.t.notePlaceholder} autoFocus
              className="w-full rounded-2xl border border-slate-700 bg-[var(--surface-inset)] px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60" />
            <button type="button" onClick={() => { q.setNote(k, draft); setNote(false); }} className="w-full px-3 py-2 rounded-xl bg-amber-500 text-[var(--on-gold)] text-xs font-bold cursor-pointer">{q.t.saveNote}</button>
          </div>
        )}
        {q.notes[k] && !note && <div className="flex gap-2 rounded-2xl border border-amber-600/30 bg-amber-950/30 px-3 py-2 text-[13px] text-slate-200"><NotebookPen className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />{q.notes[k]}</div>}
      </aside>
    </div>
  );
};

/* ---------- DisplayMenu ---------- */
const DisplayMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const q = useQ(); const b = useB();
  const modes: Array<[ReadMode, string]> = [['mushaf', b.mushaf], ['meaning', b.withMeaning], ['cards', b.ayahCards]];
  return (
    <div className="absolute bottom-full mb-3 right-0 w-[340px] max-w-[calc(100vw-24px)] max-h-[70vh] overflow-y-auto rounded-3xl border islamic-gold-border bg-[var(--surface-panel)] shadow-2xl p-4 space-y-4 z-40">
      <div className="flex items-center justify-between"><div className="font-display text-lg text-white">{b.display}</div><button type="button" onClick={onClose} aria-label={q.t.close} className="p-1.5 rounded-lg text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button></div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">{b.readingMode}</div>
        <div className="grid grid-cols-3 gap-1 bg-slate-900/70 border border-slate-700 rounded-xl p-1">
          {modes.map(([id, label]) => <button key={id} type="button" onClick={() => q.setMode(id)} className={cx('px-2 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer', q.mode === id ? 'bg-amber-500 text-[var(--on-gold)]' : 'text-slate-300')}>{label}</button>)}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">{q.t.fontSize}</div>
        <div className="flex items-center gap-3">
          <span className="font-arabic text-amber-200 text-base">أ</span>
          <input type="range" min={22} max={44} step={2} value={q.size} onChange={e => q.setSize(+e.target.value)} className="flex-1 accent-amber-500" aria-label={q.t.fontSize} />
          <span className="font-arabic text-amber-200 text-2xl">أ</span>
        </div>
      </div>
      <TranslationSelect />
      <ReciterSelect />
      <div className="border-t border-slate-800 pt-3"><ReaderSettingsPanel /></div>
    </div>
  );
};

/* ---------- BookBar — page, listen, mode, display, search, bookmark ---------- */
const BookBar: React.FC<{ step: number }> = ({ step }) => {
  const q = useQ(); const b = useB();
  const [menu, setMenu] = React.useState(false);
  const playing = q.audio.status === 'playing' || q.audio.status === 'buffering';
  const firstOnPage = () => { const s = surahsOnPage(q.page)[0]; const m = q.meta[s]; const i = m ? m.pg.indexOf(q.page) : 0; return `${s}:${Math.max(0, i) + 1}`; };
  const m0 = SURAH_INDEX[surahsOnPage(q.page)[0] - 1];
  const rc = QURAN_RECITERS.find(x => x.id === q.reciter)!;
  const stepAyah = useStepAyah();
  const turn = (dir: 1 | -1) => q.rs.nav === 'ayah' ? stepAyah(dir, q.sheet ?? firstOnPage()) : q.setPage(q.page + dir * step);
  return (
    <div className="sticky bottom-[76px] md:bottom-4 z-30">
      <div className="relative rounded-3xl border islamic-gold-border bg-[var(--surface-header)]/95 backdrop-blur-xl shadow-2xl px-3 md:px-4 py-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => turn(1)} aria-label={q.rs.nav === 'ayah' ? b.nextAyah : b.nextPage} title={q.rs.nav === 'ayah' ? b.nextAyah : b.nextPage} className="p-2 rounded-xl border border-slate-700 text-slate-200 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[11px] text-slate-400 gap-2">
              <span className="truncate"><span className="text-white font-semibold">{b.page} {q.page}</span> {b.of} 604 · {b.juzLabel} {juzOfPage(q.page)} · {m0?.tr}</span>
              {q.audio.ref && <span className="hidden sm:inline text-amber-300 truncate">{rc.name} · {q.audio.ref}</span>}
            </div>
            <input type="range" min={1} max={604} value={q.page} onChange={e => q.setPage(+e.target.value)} dir="rtl" className="w-full accent-amber-500 h-1.5" aria-label={b.goToPage} />
          </div>
          <button type="button" onClick={() => turn(-1)} aria-label={q.rs.nav === 'ayah' ? b.prevAyah : b.prevPage} title={q.rs.nav === 'ayah' ? b.prevAyah : b.prevPage} className="p-2 rounded-xl border border-slate-700 text-slate-200 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => playing ? q.pause() : q.play(q.audio.ref ?? firstOnPage())} aria-label={playing ? q.t.pause : b.playPage}
            className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-2xl text-xs font-bold text-[var(--on-gold)] cursor-pointer shadow-lg" style={{ background: 'linear-gradient(135deg, var(--color-amber-400), var(--color-amber-600))' }}>
            {q.audio.status === 'buffering' ? <span className="animate-spin"><RubElHizb size={16} /></span> : playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="hidden sm:inline">{playing ? q.t.pause : b.playPage}</span>
          </button>
          <div className="flex-1 flex justify-center">
            <div className="grid grid-cols-3 gap-1 bg-slate-900/70 border border-slate-700 rounded-xl p-1 w-full max-w-[340px]">
              {([['mushaf', b.mushaf, b.mushaf], ['meaning', b.withMeaning, b.meaningOnly], ['cards', b.ayahCards, '1·1']] as Array<[ReadMode, string, string]>).map(([id, label, short]) => (
                <button key={id} type="button" onClick={() => q.setMode(id)} title={label} aria-label={label} className={cx('px-1.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer truncate', q.mode === id ? 'bg-amber-500 text-[var(--on-gold)]' : 'text-slate-300')}>
                  <span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setMenu(v => !v)} aria-label={b.display} aria-expanded={menu} className={cx('p-2 rounded-xl border cursor-pointer', menu ? 'border-amber-600/60 text-amber-300' : 'border-slate-700 text-slate-200')}><Type className="w-4 h-4" /></button>
          <button type="button" onClick={() => q.go('search')} aria-label={b.search} className="p-2 rounded-xl border border-slate-700 text-slate-200 cursor-pointer"><Search className="w-4 h-4" /></button>
          <button type="button" onClick={() => q.togglePageMark(q.page)} aria-pressed={q.pageMarks.includes(q.page)} aria-label={b.bookmarkPage}
            className={cx('p-2 rounded-xl border cursor-pointer', q.pageMarks.includes(q.page) ? 'border-amber-600/60 bg-amber-950/50 text-amber-300' : 'border-slate-700 text-slate-200')}>
            {q.pageMarks.includes(q.page) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>
        </div>
        {menu && <DisplayMenu onClose={() => setMenu(false)} />}
      </div>
    </div>
  );
};

/* ---------- NavTriangle — Quran.ai-style page arrows on the book's edges ---------- */
const NavTriangle: React.FC<{ side: 'left' | 'right'; label: string; onClick: () => void }> = ({ side, label, onClick }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
    className={cx('absolute top-1/2 -translate-y-1/2 z-20 w-9 h-16 md:w-10 md:h-20 flex items-center justify-center rounded-2xl border islamic-gold-border bg-[var(--surface-header)]/80 backdrop-blur text-amber-300 cursor-pointer shadow-xl hover:text-amber-200',
      side === 'left' ? 'left-0 md:-left-5 rounded-l-none md:rounded-l-2xl' : 'right-0 md:-right-5 rounded-r-none md:rounded-r-2xl')}>
    <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><path d={side === 'left' ? 'M12 1L2 9l10 8z' : 'M2 1l10 8-10 8z'} fill="currentColor" /></svg>
  </button>
);

/* ---------- QuranBook ---------- */
export const QuranBook: React.FC = () => {
  const q = useQ(); const b = useB();
  const wide = useWide();
  const spreadStart = wide ? (q.page % 2 === 1 ? q.page : q.page - 1) : q.page;
  const pages = wide ? [spreadStart, spreadStart + 1].filter(p => p <= 604) : [q.page];
  // keyboard: in a right-to-left book the left arrow turns forward
  React.useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') q.setPage(q.page + (wide ? 2 : 1)); if (e.key === 'ArrowRight') q.setPage(q.page - (wide ? 2 : 1)); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [q.page, wide]);
  // the page follows the recitation
  React.useEffect(() => {
    if (!q.audio.ref || q.audio.status === 'idle') return;
    const [s, a] = q.audio.ref.split(':').map(Number); const pg = q.meta[s]?.pg[a - 1];
    if (pg && !pages.includes(pg)) q.setPage(pg);
  }, [q.audio.ref]);
  // Quran.ai reader settings: keep the selected ayah open, or select the first ayah of each page
  const stepAyah = useStepAyah();
  const firstKey = () => { const s0 = surahsOnPage(spreadStart)[0]; const m = q.meta[s0]; const i = m ? m.pg.indexOf(spreadStart) : 0; return `${s0}:${Math.max(0, i) + 1}`; };
  const prevPage = React.useRef(q.page);
  React.useEffect(() => {
    if (prevPage.current === q.page) return; prevPage.current = q.page;
    if (q.rs.nav === 'ayah') return;
    if (q.rs.selectFirst) { q.setSel(null); q.openSheet(firstKey()); return; }
    if (!q.rs.pin && q.sheet) { const [s0, a0] = q.sheet.split(':').map(Number); const pg = q.meta[s0]?.pg[a0 - 1]; if (pg && !pages.includes(pg)) q.openSheet(null); }
  }, [q.page]);
  const turn = (dir: 1 | -1) => q.rs.nav === 'ayah' ? stepAyah(dir, q.sheet ?? firstKey()) : q.setPage(q.page + dir * (wide ? 2 : 1));
  // swipe
  const touch = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (q.mode !== 'cards') return;
    const s = surahsOnPage(q.page)[0]; const m = q.meta[s]; const i = m ? m.pg.indexOf(q.page) : 0;
    if (s !== q.surah) q.go('book', s, Math.max(0, i) + 1);
  }, [q.mode, q.page]);
  if (q.mode === 'cards') {
    return (<div className="space-y-5"><QuranReader /><BookBar step={1} /><AyahSheet /></div>);
  }
  return (
    <div className="space-y-4">
      <SelectBar />
      <div className={cx('relative mx-auto', wide ? 'max-w-6xl grid grid-cols-2 gap-0' : 'max-w-2xl')} dir="rtl"
        onTouchStart={e => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={e => { if (touch.current === null) return; const d = e.changedTouches[0].clientX - touch.current; if (Math.abs(d) > 60) q.setPage(q.page + (d > 0 ? 1 : -1)); touch.current = null; }}>
        {pages.map((p, i) => <div key={p} dir="ltr" className="min-w-0"><MushafPage p={p} side={wide ? (i === 0 ? 'right' : 'left') : 'single'} /></div>)}
        {q.rs.arrows && <>
          <NavTriangle side="left" label={q.rs.nav === 'ayah' ? b.nextAyah : b.nextPage} onClick={() => turn(1)} />
          <NavTriangle side="right" label={q.rs.nav === 'ayah' ? b.prevAyah : b.prevPage} onClick={() => turn(-1)} />
        </>}
      </div>
      <p className="text-center text-[11px] text-slate-500">{b.swipeHint}</p>
      <BookBar step={wide ? 2 : 1} />
      <AyahSheet />
    </div>
  );
};

/* ---------- QuranSearch — search and filter the whole Qur'an ---------- */
interface Hit { s: number; a: number; ar: string; en: string; pg: number; jz: number; sj: boolean }
export const QuranSearch: React.FC<{ initialQuery?: string; initialFilters?: Partial<{ surah: number; juz: number; rev: 'all' | 'meccan' | 'medinan'; marked: boolean; notes: boolean; sajdah: boolean }> }> = ({ initialQuery = '', initialFilters = {} }) => {
  const q = useQ(); const b = useB();
  React.useEffect(() => { q.loadAll(); }, []);
  const [query, setQuery] = React.useState(initialQuery || q.seed);
  React.useEffect(() => { if (q.seed) setQuery(q.seed); }, [q.seed]);
  const [surah, setSurah] = React.useState(initialFilters.surah ?? 0);
  const [juz, setJuz] = React.useState(initialFilters.juz ?? 0);
  const [rev, setRev] = React.useState<'all' | 'meccan' | 'medinan'>(initialFilters.rev ?? 'all');
  const [marked, setMarked] = React.useState(!!initialFilters.marked);
  const [notes, setNotes] = React.useState(!!initialFilters.notes);
  const [sajdah, setSajdah] = React.useState(!!initialFilters.sajdah);
  const [limit, setLimit] = React.useState(20);
  const tr = q.tr;
  const source: any[] = q.all?.surahs ?? Object.entries(EMBEDDED_SURAHS).map(([id, v]) => ({ id: +id, v, ...EMBEDDED_META[id] }));
  const ref = query.trim().match(/^(\d{1,3})(?::(\d{1,3}))?$/);
  const hits: Hit[] = React.useMemo(() => {
    const out: Hit[] = [];
    const qq = query.trim(); if (!qq && !surah && !juz && rev === 'all' && !marked && !notes && !sajdah) return out;
    const ar = isArabic(qq); const needle = ar ? normaliseArabic(qq) : normaliseLatin(qq).trim();
    for (const s of source) {
      if (surah && s.id !== surah) continue;
      const meta = SURAH_INDEX[s.id - 1]; if (rev !== 'all' && meta.t !== rev) continue;
      s.v.forEach((v: [string, string], i: number) => {
        const a = i + 1, k = `${s.id}:${a}`;
        if (ref) { if (s.id !== +ref[1] || (ref[2] && a !== +ref[2])) return; }
        if (juz && s.jz?.[i] !== juz) return;
        if (marked && !q.bookmarks.includes(k)) return;
        if (notes && !q.notes[k]) return;
        if (sajdah && !s.sj?.includes(a)) return;
        if (needle && !ref) { if (ar ? !normaliseArabic(v[0]).includes(needle) : !normaliseLatin(v[1]).includes(needle)) return; }
        out.push({ s: s.id, a, ar: v[0], en: v[1], pg: s.pg?.[i], jz: s.jz?.[i], sj: !!s.sj?.includes(a) });
      });
    }
    return out;
  }, [query, surah, juz, rev, marked, notes, sajdah, source, q.bookmarks, q.notes]);
  const hl = (t: string) => {
    const qq = query.trim(); if (!qq || isArabic(qq) || ref) return t;
    const i = t.toLowerCase().indexOf(qq.toLowerCase()); if (i < 0) return t;
    return <>{t.slice(0, i)}<mark className="bg-amber-500/30 text-inherit rounded px-0.5">{t.slice(i, i + qq.length)}</mark>{t.slice(i + qq.length)}</>;
  };
  const chip = (on: boolean) => cx('px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer whitespace-nowrap', on ? 'bg-amber-500 text-[var(--on-gold)] border-amber-500' : 'border-slate-700 text-slate-300');
  const anyFilter = surah || juz || rev !== 'all' || marked || notes || sajdah;
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <section className="rounded-3xl border islamic-gold-border bg-[var(--surface-panel)] p-4 md:p-6 space-y-4 shadow-xl">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-[var(--surface-inset)] px-4 py-3 focus-within:border-amber-500/60">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }} placeholder={b.searchPlaceholder} autoFocus
            className="w-full bg-transparent text-base text-slate-100 placeholder:text-slate-500 focus:outline-none" dir="auto" aria-label={b.search} />
          {query && <button type="button" onClick={() => setQuery('')} aria-label={q.t.close} className="text-slate-400 cursor-pointer"><X className="w-4 h-4" /></button>}
        </label>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">{b.try}:</span>
          {['mercy', 'patience', 'الصبر', '2:255', 'light'].map(x => (
            <button key={x} type="button" onClick={() => setQuery(x)} className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 cursor-pointer" dir="auto"><span className={isArabic(x) ? 'font-arabic text-sm' : ''}>{x}</span></button>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" />{b.filters}</div>
            {anyFilter ? <button type="button" onClick={() => { setSurah(0); setJuz(0); setRev('all'); setMarked(false); setNotes(false); setSajdah(false); }} className="text-[11px] font-semibold text-amber-300 cursor-pointer">{b.clearFilters}</button> : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <select value={surah} onChange={e => setSurah(+e.target.value)} aria-label={b.allSurahs} className="shrink-0 rounded-xl border border-slate-700 bg-[var(--surface-inset)] px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer">
              <option value={0}>{b.allSurahs}</option>{SURAH_INDEX.map(s => <option key={s.id} value={s.id}>{s.id}. {s.tr}</option>)}
            </select>
            <select value={juz} onChange={e => setJuz(+e.target.value)} aria-label={b.allJuz} className="shrink-0 rounded-xl border border-slate-700 bg-[var(--surface-inset)] px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer">
              <option value={0}>{b.allJuz}</option>{Array.from({ length: 30 }).map((_, i) => <option key={i} value={i + 1}>{b.juzLabel} {i + 1}</option>)}
            </select>
            {(['all', 'meccan', 'medinan'] as const).map(r => <button key={r} type="button" onClick={() => setRev(r)} className={chip(rev === r)}>{r === 'all' ? `${b.revelation}: ${b.all}` : r === 'meccan' ? q.t.meccan : q.t.medinan}</button>)}
            <button type="button" onClick={() => setMarked(v => !v)} className={chip(marked)}><Bookmark className="inline w-3 h-3 mr-1" />{b.onlyBookmarked}</button>
            <button type="button" onClick={() => setNotes(v => !v)} className={chip(notes)}><NotebookPen className="inline w-3 h-3 mr-1" />{b.withNotes}</button>
            <button type="button" onClick={() => setSajdah(v => !v)} className={chip(sajdah)}>۩ {b.sajdah}</button>
          </div>
        </div>
        {q.allStatus === 'missing' && <p className="text-[11px] text-slate-400">{b.searchScope}</p>}
      </section>

      {q.allStatus === 'loading' && <QuranState kind="loading" t={q.t} title={b.searchLoading} lines={3} />}
      {q.allStatus === 'error' && <QuranState kind="error" t={q.t} onRetry={q.loadAll} sourceUrl="https://quran.com/search" />}
      {q.allStatus !== 'loading' && q.allStatus !== 'error' && (hits.length > 0 || query || anyFilter) && (
        <div className="space-y-3">
          <div className="text-xs text-slate-400"><span className="font-mono text-amber-300">{hits.length}</span> {b.results}</div>
          {hits.length === 0 && <QuranState kind="unavailable" t={q.t} title={b.noResults} body="" />}
          {hits.slice(0, limit).map(h => {
            const k = `${h.s}:${h.a}`; const m = SURAH_INDEX[h.s - 1];
            return (
              <article key={k} className="rounded-3xl border border-slate-800 bg-[var(--surface-panel)] p-4 md:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-mono font-bold text-amber-300">{k}</span>
                    <span className="text-white font-semibold">{m.tr}</span>
                    <span className="text-slate-500">{b.page} {h.pg} · {b.juzLabel} {h.jz}</span>
                    {h.sj && <span className="px-1.5 py-0.5 rounded-md border border-amber-600/40 text-amber-300">۩ {b.sajdah}</span>}
                    {q.bookmarks.includes(k) && <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => q.go('book', h.s, h.a)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500 text-[var(--on-gold)] text-[11px] font-bold cursor-pointer"><BookOpen className="w-3.5 h-3.5" />{b.openInBook}</button>
                    <button type="button" onClick={() => q.play(k)} aria-label={q.t.play} className="p-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer"><Play className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => q.toggleBookmark(k)} aria-label={q.t.bookmark} className={cx('p-2 rounded-xl border cursor-pointer', q.bookmarks.includes(k) ? 'border-amber-600/50 text-amber-300' : 'border-slate-700 text-slate-300')}><Bookmark className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => q.openShare(k)} aria-label={q.t.share} className="p-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer"><Share2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <p className="font-arabic text-[24px] leading-[2] text-amber-100 text-right" dir="rtl" lang="ar">{h.ar}<AyahMark n={h.a} /></p>
                {q.trText(k, h.en) && <p className="text-[15px] leading-relaxed text-slate-300">{hl(q.trText(k, h.en)!)}</p>}
              </article>
            );
          })}
          {hits.length > limit && <button type="button" onClick={() => setLimit(l => l + 20)} className="w-full py-3 rounded-2xl border border-slate-700 text-sm font-semibold text-amber-300 cursor-pointer">{b.showMore} · {hits.length - limit}</button>}
        </div>
      )}
    </div>
  );
};

/* ---------- ShareAyahSheet — text, link, image card, Community ---------- */
type CardStyle = 'night' | 'mushaf' | 'simple';
const CARD: Record<CardStyle, { bg: string; ar: string; en: string; ref: string; frame: string }> = {
  night: { bg: '#0e5a45', ar: '#f6ebc6', en: '#e4ded0', ref: '#d4ae4a', frame: '#d4ae4a' },
  mushaf: { bg: '#fbf4e0', ar: '#3a2c10', en: '#43392a', ref: '#94711f', frame: '#b08a2e' },
  simple: { bg: '#ffffff', ar: '#111111', en: '#333333', ref: '#666666', frame: '#dddddd' },
};
export const ShareAyahSheet: React.FC = () => {
  const q = useQ(); const b = useB();
  const [style, setStyle] = React.useState<CardStyle>('night');
  const [withTr, setWithTr] = React.useState(true);
  const [withRef, setWithRef] = React.useState(true);
  const [done, setDone] = React.useState<string | null>(null);
  const [img, setImg] = React.useState<string | null>(null);
  React.useEffect(() => { if (!q.share) return; const f = (e: KeyboardEvent) => { if (e.key === 'Escape') { q.openShare(null); setImg(null); } }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [q.share]);
  if (!q.share) return null;
  const k = q.share; const [s, a] = k.split(':').map(Number);
  const v = q.ayahText(k); const m = SURAH_INDEX[s - 1];
  const tr = q.tr; const te = q.trText(k, v?.[1]);
  const c = CARD[style];
  const text = `${v?.[0] ?? ''} ﴿${toArabicDigits(a)}﴾${withTr && te ? `\n\n“${te}” — ${tr.name}` : ''}${withRef ? `\n\nSurah ${m.tr} ${k} · Dragon Dawwa` : ''}`;
  const link = (typeof location !== 'undefined' ? location.origin : '') + `/quran/${s}/${a}`;
  const flash = (x: string) => { setDone(x); setTimeout(() => setDone(null), 1500); };
  const copy = async (t: string, label: string) => { try { await navigator.clipboard.writeText(t); } catch {} flash(label); };
  const makeImage = async () => {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d')!;
    try { await (document as any).fonts?.load('64px "Amiri Quran"'); await (document as any).fonts?.load('italic 40px "Cormorant Garamond"'); } catch {}
    g.fillStyle = c.bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = c.frame; g.lineWidth = 3; g.strokeRect(48, 48, W - 96, H - 96); g.lineWidth = 1.5; g.strokeRect(64, 64, W - 128, H - 128);
    const star = (x: number, y: number, r: number) => { g.save(); g.translate(x, y); g.strokeStyle = c.frame; g.lineWidth = 3; g.strokeRect(-r, -r, 2 * r, 2 * r); g.rotate(Math.PI / 4); g.strokeRect(-r, -r, 2 * r, 2 * r); g.restore(); };
    star(W / 2, 150, 26);
    const wrap = (t: string, font: string, max: number, rtl: boolean) => { g.font = font; g.direction = rtl ? 'rtl' : 'ltr'; const words = t.split(' '); const lines: string[] = []; let line = '';
      for (const w of words) { const test = line ? line + ' ' + w : w; if (g.measureText(test).width > max && line) { lines.push(line); line = w; } else line = test; } if (line) lines.push(line); return lines; };
    g.textAlign = 'center';
    const arLines = wrap(`${v?.[0] ?? ''} ﴿${toArabicDigits(a)}﴾`, '64px "Amiri Quran", serif', W - 220, true);
    const showTr = withTr && !!te && !!v;
    const trLines = showTr ? wrap(`“${te}”`, 'italic 42px "Cormorant Garamond", Georgia, serif', W - 240, false) : [];
    const contentH = arLines.length * 118 + (showTr ? 30 + trLines.length * 58 + 40 : 0);
    let y = Math.max(300, Math.round((H - contentH) / 2) + 60);
    g.fillStyle = c.ar; g.direction = 'rtl'; g.font = '64px "Amiri Quran", serif';
    arLines.forEach(l => { g.fillText(l, W / 2, y); y += 118; });
    if (showTr) {
      y += 30; g.fillStyle = c.en; g.direction = 'ltr'; g.font = 'italic 42px "Cormorant Garamond", Georgia, serif';
      trLines.forEach(l => { g.fillText(l, W / 2, y); y += 58; });
      g.font = '24px ui-monospace, monospace'; g.fillStyle = c.ref; g.fillText(tr.name, W / 2, y + 10);
    }
    g.direction = 'ltr';
    if (withRef) { g.fillStyle = c.ref; g.font = '600 34px "Cormorant Garamond", Georgia, serif'; g.fillText(`Surah ${m.tr} · ${k}`, W / 2, H - 150); }
    g.font = '22px ui-monospace, monospace'; g.fillStyle = c.ref; g.fillText('DRAGON DAWWA', W / 2, H - 100);
    setImg(cv.toDataURL('image/png'));
  };
  const nativeShare = async () => { try { await (navigator as any).share?.({ title: `Surah ${m.tr} ${k}`, text, url: link }); } catch {} };
  const act = 'inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-semibold cursor-pointer';
  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-6">
      <button type="button" aria-label={q.t.close} className="absolute inset-0 bg-black/55 cursor-default" onClick={() => { q.openShare(null); setImg(null); }} />
      <div className="relative w-full md:max-w-3xl max-h-[92%] overflow-y-auto rounded-t-3xl md:rounded-3xl border islamic-gold-border bg-[var(--surface-panel)] shadow-2xl p-5 md:p-6" role="dialog" aria-label={b.shareAyah}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-display text-2xl font-semibold text-white flex items-center gap-2"><Share2 className="w-5 h-5 text-amber-400" />{b.shareAyah} <span className="font-mono text-sm text-amber-300">{k}</span></div>
          <button type="button" onClick={() => { q.openShare(null); setImg(null); }} aria-label={q.t.close} className="p-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid md:grid-cols-[1fr_260px] gap-5">
          <div>
            {img ? (
              <div className="space-y-2"><img src={img} alt={`Surah ${m.tr} ${k}`} className="w-full rounded-2xl border border-slate-700" /><p className="text-[11px] text-emerald-300 text-center">{b.imageReady}</p></div>
            ) : (
              <div className="rounded-2xl p-6 md:p-8 text-center space-y-4 aspect-[4/5] flex flex-col justify-center" style={{ background: c.bg, boxShadow: `inset 0 0 0 3px ${c.bg}, inset 0 0 0 5px ${c.frame}, inset 0 0 0 9px ${c.bg}, inset 0 0 0 10px ${c.frame}`, backgroundImage: style === 'simple' ? undefined : 'var(--pattern-star)' }}>
                <div className="flex justify-center" style={{ color: c.frame }}><RubElHizb size={26} /></div>
                <p className="font-arabic text-[26px] md:text-[30px] leading-[2]" dir="rtl" lang="ar" style={{ color: c.ar }}>{v?.[0]} ﴿{toArabicDigits(a)}﴾</p>
                {withTr && te && v && <p className="font-serif italic text-[17px] leading-7" style={{ color: c.en }}>“{te}”<span className="block not-italic font-mono text-[10px] mt-1" style={{ color: c.ref }}>{tr.name}</span></p>}
                {withRef && <p className="font-display text-base font-semibold" style={{ color: c.ref }}>Surah {m.tr} · {k}</p>}
                <p className="font-mono text-[10px] tracking-[0.2em]" style={{ color: c.ref }}>DRAGON DAWWA</p>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">{b.cardStyle}</div>
              <div className="grid grid-cols-3 gap-2">
                {(['night', 'mushaf', 'simple'] as CardStyle[]).map(x => (
                  <button key={x} type="button" onClick={() => { setStyle(x); setImg(null); }} aria-pressed={style === x}
                    className={cx('h-14 rounded-xl border-2 cursor-pointer', style === x ? 'border-amber-500' : 'border-slate-700')} style={{ background: CARD[x].bg }}>
                    <span className="text-[10px] font-semibold" style={{ color: CARD[x].ref }}>{x === 'night' ? 'Night' : x === 'mushaf' ? 'Mushaf' : b.simple}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-200">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={withTr} onChange={e => { setWithTr(e.target.checked); setImg(null); }} className="accent-amber-500" /><Languages className="w-4 h-4 text-amber-400" />{b.includeTranslation}</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={withRef} onChange={e => { setWithRef(e.target.checked); setImg(null); }} className="accent-amber-500" /><BookOpen className="w-4 h-4 text-amber-400" />{b.includeReference}</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => copy(text, b.copied + ' · ' + b.copyText)} className={cx(act, 'border-slate-700 text-slate-200')}><Copy className="w-4 h-4" />{b.copyText}</button>
              <button type="button" onClick={() => copy(link, b.copied + ' · ' + b.copyLink)} className={cx(act, 'border-slate-700 text-slate-200')}><Link2 className="w-4 h-4" />{b.copyLink}</button>
              <button type="button" onClick={makeImage} className={cx(act, 'border-amber-500 text-[var(--on-gold)]')} style={{ background: 'linear-gradient(135deg, var(--color-amber-400), var(--color-amber-600))' }}><ImageIcon className="w-4 h-4" />{b.saveImage}</button>
              <button type="button" onClick={nativeShare} className={cx(act, 'border-slate-700 text-slate-200')}><Share2 className="w-4 h-4" />{b.shareVia}</button>
              <button type="button" onClick={() => flash(b.sharedToCommunity)} className={cx(act, 'col-span-2 border-emerald-600/50 bg-emerald-950/50 text-emerald-300')}><Users className="w-4 h-4" />{b.shareToCommunity}</button>
            </div>
            {done && <div className="text-center text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5" role="status"><Check className="w-4 h-4" />{done}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

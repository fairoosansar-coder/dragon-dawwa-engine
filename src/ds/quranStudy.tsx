// Word-level study, reader settings and Ayah Study — brought up to the Quran.ai reader standard.
// Select an ayah, a word or a phrase; every word opens its meaning, root, dictionary form and parts.
// Translations, tafsir and morphology are Quran.ai (quran.com) data — see quranGrounded.ts. Nothing here is written from memory.
import React from 'react';
import {
  X, Play, Pause, GraduationCap, Copy, Check, Search, Share2, ChevronLeft, ChevronRight, ExternalLink, ShieldCheck,
  Languages, FileText, MessageCircleQuestion, Podcast, Upload, Mic, NotebookPen, Bookmark, BookmarkCheck, MousePointerClick,
  TextSelect, SquareStack, Settings2,
} from 'lucide-react';
import { RubElHizb, PatternSurface } from './ornaments';
import { SURAH_INDEX, EMBEDDED_AYAT } from './quranData';
import { BOOK_STRINGS, BookStrings } from './quranBookI18n';
import {
  useQ, Card, SectionTitle, IconBtn, SubmissionRow, QuranState, AyahMark, QURAN_TRANSLATIONS, trTextFor, trCitationFor,
  AYAH_QUESTIONS, SelMode,
} from './quran';
import { GROUNDED_WORDS, GroundedWord, QURAN_AI_TAFSIR, groundedTafsir, tafsirCitation, spacedRoot } from './quranGrounded';

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');
const useB = (): BookStrings => BOOK_STRINGS[useQ().lang];
const words = (ar: string) => ar.split(/\s+/).filter(Boolean);
export const wordData = (k: string, pos: number): GroundedWord | undefined => GROUNDED_WORDS[k]?.[pos - 1];

/* ---------- ayah navigation (Quran.ai "turn by ayah") ---------- */
export const useStepAyah = () => {
  const q = useQ();
  return (dir: 1 | -1, from: string) => {
    let [s, a] = from.split(':').map(Number);
    a += dir;
    if (a < 1) { if (s === 1) return; s -= 1; a = SURAH_INDEX[s - 1].n; }
    if (a > SURAH_INDEX[s - 1].n) { if (s === 114) return; s += 1; a = 1; }
    const k = `${s}:${a}`; const pg = q.meta[s]?.pg[a - 1];
    if (pg) q.setPage(pg); else q.load(s);
    q.setSel(null); q.openSheet(k);
  };
};

/* ---------- WordText — an ayah rendered as tappable words ---------- */
export const WordText: React.FC<{ k: string; text: string; gloss?: boolean; size?: number; always?: boolean }> = ({ k, text, gloss, size, always }) => {
  const q = useQ();
  const ws = words(text);
  const mode = always && q.rs.selMode === 'ayah' ? 'word' : q.rs.selMode;
  const tap = (pos: number) => (e: React.MouseEvent | React.KeyboardEvent) => {
    if (mode === 'ayah' && !gloss) return;
    e.stopPropagation();
    if (mode === 'phrase' && q.sel?.pending && q.sel.k === k) {
      const a = Math.min(q.sel.from, pos), b = Math.max(q.sel.from, pos);
      q.setSel({ k, from: a, to: b }); return;
    }
    q.openSheet(null);
    q.setSel({ k, from: pos, to: pos, pending: mode === 'phrase' });
  };
  return (
    <>
      {ws.map((w, i) => {
        const pos = i + 1; const d = wordData(k, pos);
        const on = q.sel?.k === k && pos >= q.sel.from && pos <= q.sel.to;
        const interactive = mode !== 'ayah' || gloss;
        return (
          <React.Fragment key={i}>
            <span role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} data-word={`${k}:${pos}`}
              onClick={interactive ? tap(pos) : undefined} onKeyDown={interactive ? e => { if (e.key === 'Enter') tap(pos)(e); } : undefined}
              className={cx(gloss && d ? 'inline-flex flex-col items-center align-top mx-0.5' : 'inline',
                interactive && 'cursor-pointer rounded-md transition-colors hover:bg-emerald-500/15',
                on && 'bg-emerald-500/25 ring-1 ring-emerald-400/50')}
              style={size ? { fontSize: size } : undefined}>
              <span>{w}</span>
              {gloss && d && <span className="font-sans text-[11px] leading-4 text-slate-400 max-w-[9rem] text-center whitespace-normal pb-1.5 mt-2.5" dir="ltr">{d[1]}</span>}
            </span>{' '}
          </React.Fragment>
        );
      })}
    </>
  );
};

/* ---------- SelectBar — choose what a tap selects ---------- */
export const SelectBar: React.FC = () => {
  const q = useQ(); const b = useB();
  const opts: Array<[SelMode, string, React.FC<any>]> = [['ayah', b.selAyah, SquareStack], ['word', b.selWord, MousePointerClick], ['phrase', b.selPhrase, TextSelect]];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
      <span className="inline-flex items-center gap-1.5"><RubElHizb size={14} />{q.sel?.pending ? <span className="text-emerald-300 font-semibold">{b.tapEnd}</span> : b.tapForMeaning}</span>
      <div className="inline-flex gap-1 bg-slate-900/70 border border-slate-700 rounded-xl p-1" role="radiogroup" aria-label={b.select}>
        {opts.map(([id, label, I]) => (
          <button key={id} type="button" role="radio" aria-checked={q.rs.selMode === id} onClick={() => { q.setRs({ selMode: id }); q.setSel(null); }}
            className={cx('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer', q.rs.selMode === id ? 'bg-emerald-600 text-white' : 'text-slate-300')}>
            <I className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ---------- WordStrip — word-by-word inside the ayah sheet ---------- */
export const WordStrip: React.FC<{ k: string; text: string }> = ({ k, text }) => {
  const q = useQ();
  if (!GROUNDED_WORDS[k]) return null;
  return (
    <div className="flex flex-wrap gap-1.5" dir="rtl">
      {words(text).map((w, i) => {
        const d = wordData(k, i + 1);
        return (
          <button key={i} type="button" onClick={() => { q.openSheet(null); q.setSel({ k, from: i + 1, to: i + 1 }); }}
            className="rounded-xl border border-slate-800 bg-[var(--surface-inset)] hover:border-emerald-500/50 px-2.5 py-1.5 text-center cursor-pointer">
            <span className="block font-arabic text-[20px] leading-[34px] text-amber-200" lang="ar">{w}</span>
            {d && <span className="block mt-1 text-[10px] leading-3 text-slate-400 max-w-[7rem]" dir="ltr">{d[1]}</span>}
          </button>
        );
      })}
    </div>
  );
};

/* ---------- WordSheet — one word or a phrase ---------- */
const Stat: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="rounded-2xl border border-slate-800 bg-[var(--surface-inset)] p-3">
    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</div>
    <div className="mt-1">{children}</div>
  </div>
);
export const WordSheet: React.FC = () => {
  const q = useQ(); const b = useB();
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { if (!q.sel || q.sel.pending) return; const f = (e: KeyboardEvent) => { if (e.key === 'Escape') q.setSel(null); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [q.sel]);
  if (!q.sel || q.sel.pending) return null;
  const { k, from, to } = q.sel; const [s, a] = k.split(':').map(Number);
  const m = SURAH_INDEX[s - 1]; const v = q.ayahText(k);
  const ws = v ? words(v[0]) : [];
  const phrase = to > from;
  const d = wordData(k, from);
  const arabic = ws.slice(from - 1, to).join(' ');
  const move = (dir: 1 | -1) => { const n = from + dir; if (n >= 1 && n <= ws.length) q.setSel({ k, from: n, to: n }); };
  const te = q.trText(k, v?.[1]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-stretch lg:justify-end">
      <button type="button" aria-label={q.t.close} className="absolute inset-0 bg-black/40 cursor-default" onClick={() => q.setSel(null)} />
      <aside className="relative w-full lg:w-[420px] max-h-[88%] lg:max-h-none overflow-y-auto bg-[var(--surface-panel)] border-t lg:border-t-0 lg:border-l islamic-gold-border rounded-t-3xl lg:rounded-none p-5 shadow-2xl space-y-4" role="dialog" aria-label={`${b.wordStudy} ${k}`}>
        <div className="lg:hidden mx-auto h-1 w-10 rounded-full bg-slate-700" />
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">{phrase ? `${b.selPhrase} · ${to - from + 1} ${b.words}` : b.wordStudy}</div>
            <div className="font-display text-xl font-semibold text-white truncate">{m.tr} <span className="font-mono text-sm text-amber-300">{k}{phrase ? ` · ${from}–${to}` : ` · ${from}`}</span></div>
          </div>
          <div className="flex items-center gap-1">
            {!phrase && <>
              <button type="button" onClick={() => move(1)} disabled={from >= ws.length} aria-label={b.nextWord} className="p-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => move(-1)} disabled={from <= 1} aria-label={b.prevWord} className="p-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </>}
            <button type="button" onClick={() => q.setSel(null)} aria-label={q.t.close} className="p-2 rounded-xl border border-slate-700 text-slate-300 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="rounded-2xl border islamic-gold-border p-4 text-center space-y-2" style={{ backgroundImage: 'var(--pattern-star)' }}>
          <div className="font-arabic text-[44px] leading-[2] text-amber-100" dir="rtl" lang="ar">{arabic || '…'}</div>
          {!phrase && d && <>
            <div className="text-[12px] font-mono text-slate-400" title={b.translit}>{d[0]}</div>
            <div className="font-display text-2xl font-semibold text-white">{d[1]}</div>
          </>}
        </div>

        {phrase ? (
          GROUNDED_WORDS[k] ? (
            <div className="space-y-1.5">
              {ws.slice(from - 1, to).map((w, i) => { const x = wordData(k, from + i); return (
                <button key={i} type="button" onClick={() => q.setSel({ k, from: from + i, to: from + i })} className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[var(--surface-inset)] hover:border-emerald-500/50 px-3 py-2 cursor-pointer text-left">
                  <span className="min-w-0"><span className="block text-sm font-semibold text-white">{x?.[1]}</span><span className="block text-[11px] font-mono text-slate-400">{x?.[0]}</span></span>
                  <span className="font-arabic text-2xl text-amber-200" dir="rtl" lang="ar">{w}</span>
                </button>
              ); })}
            </div>
          ) : <QuranState kind="unavailable" compact t={q.t} title={b.wordLive} body="" sourceUrl={`https://quran.com/${s}/${a}`} />
        ) : d ? (
          <div className="grid grid-cols-2 gap-2">
            <Stat label={b.rootLetters}>
              {d[2] ? <>
                <div className="font-arabic text-2xl leading-[2.2] text-amber-200" dir="rtl" lang="ar">{spacedRoot(d[2])}</div>
                <div className="text-[11px] text-slate-400">{b.rootUse}: <span className="font-mono text-amber-300">{d[3]}</span> {b.inAyat} <span className="font-mono text-amber-300">{d[4]}</span> {b.ayatWord}</div>
              </> : <div className="text-xs text-slate-400">{b.noRoot}</div>}
            </Stat>
            <Stat label={b.lemma}>
              <div className="font-arabic text-2xl leading-[2.2] text-amber-200" dir="rtl" lang="ar">{d[5]}</div>
              <div className="text-[11px] text-slate-400">{b.lemmaUse}: <span className="font-mono text-amber-300">{d[6]}</span></div>
            </Stat>
            <div className="col-span-2"><Stat label={b.parts}>
              <div className="flex flex-wrap gap-1.5 justify-end" dir="rtl">
                {d[7].map(([t, part], i) => (
                  <span key={i} className="inline-flex items-center gap-2 rounded-xl border border-emerald-700/40 bg-emerald-950/40 px-2.5 py-1">
                    <span className="font-arabic text-xl leading-[2] text-amber-200" lang="ar">{t}</span>
                    <span className="text-[10px] text-emerald-300" dir="ltr">{part}</span>
                  </span>
                ))}
              </div>
            </Stat></div>
            <div className="col-span-2"><Stat label={b.grammar}><p className="text-[13px] leading-5 text-slate-300">{d[8]}</p></Stat></div>
          </div>
        ) : <QuranState kind="unavailable" compact t={q.t} title={b.wordLive} body="" sourceUrl={`https://quran.com/${s}/${a}`} />}

        {te && <div className="rounded-2xl border border-slate-800 p-3"><p className="text-[14px] leading-6 text-slate-300">{te}</p><div className="mt-1 text-[10px] font-mono text-slate-500">{q.tr.name} · {k}</div></div>}

        <div className="grid grid-cols-4 gap-2">
          {[
            { I: Play, label: b.listen, on: () => q.play(k) },
            { I: GraduationCap, label: q.t.studyAyah, on: () => q.go('study', s, a) },
            { I: Search, label: phrase ? b.search : b.searchWord, on: () => q.searchFor(arabic) },
            { I: copied ? Check : Copy, label: copied ? b.copied : q.t.copy, on: () => { try { navigator.clipboard?.writeText(`${arabic} (${m.tr} ${k})`); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1200); } },
          ].map(({ I, label, on }, i) => (
            <button key={i} type="button" onClick={on} className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-700 px-1 py-3 text-[10px] font-semibold text-slate-200 cursor-pointer hover:border-amber-500/50">
              <I className="w-5 h-5 text-amber-300" /><span className="text-center leading-3">{label}</span>
            </button>
          ))}
        </div>
        <Grounding calls={[`fetch_word_morphology(${k})`]} href={`https://quran.com/${s}/${a}`} />
      </aside>
    </div>
  );
};

/* ---------- Grounding — where the words came from ---------- */
export const Grounding: React.FC<{ calls: string[]; href?: string }> = ({ calls, href }) => {
  const b = useB();
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-emerald-700/30 bg-emerald-950/25 px-3 py-2 text-[11px] text-slate-400">
      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="font-semibold text-emerald-300">{b.grounded}</span>
        <span className="font-mono"> · {calls.join(' · ')}</span>
        {href && <a href={href} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 text-amber-300">quran.com<ExternalLink className="w-3 h-3" /></a>}
      </div>
    </div>
  );
};

/* ---------- Reader settings (parity with the Quran.ai reader) ---------- */
const Toggle: React.FC<{ on: boolean; onChange: (b: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
    <span className="text-xs text-slate-200">{label}</span>
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cx('relative w-10 h-6 rounded-full border transition-colors shrink-0', on ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-800 border-slate-600')}>
      <span className={cx('absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} style={{ width: 18, height: 18 }} />
    </button>
  </label>
);
export const ReaderSettingsPanel: React.FC = () => {
  const q = useQ(); const b = useB();
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" />{b.readerSettings}</div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-200">{b.turnBy}</span>
        <div className="grid grid-cols-2 gap-1 bg-slate-900/70 border border-slate-700 rounded-xl p-1">
          {(['page', 'ayah'] as const).map(n => (
            <button key={n} type="button" onClick={() => q.setRs({ nav: n })} aria-pressed={q.rs.nav === n}
              className={cx('px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer', q.rs.nav === n ? 'bg-amber-500 text-[var(--on-gold)]' : 'text-slate-300')}>{n === 'page' ? b.byPage : b.byAyah}</button>
          ))}
        </div>
      </div>
      <Toggle label={b.wbwInline} on={q.rs.wbw} onChange={x => q.setRs({ wbw: x })} />
      <Toggle label={b.navArrows} on={q.rs.arrows} onChange={x => q.setRs({ arrows: x })} />
      <Toggle label={b.pinAyah} on={q.rs.pin} onChange={x => q.setRs({ pin: x })} />
      <Toggle label={b.selectFirst} on={q.rs.selectFirst} onChange={x => q.setRs({ selectFirst: x })} />
    </div>
  );
};

/* ---------- Translation comparison ---------- */
export const TranslationCompare: React.FC<{ k: string; bundled?: string }> = ({ k, bundled }) => {
  const q = useQ(); const b = useB();
  const eng = QURAN_TRANSLATIONS.filter(x => x.language === 'English');
  const [picked, setPicked] = React.useState<string[]>(['saheeh', 'abdel-haleem', 'taqi-usmani']);
  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length >= 3 ? [...p.slice(1), id] : [...p, id]);
  return (
    <Card className="p-5 md:p-6 space-y-4">
      <SectionTitle icon={Languages} right={<span className="text-[10px] text-slate-400">{b.pickUpTo}</span>}>{b.compare}</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {eng.map(x => (
          <button key={x.id} type="button" onClick={() => toggle(x.id)} aria-pressed={picked.includes(x.id)}
            className={cx('px-2.5 py-1 rounded-xl border text-[11px] font-semibold cursor-pointer', picked.includes(x.id) ? 'bg-amber-500 text-[var(--on-gold)] border-amber-500' : 'border-slate-700 text-slate-300')}>{x.name}</button>
        ))}
      </div>
      <div className="space-y-2">
        {picked.map(id => {
          const o = QURAN_TRANSLATIONS.find(x => x.id === id)!; const text = trTextFor(id, k, id === 'saheeh' ? bundled : undefined);
          return (
            <div key={id} className="rounded-2xl border border-slate-800 bg-[var(--surface-inset)] p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold text-amber-300 truncate">{o.name}<span className="font-normal text-slate-500"> · {o.by.split(' — ')[0]}</span></div>
                <a href={trCitationFor(id, k)} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-amber-300">quran.com<ExternalLink className="w-3 h-3" /></a>
              </div>
              {text ? <p className="text-[15px] leading-6 text-slate-200">{text}</p> : <p className="text-xs text-slate-400">{o.name} — {b.liveTitle}</p>}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">{b.taSiMissing}</p>
    </Card>
  );
};

/* ---------- Tafsir panel ---------- */
export const TafsirPanel: React.FC<{ k: string; force?: 'loading' | 'unavailable' }> = ({ k, force }) => {
  const q = useQ(); const b = useB();
  const [ed, setEd] = React.useState(QURAN_AI_TAFSIR[0].id);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { setBusy(true); const id = setTimeout(() => setBusy(false), 600); return () => clearTimeout(id); }, [ed, k]);
  const e = QURAN_AI_TAFSIR.find(x => x.id === ed)!;
  const hit = force ? undefined : groundedTafsir(ed, k);
  const url = e.qcId ? tafsirCitation(e.qcId, k) : `https://quran.com/${k}`;
  return (
    <Card className="p-5 md:p-6 space-y-4">
      <SectionTitle icon={FileText}>{q.t.tafsir}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {QURAN_AI_TAFSIR.map(x => (
          <button key={x.id} type="button" onClick={() => setEd(x.id)} aria-pressed={ed === x.id}
            className={cx('px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer text-left', ed === x.id ? 'bg-amber-500 text-[var(--on-gold)] border-amber-500' : 'border-slate-700 text-slate-300')}>
            <span className={x.lang === 'ar' ? 'font-islamic text-[15px]' : ''} dir={x.lang === 'ar' ? 'rtl' : undefined}>{x.name}</span>
            <span className="block text-[10px] font-normal opacity-75">{x.by}</span>
          </button>
        ))}
      </div>
      {(force === 'loading' || busy) ? <QuranState kind="loading" compact t={q.t} lines={2} /> : hit ? (
        <div className="space-y-2">
          {(hit.from !== hit.to) && <div className="text-[11px] text-emerald-300">{b.covers} {hit.from}–{hit.to.split(':')[1]}</div>}
          <div className={cx('rounded-2xl border border-slate-800 bg-[var(--surface-inset)] p-4', e.lang === 'ar' ? 'font-islamic text-[19px] leading-[2.1] text-slate-100 text-right' : 'text-[15px] leading-7 text-slate-200')} dir={e.lang === 'ar' ? 'rtl' : 'ltr'} lang={e.lang}>
            {hit.text.split('\n\n').map((para, i) => <p key={i} className={i ? 'mt-3' : ''}>{para}</p>)}
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
            <span>{e.name} · {e.by}</span>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-amber-300">{q.t.openOriginal}<ExternalLink className="w-3 h-3" /></a>
          </div>
        </div>
      ) : (
        <QuranState kind="unavailable" compact t={q.t} title={`${e.name} — ${b.liveTitle}`} body={b.liveBody}
          onRetry={() => { setBusy(true); setTimeout(() => setBusy(false), 800); }} sourceUrl={url} />
      )}
    </Card>
  );
};

/* ---------- AyahStudy ---------- */
export interface AyahStudyProps { tafsirState?: 'loading' | 'unavailable'; }
export const AyahStudy: React.FC<AyahStudyProps> = ({ tafsirState }) => {
  const q = useQ(); const b = useB();
  const k = `${q.surah}:${q.ayah}`;
  const meta = SURAH_INDEX[q.surah - 1];
  const verse = q.surahs[q.surah]?.[q.ayah - 1] ?? EMBEDDED_AYAT[k];
  React.useEffect(() => { if (!q.surahs[q.surah] && !EMBEDDED_AYAT[k]) q.load(q.surah); }, [k]);
  const [reflections, setReflections] = React.useState<Record<number, string>>({});
  const [saved, setSaved] = React.useState<Record<number, boolean>>({});
  const [expl, setExpl] = React.useState('');
  const questions = (q.lang === 'en' && AYAH_QUESTIONS[k]) || [q.t.q1, q.t.q2, q.t.q3];
  const subs = q.submissions.filter(s => s.ref === k || (q.surah === 1 && s.ref === '1:1–7'));
  const te = q.trText(k, verse?.[1]);
  const ws = GROUNDED_WORDS[k];
  const calls = ['fetch_quran', ...(te ? ['fetch_translation'] : []), ...(ws ? ['fetch_word_morphology'] : []), ...(groundedTafsir('ar-muyassar', k) ? ['fetch_tafsir'] : [])].map(c => `${c}(${k})`);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 md:gap-6 items-start">
      <div className="space-y-5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => q.go('book', q.surah, q.ayah)} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"><ChevronLeft className="w-4 h-4" />{meta.tr}</button>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => q.ayah > 1 && q.go('study', q.surah, q.ayah - 1)} disabled={q.ayah <= 1} aria-label={b.prevAyah} className="p-1.5 rounded-xl border border-slate-700 text-slate-300 cursor-pointer disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => q.ayah < meta.n && q.go('study', q.surah, q.ayah + 1)} disabled={q.ayah >= meta.n} aria-label={b.nextAyah} className="p-1.5 rounded-xl border border-slate-700 text-slate-300 cursor-pointer disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            <button type="button" onClick={() => q.setDrawer(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-600/40 bg-amber-950/40 text-amber-300 text-xs font-semibold cursor-pointer"><FileText className="w-3.5 h-3.5" />{q.t.sources}</button>
          </div>
        </div>
        {!verse ? <QuranState kind="loading" t={q.t} lines={2} /> : (
          <PatternSurface strong className="p-5 md:p-8 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-amber-300">{meta.tr} · {k}</span>
              <div className="flex gap-1">
                <IconBtn label={q.t.play} onClick={() => q.audio.ref === k && q.audio.status === 'playing' ? q.pause() : q.play(k)}>{q.audio.ref === k && q.audio.status === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</IconBtn>
                <IconBtn label={q.t.bookmark} on={q.bookmarks.includes(k)} onClick={() => q.toggleBookmark(k)}>{q.bookmarks.includes(k) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}</IconBtn>
                <IconBtn label={q.t.share} onClick={() => q.openShare(k)}><Share2 className="w-4 h-4" /></IconBtn>
              </div>
            </div>
            <p className="font-arabic text-[34px] md:text-[40px] leading-[2] text-amber-100 text-center" dir="rtl" lang="ar">
              {ws ? <WordText k={k} text={verse[0]} gloss={q.rs.wbw} always /> : verse[0]}<AyahMark n={q.ayah} />
            </p>
            {ws && <p className="text-center text-[11px] text-emerald-300/80">{b.tapWord}</p>}
            {te
              ? <p className="font-serif italic text-[18px] leading-8 text-slate-200 text-center">“{te}”<span className="block not-italic font-mono text-[10px] text-slate-500 mt-1">{q.tr.name}</span></p>
              : <QuranState kind="unavailable" compact t={q.t} title={`${q.tr.name} — ${q.tr.provider === 'quran-ai' ? b.liveTitle : q.t.translationUnavailable}`} sourceUrl={q.tr.source} action={{ label: q.t.switchToSaheeh, onClick: () => q.setTranslation('saheeh') }} />}
          </PatternSurface>
        )}

        <Card className="p-5 md:p-6 space-y-4">
          <SectionTitle icon={Languages} right={ws && <span className="text-[10px] font-mono text-emerald-300">{b.viaQuranAi}</span>}>{q.t.wordByWord}</SectionTitle>
          {ws && verse ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" dir="rtl">
              {words(verse[0]).map((w, i) => { const d = ws[i]; return (
                <button key={i} type="button" onClick={() => q.setSel({ k, from: i + 1, to: i + 1 })} dir="ltr"
                  className={cx('rounded-2xl border bg-[var(--surface-inset)] p-3 text-center cursor-pointer transition-colors hover:border-emerald-500/50', q.sel?.k === k && q.sel.from === i + 1 ? 'border-emerald-500/60' : 'border-slate-800')}>
                  <div className="font-arabic text-[26px] leading-[44px] text-amber-200" dir="rtl" lang="ar">{w}</div>
                  <div className="mt-1.5 text-[10px] font-mono text-slate-400">{d?.[0]}</div>
                  <div className="text-sm font-semibold text-white leading-5">{d?.[1]}</div>
                  {d?.[2] && <div className="mt-1 text-[10px] font-mono text-slate-400">{b.rootLetters} <span className="font-arabic text-sm text-amber-300" dir="rtl">{spacedRoot(d[2])}</span></div>}
                </button>
              ); })}
            </div>
          ) : <QuranState kind="unavailable" compact t={q.t} title={b.wordLive} body="" sourceUrl={`https://quran.com/${q.surah}/${q.ayah}`} />}
        </Card>

        <TafsirPanel k={k} force={tafsirState} />
        <TranslationCompare k={k} bundled={verse?.[1]} />
        <Grounding calls={calls} href={`https://quran.com/${k}`} />
      </div>

      <div className="space-y-5">
        <Card gold className="p-5 space-y-4">
          <SectionTitle icon={MessageCircleQuestion}>{q.t.studyQuestions}</SectionTitle>
          {questions.map((qq, i) => (
            <div key={i} className="space-y-2">
              <div className="flex gap-2 text-sm text-slate-200"><span className="font-mono text-amber-300">{i + 1}.</span><span>{qq}</span></div>
              <textarea value={reflections[i] ?? ''} onChange={e => setReflections(r => ({ ...r, [i]: e.target.value }))} rows={2} placeholder={q.t.yourReflection}
                className="w-full rounded-xl border border-slate-700 bg-[var(--surface-inset)] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60" />
              {(reflections[i] ?? '').trim() && (
                <button type="button" onClick={() => { q.setNote(k, [q.notes[k], `${qq} — ${reflections[i]}`].filter(Boolean).join('\n')); setSaved(s => ({ ...s, [i]: true })); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 cursor-pointer">{saved[i] ? <Check className="w-3.5 h-3.5" /> : <NotebookPen className="w-3.5 h-3.5" />}{q.t.saveReflection}</button>
              )}
            </div>
          ))}
          <div className="text-[10px] font-mono text-slate-500">{q.t.editorial}</div>
        </Card>

        <Card className="p-5 space-y-4">
          <SectionTitle icon={Podcast}>{q.t.explanations}</SectionTitle>
          <p className="text-xs text-slate-400 leading-5 flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />{q.t.reviewNotice}</p>
          {subs.map(s => <SubmissionRow key={s.id} s={s} />)}
          <textarea value={expl} onChange={e => setExpl(e.target.value)} rows={3} placeholder={q.t.explanationPlaceholder}
            className="w-full rounded-xl border border-slate-700 bg-[var(--surface-inset)] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60" />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!expl.trim()} onClick={() => { q.submit({ id: 'x' + Date.now(), kind: 'explanation', ref: k, title: expl.slice(0, 60), status: 'awaiting', when: 'Now' }); setExpl(''); }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-[var(--on-gold)] text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><Upload className="w-3.5 h-3.5" />{q.t.submitExplanation}</button>
            <button type="button" onClick={() => q.submit({ id: 'p' + Date.now(), kind: 'podcast', ref: k, title: `${meta.tr} ${k} — recording`, status: 'awaiting', when: 'Now', length: '0:00' })}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"><Mic className="w-3.5 h-3.5" />{q.t.submitPodcast}</button>
          </div>
        </Card>
      </div>
    </div>
  );
};

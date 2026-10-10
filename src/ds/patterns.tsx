// Hand-written pattern components for the design system.
// Every class string is copied verbatim from the app source (path noted per component);
// these are extractions of repeated JSX, not new designs.
import React from 'react';
import { Flame, FileSpreadsheet, Radio, Users, Award } from 'lucide-react';
import { getNarratorBadgeStyle, getPurityLevel, getTransmissionBadge } from '../utils/gradeUtils';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../utils/localization';

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');

/* ---------- Button — App.tsx L468/L478, HadithSearchForm.tsx L682/L710, PodcastScriptPlayer.tsx L944 ---------- */
export type ButtonVariant = 'run' | 'gold' | 'solid' | 'share' | 'secondary';
export interface ButtonProps {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}
const BUTTON: Record<ButtonVariant, string> = {
  run: 'px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-[var(--on-gold)] font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  gold: 'px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-[var(--on-gold)] font-extrabold text-xs flex items-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer',
  solid: 'px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-[var(--on-gold)] font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50',
  share: 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-amber-500/15 hover:from-amber-500/25 hover:to-emerald-500/25 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer shadow-md shadow-amber-500/10',
  secondary: 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer',
};
export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', icon, children, disabled, onClick }) => (
  <button type="button" className={BUTTON[variant]} disabled={disabled} onClick={onClick}>
    {icon}
    {children}
  </button>
);

/* ---------- MonoTag — App.tsx L414, L546, L580, L615, L689 ---------- */
export type MonoTagTone = 'emerald' | 'amber' | 'cyan' | 'live';
export interface MonoTagProps { tone?: MonoTagTone; pill?: boolean; children?: React.ReactNode; }
export const MonoTag: React.FC<MonoTagProps> = ({ tone = 'emerald', pill, children }) => {
  if (pill) {
    return <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-600/40">{children}</span>;
  }
  const tones: Record<MonoTagTone, string> = {
    emerald: 'bg-emerald-950 text-emerald-400 border border-emerald-800',
    amber: 'bg-amber-950 text-amber-400 border border-amber-800 font-bold',
    cyan: 'bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold',
    live: 'bg-red-950 text-red-400 border border-red-800 flex items-center gap-1 font-bold',
  };
  return (
    <span className={cx('text-[9px] font-mono px-1.5 py-0.5 rounded', tones[tone])}>
      {tone === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>}
      {children}
    </span>
  );
};

/* ---------- NarratorBadge — utils/gradeUtils.ts getNarratorBadgeStyle (the classes the app applies) ---------- */
export interface NarratorBadgeProps { status: string; }
export const NarratorBadge: React.FC<NarratorBadgeProps> = ({ status }) => {
  const s = getNarratorBadgeStyle(status);
  return <span className={cx('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border', s.badgeClass)}>{s.label}</span>;
};

/* ---------- TransmissionBadge — utils/gradeUtils.ts getTransmissionBadge ---------- */
export interface TransmissionBadgeProps { mode: string; }
export const TransmissionBadge: React.FC<TransmissionBadgeProps> = ({ mode }) => {
  const t = getTransmissionBadge(mode);
  return <span className={cx('text-[10px] font-mono px-2 py-0.5 rounded border', t.color)}>{t.label}</span>;
};

/* ---------- PurityBadge — utils/gradeUtils.ts getPurityLevel ---------- */
export interface PurityBadgeProps { score: number; }
export const PurityBadge: React.FC<PurityBadgeProps> = ({ score }) => {
  const p = getPurityLevel(score);
  return (
    <span className={cx('inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-xl border', p.badgeClass)}>
      <span className="font-mono">{score}%</span>
      <span>{p.title}</span>
      <span className="font-arabic text-sm font-normal" dir="rtl">{p.arabicTitle}</span>
    </span>
  );
};

/* ---------- Panel — App.tsx L523, L680-L694 ---------- */
export interface PanelProps { title?: string; subtitle?: string; tag?: string; children?: React.ReactNode; }
export const Panel: React.FC<PanelProps> = ({ title, subtitle, tag, children }) => (
  <div className="bg-[var(--surface-panel)] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
    {(title || tag) && (
      <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
        <div>
          <h4 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            {title}
          </h4>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {tag && (
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-xl border border-emerald-800">{tag}</span>
        )}
      </div>
    )}
    <div className="prose prose-invert max-w-none space-y-4 text-slate-300 text-sm leading-relaxed">{children}</div>
  </div>
);

/* ---------- LanguageToggle — App.tsx L427-L445 ---------- */
export interface LanguageToggleProps { value?: SupportedLanguage; onChange?: (code: SupportedLanguage) => void; compact?: boolean; }
export const LanguageToggle: React.FC<LanguageToggleProps> = ({ value, onChange, compact }) => {
  const [inner, setInner] = React.useState<SupportedLanguage>(value ?? 'en');
  const current = value ?? inner;
  return (
    <div className="inline-flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 text-xs">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => { setInner(lang.code); onChange?.(lang.code); }}
          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
            current === lang.code ? 'bg-amber-500 text-[var(--on-gold)] shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
          title={lang.nativeLabel}
        >
          {!compact && <span className="text-[11px]">{lang.flag}</span>}
          <span>{compact ? lang.code.toUpperCase() : lang.nativeLabel}</span>
        </button>
      ))}
    </div>
  );
};

/* ---------- BrandMark — App.tsx L402-L420 (the app has no logo file: a Flame icon in a gradient tile) ---------- */
export interface BrandMarkProps { tagline?: string; version?: string; compact?: boolean; }
export const BrandMark: React.FC<BrandMarkProps> = ({
  tagline = 'Prime Dragon Technologies • Hadith Deep Search & Authentication',
  version = 'v2.5 Enterprise Engine',
  compact,
}) => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-emerald-600 to-slate-900 p-0.5 shadow-lg shadow-amber-500/10 flex items-center justify-center">
      <div className="w-full h-full bg-[var(--surface-header)] rounded-[10px] flex items-center justify-center">
        <Flame className="w-5 h-5 text-amber-400" />
      </div>
    </div>
    {!compact && (
      <div>
        <div className="flex items-center gap-2">
          <h1 className="whitespace-nowrap text-[17px] md:text-[22px] leading-7 font-bold tracking-[0.1em] md:tracking-[0.14em] text-white font-display">DRAGON DAWWA</h1>
          {version && <MonoTag pill>{version}</MonoTag>}
        </div>
        {tagline && <p className="text-[11px] text-slate-400">{tagline}</p>}
      </div>
    )}
  </div>
);

/* ---------- ModeCard — App.tsx L527-L630 (master tab selector) ---------- */
export type ModeCardTone = 'emerald' | 'amber' | 'cyan';
export interface ModeCardProps {
  tone?: ModeCardTone;
  active?: boolean;
  tag?: string;
  live?: boolean;
  title: string;
  subtitle?: string;
  icon?: 'dossier' | 'studio' | 'wall';
  onClick?: () => void;
}
const MODE_ACTIVE: Record<ModeCardTone, [string, string]> = {
  emerald: ['bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-emerald-500/70 shadow-xl ring-1 ring-emerald-500/30', 'bg-emerald-950 text-emerald-300 border-emerald-500/60 shadow-lg'],
  amber: ['bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border-amber-500/70 shadow-xl ring-1 ring-amber-500/30', 'bg-amber-950 text-amber-300 border-amber-500/60 shadow-lg'],
  cyan: ['bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-900 border-cyan-500/70 shadow-xl ring-1 ring-cyan-500/30', 'bg-cyan-950 text-cyan-300 border-cyan-500/60 shadow-lg'],
};
export const ModeCard: React.FC<ModeCardProps> = ({ tone = 'emerald', active, tag, live, title, subtitle, icon = 'dossier', onClick }) => {
  const Icon = icon === 'studio' ? Radio : icon === 'wall' ? Users : FileSpreadsheet;
  const iconColor = icon === 'studio' ? 'text-amber-400' : icon === 'wall' ? 'text-cyan-400' : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-4 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer ${
        active ? MODE_ACTIVE[tone][0] : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border shrink-0 ${
          active ? MODE_ACTIVE[tone][1] : 'bg-slate-800 text-slate-400 border-slate-700'
        }`}>
          <Icon className={cx('w-5 h-5', iconColor)} />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            {tag && <MonoTag tone={live ? 'live' : tone}>{tag}</MonoTag>}
            <h3 className="text-xs sm:text-sm font-extrabold text-white">{title}</h3>
          </div>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{subtitle}</p>}
        </div>
      </div>
    </button>
  );
};


/* ---------- ThemeToggle — Night Masjid / Mushaf, saved per browser ---------- */
export type ThemeName = 'night' | 'mushaf';
export const useTheme = (): [ThemeName, (t: ThemeName) => void] => {
  const read = (): ThemeName => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'mushaf') ? 'mushaf' : 'night';
  const [theme, setThemeState] = React.useState<ThemeName>(read);
  const setTheme = (t: ThemeName) => {
    document.documentElement.dataset.theme = t; setThemeState(t);
    try { localStorage.setItem('dd-theme', t); } catch {}
  };
  return [theme, setTheme];
};
export const ThemeToggle: React.FC<{ value: ThemeName; onChange: (t: ThemeName) => void }> = ({ value, onChange }) => (
  <button type="button" onClick={() => onChange(value === 'night' ? 'mushaf' : 'night')}
    aria-label={value === 'night' ? 'Switch to the Mushaf theme' : 'Switch to the Night Masjid theme'}
    title={value === 'night' ? 'Mushaf (light)' : 'Night Masjid (dark)'}
    className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-700 bg-slate-900/70 text-amber-300 cursor-pointer hover:border-amber-500/50">
    {value === 'night'
      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
  </button>
);

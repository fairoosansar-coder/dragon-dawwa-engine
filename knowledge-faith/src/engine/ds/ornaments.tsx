// Islamic ornament components — new for the Night Masjid / Mushaf redesign.
// Aniconic by design: geometry (8-point Khatam stars, rub el hizb), the mihrab arch and
// Arabic script only; no figurative imagery.
import React from 'react';

const cx = (...c: Array<string | false | undefined | null>) => c.filter(Boolean).join(' ');

/* ---------- RubElHizb — the 8-point star (۞) as a crisp SVG mark ---------- */
export interface RubElHizbProps { size?: number; className?: string; filled?: boolean; }
export const RubElHizb: React.FC<RubElHizbProps> = ({ size = 20, className, filled }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}
    style={{ color: 'var(--gold-leaf)' }}>
    <g fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.18 : 0} stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round">
      <rect x="5" y="5" width="14" height="14" />
      <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
    </g>
    <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.25" />
  </svg>
);

/* ---------- StarDivider — hairlines meeting at a rub el hizb ---------- */
export interface StarDividerProps { label?: string; }
export const StarDivider: React.FC<StarDividerProps> = ({ label }) => (
  <div className="flex items-center gap-3 w-full" role="separator">
    <span className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, var(--gold-border))' }} />
    <RubElHizb size={18} filled />
    {label && <span className="font-islamic text-lg leading-7 text-amber-300" dir="rtl" lang="ar">{label}</span>}
    {label && <RubElHizb size={18} filled />}
    <span className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, var(--gold-border))' }} />
  </div>
);

/* ---------- PatternSurface — a surface with the Khatam star lattice ---------- */
export interface PatternSurfaceProps { strong?: boolean; className?: string; children?: React.ReactNode; }
export const PatternSurface: React.FC<PatternSurfaceProps> = ({ strong, className, children }) => (
  <div
    className={cx('relative rounded-3xl border islamic-gold-border overflow-hidden', className)}
    style={{
      backgroundColor: 'var(--surface-panel)',
      backgroundImage: `radial-gradient(ellipse at 50% 0%, var(--gold-glow), transparent 60%), ${strong ? 'var(--pattern-star-strong)' : 'var(--pattern-star)'}`,
    }}
  >
    {children}
  </div>
);

/* ---------- Corner rosette for IlluminatedFrame ---------- */
const Rosette: React.FC<{ pos: string }> = ({ pos }) => (
  <span className={cx('absolute w-7 h-7 flex items-center justify-center rounded-full', pos)}
    style={{ background: 'var(--surface-panel)' }}>
    <RubElHizb size={22} filled />
  </span>
);

/* ---------- IlluminatedFrame — a Mushaf-style gilded double border with corner rosettes ---------- */
export interface IlluminatedFrameProps { title?: string; arabicTitle?: string; children?: React.ReactNode; }
export const IlluminatedFrame: React.FC<IlluminatedFrameProps> = ({ title, arabicTitle, children }) => (
  <div className="relative rounded-2xl p-1.5 islamic-gold-glow" style={{ border: '1px solid var(--gold-border)', background: 'var(--surface-panel)' }}>
    <div className="relative rounded-xl px-7 py-6 space-y-4" style={{ border: '1px solid var(--gold-border)', backgroundImage: 'var(--pattern-star)' }}>
      <Rosette pos="-top-3.5 -left-3.5" />
      <Rosette pos="-top-3.5 -right-3.5" />
      <Rosette pos="-bottom-3.5 -left-3.5" />
      <Rosette pos="-bottom-3.5 -right-3.5" />
      {(title || arabicTitle) && (
        <div className="text-center space-y-1">
          {arabicTitle && <div className="font-kufi text-2xl text-amber-300" dir="rtl">{arabicTitle}</div>}
          {title && <div className="font-display text-xl font-semibold tracking-wide text-white">{title}</div>}
          <div className="pt-2"><StarDivider /></div>
        </div>
      )}
      <div className="text-slate-300 text-[15px] leading-[26px]">{children}</div>
    </div>
  </div>
);

/* ---------- ArchBanner — carved emerald-and-gold plate with the Basmala ---------- */
export interface ArchBannerProps {
  bismillah?: boolean;
  title: string;
  subtitle?: string;
  arabic?: string;
  children?: React.ReactNode;
  compact?: boolean;
}
export const ArchBanner: React.FC<ArchBannerProps> = ({ title, subtitle, arabic, children }) => (
  <div
    data-research-arch
    className="relative w-full overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-r from-[#041B14] via-[#0A2E23] to-[#041B14] shadow-[0_0_25px_rgba(212,175,55,0.08)]"
  >
    <img
      src="/assets/geometric-carved-arch.jpg"
      alt=""
      className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-15 mix-blend-overlay"
    />
    <div className="relative flex min-h-[116px] flex-col justify-between gap-3 px-4 py-3.5 sm:max-h-[128px] sm:flex-row sm:items-center sm:px-6 sm:py-4">
      <div className="min-w-0 max-w-xl text-left">
        <p className="text-[11px] font-semibold tracking-widest text-[#E6C665]">
          ✦ INSTITUTIONAL RESEARCH STUDIO
        </p>
        <h2 className="mt-1 font-serif text-lg font-bold tracking-tight text-white sm:text-xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-stone-300">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-start sm:items-end sm:text-right">
        <div
          className="font-serif text-xl leading-snug text-white drop-shadow-sm sm:text-2xl"
          dir="rtl"
          lang="ar"
        >
          {arabic || 'طَلَبُ الْعِلْمِ فَرِيضَةٌ'}
        </div>
        <span className="mt-0.5 text-[11px] text-stone-400">
          “Seeking knowledge is an obligation”
        </span>
      </div>
    </div>
    {children && (
      <div className="relative flex flex-wrap items-center justify-end gap-2 border-t border-[#D4AF37]/20 bg-[#03150F]/60 px-4 py-2 sm:px-6">
        {children}
      </div>
    )}
  </div>
);

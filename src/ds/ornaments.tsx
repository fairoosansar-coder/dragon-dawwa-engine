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

const ARCH_MASK = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300" preserveAspectRatio="none"><path d="M8 300V132C8 80 220 52 400 6C580 52 792 80 792 132V300Z"/></svg>') + '")';

/* ---------- ArchBanner — a mihrab-arch hero with the Basmala ---------- */
export interface ArchBannerProps {
  bismillah?: boolean;
  title: string;
  subtitle?: string;
  arabic?: string;
  children?: React.ReactNode;
  compact?: boolean;
}
export const ArchBanner: React.FC<ArchBannerProps> = ({ bismillah = true, title, subtitle, arabic, children, compact }) => (
  <div className="relative w-full" style={{ minHeight: compact ? 220 : 300 }}>
    <div className="absolute inset-0" style={{
      backgroundColor: 'var(--surface-panel)',
      backgroundImage: 'radial-gradient(ellipse at 50% 10%, var(--gold-glow), transparent 65%), var(--pattern-star-strong)',
      WebkitMaskImage: ARCH_MASK, maskImage: ARCH_MASK,
      WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    } as React.CSSProperties} />
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
      <path d="M8 300V132C8 80 220 52 400 6C580 52 792 80 792 132V300" fill="none" style={{ stroke: 'var(--gold-leaf)' }} strokeOpacity="0.75" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path d="M22 300V138C22 92 228 66 400 22C572 66 778 92 778 138V300" fill="none" style={{ stroke: 'var(--gold-leaf)' }} strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className={`relative flex flex-col items-center text-center px-6 md:px-10 ${compact ? 'pt-10 md:pt-12 pb-6 md:pb-7 gap-2' : 'pt-12 md:pt-16 pb-8 md:pb-10 gap-2 md:gap-3'}`}>
      <RubElHizb size={26} filled />
      {bismillah && (
        <div className="font-arabic text-[26px] leading-[44px] md:text-[34px] md:leading-[56px] text-amber-300" dir="rtl" lang="ar">
          بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
        </div>
      )}
      <h2 className={`font-display font-semibold text-white ${compact ? 'text-[26px] leading-[32px] md:text-[30px] md:leading-[36px]' : 'text-[30px] leading-[36px] md:text-[40px] md:leading-[44px]'}`}>{title}</h2>
      {arabic && <div className="font-kufi text-xl text-amber-200" dir="rtl" lang="ar">{arabic}</div>}
      {subtitle && <p className="max-w-xl text-sm leading-6 text-slate-400">{subtitle}</p>}
      {children && <div className="pt-2 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  </div>
);

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { BadgeCheck, CircleDashed, ShieldAlert } from 'lucide-react';
import type { TopicId } from '../../shared/spiritual/catalog.ts';
import type { PublicGuide } from '../../shared/spiritual/governance.ts';
import { useSp } from '../../lib/spiritualStore.ts';

/** Aniconic line illustrations for each topic: geometry and architecture only, no figures. */
const PATHS: Record<TopicId, ReactNode> = {
  shahadah: (
    <>
      <path d="M24 5l5.6 8.4L39.5 11l-2.4 9.9L45 24l-7.9 3.1 2.4 9.9-9.9-2.4L24 43l-5.6-8.4L8.5 37l2.4-9.9L3 24l7.9-3.1L8.5 11l9.9 2.4z" />
      <circle cx="24" cy="24" r="6" />
      <circle cx="24" cy="24" r="1.4" fill="currentColor" />
    </>
  ),
  salah: (
    <>
      <path d="M10 44V22c0-8 6.3-14 14-17 7.7 3 14 9 14 17v22" />
      <path d="M16 44V25c0-5 3.6-9 8-11 4.4 2 8 6 8 11v19" />
      <path d="M6 44h36" />
      <circle cx="24" cy="9" r="1.2" fill="currentColor" />
    </>
  ),
  zakah: (
    <>
      <path d="M6 30c5 0 8 3 12 3h8a3 3 0 0 0 0-6h-6" />
      <path d="M6 40l6-2 14 3 15-8a3 3 0 0 0-3-5l-9 4" />
      <circle cx="31" cy="13" r="7" />
      <path d="M31 9.5v7M28.5 13h5" />
    </>
  ),
  fasting: (
    <>
      <path d="M31 6a15 15 0 1 0 11 24A13 13 0 0 1 31 6z" />
      <path d="M37 11l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4z" />
      <path d="M4 44h40M10 40h28" />
    </>
  ),
  hajj: (
    <>
      <path d="M10 16l14-7 14 7v22l-14 6-14-6z" />
      <path d="M10 16l14 6 14-6M24 22v22" />
      <path d="M10 22l14 6 14-6" />
    </>
  ),
  umrah: (
    <>
      <ellipse cx="24" cy="30" rx="19" ry="8" />
      <path d="M16 15l8-4 8 4v14l-8 4-8-4z" />
      <path d="M16 15l8 4 8-4M24 19v14" />
      <path d="M42 26l1.5 4-4 .5" />
    </>
  ),
  'dua-dhikr': (
    <>
      <circle cx="24" cy="20" r="12" strokeDasharray="2.2 3.2" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 32v5" />
      <path d="M21 37h6l-1 7h-4z" />
    </>
  ),
  akhlaq: (
    <>
      <path d="M17 4h14l10 10v14L31 38H17L7 28V14z" />
      <path d="M24 31s-8-5-8-10.5a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8C32 26 24 31 24 31z" />
      <path d="M24 38v6" />
    </>
  ),
  'new-muslim': (
    <>
      <path d="M8 34a16 16 0 0 1 32 0" />
      <path d="M4 34h40M10 40h28" />
      <path d="M24 8v6M10 14l4 4M38 14l-4 4M4 25h5M39 25h5" />
    </>
  ),
};

export function PillarIcon({ topic, className = 'h-12 w-12' }: { topic: TopicId; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      {PATHS[topic]}
    </svg>
  );
}

function Corner({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 34 34" className={`sp-corner ${className}`} fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path d="M2 32V10a8 8 0 0 1 8-8h22" />
      <path d="M7 32V14a7 7 0 0 1 7-7h18" strokeOpacity=".6" />
      <path d="M2 18c6 0 10-4 10-10M12 2c0 6 4 10 10 10" strokeOpacity=".8" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Decorative frame for book reading mode. Decoration never carries meaning. */
export function IlluminatedFrame({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  if (!on) return <div className={className}>{children}</div>;
  return (
    <div className={`sp-frame ${className}`}>
      <Corner className="left-1 top-1" />
      <Corner className="right-1 top-1 -scale-x-100" />
      <Corner className="bottom-1 left-1 -scale-y-100" />
      <Corner className="bottom-1 right-1 -scale-100" />
      {children}
    </div>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center justify-center gap-3 text-gilt" aria-hidden>
      <span className="h-px w-16 bg-gilt/50" />
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M10 1l2.6 6.4L19 10l-6.4 2.6L10 19l-2.6-6.4L1 10l6.4-2.6z" />
      </svg>
      <span className="h-px w-16 bg-gilt/50" />
    </div>
  );
}

type Status = PublicGuide['status'];

export function StatusBadge({ status, scholarReviewed }: { status: Status; scholarReviewed: boolean }) {
  const { s } = useSp();
  if (status === 'published') {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald/10 px-2.5 py-0.5 text-xs font-semibold text-emerald">
          {s.statusPublished}
        </span>
        {scholarReviewed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-lapis/10 px-2.5 py-0.5 text-xs font-semibold text-lapis">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {s.scholarReviewed}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2.5 py-0.5 text-xs text-ink/70">{s.notScholarReviewed}</span>
        )}
      </span>
    );
  }
  if (status === 'withdrawn') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> {s.statusWithdrawn}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gilt-deep/30 bg-vellum px-2.5 py-0.5 text-xs font-semibold text-gilt-deep">
      <CircleDashed className="h-3.5 w-3.5" aria-hidden /> {s.statusPreparation}
    </span>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="sp-no-print mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-ink/60">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>›</span>}
            {item.href ? (
              <a href={item.href} className="rounded px-1 text-emerald underline-offset-2 hover:underline">
                {item.label}
              </a>
            ) : (
              <span aria-current="page" className="px-1 text-ink/80">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Branded heading band used at the top of each page in the section. */
export function SectionBand({
  title,
  subtitle,
  arabic,
  topic,
  children,
}: {
  title: string;
  subtitle?: string;
  arabic?: string;
  topic?: TopicId;
  children?: ReactNode;
}) {
  const { s } = useSp();
  return (
    <header className="sp-band relative mb-6 overflow-hidden rounded-[2rem] px-5 py-7 sm:px-8 sm:py-9">
      <div className="sp-lattice pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        {topic && (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-gilt/50 bg-emerald-deep/40 text-gilt">
            <PillarIcon topic={topic} className="h-10 w-10" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gilt">
            {s.brand} <span className="font-normal normal-case tracking-normal text-ivory/70">· {s.brandBy}</span>
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ivory/85 sm:text-base">{subtitle}</p>}
        </div>
        {arabic && (
          <p lang="ar" dir="rtl" className="font-[family-name:var(--font-arabic)] text-3xl text-gilt sm:text-4xl">
            {arabic}
          </p>
        )}
      </div>
      {children && <div className="relative mt-5">{children}</div>}
    </header>
  );
}

export function Panel({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-3xl border border-emerald/10 bg-white/90 p-5 shadow-[0_1px_0_rgb(6_73_54/0.05)] sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function PanelTitle({ children, sub, as: Tag = 'h2' }: { children: ReactNode; sub?: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <div className="mb-4">
      <Tag className={`font-display font-bold text-emerald ${Tag === 'h2' ? 'text-2xl' : 'text-lg'}`}>{children}</Tag>
      {sub && <p className="mt-1 text-sm leading-relaxed text-ink/70">{sub}</p>}
    </div>
  );
}

export function Callout({ tone = 'info', children, title }: { tone?: 'info' | 'caution' | 'privacy'; children: ReactNode; title?: string }) {
  const tones = {
    info: 'border-lapis/20 bg-lapis/5 text-ink/85',
    caution: 'border-gilt-deep/30 bg-vellum text-ink/85',
    privacy: 'border-emerald/20 bg-emerald/5 text-ink/85',
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>
      {title && <p className="mb-1 font-semibold text-emerald">{title}</p>}
      {children}
    </div>
  );
}

export function Pill({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${active ? 'bg-emerald text-ivory' : 'bg-emerald/5 text-emerald hover:bg-emerald/10'}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink/75">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-ink/60">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-emerald/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-emerald focus:outline-none';

export function SpButton({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' }) {
  const v = {
    primary: 'bg-emerald text-ivory hover:bg-emerald-deep disabled:bg-emerald/40',
    soft: 'bg-emerald/8 text-emerald ring-1 ring-emerald/15 hover:bg-emerald/12 disabled:opacity-50',
    ghost: 'text-emerald hover:bg-emerald/8 disabled:opacity-50',
    danger: 'text-red-800 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50',
  }[variant];
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${v} ${className}`}
      {...props}
    />
  );
}

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../lib/store.tsx';

type Variant = 'primary' | 'ghost' | 'soft';

const variants: Record<Variant, string> = {
  primary: 'bg-moss text-white hover:bg-[#073C30] disabled:bg-moss/50',
  soft: 'bg-mint text-[#073C30] hover:bg-mint/80 disabled:opacity-50',
  ghost: 'text-pine hover:bg-mint/60 hover:text-[#073C30] disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-[13px] disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function IconButton({ label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-pine transition-colors hover:bg-mint disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-pine/10 bg-parchment p-3.5 shadow-2xs sm:p-4 ${className}`}>{children}</section>;
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-2.5">
      <h2 className="font-display text-sm font-bold text-pine sm:text-base">{children}</h2>
      {sub && <p className="mt-0.5 text-[11px] text-ink/70 sm:text-xs">{sub}</p>}
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useApp();
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-sm text-ink/70">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label ?? t.loading}
    </p>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useApp();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-900">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button variant="soft" onClick={onRetry}>
          {t.retry}
        </Button>
      )}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-gold/10 px-4 py-3 text-sm text-ink/80">{children}</p>;
}

export function TabLinks({ label, tabs }: { label: string; tabs: { href: string; label: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="mb-5 flex flex-wrap gap-2">
      {tabs.map(tab => (
        <a
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? 'page' : undefined}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${tab.active ? 'bg-pine text-white' : 'bg-mint text-pine hover:bg-mint/70'}`}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink/70">
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm text-ink"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A corner of the cream geometric plate, so a pale choice card is not an empty box. */
export function SelectionWash() {
  return (
    <img
      src="/assets/geometric-cream.jpg"
      alt=""
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-28 object-cover object-[right_top] [mask-image:linear-gradient(90deg,transparent,#000_58%)]"
    />
  );
}

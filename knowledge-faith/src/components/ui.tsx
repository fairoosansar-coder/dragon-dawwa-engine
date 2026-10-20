import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../lib/store.tsx';

type Variant = 'primary' | 'ghost' | 'soft';

const variants: Record<Variant, string> = {
  primary: 'bg-pine text-white hover:bg-moss disabled:bg-pine/50',
  soft: 'bg-mint text-pine hover:bg-mint/70 disabled:opacity-50',
  ghost: 'text-pine hover:bg-mint/60 disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
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
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-pine transition-colors hover:bg-mint disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-pine/10 bg-parchment p-5 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-2xl font-bold text-pine">{children}</h2>
      {sub && <p className="mt-1 text-sm text-ink/70">{sub}</p>}
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
        className="rounded-xl border border-pine/20 bg-white px-3 py-2 text-sm text-ink"
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

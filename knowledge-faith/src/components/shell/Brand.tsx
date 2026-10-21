import { useApp } from '../../lib/store.tsx';

/** Existing DD monogram, recolored. On emerald the wordmark is ivory; on ivory it is emerald. */
export function BrandLockup({ tone = 'ivory' }: { tone?: 'emerald' | 'ivory' }) {
  const { t } = useApp();
  const onEmerald = tone === 'emerald';
  return (
    <a href="#/hub" className="flex min-w-0 items-center gap-3 rounded-xl">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border font-display text-sm font-bold tracking-wide ${onEmerald ? 'border-gold text-gold' : 'border-pine bg-pine text-gold'}`}
        aria-hidden
      >
        DD
      </span>
      <span className="min-w-0 leading-tight">
        <span className={`block truncate font-display text-base font-bold tracking-wide ${onEmerald ? 'text-sand' : 'text-pine'}`}>DRAGON DAWWA</span>
        <span className={`block truncate text-xs italic ${onEmerald ? 'text-sand/80' : 'text-muted'}`}>{t.brandSub}</span>
      </span>
    </a>
  );
}

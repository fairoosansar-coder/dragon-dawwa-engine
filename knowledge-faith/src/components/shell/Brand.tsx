import { useApp } from '../../lib/store.tsx';

/** Gold ring seal. The letters sit in the circle, as on the desk sidebar. */
function CarvedSeal() {
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full">
        <circle cx="24" cy="24" r="21.4" fill="none" stroke="#C6A15A" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="18.15" fill="none" stroke="#E6D3A1" strokeWidth="0.6" />
      </svg>
      <span className="relative font-['Cormorant_Garamond',Georgia,serif] text-[13px] font-semibold tracking-[0.08em] text-[#F6E7C1]">
        DD
      </span>
    </span>
  );
}

/** Sidebar wordmark. Emerald tone is the carved plate; ivory is the same seal on a light ground. */
export function BrandLockup({ tone = 'ivory' }: { tone?: 'emerald' | 'ivory' }) {
  const { t } = useApp();
  const onEmerald = tone === 'emerald';
  return (
    <a href="#/hub" className="flex min-w-0 items-center gap-2.5 rounded-xl">
      <CarvedSeal />
      <span className="min-w-0 leading-tight">
        <span
          className={`block truncate font-['Cormorant_Garamond',Georgia,serif] text-[13px] font-semibold tracking-[0.08em] ${onEmerald ? 'text-[#F6E7C1]' : 'text-pine'}`}
        >
          DRAGON DAWWA
        </span>
        <span className={`mt-1 block h-px w-8 bg-gradient-to-r ${onEmerald ? 'from-[#C6A15A] to-transparent' : 'from-gold to-transparent'}`} aria-hidden />
        <span className={`mt-1 block truncate font-['Cormorant_Garamond',Georgia,serif] text-[12.5px] italic leading-none ${onEmerald ? 'text-[#E7D7B0]' : 'text-muted'}`}>
          {t.brandSub}
        </span>
      </span>
    </a>
  );
}

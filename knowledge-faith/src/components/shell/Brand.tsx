import { useApp } from '../../lib/store.tsx';

/** Carved emerald seal. The letters sit in a gold octagram, like an inlaid medallion. */
function CarvedSeal() {
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden>
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="kf-seal-gold" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F8E7B0" />
            <stop offset="0.46" stopColor="#C9A14E" />
            <stop offset="1" stopColor="#7A5A24" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="22.25" fill="#041910" stroke="url(#kf-seal-gold)" strokeWidth="1.4" />
        <circle cx="24" cy="24" r="19.15" fill="none" stroke="#E6C665" strokeWidth="0.55" />
        <path d="M24 8.2 39.8 24 24 39.8 8.2 24Z" fill="none" stroke="#E6C665" strokeWidth="0.75" />
        <path d="M12.8 12.8h22.4v22.4H12.8Z" fill="none" stroke="#C9A14E" strokeWidth="0.75" />
        <circle cx="24" cy="24" r="8.15" fill="#063026" stroke="#E6C665" strokeWidth="0.65" />
      </svg>
      <span className="relative font-['Cormorant_Garamond',Georgia,serif] text-[13px] font-semibold tracking-[0.06em] text-[#F6E4B4] [text-shadow:0_1px_0_rgba(48,32,8,0.9),0_-1px_0_rgba(255,244,214,0.35)]">
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
          className={`block truncate font-['Cormorant_Garamond',Georgia,serif] text-[13px] font-semibold tracking-[0.08em] [text-shadow:0_1px_0_rgba(48,32,8,0.85),0_-1px_0_rgba(255,244,214,0.28)] ${onEmerald ? 'text-[#F6E4B4]' : 'text-pine'}`}
        >
          DRAGON DAWWA
        </span>
        <span className={`mt-1 block h-px w-8 bg-gradient-to-r ${onEmerald ? 'from-[#E6C665] to-transparent' : 'from-gold to-transparent'}`} aria-hidden />
        <span className={`mt-1 block truncate font-['Cormorant_Garamond',Georgia,serif] text-[12.5px] italic leading-none ${onEmerald ? 'text-[#F4E6C4]' : 'text-muted'}`}>
          {t.brandSub}
        </span>
      </span>
    </a>
  );
}

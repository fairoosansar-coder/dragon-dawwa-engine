import { useId, type ReactNode } from 'react';

/** Dimensional desk emblems. Depth comes from offset slabs, metal rims, and a lit face. */
export type NavIconName = 'knowledge' | 'quran' | 'hadith' | 'books' | 'worship' | 'podcast' | 'saved' | 'question';

function Materials({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-em`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3E9A78" />
        <stop offset="0.42" stopColor="#0E5340" />
        <stop offset="1" stopColor="#04261C" />
      </linearGradient>
      <linearGradient id={`${id}-deep`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#14604C" />
        <stop offset="1" stopColor="#021510" />
      </linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.15" y2="1">
        <stop offset="0" stopColor="#FFF6D2" />
        <stop offset="0.38" stopColor="#E4C27A" />
        <stop offset="1" stopColor="#7A5424" />
      </linearGradient>
      <linearGradient id={`${id}-ivory`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFDF8" />
        <stop offset="0.55" stopColor="#F6EDD6" />
        <stop offset="1" stopColor="#D9C49A" />
      </linearGradient>
      <radialGradient id={`${id}-spec`} cx="32%" cy="24%" r="68%">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.72" />
        <stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-drop`} x="-30%" y="-30%" width="170%" height="170%">
        <feDropShadow dx="0" dy="1.6" stdDeviation="1.1" floodColor="#021510" floodOpacity="0.38" />
      </filter>
    </defs>
  );
}

function knowledge(id: string) {
  return (
    <g filter={`url(#${id}-drop)`}>
      <path d="M9 26 30 20v30L9 50Z" fill="#021510" />
      <path d="M34 20 55 26v24L34 50Z" fill="#021510" />
      <path d="M11 23.5 31 18l.2 29.5L11 47.2Z" fill={`url(#${id}-ivory)`} />
      <path d="M33 18 53 23.5 53 47.2 33.2 47.5Z" fill={`url(#${id}-ivory)`} />
      <path d="M11 23.5 31 18v3.2L12.6 26.4Z" fill={`url(#${id}-em)`} />
      <path d="M33 18 53 23.5 51.4 26.4 33 21.2Z" fill={`url(#${id}-em)`} />
      <path d="M30.2 17.2h3.6V49h-3.6Z" fill={`url(#${id}-gold)`} />
      <path d="M31.2 18.4h1.5v29.2h-1.5Z" fill="#FFF6D2" opacity="0.7" />
      <path d="M15 29h11M15 33h11M15 37h8" stroke="#C6A15A" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M38 29h11M38 33h11M38 37h8" stroke="#0B4B3A" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
      <path d="M32 20.5v8l3.2 1.6 3.2-1.6v-6.2Z" fill={`url(#${id}-gold)`} />
    </g>
  );
}

function quran(id: string) {
  return (
    <g filter={`url(#${id}-drop)`}>
      <path d="M20 16h24c2 0 3.4 1.5 3.4 3.4V48H20Z" fill="#021510" transform="translate(2.2 2)" />
      <path d="M46 16.5 54 21v28.5L46 45.2Z" fill={`url(#${id}-gold)`} />
      <path d="M18 14h26c2 0 3.2 1.4 3.2 3.2V46H18Z" fill={`url(#${id}-em)`} />
      <path d="M18 14 25 8.5h25.2L44.8 14Z" fill={`url(#${id}-gold)`} />
      <path d="M18 14 25 8.5v2.2L19.4 15.2Z" fill="#FFF6D2" opacity="0.55" />
      <rect x="18" y="27.2" width="29.2" height="3.4" fill={`url(#${id}-gold)`} />
      <circle cx="32.6" cy="28.9" r="4.1" fill={`url(#${id}-ivory)`} />
      <circle cx="32.6" cy="28.9" r="2.1" fill={`url(#${id}-em)`} />
      <path d="M18 14h29.2v16H18Z" fill={`url(#${id}-spec)`} />
    </g>
  );
}

function hadith(id: string) {
  return (
    <g filter={`url(#${id}-drop)`}>
      <ellipse cx="16" cy="34" rx="6.2" ry="15" fill="#021510" />
      <ellipse cx="50" cy="34" rx="6.2" ry="15" fill="#021510" />
      <ellipse cx="15.2" cy="32.4" rx="6" ry="14.2" fill={`url(#${id}-gold)`} />
      <ellipse cx="15.2" cy="32.4" rx="2.3" ry="10.4" fill="#7A5424" />
      <path d="M16 18.4h30v28H16Z" fill={`url(#${id}-ivory)`} />
      <path d="M16 18.4h30v4.2H16Z" fill="#FFFDF8" opacity="0.8" />
      <path d="M21 26.5h18M21 31h18M21 35.5h14" stroke="#0B4B3A" strokeWidth="1.15" strokeLinecap="round" opacity="0.5" />
      <ellipse cx="49.2" cy="32.4" rx="6" ry="14.2" fill={`url(#${id}-em)`} />
      <ellipse cx="49.2" cy="32.4" rx="2.2" ry="10.2" fill={`url(#${id}-gold)`} />
      <path d="M18 19h10c6 2 8 6 8 10" stroke="#FFF6D2" strokeWidth="1.3" fill="none" opacity="0.45" />
    </g>
  );
}

function books(id: string) {
  return (
    <g filter={`url(#${id}-drop)`}>
      <path d="M10 24h11v26H10Z" fill={`url(#${id}-deep)`} />
      <path d="M10 24 14.2 19.2h11L21 24Z" fill={`url(#${id}-em)`} />
      <path d="M12.2 30h6.6M12.2 34h6.6" stroke="#E4C27A" strokeWidth="1" strokeLinecap="round" />
      <path d="M24 16h13v34H24Z" fill={`url(#${id}-ivory)`} />
      <path d="M24 16 28.4 11h13L33 16Z" fill={`url(#${id}-gold)`} />
      <path d="M27 24h7M27 28.5h7M27 33h5" stroke="#0B4B3A" strokeWidth="1.1" strokeLinecap="round" opacity="0.45" />
      <path d="M41 22h12v28H41Z" fill={`url(#${id}-em)`} />
      <path d="M41 22 45.2 17.4h12L53 22Z" fill="#3E9A78" />
      <path d="M43.4 29h7.2M43.4 33.2h7.2" stroke="#FFF6D2" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
    </g>
  );
}

function worship(id: string) {
  return (
    <g filter={`url(#${id}-drop)`}>
      <path d="M14 48h38v5.2H14Z" fill="#021510" />
      <path d="M16 47.2h36v4.2H16Z" fill={`url(#${id}-gold)`} />
      <path d="M12 22h6.2v26H12Z" fill={`url(#${id}-deep)`} />
      <path d="M11.2 22h7.8l-1.2-5.2h-5.4Z" fill={`url(#${id}-gold)`} />
      <circle cx="15.1" cy="15.2" r="1.7" fill={`url(#${id}-gold)`} />
      <path d="M20 47V31.5h28V47Z" fill={`url(#${id}-ivory)`} />
      <path d="M20 31.5c0-9.2 6.2-15.2 14-15.2s14 6 14 15.2Z" fill={`url(#${id}-em)`} />
      <ellipse cx="30" cy="24" rx="7" ry="4.2" fill="#FFFFFF" opacity="0.28" />
      <path d="M30.4 16.4 32 12.2l1.6 4.2-1.6 1.1Z" fill={`url(#${id}-gold)`} />
      <path d="M30 47v-9.2a4 4 0 0 1 8 0V47Z" fill={`url(#${id}-gold)`} />
      <path d="M20 31.5h28v8H20Z" fill={`url(#${id}-spec)`} />
    </g>
  );
}

function podcast(id: string) {
  return (
    <g filter={`url(#${id}-drop)`}>
      <ellipse cx="33" cy="54" rx="13" ry="3.6" fill="#021510" />
      <ellipse cx="32" cy="52.6" rx="11" ry="2.8" fill={`url(#${id}-gold)`} />
      <path d="M30 36h4.2v16H30Z" fill="#7A5424" />
      <path d="M31 36h1.4v16H31Z" fill="#FFF6D2" opacity="0.55" />
      <rect x="20" y="10" width="22" height="28" rx="11" fill="#021510" transform="translate(1.4 1.4)" />
      <rect x="20" y="9" width="22" height="28" rx="11" fill={`url(#${id}-em)`} />
      <rect x="25.2" y="14" width="8.2" height="16" rx="4.1" fill={`url(#${id}-ivory)`} />
      <path d="M23 14c3.2-4 9-4.4 12.4-1.2" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.75" />
      <rect x="18.4" y="20.5" width="25.2" height="4.2" rx="1.4" fill={`url(#${id}-gold)`} />
    </g>
  );
}

function saved(id: string) {
  return (
    <g filter={`url(#${id}-drop)`}>
      <path d="M22 12h22v38l-11-7.2L22 50Z" fill="#021510" transform="translate(2.2 1.6)" />
      <path d="M20 10h22v38l-11-7.2L20 48Z" fill={`url(#${id}-em)`} />
      <path d="M20 10h22v6.2H20Z" fill={`url(#${id}-gold)`} />
      <path d="M22 10h4v6.2h-4Z" fill="#FFF6D2" opacity="0.65" />
      <path d="M25 22h12M25 27h12M25 32h8" stroke="#F6E7C1" strokeWidth="1.35" strokeLinecap="round" />
    </g>
  );
}

function question(id: string) {
  return (
    <g filter={`url(#${id}-drop)`}>
      <circle cx="34" cy="35" r="16.5" fill="#021510" />
      <circle cx="32" cy="32" r="16.5" fill={`url(#${id}-em)`} />
      <circle cx="32" cy="32" r="13.2" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.7" />
      <path d="M27.2 27.2c.2-4.4 9.2-5.2 9.2.4 0 3.1-4.2 3.8-4.2 7.2" stroke="#FFF6D2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="32.2" cy="39.6" r="1.7" fill="#FFF6D2" />
      <path d="M22 22c6-8 16-8 20-2" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4" />
    </g>
  );
}

const MARKS: Record<NavIconName, (id: string) => ReactNode> = {
  knowledge,
  quran,
  hadith,
  books,
  worship,
  podcast,
  saved,
  question,
};

export function NavGlyph({ name }: { name: NavIconName }) {
  const id = `kf-mark-${name}-${useId().replace(/:/g, '')}`;
  return (
    <span className="kf-nav-tile" data-nav-mark={name}>
      <svg viewBox="0 0 64 64" aria-hidden>
        <Materials id={id} />
        <ellipse cx="32" cy="56" rx="16" ry="3.2" fill="#04261C" opacity="0.22" />
        {MARKS[name](id)}
      </svg>
      <span className="kf-nav-sheen" aria-hidden />
    </span>
  );
}

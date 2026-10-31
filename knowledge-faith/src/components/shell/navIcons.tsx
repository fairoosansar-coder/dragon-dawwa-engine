import type { ReactNode } from 'react';

/** Sidebar symbols. One stroke weight, drawn for a 22px tile. */
const ICONS = {
  knowledge: (
    <>
      <path d="M12 6.6c-2.1-1.2-4.5-1.6-7-1.2v12.8c2.5-.4 4.9 0 7 1.3 2.1-1.3 4.5-1.7 7-1.3V5.4c-2.5-.4-4.9.1-7 1.2z" />
      <path d="M12 6.6v12.9" />
    </>
  ),
  quran: (
    <>
      <path d="M6.2 4.8h8A2.8 2.8 0 0 1 17 7.6V19H8.4A2.2 2.2 0 0 0 6.2 21.2V4.8z" />
      <path d="M9.2 8.4h4.8" />
    </>
  ),
  hadith: <path d="M6 6.2h12.2A1.8 1.8 0 0 1 20 8v6.1a1.8 1.8 0 0 1-1.8 1.8H11l-3.5 2.9v-2.9H6A1.8 1.8 0 0 1 4.2 14.1V8A1.8 1.8 0 0 1 6 6.2z" />,
  books: (
    <>
      <path d="M4.4 6.6h4.1v11.8H4.4z" />
      <path d="M8.5 5.2h4.3V18.4H8.5z" />
      <path d="M12.8 6.8h6.6v11.6h-6.6z" />
    </>
  ),
  worship: (
    <>
      <path d="M4 20.4h16" />
      <path d="M7.2 20.4V11.4" />
      <path d="M16.8 20.4V11.4" />
      <path d="M7.2 11.4c0-3.5 2.1-5.8 4.8-5.8s4.8 2.3 4.8 5.8" />
      <path d="M12 5.6V3.6" />
      <path d="M10.8 4h2.4" />
    </>
  ),
  podcast: (
    <>
      <path d="M12 3.8a2.6 2.6 0 0 1 2.6 2.6v4.5a2.6 2.6 0 0 1-5.2 0V6.4A2.6 2.6 0 0 1 12 3.8z" />
      <path d="M8.1 11.1a3.9 3.9 0 0 0 7.8 0" />
      <path d="M12 15v3.1" />
      <path d="M9.3 18.4h5.4" />
    </>
  ),
  saved: <path d="M7.2 4.2h9.6V19l-4.8-2.7L7.2 19z" />,
  question: <path d="M5.2 6.2h13.6V14H9.4l-4.2 3.4V6.2z" />,
} as const;

export type NavIconName = keyof typeof ICONS;

export function NavGlyph({ name }: { name: NavIconName }) {
  return (
    <span className="kf-nav-tile">
      <svg viewBox="0 0 24 24" aria-hidden>
        {ICONS[name] as ReactNode}
      </svg>
    </span>
  );
}

import type { ReactNode } from 'react';
import { useApp } from '../lib/store.tsx';
import { SP, type SpStrings } from './i18n.ts';
import { text, type Copy } from './content.ts';
import { spiritualHref } from '../lib/route.ts';

export function useSp() {
  const app = useApp();
  return { ...app, s: SP[app.lang] };
}

export function PageBack({ segments }: { segments: string[] }) {
  const { s } = useSp();
  const href = segments.length > 1 ? spiritualHref(segments.slice(0, -1)) : spiritualHref();
  return (
    <a href={href} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-dd-emerald hover:bg-dd-gold/15">
      ← {s.back}
    </a>
  );
}

export function Prose({ copy }: { copy: Copy }) {
  const { lang, s } = useSp();
  const value = text(copy, lang);
  if (!value) {
    return (
      <p className="rounded-2xl bg-dd-gold/15 p-3 text-sm">
        {s.missingLang}{' '}
        {copy.en ? (
          <span lang="en" className="mt-2 block">
            <span className="font-semibold">{s.showEnglish}. </span>
            {copy.en}
          </span>
        ) : null}
      </p>
    );
  }
  return (
    <p lang={lang} className="leading-relaxed">
      {value}
    </p>
  );
}

export function Geometry({ name }: { name: string }) {
  const paths = ['M60 18 L72 48 L104 48 L78 66 L88 98 L60 78 L32 98 L42 66 L16 48 L48 48 Z', 'M60 16 A44 44 0 1 1 59.9 16', 'M30 60 H90 M60 30 V90 M38 38 L82 82 M82 38 L38 82'];
  const index = Math.abs([...name].reduce((n, ch) => n + ch.charCodeAt(0), 0)) % paths.length;
  return (
    <svg viewBox="0 0 120 120" className="h-16 w-16 shrink-0" aria-hidden>
      <rect width="120" height="120" rx="28" fill="#064936" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="#C9A14E" strokeWidth="2" />
      <path d={paths[index]} fill="none" stroke="#F3E6C2" strokeWidth="2" />
    </svg>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-dd-emerald/10 bg-white/80 p-5 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-dd-ink/80">
      {label}
      {children}
    </label>
  );
}

export const control = 'min-h-11 rounded-2xl border border-dd-emerald/20 bg-white px-3 text-base text-dd-ink';

export function Banner({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-dd-gold/15 px-4 py-3 text-sm leading-relaxed text-dd-ink">{children}</p>;
}

export function reasonText(s: SpStrings, reason: string): string {
  if (reason === 'specialist_review') return s.specialist;
  if (reason === 'fitr_separate') return s.fitr;
  if (reason === 'missing_price' || reason === 'missing_weight') return s.manualPrice;
  if (reason === 'missing_fx') return s.fxHint;
  return reason.replaceAll('_', ' ');
}

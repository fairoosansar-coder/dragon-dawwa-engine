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

const MARKS: Record<string, string> = {
  shahadah: 'M60 18 L68 46 L96 46 L74 64 L82 94 L60 76 L38 94 L46 64 L24 46 L52 46 Z',
  salah: 'M78 36 A28 28 0 1 0 78 84 A22 22 0 1 1 78 36',
  zakah: 'M60 22 L96 60 L60 98 L24 60 Z',
  fasting: 'M74 28 A30 30 0 1 0 74 92 A22 22 0 1 1 74 28',
  hajj: 'M34 78 V46 H86 V78 M48 78 V58 H72 V78 M60 34 V46',
};

export function Geometry({ name }: { name: string }) {
  const path = MARKS[name] ?? MARKS.shahadah;
  return (
    <svg viewBox="0 0 120 120" className="h-16 w-16 shrink-0" aria-hidden>
      <rect width="120" height="120" rx="28" fill="#064936" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="#C9A14E" strokeWidth="2" />
      <path d={path} fill="none" stroke="#F3E6C2" strokeWidth="2.5" strokeLinejoin="round" />
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

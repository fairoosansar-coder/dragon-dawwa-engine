import type { ReactNode } from 'react';
import { StudioMark, type StudioMarkName } from '../components/shell/studioMarks.tsx';
import { useApp } from '../lib/store.tsx';
import { SP, type SpStrings } from './i18n.ts';
import { text, type Copy } from './content.ts';
import { spiritualHref } from '../lib/route.ts';

export function useSp() {
  const app = useApp();
  return { ...app, s: SP.en };
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

const PILLAR_MARK: Record<string, StudioMarkName> = {
  shahadah: 'shahadah',
  salah: 'salah',
  zakah: 'zakah',
  fasting: 'sawm',
  hajj: 'hajj',
};

export function Geometry({ name, className = 'h-16 w-16 shrink-0 rounded-2xl shadow-sm' }: { name: string; className?: string }) {
  return <StudioMark name={PILLAR_MARK[name] ?? 'shahadah'} className={className} />;
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-dd-emerald/10 bg-parchment p-5 shadow-sm sm:p-6 ${className}`}>{children}</section>;
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

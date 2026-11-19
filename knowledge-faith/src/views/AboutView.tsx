import { ArrowLeft, Info, ShieldCheck } from 'lucide-react';
import { buildStamp } from '../buildStamp.ts';
import { useApp } from '../lib/store.tsx';
import { Card } from '../components/ui.tsx';

export function AboutView() {
  const { t, lang } = useApp();

  return (
    <section data-about-view className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <a
          href="#/hub"
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 shadow-2xs transition hover:bg-stone-50"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
          <span>Back to Knowledge Hub</span>
        </a>
      </div>

      <Card>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pine">
          <Info className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
          <span>About & Reference Notes</span>
        </div>

        <h1 className="mt-1.5 text-base font-bold text-stone-900 sm:text-lg">
          DRAGON DAWWA · {t.brandSub}
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-stone-700">
          {t.sourcesNote}
        </p>

        <p className="mt-2 rounded-xl border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-950">
          {t.uiNote}
        </p>

        {lang !== 'en' && (
          <p className="mt-1.5 text-[11px] text-stone-500">
            Active interface language: {lang.toUpperCase()}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/70 pt-3 text-[11px] text-stone-500">
          <span className="inline-flex items-center gap-1 font-medium text-stone-700">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            <span>Institutional Research & Verification Engine</span>
          </span>
          <span
            data-release={buildStamp.sha}
            data-built-at={buildStamp.builtAt}
            className="font-mono text-[11px] text-stone-500"
          >
            {buildStamp.sha.slice(0, 7)} · {buildStamp.builtAt}
          </span>
        </div>
      </Card>
    </section>
  );
}

export default AboutView;

import type { ReactNode } from 'react';
import { Award, Radio } from 'lucide-react';
import { ArchBanner } from './ds/ornaments.tsx';
import { EngineFrame } from './EngineFrame.tsx';

/** Same action-row classes as the hadith dossier, so every desk shares that row. */
export const fullReportActionClass =
  'inline-flex items-center gap-2 rounded-xl border border-amber-500 bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer shadow-md';

export const roundtableActionClass =
  'inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-500/60 cursor-pointer';

export function ResearchActionRow({ onFullReport, onRoundtable }: { onFullReport: () => void; onRoundtable: () => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button type="button" data-testid="open-full-report-btn" className={fullReportActionClass} onClick={onFullReport}>
        <Award className="h-4 w-4 text-amber-400" aria-hidden /> Open Full Report
      </button>
      <button type="button" data-testid="open-roundtable-btn" className={roundtableActionClass} onClick={onRoundtable}>
        <Radio className="h-4 w-4 text-emerald-400" aria-hidden /> Open Roundtable
      </button>
    </div>
  );
}

/**
 * Shared research chrome: gold border, calligraphy header, Full Report / Roundtable row,
 * then a slot for the desk’s own inputs.
 */
export function ResearchFrame({
  title,
  arabic,
  subtitle,
  actions,
  children,
  after,
}: {
  title: string;
  arabic?: string;
  subtitle?: string;
  actions: ReactNode;
  children: ReactNode;
  after?: ReactNode;
}) {
  return (
    <div data-research-frame>
      <EngineFrame className="space-y-6 rounded-3xl border-2 border-[var(--gold-leaf)]">
        <ArchBanner title={title} arabic={arabic} subtitle={subtitle}>
          {actions}
        </ArchBanner>
        <div data-research-inputs>{children}</div>
        {after}
      </EngineFrame>
    </div>
  );
}

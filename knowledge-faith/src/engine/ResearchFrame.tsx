import type { ReactNode } from 'react';
import { Award, Radio } from 'lucide-react';
import { ArchBanner } from './ds/ornaments.tsx';
import { EngineFrame } from './EngineFrame.tsx';

/** Same action-row classes as the hadith dossier, so every desk shares that row. */
export const fullReportActionClass =
  'inline-flex items-center gap-2 rounded-xl border border-[#E6C665] bg-[#F6F1E4] px-4 py-2 text-xs font-bold text-[#123A2E] hover:bg-[#F9E7B9] cursor-pointer shadow-md';

export const roundtableActionClass =
  'inline-flex items-center gap-2 rounded-xl border border-[#E6C665]/80 bg-[#041B14]/80 px-3 py-2 text-xs font-semibold text-[#F9E7B9] hover:border-[#E6C665] cursor-pointer';

export function ResearchActionRow({ onFullReport, onRoundtable }: { onFullReport: () => void; onRoundtable: () => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button type="button" data-testid="open-full-report-btn" className={fullReportActionClass} onClick={onFullReport}>
        <Award className="h-4 w-4" aria-hidden /> Open Full Report
      </button>
      <button type="button" data-testid="open-roundtable-btn" className={roundtableActionClass} onClick={onRoundtable}>
        <Radio className="h-4 w-4" aria-hidden /> Open Roundtable
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

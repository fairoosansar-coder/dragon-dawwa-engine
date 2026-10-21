import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Trash2 } from 'lucide-react';
import { findTopic } from '../../shared/spiritual/catalog.ts';
import { fmt } from '../../lib/i18nSpiritual.ts';
import { formatAmount, formatInstant, spHref } from '../../lib/spiritualFormat.ts';
import { downloadText, useSavedCalculations, useSp } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Panel, SectionBand, SpButton } from '../../components/spiritual/ornaments.tsx';
import { ResultView } from './ZakahCalculatorView.tsx';

export default function SavedCalculationsView() {
  const { s, lang } = useSp();
  const [saved, setSaved] = useSavedCalculations();
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${s.scTitle} · ${s.title} · ${s.brand}`;
  }, [s]);

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { href: spHref('zakah'), label: findTopic('zakah')!.title[lang] }, { label: s.scTitle }]} />
      <SectionBand title={s.scTitle} topic="zakah" />
      <div className="space-y-4">
        <Callout tone="privacy">{s.privacyFooter}</Callout>
        {saved.length === 0 && (
          <Panel>
            <p className="text-sm text-ink/70">{s.scEmpty}</p>
            <a href={spHref('zakah/calculator')} className="mt-3 inline-block text-sm font-semibold text-lapis underline">
              {s['tool_zakah-calculator']} →
            </a>
          </Panel>
        )}
        {saved.map(c => {
          const expanded = open === c.id;
          return (
            <Panel key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-emerald">{c.name}</h2>
                  <p className="text-xs text-ink/60">{fmt(s.scSavedOn, { date: formatInstant(lang, c.savedAt) })}</p>
                  <p className="mt-1 text-sm">
                    {c.result.status === 'due' ? s.zkDue : s.zkNotDue}:{' '}
                    <span className="font-semibold tabular-nums">{formatAmount(lang, c.result.zakahDue, c.result.currency)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SpButton variant="soft" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.id)}>
                    {expanded ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />} {expanded ? s.close : s.open}
                  </SpButton>
                  <SpButton variant="soft" onClick={() => downloadText(`zakah-${c.result.valuationDate}.json`, JSON.stringify(c, null, 2), 'application/json')}>
                    <Download className="h-4 w-4" aria-hidden /> {s.zkExport}
                  </SpButton>
                  <SpButton variant="danger" onClick={() => window.confirm(s.scConfirmDelete) && setSaved(list => list.filter(x => x.id !== c.id))}>
                    <Trash2 className="h-4 w-4" aria-hidden /> {s.delete}
                  </SpButton>
                </div>
              </div>
              {expanded && (
                <div className="mt-5">
                  <ResultView result={c.result} />
                </div>
              )}
            </Panel>
          );
        })}
        {saved.length > 0 && (
          <SpButton variant="danger" onClick={() => window.confirm(s.scConfirmDeleteAll) && setSaved([])}>
            <Trash2 className="h-4 w-4" aria-hidden /> {s.scDeleteAll}
          </SpButton>
        )}
      </div>
    </div>
  );
}
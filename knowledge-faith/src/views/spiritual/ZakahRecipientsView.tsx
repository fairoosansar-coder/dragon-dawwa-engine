import { useEffect } from 'react';
import { findTopic } from '../../shared/spiritual/catalog.ts';
import { q } from '../../shared/spiritual/sourceRefs.ts';
import { spHref, useGuideIndex } from '../../lib/spiritualFormat.ts';
import { useSp } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Panel, PanelTitle, SectionBand, StatusBadge } from '../../components/spiritual/ornaments.tsx';
import { SourceList } from '../../components/spiritual/sources.tsx';

const REFS = [q('9:60')];

export default function ZakahRecipientsView() {
  const { s, lang } = useSp();
  const index = useGuideIndex();
  const topic = findTopic('zakah')!;
  const guide = topic.groups.flatMap(g => g.guides).find(g => g.slug === 'zakah-recipients')!;
  const entry = index.data?.[guide.slug];

  useEffect(() => {
    document.title = `${s.rcTitle} · ${s.title} · ${s.brand}`;
  }, [s]);

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { href: spHref('zakah'), label: topic.title[lang] }, { label: s.rcTitle }]} />
      <SectionBand title={s.rcTitle} subtitle={s.rcHint} topic="zakah" />
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Panel>
          <PanelTitle sub={s.selectionPending}>{s.primaryTexts}</PanelTitle>
          <SourceList refs={REFS} />
        </Panel>
        <div className="space-y-4">
          <Callout tone="privacy">{s.rcNoPay}</Callout>
          <Panel>
            <PanelTitle as="h3">{s.guidesTitle}</PanelTitle>
            <a href={spHref(`guide/${guide.slug}`)} className="block rounded-2xl bg-ivory px-4 py-3 hover:bg-vellum">
              <span className="block font-medium text-emerald">{guide.title[lang]}</span>
              <span className="mt-1 block">
                <StatusBadge status={entry?.status ?? 'in-preparation'} scholarReviewed={entry?.scholarReviewed ?? false} />
              </span>
            </a>
          </Panel>
        </div>
      </div>
    </div>
  );
}

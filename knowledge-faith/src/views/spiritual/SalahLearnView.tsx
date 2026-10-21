import { useEffect, useMemo } from 'react';
import { findTopic } from '../../shared/spiritual/catalog.ts';
import { q } from '../../shared/spiritual/sourceRefs.ts';
import { spHref, useGuideIndex } from '../../lib/spiritualFormat.ts';
import { useLocal, PREFIX, useSp } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Panel, PanelTitle, Pill, SectionBand, StatusBadge } from '../../components/spiritual/ornaments.tsx';
import { SourceList } from '../../components/spiritual/sources.tsx';

const BEGINNER = ['wudu', 'salah-preparation', 'salah-sequence', 'salah-recitations', 'salah-accessible'];
const RECITATIONS = [q('1:1-7'), q('112:1-4')];

export default function SalahLearnView() {
  const { s, lang } = useSp();
  const [mode, setMode] = useLocal<'beginner' | 'detailed'>(`${PREFIX}salah-mode`, 'beginner');
  const index = useGuideIndex();
  const topic = findTopic('salah')!;

  useEffect(() => {
    document.title = `${s.slTitle} · ${s.title} · ${s.brand}`;
  }, [s]);

  const guides = useMemo(() => {
    const all = topic.groups.flatMap(g => g.guides);
    if (mode === 'detailed') return all;
    return BEGINNER.map(slug => all.find(g => g.slug === slug)!).filter(Boolean);
  }, [mode, topic]);

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { href: spHref('salah'), label: topic.title[lang] }, { label: s.slTitle }]} />
      <SectionBand title={s.slTitle} subtitle={mode === 'beginner' ? s.slBeginnerHint : s.slDetailedHint} topic="salah" arabic={topic.arabic}>
        <div role="group" aria-label={s.slMode} className="flex flex-wrap gap-2">
          <Pill active={mode === 'beginner'} onClick={() => setMode('beginner')}>
            {s.slBeginner}
          </Pill>
          <Pill active={mode === 'detailed'} onClick={() => setMode('detailed')}>
            {s.slDetailed}
          </Pill>
        </div>
      </SectionBand>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Panel>
            <PanelTitle>{s.guidesTitle}</PanelTitle>
            <ol className="space-y-2">
              {guides.map((g, i) => {
                const entry = index.data?.[g.slug];
                return (
                  <li key={g.slug}>
                    <a href={spHref(`guide/${g.slug}`)} className="flex items-start gap-3 rounded-2xl bg-ivory px-4 py-3 hover:bg-vellum">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald text-xs font-bold text-ivory">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-emerald">{g.title[lang]}</span>
                        <span className="mt-1 block">
                          <StatusBadge status={entry?.status ?? 'in-preparation'} scholarReviewed={entry?.scholarReviewed ?? false} />
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </Panel>
          <Panel>
            <PanelTitle>{s.slPostures}</PanelTitle>
            <Callout tone="info">{s.slPosturesNone}</Callout>
          </Panel>
        </div>
        <Panel>
          <PanelTitle sub={s.slRecitationAudio}>{s.slRecitations}</PanelTitle>
          <SourceList refs={RECITATIONS} compact />
        </Panel>
      </div>
    </div>
  );
}

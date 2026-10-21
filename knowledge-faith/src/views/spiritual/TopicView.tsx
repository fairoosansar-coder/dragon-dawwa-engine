import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { findTopic, TOOL_ROUTES, type TopicId } from '../../shared/spiritual/catalog.ts';
import { OCCASIONS } from '../../shared/spiritual/calendar.ts';
import { fmt, type SpKey } from '../../lib/i18nSpiritual.ts';
import { spHref, useGuideIndex } from '../../lib/spiritualFormat.ts';
import { useBookmarks, useSp } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Callout, Panel, PanelTitle, SectionBand, StatusBadge } from '../../components/spiritual/ornaments.tsx';
import { SourceList } from '../../components/spiritual/sources.tsx';
import { StudyAssistant } from '../../components/spiritual/StudyAssistant.tsx';

export const OFFICIAL_PILGRIMAGE_SOURCES = [
  { name: 'Nusuk — official platform for Hajj and Umrah', url: 'https://www.nusuk.sa/' },
  { name: 'Ministry of Hajj and Umrah, Kingdom of Saudi Arabia', url: 'https://www.haj.gov.sa/' },
  { name: 'Department of Muslim Religious and Cultural Affairs, Sri Lanka', url: 'https://www.muslimaffairs.gov.lk/' },
];

export function OfficialSources() {
  const { s } = useSp();
  return (
    <div>
      <Callout tone="caution">{s.logisticsNote}</Callout>
      <h3 className="mb-2 mt-4 text-sm font-semibold text-emerald">{s.officialSources}</h3>
      <ul className="space-y-1.5 text-sm">
        {OFFICIAL_PILGRIMAGE_SOURCES.map(o => (
          <li key={o.url}>
            <a href={o.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-lapis underline-offset-2 hover:underline">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> {o.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TopicView({ id }: { id: TopicId }) {
  const { s, lang } = useSp();
  const topic = findTopic(id)!;
  const index = useGuideIndex();
  const [bookmarks] = useBookmarks();

  useEffect(() => {
    document.title = `${topic.title[lang]} · ${s.title} · ${s.brand}`;
  }, [topic, lang, s]);

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { label: topic.title[lang] }]} />
      <SectionBand
        title={topic.title[lang]}
        subtitle={topic.pillar ? `${fmt(s.pillarN, { n: topic.pillar })} · ${topic.subtitle[lang]}` : topic.subtitle[lang]}
        arabic={topic.arabic}
        topic={topic.id}
      >
        {topic.tools.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label={s.toolsTitle}>
            {topic.tools.map(tool => (
              <li key={tool}>
                <a href={spHref(TOOL_ROUTES[tool])} className="inline-block rounded-full bg-ivory px-4 py-2 text-sm font-semibold text-emerald hover:bg-vellum">
                  {s[`tool_${tool}` as SpKey]}
                </a>
              </li>
            ))}
          </ul>
        )}
      </SectionBand>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          {topic.groups.map(group => (
            <Panel key={group.id}>
              <PanelTitle>{group.title[lang]}</PanelTitle>
              <ol className="divide-y divide-emerald/10">
                {group.guides.map((g, i) => {
                  const entry = index.data?.[g.slug];
                  return (
                    <li key={g.slug}>
                      <a href={spHref(`guide/${g.slug}`)} className="group flex items-start gap-3 py-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ivory text-xs font-bold text-gilt-deep ring-1 ring-gilt/40">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-emerald group-hover:underline">
                            {g.title[lang]}
                            {bookmarks.includes(g.slug) && <span className="sr-only"> · {s.bookmarked}</span>}
                          </span>
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
          ))}
          {id === 'fasting' && (
            <Panel>
              <PanelTitle sub={s.fcDisclaimer}>{s.fastingOccasions}</PanelTitle>
              <ul className="grid gap-2 sm:grid-cols-2">
                {OCCASIONS.map(o => (
                  <li key={o.id} className="rounded-2xl bg-ivory px-4 py-2.5">
                    <span className="block text-sm font-semibold text-emerald">{s[`oc_${o.id}` as SpKey]}</span>
                    <span className="block text-xs text-ink/60">
                      {s[`status_${o.kind}` as SpKey]} · {s[o.dateBasisKey as SpKey]}
                    </span>
                  </li>
                ))}
              </ul>
              <a href={spHref('fasting/calendar')} className="mt-3 inline-block text-sm font-semibold text-lapis underline">
                {s.tool_calendar} →
              </a>
            </Panel>
          )}
          {(id === 'hajj' || id === 'umrah') && (
            <Panel>
              <OfficialSources />
            </Panel>
          )}
          <StudyAssistant topic={topic.id} />
        </div>
        <div className="space-y-4">
          {id === 'zakah' && <Callout tone="privacy">{s.zkNoPayments}</Callout>}
          <Panel>
            <PanelTitle sub={s.selectionPending}>{s.primaryTexts}</PanelTitle>
            <SourceList refs={topic.sources} compact />
          </Panel>
        </div>
      </div>
    </div>
  );
}

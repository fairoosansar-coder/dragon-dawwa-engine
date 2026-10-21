import { useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { DUAS, findGuide } from '../../shared/spiritual/catalog.ts';
import { formatAmount, formatInstant, spHref } from '../../lib/spiritualFormat.ts';
import {
  deleteSectionData,
  downloadText,
  exportSectionData,
  useBookmarks,
  useQuestions,
  useSavedCalculations,
  useSp,
} from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Panel, PanelTitle, SectionBand, SpButton } from '../../components/spiritual/ornaments.tsx';
import { SourceList } from '../../components/spiritual/sources.tsx';
import { duaBookmark } from './DuaDhikrView.tsx';

export default function SavedView() {
  const { s, lang } = useSp();
  const [bookmarks, setBookmarks] = useBookmarks();
  const [questions] = useQuestions();
  const [calcs] = useSavedCalculations();
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    document.title = `${s.svTitle} · ${s.title} · ${s.brand}`;
  }, [s]);

  const guides = bookmarks.map(b => findGuide(b)).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const duas = DUAS.filter(d => bookmarks.includes(duaBookmark(d.id)));
  const empty = <p className="text-sm text-ink/60">{s.svEmpty}</p>;

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { label: s.svTitle }]} />
      <SectionBand title={s.svTitle} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Panel>
            <PanelTitle as="h3">{s.svGuides}</PanelTitle>
            {guides.length === 0 ? (
              empty
            ) : (
              <ul className="divide-y divide-emerald/10">
                {guides.map(g => (
                  <li key={g.guide.slug} className="flex items-center justify-between gap-3 py-2.5">
                    <a href={spHref(`guide/${g.guide.slug}`)} className="font-medium text-emerald hover:underline">
                      {g.guide.title[lang]}
                    </a>
                    <button
                      type="button"
                      aria-label={`${s.remove}: ${g.guide.title[lang]}`}
                      className="text-red-800"
                      onClick={() => setBookmarks(b => b.filter(x => x !== g.guide.slug))}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <PanelTitle as="h3">{s.svDuas}</PanelTitle>
            {duas.length === 0 ? empty : <SourceList refs={duas.map(d => d.source)} compact />}
            {duas.length > 0 && (
              <a href={spHref('dua-dhikr')} className="mt-3 inline-block text-sm font-semibold text-lapis underline">
                {s.dTitle} →
              </a>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel>
            <PanelTitle as="h3">{s.svQuestions}</PanelTitle>
            {questions.length === 0 ? (
              empty
            ) : (
              <ul className="space-y-1 text-sm">
                {questions.map(q => (
                  <li key={q.id} className="truncate">
                    {q.question || '—'}
                  </li>
                ))}
              </ul>
            )}
            <a href={spHref('questions')} className="mt-3 inline-block text-sm font-semibold text-lapis underline">
              {s.qTitle} →
            </a>
          </Panel>
          <Panel>
            <PanelTitle as="h3">{s.svCalcs}</PanelTitle>
            {calcs.length === 0 ? (
              empty
            ) : (
              <ul className="space-y-1 text-sm">
                {calcs.map(c => (
                  <li key={c.id}>
                    <span className="font-medium">{c.name}</span> · {formatAmount(lang, c.result.zakahDue, c.result.currency)} ·{' '}
                    <span className="text-ink/55">{formatInstant(lang, c.savedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <a href={spHref('zakah/calculations')} className="mt-3 inline-block text-sm font-semibold text-lapis underline">
              {s.scTitle} →
            </a>
          </Panel>
          <Panel>
            <PanelTitle as="h3" sub={s.svPrivacyHint}>
              {s.svPrivacy}
            </PanelTitle>
            <div className="flex flex-wrap gap-2">
              <SpButton variant="soft" onClick={() => downloadText('dragon-dawwa-five-pillars.json', exportSectionData(), 'application/json')}>
                <Download className="h-4 w-4" aria-hidden /> {s.svExport}
              </SpButton>
              <SpButton
                variant="danger"
                onClick={() => {
                  if (!window.confirm(s.svConfirmDeleteAll)) return;
                  deleteSectionData();
                  setDeleted(true);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden /> {s.svDeleteAll}
              </SpButton>
            </div>
            {deleted && (
              <p role="status" className="mt-2 text-sm text-emerald">
                {s.svDeleted}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

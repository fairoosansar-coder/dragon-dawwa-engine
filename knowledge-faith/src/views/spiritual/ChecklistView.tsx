import { useEffect } from 'react';
import { CHECKLISTS, findTopic } from '../../shared/spiritual/catalog.ts';
import { todayIn } from '../../shared/spiritual/calendar.ts';
import type { SpKey } from '../../lib/i18nSpiritual.ts';
import { formatIso, spHref } from '../../lib/spiritualFormat.ts';
import { deviceTimeZone, useChecklists, useSp } from '../../lib/spiritualStore.ts';
import { Breadcrumbs, Panel, PanelTitle, SectionBand, SpButton } from '../../components/spiritual/ornaments.tsx';
import { OfficialSources } from './TopicView.tsx';

export default function ChecklistView({ kind }: { kind: 'hajj' | 'umrah' }) {
  const { s, lang } = useSp();
  const [all, setAll] = useChecklists();
  const state = all[kind] ?? {};
  const topic = findTopic(kind)!;
  const title = s[`ckTitle_${kind}`];

  useEffect(() => {
    document.title = `${title} · ${s.title} · ${s.brand}`;
  }, [title, s]);

  const toggle = (id: string, done: boolean) =>
    setAll(a => ({ ...a, [kind]: { ...(a[kind] ?? {}), [id]: done ? { done, checkedOn: todayIn(deviceTimeZone()) } : { done } } }));

  const group = (k: 'learning' | 'logistics') => (
    <Panel>
      <PanelTitle as="h3">{k === 'learning' ? s.ckLearning : s.ckLogistics}</PanelTitle>
      <ul className="space-y-2">
        {CHECKLISTS[kind]
          .filter(i => i.kind === k)
          .map(item => {
            const st = state[item.id];
            return (
              <li key={item.id}>
                <label className="flex items-start gap-3 rounded-2xl bg-ivory/60 px-4 py-3 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={Boolean(st?.done)} onChange={e => toggle(item.id, e.target.checked)} />
                  <span className="flex-1">
                    <span className={st?.done ? 'text-ink/60' : ''}>{s[item.labelKey as SpKey]}</span>
                    {st?.done && st.checkedOn && (
                      <span className="block text-xs text-ink/55">
                        {s.ckChecked} {formatIso(lang, st.checkedOn)}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
      </ul>
    </Panel>
  );

  return (
    <div>
      <Breadcrumbs items={[{ href: spHref(), label: s.sectionHome }, { href: spHref(kind), label: topic.title[lang] }, { label: title }]} />
      <SectionBand title={title} subtitle={s.ckHint} topic={kind} arabic={topic.arabic} />
      <div className="grid gap-6 lg:grid-cols-2">
        {group('learning')}
        {group('logistics')}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <OfficialSources />
        </Panel>
        <div>
          <SpButton
            variant="danger"
            onClick={() =>
              setAll(a => {
                const next = { ...a };
                delete next[kind];
                return next;
              })
            }
          >
            {s.ckReset}
          </SpButton>
        </div>
      </div>
    </div>
  );
}

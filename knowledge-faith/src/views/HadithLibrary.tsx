import { lazy, Suspense, useState, type FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ViewProps } from '../App.tsx';
import { HADITH_COLLECTIONS } from '../shared/sources.ts';
import type { Hadith, HadithSection } from '../shared/types.ts';
import { useRemote } from '../lib/api.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { HadithCard } from '../components/cards.tsx';
import { Button, Card, ErrorNote, Loading, Notice, SectionTitle, TabLinks } from '../components/ui.tsx';

const PAGE = 15;

function SectionReader({ collection, section, onBack }: { collection: string; section: HadithSection; onBack: () => void }) {
  const { t, lang } = useApp();
  const [shown, setShown] = useState(PAGE);
  const { data, error, loading, reload } = useRemote<Hadith[]>(`/api/hadith/${collection}/section/${section.id}?lang=${lang}`);
  return (
    <>
      <Button variant="ghost" onClick={onBack} className="-ml-3 mb-2">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t.books}
      </Button>
      <SectionTitle sub={`${section.first}–${section.last}`}>
        {section.id}. {section.title}
      </SectionTitle>
      {loading && <Loading />}
      {error && <ErrorNote message={error} onRetry={reload} />}
      {data?.slice(0, shown).map(h => <HadithCard key={h.number} hadith={h} />)}
      {data && shown < data.length && (
        <div className="mt-4 text-center">
          <Button variant="soft" onClick={() => setShown(s => s + PAGE)}>
            {data.length - shown} more
          </Button>
        </div>
      )}
    </>
  );
}

function Lookup({ collection }: { collection: string }) {
  const { t, lang } = useApp();
  const [input, setInput] = useState('');
  const [number, setNumber] = useState<number | null>(null);
  const { data, error, loading } = useRemote<Hadith>(number ? `/api/hadith/${collection}/${number}?lang=${lang}` : null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(input);
    if (Number.isInteger(n) && n > 0) setNumber(n);
  }

  return (
    <div className="mb-6">
      <form onSubmit={submit} className="flex gap-2">
        <label className="sr-only" htmlFor="hadith-number">
          {t.findHadith}
        </label>
        <input
          id="hadith-number"
          inputMode="numeric"
          value={input}
          onChange={e => setInput(e.target.value.replace(/\D/g, ''))}
          placeholder={t.findHadith}
          className="w-48 rounded-full border border-pine/20 bg-white px-4 py-2 text-sm"
        />
        <Button type="submit" variant="soft">
          {t.go}
        </Button>
      </form>
      {loading && <Loading />}
      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}
      {data && <HadithCard hadith={data} />}
    </div>
  );
}

const DossierWorkbench = lazy(() => import('../engine/DossierWorkbench.tsx'));

export default function HadithLibrary({ sub }: ViewProps) {
  const { t } = useApp();
  const research = sub === 'research';
  return (
    <>
      <TabLinks
        label={t.navHadith}
        tabs={[
          { href: '#/hadith', label: t.browseHadith, active: !research },
          { href: '#/hadith/research', label: t.researchHadith, active: research },
        ]}
      />
      {research ? (
        <Suspense fallback={<Loading />}>
          <DossierWorkbench />
        </Suspense>
      ) : (
        <CollectionBrowser />
      )}
    </>
  );
}

function CollectionBrowser() {
  const { t, lang } = useApp();
  const [collection, setCollection] = useStored<string>('kf-collection', 'bukhari');
  const [section, setSection] = useState<HadithSection | null>(null);
  const [filter, setFilter] = useState('');
  const index = useRemote<{ sections: HadithSection[]; last: number }>(`/api/hadith/${collection}/sections`);
  const info = HADITH_COLLECTIONS.find(c => c.id === collection) ?? HADITH_COLLECTIONS[0];
  const sections = (index.data?.sections ?? []).filter(s => s.title.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card className="lg:p-4">
        <h2 className="font-display text-xl font-bold text-pine">{t.collections}</h2>
        <ul className="mt-3 space-y-1">
          {HADITH_COLLECTIONS.map(c => (
            <li key={c.id}>
              <button
                type="button"
                aria-current={c.id === collection ? 'true' : undefined}
                onClick={() => {
                  setCollection(c.id);
                  setSection(null);
                  setFilter('');
                }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${c.id === collection ? 'bg-pine text-white' : 'hover:bg-mint'}`}
              >
                {c.name}
                {c.tamil && <span className="ml-2 text-xs opacity-70">EN · தமிழ்</span>}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        {section ? (
          <SectionReader collection={collection} section={section} onBack={() => setSection(null)} />
        ) : (
          <>
            <SectionTitle sub={index.data ? `1–${index.data.last}` : undefined}>{info.name}</SectionTitle>
            {lang !== 'en' && !(lang === 'ta' && info.tamil) && <Notice>{t.fallbackEnglish}</Notice>}
            <div className="mt-4">
              <Lookup key={collection} collection={collection} />
            </div>
            <h3 className="mb-2 font-display text-lg font-bold text-pine">{t.books}</h3>
            <input
              type="search"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              aria-label={t.books}
              placeholder="…"
              className="mb-3 w-full rounded-full border border-pine/20 bg-white px-4 py-2 text-sm"
            />
            {index.loading && <Loading />}
            {index.error && <ErrorNote message={index.error} onRetry={index.reload} />}
            <ul className="grid gap-2 sm:grid-cols-2">
              {sections.map(s => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSection(s)}
                    className="flex w-full items-start gap-3 rounded-2xl border border-pine/10 bg-white p-3 text-left text-sm hover:border-pine/40"
                  >
                    <span className="w-8 shrink-0 text-xs font-semibold text-gold">{s.id}</span>
                    <span className="flex-1">
                      <span className="block font-medium">{s.title}</span>
                      <span className="text-xs text-ink/50">
                        {s.first}–{s.last}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

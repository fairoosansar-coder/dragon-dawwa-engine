import { useRemote } from '../lib/api.ts';
import type { NamesCatalogue } from '../shared/nameRecords.ts';
import { ErrorNote, Loading, Notice } from '../components/ui.tsx';
import { PageBack, Panel, useSp } from './chrome.tsx';

export function NamesView({ segments }: { segments: string[] }) {
  const { lang, s, t } = useSp();
  const remote = useRemote<NamesCatalogue>('/api/names');
  const terms = remote.data?.terminology.status === 'ok' ? remote.data.terminology.terms : [];
  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dd-emerald">{s.notReviewed}</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-dd-emerald sm:text-5xl">Names of Allah</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed">
          Each name opens its own page. Arabic, a published transliteration, and the meaning printed by the source stay attached to that record.
        </p>
        {lang !== 'en' && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-dd-ink/70">{t.namesEnglishOnly}</p>}
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-dd-ink/70">{t.namesCatalogueGap}</p>
        {remote.loading && !remote.data && <Loading />}
        {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
        {remote.data && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-dd-ink/70">{remote.data.note}</p>}
        {remote.data?.terminology.status === 'unavailable' && (
          <div className="mt-4">
            <Notice>TerminologyEnc is unavailable. {remote.data.terminology.message} The names are not treated as unknown.</Notice>
          </div>
        )}
        {remote.data?.aladhan.status === 'unavailable' && (
          <div className="mt-4">
            <Notice>Aladhan is unavailable. {remote.data.aladhan.message}</Notice>
          </div>
        )}
        {terms.length > 0 && (
          <ol className="mt-8 space-y-4">
            {terms.map(term => (
              <li key={term.id}>
                <a href={`#/spiritual/names/${term.id}`} className="block rounded-2xl px-1 py-2 hover:bg-dd-gold/10">
                  <p lang="ar" dir="rtl" className="text-3xl leading-relaxed text-dd-ink">
                    {term.arabic}
                  </p>
                  <p className="mt-1 text-lg">{term.transliteration}</p>
                  {term.titleMeaning && <p className="text-sm text-dd-ink/70">{term.titleMeaning}</p>}
                </a>
              </li>
            ))}
          </ol>
        )}
        {remote.data?.aladhan.status === 'ok' && remote.data.aladhan.unmatched.length > 0 && (
          <details className="mt-10">
            <summary className="cursor-pointer text-sm font-semibold text-dd-emerald">
              Aladhan records with no terminology match ({remote.data.aladhan.unmatched.length})
            </summary>
            <ul className="mt-4 space-y-4">
              {remote.data.aladhan.unmatched.map(name => (
                <li key={name.number}>
                  <p lang="ar" dir="rtl" className="text-2xl">
                    {name.arabic}
                  </p>
                  <p className="text-sm">
                    {name.number}. {name.transliteration}. {name.meaning}
                  </p>
                  <p className="text-xs text-dd-ink/60">Aladhan English meaning. Not matched to a terminology page.</p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Panel>
    </div>
  );
}

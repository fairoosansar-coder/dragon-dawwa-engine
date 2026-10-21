import { useRemote } from '../lib/api.ts';
import type { AsmaCollection } from '../shared/types.ts';
import { PageBack, Panel, useSp } from './chrome.tsx';

export function NamesView({ segments }: { segments: string[] }) {
  const { lang, s, t } = useSp();
  const remote = useRemote<AsmaCollection>('/api/asma');
  return (
    <div className="space-y-4">
      <PageBack segments={segments} />
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dd-emerald">{s.notReviewed}</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-dd-emerald sm:text-5xl">{t.namesTitle}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed">{t.namesLede}</p>
        {lang !== 'en' && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-dd-ink/70">{t.namesEnglishOnly}</p>}
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-dd-ink/70">{t.namesCatalogueGap}</p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-dd-ink/70">{t.namesScriptUnavailable}</p>
        {remote.loading && <p className="mt-8">{s.loading}</p>}
        {remote.error && (
          <p className="mt-8">
            {t.namesUnavailable} {remote.error}{' '}
            <button type="button" className="underline" onClick={remote.reload}>
              {s.retry}
            </button>
          </p>
        )}
        {remote.data && (
          <>
            <ol className="mt-10 space-y-10">
              {remote.data.names.map(name => (
                <li key={name.number} className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dd-ink/50">{name.number}</p>
                  <p lang="ar" className="mt-3 text-3xl leading-relaxed text-dd-ink">
                    {name.arabic}
                  </p>
                  <p lang="en" className="mt-3 text-lg leading-relaxed">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-dd-ink/50">{t.namesLatin}. </span>
                    {name.transliteration}
                  </p>
                  <p lang="en" className="mt-2 text-lg leading-relaxed">
                    {name.meaning}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-12 max-w-2xl space-y-3 text-sm leading-relaxed text-dd-ink/70">
              <p>{t.namesAttribution}</p>
              <p>{t.namesNoReference}</p>
              <p>{t.pronunciationNote}</p>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

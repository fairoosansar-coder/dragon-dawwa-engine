import { useRemote } from '../lib/api.ts';
import type { NameDetail as NameRecord } from '../shared/nameRecords.ts';
import { ErrorNote, Loading, Notice } from '../components/ui.tsx';
import { Panel } from './chrome.tsx';

export function NameDetail({ id }: { id: string }) {
  const remote = useRemote<NameRecord>(/^\d{1,12}$/.test(id) ? `/api/names/${id}` : null);
  const name = remote.data && remote.data.id === id ? remote.data : null;
  return (
    <div className="space-y-4">
      <a href="#/spiritual/names" className="inline-flex min-h-11 items-center text-sm font-medium text-dd-emerald">
        ← Names of Allah
      </a>
      {remote.loading && !name && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {name && (
        <Panel>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dd-emerald">TerminologyEnc {name.id}</p>
          <p lang="ar" dir="rtl" className="mt-4 text-5xl leading-relaxed text-dd-ink">
            {name.arabic}
          </p>
          <p className="mt-4 text-lg">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-dd-ink/50">Published transliteration. </span>
            {name.transliteration}
          </p>
          {name.titleMeaning && <p className="mt-2 text-lg">{name.titleMeaning}</p>}
          {name.aladhan && (
            <p className="mt-4 text-sm leading-relaxed text-dd-ink/80">
              Aladhan {name.aladhan.number}, matched by Arabic name: {name.aladhan.transliteration}. {name.aladhan.meaning}
              {name.transliterationsDiffer ? ' The two published transliterations are both shown. A difference in spelling is not recorded as scholarly disagreement.' : ''}
            </p>
          )}
          {!name.aladhan && <p className="mt-4 text-sm text-dd-ink/70">No Aladhan record matched this Arabic name. The list was not padded to 99.</p>}

          <section className="mt-8 space-y-3">
            <h2 className="font-display text-2xl font-bold text-dd-emerald">Brief meaning</h2>
            {name.article.brief.map(field => (
              <p key={field.language} lang={field.language} dir={field.language === 'ar' ? 'rtl' : undefined} className="leading-relaxed">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-dd-ink/50">{field.language}. Published. </span>
                {field.text}
              </p>
            ))}
            {name.article.unavailableLanguages.length > 0 && (
              <Notice>
                No published short definition was on this page for: {name.article.unavailableLanguages.join(', ')}. Nothing was generated to fill that gap.
              </Notice>
            )}
          </section>

          <details className="mt-8 rounded-2xl border border-dd-emerald/15 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-dd-emerald">Detailed explanation</summary>
            <p className="mt-3 text-sm text-dd-ink/70">{name.commentaryNote}</p>
            {name.article.commentary ? (
              <p lang="ar" dir="rtl" className="mt-3 whitespace-pre-wrap leading-relaxed">
                {name.article.commentary.text}
              </p>
            ) : (
              <p className="mt-3 text-sm">This page did not include that section.</p>
            )}
          </details>

          <details className="mt-4 rounded-2xl border border-dd-emerald/15 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-dd-emerald">Evidence published on this page</summary>
            {name.article.evidence ? (
              <p lang="ar" dir="rtl" className="mt-3 whitespace-pre-wrap leading-relaxed">
                {name.article.evidence.text}
              </p>
            ) : (
              <p className="mt-3 text-sm">This page did not include an evidence section.</p>
            )}
          </details>

          <details className="mt-4 rounded-2xl border border-dd-emerald/15 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-dd-emerald">References</summary>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-dd-ink/80">
              <p>
                <a className="underline" href={name.canonicalUrl} target="_blank" rel="noreferrer">
                  Original source
                </a>
              </p>
              <p>Retrieved {name.retrievedAt}</p>
              <p>Content hash {name.contentHash}</p>
              {name.index === 'updated' && <p>The indexed copy was replaced because the page text changed.</p>}
              <p>{name.rights.conditions}</p>
            </div>
          </details>
        </Panel>
      )}
    </div>
  );
}

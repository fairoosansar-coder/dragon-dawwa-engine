import { BookOpen, ExternalLink, ShieldCheck, X } from 'lucide-react';
import {
  internalReaderRouteForReference,
  type ResearchReference,
} from '../shared/studio/contracts.ts';

function providerLabel(provider: ResearchReference['provider']): string {
  if (provider === 'QuranEnc') return 'Qur’anic Ayah · QuranEnc';
  if (provider === 'HadeethEnc') return 'Prophetic Hadith · HadeethEnc';
  return 'Source Passage · IslamHouse';
}

export function SourceReaderPanel({
  references,
  selectedId,
  onSelectId,
  gaps,
  disagreements,
  onClose,
}: {
  references: ResearchReference[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  gaps: { source: string; message: string }[];
  disagreements: string[];
  onClose?: () => void;
}) {
  const focusedRef = selectedId ? references.find(r => r.id === selectedId) ?? null : null;

  return (
    <section
      aria-label="In-app Source & Evidence Reader"
      data-testid="studio-source-reader"
      className="rounded-3xl border border-gold/60 bg-parchment/90 p-4 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pine/15 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pine">
            Explore Sources · Internal Evidence Reader
          </p>
          <h3 className="mt-1 font-display text-xl font-bold text-pine">
            {focusedRef ? `[${focusedRef.id}] ${focusedRef.title}` : `Retrieved Programme Sources (${references.length})`}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {focusedRef && (
            <button
              type="button"
              onClick={() => onSelectId(null)}
              className="min-h-10 rounded-full border border-pine/25 bg-white px-3.5 py-1.5 text-xs font-semibold text-pine hover:border-pine"
            >
              Show all {references.length} sources
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close source reader"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-pine/20 bg-white text-pine hover:border-pine"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Filter pills for quick jumping between citations */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Citation filter">
        <button
          type="button"
          onClick={() => onSelectId(null)}
          className={`min-h-9 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            selectedId === null ? 'bg-pine text-sand' : 'border border-pine/20 bg-white text-pine hover:border-gold'
          }`}
        >
          All ({references.length})
        </button>
        {references.map(ref => (
          <button
            key={ref.id}
            type="button"
            onClick={() => onSelectId(ref.id)}
            data-testid={`source-tab-${ref.id}`}
            className={`min-h-9 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              selectedId === ref.id ? 'bg-pine text-sand ring-2 ring-gold' : 'border border-pine/20 bg-white text-pine hover:border-gold'
            }`}
          >
            [{ref.id}] {ref.locator}
          </button>
        ))}
      </div>

      {/* Reference cards */}
      <div className="mt-4 space-y-4">
        {(focusedRef ? [focusedRef] : references).map(ref => {
          const internalRoute = internalReaderRouteForReference(ref);
          return (
            <article
              key={ref.id}
              id={`studio-ev-${ref.id}`}
              data-testid={`evidence-card-${ref.id}`}
              className="rounded-2xl border border-pine/20 bg-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-pine px-2.5 py-0.5 text-xs font-bold text-sand">
                      [{ref.id}]
                    </span>
                    <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-pine">
                      {providerLabel(ref.provider)}
                    </span>
                    {ref.grade && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2.5 py-0.5 text-xs font-semibold text-ink">
                        <ShieldCheck className="h-3.5 w-3.5 text-pine" aria-hidden="true" />
                        Grade: {ref.grade}
                      </span>
                    )}
                  </div>
                  <h4 className="font-display text-lg font-bold text-pine">{ref.title}</h4>
                  <p className="text-xs text-muted">
                    Locator: <span className="font-medium text-ink">{ref.locator}</span>
                    {ref.itemId ? ` · ID: ${ref.itemId}` : ''}
                    {ref.version ? ` (v${ref.version})` : ''}
                    {` · Language: ${ref.passageLanguage.toUpperCase()}`}
                  </p>
                </div>
              </div>

              {ref.arabic && (
                <div className="mt-4 rounded-2xl border border-gold/40 bg-sand/70 p-4">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-pine">
                    Original Arabic Text
                  </p>
                  <p lang="ar" dir="rtl" className="arabic text-2xl leading-loose text-ink sm:text-3xl">
                    {ref.arabic}
                  </p>
                </div>
              )}

              <div className="mt-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Retrieved Passage ({ref.passageLanguage.toUpperCase()})
                </p>
                <p
                  lang={ref.passageLanguage}
                  className="whitespace-pre-wrap text-base leading-relaxed text-ink"
                >
                  {ref.passage}
                </p>
              </div>

              {ref.limitations.length > 0 && (
                <div className="mt-3 rounded-xl border border-pine/10 bg-mint/40 p-3 text-xs leading-relaxed text-ink/85">
                  <p className="font-semibold text-pine">Source Context & Limitations</p>
                  {ref.limitations.map((lim, i) => (
                    <p key={i} className="mt-1 whitespace-pre-wrap" lang={ref.passageLanguage}>
                      {lim}
                    </p>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-pine/10 pt-3 text-xs text-muted">
                <div>
                  {(ref.authors.length > 0 || ref.translators.length > 0 || ref.collection) && (
                    <p>
                      {[
                        ref.authors.length ? `Author: ${ref.authors.join('; ')}` : '',
                        ref.translators.length ? `Translator: ${ref.translators.join('; ')}` : '',
                        ref.collection ? `Collection: ${ref.collection}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <p className="mt-0.5">
                    Retrieved {ref.retrievedOn}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={internalRoute}
                    data-testid={`open-internal-reader-${ref.id}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-semibold text-pine hover:bg-pine hover:text-sand"
                  >
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    Open in Dragon Dawwa Reader
                  </a>
                  {ref.url && (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-pine underline"
                    >
                      Source page <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {(disagreements.length > 0 || gaps.length > 0) && (
        <div className="mt-4 space-y-2 rounded-2xl border border-gold/50 bg-white/90 p-4 text-xs">
          <p className="font-semibold uppercase tracking-wider text-pine">
            Source Availability & Scholarly Nuances
          </p>
          {disagreements.map((d, i) => (
            <p key={`dis-${i}`} className="text-ink/85">
              • {d}
            </p>
          ))}
          {gaps.map((g, i) => (
            <p key={`gap-${i}`} className="text-muted">
              • <span className="font-semibold text-ink">{g.source}:</span> {g.message}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

import { BookOpen, ExternalLink, Pause, Play, ShieldCheck, X } from 'lucide-react';
import { pauseAudio, playAudio, useAudioState } from '../lib/audio.ts';
import type { EvidencePassage, SourceContentType } from '../shared/studio/contracts.ts';

function contentTypeBadgeLabel(kind: SourceContentType): string {
  switch (kind) {
    case 'ayah':
      return 'Qur’anic Ayah';
    case 'hadith':
      return 'Prophetic Hadith';
    case 'book_section':
      return 'Book Section';
    case 'article_passage':
      return 'Article Passage';
    case 'audio_recording':
      return 'Original Scholar Recording';
    case 'name_of_allah':
      return 'Name of Allah (Asma al-Husna)';
    case 'scientific_publication':
      return 'Scientific Publication & Scope';
  }
}

export function SourceReaderPanel({
  passages,
  selectedId,
  onSelectId,
  gaps,
  disagreements,
  onClose,
}: {
  passages: EvidencePassage[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  gaps: { source: string; message: string }[];
  disagreements: string[];
  onClose?: () => void;
}) {
  const audio = useAudioState();
  const focusedPassage = selectedId ? passages.find(p => p.id === selectedId) ?? null : null;

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
            {focusedPassage ? `[${focusedPassage.id}] ${focusedPassage.source.title}` : `Retrieved Programme Sources (${passages.length})`}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {focusedPassage && (
            <button
              type="button"
              onClick={() => onSelectId(null)}
              className="min-h-10 rounded-full border border-pine/25 bg-white px-3.5 py-1.5 text-xs font-semibold text-pine hover:border-pine"
            >
              Show all {passages.length} sources
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
          All ({passages.length})
        </button>
        {passages.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectId(p.id)}
            data-testid={`source-tab-${p.id}`}
            className={`min-h-9 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              selectedId === p.id ? 'bg-pine text-sand ring-2 ring-gold' : 'border border-pine/20 bg-white text-pine hover:border-gold'
            }`}
          >
            [{p.id}] {p.locator}
          </button>
        ))}
      </div>

      {/* Passage cards */}
      <div className="mt-4 space-y-4">
        {(focusedPassage ? [focusedPassage] : passages).map(passage => {
          const playId = `source-audio-${passage.id}`;
          const isPlaying = audio.id === playId && audio.playing;

          return (
            <article
              key={passage.id}
              id={`studio-ev-${passage.id}`}
              data-testid={`evidence-card-${passage.id}`}
              className="rounded-2xl border border-pine/20 bg-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-pine px-2.5 py-0.5 text-xs font-bold text-sand">
                      [{passage.id}]
                    </span>
                    <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-pine">
                      {contentTypeBadgeLabel(passage.source.contentType)}
                    </span>
                    <span className="rounded-full border border-gold/60 bg-sand px-2.5 py-0.5 text-xs font-medium text-ink">
                      Provider: {passage.source.provider}
                    </span>
                    {passage.grade && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2.5 py-0.5 text-xs font-semibold text-ink">
                        <ShieldCheck className="h-3.5 w-3.5 text-pine" aria-hidden="true" />
                        Grade: {passage.grade}
                      </span>
                    )}
                  </div>
                  <h4 className="font-display text-lg font-bold text-pine">{passage.source.title}</h4>
                  <p className="text-xs text-muted">
                    Locator: <span className="font-medium text-ink">{passage.locator}</span>
                    {passage.source.edition ? ` · Edition: ${passage.source.edition}` : ''}
                    {passage.source.version ? ` (v${passage.source.version})` : ''}
                    {` · Language: ${passage.passageLanguage.toUpperCase()}`}
                  </p>
                </div>

                {passage.audioUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      isPlaying ? pauseAudio() : void playAudio(playId, passage.audioUrl!)
                    }
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-pine px-4 py-1.5 text-xs font-semibold text-sand hover:bg-moss"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                    {isPlaying
                      ? 'Pause source audio'
                      : passage.audioKind === 'quran_recitation'
                        ? 'Play Arabic Recitation'
                        : 'Play Original Recording'}
                  </button>
                )}
              </div>

              {passage.arabicText && (
                <div className="mt-4 rounded-2xl border border-gold/40 bg-sand/70 p-4">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-pine">
                    Original Arabic Text
                  </p>
                  <p lang="ar" dir="rtl" className="arabic text-2xl leading-loose text-ink sm:text-3xl">
                    {passage.arabicText}
                  </p>
                </div>
              )}

              <div className="mt-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Retrieved Passage ({passage.passageLanguage.toUpperCase()})
                </p>
                <p
                  lang={passage.passageLanguage}
                  className="whitespace-pre-wrap text-base leading-relaxed text-ink"
                >
                  {passage.exactText}
                </p>
              </div>

              {passage.surroundingContext.length > 0 && (
                <div className="mt-3 rounded-xl border border-pine/10 bg-mint/40 p-3 text-xs leading-relaxed text-ink/85">
                  <p className="font-semibold text-pine">Context & Documented Notes</p>
                  {passage.surroundingContext.map((ctx, i) => (
                    <p key={i} className="mt-1 whitespace-pre-wrap" lang={passage.passageLanguage}>
                      {ctx}
                    </p>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-pine/10 pt-3 text-xs text-muted">
                <div>
                  {passage.source.credits.length > 0 && (
                    <p>
                      {passage.source.credits.map(c => `${c.role}: ${c.name}`).join(' · ')}
                    </p>
                  )}
                  <p className="mt-0.5">
                    Rights: {passage.source.rights.licenseNote} · Retrieved {new Date(passage.source.retrievedAt).toLocaleTimeString()}
                  </p>
                  {passage.limitations.length > 0 && (
                    <p className="mt-0.5 text-ink/70">
                      Note: {passage.limitations.join(' ')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={passage.internalReaderRoute}
                    data-testid={`open-internal-reader-${passage.id}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-semibold text-pine hover:bg-pine hover:text-sand"
                  >
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    Open in Dragon Dawwa Reader
                  </a>
                  {passage.source.canonicalUrl && (
                    <a
                      href={passage.source.canonicalUrl}
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

      {/* Disagreements and Source Availability Gaps */}
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

import { useEffect, useMemo, useState } from 'react';
import { claimPlayback, pauseAudio, playAudio, useAudioState } from '../lib/audio.ts';
import { useRemote } from '../lib/api.ts';
import { useApp } from '../lib/store.tsx';
import type { LibraryDocument } from '../shared/libraryDocument.ts';
import { Card, ErrorNote, Loading, Notice } from '../components/ui.tsx';

const PLACE_KEY = 'kf-library-place';

function savedPlace(): { id: number; blockId: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PLACE_KEY) || 'null') as { id?: unknown; blockId?: unknown } | null;
    if (!raw || typeof raw.id !== 'number' || typeof raw.blockId !== 'string') return null;
    return { id: raw.id, blockId: raw.blockId };
  } catch {
    return null;
  }
}

export function LibraryReader({ itemId, backHref }: { itemId: number; backHref: string }) {
  const { lang } = useApp();
  const remote = useRemote<LibraryDocument>(Number.isInteger(itemId) && itemId > 0 ? `/api/library/read/${itemId}?lang=${lang}` : null);
  const data = remote.data && remote.data.id === itemId && remote.data.requestedLanguage === lang ? remote.data : null;
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const needle = query.trim().toLocaleLowerCase('en');
  const blocks = useMemo(() => {
    if (!data) return [];
    if (!needle) return data.blocks;
    return data.blocks.filter(block => block.kind === 'heading' || block.text.toLocaleLowerCase('en').includes(needle));
  }, [data, needle]);

  useEffect(() => {
    const place = savedPlace();
    if (!data || !place || place.id !== data.id) return;
    document.getElementById(`block-${place.blockId}`)?.scrollIntoView({ block: 'center' });
  }, [data]);

  return (
    <div className="space-y-6">
      <a href={backHref} className="inline-flex min-h-11 items-center text-sm font-medium text-pine">
        ← Back
      </a>
      {remote.loading && !data && <Loading label="Opening this item" />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {data && (
        <article className="space-y-6">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">IslamHouse {data.id}</p>
            <h1 className="mt-3 font-display text-4xl font-bold text-pine" lang={data.language ?? undefined}>
              {data.title || 'This item could not be titled'}
            </h1>
            {data.limitation && <div className="mt-4"><Notice>{data.limitation}</Notice></div>}
            {data.index === 'updated' && (
              <p className="mt-3 text-sm text-ink/70">A newer copy replaced the indexed text of this item.</p>
            )}
          </header>

          {data.blocks.length > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-sm">
                <span className="font-medium text-pine">Search this text</span>
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  className="mt-1 block w-64 rounded-full border border-pine/20 bg-white px-4 py-2"
                />
              </label>
              {needle && blocks.every(block => block.kind === 'heading') && (
                <p className="text-sm text-ink/70">No paragraph in this copy contains that word.</p>
              )}
            </div>
          )}

          {data.blocks.some(block => block.kind === 'heading') && (
            <nav aria-label="Chapters" className="flex flex-wrap gap-2">
              {data.blocks.filter(block => block.kind === 'heading').map(block => (
                <a key={block.id} href={`#block-${block.id}`} className="rounded-full border border-pine/15 px-3 py-1 text-sm text-pine">
                  {block.text}
                </a>
              ))}
            </nav>
          )}

          {blocks.some(block => block.kind !== 'heading') && (
            <div className="space-y-4">
              {blocks.map(block =>
                block.kind === 'heading' ? (
                  <h2 id={`block-${block.id}`} key={block.id} className="font-display text-2xl font-bold text-pine" lang={data.language ?? undefined}>
                    {block.text}
                  </h2>
                ) : block.kind === 'footnote' ? (
                  <details key={block.id} id={`block-${block.id}`} className="rounded-2xl border border-pine/10 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-pine">Note</summary>
                    <p className="mt-2 text-sm leading-relaxed" lang={data.language ?? undefined}>{block.text}</p>
                  </details>
                ) : (
                  <p id={`block-${block.id}`} key={block.id} className="text-lg leading-relaxed text-ink" lang={data.language ?? undefined}>
                    {block.text}
                    <button
                      type="button"
                      className="ml-3 text-sm font-medium text-pine underline"
                      onClick={() => {
                        localStorage.setItem(PLACE_KEY, JSON.stringify({ id: data.id, blockId: block.id }));
                        setSaved(block.id);
                      }}
                    >
                      {saved === block.id ? 'Place saved' : 'Save place'}
                    </button>
                  </p>
                ),
              )}
            </div>
          )}

          {data.media.map(file => (
            <section key={file.sourceUrl} className="space-y-2">
              <h2 className="font-display text-xl font-bold text-pine">{file.kind === 'pdf' ? 'Publication file' : 'Original recording'}</h2>
              {file.kind === 'pdf' ? (
                <iframe title={data.title || 'Publication file'} src={file.viewUrl} className="h-[70vh] w-full rounded-2xl border border-pine/10 bg-white" />
              ) : file.kind === 'audio' ? (
                <AudioControl id={`library-${data.id}`} url={file.sourceUrl} />
              ) : file.kind === 'video' ? (
                <video controls preload="none" src={file.sourceUrl} className="w-full rounded-2xl bg-black" onPlay={event => claimPlayback(event.currentTarget)} />
              ) : (
                <p className="text-sm text-ink/70">This attachment is {file.extension}. It is not shown inline.</p>
              )}
            </section>
          ))}

          {data.description && (
            <details className="rounded-2xl border border-pine/10 bg-parchment px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-pine">Catalogue description</summary>
              <p className="mt-3 text-sm leading-relaxed" lang={data.language ?? undefined}>{data.description}</p>
              <p className="mt-2 text-xs text-ink/60">This description is not the full text.</p>
            </details>
          )}

          <details className="rounded-2xl border border-pine/10 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-pine">Publication details</summary>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink/80">
              {data.credits.length === 0 && <p>The source did not supply an author, translator or reviewer.</p>}
              {data.credits.map(credit => (
                <p key={`${credit.role}-${credit.name}`}>
                  {credit.role}: {credit.name ?? 'Name not supplied by the source'}
                </p>
              ))}
              {data.added && <p>Added {data.added}</p>}
              {data.updated && <p>Updated {data.updated}</p>}
              {data.version && <p>Version marker {data.version}</p>}
              {data.contentHash && <p>Content hash {data.contentHash}</p>}
              <p>Retrieved {data.retrievedAt}</p>
              <p>{data.rights.conditions}</p>
              {data.canonicalUrl && (
                <p>
                  <a className="text-pine underline" href={data.canonicalUrl} target="_blank" rel="noreferrer">
                    Original source
                  </a>
                </p>
              )}
            </div>
          </details>
        </article>
      )}
      {!remote.loading && !remote.error && !data && <Card><p className="text-sm">This item is not open yet.</p></Card>}
    </div>
  );
}

function AudioControl({ id, url }: { id: string; url: string }) {
  const audio = useAudioState();
  const active = audio.id === id && (audio.status === 'playing' || audio.status === 'paused' || audio.status === 'loading');
  return (
    <button
      type="button"
      className="min-h-11 rounded-full bg-pine px-4 text-sm font-medium text-white"
      onClick={() => (active && audio.status === 'playing' ? pauseAudio() : void playAudio(id, url))}
    >
      {active && audio.status === 'playing' ? 'Pause' : 'Play original recording'}
    </button>
  );
}

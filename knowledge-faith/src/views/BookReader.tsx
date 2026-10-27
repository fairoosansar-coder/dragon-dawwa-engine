import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { useRemote } from '../lib/api.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { savedFromCard, useSavedBooks } from '../lib/savedBooks.ts';
import { mostlyArabic, type BookCard, type ReaderBlock } from '../shared/bookShelf.ts';
import type { LibraryDocument } from '../shared/libraryDocument.ts';
import { ErrorNote, Loading, Notice } from '../components/ui.tsx';

const PLACE_KEY = 'kf-book-page';
const RETURN_KEY = 'kf-books-return';

interface ReadBook extends LibraryDocument {
  pages?: { blocks: ReaderBlock[] }[];
}

function libraryReturn(): string {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY) || '';
    if (raw.startsWith('#/books') && !raw.startsWith('#/books/')) return raw;
  } catch {
    /* session storage can be unavailable */
  }
  return '#/books';
}

function storedPage(id: number): number {
  try {
    const raw = JSON.parse(localStorage.getItem(PLACE_KEY) || 'null') as { id?: unknown; page?: unknown } | null;
    if (raw && raw.id === id && typeof raw.page === 'number' && Number.isInteger(raw.page) && raw.page > 0) return raw.page;
  } catch {
    /* ignore an unreadable place */
  }
  return 1;
}

function rememberPage(id: number, page: number) {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify({ id, page }));
  } catch {
    /* keep the page in memory */
  }
}

export function BookReader({ itemId, backHref = libraryReturn() }: { itemId: number; backHref?: string }) {
  const { lang } = useApp();
  const remote = useRemote<ReadBook>(Number.isInteger(itemId) && itemId > 0 ? `/api/library/read/${itemId}?lang=${lang}&pages=1` : null);
  const data = remote.data && remote.data.id === itemId && remote.data.requestedLanguage === lang ? remote.data : null;
  const pages = data?.pages ?? [];
  const [page, setPage] = useState(() => storedPage(itemId));
  const [settings, setSettings] = useState(false);
  const [size, setSize] = useStored<'sm' | 'md' | 'lg'>('kf-library-text', 'md');
  const saved = useSavedBooks();
  const current = pages.length ? Math.min(Math.max(page, 1), pages.length) : 1;
  const body = pages[current - 1];

  useEffect(() => {
    setPage(storedPage(itemId));
    setSettings(false);
  }, [itemId, lang]);

  useEffect(() => {
    if (!data || pages.length === 0) return;
    setPage(Math.min(Math.max(storedPage(itemId), 1), pages.length));
  }, [data, itemId, pages.length]);

  useEffect(() => {
    if (!data || pages.length === 0) return;
    rememberPage(data.id, current);
  }, [data, current, pages.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if (event.key === 'ArrowRight') setPage(value => Math.min(pages.length || 1, Math.max(value, 1) + 1));
      if (event.key === 'ArrowLeft') setPage(value => Math.max(1, value - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages.length]);

  const textClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';
  const card = data ? cardFromDocument(data) : null;
  const bookSaved = card ? saved.has(card.id) : false;
  const author = data?.credits.find(credit => credit.role === 'author' && credit.name)?.name ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <a href={backHref} className="inline-flex min-h-10 items-center text-sm font-medium text-pine">Library</a>
        <span className="min-w-2 flex-1" />
        <button type="button" aria-expanded={settings} onClick={() => setSettings(open => !open)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-pine/20 px-3 text-sm font-medium text-pine">
          <Settings className="h-4 w-4" aria-hidden /> Settings
        </button>
        {data && (
          <a href={`#/books/research?book=${data.id}`} className="inline-flex min-h-10 items-center text-sm font-medium text-pine underline decoration-gold underline-offset-4">
            Research this book
          </a>
        )}
        {card && (
          <button type="button" aria-pressed={bookSaved} onClick={() => saved.toggle(savedFromCard(card, lang))} className="inline-flex min-h-10 items-center rounded-full border border-pine/20 px-3 text-sm font-medium text-pine">
            {bookSaved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>
      {settings && (
        <div className="mb-4 rounded-2xl border border-gold/50 bg-parchment p-4">
          <p className="text-sm font-medium text-pine">Text size</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['sm', 'md', 'lg'] as const).map(option => (
              <button key={option} type="button" aria-pressed={size === option} onClick={() => setSize(option)} className={`min-h-10 rounded-full px-3 text-sm ${size === option ? 'bg-moss text-white' : 'bg-white text-pine'}`}>
                {option === 'sm' ? 'Small' : option === 'lg' ? 'Large' : 'Default'}
              </button>
            ))}
          </div>
        </div>
      )}
      {remote.loading && !data && <Loading label="Opening this book" />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {data && (
        <>
          <header className="mb-4 text-center">
            <h1 className="font-display text-2xl font-bold text-pine sm:text-3xl" lang={data.language ?? undefined}>{data.title || 'Untitled book'}</h1>
            {author && <p className="mt-1 text-sm text-ink/70">{author}</p>}
          </header>
          {data.limitation && pages.length === 0 && <div className="mb-4"><Notice>{data.limitation}</Notice></div>}
          {pages.length > 0 && data.limitation && (
            <p className="mb-4 text-center text-xs leading-relaxed text-muted">Text extracted from the publication file. The original file stays available in Book details.</p>
          )}
          {pages.length > 0 && body && (
            <article className={`min-h-[62vh] bg-white px-5 py-8 shadow-[0_18px_50px_rgba(6,73,54,0.08)] sm:px-12 sm:py-12 ${textClass}`} lang={data.language ?? undefined}>
              <p className="mb-6 text-center text-xs text-muted">{current}</p>
              <div className="space-y-4">
                {body.blocks.map(block =>
                  block.kind === 'heading' ? (
                    <h2 key={block.id} className="font-display text-[1.35em] font-bold leading-snug text-moss">{block.text}</h2>
                  ) : (
                    <p key={block.id} className={mostlyArabic(block.text) ? 'text-center font-arabic text-[1.35em] leading-loose' : 'leading-relaxed text-ink'} dir={mostlyArabic(block.text) ? 'rtl' : undefined}>
                      {block.text}
                    </p>
                  ),
                )}
              </div>
            </article>
          )}
          {pages.length > 1 && (
            <div className="sticky bottom-0 z-10 mt-4 flex items-center gap-3 border-t border-pine/10 bg-sand/95 px-1 py-3 backdrop-blur">
              <button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)} className="min-h-10 shrink-0 rounded-full border border-pine/20 px-3 text-sm font-medium text-pine disabled:opacity-40">
                Previous
              </button>
              <input
                type="range"
                min={1}
                max={pages.length}
                value={current}
                aria-label="Page"
                aria-valuemin={1}
                aria-valuemax={pages.length}
                aria-valuenow={current}
                aria-valuetext={`Page ${current} of ${pages.length}`}
                onChange={event => setPage(Number(event.target.value))}
                className="min-w-0 flex-1 accent-pine"
              />
              <span className="w-14 shrink-0 text-center text-sm tabular-nums text-ink/70">{current} / {pages.length}</span>
              <button type="button" disabled={current >= pages.length} onClick={() => setPage(current + 1)} className="min-h-10 shrink-0 rounded-full border border-pine/20 px-3 text-sm font-medium text-pine disabled:opacity-40">
                Next
              </button>
            </div>
          )}
          {pages.length === 0 && !remote.loading && data.media.length > 0 && (
            <ul className="space-y-2">
              {data.media.map(file => (
                <li key={file.sourceUrl}>
                  <a href={file.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-pine underline">
                    Open {file.extension} file
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function cardFromDocument(data: ReadBook): BookCard {
  const language = data.language === 'ta' || data.language === 'si' ? data.language : 'en';
  return {
    id: data.id,
    title: data.title || 'Untitled book',
    description: data.description,
    language,
    image: data.image ?? null,
    importance: null,
    essential: false,
    authors: data.credits.filter(credit => credit.role === 'author' && credit.name).map(credit => credit.name as string),
    translators: data.credits.filter(credit => credit.role === 'translator' && credit.name).map(credit => credit.name as string),
    reviewers: data.credits.filter(credit => credit.role === 'reviewer' && credit.name).map(credit => credit.name as string),
    publisher: data.credits.find(credit => credit.role === 'publisher' && credit.name)?.name ?? null,
    added: data.added,
    files: data.media.filter(file => file.kind === 'pdf').map(file => ({ extension: file.extension, url: file.sourceUrl, label: file.label, size: null })),
    sourceUrl: data.canonicalUrl,
  };
}

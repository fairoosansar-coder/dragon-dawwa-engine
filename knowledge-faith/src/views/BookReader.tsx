import { useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { useRemote } from '../lib/api.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { savedFromCard, useSavedBooks } from '../lib/savedBooks.ts';
import {
  BOOK_PAGE_BOOKMARKS_KEY,
  buildBookReaderHash,
  parseBookReaderParams,
  readBookPageBookmarks,
  readLegacyBookResume,
  rememberLegacyBookResume,
  removeBookPageBookmark,
  sameBookPageLocator,
  upsertBookPageBookmark,
  type BookPageLocator,
  type BookRepresentation,
} from '../lib/bookPageBookmark.ts';
import { mostlyArabic, type BookCard, type ReaderBlock } from '../shared/bookShelf.ts';
import {
  PREPARED_TEXT_QUARANTINE_MESSAGE,
  preparedTextQuarantined,
} from '../shared/bookReadiness.ts';
import type { LibraryDocument } from '../shared/libraryDocument.ts';
import type { Lang } from '../shared/sources.ts';
import { ErrorNote, Loading, Notice } from '../components/ui.tsx';

const RETURN_KEY = 'kf-books-return';

interface ReadBook extends LibraryDocument {
  pages?: { blocks: ReaderBlock[] }[];
  pageSource?: 'pdf' | 'text' | 'none';
  pageAttachmentId?: string | null;
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

function resumePageFor(id: number): number {
  const resume = readLegacyBookResume();
  if (resume && resume.id === id) return resume.page;
  return 1;
}

function pdfViewSrc(viewUrl: string, page: number): string {
  const base = viewUrl.split('#')[0] ?? viewUrl;
  return `${base}#page=${Math.max(1, page)}`;
}

export function BookReader({
  itemId,
  backHref = libraryReturn(),
  params = new URLSearchParams(),
}: {
  itemId: number;
  backHref?: string;
  params?: URLSearchParams;
}) {
  const { lang: uiLang } = useApp();
  const route = parseBookReaderParams(params);
  const editionLang: Lang = route.lang ?? uiLang;
  const quarantined = preparedTextQuarantined(itemId);
  const remote = useRemote<ReadBook>(
    Number.isInteger(itemId) && itemId > 0 && !quarantined
      ? `/api/library/read/${itemId}?lang=${editionLang}&pages=1`
      : null,
  );
  const data =
    remote.data && remote.data.id === itemId && remote.data.requestedLanguage === editionLang
      ? remote.data
      : null;
  const pages = data?.pages ?? [];
  const textPageSource: BookRepresentation | null =
    data?.pageSource === 'pdf' || data?.pageSource === 'text' ? data.pageSource : pages.length ? 'text' : null;
  const pdfMedia = data?.media.find(file => file.kind === 'pdf') ?? null;
  const initialRep: BookRepresentation =
    route.representation === 'pdf' && pdfMedia
      ? 'pdf'
      : route.representation === 'text'
        ? 'text'
        : textPageSource === 'pdf'
          ? 'pdf'
          : 'text';
  const [representation, setRepresentation] = useState<BookRepresentation>(initialRep);
  const [page, setPage] = useState(() => route.readerPage ?? resumePageFor(itemId));
  const [settings, setSettings] = useState(false);
  const [size, setSize] = useStored<'sm' | 'md' | 'lg'>('kf-library-text', 'md');
  const [bookmarkNotice, setBookmarkNotice] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<BookPageLocator[]>(() => readBookPageBookmarks());
  const saved = useSavedBooks();

  const attachmentId =
    representation === 'pdf'
      ? route.attachmentId ?? pdfMedia?.sourceUrl ?? data?.pageAttachmentId ?? null
      : data?.pageAttachmentId && textPageSource === 'pdf'
        ? data.pageAttachmentId
        : null;

  const current =
    representation === 'pdf'
      ? Math.max(1, page)
      : pages.length
        ? Math.min(Math.max(page, 1), pages.length)
        : 1;
  const body = representation === 'text' ? pages[current - 1] : undefined;
  const pdfPageObservable = representation === 'pdf' && Boolean(pdfMedia);

  useEffect(() => {
    const next = parseBookReaderParams(params);
    setPage(next.readerPage ?? resumePageFor(itemId));
    setSettings(false);
    setBookmarkNotice(null);
    if (next.representation === 'pdf' || next.representation === 'text') {
      setRepresentation(next.representation);
    }
  }, [itemId, editionLang, params]);

  useEffect(() => {
    if (!data) return;
    if (route.representation === 'pdf' && pdfMedia) setRepresentation('pdf');
    else if (route.representation === 'text') setRepresentation('text');
    else if (data.pageSource === 'pdf') setRepresentation('pdf');
    else if (pages.length > 0) setRepresentation('text');
  }, [data, pages.length, pdfMedia, route.representation]);

  useEffect(() => {
    if (representation !== 'text' || !data || pages.length === 0) return;
    setPage(Math.min(Math.max(route.readerPage ?? resumePageFor(itemId), 1), pages.length));
  }, [data, itemId, pages.length, representation, route.readerPage]);

  useEffect(() => {
    if (!data || pages.length === 0 || representation !== 'text') return;
    rememberLegacyBookResume(data.id, current);
  }, [data, current, pages.length, representation]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if (representation === 'text') {
        if (event.key === 'ArrowRight') setPage(value => Math.min(pages.length || 1, Math.max(value, 1) + 1));
        if (event.key === 'ArrowLeft') setPage(value => Math.max(1, value - 1));
      } else if (representation === 'pdf') {
        if (event.key === 'ArrowRight') setPage(value => Math.max(value, 1) + 1);
        if (event.key === 'ArrowLeft') setPage(value => Math.max(1, value - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pages.length, representation]);

  const activeLocator = useMemo(() => {
    if (!data) return null;
    if (representation === 'pdf' && !attachmentId) return null;
    if (representation === 'text' && pages.length === 0) return null;
    if (representation === 'text' && quarantined) return null;
    return {
      itemId: data.id,
      representation,
      page: current,
      lang: editionLang,
      attachmentId: representation === 'pdf' ? attachmentId : null,
    };
  }, [attachmentId, current, data, editionLang, pages.length, quarantined, representation]);

  const alreadyBookmarked = Boolean(
    activeLocator && bookmarks.some(item => sameBookPageLocator(item, activeLocator)),
  );

  function refreshBookmarks() {
    setBookmarks(readBookPageBookmarks());
  }

  function bookmarkCurrentPage() {
    if (!data || !activeLocator) {
      setBookmarkNotice('This page cannot be bookmarked yet.');
      return;
    }
    if (representation === 'pdf' && !pdfPageObservable) {
      setBookmarkNotice('Bookmark the current PDF page only when the page number is observable.');
      return;
    }
    const result = upsertBookPageBookmark({
      ...activeLocator,
      anchor: representation === 'text' ? body?.blocks[0]?.id ?? null : null,
      title: data.title || null,
      publicationLanguage: data.publicationLanguage ?? data.language ?? null,
    });
    refreshBookmarks();
    if (!result.ok) {
      setBookmarkNotice(
        result.error === 'quota'
          ? 'Storage quota exceeded — bookmark was not saved.'
          : result.error === 'quarantined'
            ? 'Prepared-text bookmarks are blocked for this title.'
            : 'Could not save bookmark (storage unavailable).',
      );
      return;
    }
    setBookmarkNotice(null);
    const hash = buildBookReaderHash({
      itemId: activeLocator.itemId,
      representation: activeLocator.representation,
      readerPage: activeLocator.page,
      lang: activeLocator.lang,
      attachmentId: activeLocator.attachmentId,
    });
    if (window.location.hash !== hash) window.location.replace(hash);
  }

  function removeCurrentBookmark() {
    if (!activeLocator) return;
    const result = removeBookPageBookmark(activeLocator);
    refreshBookmarks();
    if (!result.ok) {
      setBookmarkNotice('Could not remove bookmark (storage unavailable).');
      return;
    }
    setBookmarkNotice(null);
  }

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === BOOK_PAGE_BOOKMARKS_KEY) refreshBookmarks();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const textClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';
  const card = data ? cardFromDocument(data) : null;
  const bookSaved = card ? saved.has(card.id) : false;
  const author = data?.credits.find(credit => credit.role === 'author' && credit.name)?.name ?? null;
  const mismatch =
    route.attachmentId &&
    pdfMedia &&
    route.representation === 'pdf' &&
    route.attachmentId !== pdfMedia.sourceUrl;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <a href={backHref} className="inline-flex min-h-10 items-center text-sm font-medium text-pine">
          Library
        </a>
        <span className="min-w-2 flex-1" />
        <button
          type="button"
          aria-expanded={settings}
          onClick={() => setSettings(open => !open)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-pine/20 px-3 text-sm font-medium text-pine"
        >
          <Settings className="h-4 w-4" aria-hidden /> Settings
        </button>
        {data && (
          <a
            href={`#/books/research?book=${data.id}`}
            className="inline-flex min-h-10 items-center text-sm font-medium text-pine underline decoration-gold underline-offset-4"
          >
            Research this book
          </a>
        )}
        {card && (
          <button
            type="button"
            aria-pressed={bookSaved}
            onClick={() => saved.toggle(savedFromCard(card, editionLang))}
            className="inline-flex min-h-10 items-center rounded-full border border-pine/20 px-3 text-sm font-medium text-pine"
          >
            {bookSaved ? 'Saved' : 'Save'}
          </button>
        )}
        {activeLocator && (
          <button
            type="button"
            data-testid="bookmark-book-page"
            aria-pressed={alreadyBookmarked}
            onClick={() => (alreadyBookmarked ? removeCurrentBookmark() : bookmarkCurrentPage())}
            className="inline-flex min-h-10 items-center rounded-full border border-pine/20 px-3 text-sm font-medium text-pine"
          >
            {alreadyBookmarked ? 'Page bookmarked' : 'Bookmark this page'}
          </button>
        )}
      </div>
      {settings && (
        <div className="mb-4 rounded-2xl border border-gold/50 bg-parchment p-4">
          <p className="text-sm font-medium text-pine">Text size</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['sm', 'md', 'lg'] as const).map(option => (
              <button
                key={option}
                type="button"
                aria-pressed={size === option}
                onClick={() => setSize(option)}
                className={`min-h-10 rounded-full px-3 text-sm ${size === option ? 'bg-moss text-white' : 'bg-white text-pine'}`}
              >
                {option === 'sm' ? 'Small' : option === 'lg' ? 'Large' : 'Default'}
              </button>
            ))}
          </div>
          {pdfMedia && !quarantined && (
            <div className="mt-4">
              <p className="text-sm font-medium text-pine">Representation</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="reader-rep-text"
                  aria-pressed={representation === 'text'}
                  disabled={pages.length === 0}
                  onClick={() => setRepresentation('text')}
                  className={`min-h-10 rounded-full px-3 text-sm ${representation === 'text' ? 'bg-moss text-white' : 'bg-white text-pine'} disabled:opacity-40`}
                >
                  Prepared text
                </button>
                <button
                  type="button"
                  data-testid="reader-rep-pdf"
                  aria-pressed={representation === 'pdf'}
                  onClick={() => setRepresentation('pdf')}
                  className={`min-h-10 rounded-full px-3 text-sm ${representation === 'pdf' ? 'bg-moss text-white' : 'bg-white text-pine'}`}
                >
                  Original PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {bookmarkNotice && (
        <div className="mb-4">
          <Notice>{bookmarkNotice}</Notice>
        </div>
      )}
      {mismatch && (
        <div className="mb-4" data-testid="bookmark-attachment-mismatch">
          <Notice>
            This bookmark’s PDF attachment no longer matches the current edition file. Reopen the source PDF from
            book details, or continue with the available file.
          </Notice>
          {pdfMedia && (
            <a
              href={buildBookReaderHash({
                itemId,
                representation: 'pdf',
                readerPage: current,
                lang: editionLang,
                attachmentId: pdfMedia.sourceUrl,
              })}
              className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-pine underline"
            >
              Open current PDF attachment
            </a>
          )}
        </div>
      )}
      {quarantined && (
        <div className="mb-4 space-y-3" data-testid="prepared-text-quarantine-reader">
          <Notice>{PREPARED_TEXT_QUARANTINE_MESSAGE}</Notice>
          <p className="text-sm text-ink/75">
            Direct prepared-text entry and audio generation are blocked for this title. Use the original PDF from book
            details when available.
          </p>
          <a href={backHref} className="inline-flex min-h-10 items-center text-sm font-medium text-pine underline">
            Back to library
          </a>
        </div>
      )}
      {remote.loading && !data && !quarantined && <Loading label="Opening this book" />}
      {remote.error && !quarantined && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {data && !quarantined && (
        <>
          <header className="mb-4 text-center">
            <h1
              className="font-display text-2xl font-bold text-pine sm:text-3xl"
              lang={data.language ?? undefined}
            >
              {data.title || 'Untitled book'}
            </h1>
            {author && <p className="mt-1 text-sm text-ink/70">{author}</p>}
            <p className="mt-1 text-xs text-muted" data-testid="reader-representation-label">
              {representation === 'pdf' ? 'Original PDF' : 'Prepared text'}
              {` · page ${current}`}
            </p>
          </header>
          {data.limitation && pages.length === 0 && representation === 'text' && (
            <div className="mb-4">
              <Notice>{data.limitation}</Notice>
            </div>
          )}
          {pages.length > 0 && data.limitation && representation === 'text' && (
            <p className="mb-4 text-center text-xs leading-relaxed text-muted">
              Text extracted from the publication file. The original file stays available in Book details.
            </p>
          )}
          {representation === 'text' && pages.length > 0 && body && (
            <article
              className={`min-h-[62vh] bg-white px-5 py-8 shadow-[0_18px_50px_rgba(6,73,54,0.08)] sm:px-12 sm:py-12 ${textClass}`}
              lang={data.language ?? undefined}
              data-testid="prepared-text-page"
              data-reader-page={current}
            >
              <p className="mb-6 text-center text-xs text-muted">{current}</p>
              <div className="space-y-4">
                {body.blocks.map(block =>
                  block.kind === 'heading' ? (
                    <h2 key={block.id} className="font-display text-[1.35em] font-bold leading-snug text-moss">
                      {block.text}
                    </h2>
                  ) : (
                    <p
                      key={block.id}
                      className={
                        mostlyArabic(block.text)
                          ? 'text-center font-arabic text-[1.35em] leading-loose'
                          : 'leading-relaxed text-ink'
                      }
                      dir={mostlyArabic(block.text) ? 'rtl' : undefined}
                    >
                      {block.text}
                    </p>
                  ),
                )}
              </div>
            </article>
          )}
          {representation === 'pdf' && pdfMedia && (
            <div className="space-y-3" data-testid="original-pdf-surface" data-reader-page={current}>
              <iframe
                title={`${data.title || 'Book'} PDF page ${current}`}
                src={pdfViewSrc(pdfMedia.viewUrl, current)}
                className="min-h-[70vh] w-full rounded-2xl border border-pine/15 bg-white"
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-pine">
                  PDF page
                  <input
                    type="number"
                    min={1}
                    value={current}
                    aria-label="PDF page"
                    data-testid="pdf-page-input"
                    onChange={event => setPage(Math.max(1, Number(event.target.value) || 1))}
                    className="ml-2 w-20 rounded-full border border-pine/20 px-3 py-2 text-sm"
                  />
                </label>
                <a
                  href={pdfMedia.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center text-sm font-medium text-pine underline"
                  data-testid="original-pdf-fallback"
                >
                  Open original PDF file
                </a>
              </div>
            </div>
          )}
          {representation === 'text' && pages.length > 1 && (
            <div className="sticky bottom-0 z-10 mt-4 flex items-center gap-3 border-t border-pine/10 bg-sand/95 px-1 py-3 backdrop-blur">
              <button
                type="button"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
                className="min-h-10 shrink-0 rounded-full border border-pine/20 px-3 text-sm font-medium text-pine disabled:opacity-40"
              >
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
              <span className="w-14 shrink-0 text-center text-sm tabular-nums text-ink/70">
                {current} / {pages.length}
              </span>
              <button
                type="button"
                disabled={current >= pages.length}
                onClick={() => setPage(current + 1)}
                className="min-h-10 shrink-0 rounded-full border border-pine/20 px-3 text-sm font-medium text-pine disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
          {representation === 'text' && pages.length === 0 && !remote.loading && data.media.length > 0 && (
            <ul className="space-y-2">
              {data.media.map(file => (
                <li key={file.sourceUrl}>
                  {file.kind === 'pdf' ? (
                    <button
                      type="button"
                      className="text-sm font-medium text-pine underline"
                      onClick={() => {
                        setRepresentation('pdf');
                        setPage(1);
                      }}
                    >
                      Open original PDF surface
                    </button>
                  ) : (
                    <a href={file.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-pine underline">
                      Open {file.extension} file
                    </a>
                  )}
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
  // Prefer the rendered reader language so a Tamil reading stays on the Tamil shelf.
  const rendered =
    data.language === 'ta' || data.language === 'si' || data.language === 'en'
      ? data.language
      : data.requestedLanguage === 'ta' || data.requestedLanguage === 'si'
        ? data.requestedLanguage
        : 'en';
  const language = rendered;
  return {
    id: data.id,
    title: data.title || 'Untitled book',
    description: data.description,
    language,
    image: data.image ?? null,
    importance: null,
    essential: false,
    authors: data.credits.filter(credit => credit.role === 'author' && credit.name).map(credit => credit.name as string),
    translators: data.credits
      .filter(credit => credit.role === 'translator' && credit.name)
      .map(credit => credit.name as string),
    reviewers: data.credits.filter(credit => credit.role === 'reviewer' && credit.name).map(credit => credit.name as string),
    publisher: data.credits.find(credit => credit.role === 'publisher' && credit.name)?.name ?? null,
    added: data.added,
    files: data.media
      .filter(file => file.kind === 'pdf')
      .map(file => ({ extension: file.extension, url: file.sourceUrl, label: file.label, size: null })),
    sourceUrl: data.canonicalUrl,
  };
}

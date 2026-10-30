import { useEffect, useMemo, useRef } from 'react';
import { LANGUAGE_NAMES, LANGS, type Lang } from '../shared/sources.ts';
import { authorLine, bookMatches, type BookCard, type BookMeta, type BookShelfResponse, type BookStats } from '../shared/bookShelf.ts';
import { useRemote } from '../lib/api.ts';
import { useShell } from '../lib/shell.tsx';
import { useApp } from '../lib/store.tsx';
import { cardFromSaved, useSavedBooks } from '../lib/savedBooks.ts';
import type { ViewProps } from '../App.tsx';
import { ErrorNote, Loading } from '../components/ui.tsx';
import { BookCover } from './BookCover.tsx';
import { BookDetails, cardCredit } from './BookDetails.tsx';
import { BookReader } from './BookReader.tsx';

function writeHash(patch: Record<string, string | null>) {
  const hash = window.location.hash;
  const queryAt = hash.indexOf('?');
  const params = new URLSearchParams(queryAt === -1 ? '' : hash.slice(queryAt + 1));
  for (const [key, value] of Object.entries(patch)) {
    if (!value) params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  const next = `#/books${qs ? `?${qs}` : ''}`;
  if (window.location.hash !== next) window.location.hash = next;
}

function shelfOf(value: string | null): 'all' | 'essential' | 'saved' {
  return value === 'essential' || value === 'saved' ? value : 'all';
}

export default function BooksLibrary({ sub, segments = [], params = new URLSearchParams() }: ViewProps) {
  const itemId = sub === 'item' ? Number(segments[1]) : 0;
  if (sub === 'item' && Number.isInteger(itemId) && itemId > 0) return <BookReader itemId={itemId} />;
  return <BooksShelf params={params} />;
}

function BooksShelf({ params }: { params: URLSearchParams }) {
  const { lang, setLang } = useApp();
  const { query, setQuery } = useShell();
  const saved = useSavedBooks();
  const shelf = shelfOf(params.get('shelf'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const category = /^\d{1,12}$/.test(params.get('category') || '') ? (params.get('category') as string) : '';
  const format = params.get('format') === 'pdf' ? 'pdf' : 'any';
  const sort = params.get('sort') === 'title' ? 'title' : 'newest';
  const detailsId = Number(params.get('details'));
  const committed = params.get('q') ?? '';
  const searching = committed.trim().length >= 3;
  const source = useRef<'url' | 'user'>('url');

  useEffect(() => {
    try {
      sessionStorage.setItem('kf-books-return', window.location.hash.startsWith('#/books') ? window.location.hash : '#/books');
    } catch {
      /* the reader falls back to the library */
    }
  }, [params]);

  useEffect(() => {
    source.current = 'url';
    setQuery(committed);
  }, [committed, setQuery]);

  useEffect(() => {
    if (source.current === 'url') {
      source.current = 'user';
      return;
    }
    if (query === committed) return;
    const timer = window.setTimeout(() => writeHash({ q: query.trim() || null, page: null, details: null }), 350);
    return () => window.clearTimeout(timer);
  }, [query, committed]);

  const listUrl = shelf === 'saved'
    ? null
    : `/api/library/books?lang=${lang}&page=${page}`
      + (category ? `&category=${category}` : '')
      + (searching ? `&q=${encodeURIComponent(committed.trim())}` : '')
      + (shelf === 'essential' ? '&shelf=essential' : '')
      + (format === 'pdf' ? '&format=pdf' : '')
      + (sort === 'title' ? '&sort=title' : '');

  const remote = useRemote<BookShelfResponse>(listUrl);
  const meta = useRemote<BookMeta>(`/api/library/books/meta?lang=${lang}`);
  const stats = useRemote<BookStats>(`/api/library/books/stats?lang=${lang}`);
  const counts = meta.data?.lang === lang ? meta.data.counts : null;
  const categories = meta.data?.lang === lang ? meta.data.categories : [];
  const essentialCount = stats.data?.lang === lang ? stats.data.essential : null;

  const live = remote.data
    && remote.data.lang === lang
    && remote.data.page === page
    && remote.data.query === (searching ? committed.trim() : '')
    && remote.data.essential === (shelf === 'essential')
    && remote.data.format === format
    && remote.data.sort === sort
    && (remote.data.categoryId ?? null) === (category ? Number(category) : null)
    ? remote.data
    : null;

  const savedView = useMemo(() => {
    let rows = saved.books.filter(book => book.language === lang).map(cardFromSaved);
    if (searching) rows = rows.filter(card => bookMatches(card, committed));
    if (format === 'pdf') {
      const pdfIds = new Set(saved.books.filter(book => book.pdf).map(book => book.id));
      rows = rows.filter(card => pdfIds.has(card.id));
    }
    if (sort === 'title') rows = [...rows].sort((a, b) => a.title.localeCompare(b.title, lang, { sensitivity: 'base' }));
    const size = 24;
    const slice = rows.slice((page - 1) * size, page * size);
    return {
      items: slice,
      total: rows.length,
      pages: rows.length ? Math.ceil(rows.length / size) : 0,
      from: slice.length ? (page - 1) * size + 1 : 0,
      to: slice.length ? (page - 1) * size + slice.length : 0,
      featured: null as BookCard | null,
    };
  }, [saved.books, lang, searching, committed, format, sort, page]);

  const view = shelf === 'saved' ? savedView : live;
  const savedCount = saved.books.filter(book => book.language === lang).length;
  const preview = view?.items.find(item => item.id === detailsId) ?? view?.featured ?? saved.books.filter(book => book.id === detailsId).map(cardFromSaved)[0] ?? null;
  const showFeatured = shelf === 'all' && !searching && !category && format === 'any' && sort === 'newest' && page === 1 && view?.featured;

  function openDetails(id: number) {
    writeHash({ details: String(id) });
  }

  return (
    <div className="space-y-6">
      <header data-books-hero className="relative min-h-32 overflow-hidden rounded-3xl">
        <img
          src="/assets/geometric-mandala.jpg"
          alt=""
          className="pointer-events-none absolute -right-2 top-1/2 h-32 w-32 -translate-y-1/2 object-cover [mask-image:radial-gradient(circle,black_66%,transparent_74%)] sm:right-1 sm:h-40 sm:w-40"
        />
        <div className="relative max-w-[15rem] py-2 pr-2 sm:max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pine">The Dawwa Library</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-pine">Islamic Books</h1>
          <p className="mt-2 max-w-xs text-sm text-ink/70">Trusted knowledge, in the language of your heart.</p>
        </div>
      </header>

      {showFeatured && view?.featured && (
        <section className="overflow-hidden rounded-3xl bg-pine text-sand">
          <div className="grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[1fr_9.5rem]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Featured read</p>
              <h2 className="mt-2 font-display text-3xl font-bold leading-tight" lang={lang}>{view.featured.title}</h2>
              {cardCredit(view.featured) && <p className="mt-2 text-sm text-sand/80">{cardCredit(view.featured)}</p>}
              {view.featured.description && <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-relaxed text-sand/75" lang={lang}>{view.featured.description}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                <a href={`#/books/item/${view.featured.id}`} className="inline-flex min-h-11 items-center rounded-full bg-gold px-5 text-sm font-semibold text-pine">Read now</a>
                <button type="button" onClick={() => openDetails(view.featured!.id)} className="inline-flex min-h-11 items-center rounded-full border border-gold/70 px-5 text-sm font-medium text-sand">
                  Book details
                </button>
              </div>
            </div>
            <div className="featured-cover-stage mx-auto w-36">
              <BookCover title={view.featured.title} image={null} essential={view.featured.essential} mark="dawwa" />
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {LANGS.map(code => {
          const count = counts?.[code];
          const selected = lang === code;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setLang(code);
                writeHash({ page: null, details: null });
              }}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left ${selected ? 'border-gold bg-white shadow-sm' : 'border-pine/10 bg-parchment'}`}
            >
              <span>
                <span className="block font-display text-lg font-bold text-pine">{LANGUAGE_NAMES[code].native}</span>
                <span className="text-xs text-muted">{LANGUAGE_NAMES[code].english}</span>
              </span>
              <span className="text-sm font-medium text-pine">{count == null ? '…' : `${count.toLocaleString('en-US')} books`}</span>
            </button>
          );
        })}
      </div>
      {meta.error && <ErrorNote message={meta.error} onRetry={meta.reload} />}

      <div className="flex flex-wrap gap-2 border-b border-pine/10">
        {([
          ['all', 'All books', counts?.[lang] ?? null],
          ['essential', 'Essential', essentialCount],
          ['saved', 'Saved', savedCount],
        ] as const).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            aria-pressed={shelf === id}
            onClick={() => writeHash({ shelf: id === 'all' ? null : id, page: null, details: null })}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${shelf === id ? 'border-gold text-pine' : 'border-transparent text-muted'}`}
          >
            {label}{count != null ? ` ${count.toLocaleString('en-US')}` : ''}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search by title, author or topic</span>
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by title, author or topic"
            className="w-full rounded-full border border-pine/20 bg-white px-4 py-2.5 text-sm"
          />
        </label>
        <label className="text-sm text-muted">
          <span className="mr-2">Category</span>
          <select
            value={shelf === 'saved' ? '' : category}
            disabled={shelf === 'saved'}
            onChange={event => writeHash({ category: event.target.value || null, page: null, details: null })}
            className="rounded-full border border-pine/20 bg-white px-3 py-2 text-sm text-ink disabled:opacity-50"
          >
            <option value="">All categories</option>
            {categories.map(item => (
              <option key={item.id} value={item.id}>{item.title} ({item.books.toLocaleString('en-US')})</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          <span className="mr-2">Format</span>
          <select
            value={format}
            onChange={event => writeHash({ format: event.target.value === 'pdf' ? 'pdf' : null, page: null })}
            className="rounded-full border border-pine/20 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="any">Any format</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          <span className="mr-2">Sort</span>
          <select
            value={sort}
            onChange={event => writeHash({ sort: event.target.value === 'title' ? 'title' : null, page: null })}
            className="rounded-full border border-pine/20 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="newest">Newest</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>
      {committed.trim().length > 0 && !searching && <p className="text-sm text-muted">Type at least 3 characters to search.</p>}

      {shelf !== 'saved' && remote.loading && !live && <Loading label="Opening the library" />}
      {shelf !== 'saved' && remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}

      {view && (
        <>
          <p className="text-sm text-ink/70">
            The collection{' '}
            {view.total == null
              ? `${view.items.length.toLocaleString('en-US')} shown, with more matches still unread`
              : view.total === 0
                ? '0 books'
                : `${view.from.toLocaleString('en-US')}–${view.to.toLocaleString('en-US')} of ${view.total.toLocaleString('en-US')}`}
          </p>
          {view.items.length === 0 && (
            <p className="rounded-2xl bg-parchment px-4 py-6 text-sm text-ink/75">
              {shelf === 'saved' ? 'No saved books in this language.' : searching ? 'No books match that search.' : 'No books in this catalogue.'}
            </p>
          )}
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {view.items.map(item => (
              <BookTile key={item.id} item={item} lang={lang} onDetails={() => openDetails(item.id)} />
            ))}
          </ul>
          {view.pages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <button type="button" disabled={page <= 1} onClick={() => writeHash({ page: page > 2 ? String(page - 1) : null })} className="min-h-11 rounded-full border border-pine/20 px-4 text-sm font-medium text-pine disabled:opacity-40">
                Previous
              </button>
              <span className="text-sm text-muted">Page {page} of {view.pages}</span>
              <button type="button" disabled={page >= view.pages} onClick={() => writeHash({ page: String(page + 1) })} className="min-h-11 rounded-full border border-pine/20 px-4 text-sm font-medium text-pine disabled:opacity-40">
                Next
              </button>
            </div>
          )}
        </>
      )}

      {Number.isInteger(detailsId) && detailsId > 0 && (
        <BookDetails
          id={detailsId}
          lang={lang}
          preview={preview}
          onClose={() => writeHash({ details: null })}
          onOpenLanguage={(nextLang, nextId) => {
            setLang(nextLang);
            writeHash({ details: String(nextId), page: null });
          }}
        />
      )}
    </div>
  );
}

function BookTile({ item, lang, onDetails }: { item: BookCard; lang: Lang; onDetails: () => void }) {
  const language = item.language === 'ta' || item.language === 'si' || item.language === 'en' ? item.language : lang;
  const credit = authorLine(item) ?? item.publisher;
  return (
    <li className="min-w-0">
      <button type="button" onClick={onDetails} className="block w-full text-left">
        <BookCover title={item.title} image={item.image} essential={item.essential} />
      </button>
      <h3 className="mt-2 line-clamp-2 font-display text-sm font-bold leading-snug text-pine" lang={language}>
        <button type="button" onClick={onDetails} className="text-left">{item.title}</button>
      </h3>
      {credit && <p className="mt-1 line-clamp-2 text-xs text-ink/70">{credit}</p>}
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">{LANGUAGE_NAMES[language].english}</p>
      <div className="mt-2 flex items-center gap-2">
        <a href={`#/books/item/${item.id}`} className="inline-flex min-h-9 items-center rounded-full bg-moss px-3 text-xs font-semibold text-white">Read</a>
        <button type="button" onClick={onDetails} className="text-xs font-medium text-pine">Details</button>
      </div>
    </li>
  );
}

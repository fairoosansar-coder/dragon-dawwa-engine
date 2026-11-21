import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { useApp } from '../../lib/store.tsx';
import { useQuranEdition } from '../../lib/quranEdition.ts';
import {
  catalogueBookToHit,
  libraryVerseHit,
  looksLikeVerseRef,
  normalizeLibraryQuery,
  parseLibraryVerseRef,
  type LibraryBookHit,
  type LibrarySearchHit,
} from '../../lib/librarySearch.ts';
import type { SurahInfo } from '../../shared/types.ts';
import type { BookShelfResponse } from '../../shared/bookShelf.ts';
import { LANGUAGE_NAMES } from '../../shared/sources.ts';
import { useRemote } from '../../lib/api.ts';
import { ErrorNote, Loading } from '../ui.tsx';

const SESSION_QUERY_KEY = 'kf-hub-library-search-q';

function readSessionQuery(): string {
  try {
    return sessionStorage.getItem(SESSION_QUERY_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeSessionQuery(value: string) {
  try {
    if (value) sessionStorage.setItem(SESSION_QUERY_KEY, value);
    else sessionStorage.removeItem(SESSION_QUERY_KEY);
  } catch {
    /* ignore */
  }
}

export function LibrarySearchBar({ surahs }: { surahs: SurahInfo[] | null }) {
  const { lang } = useApp();
  const quranEdition = useQuranEdition();
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(() => readSessionQuery());
  const [debounced, setDebounced] = useState(() => normalizeLibraryQuery(readSessionQuery()));
  const [activeIndex, setActiveIndex] = useState(-1);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(normalizeLibraryQuery(query));
      writeSessionQuery(query);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debounced, lang]);

  const verseParse = surahs?.length ? parseLibraryVerseRef(debounced, surahs) : null;
  const verseHit =
    verseParse?.ok && quranEdition.editionKey
      ? libraryVerseHit(verseParse, lang, quranEdition.editionKey)
      : null;

  const titleQuery =
    !verseHit && !looksLikeVerseRef(debounced) && debounced.length >= 3 ? debounced : '';
  const catalogueUrl = titleQuery
    ? `/api/library/books?lang=${lang}&page=1&q=${encodeURIComponent(titleQuery)}&sort=title`
    : null;
  const catalogue = useRemote<BookShelfResponse>(catalogueUrl);

  // Ignore stale catalogue payloads when the debounced query advanced mid-flight.
  const stale = catalogueUrl != null && catalogue.data && catalogue.data.query !== titleQuery;
  const bookHits: LibraryBookHit[] =
    !stale && catalogue.data?.lang === lang && Array.isArray(catalogue.data.items)
      ? catalogue.data.items.map(item => catalogueBookToHit(item, lang))
      : [];

  const hits: LibrarySearchHit[] = verseHit ? [verseHit] : bookHits;
  const showLoading = Boolean(titleQuery) && catalogue.loading && !stale;
  const showCatalogueError = Boolean(titleQuery) && catalogue.error && !catalogue.loading;
  const showNoResults =
    Boolean(titleQuery) && !catalogue.loading && !catalogue.error && !stale && bookHits.length === 0;

  function openHit(hit: LibrarySearchHit) {
    setFeedback(null);
    window.location.hash = hit.hash;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = normalizeLibraryQuery(query);
    if (!trimmed) {
      setFeedback('Enter a Qur’an reference (e.g. 18:10) or a book title (3+ characters).');
      return;
    }
    if (surahs?.length) {
      const parsed = parseLibraryVerseRef(trimmed, surahs);
      if (parsed.ok) {
        if (!quranEdition.editionKey) {
          setFeedback('Meaning edition is still loading — try again in a moment.');
          return;
        }
        openHit(libraryVerseHit(parsed, lang, quranEdition.editionKey));
        return;
      }
      if (parsed.reason === 'invalid_bounds') {
        setFeedback(parsed.message);
        return;
      }
    }
    if (looksLikeVerseRef(trimmed) && verseParse && !verseParse.ok && verseParse.reason === 'invalid_bounds') {
      setFeedback(verseParse.message);
      return;
    }
    if (trimmed.length < 3) {
      setFeedback('Book title search needs at least 3 characters.');
      return;
    }
    if (hits[0]) {
      openHit(hits[0]);
      return;
    }
    if (showNoResults) setFeedback('No matching book titles in this language.');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setQuery('');
      setFeedback(null);
      setActiveIndex(-1);
      inputRef.current?.focus();
      return;
    }
    if (!hits.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => (index + 1) % hits.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => (index <= 0 ? hits.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0 && hits[activeIndex]) {
      event.preventDefault();
      openHit(hits[activeIndex]!);
    }
  }

  return (
    <section
      data-testid="hub-library-search"
      aria-label="Search the library"
      className="rounded-2xl border border-[#D4AF37]/35 bg-[#FAF9F4] p-4 shadow-[0_8px_24px_rgba(6,73,54,0.06)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-wall-en text-lg font-semibold text-[#193C31]">Search the library</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[#284638]/80">
            Qur’an references (e.g. 18:10) and book titles. Separate from Ask a research question.
          </p>
        </div>
      </div>
      <form className="mt-3" onSubmit={onSubmit} role="search">
        <label htmlFor={inputId} className="sr-only">
          Search the library for a Qur’an verse or book title
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#193C31]/55" aria-hidden />
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              value={query}
              autoComplete="off"
              spellCheck={false}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
              placeholder="18:10 or a book title…"
              onChange={event => {
                setQuery(event.target.value);
                setFeedback(null);
              }}
              onKeyDown={onKeyDown}
              className="w-full rounded-full border border-[#193C31]/20 bg-white py-2.5 pl-10 pr-4 text-sm text-[#203E32] outline-none ring-[#A78E55] focus:ring-2"
              data-testid="hub-library-search-input"
            />
          </div>
          <button
            type="submit"
            data-testid="hub-library-search-submit"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-[#073C30] px-4 text-sm font-semibold text-[#F9E7B9]"
          >
            Search
          </button>
          {query && (
            <button
              type="button"
              data-testid="hub-library-search-clear"
              onClick={() => {
                setQuery('');
                setFeedback(null);
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-[#193C31]/20 px-3 text-sm font-medium text-[#193C31]"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {verseParse && !verseParse.ok && verseParse.reason === 'invalid_bounds' && debounced && (
        <p className="mt-2 text-sm text-amber-900" data-testid="hub-library-search-invalid-ref" role="status">
          {verseParse.message}
        </p>
      )}
      {feedback && (
        <p className="mt-2 text-sm text-amber-900" data-testid="hub-library-search-feedback" role="status">
          {feedback}
        </p>
      )}
      {showLoading && (
        <div className="mt-3">
          <Loading label="Searching titles" />
        </div>
      )}
      {showCatalogueError && (
        <div className="mt-3" data-testid="hub-library-search-outage">
          <ErrorNote message={catalogue.error || 'Catalogue unavailable'} onRetry={catalogue.reload} />
          <p className="mt-1 text-xs text-muted">Live catalogue failure — fixtures are not a substitute for upstream availability.</p>
        </div>
      )}
      {showNoResults && (
        <p className="mt-3 text-sm text-ink/75" data-testid="hub-library-search-empty" role="status">
          No book titles matched “{titleQuery}” in {LANGUAGE_NAMES[lang].english}.
        </p>
      )}

      {hits.length > 0 && (
        <ul id={listId} role="listbox" className="mt-3 space-y-2" data-testid="hub-library-search-results">
          {hits.map((hit, index) => {
            const active = index === activeIndex;
            if (hit.kind === 'verse') {
              return (
                <li key={`verse-${hit.surah}-${hit.ayah}`} role="option" id={`${listId}-option-${index}`} aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => openHit(hit)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${active ? 'border-gold bg-white' : 'border-pine/10 bg-white/80'}`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-pine">Qur’an</span>
                    <span className="mt-0.5 block font-medium text-pine">
                      {hit.surahName} {hit.surah}:{hit.ayah}
                    </span>
                  </button>
                </li>
              );
            }
            return (
              <li key={`book-${hit.id}-${hit.language}`} role="option" id={`${listId}-option-${index}`} aria-selected={active}>
                <button
                  type="button"
                  onClick={() => openHit(hit)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${active ? 'border-gold bg-white' : 'border-pine/10 bg-white/80'}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-pine">Book</span>
                  <span className="mt-0.5 block font-medium text-pine" lang={hit.language}>
                    {hit.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {LANGUAGE_NAMES[hit.language].english}
                    {hit.publicationLanguage ? ` · pub ${hit.publicationLanguage}` : ''}
                    {hit.editionNote ? ` · ${hit.editionNote}` : ''}
                    {hit.author ? ` · ${hit.author}` : ''}
                    {` · #${hit.id}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

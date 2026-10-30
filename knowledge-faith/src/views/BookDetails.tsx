import { useEffect } from 'react';
import { X } from 'lucide-react';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';
import { authorLine, hasPdf, type BookCard, type BookDetail } from '../shared/bookShelf.ts';
import { useRemote } from '../lib/api.ts';
import { useSavedBooks, savedFromCard } from '../lib/savedBooks.ts';
import { BookCover } from './BookCover.tsx';

export function BookDetails({
  id,
  lang,
  preview,
  onClose,
  onOpenLanguage,
}: {
  id: number;
  lang: Lang;
  preview: BookCard | null;
  onClose: () => void;
  onOpenLanguage: (lang: Lang, id: number) => void;
}) {
  const remote = useRemote<BookDetail>(`/api/library/books/${id}?lang=${lang}`);
  const book = remote.data?.lang === lang && remote.data.book?.id === id ? remote.data.book : preview?.id === id ? preview : null;
  const translations = (remote.data?.lang === lang ? remote.data.translations : []).filter(item => item.lang !== lang);
  const { has, toggle } = useSavedBooks();
  const saved = book ? has(book.id) : false;
  const language = book?.language === 'ta' || book?.language === 'si' || book?.language === 'en' ? book.language : lang;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const credits = book
    ? [
        ['Author', book.authors],
        ['Translator', book.translators],
        ['Reviewer', book.reviewers],
        ['Publisher', book.publisher ? [book.publisher] : []],
      ].filter((row): row is [string, string[]] => Array.isArray(row[1]) && row[1].length > 0)
    : [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-pine/40" role="presentation" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-details-title"
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-sand shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-pine/10 bg-sand px-5 py-4">
          <h2 id="book-details-title" className="font-display text-lg font-bold text-pine">Book details</h2>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-pine hover:bg-mint" aria-label="Close book details">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        <div className="space-y-6 px-5 py-5">
          {remote.loading && !book && <p className="text-sm text-muted">Opening book details</p>}
          {remote.error && !book && <p className="text-sm text-red-900">{remote.error}</p>}
          {book && (
            <>
              <div className="flex gap-4">
                <div className="w-28 shrink-0">
                  <BookCover title={book.title} image={book.image} essential={book.essential} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-bold leading-snug text-pine" lang={language}>{book.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {book.essential && <span className="rounded-full border border-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pine">Essential</span>}
                    <span className="rounded-full border border-pine/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pine">{LANGUAGE_NAMES[language].english}</span>
                    {hasPdf(book) && <span className="rounded-full border border-pine/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pine">PDF</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`#/books/item/${book.id}`} className="inline-flex min-h-11 items-center rounded-full bg-moss px-5 text-sm font-semibold text-white">Read</a>
                <button
                  type="button"
                  aria-pressed={saved}
                  onClick={() => toggle(savedFromCard(book, language))}
                  className="inline-flex min-h-11 items-center rounded-full border border-pine/20 px-5 text-sm font-semibold text-pine"
                >
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>
              <a href={`#/books/research?book=${book.id}`} className="inline-flex text-sm font-medium text-pine underline decoration-gold underline-offset-4">
                Research this book
              </a>
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-pine">About this book</h4>
                <p className="mt-2 text-sm leading-relaxed text-ink/80" lang={language}>
                  {book.description || 'No description has been published for this book yet.'}
                </p>
              </section>
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-pine">Prepared by</h4>
                {credits.length === 0 && <p className="mt-2 text-sm text-ink/75">The source did not name an author or publisher.</p>}
                <dl className="mt-2 space-y-2 text-sm">
                  {credits.map(([role, people]) => (
                    <div key={role} className="grid grid-cols-[6.5rem_1fr] gap-2">
                      <dt className="text-muted">{role}</dt>
                      <dd className="text-ink" lang={language}>{people.join(', ')}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              {book.files.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-pine">Files</h4>
                  <ul className="mt-2 space-y-2">
                    {book.files.map(file => (
                      <li key={file.url} className="flex items-center justify-between gap-3 rounded-2xl border border-pine/10 bg-white px-3 py-2">
                        <span className="min-w-0">
                          <span className="text-xs font-semibold uppercase text-pine">{file.extension}</span>
                          {file.size && <span className="mt-0.5 block text-xs text-muted">{file.size}</span>}
                        </span>
                        <span className="flex shrink-0 gap-3 text-sm font-medium">
                          <a href={`#/books/item/${book.id}`} className="text-pine">Read</a>
                          <a href={file.url} target="_blank" rel="noreferrer" className="text-pine">Download</a>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {translations.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-pine">Also available in</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {translations.map(item => (
                      <button
                        key={item.lang}
                        type="button"
                        onClick={() => onOpenLanguage(item.lang, item.id)}
                        className="rounded-full border border-pine/15 px-3 py-1.5 text-sm text-pine"
                      >
                        {LANGUAGE_NAMES[item.lang].native}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {remote.data?.limitation && !remote.data.book && <p className="text-sm text-ink/75">{remote.data.limitation}</p>}
              <p className="rounded-2xl bg-parchment px-4 py-3 text-xs leading-relaxed text-ink/70">
                Published by IslamHouse. The text is shown as published by its authors and translators.
                {book.sourceUrl && (
                  <>
                    {' '}
                    <a href={book.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-pine underline">View on IslamHouse</a>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export function cardCredit(card: BookCard): string | null {
  return authorLine(card) ?? card.publisher;
}

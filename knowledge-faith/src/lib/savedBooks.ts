import type { Lang } from '../shared/sources.ts';
import { authorLine, hasPdf, type BookCard } from '../shared/bookShelf.ts';
import { useStored } from './store.tsx';

export interface SavedBook {
  id: number;
  title: string;
  author: string | null;
  language: Lang;
  image: string | null;
  essential: boolean;
  pdf: boolean;
  description: string | null;
  publisher: string | null;
}

const KEY = 'kf-saved-books';

function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'ta' || value === 'si';
}

function isSaved(value: unknown): value is SavedBook {
  if (!value || typeof value !== 'object') return false;
  const row = value as SavedBook;
  return Number.isInteger(row.id) && row.id > 0 && typeof row.title === 'string' && isLang(row.language);
}

export function savedFromCard(card: BookCard, lang: Lang): SavedBook {
  const language = isLang(card.language) ? card.language : lang;
  return {
    id: card.id,
    title: card.title,
    author: authorLine(card),
    language,
    image: card.image,
    essential: card.essential,
    pdf: hasPdf(card),
    description: card.description,
    publisher: card.publisher,
  };
}

export function cardFromSaved(book: SavedBook): BookCard {
  return {
    id: book.id,
    title: book.title,
    description: book.description,
    language: book.language,
    image: book.image,
    importance: book.essential ? 'critical' : null,
    essential: book.essential,
    authors: book.author ? [book.author] : [],
    translators: [],
    reviewers: [],
    publisher: book.publisher,
    added: null,
    files: [],
    sourceUrl: null,
  };
}

export function useSavedBooks() {
  const [stored, setStored] = useStored<SavedBook[]>(KEY, []);
  const books = (Array.isArray(stored) ? stored : []).filter(isSaved);
  function toggle(book: SavedBook) {
    setStored(current => {
      const list = (Array.isArray(current) ? current : []).filter(isSaved);
      return list.some(item => item.id === book.id) ? list.filter(item => item.id !== book.id) : [book, ...list];
    });
  }
  function has(id: number) {
    return books.some(item => item.id === id);
  }
  return { books, toggle, has };
}

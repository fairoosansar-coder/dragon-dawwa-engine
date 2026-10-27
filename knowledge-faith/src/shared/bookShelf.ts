import { visibleText } from './readableText.ts';
import { LANGS, type Lang } from './sources.ts';
import { islamHousePage, parseLibraryItem, type LibraryItem } from './islamhouse.ts';
import type { LibraryBlock } from './libraryDocument.ts';

export const BOOK_PAGE_SIZE = 24;
export const SEARCH_PAGE_SIZE = 20;

export interface BookFile {
  extension: string;
  url: string;
  label: string | null;
  size: string | null;
}

export interface BookCard {
  id: number;
  title: string;
  description: string | null;
  language: string | null;
  image: string | null;
  importance: string | null;
  essential: boolean;
  authors: string[];
  translators: string[];
  reviewers: string[];
  publisher: string | null;
  added: string | null;
  files: BookFile[];
  sourceUrl: string | null;
}

export interface BookTranslation {
  lang: Lang;
  id: number;
}

export interface BookShelfResponse {
  lang: Lang;
  page: number;
  pages: number;
  total: number | null;
  from: number;
  to: number;
  query: string;
  categoryId: number | null;
  essential: boolean;
  format: 'any' | 'pdf';
  sort: 'newest' | 'title';
  items: BookCard[];
  featured: BookCard | null;
}

export interface BookMeta {
  lang: Lang;
  counts: Record<Lang, number | null>;
  categories: { id: number; title: string; books: number }[];
}

export interface BookStats {
  lang: Lang;
  essential: number | null;
  pdf: number | null;
}

export interface BookDetail {
  lang: Lang;
  book: BookCard | null;
  translations: BookTranslation[];
  limitation: string | null;
}

export interface ReaderBlock {
  id: string;
  kind: 'heading' | 'paragraph' | 'footnote';
  text: string;
}

function names(item: LibraryItem, kind: string): string[] {
  return item.credits.filter(credit => credit.kind === kind && credit.name).map(credit => credit.name as string);
}

export function bookCard(item: LibraryItem): BookCard {
  const authors = names(item, 'author');
  const publisher = item.credits.find(credit => credit.kind === 'publisher' && credit.name)?.name ?? null;
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    language: item.language,
    image: item.image,
    importance: item.importance,
    essential: item.importance === 'critical',
    authors,
    translators: names(item, 'translator'),
    reviewers: names(item, 'reviewer'),
    publisher,
    added: item.added,
    files: item.files.map(file => ({
      extension: file.extension,
      url: file.url,
      label: file.label,
      size: file.size,
    })),
    sourceUrl: item.sourceUrl,
  };
}

export function hasPdf(card: Pick<BookCard, 'files'>): boolean {
  return card.files.some(file => file.extension.toUpperCase() === 'PDF');
}

export function bookMatches(card: Pick<BookCard, 'title' | 'description' | 'authors' | 'translators' | 'publisher'>, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length < 3) return true;
  const haystack = [card.title, card.description ?? '', card.publisher ?? '', ...card.authors, ...card.translators].join('\n').toLocaleLowerCase();
  return haystack.includes(needle);
}

export function authorLine(card: Pick<BookCard, 'authors'>): string | null {
  const names = card.authors.map(name => name.trim()).filter(Boolean);
  return names.length ? names.join(', ') : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function positive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** A books list from `main/books` or a category list. An empty language is an empty shelf. */
export function parseBookList(body: unknown, lang: Lang, page: number): { page: number; pages: number; total: number; items: LibraryItem[] } | null {
  const row = record(body);
  if (!row) return null;
  if (typeof row.error === 'string') {
    if (/no data|no category/i.test(row.error)) return { page, pages: 0, total: 0, items: [] };
    return null;
  }
  if (!Array.isArray(row.data)) return null;
  const links = record(row.links) ?? {};
  const pages = Number(links.pages_number);
  const total = Number(links.total_items);
  const items: LibraryItem[] = [];
  for (const item of row.data) {
    const parsed = parseLibraryItem(item, lang);
    if (!parsed) return null;
    items.push(parsed);
  }
  return {
    page,
    pages: Number.isInteger(pages) && pages >= 0 ? pages : items.length ? 1 : 0,
    total: Number.isInteger(total) && total >= 0 ? total : items.length,
    items,
  };
}

export function topCategories(body: unknown): { id: number; title: string }[] {
  const row = record(body);
  const list = row && Array.isArray(row.sub_categories) ? row.sub_categories : [];
  const categories: { id: number; title: string }[] = [];
  for (const item of list) {
    const child = record(item);
    if (!child) continue;
    const id = positive(child.id) ?? positive(child.source_id);
    const title = typeof child.title === 'string' ? child.title.trim() : '';
    if (!id || !title) continue;
    categories.push({ id, title });
  }
  return categories;
}

export function translationChoices(body: unknown): BookTranslation[] {
  if (!Array.isArray(body)) return [];
  const found = new Map<Lang, number>();
  for (const item of body) {
    const row = record(item);
    if (!row) continue;
    const slang = typeof row.slang === 'string' ? row.slang : '';
    const id = positive(row.id) ?? positive(row.source_id);
    if (!id || (slang !== 'en' && slang !== 'ta' && slang !== 'si')) continue;
    if (!found.has(slang)) found.set(slang, id);
  }
  return LANGS.filter(lang => found.has(lang)).map(lang => ({ lang, id: found.get(lang) as number }));
}

export interface SearchHit {
  id: number;
  title: string;
  description: string | null;
}

export interface SearchPage {
  numFound: number;
  from: number;
  to: number;
  showMore: boolean;
  hits: SearchHit[];
}

/** IslamHouse search.php returns titles wrapped in HTML. Tags are removed. */
export function parseSearchPage(body: unknown): SearchPage | null {
  const row = record(body);
  if (!row || !Array.isArray(row.items)) return null;
  const numFound = Number(row.numFound);
  if (!Number.isInteger(numFound) || numFound < 0) return null;
  const hits: SearchHit[] = [];
  for (const item of row.items) {
    const hit = record(item);
    if (!hit) continue;
    const id = positive(hit.id);
    if (!id) continue;
    const title = visibleText(typeof hit.title === 'string' ? hit.title : '');
    if (!title) continue;
    const description = typeof hit.nabza === 'string' ? visibleText(hit.nabza) : null;
    hits.push({ id, title, description: description || null });
  }
  const from = Number(row.from);
  const to = Number(row.to);
  return {
    numFound,
    from: Number.isInteger(from) && from > 0 ? from : hits.length ? 1 : 0,
    to: Number.isInteger(to) && to >= 0 ? to : hits.length,
    showMore: row.showMore === true,
    hits,
  };
}

export function thinCard(hit: SearchHit, lang: Lang): BookCard {
  return {
    id: hit.id,
    title: hit.title,
    description: hit.description,
    language: lang,
    image: null,
    importance: null,
    essential: false,
    authors: [],
    translators: [],
    reviewers: [],
    publisher: null,
    added: null,
    files: [],
    sourceUrl: islamHousePage(lang, 'books', hit.id),
  };
}

const ARABIC = /[\u0600-\u06FF]/;

export function mostlyArabic(text: string): boolean {
  const letters = text.replace(/\s/g, '');
  if (!letters) return false;
  const arabic = letters.match(/[\u0600-\u06FF]/g)?.length ?? 0;
  return arabic / letters.length > 0.35;
}

/** Split a PDF line where Arabic and Latin run together without a break. */
export function splitScripts(line: string): string[] {
  const parts: string[] = [];
  let buf = '';
  let arabic: boolean | null = null;
  const flush = () => {
    const text = buf.replace(/\s+/g, ' ').trim();
    buf = '';
    if (text) parts.push(text);
  };
  for (const char of line) {
    const isArabic = ARABIC.test(char);
    const isLatin = /[A-Za-z]/.test(char);
    if (!isArabic && !isLatin) {
      buf += char;
      continue;
    }
    if (arabic === null) arabic = isArabic;
    else if (arabic !== isArabic) {
      flush();
      arabic = isArabic;
    }
    buf += char;
  }
  flush();
  return parts.length ? parts : [line.trim()].filter(Boolean);
}

export interface PdfTextPiece {
  str: string;
  x: number;
  y: number;
  width: number;
}

/** Rebuild page text from positioned PDF items. A new baseline starts a line; a gap starts a space. */
export function textFromPdfItems(items: PdfTextPiece[]): string {
  const parts: string[] = [];
  let last: PdfTextPiece | null = null;
  for (const item of items) {
    if (!item.str) continue;
    if (last) {
      if (Math.abs(item.y - last.y) > 3) parts.push('\n');
      else {
        const gap = item.x - (last.x + last.width);
        const tight = /[\s-]$/.test(last.str) || /^[\s-]/.test(item.str);
        if (gap > 1.2 && !tight) parts.push(' ');
      }
    }
    parts.push(item.str);
    last = item;
  }
  return parts.join('');
}

function headingLike(line: string): boolean {
  const words = line.split(/\s+/);
  return words.length <= 3 && line.length <= 32 && !/[,:;]$/.test(line);
}

/** Join wrapped PDF lines into headings and paragraphs. Page numbers are dropped. */
export function reflowPage(raw: string): { kind: 'heading' | 'paragraph'; text: string }[] {
  const lines = raw
    .split(/\n/)
    .flatMap(line => splitScripts(line.replace(/[\u202a-\u202e\u200e\u200f]/g, '')))
    .map(line => line.replace(/[ \t]+/g, ' ').replace(/^\d{1,4}(?=\s|[\u0600-\u06FF])/, '').trim())
    .filter(line => line && !/^\d{1,4}$/.test(line));
  const blocks: { kind: 'heading' | 'paragraph'; text: string }[] = [];
  let buffer = '';

  const continues = (prev: string, next: string) => {
    if (mostlyArabic(prev) !== mostlyArabic(next)) return false;
    if (headingLike(next) && !/[,:;]$/.test(prev)) return false;
    if (/[.!?]"?$/.test(prev) && !/^[a-z“"(]/.test(next)) return false;
    if (/[,:;]$/.test(prev) || /^[a-z“"(]/.test(next)) return true;
    return prev.split(/\s+/).length >= 4;
  };

  const flush = () => {
    const text = buffer.replace(/\s+/g, ' ').trim();
    buffer = '';
    if (!text) return;
    const heading = !mostlyArabic(text) && text.length <= 80 && text.split(/\s+/).length <= 14 && !/[.!?]$/.test(text);
    blocks.push({ kind: heading ? 'heading' : 'paragraph', text });
  };

  for (const line of lines) {
    if (!buffer) {
      buffer = line;
      continue;
    }
    if (continues(buffer, line)) {
      buffer = /-$/.test(buffer) ? `${buffer}${line}` : `${buffer} ${line}`;
    } else {
      flush();
      buffer = line;
    }
  }
  flush();
  return blocks;
}

/** Group article blocks into reader pages without splitting a heading from the page it introduces. */
export function paginateBlocks(blocks: LibraryBlock[], maxChars = 1300): LibraryBlock[][] {
  const pages: LibraryBlock[][] = [];
  let page: LibraryBlock[] = [];
  let size = 0;
  for (const block of blocks) {
    const length = block.text.length + 1;
    const overflow = page.length > 0 && size + length > maxChars;
    const headingBreak = block.kind === 'heading' && page.length > 0 && size > maxChars * 0.55;
    if (overflow || headingBreak) {
      pages.push(page);
      page = [];
      size = 0;
    }
    page.push(block);
    size += length;
  }
  if (page.length) pages.push(page);
  return pages;
}

export function pagesFromPdf(pageTexts: string[]): { blocks: ReaderBlock[] }[] {
  return pageTexts.map((raw, pageIndex) => {
    const blocks = reflowPage(raw).map((block, index) => ({
      id: `p${pageIndex + 1}-b${index + 1}`,
      kind: block.kind,
      text: block.text,
    }));
    if (blocks.length) return { blocks };
    return {
      blocks: [{ id: `p${pageIndex + 1}-empty`, kind: 'paragraph' as const, text: 'This page has no extractable text. It may be a cover or an image in the publication file.' }],
    };
  });
}

export function pagesFromBlocks(blocks: LibraryBlock[]): { blocks: ReaderBlock[] }[] {
  return paginateBlocks(blocks).map((page, pageIndex) => ({
    blocks: page.map((block, index) => ({
      id: block.id || `p${pageIndex + 1}-b${index + 1}`,
      kind: block.kind,
      text: block.text,
    })),
  }));
}

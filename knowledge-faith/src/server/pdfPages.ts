import { readMedia, allowedMediaUrl } from './media.ts';
import { pagesFromBlocks, pagesFromPdf, textFromPdfItems } from '../shared/bookShelf.ts';
import type { ReaderBlock } from '../shared/bookShelf.ts';
import type { LibraryDocument } from '../shared/libraryDocument.ts';

interface PdfTextItem {
  str?: string;
  width?: number;
  transform?: number[];
}

interface PdfDoc {
  numPages: number;
  getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>;
  destroy?: () => Promise<void>;
}

const cache = new Map<string, { expires: number; pages: { blocks: ReaderBlock[] }[] }>();
const inflight = new Map<string, Promise<{ blocks: ReaderBlock[] }[]>>();
const TTL_MS = 10 * 60_000;
const MAX_DOCS = 6;

async function extract(data: Uint8Array): Promise<string[]> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as {
    getDocument: (src: { data: Uint8Array; disableWorker?: boolean; isEvalSupported?: boolean; useSystemFonts?: boolean }) => { promise: Promise<PdfDoc> };
  };
  const doc = await pdfjs.getDocument({ data, disableWorker: true, isEvalSupported: false, useSystemFonts: true }).promise;
  try {
    const pages: string[] = [];
    for (let number = 1; number <= doc.numPages; number += 1) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const pieces = content.items.map(item => {
        const row = item as PdfTextItem;
        const transform = row.transform ?? [];
        return { str: row.str ?? '', x: transform[4] ?? 0, y: transform[5] ?? 0, width: row.width ?? 0 };
      });
      pages.push(textFromPdfItems(pieces));
    }
    return pages;
  } finally {
    await doc.destroy?.();
  }
}

/** Article text is paged as prose. A PDF is paged from the publication file. */
export async function readingPages(document: Pick<LibraryDocument, 'blocks' | 'media'>): Promise<{ blocks: ReaderBlock[] }[]> {
  if (document.blocks.some(block => block.kind === 'paragraph')) return pagesFromBlocks(document.blocks);
  const pdf = document.media.find(file => file.kind === 'pdf');
  if (!pdf) return [];
  try {
    return await pdfReadingPages(pdf.sourceUrl);
  } catch {
    return [];
  }
}

/** Page text from an IslamHouse PDF. Empty when the file cannot be read. */
export async function pdfReadingPages(sourceUrl: string): Promise<{ blocks: ReaderBlock[] }[]> {
  const url = allowedMediaUrl(sourceUrl);
  if (!url) return [];
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.pages;
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = (async () => {
    const file = await readMedia(url);
    const texts = await extract(new Uint8Array(file.body));
    const pages = pagesFromPdf(texts);
    cache.set(key, { expires: Date.now() + TTL_MS, pages });
    while (cache.size > MAX_DOCS) cache.delete(cache.keys().next().value as string);
    return pages;
  })();
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

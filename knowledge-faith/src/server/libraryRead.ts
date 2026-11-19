import type { Lang } from '../shared/sources.ts';
import type { LibraryBlock, LibraryDocument, LibraryMedia } from '../shared/libraryDocument.ts';
import { articleBlocks } from '../shared/readableText.ts';
import { ISLAMHOUSE_RIGHTS } from '../shared/sourceRegistry.ts';
import { translateTextToLanguage } from './ayahStudyService.ts';
import { getCuratedLibraryDocument } from './curatedKnowledgePaths.ts';
import { UpstreamError } from './http.ts';
import { loadItemPayload, type ItemPayload } from './islamhouse.ts';
import { mediaViewUrl } from './media.ts';
import { contentHash, createContentIndex, type ContentIndex } from './research/contentIndex.ts';

const index: ContentIndex = createContentIndex();
export const LIBRARY_READER_PAGE_SIZE = 15;

function mediaKind(extension: string, play: 'audio' | 'video' | null): LibraryMedia['kind'] {
  if (extension.toUpperCase() === 'PDF') return 'pdf';
  if (play === 'audio' || play === 'video') return play;
  return 'file';
}

function limitation(item: ItemPayload, prose: boolean): string | null {
  if (prose) return null;
  const pdf = item.files.some(file => file.extension.toUpperCase() === 'PDF');
  const recording = item.files.some(file => file.play);
  if (pdf) {
    return 'The item API did not include the article or book text. The catalogue description is not the book. The PDF published by IslamHouse is shown in this page.';
  }
  if (recording) {
    return 'The item API did not include a written text. The original recording can be played here. The catalogue description is not a transcript.';
  }
  if (item.description) {
    return 'Full text was not in the item API, and no attachment was listed. The description below is the catalogue summary, not the work.';
  }
  return 'Full text was not in the item API, and no attachment was listed.';
}

const SINHALA_SCRIPT_RE = /[\u0D80-\u0DFF]/u;
const TAMIL_SCRIPT_RE = /[\u0B80-\u0BFF]/u;
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF]/u;

/**
 * Detect whether a text string is written in a different language script than `targetLang`.
 */
export function textNeedsTranslationToLang(text: string, targetLang: Lang): boolean {
  const sample = (text ?? '').trim();
  if (!sample) return false;
  const hasSinhala = SINHALA_SCRIPT_RE.test(sample);
  const hasTamil = TAMIL_SCRIPT_RE.test(sample);
  const hasArabic = ARABIC_SCRIPT_RE.test(sample);

  if (targetLang === 'en') {
    return hasSinhala || hasTamil || hasArabic;
  }
  if (targetLang === 'ta') {
    if (hasSinhala || hasArabic) return true;
    // Also translate English Latin text into Tamil when Tamil is selected
    if (!hasTamil && /[A-Za-z]{4,}/.test(sample)) return true;
    return false;
  }
  if (targetLang === 'si') {
    if (hasTamil || hasArabic) return true;
    // Also translate English Latin text into Sinhala when Sinhala is selected
    if (!hasSinhala && /[A-Za-z]{4,}/.test(sample)) return true;
    return false;
  }
  return false;
}

function detectSourceLang(text: string): string {
  if (SINHALA_SCRIPT_RE.test(text)) return 'si';
  if (TAMIL_SCRIPT_RE.test(text)) return 'ta';
  if (ARABIC_SCRIPT_RE.test(text)) return 'ar';
  return 'en';
}

async function translateLibraryBlocksSlice(
  blocks: LibraryBlock[],
  targetLang: Lang,
): Promise<LibraryBlock[]> {
  if (blocks.length === 0) return [];
  const translated = await Promise.all(
    blocks.map(async block => {
      if (!textNeedsTranslationToLang(block.text, targetLang)) {
        return block;
      }
      const srcLang = detectSourceLang(block.text);
      const tr = await translateTextToLanguage(block.text, targetLang, srcLang);
      return {
        ...block,
        text: tr || block.text,
      };
    }),
  );
  return translated;
}

export async function readLibraryItem(
  id: number,
  lang: Lang,
  now = new Date(),
  requestedPage?: number,
): Promise<LibraryDocument> {
  const curated = getCuratedLibraryDocument(id, lang, now);
  if (curated) {
    return {
      ...curated,
      page: 1,
      pageSize: curated.blocks.length || LIBRARY_READER_PAGE_SIZE,
      totalPages: 1,
      totalBlocks: curated.blocks.length,
    };
  }

  const retrievedAt = now.toISOString();
  let item: ItemPayload | null = null;

  // Try loading in the requested site language first, then fallback to other site languages if missing
  for (const candidateSiteLang of [lang, 'en', 'si', 'ta'] as const) {
    try {
      const lookup = await loadItemPayload(id, candidateSiteLang);
      if (lookup.ok) {
        item = lookup.item;
        break;
      }
    } catch {
      /* continue */
    }
  }

  if (!item) {
    return {
      id,
      title: '',
      language: null,
      requestedLanguage: lang,
      contentType: 'other',
      availability: 'source_unavailable',
      limitation: `No record was found for item ${id} in ${lang}.`,
      description: null,
      descriptionIsFullText: false,
      blocks: [],
      page: 1,
      pageSize: LIBRARY_READER_PAGE_SIZE,
      totalPages: 1,
      totalBlocks: 0,
      media: [],
      credits: [],
      canonicalUrl: null,
      added: null,
      updated: null,
      version: null,
      contentHash: null,
      retrievedAt,
      rights: ISLAMHOUSE_RIGHTS,
      index: 'new',
    };
  }

  let allBlocks = item.html ? articleBlocks(item.html) : [];
  if (allBlocks.length === 0 && item.description) {
    allBlocks = articleBlocks(`<p>${item.description}</p>`);
  }

  const totalBlocks = allBlocks.length;
  const prose = allBlocks.some(block => block.kind === 'paragraph');
  const media: LibraryMedia[] = item.files.map(file => {
    const kind = mediaKind(file.extension, file.play);
    return {
      kind,
      label: file.label,
      extension: file.extension,
      sourceUrl: file.url,
      viewUrl: mediaViewUrl(file.url, kind),
    };
  });

  // Paginate when a `requestedPage` is provided OR when the book has more than 24 blocks
  const requiresTranslation =
    textNeedsTranslationToLang(item.title, lang) ||
    Boolean(item.description && textNeedsTranslationToLang(item.description, lang)) ||
    allBlocks.slice(0, 6).some(b => textNeedsTranslationToLang(b.text, lang));
  const usePagination =
    (typeof requestedPage === 'number' && Number.isFinite(requestedPage) && requestedPage >= 1) ||
    totalBlocks > 24;

  const pageSize = LIBRARY_READER_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalBlocks / pageSize));
  const safePage = usePagination
    ? Math.max(1, Math.min(totalPages, Math.floor(requestedPage || 1)))
    : 1;

  const startIdx = usePagination ? (safePage - 1) * pageSize : 0;
  const endIdx = usePagination ? startIdx + pageSize : totalBlocks;
  const sliceToRender = allBlocks.slice(startIdx, endIdx);

  // Translate title, description, and the active page's blocks in parallel
  const [localizedTitle, localizedDescription, localizedBlocks] = await Promise.all([
    textNeedsTranslationToLang(item.title, lang)
      ? translateTextToLanguage(item.title, lang, 'auto')
      : Promise.resolve(item.title),
    item.description && textNeedsTranslationToLang(item.description, lang)
      ? translateTextToLanguage(item.description, lang, 'auto')
      : Promise.resolve(item.description),
    requiresTranslation
      ? translateLibraryBlocksSlice(sliceToRender, lang)
      : Promise.resolve(sliceToRender),
  ]);

  // Prefetch and warm the next page in the background so clicking "Next Chapter/Page" is instant!
  if (usePagination && requiresTranslation && safePage < totalPages) {
    const nextSlice = allBlocks.slice(endIdx, endIdx + pageSize);
    setImmediate(() => {
      void translateLibraryBlocksSlice(nextSlice, lang).catch(() => {});
    });
  }

  const version = item.updated ?? item.added ?? 'undated';
  const fingerprint = [
    item.title,
    item.description ?? '',
    ...allBlocks.map(block => block.text),
    ...media.map(file => file.sourceUrl),
  ].join('\n');
  const hash = contentHash(fingerprint);
  const key = `islamhouse:${item.id}:${lang}`;
  const status = index.status(key, version, hash);
  index.put(key, version, hash, fingerprint, retrievedAt);

  const credits = [
    ...item.authors.map(name => ({ role: 'author', name })),
    ...item.translators.map(name => ({ role: 'translator', name })),
    ...item.reviewers.map(name => ({ role: 'reviewer', name })),
  ];

  return {
    id: item.id,
    title: localizedTitle || item.title,
    language: lang,
    requestedLanguage: lang,
    contentType: item.type,
    availability: prose ? 'readable' : 'partial',
    limitation: limitation(item, prose),
    description: localizedDescription,
    descriptionIsFullText: false,
    blocks: localizedBlocks,
    page: safePage,
    pageSize: usePagination ? pageSize : totalBlocks || pageSize,
    totalPages: usePagination ? totalPages : 1,
    totalBlocks,
    media,
    credits,
    canonicalUrl: item.sourceUrl,
    image: item.image,
    added: item.added,
    updated: item.updated,
    version,
    contentHash: hash,
    retrievedAt,
    rights: ISLAMHOUSE_RIGHTS,
    index: status === 'stale' ? 'updated' : status === 'fresh' ? 'fresh' : 'new',
  };
}

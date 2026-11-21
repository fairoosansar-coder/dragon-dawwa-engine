import type { RightsMetadata } from './contracts/v1.ts';

export type LibraryAvailability = 'readable' | 'partial' | 'language_unavailable' | 'source_unavailable';

export interface LibraryBlock {
  id: string;
  kind: 'heading' | 'paragraph' | 'footnote';
  text: string;
}

export interface LibraryMedia {
  kind: 'pdf' | 'audio' | 'video' | 'file';
  label: string | null;
  extension: string;
  sourceUrl: string;
  /** Same-origin URL for PDF viewing. Audio and video keep the source URL. */
  viewUrl: string;
}

export interface LibraryCredit {
  role: string;
  name: string | null;
}

export interface LibraryDocument {
  id: number;
  title: string;
  /**
   * Language of the rendered reader content (after any translation).
   * Saved cards / shelf filters use this field.
   */
  language: string | null;
  requestedLanguage: string;
  /** Original publication language from the catalogue, when known. */
  publicationLanguage?: string | null;
  contentType: string;
  availability: LibraryAvailability;
  /** Precise limit. A catalogue description is never presented as the work. */
  limitation: string | null;
  description: string | null;
  descriptionIsFullText: false;
  blocks: LibraryBlock[];
  page?: number;
  pageSize?: number;
  totalPages?: number;
  totalBlocks?: number;
  media: LibraryMedia[];
  credits: LibraryCredit[];
  canonicalUrl: string | null;
  /** Cover from the catalogue, when one was published. */
  image?: string | null;
  added: string | null;
  updated: string | null;
  version: string | null;
  contentHash: string | null;
  retrievedAt: string;
  rights: RightsMetadata;
  index: 'fresh' | 'updated' | 'new';
  /**
   * How reader pages were produced when `pages=1` was requested.
   * `pdf` = original PDF page sequence; `text` = prepared/prose blocks; `none` = empty.
   */
  pageSource?: 'pdf' | 'text' | 'none';
  /** Attachment identity used for PDF extraction / PDF bookmarks (sourceUrl). */
  pageAttachmentId?: string | null;
}

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
  language: string | null;
  requestedLanguage: string;
  contentType: string;
  availability: LibraryAvailability;
  /** Precise limit. A catalogue description is never presented as the work. */
  limitation: string | null;
  description: string | null;
  descriptionIsFullText: false;
  blocks: LibraryBlock[];
  media: LibraryMedia[];
  credits: LibraryCredit[];
  canonicalUrl: string | null;
  added: string | null;
  updated: string | null;
  version: string | null;
  contentHash: string | null;
  retrievedAt: string;
  rights: RightsMetadata;
  index: 'fresh' | 'updated' | 'new';
}

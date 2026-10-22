import type { Lang } from '../shared/sources.ts';
import type { LibraryDocument, LibraryMedia } from '../shared/libraryDocument.ts';
import { articleBlocks } from '../shared/readableText.ts';
import { ISLAMHOUSE_RIGHTS } from '../shared/sourceRegistry.ts';
import { UpstreamError } from './http.ts';
import { loadItemPayload, type ItemPayload } from './islamhouse.ts';
import { mediaViewUrl } from './media.ts';
import { contentHash, createContentIndex, type ContentIndex } from './research/contentIndex.ts';

const index: ContentIndex = createContentIndex();

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

export async function readLibraryItem(id: number, lang: Lang, now = new Date()): Promise<LibraryDocument> {
  const retrievedAt = now.toISOString();
  let lookup;
  try {
    lookup = await loadItemPayload(id, lang);
  } catch (err) {
    const message = err instanceof UpstreamError ? err.message : 'IslamHouse did not respond.';
    return {
      id,
      title: '',
      language: null,
      requestedLanguage: lang,
      contentType: 'other',
      availability: 'source_unavailable',
      limitation: `IslamHouse could not be read for this item. ${message} This is a retrieval failure, not a statement that the subject is absent.`,
      description: null,
      descriptionIsFullText: false,
      blocks: [],
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
  if (!lookup.ok) {
    const language = lookup.reason === 'language';
    return {
      id,
      title: '',
      language: lookup.language,
      requestedLanguage: lang,
      contentType: 'other',
      availability: language ? 'language_unavailable' : 'source_unavailable',
      limitation: language
        ? `This item is not available in ${lang}. The ${lookup.language} record was not substituted.`
        : `IslamHouse returned no record for item ${id} in ${lang}. Another language was not substituted.`,
      description: null,
      descriptionIsFullText: false,
      blocks: [],
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
  const item = lookup.item;
  const blocks = item.html ? articleBlocks(item.html) : [];
  const prose = blocks.some(block => block.kind === 'paragraph');
  const media: LibraryMedia[] = item.files.map(file => {
    const kind = mediaKind(file.extension, file.play);
    return { kind, label: file.label, extension: file.extension, sourceUrl: file.url, viewUrl: mediaViewUrl(file.url, kind) };
  });
  const version = item.updated ?? item.added ?? 'undated';
  const fingerprint = [item.title, item.description ?? '', ...blocks.map(block => block.text), ...media.map(file => file.sourceUrl)].join('\n');
  const hash = contentHash(fingerprint);
  const key = `islamhouse:${item.id}:${item.language ?? lang}`;
  const status = index.status(key, version, hash);
  index.put(key, version, hash, fingerprint, retrievedAt);
  const credits = [
    ...item.authors.map(name => ({ role: 'author', name })),
    ...item.translators.map(name => ({ role: 'translator', name })),
    ...item.reviewers.map(name => ({ role: 'reviewer', name })),
  ];
  return {
    id: item.id,
    title: item.title,
    language: item.language,
    requestedLanguage: lang,
    contentType: item.type,
    availability: prose ? 'readable' : 'partial',
    limitation: limitation(item, prose),
    description: item.description,
    descriptionIsFullText: false,
    blocks,
    media,
    credits,
    canonicalUrl: item.sourceUrl,
    added: item.added,
    updated: item.updated,
    version,
    contentHash: hash,
    retrievedAt,
    rights: ISLAMHOUSE_RIGHTS,
    index: status === 'stale' ? 'updated' : status === 'fresh' ? 'fresh' : 'new',
  };
}

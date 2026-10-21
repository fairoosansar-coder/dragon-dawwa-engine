import type { Lang } from './sources.ts';

export const ISLAMHOUSE_TTL_MS = 10 * 60_000;
export const LIBRARY_CATEGORY_EMPTY = 'No items found in this category.';

/**
 * Categories that hold worship material outside the topic's own children.
 * Recorded 2026-10-21 from get-item-tree: 732301 "Prayer of the Sick" is a sibling of
 * Prayer (192812), not one of its children. Tamil item 1174 is filed there.
 * Parent item lists do not include child items. Tamil and Sinhala prayer parents return
 * HTTP 200 code 204, while child 192815 has Tamil book 373 and children 430287 and 732298
 * each have Sinhala item 427. English prayer page 2 is a real later page, not an empty language.
 * An empty Tamil prayer category is not the whole Tamil library. Reader item 475013,
 * “தொழுகையின் முக்கியத்துவம்”, has full Tamil text. See sourceRegistry.ts.
 */
export const RELATED_WORSHIP_CATEGORIES = {
  purification: [],
  prayer: [732301],
  fasting: [],
  zakah: [],
  hajj: [],
  dhikr: [],
} as const;

/** Category ids confirmed from IslamHouse `get-sub-categories` / the classification tree on 2026-10-21. */
export const WORSHIP_TOPICS = [
  { id: 'purification', categoryId: 192809, title: 'Purification and wudu' },
  { id: 'prayer', categoryId: 192812, title: 'Prayer' },
  { id: 'fasting', categoryId: 316761, title: 'Fasting' },
  { id: 'zakah', categoryId: 461271, title: 'Zakah' },
  { id: 'hajj', categoryId: 461274, title: 'Hajj and Umrah' },
  { id: 'dhikr', categoryId: 193841, title: 'Du’a and dhikr' },
] as const;

export type WorshipTopicId = (typeof WORSHIP_TOPICS)[number]['id'];

const PAGE_TYPES = new Set(['books', 'articles', 'audios', 'videos', 'poster']);

export interface LibraryCredit {
  name: string | null;
  kind: string;
}

export interface LibraryFile {
  extension: string;
  url: string;
  label: string | null;
  size: string | null;
  play: 'audio' | 'video' | null;
}

export interface LibraryItem {
  id: number;
  title: string;
  type: string;
  description: string | null;
  language: string | null;
  added: string | null;
  updated: string | null;
  credits: LibraryCredit[];
  files: LibraryFile[];
  sourceUrl: string | null;
}

export interface LibraryCategory {
  id: number;
  title: string;
}

export interface LibraryPage {
  topic: WorshipTopicId;
  lang: Lang;
  page: number;
  pages: number;
  total: number;
  items: LibraryItem[];
  categoryId?: number;
  categories?: LibraryCategory[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function exactString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function worshipTopic(id: string): (typeof WORSHIP_TOPICS)[number] | null {
  return WORSHIP_TOPICS.find(topic => topic.id === id) ?? null;
}

export function sourceDate(value: unknown): string | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 1_000_000_000) return null;
  return new Date(n * 1000).toISOString().slice(0, 10);
}

export function islamHousePage(lang: Lang, type: string, id: number): string | null {
  if (!PAGE_TYPES.has(type) || !Number.isInteger(id) || id <= 0) return null;
  return `https://islamhouse.com/${lang}/${type}/${id}/`;
}

function mediaUrl(value: unknown): string | null {
  const raw = exactString(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (url.hostname !== 'd1.islamhouse.com') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function playable(extension: string): 'audio' | 'video' | null {
  const kind = extension.toUpperCase();
  if (kind === 'MP3') return 'audio';
  if (kind === 'MP4') return 'video';
  return null;
}

export function parseLibraryItem(value: unknown, lang: Lang): LibraryItem | null {
  const row = record(value);
  if (!row) return null;
  const id = typeof row.id === 'number' && Number.isInteger(row.id) ? row.id : Number(row.id);
  const title = exactString(row.title);
  const type = exactString(row.type);
  if (!Number.isInteger(id) || id <= 0 || !title || !title.trim() || !type) return null;
  const credits: LibraryCredit[] = [];
  if (Array.isArray(row.prepared_by)) {
    for (const person of row.prepared_by) {
      const credit = record(person);
      if (!credit) continue;
      const kind = exactString(credit.kind) ?? exactString(credit.type);
      if (!kind) continue;
      credits.push({ name: exactString(credit.title), kind });
    }
  }
  const attachments = Array.isArray(row.attachments) ? row.attachments : [];
  const files: LibraryFile[] = [];
  for (const attachment of attachments) {
    const file = record(attachment);
    if (!file) continue;
    const url = mediaUrl(file.url);
    const extension = exactString(file.extension_type);
    if (!url || !extension) continue;
    files.push({
      extension,
      url,
      label: exactString(file.description),
      size: exactString(file.size),
      play: playable(extension),
    });
  }
  const updated = sourceDate(row.update_date) ?? sourceDate(record(attachments[0])?.updated_at);
  return {
    id,
    title,
    type,
    description: exactString(row.description),
    language: exactString(row.source_language),
    added: sourceDate(row.add_date),
    updated,
    credits,
    files,
    sourceUrl: islamHousePage(lang, type, id),
  };
}

function positiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Child categories from get-sub-categories. Attachment URLs in that payload are dropped. */
export function parseSubcategories(body: unknown): { id: number; title: string; children: LibraryCategory[] } | null {
  const row = record(body);
  if (!row) return null;
  const id = positiveInt(row.id) ?? positiveInt(row.source_id);
  const title = exactString(row.title);
  if (!id || !title || !title.trim()) return null;
  const children: LibraryCategory[] = [];
  if (Array.isArray(row.sub_categories)) {
    for (const item of row.sub_categories) {
      const child = record(item);
      if (!child) continue;
      const childId = positiveInt(child.id) ?? positiveInt(child.source_id);
      const childTitle = exactString(child.title);
      if (!childId || !childTitle || !childTitle.trim()) continue;
      children.push({ id: childId, title: childTitle });
    }
  }
  return { id, title, children };
}

export function parseLibraryPage(body: unknown, topic: WorshipTopicId, lang: Lang, page: number): LibraryPage | null {
  const row = record(body);
  if (!row) return null;
  const nested = record(row.data);
  if (row.code === 204 || nested?.error) return { topic, lang, page, pages: 0, total: 0, items: [] };
  if (typeof row.error === 'string') return null;
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
    topic,
    lang,
    page,
    pages: Number.isInteger(pages) && pages >= 0 ? pages : items.length ? 1 : 0,
    total: Number.isInteger(total) && total >= 0 ? total : items.length,
    items,
  };
}

export function libraryShareText(item: LibraryItem, topicTitle: string, lang: Lang): string {
  const credits = item.credits.map(credit => `${credit.kind}: ${credit.name ?? 'Name not supplied by the source'}`);
  return [
    item.title,
    item.description,
    topicTitle,
    item.language ? `Language: ${item.language}` : `Language: ${lang}`,
    ...credits,
    item.added ? `Added: ${item.added}` : null,
    item.updated ? `Updated: ${item.updated}` : null,
    'IslamHouse',
    item.sourceUrl,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n\n');
}

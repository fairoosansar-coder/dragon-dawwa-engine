import type { Lang } from './sources.ts';

export const HADEETHENC_TTL_MS = 10 * 60_000;
export const HADEETH_UNAVAILABLE = 'This hadith is not available in the selected language.';
export const HADEETHENC_SOURCE = 'HadeethEnc';

/**
 * Documented category method, recorded 2026-10-21.
 * Request: GET https://hadeethenc.com/api/v1/categories/list/?language=en
 * Response: HTTP 200, 39,978 bytes, 452 objects with id, title, hadeeths_count, parent_id.
 * Roots use parent_id null. A child looks like {"id":"738","title":"Interpretation of verses","hadeeths_count":"13","parent_id":"10"}.
 * Tamil returned 296 categories. Sinhala returned 366 (7 roots, 359 children).
 * The collection has no categories/children method. An undocumented GET categories/children answered HTTP 405;
 * that status is not evidence that child categories are missing. hadeeths/list accepts a child category_id.
 */
export const HADEETHENC_CATEGORY_LIST = 'https://hadeethenc.com/api/v1/categories/list/';

/**
 * Research reads this many HadeethEnc records at a time, in the search response's relevance order.
 * The first row is not always the narration a question names: English "intentions" ranks id 58215
 * ahead of the niyyah hadith 4560. A caller that still lacks support requests the next page once.
 */
export const ENCYCLOPEDIA_EVIDENCE_LIMIT = 3;

export interface HadeethCategory {
  id: string;
  title: string;
  count: number;
  parentId: string | null;
}

export interface HadeethListItem {
  id: string;
  title: string;
  languages: string[];
}

export interface HadeethListPage {
  lang: Lang;
  categoryId: string;
  page: number;
  pages: number;
  total: number;
  items: HadeethListItem[];
}

export interface HadeethSearchHit {
  id: string;
  title: string;
}

/** One HadeethEnc record. `audioIncluded` stays false: the record payload has no audio field. */
export interface EncyclopediaHadith {
  id: string;
  lang: Lang;
  title: string;
  arabic: string | null;
  arabicIntro: string | null;
  text: string;
  intro: string | null;
  explanation: string | null;
  explanationArabic: string | null;
  lessons: string[];
  lessonsArabic: string[];
  grade: string | null;
  gradeArabic: string | null;
  attribution: string | null;
  attributionArabic: string | null;
  categoryIds: string[];
  languages: string[];
  sourceUrl: string;
  audioIncluded: false;
  /** Spreadsheet edition, such as v1.25.0. Absent when the record came from the live API. */
  sourceVersion?: string;
  sourceUpdated?: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function exactString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function idString(value: unknown): string | null {
  const raw = typeof value === 'number' && Number.isInteger(value) ? String(value) : exactString(value);
  return raw && /^\d{1,12}$/.test(raw) ? raw : null;
}

function countOf(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function textOrNull(value: unknown): string | null {
  const text = exactString(value);
  return text && text.trim() ? text : null;
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const rows: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    rows.push(item);
  }
  return rows;
}

/** The main field often already begins with the introductory chain. Show that chain once. */
export function textBeyondIntro(intro: string | null, body: string | null): string | null {
  if (!intro) return null;
  if (body && body.startsWith(intro)) return null;
  return intro;
}

export function hadeethSourceUrl(lang: Lang, id: string): string {
  return `https://hadeethenc.com/${lang}/browse/hadith/${id}`;
}

function parentIdOf(row: Record<string, unknown>): string | null | undefined {
  if (!('parent_id' in row) || row.parent_id === null || row.parent_id === '') return null;
  return idString(row.parent_id) ?? undefined;
}

export function parseCategories(body: unknown): HadeethCategory[] | null {
  if (!Array.isArray(body)) return null;
  const rows: HadeethCategory[] = [];
  for (const item of body) {
    const row = record(item);
    if (!row) return null;
    const id = idString(row.id);
    const title = textOrNull(row.title);
    const count = countOf(row.hadeeths_count);
    const parentId = parentIdOf(row);
    if (!id || !title || count === null || parentId === undefined) return null;
    rows.push({ id, title, count, parentId });
  }
  return rows;
}

export function categoriesForParent(categories: HadeethCategory[], parentId: string | null): HadeethCategory[] {
  return categories.filter(category => category.parentId === parentId);
}

export function pageByRelevance<T>(items: readonly T[], offset = 0): T[] {
  const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
  return items.slice(start, start + ENCYCLOPEDIA_EVIDENCE_LIMIT);
}

export function parseHadeethList(body: unknown, lang: Lang, categoryId: string): HadeethListPage | null {
  const row = record(body);
  const meta = row ? record(row.meta) : null;
  if (!row || !meta || !Array.isArray(row.data)) return null;
  const page = countOf(meta.current_page);
  const pages = countOf(meta.last_page);
  const total = countOf(meta.total_items);
  if (page === null || pages === null || total === null) return null;
  const items: HadeethListItem[] = [];
  for (const item of row.data) {
    const entry = record(item);
    if (!entry) return null;
    const id = idString(entry.id);
    const title = textOrNull(entry.title);
    const languages = Array.isArray(entry.translations) ? stringList(entry.translations) : [];
    if (!id || !title || !languages) return null;
    items.push({ id, title, languages });
  }
  return { lang, categoryId, page, pages, total, items };
}

export function parseHadeethSearch(body: unknown): HadeethSearchHit[] | null {
  const rows = Array.isArray(body) ? body : [];
  if (!Array.isArray(body)) {
    const suggestions = record(record(body)?.suggestions);
    if (!suggestions) return null;
    const id = idString(suggestions.id);
    const title = textOrNull(suggestions.title);
    if (!id || !title) return [];
    return [{ id, title }];
  }
  const hits: HadeethSearchHit[] = [];
  for (const item of rows) {
    const entry = record(item);
    if (!entry) return null;
    const id = idString(entry.id);
    const title = textOrNull(entry.title);
    if (!id || !title) return null;
    hits.push({ id, title });
  }
  return hits;
}

export function parseHadeeth(body: unknown, lang: Lang): EncyclopediaHadith | null {
  const row = record(body);
  if (!row) return null;
  const id = idString(row.id);
  const title = textOrNull(row.title);
  const text = exactString(row.hadeeth);
  if (!id || !title || !text || !text.trim()) return null;
  const lessons = stringList(row.hints ?? []);
  const lessonsArabic = stringList(row.hints_ar ?? []);
  const languages = stringList(row.translations ?? []);
  const categoryIds = stringList(row.categories ?? []);
  if (!lessons || !lessonsArabic || !languages || !categoryIds) return null;
  return {
    id,
    lang,
    title,
    arabic: textOrNull(row.hadeeth_ar),
    arabicIntro: textOrNull(row.hadeeth_intro_ar),
    text,
    intro: textOrNull(row.hadeeth_intro),
    explanation: textOrNull(row.explanation),
    explanationArabic: textOrNull(row.explanation_ar),
    lessons: lessons.filter(item => item.trim()),
    lessonsArabic: lessonsArabic.filter(item => item.trim()),
    grade: textOrNull(row.grade),
    gradeArabic: textOrNull(row.grade_ar),
    attribution: textOrNull(row.attribution),
    attributionArabic: textOrNull(row.attribution_ar),
    categoryIds,
    languages,
    sourceUrl: hadeethSourceUrl(lang, id),
    audioIncluded: false,
  };
}

/** Full record for the clipboard. Wording is copied as received. */
export function hadeethShareText(hadith: EncyclopediaHadith): string {
  const parts = [hadith.title];
  if (textBeyondIntro(hadith.arabicIntro, hadith.arabic)) parts.push(hadith.arabicIntro as string);
  parts.push(hadith.arabic ?? 'HadeethEnc did not include the Arabic for this hadith.');
  if (textBeyondIntro(hadith.intro, hadith.text)) parts.push(hadith.intro as string);
  parts.push(hadith.text);
  parts.push(hadith.explanation ?? 'HadeethEnc did not include an explanation for this hadith.');
  if (hadith.explanationArabic) parts.push(hadith.explanationArabic);
  parts.push(hadith.lessons.length ? hadith.lessons.join('\n') : 'HadeethEnc did not include lessons for this hadith.');
  if (hadith.lessonsArabic.length) parts.push(hadith.lessonsArabic.join('\n'));
  parts.push(hadith.grade ? `Grade: ${hadith.grade}` : 'HadeethEnc did not include a grade for this hadith.');
  if (hadith.gradeArabic) parts.push(hadith.gradeArabic);
  if (hadith.attribution) parts.push(hadith.attribution);
  if (hadith.attributionArabic) parts.push(hadith.attributionArabic);
  parts.push(`HadeethEnc ${hadith.id}`);
  if (hadith.sourceVersion) parts.push(hadith.sourceVersion);
  parts.push(hadith.lang);
  parts.push(hadith.sourceUrl);
  return parts.join('\n\n');
}

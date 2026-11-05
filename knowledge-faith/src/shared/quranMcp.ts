/** Shapes and parsers for the hosted Quran MCP proxy. No verse text is created here. */

export type McpEditionType = 'quran' | 'tafsir' | 'translation';

export interface McpEdition {
  editionId: string;
  editionType: McpEditionType;
  lang: string;
  name: string;
  author: string | null;
}

function displayLanguage(code: string): string {
  const lang = code.trim().toLowerCase().split('-')[0] ?? '';
  if (!/^[a-z]{2,3}$/.test(lang)) return '';
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(lang);
    if (name && name.toLowerCase() !== lang) return name;
  } catch {
    return '';
  }
  return '';
}

function shortClause(name: string): string {
  const clause = name.split(/\s[:—–|]\s|:/)[0]?.trim() || name.trim();
  if (clause.length <= 32) return clause;
  const cut = clause.slice(0, 32);
  const space = cut.lastIndexOf(' ');
  return `${(space > 16 ? cut.slice(0, space) : cut).trim()}…`;
}

function shortAuthor(author: string | null): string {
  if (!author) return '';
  const first = author.split(/[&,]|\band\b/i)[0]?.trim() ?? '';
  const words = first.split(/\s+/).filter(Boolean);
  const last = words[words.length - 1] ?? '';
  return last.length > 0 && last.length <= 22 ? last : '';
}

function baseEditionLabel(edition: McpEdition): string {
  const title = shortClause(edition.name);
  if (title.length <= 32 && !title.endsWith('…')) return title;
  const language = displayLanguage(edition.lang);
  const author = shortAuthor(edition.author);
  if (language && author) return `${language} · ${author}`;
  return language || title;
}

/** Short list labels. The option value stays the edition id. */
export function searchEditionLabels(catalogue: readonly McpEdition[]): Map<string, string> {
  const bases = catalogue.map(edition => ({ edition, label: baseEditionLabel(edition) }));
  const counts = new Map<string, number>();
  for (const item of bases) counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
  const labels = new Map<string, string>();
  for (const item of bases) {
    let label = item.label;
    if ((counts.get(item.label) ?? 0) > 1) {
      const author = shortAuthor(item.edition.author);
      const language = displayLanguage(item.edition.lang);
      if (author && !label.includes(author)) label = `${label} · ${author}`;
      else if (language && !label.startsWith(language)) label = `${language} · ${label}`;
      else label = `${label} · ${item.edition.editionId}`;
    }
    labels.set(item.edition.editionId, label);
  }
  return labels;
}

export interface McpTafsirEntry {
  range: string;
  text: string;
  citationUrl: string;
}

export interface McpTafsirResult {
  ayah: string;
  editionId: string;
  passages: McpTafsirEntry[];
}

export interface McpWord {
  position: number;
  text: string;
  transliteration: string | null;
  translation: string | null;
  root: string | null;
  lemma: string | null;
  description: string | null;
}

export interface McpMorphology {
  ayah: string;
  citationUrl: string;
  words: McpWord[];
}

export interface McpSearchHit {
  ayah: string;
  surah: number;
  verse: number;
  arabic: string;
  translation: string | null;
  translationEditionId: string | null;
  translationName: string | null;
  citationUrl: string;
}

export interface McpSearchResult {
  query: string;
  translationEditionId: string | null;
  hits: McpSearchHit[];
}

export const MCP_EDITION_REQUIRED = 'Choose a tafsir edition. None was substituted.';
export const MCP_EDITION_REJECTED = 'That edition cannot be used. No other translation was substituted.';
export const MCP_FAILED = 'The Quran study source did not return this passage.';
export const MCP_REFUSED = 'The Quran study source refused the request. This passage is empty.';

const EDITION_ID = /^[a-z]{2}-[a-z0-9-]{2,60}$/;
const AYAH_KEY = /^([1-9]\d{0,2}):([1-9]\d{0,2})$/;

export function parseAyahKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = AYAH_KEY.exec(value.trim());
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (surah < 1 || surah > 114 || ayah < 1 || ayah > 286) return null;
  return `${surah}:${ayah}`;
}

/** Full edition ids only. A language code or `auto` would let the source pick Abdel Haleem. */
export function parseEditionId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim().toLowerCase();
  if (id === 'auto') return null;
  return EDITION_ID.test(id) ? id : null;
}

export function readTafsirQuery(ayah: unknown, edition: unknown): { ayah: string; edition: string } | { error: string } {
  const key = parseAyahKey(typeof ayah === 'string' ? ayah : '');
  if (!key) return { error: 'That verse cannot be requested.' };
  if (edition == null || edition === '') return { error: MCP_EDITION_REQUIRED };
  const id = parseEditionId(edition);
  if (!id) return { error: MCP_EDITION_REQUIRED };
  return { ayah: key, edition: id };
}

export function tafsirArguments(ayah: string, edition: string): { ayahs: string; editions: string } {
  const read = readTafsirQuery(ayah, edition);
  if ('error' in read) throw new Error(read.error);
  return { ayahs: read.ayah, editions: read.edition };
}

export function searchArguments(query: string, edition: string | null, surah: number | null): Record<string, string | number> {
  const args: Record<string, string | number> = { query };
  if (surah != null) args.surah = surah;
  if (edition) {
    const id = parseEditionId(edition);
    if (!id) throw new Error(MCP_EDITION_REJECTED);
    args.translations = id;
  }
  return args;
}

export function quranComUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 300) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'quran.com') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function verseCitation(ayah: string): string | null {
  const key = parseAyahKey(ayah);
  return key ? `https://quran.com/${key}` : null;
}

export function revelationPlace(value: string): 'Mecca' | 'Medina' | null {
  if (/mecca/i.test(value)) return 'Mecca';
  if (/medina/i.test(value)) return 'Medina';
  return null;
}

export function surahArabicTitle(name: string): string {
  return name.replace(/^سُورَةُ\s+/, '').replace(/^سورة\s+/, '').trim();
}

export function parseMcpMessages(body: string, contentType: string | null): unknown[] {
  const type = (contentType ?? '').toLowerCase();
  const trimmed = body.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('<') || type.includes('text/html')) throw new Error('refused');
  if (type.includes('text/event-stream') || trimmed.startsWith('event:') || trimmed.startsWith('data:')) {
    const messages: unknown[] = [];
    for (const line of body.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      messages.push(JSON.parse(payload) as unknown);
    }
    return messages;
  }
  return [JSON.parse(trimmed) as unknown];
}

export function publicFailure(detail: string): string {
  const line = detail.replace(/\s+/g, ' ').trim();
  if (/rate.?limited|too many|refused|blocked|forbidden|429|403/i.test(line)) return MCP_REFUSED;
  return MCP_FAILED;
}

export function toolFailureDetail(message: unknown): string | null {
  if (!message || typeof message !== 'object') return MCP_FAILED;
  const record = message as { error?: { message?: unknown }; result?: { isError?: unknown; content?: unknown } };
  if (record.error) {
    const text = typeof record.error.message === 'string' ? record.error.message : '';
    return publicFailure(text);
  }
  const result = record.result;
  if (!result || result.isError !== true) return null;
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content
    .map(block => (block && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string' ? (block as { text: string }).text : ''))
    .join(' ');
  return publicFailure(text);
}

export function structuredContent(message: unknown): unknown | null {
  if (!message || typeof message !== 'object') return null;
  const result = (message as { result?: { structuredContent?: unknown; isError?: unknown; content?: unknown } }).result;
  if (!result || result.isError === true) return null;
  if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent;
  const content = Array.isArray(result.content) ? result.content : [];
  for (const block of content) {
    if (!block || typeof block !== 'object' || typeof (block as { text?: unknown }).text !== 'string') continue;
    const text = (block as { text: string }).text.trim();
    if (!text.startsWith('{') && !text.startsWith('[')) continue;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

function presentString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function projectEditions(payload: unknown, type: McpEditionType): McpEdition[] {
  if (!payload || typeof payload !== 'object') return [];
  const rows = (payload as { editions?: unknown }).editions;
  if (!Array.isArray(rows)) return [];
  const editions: McpEdition[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const editionId = parseEditionId(record.edition_id);
    const editionType = record.edition_type;
    const name = presentString(record.name);
    if (!editionId || !name) continue;
    if (editionType !== 'quran' && editionType !== 'tafsir' && editionType !== 'translation') continue;
    if (editionType !== type) continue;
    editions.push({
      editionId,
      editionType,
      lang: typeof record.lang === 'string' ? record.lang : '',
      name,
      author: presentString(record.author),
    });
  }
  return editions;
}

export function projectTafsir(payload: unknown, ayah: string, editionId: string): McpTafsirResult {
  const passages: McpTafsirEntry[] = [];
  const fallback = verseCitation(ayah);
  const results = payload && typeof payload === 'object' ? (payload as { results?: unknown }).results : null;
  const rows = results && typeof results === 'object' ? (results as Record<string, unknown>)[editionId] : null;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const record = row as Record<string, unknown>;
      if (typeof record.text !== 'string' || !record.text.trim()) continue;
      const citation = quranComUrl(record.citation_url) ?? fallback;
      if (!citation) continue;
      passages.push({
        range: typeof record.range === 'string' && record.range.trim() ? record.range : ayah,
        text: record.text,
        citationUrl: citation,
      });
    }
  }
  return { ayah, editionId, passages };
}

export function projectMorphology(payload: unknown, ayah: string): McpMorphology {
  const words: McpWord[] = [];
  const rows = payload && typeof payload === 'object' ? (payload as { words?: unknown }).words : null;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const record = row as Record<string, unknown>;
      const text = presentString(record.text_uthmani) ?? presentString(record.text_simple);
      const position = typeof record.position === 'number' && Number.isInteger(record.position) ? record.position : null;
      if (!text || position == null) continue;
      words.push({
        position,
        text,
        transliteration: presentString(record.transliteration),
        translation: presentString(record.translation),
        root: presentString(record.root),
        lemma: presentString(record.lemma),
        description: presentString(record.description),
      });
    }
  }
  words.sort((a, b) => a.position - b.position);
  return { ayah, citationUrl: verseCitation(ayah) ?? '', words };
}

export function projectSearch(payload: unknown, query: string, editionId: string | null): McpSearchResult {
  const hits: McpSearchHit[] = [];
  const rows = payload && typeof payload === 'object' ? (payload as { results?: unknown }).results : null;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const record = row as Record<string, unknown>;
      const ayah = parseAyahKey(record.ayah_key);
      const arabic = presentString(record.text);
      if (!ayah || !arabic) continue;
      const surah = typeof record.surah === 'number' ? record.surah : Number(ayah.split(':')[0]);
      const verse = typeof record.ayah === 'number' ? record.ayah : Number(ayah.split(':')[1]);
      if (!Number.isInteger(surah) || !Number.isInteger(verse) || surah < 1 || verse < 1) continue;
      const translations = Array.isArray(record.translations) ? record.translations : [];
      const first = translations[0] && typeof translations[0] === 'object' ? (translations[0] as Record<string, unknown>) : null;
      const edition = first && first.edition && typeof first.edition === 'object' ? (first.edition as Record<string, unknown>) : null;
      const translationEditionId = edition ? parseEditionId(edition.id) : null;
      const sameEdition = Boolean(editionId) && translationEditionId === editionId;
      const translation = sameEdition && typeof first?.text === 'string' && first.text.trim() ? first.text : null;
      const citation = quranComUrl(first?.citation_url) ?? quranComUrl(record.citation_url) ?? verseCitation(ayah);
      if (!citation) continue;
      hits.push({
        ayah,
        surah,
        verse,
        arabic,
        translation,
        translationEditionId: translation ? translationEditionId : null,
        translationName: translation ? presentString(edition?.name) : null,
        citationUrl: citation,
      });
    }
  }
  return { query, translationEditionId: editionId, hits };
}

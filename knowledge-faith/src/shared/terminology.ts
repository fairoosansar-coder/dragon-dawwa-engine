export interface TermLink {
  id: string;
  transliteration: string;
  /** Parenthetical text from the catalogue title. A meaning only when it reads as one. */
  parenthetical: string | null;
  meaningInTitle: boolean;
  arabic: string;
}

export interface TermField {
  language: string;
  text: string;
  published: true;
}

export interface TermArticle {
  id: string;
  title: string;
  brief: TermField[];
  unavailableLanguages: string[];
  commentary: { language: 'ar'; text: string } | null;
  evidence: { language: 'ar'; text: string } | null;
}

const TITLE = /href="https:\/\/terminologyenc\.com\/en\/browse\/term\/(\d+)"[^>]*>([^<]+)</g;

function decode(text: string): string {
  return text
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, value: string) => {
      const code = Number(value);
      return Number.isInteger(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function meaningInTitle(parenthetical: string): boolean {
  return /\b(the|of|who)\b/i.test(parenthetical) || parenthetical.trim().split(/\s+/).length > 2;
}

export function parseTermCatalogue(html: string): TermLink[] {
  const links: TermLink[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(TITLE)) {
    const id = match[1];
    const raw = decode(match[2] ?? '');
    if (!id || seen.has(id)) continue;
    const split = raw.split(/\s+-\s+/);
    if (split.length < 2) continue;
    const arabic = split[split.length - 1].trim();
    if (!/[\u0600-\u06FF]/.test(arabic)) continue;
    const left = split.slice(0, -1).join(' - ').trim();
    const wrapped = left.match(/^(.*?)\s+\((.+)\)\s*$/);
    const transliteration = wrapped ? wrapped[1].trim() : left;
    const parenthetical = wrapped ? wrapped[2].trim() : null;
    if (!transliteration) continue;
    seen.add(id);
    links.push({
      id,
      transliteration,
      parenthetical,
      meaningInTitle: parenthetical ? meaningInTitle(parenthetical) : false,
      arabic,
    });
  }
  return links;
}

export function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, value: string) => {
      const code = Number(value);
      return Number.isInteger(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    });
  return text
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

const SECTION_MARKS = [
  'المعنى المختصر',
  "Scholars' opinions on meaning",
  "Scholars' opinions on verification",
  'Evidences',
  'Alerts',
];

function section(lines: string[], start: string, stops: string[]): string {
  const from = lines.findIndex(line => line.includes(start));
  if (from < 0) return '';
  const rest = lines.slice(from + 1);
  const end = rest.findIndex(line => stops.some(mark => line.includes(mark)));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n').trim();
}

function lineAfter(block: string, label: string): string | null {
  for (const line of block.split('\n')) {
    if (line.startsWith(label)) {
      const text = line.slice(label.length).trim();
      if (text) return text;
    }
  }
  return null;
}

/** Title of one term page, matched by the page’s own id rather than its place in a list. */
export function parseTermHeading(html: string, id: string): TermLink | null {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '';
  const trimmed = title.replace(/\s+-\s+Encyclopedia[\s\S]*$/i, '').trim();
  if (!trimmed) return null;
  return parseTermCatalogue(`<a href="https://terminologyenc.com/en/browse/term/${id}">${trimmed}</a>`)[0] ?? null;
}

/** Field-level reading of one terminology page. Missing Tamil or Sinhala stays missing. */
export function parseTermArticle(id: string, html: string): TermArticle {
  const lines = htmlToLines(html);
  const title = lines.find(line => line.includes(' - ')) ?? '';
  const briefBlock = section(lines, 'المعنى المختصر', SECTION_MARKS.filter(mark => mark !== 'المعنى المختصر'));
  const brief: TermField[] = [];
  const english = lineAfter(briefBlock, 'English');
  const arabicBrief = lines.find(line => line.includes('المعنى المختصر'))
    ? lines.slice(lines.findIndex(line => line.includes('المعنى المختصر')) + 1).find(line => /[\u0600-\u06FF]{12,}/.test(line) && !line.startsWith('English'))
    : null;
  if (arabicBrief && !arabicBrief.startsWith('English')) brief.push({ language: 'ar', text: arabicBrief, published: true });
  if (english) brief.push({ language: 'en', text: english, published: true });
  const tamil = lineAfter(briefBlock, 'Tamil') ?? lineAfter(briefBlock, 'தமிழ்');
  const sinhala = lineAfter(briefBlock, 'Sinhala') ?? lineAfter(briefBlock, 'සිංහල');
  if (tamil) brief.push({ language: 'ta', text: tamil, published: true });
  if (sinhala) brief.push({ language: 'si', text: sinhala, published: true });
  const unavailableLanguages = [
    tamil ? '' : 'ta',
    sinhala ? '' : 'si',
    english ? '' : 'en',
  ].filter(Boolean);
  const commentaryText = section(lines, "Scholars' opinions on meaning", ["Scholars' opinions on verification", 'Evidences', 'Alerts']);
  const evidenceText = section(lines, 'Evidences', ['Alerts']);
  return {
    id,
    title,
    brief,
    unavailableLanguages,
    commentary: commentaryText ? { language: 'ar', text: commentaryText } : null,
    evidence: evidenceText ? { language: 'ar', text: evidenceText } : null,
  };
}

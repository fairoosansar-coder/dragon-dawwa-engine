import { execFileSync } from 'node:child_process';

export const HADEETH_COLUMNS = [
  'id',
  'title_ar',
  'title',
  'hadith_text_ar',
  'hadith_text',
  'explanation_ar',
  'explanation',
  'benefits_ar',
  'benefits',
  'grade_ar',
  'takhrij_ar',
  'grade',
  'takhrij',
  'lang',
  'link',
] as const;

export type HadeethColumn = (typeof HADEETH_COLUMNS)[number];

export interface WorkbookBanner {
  text: string;
  version: string;
  updated: string;
}

export interface WorkbookRow {
  id: string;
  titleAr: string;
  title: string;
  hadithTextAr: string;
  hadithText: string;
  explanationAr: string;
  explanation: string;
  benefitsAr: string;
  benefits: string;
  gradeAr: string;
  takhrijAr: string;
  grade: string;
  takhrij: string;
  lang: string;
  link: string;
}

export interface ParsedWorkbook {
  banner: WorkbookBanner;
  /** Physical rows in the sheet, including the banner and the header. */
  sheetRows: number;
  rows: WorkbookRow[];
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, '');
  let index = 0;
  for (const char of letters) index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

export function sharedStringsFromXml(xml: string): string[] {
  const strings: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const parts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(item => decodeXml(item[1]));
    strings.push(parts.join(''));
  }
  return strings;
}

function cellValue(attrs: string, inner: string, shared: readonly string[]): string {
  const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? '';
  const inline = inner.match(/<is\b[^>]*>([\s\S]*?)<\/is>/);
  if (type === 'inlineStr' && inline) {
    return [...inline[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(item => decodeXml(item[1])).join('');
  }
  const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (raw === undefined) return '';
  if (type === 's') {
    const text = shared[Number(raw)];
    if (text === undefined) throw new Error(`Shared string ${raw} is missing.`);
    return text;
  }
  return decodeXml(raw);
}

export function rowsFromSheetXml(xml: string, shared: readonly string[]): string[][] {
  const rows: string[][] = [];
  for (const match of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = Array.from({ length: HADEETH_COLUMNS.length }, () => '');
    for (const cell of match[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = cell[1].match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) continue;
      const index = columnIndex(ref);
      if (index < 0 || index >= cells.length) continue;
      cells[index] = cellValue(cell[1], cell[2] ?? '', shared);
    }
    rows.push(cells);
  }
  return rows;
}

function bannerFrom(text: string): WorkbookBanner {
  const version = text.match(/\((v\d+\.\d+\.\d+)\)/)?.[1];
  const updated = text.match(/Last update:\s*([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})/)?.[1];
  if (!version || !updated) throw new Error('The workbook banner does not name a source version and update time.');
  return { text, version, updated };
}

/** Read one HadeethEnc language workbook. The file is only read. */
export function parseWorkbook(file: string, lang: string): ParsedWorkbook {
  const sharedXml = execFileSync('unzip', ['-p', file, 'xl/sharedStrings.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  const sheetXml = execFileSync('unzip', ['-p', file, 'xl/worksheets/sheet1.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  return parseWorkbookXml(sharedXml, sheetXml, lang);
}

export function parseWorkbookXml(sharedXml: string, sheetXml: string, lang: string): ParsedWorkbook {
  const table = rowsFromSheetXml(sheetXml, sharedStringsFromXml(sharedXml));
  if (table.length < 2) throw new Error('The workbook has no header row.');
  const header = table[1];
  for (let index = 0; index < HADEETH_COLUMNS.length; index += 1) {
    if (header[index] !== HADEETH_COLUMNS[index]) {
      throw new Error(`Column ${HADEETH_COLUMNS[index]} is ${header[index] ? `"${header[index]}"` : 'empty'}.`);
    }
  }
  const banner = bannerFrom(table[0][0] ?? '');
  const seen = new Set<string>();
  const rows: WorkbookRow[] = [];
  table.slice(2).forEach((cells, offset) => {
    const sheetRow = offset + 3;
    const id = cells[0].trim();
    if (!id && cells.every(cell => !cell.trim())) return;
    if (!/^\d{1,12}$/.test(id)) throw new Error(`Row ${sheetRow} has an unreadable id.`);
    if (seen.has(id)) throw new Error(`Row ${sheetRow} repeats id ${id}.`);
    seen.add(id);
    if (cells[13] !== lang) throw new Error(`Row ${sheetRow} is language "${cells[13]}", not ${lang}.`);
    if (!cells[14].trim()) throw new Error(`Row ${sheetRow} has no link.`);
    rows.push({
      id,
      titleAr: cells[1],
      title: cells[2],
      hadithTextAr: cells[3],
      hadithText: cells[4],
      explanationAr: cells[5],
      explanation: cells[6],
      benefitsAr: cells[7],
      benefits: cells[8],
      gradeAr: cells[9],
      takhrijAr: cells[10],
      grade: cells[11],
      takhrij: cells[12],
      lang: cells[13],
      link: cells[14],
    });
  });
  return { banner, sheetRows: table.length, rows };
}

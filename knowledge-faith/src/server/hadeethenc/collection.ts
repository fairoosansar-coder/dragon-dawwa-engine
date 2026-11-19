import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Lang } from '../../shared/sources.ts';
import type { EncyclopediaHadith } from '../../shared/hadeethenc.ts';
import { persistRoot } from '../persist.ts';
import type { ParsedWorkbook, WorkbookRow } from './workbook.ts';

export interface LanguageImport {
  lang: string;
  file: string;
  sha256: string;
  bytes: number;
  version: string;
  updated: string;
  sheetRows: number;
  dataRows: number;
  emptyText: number;
}

export interface CollectionSummary {
  available: boolean;
  path: string | null;
  languages: { lang: string; version: string; updated: string; rows: number; file: string; sha256: string }[];
}

const SEARCH_COLUMNS = ['title', 'hadith_text', 'explanation', 'benefits', 'grade', 'takhrij', 'title_ar', 'hadith_text_ar'] as const;

export function collectionFile(): string | null {
  const explicit = process.env.HADEETHENC_DB;
  if (explicit) return fs.existsSync(explicit) ? path.resolve(explicit) : null;
  if (!process.env.DD_PERSIST_DIR) return null;
  const file = path.join(persistRoot(), 'sources', 'hadeethenc.sqlite');
  return fs.existsSync(file) ? file : null;
}

function openDatabase(file: string): DatabaseSync {
  return new DatabaseSync(file);
}

function blank(value: string | null): string | null {
  return value && value.trim() ? value : null;
}

function lessons(value: string | null): string[] {
  if (!value || !value.trim()) return [];
  return value.split('\n').map(line => line.trim()).filter(Boolean);
}

export function replaceLanguage(file: string, parsed: ParsedWorkbook, meta: Omit<LanguageImport, 'version' | 'updated' | 'sheetRows' | 'dataRows' | 'emptyText'>): LanguageImport {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = openDatabase(file);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS hadeeth (
        lang TEXT NOT NULL,
        id TEXT NOT NULL,
        source_version TEXT NOT NULL,
        source_updated TEXT NOT NULL,
        source_file TEXT NOT NULL,
        title_ar TEXT,
        title TEXT NOT NULL,
        hadith_text_ar TEXT,
        hadith_text TEXT NOT NULL,
        explanation_ar TEXT,
        explanation TEXT,
        benefits_ar TEXT,
        benefits TEXT,
        grade_ar TEXT,
        takhrij_ar TEXT,
        grade TEXT,
        takhrij TEXT,
        link TEXT NOT NULL,
        PRIMARY KEY (lang, id)
      );
      CREATE TABLE IF NOT EXISTS import_meta (
        lang TEXT PRIMARY KEY,
        source_version TEXT NOT NULL,
        source_updated TEXT NOT NULL,
        source_file TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        sheet_rows INTEGER NOT NULL,
        data_rows INTEGER NOT NULL,
        empty_text INTEGER NOT NULL,
        imported_at TEXT NOT NULL
      );
    `);
    const insert = db.prepare(`
      INSERT INTO hadeeth (
        lang, id, source_version, source_updated, source_file,
        title_ar, title, hadith_text_ar, hadith_text,
        explanation_ar, explanation, benefits_ar, benefits,
        grade_ar, takhrij_ar, grade, takhrij, link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const version = parsed.banner.version;
    const updated = parsed.banner.updated;
    let emptyText = 0;
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM hadeeth WHERE lang = ?').run(meta.lang);
      for (const row of parsed.rows) {
        if (!row.hadithText.trim()) emptyText += 1;
        insert.run(
          row.lang,
          row.id,
          version,
          updated,
          path.basename(meta.file),
          blank(row.titleAr),
          row.title,
          blank(row.hadithTextAr),
          row.hadithText,
          blank(row.explanationAr),
          blank(row.explanation),
          blank(row.benefitsAr),
          blank(row.benefits),
          blank(row.gradeAr),
          blank(row.takhrijAr),
          blank(row.grade),
          blank(row.takhrij),
          row.link,
        );
      }
      db.prepare(`
        INSERT INTO import_meta (lang, source_version, source_updated, source_file, sha256, bytes, sheet_rows, data_rows, empty_text, imported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(lang) DO UPDATE SET
          source_version = excluded.source_version,
          source_updated = excluded.source_updated,
          source_file = excluded.source_file,
          sha256 = excluded.sha256,
          bytes = excluded.bytes,
          sheet_rows = excluded.sheet_rows,
          data_rows = excluded.data_rows,
          empty_text = excluded.empty_text,
          imported_at = excluded.imported_at
      `).run(
        meta.lang,
        version,
        updated,
        path.basename(meta.file),
        meta.sha256,
        meta.bytes,
        parsed.sheetRows,
        parsed.rows.length,
        emptyText,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return {
      ...meta,
      version,
      updated,
      sheetRows: parsed.sheetRows,
      dataRows: parsed.rows.length,
      emptyText,
    };
  } finally {
    db.close();
  }
}

function likePattern(phrase: string): string {
  return `%${phrase.replace(/[\\%_]/g, char => `\\${char}`)}%`;
}

export function searchCollection(lang: Lang, phrase: string, page: number): { id: string; title: string }[] | null {
  const file = collectionFile();
  const query = phrase.trim();
  if (!file || !query) return file ? [] : null;
  const safePage = Number.isInteger(page) && page >= 1 && page <= 5 ? page : 1;
  const pattern = likePattern(query);
  const where = SEARCH_COLUMNS.map(column => `${column} LIKE ? ESCAPE '\\'`).join(' OR ');
  const rank = `CASE WHEN title LIKE ? ESCAPE '\\' THEN 0 WHEN hadith_text LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END`;
  const db = openDatabase(file);
  try {
    const binds = [lang, ...SEARCH_COLUMNS.map(() => pattern), pattern, pattern, (safePage - 1) * 20];
    return db.prepare(`SELECT id, title FROM hadeeth WHERE lang = ? AND (${where}) ORDER BY ${rank}, rowid LIMIT 20 OFFSET ?`).all(...binds) as { id: string; title: string }[];
  } finally {
    db.close();
  }
}

interface StoredRow extends WorkbookRow {
  sourceVersion: string;
  sourceUpdated: string;
}

/** True when this id is stored in another language and not in the requested one. */
export function missingTranslation(lang: Lang, id: string): boolean {
  const file = collectionFile();
  if (!file || !/^\d{1,12}$/.test(id)) return false;
  const db = openDatabase(file);
  try {
    const same = db.prepare('SELECT 1 AS ok FROM hadeeth WHERE lang = ? AND id = ?').get(lang, id) as { ok: number } | undefined;
    if (same) return false;
    const other = db.prepare('SELECT 1 AS ok FROM hadeeth WHERE lang != ? AND id = ?').get(lang, id) as { ok: number } | undefined;
    return Boolean(other);
  } finally {
    db.close();
  }
}

export function loadCollection(lang: Lang, id: string): EncyclopediaHadith | null {
  const file = collectionFile();
  if (!file || !/^\d{1,12}$/.test(id)) return null;
  const db = openDatabase(file);
  try {
    const row = db.prepare(`
      SELECT id, title_ar AS titleAr, title, hadith_text_ar AS hadithTextAr, hadith_text AS hadithText,
        explanation_ar AS explanationAr, explanation, benefits_ar AS benefitsAr, benefits,
        grade_ar AS gradeAr, takhrij_ar AS takhrijAr, grade, takhrij, lang, link,
        source_version AS sourceVersion, source_updated AS sourceUpdated
      FROM hadeeth WHERE lang = ? AND id = ?
    `).get(lang, id) as StoredRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      lang,
      title: row.title,
      arabic: blank(row.hadithTextAr),
      arabicIntro: null,
      text: row.hadithText,
      intro: null,
      explanation: blank(row.explanation),
      explanationArabic: blank(row.explanationAr),
      lessons: lessons(row.benefits),
      lessonsArabic: lessons(row.benefitsAr),
      grade: blank(row.grade),
      gradeArabic: blank(row.gradeAr),
      attribution: blank(row.takhrij),
      attributionArabic: blank(row.takhrijAr),
      categoryIds: [],
      languages: [row.lang],
      sourceUrl: row.link,
      audioIncluded: false,
      sourceVersion: row.sourceVersion,
      sourceUpdated: row.sourceUpdated,
    };
  } finally {
    db.close();
  }
}

export function collectionSummary(): CollectionSummary {
  const file = collectionFile();
  if (!file) return { available: false, path: null, languages: [] };
  const db = openDatabase(file);
  try {
    const languages = db.prepare(`
      SELECT lang, source_version AS version, source_updated AS updated, data_rows AS rows, source_file AS file, sha256
      FROM import_meta ORDER BY lang
    `).all() as CollectionSummary['languages'];
    return { available: true, path: file, languages };
  } finally {
    db.close();
  }
}

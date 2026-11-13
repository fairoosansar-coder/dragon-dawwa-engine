import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { collectionSummary, loadCollection, replaceLanguage } from './collection.ts';
import { writePdfIngestionPlan } from './pdfPlan.ts';
import { parseWorkbook } from './workbook.ts';

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : '';
  if (!value || value.startsWith('--')) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

const persist = path.resolve(arg('--persist'));
const files = [
  ['en', arg('--en')],
  ['ta', arg('--ta')],
  ['si', arg('--si')],
] as const;
const pdfDir = process.argv.includes('--pdf-dir') ? arg('--pdf-dir') : path.dirname(files[0][1]);

const missing = files.filter(([, file]) => !fs.existsSync(file)).map(([, file]) => file);
if (missing.length) {
  console.error(JSON.stringify({ missing }));
  process.exit(1);
}

const before = files.map(([, file]) => {
  const stat = fs.statSync(file);
  return { file, size: stat.size, mtimeMs: stat.mtimeMs };
});

const db = path.join(persist, 'sources', 'hadeethenc.sqlite');
const imported = [];
for (const [lang, file] of files) {
  const body = fs.readFileSync(file);
  const parsed = parseWorkbook(file, lang);
  imported.push(
    replaceLanguage(db, parsed, {
      lang,
      file,
      sha256: createHash('sha256').update(body).digest('hex'),
      bytes: body.length,
    }),
  );
}

process.env.DD_PERSIST_DIR = persist;
process.env.HADEETHENC_DB = db;
const checks = [
  loadCollection('en', '1751'),
  loadCollection('ta', '2750'),
  loadCollection('si', '1751'),
].map(row =>
  row
    ? { id: row.id, lang: row.lang, version: row.sourceVersion ?? null, grade: row.grade, link: row.sourceUrl }
    : null,
);
const originals = before.map(item => {
  const stat = fs.statSync(item.file);
  return { file: item.file, unchanged: stat.size === item.size && stat.mtimeMs === item.mtimeMs };
});
if (originals.some(item => !item.unchanged) || checks.some(item => !item)) {
  console.error(JSON.stringify({ originals, checks }));
  process.exit(1);
}

const plan = writePdfIngestionPlan(pdfDir, path.join(persist, 'sources', 'pdf-ingestion-plan.json'));
const log = {
  importedAt: new Date().toISOString(),
  database: db,
  originalsMoved: false,
  originals,
  languages: imported,
  checks,
  summary: collectionSummary(),
  pdf: { ingested: plan.ingested, files: plan.files.map(file => ({ name: file.name, bytes: file.bytes, pageCount: file.pageCount })) },
};
fs.writeFileSync(path.join(persist, 'sources', 'import-log.json'), `${JSON.stringify(log, null, 2)}\n`);
console.log(JSON.stringify(log, null, 2));

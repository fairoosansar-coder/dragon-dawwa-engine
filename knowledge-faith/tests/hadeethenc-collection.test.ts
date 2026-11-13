import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { missingTranslation, replaceLanguage, searchCollection, loadCollection } from '../src/server/hadeethenc/collection.ts';
import { applyPersistDir } from '../src/server/persist.ts';
import { writePdfIngestionPlan } from '../src/server/hadeethenc/pdfPlan.ts';
import { parseWorkbookXml } from '../src/server/hadeethenc/workbook.ts';
import { archiveResearchJob, readArchivedResearchJob, saveEpisodeAudio, readSavedEpisode } from '../src/server/research/savedWork.ts';
import type { ResearchJobResponse } from '../src/shared/contracts/v1.ts';

const SHARED = `<?xml version="1.0"?>
<sst>
  <si><t># Last update: 2026-05-10 17:43:35 (v1.25.0)</t></si>
  <si><t>id</t></si><si><t>title_ar</t></si><si><t>title</t></si>
  <si><t>hadith_text_ar</t></si><si><t>hadith_text</t></si>
  <si><t>explanation_ar</t></si><si><t>explanation</t></si>
  <si><t>benefits_ar</t></si><si><t>benefits</t></si>
  <si><t>grade_ar</t></si><si><t>takhrij_ar</t></si>
  <si><t>grade</t></si><si><t>takhrij</t></si><si><t>lang</t></si><si><t>link</t></si>
  <si><t>Wash her</t></si>
  <si><t>Arabic text</t></si>
  <si><t>English text</t></si>
  <si><t>[Authentic]</t></si>
  <si><t>[Agreed upon]</t></si>
</sst>`;

const SHEET = `<?xml version="1.0"?>
<worksheet><sheetData>
  <row><c r="A1" t="s"><v>0</v></c></row>
  <row>
    <c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c><c r="C2" t="s"><v>3</v></c>
    <c r="D2" t="s"><v>4</v></c><c r="E2" t="s"><v>5</v></c><c r="F2" t="s"><v>6</v></c>
    <c r="G2" t="s"><v>7</v></c><c r="H2" t="s"><v>8</v></c><c r="I2" t="s"><v>9</v></c>
    <c r="J2" t="s"><v>10</v></c><c r="K2" t="s"><v>11</v></c><c r="L2" t="s"><v>12</v></c>
    <c r="M2" t="s"><v>13</v></c><c r="N2" t="s"><v>14</v></c><c r="O2" t="s"><v>15</v></c>
  </row>
  <row>
    <c r="A3"><v>1751</v></c>
    <c r="C3" t="s"><v>16</v></c>
    <c r="D3" t="s"><v>17</v></c>
    <c r="E3" t="s"><v>18</v></c>
    <c r="L3" t="s"><v>19</v></c>
    <c r="M3" t="s"><v>20</v></c>
    <c r="N3" t="inlineStr"><is><t>en</t></is></c>
    <c r="O3" t="inlineStr"><is><t>https://hadeethenc.com/en/browse/hadith/1751</t></is></c>
  </row>
</sheetData></worksheet>`;

describe('HadeethEnc workbook import', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hadeethenc-'));
  const db = path.join(dir, 'hadeethenc.sqlite');
  const previousDb = process.env.HADEETHENC_DB;
  const previousPersist = process.env.DD_PERSIST_DIR;

  after(() => {
    if (previousDb === undefined) delete process.env.HADEETHENC_DB;
    else process.env.HADEETHENC_DB = previousDb;
    if (previousPersist === undefined) delete process.env.DD_PERSIST_DIR;
    else process.env.DD_PERSIST_DIR = previousPersist;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the printed id, language, version, grade, and link', () => {
    const parsed = parseWorkbookXml(SHARED, SHEET, 'en');
    assert.equal(parsed.banner.version, 'v1.25.0');
    assert.equal(parsed.sheetRows, 3);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].benefits, '');
    const imported = replaceLanguage(db, parsed, {
      lang: 'en',
      file: '/tmp/HadeethEnc.com_en-v1.25.0.xlsx',
      sha256: 'abc',
      bytes: 10,
    });
    assert.equal(imported.dataRows, 1);
    process.env.HADEETHENC_DB = db;
    const found = searchCollection('en', 'Wash', 1);
    assert.equal(found?.[0]?.id, '1751');
    assert.equal(found?.[0]?.title, 'Wash her');
    const row = loadCollection('en', '1751');
    assert.equal(row?.grade, '[Authentic]');
    assert.equal(row?.sourceUrl, 'https://hadeethenc.com/en/browse/hadith/1751');
    assert.equal(row?.sourceVersion, 'v1.25.0');
    assert.equal(row?.lang, 'en');
    assert.equal(searchCollection('en', 'not-in-the-sheet', 1)?.length, 0);
    assert.equal(loadCollection('ta', '1751'), null);
    assert.equal(missingTranslation('ta', '1751'), true);
    assert.equal(searchCollection('si', 'Wash', 1)?.length, 0);
  });

  it('does not point a Railway process at the Mac disk', () => {
    const previousRailway = process.env.RAILWAY_ENVIRONMENT;
    delete process.env.DD_PERSIST_DIR;
    process.env.RAILWAY_ENVIRONMENT = 'production';
    try {
      applyPersistDir();
      assert.equal(process.env.DD_PERSIST_DIR, undefined);
    } finally {
      if (previousRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT;
      else process.env.RAILWAY_ENVIRONMENT = previousRailway;
    }
  });

  it('writes a PDF plan without copying page text', () => {
    const pdfDir = path.join(dir, 'pdfs');
    fs.mkdirSync(pdfDir);
    fs.writeFileSync(path.join(pdfDir, 'sample.pdf'), 'not a real pdf');
    const plan = writePdfIngestionPlan(pdfDir, path.join(dir, 'pdf-ingestion-plan.json'));
    assert.equal(plan.ingested, false);
    assert.equal(plan.files.length, 1);
    assert.equal(plan.files[0].sha256, createHash('sha256').update('not a real pdf').digest('hex'));
    const written = fs.readFileSync(path.join(dir, 'pdf-ingestion-plan.json'), 'utf8');
    assert.equal(written.includes('not a real pdf'), false);
    assert.match(written, /1-based page number/);
  });

  it('keeps a finished job and episode audio on disk', () => {
    process.env.DD_PERSIST_DIR = dir;
    const response = {
      contractVersion: '1.0.0',
      job: { id: 'job-1', status: 'done' },
      dossier: null,
    } as ResearchJobResponse;
    archiveResearchJob('fingerprint', response);
    assert.equal(readArchivedResearchJob('job-1')?.job.id, 'job-1');
    saveEpisodeAudio(
      {
        id: 'pod-1',
        jobId: 'job-1',
        question: 'A question',
        language: 'en',
        participants: [],
        lines: [{ speaker: 'Host', role: 'host', text: 'Hello' }],
        sources: [],
        reportHtml: '<p>Report</p>',
        mimeType: 'audio/wav',
        savedAt: '2026-10-27T00:00:00.000Z',
        hasAudio: true,
      },
      'UklGRg==',
    );
    assert.equal(readSavedEpisode('pod-1')?.audioBase64, 'UklGRg==');
    assert.equal(fs.existsSync(path.join(dir, 'podcasts', 'pod-1.wav.b64')), true);
  });
});

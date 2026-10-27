import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface PdfInventoryFile {
  name: string;
  path: string;
  bytes: number;
  sha256: string;
  /** Present only when the file system reports a page count. Text is not read. */
  pageCount: number | null;
}

export interface PdfIngestionPlan {
  ingested: false;
  reason: string;
  pageReference: string;
  qualityChecks: string[];
  files: PdfInventoryFile[];
}

export const PDF_QUALITY_CHECKS = [
  'Count characters on the page text layer before keeping a passage.',
  'Leave a page with an empty text layer unextracted. Do not guess words from the image.',
  'Flag a page whose text layer is shorter than 40 characters.',
  'Flag a page whose text layer is only punctuation or a running header.',
  'Store the PDF path and the 1-based page number with every passage taken from that page.',
  'Do not add a hadith row that is not printed on that page.',
];

function pageCount(file: string): number | null {
  try {
    const raw = execFileSync('mdls', ['-raw', '-name', 'kMDItemNumberOfPages', file], { encoding: 'utf8' }).trim();
    if (!/^\d+$/.test(raw)) return null;
    const count = Number(raw);
    return count > 0 ? count : null;
  } catch {
    return null;
  }
}

/** Record the PDF files and the checks a later ingestion must run. Page text stays in the PDF. */
export function writePdfIngestionPlan(pdfDir: string, destination: string): PdfIngestionPlan {
  const names = fs.existsSync(pdfDir)
    ? fs.readdirSync(pdfDir).filter(name => name.toLowerCase().endsWith('.pdf') && !name.startsWith('._')).sort()
    : [];
  const files = names.map(name => {
    const file = path.join(pdfDir, name);
    const body = fs.readFileSync(file);
    return {
      name,
      path: file,
      bytes: body.length,
      sha256: createHash('sha256').update(body).digest('hex'),
      pageCount: pageCount(file),
    };
  });
  const plan: PdfIngestionPlan = {
    ingested: false,
    reason: 'This pass records the PDF files and the extraction checks. It does not copy page text into the source collection.',
    pageReference: 'A later passage must store the PDF path and the 1-based page number it was read from.',
    qualityChecks: PDF_QUALITY_CHECKS,
    files,
  };
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(plan, null, 2)}\n`);
  return plan;
}

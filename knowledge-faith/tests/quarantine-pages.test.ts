import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readingPages } from '../src/server/pdfPages.ts';
import {
  PREPARED_TEXT_QUARANTINE_MESSAGE,
  preparedTextQuarantined,
} from '../src/shared/bookReadiness.ts';
import type { LibraryDocument } from '../src/shared/libraryDocument.ts';

function quarantineDoc(): Pick<LibraryDocument, 'id' | 'blocks' | 'media'> {
  return {
    id: 2843165,
    blocks: [],
    media: [
      {
        kind: 'pdf',
        label: 'Original PDF',
        extension: 'PDF',
        sourceUrl: 'https://islamhouse.com/files/quarantined-fixture.pdf',
        viewUrl: '/api/library/media?u=https%3A%2F%2Fislamhouse.com%2Ffiles%2Fquarantined-fixture.pdf',
      },
    ],
  };
}

describe('prepared-text quarantine blocks PDF page extraction', () => {
  it('keeps book 2843165 quarantined while retaining PDF media', () => {
    assert.equal(preparedTextQuarantined(2843165), true);
    const doc = quarantineDoc();
    assert.equal(doc.media.some(file => file.kind === 'pdf'), true);
    assert.match(PREPARED_TEXT_QUARANTINE_MESSAGE, /PDF|under review/i);
  });

  it('readingPages returns no prepared pages for a quarantined id even with a PDF', async () => {
    const pages = await readingPages(quarantineDoc());
    assert.deepEqual(pages, []);
  });

  it('readingPages still pages non-quarantined HTML prose', async () => {
    const pages = await readingPages({
      id: 1,
      blocks: [
        { id: 'p1', kind: 'paragraph', text: 'First paragraph of prepared text.' },
        { id: 'p2', kind: 'paragraph', text: 'Second paragraph of prepared text.' },
      ],
      media: [],
    });
    assert.ok(pages.length >= 1);
    assert.ok(pages[0]?.blocks.some(block => /First paragraph/.test(block.text)));
  });
});

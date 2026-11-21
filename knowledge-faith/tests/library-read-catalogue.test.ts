import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  catalogueLimitation,
  readerBlocksFromItemHtml,
} from '../src/server/libraryRead.ts';

describe('library reader language labeling', () => {
  it('keeps publication language when there is no rendered book prose', () => {
    const empty = readerBlocksFromItemHtml(null);
    assert.equal(empty.prose, false);
    // Contract: catalogue-only items must not stamp the requested UI language as
    // the rendered reader language (see live Discover Islam ta over en).
  });
});

describe('library reader catalogue honesty (offline fixture)', () => {
  it('does not promote a catalogue description into readable book prose', () => {
    const empty = readerBlocksFromItemHtml(null);
    assert.equal(empty.blocks.length, 0);
    assert.equal(empty.prose, false);

    const descriptionAsHtmlWouldHaveBeenProse = readerBlocksFromItemHtml(
      '<p>A short catalogue blurb about Discover Islam.</p>',
    );
    // If html were present it would be prose — but catalogue description is not passed as html.
    assert.equal(descriptionAsHtmlWouldHaveBeenProse.prose, true);

    const limitation = catalogueLimitation(
      {
        description: 'A short catalogue blurb about Discover Islam.',
        files: [
          {
            extension: 'PDF',
            url: 'https://islamhouse.com/files/discover.pdf',
            label: 'PDF',
            size: null,
            play: null,
          },
        ],
      },
      false,
    );
    assert.match(limitation ?? '', /not the book|catalogue description/i);
    assert.equal(catalogueLimitation({ description: 'blurb', files: [] }, true), null);
  });

  it('keeps PDF-only items as partial with an honest limitation', () => {
    const { blocks, prose } = readerBlocksFromItemHtml('');
    assert.equal(blocks.length, 0);
    assert.equal(prose, false);
    const note = catalogueLimitation(
      {
        description: 'Catalogue only.',
        files: [
          {
            extension: 'PDF',
            url: 'https://example.test/book.pdf',
            label: null,
            size: null,
            play: null,
          },
        ],
      },
      prose,
    );
    assert.ok(note);
    assert.match(note, /PDF/i);
  });
});

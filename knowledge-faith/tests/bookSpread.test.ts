import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPage, facingPages, islamHousePdfUrl, spreadOrigin, stepPage } from '../src/shared/bookSpread.ts';

test('only an IslamHouse PDF address is opened in the reader', () => {
  const file = 'https://d1.islamhouse.com/data/ta/ih_books/single/ta-muhammad-pocket-guide.pdf';
  assert.equal(islamHousePdfUrl(file), file);
  assert.equal(islamHousePdfUrl('http://d1.islamhouse.com/data/ta/book.pdf'), null);
  assert.equal(islamHousePdfUrl('https://example.test/data/book.pdf'), null);
  assert.equal(islamHousePdfUrl('https://d1.islamhouse.com/other/book.pdf'), null);
  assert.equal(islamHousePdfUrl('https://d1.islamhouse.com/data/ta/book.mp3'), null);
  assert.equal(islamHousePdfUrl('https://user:pass@d1.islamhouse.com/data/ta/book.pdf'), null);
});

test('a spread keeps the cover alone and pairs the pages after it', () => {
  assert.deepEqual(facingPages(1, 226, true), { pages: [1], blank: null });
  assert.deepEqual(facingPages(2, 226, true), { pages: [2, 3], blank: null });
  assert.deepEqual(facingPages(3, 226, true), { pages: [2, 3], blank: null });
  assert.equal(spreadOrigin(3, 226, true), 2);
  assert.deepEqual(facingPages(226, 226, true), { pages: [226], blank: 'right' });
  assert.deepEqual(facingPages(5, 5, true), { pages: [4, 5], blank: null });
  assert.deepEqual(facingPages(4, 226, false), { pages: [4], blank: null });
  assert.equal(clampPage(0, 10), 1);
  assert.equal(clampPage(40, 10), 10);
});

test('page turns move a whole leaf and stop at the ends', () => {
  assert.equal(stepPage(1, 226, true, 1), 2);
  assert.equal(stepPage(2, 226, true, 1), 4);
  assert.equal(stepPage(3, 226, true, 1), 4);
  assert.equal(stepPage(4, 226, true, -1), 2);
  assert.equal(stepPage(2, 226, true, -1), 1);
  assert.equal(stepPage(1, 226, true, -1), 1);
  assert.equal(stepPage(226, 226, true, 1), 226);
  assert.equal(stepPage(8, 20, false, 1), 9);
  assert.equal(stepPage(8, 20, false, -1), 7);
});

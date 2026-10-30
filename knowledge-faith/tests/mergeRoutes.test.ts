import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHash, quranListQuery, showSectionSearch } from '../src/lib/route.ts';

test('research and book routes retain query parameters after the library merge', () => {
  for (const root of ['hub', 'quran', 'hadith', 'books']) {
    const route = parseHash(`#/${root}/research?q=mercy`);
    assert.equal(route.path, root);
    assert.deepEqual(route.segments, ['research']);
    assert.equal(route.params.get('q'), 'mercy');
    assert.equal(showSectionSearch(route.path, route.segments), false);
  }
  const book = parseHash('#/books/item/123?lang=ta');
  assert.deepEqual(book.segments, ['item', '123']);
  assert.equal(book.params.get('lang'), 'ta');
  assert.equal(parseHash('#/podcast').path, 'podcast');
});

test('Quran reader search stays scoped while Books and discovery search remain available', () => {
  assert.equal(showSectionSearch('quran', []), true);
  assert.equal(showSectionSearch('quran', ['search']), true);
  for (const section of ['book', 'study', 'mine', 'research']) {
    assert.equal(showSectionSearch('quran', [section]), false);
  }
  assert.equal(quranListQuery('', '?q=mercy&hadith=123'), '');
  assert.equal(quranListQuery('Yunus', '?q=mercy'), 'Yunus');
  assert.equal(showSectionSearch('books', []), true);
  assert.equal(showSectionSearch('books', ['item', '123']), false);
  assert.equal(showSectionSearch('hub', []), false);
  for (const section of ['discover', 'deepen', 'prophet']) assert.equal(showSectionSearch('hub', [section]), true);
});

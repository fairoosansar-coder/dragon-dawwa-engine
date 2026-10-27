import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLibraryItem } from '../src/shared/islamhouse.ts';
import {
  bookCard,
  bookMatches,
  paginateBlocks,
  parseBookList,
  parseSearchPage,
  reflowPage,
  textFromPdfItems,
  topCategories,
  translationChoices,
} from '../src/shared/bookShelf.ts';

test('book covers stay on the IslamHouse file host and essential means critical', () => {
  const item = parseLibraryItem(
    {
      id: 2846907,
      title: 'Hisn Al-Muslim',
      type: 'books',
      source_language: 'en',
      importance_level: 'critical',
      image: 'https://d1.islamhouse.com/data/en/ih_books/single/covers/hisn.png',
      prepared_by: [{ kind: 'author', title: 'Saeed Bin Ali Bin Wahf Al-Qahtani' }],
      attachments: [{ extension_type: 'PDF', url: 'https://d1.islamhouse.com/data/en/ih_books/single/hisn.pdf', description: 'Hisn', size: '2.21 MB' }],
    },
    'en',
  );
  assert.ok(item);
  assert.equal(item.image?.includes('d1.islamhouse.com'), true);
  const card = bookCard(item);
  assert.equal(card.essential, true);
  assert.equal(card.authors[0], 'Saeed Bin Ali Bin Wahf Al-Qahtani');
  assert.equal(card.files[0].extension, 'PDF');

  const rejected = parseLibraryItem(
    {
      id: 1,
      title: 'Outside',
      type: 'books',
      image: 'https://example.test/cover.png',
      attachments: [{ extension_type: 'PDF', url: 'https://example.test/secret.pdf' }],
    },
    'en',
  );
  assert.equal(rejected?.image, null);
  assert.equal(rejected?.files.length, 0);
  assert.equal(JSON.stringify(card).includes('paV29'), false);
});

test('book list totals come from the catalogue and search html is stripped', () => {
  const list = parseBookList(
    {
      data: [{ id: 12, title: 'Prayer', type: 'books', source_language: 'en' }],
      links: { pages_number: 4, total_items: 81 },
    },
    'en',
    1,
  );
  assert.equal(list?.total, 81);
  assert.equal(list?.items[0].title, 'Prayer');
  const empty = parseBookList({ error: 'Error: There is no Data' }, 'ta', 1);
  assert.equal(empty?.total, 0);
  const search = parseSearchPage({
    numFound: 2,
    from: 1,
    to: 1,
    showMore: false,
    items: [{ id: '369427', title: '<a href="https://islamhouse.com/369427">My <mark>Prayer</mark></a>', nabza: 'A <mark>prayer</mark> overview.' }],
  });
  assert.equal(search?.hits[0].title, 'My Prayer');
  assert.equal(search?.hits[0].description, 'A prayer overview.');
  assert.equal(bookMatches({ title: 'My Prayer', description: null, authors: ['Qahtani'], translators: [], publisher: null }, 'qahtani'), true);
  assert.equal(bookMatches({ title: 'My Prayer', description: null, authors: [], translators: [], publisher: null }, 'fast'), false);
});

test('reader pages keep headings and join wrapped lines', () => {
  const blocks = reflowPage(`2
Hisn Al-Muslim
Introduction
Praise be to Allah. We praise Him, seek His help,
and ask for His forgiveness.`);
  assert.equal(blocks.some(block => block.text === '2'), false);
  assert.equal(blocks[0].kind, 'heading');
  assert.equal(blocks[0].text, 'Hisn Al-Muslim');
  assert.equal(blocks.find(block => block.text === 'Introduction')?.kind, 'heading');
  assert.equal(blocks.find(block => block.kind === 'paragraph')?.text, 'Praise be to Allah. We praise Him, seek His help, and ask for His forgiveness.');
  const title = reflowPage('In the Name of Allah, the Most\nCompassionate, the Most Merciful\nIntroduction');
  assert.equal(title[0].text, 'In the Name of Allah, the Most Compassionate, the Most Merciful');
  assert.equal(title[1].text, 'Introduction');
  const positioned = textFromPdfItems([
    { str: 'Supplications', x: 49, y: 380, width: 80 },
    { str: 'from the Qur’an', x: 86, y: 363, width: 90 },
    { str: 'witness th', x: 40, y: 229, width: 54 },
    { str: 'at there', x: 94, y: 229, width: 40 },
  ]);
  assert.equal(positioned, 'Supplications\nfrom the Qur’an\nwitness that there');
  const mixed = reflowPage('2بِسْمِ اللَّهِHisn Al-Muslim');
  assert.equal(mixed.some(block => block.text.includes('Hisn') && block.text.includes('بِ')), false);
  assert.equal(mixed.some(block => block.text.startsWith('Hisn')), true);
  const pages = paginateBlocks([
    { id: 'h', kind: 'heading', text: 'One' },
    { id: 'p', kind: 'paragraph', text: 'A'.repeat(40) },
    { id: 'h2', kind: 'heading', text: 'Two' },
    { id: 'p2', kind: 'paragraph', text: 'B'.repeat(40) },
  ], 80);
  assert.equal(pages.length, 2);
  assert.equal(pages[1][0].text, 'Two');
});

test('category titles and supported translations drop other languages', () => {
  const categories = topCategories({
    id: 1,
    title: 'Tree',
    sub_categories: [
      { id: 768, title: 'Introducing Islam to non-Muslims', apiurl: 'https://api3.islamhouse.com/v3/secret/main/x' },
      { id: 'bad', title: '' },
    ],
  });
  assert.deepEqual(categories, [{ id: 768, title: 'Introducing Islam to non-Muslims' }]);
  assert.equal(JSON.stringify(categories).includes('secret'), false);
  assert.deepEqual(
    translationChoices([
      { id: 1, slang: 'en' },
      { id: 2, slang: 'ta' },
      { id: 3, slang: 'ur' },
      { id: 4, slang: 'si' },
    ]),
    [
      { lang: 'en', id: 1 },
      { lang: 'ta', id: 2 },
      { lang: 'si', id: 4 },
    ],
  );
});

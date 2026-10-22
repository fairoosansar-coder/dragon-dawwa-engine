import test from 'node:test';
import assert from 'node:assert/strict';
import { encyclopediaEvidence, mergeFurtherEvidence } from '../src/server/grounding.ts';
import {
  categoriesForParent,
  ENCYCLOPEDIA_EVIDENCE_LIMIT,
  HADEETH_UNAVAILABLE,
  HADEETHENC_CATEGORY_LIST,
  hadeethShareText,
  pageByRelevance,
  parseCategories,
  parseHadeeth,
  parseHadeethList,
  parseHadeethSearch,
  textBeyondIntro,
} from '../src/shared/hadeethenc.ts';
import { islamHousePage, LIBRARY_CATEGORY_EMPTY, parseLibraryItem, parseLibraryPage, parseSubcategories, WORSHIP_TOPICS } from '../src/shared/islamhouse.ts';
import { showSectionSearch } from '../src/lib/route.ts';
import { STRINGS } from '../src/lib/i18n.ts';

const hadeeth = {
  id: '5907',
  title: 'Title stays exact',
  hadeeth: '  Selected wording stays  ',
  attribution: 'Agreed upon',
  grade: 'Authentic',
  explanation: 'Explanation stays',
  hints: ['First lesson', 'Second lesson'],
  categories: ['39'],
  translations: ['en', 'ta', 'si'],
  hadeeth_intro: '',
  hadeeth_ar: 'النص العربي',
  hadeeth_intro_ar: '',
  explanation_ar: 'الشرح',
  hints_ar: ['فائدة'],
  attribution_ar: 'متفق عليه',
  grade_ar: 'صحيح',
};

test('HadeethEnc record keeps wording, grade, and has no audio', () => {
  const parsed = parseHadeeth(hadeeth, 'ta');
  assert.ok(parsed);
  assert.equal(parsed.text, '  Selected wording stays  ');
  assert.equal(parsed.arabic, 'النص العربي');
  assert.equal(parsed.grade, 'Authentic');
  assert.equal(parsed.gradeArabic, 'صحيح');
  assert.deepEqual(parsed.lessons, ['First lesson', 'Second lesson']);
  assert.equal(parsed.audioIncluded, false);
  assert.equal(textBeyondIntro('The chain:', 'The chain: the narration'), null);
  assert.equal(textBeyondIntro('A separate note', 'The narration'), 'A separate note');
  assert.equal(parsed.sourceUrl, 'https://hadeethenc.com/ta/browse/hadith/5907');
  const shared = hadeethShareText(parsed);
  assert.match(shared, /Selected wording stays/);
  assert.match(shared, /النص العربي/);
  assert.match(shared, /Explanation stays/);
  assert.match(shared, /First lesson/);
  assert.match(shared, /Authentic/);
  const evidence = encyclopediaEvidence([parsed]);
  assert.equal(evidence[0].label, 'Hadith · HadeethEnc 5907');
  assert.equal(evidence[0].grades[0].grade, 'Authentic');
  assert.equal(evidence[0].text, parsed.text);
});

test('a missing HadeethEnc translation is not filled from another language', () => {
  assert.equal(parseHadeeth({ id: '10849' }, 'ta'), null);
  assert.match(HADEETH_UNAVAILABLE, /not available in the selected language/);
  assert.deepEqual(parseHadeethSearch({ suggestions: { id: null, title: '', hadith_text: '' } }), []);
  const hits = parseHadeethSearch([{ id: '11272', title: 'There should not be two Witr prayers during one night', hadith_text: 'full text' }]);
  assert.deepEqual(hits, [{ id: '11272', title: 'There should not be two Witr prayers during one night' }]);
});

test('HadeethEnc categories and paged lists use the source fields', () => {
  assert.equal(HADEETHENC_CATEGORY_LIST, 'https://hadeethenc.com/api/v1/categories/list/');
  const recorded = [
    { id: '1', title: "The Noble Qur'an and Qur'anic Sciences", hadeeths_count: '81', parent_id: null },
    { id: '738', title: 'Interpretation of verses', hadeeths_count: '13', parent_id: '10' },
  ];
  const categories = parseCategories(recorded);
  assert.deepEqual(categories, [
    { id: '1', title: "The Noble Qur'an and Qur'anic Sciences", count: 81, parentId: null },
    { id: '738', title: 'Interpretation of verses', count: 13, parentId: '10' },
  ]);
  assert.deepEqual(categoriesForParent(categories ?? [], null).map(category => category.id), ['1']);
  assert.deepEqual(categoriesForParent(categories ?? [], '10').map(category => category.id), ['738']);
  assert.equal(parseCategories([{ id: '4', title: 'Jurisprudence', hadeeths_count: '1150', parent_id: null }])?.[0].parentId, null);
  const page = parseHadeethList(
    {
      data: [{ id: '66510', title: 'A Tamil title', translations: ['ar', 'ta'] }],
      meta: { current_page: '1', last_page: '132', total_items: '264', per_page: '2' },
    },
    'ta',
    '4',
  );
  assert.equal(page?.pages, 132);
  assert.equal(page?.total, 264);
  assert.equal(page?.items[0].languages.includes('ta'), true);
});

test('IslamHouse worship topics stay on verified categories and empty languages stay empty', () => {
  assert.deepEqual(
    WORSHIP_TOPICS.map(topic => [topic.id, topic.categoryId]),
    [
      ['purification', 192809],
      ['prayer', 192812],
      ['fasting', 316761],
      ['zakah', 461271],
      ['hajj', 461274],
      ['dhikr', 193841],
    ],
  );
  const empty = parseLibraryPage({ status: 'success', code: 204, data: { error: 'Error: There is no items' } }, 'prayer', 'ta', 1);
  assert.deepEqual(empty?.items, []);
  const page = parseLibraryPage(
    {
      links: { current_page: 1, pages_number: 1, total_items: 1 },
      data: [
        {
          id: 795855,
          title: 'Summarized Islamic Fiqh (Purification)',
          type: 'books',
          description: 'A reviewed summary.',
          source_language: 'ta',
          add_date: 1418773406,
          update_date: false,
          prepared_by: [
            { title: 'Muhammad Bin Ibrahim Al-Tuwajre', kind: 'author' },
            { title: null, kind: 'translator' },
          ],
          attachments: [
            {
              extension_type: 'PDF',
              description: 'முக்தஸர்',
              size: '915.9 KB',
              url: 'https://d1.islamhouse.com/data/ta/ih_books/single/ta-book.pdf',
              updated_at: 1549394696,
            },
            { extension_type: 'MP3', url: 'https://evil.example/file.mp3' },
          ],
          api_url: 'https://api3.islamhouse.com/v3/secret/main/get-item/795855/en/json',
        },
      ],
    },
    'purification',
    'ta',
    1,
  );
  assert.equal(page?.items.length, 1);
  const item = page?.items[0];
  assert.equal(item?.added, '2014-12-16');
  assert.equal(item?.updated, '2019-02-05');
  assert.equal(item?.files.length, 1);
  assert.equal(item?.files[0].play, null);
  assert.equal(item?.sourceUrl, 'https://islamhouse.com/ta/books/795855/');
  assert.equal(JSON.stringify(item).includes('secret'), false);
  assert.equal(islamHousePage('en', 'videos', 2839969), 'https://islamhouse.com/en/videos/2839969/');
  const audio = parseLibraryItem(
    {
      id: 2917,
      title: 'Fasting And Obligatory Charity (Swam And Zakat)',
      type: 'audios',
      source_language: 'ta',
      attachments: [{ extension_type: 'MP3', url: 'https://d1.islamhouse.com/data/ta/ih_sounds/single/fasting.mp3', description: 'audio' }],
    },
    'ta',
  );
  assert.equal(audio?.files[0].play, 'audio');
  assert.equal(showSectionSearch('hadith', ['5907']), false);
  assert.equal(showSectionSearch('hadith', ['collections']), true);
  assert.equal(showSectionSearch('studio', ['pilot']), false);
  assert.equal(STRINGS.en.libraryEmpty, LIBRARY_CATEGORY_EMPTY);
  assert.equal(LIBRARY_CATEGORY_EMPTY, 'No items found in this category.');
  const children = parseSubcategories({
    id: '192812',
    title: 'Prayer',
    sub_categories: [{ id: 192815, title: 'Supererogatory Prayers', category_items: 'https://api3.islamhouse.com/v3/secret-key/main/get-category-items/192815/showall/en/en/1/25/json' }],
  });
  assert.deepEqual(children, { id: 192812, title: 'Prayer', children: [{ id: 192815, title: 'Supererogatory Prayers' }] });
  assert.equal(JSON.stringify(children).includes('secret-key'), false);
  assert.equal(ENCYCLOPEDIA_EVIDENCE_LIMIT, 3);
  const ranked = ['58215', '4560', '65085', '65037', '11272', '5907'];
  assert.deepEqual(pageByRelevance(ranked), ['58215', '4560', '65085']);
  assert.deepEqual(pageByRelevance(ranked, ENCYCLOPEDIA_EVIDENCE_LIMIT), ['65037', '11272', '5907']);
  const first = encyclopediaEvidence([{ ...parseHadeeth(hadeeth, 'en')!, id: '58215' }]);
  const next = encyclopediaEvidence([{ ...parseHadeeth(hadeeth, 'en')!, id: '4560' }], ENCYCLOPEDIA_EVIDENCE_LIMIT);
  assert.equal(next[0].id, 'E4');
  assert.equal(mergeFurtherEvidence(first, next)?.map(item => item.id).join(','), 'E1,E4');
  assert.equal(mergeFurtherEvidence(first, first), null);
});

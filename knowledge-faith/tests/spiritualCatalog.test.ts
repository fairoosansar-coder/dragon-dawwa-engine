import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_GUIDES, CHECKLISTS, DUAS, PILLARS, TOPICS, TOOL_ROUTES } from '../src/shared/spiritual/catalog.ts';
import { SOURCE_REGISTRY, hadithTranslationLabel } from '../src/shared/spiritual/registry.ts';
import { parseSourceId, sourceId } from '../src/shared/spiritual/sourceRefs.ts';
import { parseRefs } from '../src/shared/refs.ts';
import { HADITH_COLLECTIONS, LANGS } from '../src/shared/sources.ts';
import { sanitizeExplanation, sanitizeSuggestions, parseExplainInput } from '../src/server/spiritual/assistant.ts';

test('catalog: five pillars in order, unique slugs, complete titles in every language', () => {
  assert.deepEqual(PILLARS.map(p => p.id), ['shahadah', 'salah', 'zakah', 'fasting', 'hajj']);
  const slugs = ALL_GUIDES.map(g => g.guide.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const topic of TOPICS) {
    for (const l of LANGS) {
      assert.ok(topic.title[l].trim() && topic.subtitle[l].trim(), `${topic.id} ${l}`);
      for (const g of topic.groups) {
        assert.ok(g.title[l].trim(), `${topic.id}/${g.id} ${l}`);
        for (const guide of g.guides) assert.ok(guide.title[l].trim(), `${guide.slug} ${l}`);
      }
    }
    for (const tool of topic.tools) assert.ok(TOOL_ROUTES[tool], tool);
  }
  assert.ok(slugs.includes('zakat-al-fitr'));
  assert.notEqual(ALL_GUIDES.find(g => g.guide.slug === 'zakat-al-fitr')?.group, 'learn', 'Zakat al-Fitr is kept separate');
});

test('every cited source is well-formed and Sahih Muslim refs carry conventional numbering', () => {
  assert.ok(SOURCE_REGISTRY.size > 80);
  for (const [id, ref] of SOURCE_REGISTRY) {
    assert.equal(sourceId(ref), id);
    assert.equal(sourceId(parseSourceId(id)!), id);
    if (ref.kind === 'quran') assert.ok(parseRefs(ref.ref).length > 0, id);
    else {
      assert.ok(HADITH_COLLECTIONS.some(c => c.id === ref.collection), id);
      if (ref.collection === 'muslim') assert.ok(ref.conventional?.number, `${id} needs Abd al-Baqi numbering`);
    }
  }
});

test("du'a entries: unique, and sourced counts only where the narration states one", () => {
  const ids = DUAS.map(d => d.id);
  assert.equal(new Set(ids).size, ids.length);
  const counted = DUAS.filter(d => d.count).map(d => [d.id, sourceId(d.source)]);
  assert.deepEqual(counted, [
    ['after-tasbih', 'h:muslim:1352'],
    ['dhikr-subhan-hundred', 'h:bukhari:6405'],
  ]);
  for (const d of DUAS) assert.equal(d.kind, d.source.kind === 'quran' ? 'quran' : 'prophetic');
});

test('checklists separate enduring learning from changing logistics', () => {
  for (const list of Object.values(CHECKLISTS)) {
    assert.ok(list.some(i => i.kind === 'learning') && list.some(i => i.kind === 'logistics'));
    assert.equal(new Set(list.map(i => i.id)).size, list.length);
  }
});

test('hadith translations are attributed only to translators the edition names', () => {
  assert.equal(hadithTranslationLabel('bukhari', 'en'), 'Muhsin Khan (hadith-api eng-bukhari)');
  assert.equal(hadithTranslationLabel('tirmidhi', 'en'), 'hadith-api eng-tirmidhi; translator not named by the edition');
  assert.equal(hadithTranslationLabel('bukhari', 'ta'), 'hadith-api tam-bukhari; translator not named by the edition');
});

test('zakah assistant: suggestions keep only numbers the user actually wrote', () => {
  const text = 'I have Rs. 1,250,000 in my savings and 8 pavan of 22k gold. My card bill is 45000.';
  const { suggestions, discarded } = sanitizeSuggestions(
    [
      { kind: 'asset', category: 'bank', label: 'Savings', amount: '1250000', quote: 'Rs. 1,250,000' },
      { kind: 'asset', category: 'gold', label: 'Gold', weight: '8', unit: 'pavan', karat: 22, quote: '8 pavan of 22k gold' },
      { kind: 'liability', category: 'bills-due', label: 'Card', amount: '45,000', quote: '45000' },
      { kind: 'asset', category: 'cash', label: 'Guess', amount: '50000', quote: '' },
      { kind: 'asset', category: 'bills-due', label: 'Wrong kind', amount: '45000', quote: '' },
      { kind: 'asset', category: 'shares', label: 'No number', quote: '' },
      { kind: 'asset', category: 'bank', label: 'Bad currency', amount: '45000', currency: 'ZZZ', quote: '' },
      { kind: 'asset', category: 'gold', label: 'Made-up karat', weight: '8', karat: 24, quote: '' },
    ],
    text,
  );
  assert.deepEqual(
    suggestions.map(s => [s.category, s.amount ?? s.weight, s.karat]),
    [
      ['bank', '1250000', undefined],
      ['gold', '8', 22],
      ['bills-due', '45000', undefined],
    ],
  );
  assert.equal(discarded, 5);
});

test('zakah explanation: only structure is accepted and amounts in the reply are dropped', () => {
  const input = parseExplainInput(
    {
      profileId: 'nisab-silver',
      profileVersion: '1.0.0',
      status: 'due',
      nisabMet: true,
      hawl: 'yes',
      includedCategories: ['cash', 'gold', 'not-a-category'],
      excluded: [{ category: 'shares', reason: 'zkReasonSpecialist', amount: '900000' }],
      totals: { net: '123456' },
      zakahDue: '3086.40',
    },
    'si',
  );
  assert.deepEqual(input.includedCategories, ['cash', 'gold']);
  assert.deepEqual(input.excluded, [{ category: 'shares', reason: 'zkReasonSpecialist' }]);
  assert.equal(JSON.stringify(input).includes('123456'), false);
  assert.equal(JSON.stringify(input).includes('3086'), false);
  assert.throws(() => parseExplainInput({ profileId: 'x', profileVersion: '1', status: 'due' }, 'en'));
  assert.deepEqual(
    sanitizeExplanation(['The rate is 2.5% of net wealth.', 'You owe 3086.40.', 'Nisab uses 595 g of silver.'], ['2.5', '85', '595', '24']),
    ['The rate is 2.5% of net wealth.', 'Nisab uses 595 g of silver.'],
  );
});

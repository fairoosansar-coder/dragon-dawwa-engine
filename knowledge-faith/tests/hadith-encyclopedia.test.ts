import assert from 'node:assert/strict';
import test from 'node:test';
import { HADITH_COLLECTIONS } from '../src/shared/sources.ts';
import {
  confirmedCount,
  confirmedIndexLabel,
  ENCYCLOPEDIA_DOMAINS,
  isBrotherhoodRecord,
  KUTUB_AL_SITTAH,
  narratorFromRecord,
  sahihBadge,
} from '../src/views/hadithEncyclopediaCopy.ts';

test('sahih badge uses the published grade and skips a missing one', () => {
  assert.equal(sahihBadge('Authentic'), 'Authentic');
  assert.equal(sahihBadge('சரியானது'), 'சரியானது');
  assert.equal(sahihBadge('صحيح'), 'صحيح');
  assert.equal(sahihBadge('Agreed upon'), null);
  assert.equal(sahihBadge(null), null);
  assert.equal(sahihBadge('  '), null);
});

test('narrator is taken from the record wording', () => {
  assert.equal(narratorFromRecord({ text: 'Abu Hamzah Anas ibn Mālik reported that the Prophet said' }), 'Anas ibn Mālik');
  assert.equal(narratorFromRecord({ text: 'Anas (may Allah be pleased with him) reported' }), 'Anas');
  assert.equal(narratorFromRecord({ arabic: 'عَنْ أَنَسٍ رَضِيَ اللَّهُ عَنْهُ' }), 'أَنَسٍ');
  assert.equal(narratorFromRecord({ text: 'Abu Hurayrah reported' }), null);
});

test('brotherhood check requires the hadith wording', () => {
  assert.equal(isBrotherhoodRecord({ text: 'None of you believes until he loves for his brother what he loves for himself.' }), true);
  assert.equal(isBrotherhoodRecord({ title: 'Prayer times' }), false);
});

test('collection range and category counts stay absent unless confirmed', () => {
  assert.equal(confirmedIndexLabel(7563), '1–7,563');
  assert.equal(confirmedIndexLabel(0), null);
  assert.equal(confirmedIndexLabel('nope'), null);
  assert.equal(confirmedCount(200), 200);
  assert.equal(confirmedCount(-1), null);
  assert.equal(confirmedCount(undefined), null);
  assert.equal(ENCYCLOPEDIA_DOMAINS.some(domain => 'count' in domain), false);
});

test('kutub shelf is the six indexed collections', () => {
  assert.deepEqual(KUTUB_AL_SITTAH.map(book => book.id), ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah']);
  for (const book of KUTUB_AL_SITTAH) {
    assert.equal(HADITH_COLLECTIONS.some(item => item.id === book.id), true);
    assert.equal(book.tamil.length > 0, true);
  }
});

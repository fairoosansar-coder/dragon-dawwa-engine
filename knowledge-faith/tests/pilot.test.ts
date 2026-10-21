import test from 'node:test';
import assert from 'node:assert/strict';
import { keepPlaybackPosition } from '../src/lib/playbackPosition.ts';
import {
  PILOT_HADEETH_IDS,
  PILOT_LIMITATION,
  PILOT_TOPIC,
  PILOT_VERSES,
  claimsForQuestion,
  contentTokens,
  quotationParagraphs,
  sourcesForSupport,
  type PilotClaim,
} from '../src/shared/pilot.ts';

const intention: PilotClaim = {
  id: 'h4560',
  group: 'h4560',
  role: 'translation',
  label: 'Hadith · HadeethEnc 4560',
  text: 'Verily, the reward of deeds depends on the intentions, and each person will be rewarded according to what he intended.',
  attribution: 'HadeethEnc. 4560. Grade: Authentic',
  sourceUrl: 'https://hadeethenc.com/en/browse/hadith/4560',
};
const intentionArabic: PilotClaim = { ...intention, id: 'h4560-ar', role: 'original', text: 'إنما الأعمال بالنيات' };
const explanation: PilotClaim = { ...intention, id: 'h4560-ex', role: 'explanation', text: 'A source explanation of intention.' };
const habit: PilotClaim = {
  id: 'h5845',
  group: 'h5845',
  role: 'translation',
  label: 'Hadith · HadeethEnc 5845',
  text: 'The best deed in His sight is that which is done regularly.',
  attribution: 'HadeethEnc. 5845. Grade: Authentic hadith',
  sourceUrl: 'https://hadeethenc.com/en/browse/hadith/5845',
};

test('the pilot keeps verified passages and an honest limit', () => {
  assert.equal(PILOT_TOPIC, 'Intention, habit and everyday life.');
  assert.deepEqual(PILOT_HADEETH_IDS, ['4560', '5845']);
  assert.deepEqual(PILOT_VERSES, [{ surah: 98, ayah: 5 }]);
  assert.equal(contentTokens('explain this').length, 0);
  assert.deepEqual(contentTokens('What is the population of Tokyo?'), ['population', 'tokyo']);
  const current = claimsForQuestion('explain this', [intention, explanation], [habit]);
  assert.deepEqual(current?.map(claim => claim.id), ['h4560']);
  const aboutIntention = claimsForQuestion('What does this say about intentions?', [habit], [intention, explanation]);
  assert.deepEqual(aboutIntention?.map(claim => claim.id), ['h4560']);
  assert.equal(claimsForQuestion('What is the population of Tokyo?', [intention, habit], []), null);
  const quotes = quotationParagraphs(aboutIntention ?? []);
  assert.equal(quotes[0].role, 'quotation');
  assert.equal(quotes[0].text, intention.text);
  assert.deepEqual(quotes[0].citations, ['h4560']);
  const sources = sourcesForSupport(aboutIntention ?? [], [intention, intentionArabic, explanation, habit]);
  assert.deepEqual(sources.map(claim => claim.role), ['translation', 'original', 'explanation']);
  assert.match(PILOT_LIMITATION, /do not answer/);
});

test('resume keeps the paused position for the same clip', () => {
  assert.deepEqual(keepPlaybackPosition('', 'blob:episode', 0), { src: 'blob:episode', time: 0 });
  assert.deepEqual(keepPlaybackPosition('blob:episode', 'blob:episode', 3.5), { src: 'blob:episode', time: 3.5 });
  assert.deepEqual(keepPlaybackPosition('blob:episode', 'blob:next', 3.5), { src: 'blob:next', time: 0 });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { openedResearchDesk } from '../src/lib/route.ts';
import { researchDeskHref } from '../src/lib/researchDesk.ts';
import { composeFiqhQuestion, composeQuranQuestion, composeSeerahQuestion } from '../src/views/domainQuestion.ts';

test('research desks stay on their own page', () => {
  assert.deepEqual(openedResearchDesk('hadith', ['research']), { entry: 'hadith', desk: 'hadith' });
  assert.deepEqual(openedResearchDesk('quran', ['research']), { entry: 'quran', desk: 'quran' });
  assert.deepEqual(openedResearchDesk('hub', ['research']), { entry: 'knowledge', desk: 'knowledge' });
  assert.deepEqual(openedResearchDesk('books', ['research']), { entry: 'books', desk: 'books' });
  assert.deepEqual(openedResearchDesk('hub', ['fiqh']), { entry: 'knowledge', desk: 'fiqh' });
  assert.deepEqual(openedResearchDesk('hub', ['seerah']), { entry: 'knowledge', desk: 'seerah' });
  assert.equal(openedResearchDesk('hub', []), null);
});

test('fiqh and seerah keep the hub address after a job starts', () => {
  assert.equal(researchDeskHref('fiqh', 'knowledge', 'job-1', 'en', false, null, 'How is wudu performed?'), '#/hub/fiqh?job=job-1&lang=en&q=How+is+wudu+performed%3F');
  assert.equal(researchDeskHref('quran', 'quran', 'job-2', 'en', false, null, "Qur'an 2:255"), '#/quran/research?job=job-2&lang=en&q=Qur%27an+2%3A255');
});

test('domain questions do not copy hadith matn fields onto other desks', () => {
  assert.equal(composeQuranQuestion('2', '255', 'What does this passage say?'), "Qur'an 2:255. What does this passage say?");
  assert.equal(composeFiqhQuestion('wudu', '', 'How is it performed?'), 'wudu. How is it performed?');
  assert.equal(composeSeerahQuestion('Badr', '2 AH', 'When did it happen?'), 'Seerah. Badr. 2 AH. When did it happen?');
  assert.equal(composeQuranQuestion('2', '255', "Qur'an 2:255. What does this passage say?"), "Qur'an 2:255. What does this passage say?");
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { openedResearchDesk } from '../src/lib/route.ts';
import { researchDeskHref } from '../src/lib/researchDesk.ts';
import { PARALLEL_READER_INTAKE, parallelRequestForDesk } from '../src/server/research/agentConfig.ts';
import { readerQuestion } from '../src/views/domainQuestion.ts';

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

test('a desk submits the reader’s words without boxed fields', () => {
  const messy = 'what dose ayah 255 of baqara mean??';
  assert.equal(readerQuestion(`  ${messy}  `), messy);
  const quran = parallelRequestForDesk('quran', messy, 'en');
  assert.match(quran?.taskInput ?? '', /Question: what dose ayah 255 of baqara mean\?\?/);
  assert.equal(quran?.taskInput.includes(PARALLEL_READER_INTAKE), true);
  assert.equal(quran?.agents?.some(agent => agent.id === 'tafsir'), true);
  const fiqh = parallelRequestForDesk('fiqh', 'can i pray sitting if my knee hurts', 'en');
  assert.match(fiqh?.taskInput ?? '', /Question: can i pray sitting if my knee hurts/);
  assert.equal(parallelRequestForDesk('hadith', messy, 'en'), null);
  assert.match(parallelRequestForDesk('knowledge', messy, 'en')?.taskInput ?? '', /deduce the surah and ayah/);
});

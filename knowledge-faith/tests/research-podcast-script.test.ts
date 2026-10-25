import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCorpusCount } from '../src/shared/research/counts.ts';
import { questionsToResearch, separateQuestions } from '../src/shared/research/questions.ts';
import { roundtableFromResearch, scriptMayBeSpoken } from '../src/shared/research/roundtable.ts';

const warsAnswer = formatCorpusCount({
  english: ['war', 'wars', 'warfare'],
  arabic: ['حرب', 'يحاربون', 'حارب', 'قتال'],
  occurrences: [
    { surah: 2, ayah: 279, wording: 'war', script: 'english', text: 'a war from Allah' },
    { surah: 2, ayah: 279, wording: 'حرب', script: 'arabic', text: 'حرب' },
    { surah: 3, ayah: 121, wording: 'قتال', script: 'arabic', text: 'قتال' },
    { surah: 5, ayah: 64, wording: 'war', script: 'english', text: 'war' },
  ],
  campaigns: [
    { label: 'Badr', verses: [{ surah: 3, ayah: 123 }] },
    { label: 'Hunayn', verses: [{ surah: 9, ayah: 25 }] },
  ],
  unnamed: [
    { surah: 3, ayah: 121 },
    { surah: 33, ayah: 9 },
  ],
  unlisted: 0,
}).map(paragraph => paragraph.text).join('\n\n');

describe('question integrity', () => {
  it('splits two questions glued by a curly quote', () => {
    const parts = separateQuestions('how many wars mentions in quran“how many prophets in islam');
    assert.deepEqual(parts, ['how many wars mentions in quran?', 'how many prophets in islam?']);
  });

  it('keeps a loaded question out of the next submission', () => {
    const next = questionsToResearch(
      'how many wars mentions in quran“how many prophets in islam',
      'how many wars mentions in quran',
      false,
    );
    assert.deepEqual(next, ['how many prophets in islam?']);
  });

  it('researches both questions when the field was empty', () => {
    const next = questionsToResearch('how many wars mentions in quran?\nhow many prophets in islam?', null, false);
    assert.equal(next.length, 2);
    assert.match(next[0], /wars/);
    assert.match(next[1], /prophets/);
  });
});

describe('spoken research script', () => {
  it('does not read retrieval logs or a language code', () => {
    const script = roundtableFromResearch({
      question: 'how many wars mentions in quran?',
      language: 'en',
      status: 'done',
      answer: warsAnswer,
      agents: [
        { id: 'quran-text', team: 'quran', role: 'Qur’an text', status: 'ran', detail: 'Arabic was retrieved for Surah 4, ayah 163.' },
        { id: 'quran-evidence', team: 'quran', role: 'Evidence review', status: 'ran', detail: 'insufficient: The retrieved passages are about this subject.' },
      ],
      passages: [
        { locator: 'Surah 3, ayah 123', text: 'Allah helped you at Badr.', context: 'Historical event: Badr.', provider: 'QuranEnc' },
        { locator: 'Surah 2, ayah 279', text: 'a war from Allah', context: 'Word occurrence: English “war”.', provider: 'AlQuran' },
      ],
    });
    assert.ok(script);
    const spoken = script.lines.map(line => line.text).join(' ');
    assert.equal(script.question.includes('prophets'), false);
    assert.match(spoken, /word-occurrence count is 4/i);
    assert.match(spoken, /2 campaigns are named/i);
    assert.match(spoken, /Badr/);
    assert.match(spoken, /Hunayn/);
    assert.doesNotMatch(spoken, /Arabic was retrieved|Evidence review|insufficient:|The language is|the people at the table/i);
    assert.equal(script.lines.some(line => line.speaker === 'Qur’an text'), false);
    assert.ok(script.sources.some(source => source.includes('2:279')));
    assert.equal(scriptMayBeSpoken(script.lines, warsAnswer), true);
    assert.match(script.participants.map(person => person.role).join(' '), /generated/);
  });

  it('refuses a glued title and a failed job', () => {
    assert.equal(
      roundtableFromResearch({
        question: 'how many wars mentions in quran“how many prophets in islam',
        language: 'en',
        status: 'done',
        answer: warsAnswer,
        passages: [{ locator: 'Surah 2, ayah 279', text: 'war', provider: 'AlQuran' }],
      }),
      null,
    );
    assert.equal(
      roundtableFromResearch({
        question: 'how many prophets in islam?',
        language: 'en',
        status: 'error',
        answer: 'The research failed.',
        passages: [{ locator: 'Surah 4, ayah 163', text: 'Noah', provider: 'QuranEnc' }],
      }),
      null,
    );
  });

  it('does not invent a prophet total', () => {
    const answer = 'The retrieved passages do not state a total number. They name Noah, Abraham, Moses, Jesus, and the seal of the prophets.';
    const script = roundtableFromResearch({
      question: 'how many prophets in islam?',
      language: 'en',
      status: 'done',
      insufficientEvidence: true,
      answer,
      passages: [{ locator: 'Surah 4, ayah 163', text: 'We gave revelation to Noah, Abraham, and Jesus.', provider: 'QuranEnc' }],
    });
    assert.ok(script);
    assert.equal(script.question, 'how many prophets in islam?');
    const spoken = script.lines.map(line => line.text).join(' ');
    assert.match(spoken, /do not state a total|does not state a total|will not add one/i);
    assert.doesNotMatch(spoken, /124[,.]?000|\b25 prophets\b|twenty-five/i);
    assert.equal(script.question.includes('wars'), false);
  });
});

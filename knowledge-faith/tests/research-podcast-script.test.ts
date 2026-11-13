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
        { locator: 'Surah 3, ayah 123', text: 'Allah had helped you at Badr when you were weak; then fear Allah so that you may be grateful.', context: 'Historical event: Badr. Word occurrence: English “battle”.', provider: 'QuranEnc' },
        { locator: 'Surah 9, ayah 25', text: 'Allah has given you victory in many battlefields, and on the day of Hunayn[1] when you took pride in your great number, but they were of no use to you.', context: 'Historical event: Hunayn. This verse does not contain a counted wording.', provider: 'QuranEnc' },
        { locator: 'Surah 2, ayah 177', text: 'Righteousness is believing in Allah and being patient in poverty and hardship and during battle.', context: 'Word occurrence: English “battle”.', provider: 'AlQuran' },
        { locator: 'Surah 2, ayah 279', text: 'And if you do not, then be informed of a war from Allah and His Messenger.', context: 'Word occurrence: Arabic “حرب”; English “war”.', provider: 'AlQuran' },
      ],
    });
    assert.ok(script);
    const spoken = script.lines.map(line => line.text).join(' ');
    assert.equal(script.question.includes('prophets'), false);
    assert.match(spoken, /helped you at Badr when you were weak/i);
    assert.match(spoken, /Hunayn when you took pride/i);
    assert.doesNotMatch(spoken, /Hunayn1|\[1\]/);
    assert.match(spoken, /patient in poverty and hardship and during battle/i);
    assert.match(spoken, /wording count and the named campaigns are separate/i);
    assert.match(spoken, /do not give one/i);
    assert.doesNotMatch(spoken, /\b51\b|word-occurrence count is \d+|English wordings|Arabic wordings|war, wars, warfare/i);
    assert.doesNotMatch(spoken, /Arabic was retrieved|Evidence review|insufficient:|The language is|the people at the table/i);
    assert.equal(new Set(script.lines.map(line => line.speaker)).size, 3);
    assert.equal(script.lines.some(line => line.speaker !== 'Host (generated)' && line.text.includes('?')), true);
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
    assert.doesNotMatch(spoken, /these passages do not settle the question/i);
    assert.doesNotMatch(spoken, /124[,.]?000|\b25 prophets\b|twenty-five/i);
    assert.equal(script.question.includes('wars'), false);
  });

  it('speaks the commentary sentence and leaves the modern application open', () => {
    const script = roundtableFromResearch({
      question: 'What does Qur’an 24:4 mean, and how should that ruling be applied today?',
      language: 'en',
      status: 'done',
      answer: 'Retrieved: Surah 24, ayah 4. Sourced interpretation. Al-Mukhtasar 24:4 — the four-witness condition.',
      unresolved: ['Identifying a quotation does not answer the modern application. That part stays open.'],
      passages: [
        { locator: 'Surah 24, ayah 4', text: 'As for those who accuse chaste women but fail to produce four witnesses, flog them eighty lashes.', provider: 'QuranEnc' },
        { locator: 'Al-Mukhtasar 24:4', text: '4. Those who accuse chaste women of adultery and do not bring four witnesses are punished by the leaders.', provider: 'QuranEnc' },
      ],
    });
    assert.ok(script);
    const spoken = script.lines.map(line => line.text).join(' ');
    assert.match(spoken, /four witnesses/);
    assert.doesNotMatch(spoken, /further point: 4\./);
    assert.match(spoken, /stays open/);
    assert.doesNotMatch(spoken, /state a total/i);
  });
});

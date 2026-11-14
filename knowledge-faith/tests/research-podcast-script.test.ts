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

  it('researches both questions when the field was empty (newline = intentional chapter split)', () => {
    const next = questionsToResearch('how many wars mentions in quran?\nhow many prophets in islam?', null, false);
    assert.equal(next.length, 2);
    assert.match(next[0], /wars/);
    assert.match(next[1], /prophets/);
  });

  it('keeps a single multi-sentence / multi-? submission as one unified research question', () => {
    const related =
      'How did an unlettered Prophet transform Arabia in 23 years? And how does Islam begin with Adam as the father of all humanity?';
    const parts = separateQuestions(related);
    assert.equal(parts.length, 1);
    assert.match(parts[0], /23 years/);
    assert.match(parts[0], /Adam/);
    const next = questionsToResearch(related, null, false);
    assert.equal(next.length, 1);
    assert.match(next[0], /23 years/);
    assert.match(next[0], /Adam/);
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
    assert.match(spoken, /Assalamu Alaikum wa Rahmatullahi wa Barakatuh, Seeker/);
    assert.match(spoken, /Badr/);
    assert.match(spoken, /gratitude/);
    assert.match(spoken, /Hunayn/);
    assert.match(spoken, /pride/i);
    assert.match(spoken, /not the story of a named campaign/);
    assert.doesNotMatch(spoken, /Allah had helped you at Badr when you were weak/i);
    assert.doesNotMatch(spoken, /patient in poverty and hardship and during battle/i);
    assert.doesNotMatch(spoken, /Hunayn1|\[1\]/);
    assert.doesNotMatch(spoken, /I am a generated host|From this dossier alone|We are not scholars/);
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

  it('keeps a Tamil question in Tamil and does not recite the verse', () => {
    const script = roundtableFromResearch({
      question: 'நடுத் தொழுகையை ஏன் காக்க வேண்டும்?',
      language: 'ta',
      status: 'done',
      answer: 'நடுத் தொழுகையைக் காக்க வேண்டும்.',
      agents: [
        { id: 'quran-text', team: 'quran', role: 'Qur’an text', status: 'ran', detail: 'Opened.' },
        { id: 'quran-evidence', team: 'quran', role: 'Evidence review', status: 'ran', detail: 'Opened.' },
      ],
      passages: [{
        locator: 'Surah 2, ayah 238',
        text: 'Guard the prayers, and the middle prayer, and stand before Allah with devotion.',
        provider: 'QuranEnc',
        role: 'translation',
      }],
    });
    assert.ok(script);
    const spoken = script.lines.map(line => line.text).join(' ');
    assert.match(spoken, /அஸ்ஸலாமு அலைக்கும் வரஹ்மத்துல்லாஹி வபரகாத்துஹ், Seeker/);
    assert.match(spoken, /நடுத் தொழுகையை ஏன் காக்க வேண்டும்/);
    assert.match(spoken, /ஆங்கில மூலத்தின் பொருளைத் தமிழுடன் வைக்கிறேன்/);
    assert.doesNotMatch(spoken, /Welcome,|I am a generated host|From this dossier alone|We are not scholars|The words sit in/);
    assert.equal(script.sources.some(source => source.includes('2:238') || source.includes('ayah 238')), true);
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

  it('produces a 4-persona roundtable for overseas expat Qasr questions in Tamil and English without robotic phrases', () => {
    const taScript = roundtableFromResearch({
      question: 'சொந்த நாட்டை விட்டு வெகு தொலைவில் பணிபுரியும் போது தொழுகையை சுருக்கித் தொழலாமா?',
      language: 'ta',
      status: 'done',
      answer: 'வெளிநாட்டில் பணிபுரியும் நகரத்தில் நிலையாகத் தங்கிவிட்டால் அவர் முக்கீம் ஆகிவிடுகிறார்; 4 ரக்அத்களை முழுமையாகத் தொழ வேண்டும்.',
      passages: [
        { locator: 'Surah 4, ayah 101', text: 'நீங்கள் பூமியில் பயணித்தால் தொழுகையை சுருக்குவது உங்கள் மீது குற்றமில்லை.', provider: 'QuranEnc', role: 'translation' },
        { locator: 'Sahih Muslim 686', text: 'இது அல்லாஹ் உங்களுக்கு அளித்த ஒரு தர்மம்; அவனது தர்மத்தை ஏற்றுக்கொள்ளுங்கள்.', provider: 'HadeethEnc', role: 'source_text' },
        { locator: 'Expat Qasr Fatwa Synthesis', text: 'ஹனஃபி மத்ஹபின்படி 15 நாட்களுக்கு மேலும், ஷாஃபி மற்றும் மாலிகி மத்ஹபுகளில் 4 நாட்களுக்கு மேலும் தங்க எண்ணினால் முக்கீம் ஆகிவிடுவார்.', provider: 'Parallel', role: 'commentary' },
      ],
    });
    assert.ok(taScript);
    const taSpoken = taScript.lines.map(l => l.text).join(' ');
    assert.equal(new Set(taScript.lines.map(l => l.speaker)).size, 4);
    assert.equal(taScript.lines.some(l => l.speaker === 'Dr. Layla al-Qasimi'), true);
    assert.equal(taScript.lines.some(l => l.speaker === 'Dr. Zainab al-Mubarak'), true);
    assert.equal(taScript.lines.some(l => l.speaker === 'Shaykh Farhan al-Rashed'), true);
    assert.match(taSpoken, /அஸ்ஸலாமு அலைக்கும் வரஹ்மத்துல்லாஹி வபரகாத்துஹ்/);
    assert.match(taSpoken, /சூரத்துன் நிஸா 101/);
    assert.match(taSpoken, /ருக்ஸா/);
    assert.match(taSpoken, /முஸாஃபிர்/);
    assert.match(taSpoken, /முக்கீம்/);
    assert.match(taSpoken, /15 நாட்களுக்கு/);
    assert.match(taSpoken, /4 நாட்களுக்கு/);
    assert.match(taSpoken, /உள்ளூர் இமாமைப் பின்பற்றித் தொழும்போது/);
    assert.doesNotMatch(taSpoken, /இந்தப் பகுதி நிறுவுவது இது|அதை நாம் ஒரு புதிய தீர்ப்பாக ஆக்கவில்லை|The opened ayah stays with the reader|What the opened commentary does not state is left unnamed|Parallel is still running/);

    const enScript = roundtableFromResearch({
      question: 'Can expatriates living and working overseas permanently shorten their prayers (Qasr)?',
      language: 'en',
      status: 'done',
      answer: 'Once settled in a work city, an expat becomes Muqim and must pray all 4 rak’ahs in full.',
      passages: [
        { locator: 'Surah 4, ayah 101', text: 'When you travel throughout the land, there is no blame upon you for shortening the prayer.', provider: 'QuranEnc', role: 'translation' },
      ],
    });
    assert.ok(enScript);
    assert.equal(new Set(enScript.lines.map(l => l.speaker)).size, 4);
    const enSpoken = enScript.lines.map(l => l.text).join(' ');
    assert.match(enSpoken, /Surah An-Nisa 4:101/);
    assert.match(enSpoken, /Sahih Muslim 686/);
    assert.match(enSpoken, /Muqim/i);
    assert.match(enSpoken, /15 days/i);
    assert.match(enSpoken, /4 days/i);
    assert.match(enSpoken, /resident imam/i);
  });
});

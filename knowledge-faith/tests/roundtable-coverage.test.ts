import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AgentContribution } from '../src/shared/contracts/v1.ts';
import { buildReportModel, contentSegments, renderReportHtml, type ReportModel } from '../src/shared/research/report.ts';
import { DEFAULT_HOST_NAME, roundtableFromResearch } from '../src/shared/research/roundtable.ts';
import { executeResearch, type ResearchPorts } from '../src/server/research/engine.ts';

function ports(over: Partial<ResearchPorts> = {}): ResearchPorts {
  return {
    searchHadeeth: async () => [],
    loadHadeeth: async () => {
      throw new Error('not opened');
    },
    getVerses: async () => [],
    searchScience: async () => 'not_configured',
    ...over,
  };
}

function hadith(id: string, text: string) {
  return {
    id,
    title: id,
    text,
    arabic: 'الأصل',
    grade: 'Authentic',
    attribution: 'Test collection',
    explanation: null,
    url: `https://hadeethenc.com/en/browse/hadith/${id}`,
  };
}

function ran(id: string, role: string, status: AgentContribution['status'] = 'ran'): AgentContribution {
  return { id, team: 'hadith', role, status, detail: 'Search returned no records for a phrase that must stay in the report.' };
}

function spokenOf(input: Parameters<typeof roundtableFromResearch>[0]) {
  const script = roundtableFromResearch({ status: 'done', investigation: 'partial', ...input });
  assert.ok(script, input.question);
  const spoken = script.lines.map(line => line.text).join(' ');
  const specialists = script.lines.filter(line => line.speaker !== DEFAULT_HOST_NAME);
  assert.equal(specialists.some(line => line.text.includes('?')), true);
  assert.match(spoken, /Assalamu Alaikum|அஸ்ஸலாமு அலைக்கும்|අස්සලාමු අලයිකුම්/);
  assert.doesNotMatch(spoken, /I am a generated host|generated contributor|We are not scholars|From this dossier alone|did not speak these words|These citations are not read aloud|not read aloud|பேசவில்லை|කථා කළේ නැත|உருவாக்கப்பட்ட|නිර්මාණය කළ/i);
  assert.doesNotMatch(spoken, /Retrieved:|Parallel findings:|locate:|Search returned|adapter|Evidence review/i);
  assert.equal(script.participants.every(person => /generated/i.test(person.role)), true);
  assert.equal(script.participants.some(person => person.role === 'Isnad'), false);
  return { script, spoken };
}

describe('roundtable coverage', () => {
  it('keeps the studio voices and speaks only agents that ran', () => {
    const quran = spokenOf({
      question: 'What does the verse say about standing in prayer?',
      language: 'en',
      answer: 'Surah 2, ayah 238 says: “Guard the prayers, and the middle prayer.” Identifying a quotation does not answer the modern application. That part stays open.',
      unresolved: ['Identifying a quotation does not answer the modern application. That part stays open.'],
      agents: [
        ran('quran-text', 'Qur’an text'),
        ran('quran-translation', 'Translation'),
        ran('quran-tafsir', 'Tafsir', 'not_run'),
        ran('quran-evidence', 'Evidence review'),
        ran('deep-research', 'Deep Research & Source Verification (Agent 7)', 'not_run'),
      ],
      passages: [{ locator: 'Surah 2, ayah 238', text: 'Guard the prayers, and the middle prayer, and stand before Allah with devotion.', provider: 'QuranEnc', role: 'translation' }],
    });
    assert.equal(quran.script.lines.some(line => line.speaker === 'Dr. Layla al-Qasimi'), true);
    assert.equal(quran.script.lines.some(line => line.speaker === 'Dr. Zainab al-Mubarak'), true);
    assert.equal(quran.script.lines.some(line => line.speaker === 'Sheikh Yusuf al-Azhari'), false);
    assert.equal(quran.script.lines.some(line => line.speaker === 'Dr. Amina al-Kindi'), false);
    assert.match(quran.spoken, /Guard the prayers/);
    assert.match(quran.spoken, /stays open/);
    assert.equal(quran.script.lines.filter(line => line.speaker !== DEFAULT_HOST_NAME).some(line => /Surah \d+, ayah/.test(line.text)), false);

    const belief = spokenOf({
      question: 'What is Tawhid?',
      language: 'en',
      answer: 'The passage says: “Tawhid is to single out Allah alone.” The source prints this grade: Authentic.',
      agents: [ran('hadith-takhrij', 'Takhrij'), ran('hadith-isnad', 'Isnad', 'not_run'), ran('hadith-hadeethenc', 'HadeethEnc Source Research')],
      passages: [{ locator: 'HadeethEnc 1', text: 'Tawhid is to single out Allah alone.', provider: 'HadeethEnc', role: 'source_text' }],
    });
    assert.match(belief.spoken, /single out Allah alone/);
    assert.match(belief.spoken, /Authentic/);
    assert.equal(belief.script.lines.some(line => line.speaker === 'Dr. Tariq al-Mansoor'), true);
    assert.equal(belief.script.lines.some(line => line.speaker === 'Dr. Amina al-Kindi'), true);
    assert.equal(belief.script.participants.some(person => person.role === 'Isnad'), false);
    assert.doesNotMatch(belief.spoken, /disagreement/i);

    const worship = spokenOf({
      question: 'How should wudu be performed?',
      language: 'en',
      answer: 'Wudu begins with washing the hands before prayer.',
      agents: [ran('hadith-takhrij', 'Takhrij'), ran('hadith-hadeethenc', 'HadeethEnc Source Research')],
      passages: [{ locator: 'HadeethEnc 2', text: 'Wudu begins with washing the hands before prayer.', provider: 'HadeethEnc', role: 'source_text' }],
    });
    assert.match(worship.spoken, /washing the hands/);
    assert.match(worship.spoken, /practice the source records|not a new ruling/i);

    const history = spokenOf({
      question: 'What does the library say about the history of the Battle of Badr?',
      language: 'en',
      answer: 'The Battle of Badr is a named campaign in the second year after the Hijrah.',
      agents: [ran('books-discovery', 'Discovery'), ran('books-passage', 'Passage analysis'), ran('books-comparison', 'Comparison', 'not_run')],
      passages: [{ locator: 'The Battle of Badr', text: 'The Battle of Badr is a named campaign in the second year after the Hijrah.', provider: 'IslamHouse', role: 'source_text' }],
    });
    assert.match(history.spoken, /named campaign/);
    assert.equal(history.script.lines.some(line => line.speaker === 'Dr. Layla al-Qasimi'), true);
    assert.equal(history.script.lines.some(line => line.speaker === 'Dr. Tariq al-Mansoor'), true);
    assert.doesNotMatch(history.spoken, /disagreement/i);

    const compared = spokenOf({
      question: 'What is the difference between zakat and sadaqah?',
      language: 'en',
      answer: 'Zakat is a due on wealth.',
      disagreements: ['The opened records print different grades: Authentic, Weak. No grade was chosen from that difference.'],
      agents: [ran('hadith-takhrij', 'Takhrij'), ran('hadith-scholars', 'Scholars’ discussion'), ran('hadith-hadeethenc', 'HadeethEnc Source Research')],
      passages: [{ locator: 'HadeethEnc 3', text: 'Zakat is a due on wealth, and it is not the same wording as voluntary charity.', provider: 'HadeethEnc' }],
    });
    assert.match(compared.spoken, /disagreement/i);
    assert.match(compared.spoken, /did not choose a side|will not invent a side/i);
    assert.equal(compared.script.lines.some(line => line.speaker === 'Sheikh Yusuf al-Azhari'), true);

    const counted = spokenOf({
      question: 'What is the difference between zakat and sadaqah?',
      language: 'en',
      answer: 'Zakat is a due on wealth.',
      disagreements: ['HadeethEnc 3 is cited 2 times. That is one source, not independent corroboration.'],
      agents: [ran('hadith-takhrij', 'Takhrij'), ran('hadith-hadeethenc', 'HadeethEnc Source Research')],
      passages: [{ locator: 'HadeethEnc 3', text: 'Zakat is a due on wealth.', provider: 'HadeethEnc' }],
    });
    assert.doesNotMatch(counted.spoken, /disagreement|independent corroboration|cited 2 times/i);

    const science = spokenOf({
      question: 'What does the science literature say about fasting and metabolism?',
      language: 'en',
      answer: 'A recorded trial measured fasting and a change in metabolism.',
      unresolved: ['No empirical record in the selected language addresses this part. Scripture is not scientific evidence.'],
      agents: [ran('hadith-takhrij', 'Takhrij'), ran('quran-evidence', 'Evidence review')],
      passages: [
        { locator: 'OpenAlex 9', text: 'A recorded trial measured fasting and a change in metabolism over several weeks.', provider: 'OpenAlex', role: 'empirical' },
        { locator: 'Surah 2, ayah 183', text: 'Fasting is prescribed for you.', provider: 'QuranEnc', role: 'translation' },
      ],
    });
    assert.match(science.spoken, /empirical finding/);
    assert.match(science.spoken, /not scripture/i);
    assert.match(science.spoken, /Scripture is not scientific evidence/);
  });

  it('marks Tamil and Arabic inside an English report and draws a chain only when one was retrieved', () => {
    const base: ReportModel = {
      question: 'தொழுகை என்றால் என்ன?',
      language: 'ta',
      scope: 'knowledge',
      teams: ['hadith'],
      answer: 'தொழுகை என்பது அல்லாஹ்வுக்கான வழிபாடு.',
      answerArabic: 'الصلاة عبادة',
      citationIds: [],
      agentsRan: [],
      agentsIdle: [],
      passages: [],
      claims: [],
      disagreements: [],
      unresolved: ['Identifying a quotation does not answer the modern application. That part stays open.'],
      unavailable: [],
      incomplete: [],
      insufficient: [],
      otherNotes: [],
      chain: null,
      chart: [],
      verificationNote: '',
      investigation: 'partial',
    };
    const html = renderReportHtml(base);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /lang="ta"/);
    assert.match(html, /dir="rtl"/);
    assert.match(html, /lang="ar"/);
    assert.equal(html.includes('Transmission map'), false);
    assert.match(html, /<h2>Answer<\/h2>/);
    assert.match(html, /<h2>Limitations<\/h2>/);
    assert.ok(html.indexOf('<h2>Answer</h2>') < html.indexOf('<h2>Disagreements</h2>'));
    assert.ok(html.indexOf('<h2>Disagreements</h2>') < html.indexOf('<h2>Limitations</h2>'));
    assert.ok(html.indexOf('<h2>Limitations</h2>') < html.indexOf('Agents who contributed'));
    const withChain = renderReportHtml({ ...base, chain: ['عمر', 'علقمة'] });
    assert.match(withChain, /Transmission map/);
    assert.match(withChain, /lang="ar" dir="rtl"/);
    assert.equal(contentSegments('Guard الصلاة and தொழுகை').map(segment => segment.lang).join(','), 'en,ar,en,ta');
  });

  it('produces a spoken episode from the shared engine for belief, worship, history, and an unresolved science question', async () => {
    const belief = await executeResearch({
      question: 'What is Tawhid?',
      language: 'en',
      assignment: { scope: 'knowledge', teams: ['quran', 'hadith'], bookId: null, noticeId: null, forwardedFrom: null },
      ports: ports({
        searchHadeeth: async () => [{ id: 't', title: 'Tawhid' }],
        loadHadeeth: async () => hadith('t', 'Tawhid is to single out Allah alone.'),
      }),
    });
    const beliefScript = roundtableFromResearch({
      question: belief.job.question,
      language: 'en',
      answer: belief.dossier.answer?.paragraphs.map(item => item.text).join(' ') ?? '',
      passages: belief.dossier.passages.map(item => ({ locator: item.locator, text: item.text, context: item.context, provider: item.source.provider, role: item.role })),
      agents: belief.job.agents,
      disagreements: belief.dossier.disagreements,
      unresolved: belief.job.materialParts?.filter(part => part.status === 'unresolved').map(part => part.note),
      status: 'done',
      investigation: belief.job.investigation,
    });
    assert.ok(beliefScript);
    assert.match(beliefScript.lines.map(line => line.text).join(' '), /single out Allah alone/);
    assert.equal(beliefScript.participants.some(person => person.role === 'Isnad'), false);

    const history = await executeResearch({
      question: 'What does the library say about the history of the Battle of Badr?',
      language: 'en',
      assignment: { scope: 'books', teams: ['books'], bookId: 9, noticeId: null, forwardedFrom: null },
      ports: ports({
        readBook: async () => ({
          id: 9,
          title: 'The Battle of Badr',
          availability: 'readable',
          limitation: null,
          url: 'https://islamhouse.com/en/books/9/',
          language: 'en',
          blocks: [{ id: 'b1', text: 'The Battle of Badr is a named campaign in the second year after the Hijrah.' }],
        }),
      }),
    });
    const historyScript = roundtableFromResearch({
      question: history.job.question,
      language: 'en',
      answer: history.dossier.answer?.paragraphs.map(item => item.text).join(' ') ?? '',
      passages: history.dossier.passages.map(item => ({ locator: item.locator, text: item.text, context: item.context, provider: item.source.provider, role: item.role })),
      agents: history.job.agents,
      disagreements: history.dossier.disagreements,
      status: 'done',
      investigation: history.job.investigation,
    });
    assert.ok(historyScript);
    assert.match(historyScript.lines.map(line => line.text).join(' '), /named campaign/);
    assert.equal(buildReportModel(history.job, history.dossier).chain, null);

    const science = await executeResearch({
      question: 'What does the science literature say about fasting and metabolism?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => [{ id: 'w', title: 'Wudu' }],
        loadHadeeth: async () => hadith('w', 'Wudu begins with washing the hands before prayer.'),
      }),
    });
    assert.equal(science.dossier.passages.length, 0);
    assert.equal(roundtableFromResearch({
      question: science.job.question,
      language: 'en',
      answer: science.dossier.answer?.paragraphs.map(item => item.text).join(' ') ?? '',
      passages: science.dossier.passages,
      agents: science.job.agents,
      status: 'done',
      investigation: science.job.investigation,
    }), null);
  });

  it('quotes the sentence that times the subject, leaves a method open, and searches a science field', async () => {
    const dated = await executeResearch({
      question: 'When did the Battle of Badr take place?',
      language: 'en',
      assignment: { scope: 'knowledge', teams: ['hadith'], bookId: null, noticeId: null, forwardedFrom: null },
      ports: ports({
        searchHadeeth: async () => [{ id: 'tabuk', title: 'Tabuk' }, { id: 'badr', title: 'Badr' }],
        loadHadeeth: async (_lang, id) => id === 'badr'
          ? { ...hadith('badr', 'Anas did not take part in the battle of Badr.'), explanation: 'The battle of Tabuk was in 9 AH. The battle of Uhud took place one year and one month after the battle of Badr.' }
          : hadith('tabuk', 'Ka‘b remained behind from the battle of Tabuk.'),
      }),
    });
    const answer = dated.dossier.answer?.paragraphs.map(item => item.text).join(' ') ?? '';
    assert.match(answer, /one year and one month after the battle of Badr/);
    assert.equal(dated.dossier.passages.some(passage => passage.source.id === 'tabuk'), false);
    assert.equal(dated.job.materialParts?.find(part => part.kind === 'history')?.status, 'answered');

    const method = await executeResearch({
      question: 'How should wudu be performed?',
      language: 'en',
      assignment: { scope: 'knowledge', teams: ['hadith'], bookId: null, noticeId: null, forwardedFrom: null },
      ports: ports({
        searchHadeeth: async () => [{ id: 'spot', title: 'Spot' }],
        loadHadeeth: async () => hadith('spot', 'A man performed ablution and left a small part unwashed. The Prophet said: Go back and perform your ablution properly. He then prayed.'),
      }),
    });
    assert.equal(method.job.materialParts?.find(part => part.kind === 'practice')?.status, 'unresolved');

    let scienceQuery = '';
    const embryo = await executeResearch({
      question: 'What does embryology say about the stages of human development described in the Qur’an?',
      language: 'en',
      assignment: { scope: 'knowledge', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
      ports: ports({
        searchScience: async query => {
          scienceQuery = query;
          return [{
            id: 'W1',
            title: 'Embryonic stages',
            year: 2020,
            doi: null,
            url: 'https://openalex.org/W1',
            studyType: null,
            authors: ['A'],
            abstract: 'Embryology describes stages of human development.',
          }];
        },
      }),
    });
    assert.match(scienceQuery, /embryolog/i);
    assert.equal(embryo.dossier.passages.some(passage => passage.source.provider === 'OpenAlex'), true);
    assert.equal(embryo.job.materialParts?.some(part => part.kind === 'science'), true);

    const weakened = spokenOf({
      question: 'When did the Battle of Badr take place?',
      language: 'en',
      answer: 'The battle of Uhud took place one year and one month after the battle of Badr.',
      agents: [ran('hadith-takhrij', 'Takhrij'), ran('hadith-rijal', 'Rijal'), ran('hadith-shawahid', 'Shawahid and matn')],
      passages: [{
        locator: 'HadeethEnc 9',
        text: 'Their resolve was not weakened. The battle of Uhud took place one year and one month after the battle of Badr.',
        provider: 'HadeethEnc',
        role: 'source_text',
      }],
    });
    assert.equal(weakened.script.lines.some(line => line.speaker === 'Sheikh Imran al-Hasani'), false);
    assert.match(weakened.spoken, /one year and one month/);
  });
});

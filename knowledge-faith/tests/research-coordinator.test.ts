import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvidencePassage, ResearchDossierView, ResearchJobView } from '../src/shared/contracts/v1.ts';
import { coordinateQuestion, researchFingerprint } from '../src/shared/research/coordinator.ts';
import { rankEditionHadiths } from '../src/server/hadith.ts';
import { buildReportModel, renderReportHtml, transmissionNames } from '../src/shared/research/report.ts';
import { roundtableFromResearch } from '../src/shared/research/roundtable.ts';
import { buildAgentContributions } from '../src/server/research/contributions.ts';
import { acceptedCampaign, wordingInText } from '../src/shared/research/counts.ts';
import { executeResearch, type ResearchPorts } from '../src/server/research/engine.ts';
import { clearSharedResearchJobs, startSharedResearchJob } from '../src/server/research/jobs.ts';

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

describe('coordinating agent', () => {
  it('keeps a general question in Knowledge and assigns Qur’an and Hadith', () => {
    const decision = coordinateQuestion({ question: 'Why do Muslims fast?', entry: 'knowledge', language: 'en' });
    assert.equal(decision.action, 'research');
    assert.equal(decision.assignment.scope, 'knowledge');
    assert.deepEqual(decision.assignment.teams, ['quran', 'hadith']);
    assert.equal(decision.assignment.noticeId, null);
  });

  it('forwards a Hadith question asked on the Qur’an page once', () => {
    const decision = coordinateQuestion({
      question: 'What is the isnad of the narration in Sahih Bukhari about intentions?',
      entry: 'quran',
      language: 'en',
    });
    assert.equal(decision.action, 'forward');
    assert.equal(decision.assignment.scope, 'hadith');
    assert.equal(decision.assignment.noticeId, 'forward-hadith');
    assert.deepEqual(decision.assignment.teams, ['hadith']);

    const again = coordinateQuestion({
      question: 'What is the isnad of the narration in Sahih Bukhari about intentions?',
      entry: 'hadith',
      language: 'en',
      forwarded: true,
    });
    assert.equal(again.action, 'research');
    assert.equal(again.assignment.scope, 'hadith');
  });

  it('does not bounce a forwarded question back to the page that sent it', () => {
    const stayed = coordinateQuestion({
      question: 'What is the isnad of the narration in Sahih Bukhari about intentions?',
      entry: 'quran',
      language: 'en',
      forwarded: true,
    });
    assert.equal(stayed.action, 'research');
    assert.equal(stayed.assignment.scope, 'quran');
    assert.equal(stayed.assignment.noticeId, null);
  });

  it('sends a question that names Qur’an, Hadith, and books to Knowledge', () => {
    const decision = coordinateQuestion({
      question: 'What do the Qur’an, the hadith, and the books say about fasting?',
      entry: 'quran',
      language: 'ta',
    });
    assert.equal(decision.action, 'forward');
    assert.equal(decision.assignment.scope, 'knowledge');
    assert.deepEqual(decision.assignment.teams, ['quran', 'hadith', 'books']);
    assert.equal(decision.assignment.noticeId, 'forward-knowledge');
  });

  it('keeps a selected book on the Books team', () => {
    const decision = coordinateQuestion({
      question: 'What does this book say about sincerity?',
      entry: 'books',
      language: 'si',
      bookId: 735805,
    });
    assert.equal(decision.action, 'research');
    assert.equal(decision.assignment.scope, 'books');
    assert.deepEqual(decision.assignment.teams, ['books']);
    assert.equal(decision.assignment.bookId, 735805);
  });

  it('asks once when the meaning cannot be determined', () => {
    const first = coordinateQuestion({ question: 'why?', entry: 'knowledge', language: 'en' });
    assert.equal(first.action, 'clarify');
    assert.equal(first.clarificationId, 'meaning');
    const second = coordinateQuestion({ question: 'why?', entry: 'knowledge', language: 'en', clarified: true });
    assert.equal(second.action, 'research');
  });

  it('understands Tamil and Sinhala domain words', () => {
    const tamil = coordinateQuestion({ question: 'இந்த ஹதீஸ் பற்றி சொல்லுங்கள்', entry: 'quran', language: 'ta' });
    assert.equal(tamil.assignment.scope, 'hadith');
    const sinhala = coordinateQuestion({ question: 'කුර්ආනයේ මෙම වැකිය කියන්නේ කුමක්ද?', entry: 'hadith', language: 'si' });
    assert.equal(sinhala.assignment.scope, 'quran');
  });

  it('reuses one fingerprint for the same question, language, and team', () => {
    const a = coordinateQuestion({ question: 'Why do Muslims fast?', entry: 'knowledge', language: 'en' });
    const b = coordinateQuestion({ question: '  Why   do Muslims fast? ', entry: 'knowledge', language: 'en' });
    assert.equal(a.fingerprint, b.fingerprint);
    assert.notEqual(a.fingerprint, researchFingerprint('Why do Muslims fast?', 'ta', a.assignment));
  });
});

describe('specialist contributions', () => {
  it('does not treat a role that did not run as a completed finding', () => {
    const agents = buildAgentContributions({
      teams: ['hadith'],
      question: 'intentions',
      passages: [],
      coverage: [{ kind: 'no_relevant_evidence', provider: 'HadeethEnc', detail: 'Search returned no records for “intentions”. Other searches still run.' }],
      claims: [],
      queries: ['intentions'],
      books: [],
      tafsir: [],
      contextCount: 0,
    });
    const isnad = agents.find(agent => agent.id === 'hadith-isnad');
    assert.equal(isnad?.status, 'not_run');
    const source = agents.find(agent => agent.role === 'HadeethEnc Source Research');
    assert.equal(source?.status, 'ran');
    const script = roundtableFromResearch({ question: 'intentions', language: 'en', agents });
    assert.equal(script?.participants.some(agent => agent.role === 'Isnad'), false);
    assert.equal(script?.participants.some(agent => agent.role === 'HadeethEnc Source Research'), true);
  });
});

describe('scoped research', () => {
  it('does not search Hadith when only the Qur’an team is assigned', async () => {
    let hadithCalls = 0;
    let verseCalls = 0;
    const result = await executeResearch({
      question: 'Why do Muslims fast?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => {
          hadithCalls += 1;
          return [];
        },
        getVerses: async refs => {
          verseCalls += 1;
          return refs.map(ref => ({
            surah: ref.surah,
            ayah: ref.ayah,
            arabic: 'صيام',
            translation: 'Fasting is prescribed for you.',
            translator: 'Test',
            version: '1',
            edition: 'en',
            url: 'https://quranenc.com/example',
          }));
        },
      }),
      assignment: { scope: 'quran', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(hadithCalls, 0);
    assert.ok(verseCalls > 0);
    assert.ok(result.dossier.passages.some(passage => passage.source.provider === 'QuranEnc'));
    assert.equal(result.job.agents?.some(agent => agent.team === 'hadith' && agent.status === 'ran'), false);
    assert.equal(result.job.agents?.some(agent => agent.role === 'Qur’an text' && agent.status === 'ran'), true);
  });

  it('returns the same job id for a repeated question', () => {
    clearSharedResearchJobs();
    const first = startSharedResearchJob('Why do Muslims fast?', 'en', ports(), {
      assignment: { scope: 'knowledge', teams: ['quran', 'hadith'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    const second = startSharedResearchJob('Why do Muslims fast?', 'en', ports(), {
      assignment: { scope: 'knowledge', teams: ['quran', 'hadith'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(first, second);
    clearSharedResearchJobs();
  });

  it('still opens a selected book when planning takes longer than the source budget', async () => {
    let clock = Date.parse('2026-10-23T00:00:00.000Z');
    let opened = 0;
    const result = await executeResearch({
      question: 'What does this book say about worship of the Lord of the worlds?',
      language: 'en',
      now: () => new Date(clock),
      ports: ports({
        suggestSearch: async () => {
          clock += 30_000;
          return { available: true, failed: false, phrases: ['worship of the Lord'], ayahs: [] };
        },
        readBook: async () => {
          opened += 1;
          return {
            id: 2838792,
            title: 'Islam The Religion of the Lord of the Worlds',
            availability: 'readable',
            limitation: null,
            url: 'https://islamhouse.com/en/books/2838792/',
            language: 'en',
            blocks: [{ id: 'b8', text: 'And everything that is worshiped besides Him possesses neither benefit nor harm. Worship of the Lord of the worlds is due to Allah alone.' }],
          };
        },
      }),
      assignment: { scope: 'books', teams: ['books'], bookId: 2838792, noticeId: null, forwardedFrom: null },
    });
    assert.equal(opened, 1);
    assert.ok(result.dossier.passages.some(passage => passage.text.includes('Worship of the Lord of the worlds')));
    assert.equal(result.job.agents?.some(agent => agent.role === 'Full-text retrieval' && agent.status === 'ran'), true);
    assert.equal(result.job.coverage.some(note => note.detail.includes('incomplete research') && note.provider === 'dossier'), false);
  });
});

describe('full report', () => {
  it('downloads every kept passage and leaves out roles that did not run from the contributed section', () => {
    const passage: EvidencePassage = {
      contractVersion: '1.0.0',
      id: 'Q2-183',
      source: {
        contractVersion: '1.0.0',
        id: '2:183',
        provider: 'QuranEnc',
        language: 'en',
        edition: 'en',
        version: '1',
        title: "Qur'an 2:183",
        credits: [{ role: 'translator', name: 'Test' }],
        canonicalUrl: 'https://quranenc.com/example',
        contentType: 'quran',
        rights: { source: 'QuranEnc.com', conditions: 'test', generatedWork: false, checkedOn: '2026-10-23' },
        retrievedAt: '2026-10-23T00:00:00.000Z',
        contentHash: 'abc',
      },
      text: 'Fasting is prescribed so that you may become righteous.',
      originalLanguage: 'en',
      arabic: 'يا أيها الذين آمنوا',
      locator: 'Surah 2, ayah 183',
      context: null,
      readerRoute: '#/quran/2',
      role: 'translation',
      publishedGrade: null,
    };
    const job: ResearchJobView = {
      contractVersion: '1.0.0',
      id: 'job-1',
      question: 'Why do Muslims fast?',
      language: 'en',
      subquestions: [],
      status: 'done',
      progress: { step: 'verify', completed: 4, total: 4 },
      coverage: [{ kind: 'source_unavailable', provider: 'HadeethEnc', detail: 'HadeethEnc could not be reached. This is not a finding that fasting is absent.' }],
      errors: [],
      startedAt: '2026-10-23T00:00:00.000Z',
      finishedAt: '2026-10-23T00:00:01.000Z',
      timingsMs: { totalMs: 1, sources: {} },
      agents: [
        { id: 'quran-text', team: 'quran', role: 'Qur’an text', status: 'ran', detail: 'Arabic was retrieved for Surah 2, ayah 183.' },
        { id: 'hadith-isnad', team: 'hadith', role: 'Isnad', status: 'not_run', detail: 'Invented sahih chain that never ran.' },
      ],
    };
    const dossier: ResearchDossierView = {
      contractVersion: '1.0.0',
      jobId: 'job-1',
      passages: [passage],
      claims: [],
      unresolved: ['The chain was not in the source.'],
      disagreements: [],
      verificationNote: 'A citation is not support by itself.',
    };
    const model = buildReportModel(job, dossier);
    const html = renderReportHtml(model);
    assert.match(html, /Fasting is prescribed so that you may become righteous/);
    assert.match(html, /Arabic was retrieved for Surah 2, ayah 183/);
    assert.match(html, /HadeethEnc could not be reached/);
    assert.match(html, /The chain was not in the source/);
    assert.equal(html.includes('Incomplete research'), false);
    assert.equal(model.agentsRan.some(agent => agent.detail.includes('Invented sahih')), false);
    const contributed = html.split('Agents who did not produce a finding')[0];
    assert.equal(contributed.includes('Invented sahih chain'), false);
  });

  it('labels a failed retrieval Incomplete research without a None line', () => {
    const job: ResearchJobView = {
      contractVersion: '1.0.0',
      id: 'job-empty',
      question: 'The People of the Book used to read the Torah in Hebrew and expound on it in Arabic to the Muslims, is this true Hades ?',
      language: 'en',
      subquestions: [],
      status: 'done',
      progress: { step: 'verify', completed: 4, total: 4 },
      coverage: [{ kind: 'no_relevant_evidence', provider: 'hadith-api', detail: 'HadeethEnc did not return this narration. The study collections were searched next and no numbered record was kept.' }],
      errors: [],
      startedAt: '2026-10-24T00:00:00.000Z',
      finishedAt: '2026-10-24T00:00:01.000Z',
      timingsMs: { totalMs: 1, sources: {} },
      agents: [],
    };
    const html = renderReportHtml(buildReportModel(job, null));
    assert.match(html, /Incomplete research/);
    assert.equal(/Incomplete research:\s*None/i.test(html), false);
    const incomplete = html.split('Incomplete research')[1]?.split('<h2>')[0] ?? '';
    assert.equal(/None recorded/.test(incomplete), false);
    assert.match(incomplete, /no numbered record was kept/);
  });
});

const OWNER_QUESTION =
  'The People of the Book used to read the Torah in Hebrew and expound on it in Arabic to the Muslims, is this true Hades ?';

const BUKHARI_4485_EN =
  'Narrated Abu Huraira:The people of the Scripture (Jews) used to recite the Torah in Hebrew and they used to explain it in Arabic to the Muslims. On that Allah\'s Messenger (ﷺ) said, "Do not believe the people of the Scripture or disbelieve them, but say:-- "We believe in Allah and what is revealed to us';

const BUKHARI_4485_AR =
  'حَدَّثَنَا مُحَمَّدُ بْنُ بَشَّارٍ، حَدَّثَنَا عُثْمَانُ بْنُ عُمَرَ، أَخْبَرَنَا عَلِيُّ بْنُ الْمُبَارَكِ، عَنْ يَحْيَى بْنِ أَبِي كَثِيرٍ، عَنْ أَبِي سَلَمَةَ، عَنْ أَبِي هُرَيْرَةَ ـ رضى الله عنه ـ قَالَ كَانَ أَهْلُ الْكِتَابِ يَقْرَءُونَ التَّوْرَاةَ بِالْعِبْرَانِيَّةِ، وَيُفَسِّرُونَهَا بِالْعَرَبِيَّةِ لأَهْلِ الإِسْلاَمِ، فَقَالَ رَسُولُ اللَّهِ صلى الله عليه وسلم ‏"‏ لاَ تُصَدِّقُوا أَهْلَ الْكِتَابِ وَلاَ تُكَذِّبُوهُمْ، وَقُولُوا ‏{‏آمَنَّا بِاللَّهِ وَمَا أُنْزِلَ‏}‏ الآيَةَ‏"‏‏.‏';

describe('hadith desk routing', () => {
  it('keeps the owner question on the Hadith desk', () => {
    const decision = coordinateQuestion({ question: OWNER_QUESTION, entry: 'hadith', language: 'en' });
    assert.equal(decision.action, 'research');
    assert.equal(decision.assignment.scope, 'hadith');
    assert.deepEqual(decision.assignment.teams, ['hadith']);
    assert.equal(decision.assignment.noticeId, null);
    assert.equal(decision.assignment.forwardedFrom, null);
  });

  it('recognises hadees, hadeeth, hadis, and true Hades as Hadith', () => {
    for (const question of ['Is this hadees authentic?', 'Is this hadeeth authentic?', 'Is this hadis correct?', 'is this true Hades ?']) {
      const decision = coordinateQuestion({ question, entry: 'quran', language: 'en' });
      assert.equal(decision.assignment.scope, 'hadith', question);
      assert.equal(decision.assignment.noticeId, 'forward-hadith', question);
      assert.equal(decision.assignment.teams.includes('books'), false, question);
    }
  });

  it('does not send People of the Book or the Torah to Books', () => {
    const narration = coordinateQuestion({
      question: 'The People of the Book used to read the Torah in Hebrew and expound on it in Arabic to the Muslims',
      entry: 'knowledge',
      language: 'en',
    });
    assert.equal(narration.assignment.scope, 'knowledge');
    assert.equal(narration.assignment.teams.includes('books'), false);
    const torah = coordinateQuestion({ question: 'What does the Torah teach about Moses?', entry: 'hadith', language: 'en' });
    assert.equal(torah.assignment.scope, 'hadith');
    assert.equal(torah.assignment.teams.includes('books'), false);
  });

  it('still routes a genuine book question to Books', () => {
    const decision = coordinateQuestion({
      question: 'What does the library say about fasting in this volume?',
      entry: 'knowledge',
      language: 'en',
    });
    assert.equal(decision.action, 'forward');
    assert.equal(decision.assignment.scope, 'books');
    assert.deepEqual(decision.assignment.teams, ['books']);
    assert.equal(decision.assignment.noticeId, 'forward-books');
  });

  it('lets the Hadith team consult Books without leaving the Hadith desk', () => {
    const decision = coordinateQuestion({
      question: 'Is this true hadees, and what does the library say?',
      entry: 'hadith',
      language: 'en',
    });
    assert.equal(decision.action, 'research');
    assert.equal(decision.assignment.scope, 'hadith');
    assert.deepEqual(decision.assignment.teams, ['hadith', 'books']);
    assert.equal(decision.assignment.noticeId, null);
  });
});

describe('Bukhari 4485 retrieval', () => {
  it('ranks the Torah-in-Hebrew wording to Sahih al-Bukhari 4485', () => {
    const numbers = rankEditionHadiths(
      OWNER_QUESTION,
      ['Torah in Hebrew', 'People of the Book'],
      [
        { hadithnumber: 1, text: 'The reward of deeds depends upon the intentions.' },
        { hadithnumber: 7542, text: 'Narrated Abu Huraira: The people of the Scripture used to read the Torah in Hebrew and explain it to the Muslims in Arabic.' },
        { hadithnumber: 7362, text: 'Narrated Abu Huraira: The people of the Book used to read the Torah in Hebrew and then explain it in Arabic to the Muslims.' },
        { hadithnumber: 4485, text: BUKHARI_4485_EN },
      ],
    );
    assert.deepEqual(numbers, [4485, 7362, 7542]);
  });

  it('reads a source-backed chain from the Arabic isnad', () => {
    const names = transmissionNames({
      arabic: BUKHARI_4485_AR,
      locator: 'Sahih al-Bukhari 4485',
      source: { provider: 'hadith-api' } as EvidencePassage['source'],
    });
    assert.ok(names && names.length >= 2);
    assert.match(names!.join(' '), /بشار/);
    assert.match(names![names!.length - 1], /هريرة/);
    assert.equal(names!.some(name => name.includes('قال') || name.includes('الكتاب')), false);
  });

  it('keeps the Hadith investigation and exports Bukhari 4485 when HadeethEnc has no number', async () => {
    let studyCollections: string[] = [];
    const result = await executeResearch({
      question: OWNER_QUESTION,
      language: 'en',
      ports: ports({
        searchHadeeth: async () => [{ id: '65046', title: 'People of the Book' }],
        loadHadeeth: async () => ({
          id: '65046',
          title: 'People of the Book',
          text: 'Abu Hurayrah reported: The People of the Book used to read the Torah in Hebrew and expound on it in Arabic to the Muslims.',
          arabic: 'عَنْ أَبِي هُرَيْرَةَ قَالَ كَانَ أَهْلُ الْكِتَابِ',
          grade: 'Authentic',
          attribution: 'Narrated by Al-Bukhari',
          explanation: 'The Prophet told his companions neither to believe nor disbelieve this report from the People of the Book when its truth is unknown.',
          url: 'https://hadeethenc.com/en/browse/hadith/65046',
        }),
        searchStudyHadith: async (_lang, _question, phrases, collectionIds) => {
          studyCollections = collectionIds;
          assert.ok(phrases.some(phrase => /torah in hebrew|people of the book|expound in arabic/i.test(phrase)));
          return [
            {
              id: 'bukhari:4485',
              collectionName: 'Sahih al-Bukhari',
              number: 4485,
              book: 65,
              inBook: 12,
              section: "Prophetic Commentary on the Qur'an (Tafseer of the Prophet (pbuh))",
              text: BUKHARI_4485_EN,
              arabic: BUKHARI_4485_AR,
              grade: null,
              url: 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-bukhari/4485.min.json',
            },
          ];
        },
      }),
      assignment: { scope: 'hadith', teams: ['hadith'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.deepEqual(studyCollections, ['bukhari']);
    const study = result.dossier.passages.find(passage => passage.locator === 'Sahih al-Bukhari 4485');
    assert.ok(study);
    assert.equal(study?.text, BUKHARI_4485_EN);
    assert.equal(study?.arabic, BUKHARI_4485_AR);
    assert.match(study?.context ?? '', /Abu Huraira/);
    assert.match(study?.context ?? '', /book 65, hadith 12/);
    assert.equal(result.job.assignment?.scope, 'hadith');
    assert.equal(result.job.agents?.some(agent => agent.role === 'Isnad' && agent.status === 'ran'), true);
    const html = renderReportHtml(buildReportModel(result.job, result.dossier));
    assert.match(html, /Sahih al-Bukhari 4485/);
    assert.match(html, /Abu Huraira/);
    assert.match(html, new RegExp(BUKHARI_4485_AR.slice(0, 24)));
    assert.equal(html.includes('Incomplete research'), false);
    const answer = html.split('<h2>Answer</h2>')[1]?.split('<h2>')[0] ?? '';
    assert.match(answer, /Sahih al-Bukhari 4485/);
    const agents = html.split('<h2>Agents who contributed</h2>')[0];
    assert.match(html, /Transmission map/);
    assert.ok(html.indexOf('Transmission map') < html.indexOf('Agents who contributed'));
    assert.match(agents, /Answer/);
  });

  it('continues to the study collections when HadeethEnc lacks the narration', async () => {
    let called = false;
    const result = await executeResearch({
      question: OWNER_QUESTION,
      language: 'en',
      ports: ports({
        searchStudyHadith: async () => {
          called = true;
          return [
            {
              id: 'bukhari:4485',
              collectionName: 'Sahih al-Bukhari',
              number: 4485,
              book: 65,
              inBook: 12,
              section: "Prophetic Commentary on the Qur'an (Tafseer of the Prophet (pbuh))",
              text: BUKHARI_4485_EN,
              arabic: BUKHARI_4485_AR,
              grade: null,
              url: 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-bukhari/4485.min.json',
            },
          ];
        },
      }),
      assignment: { scope: 'hadith', teams: ['hadith'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(called, true);
    assert.ok(result.dossier.passages.some(passage => passage.locator === 'Sahih al-Bukhari 4485'));
  });
});

const QURAN_DESK = { scope: 'quran' as const, teams: ['quran' as const], bookId: null, noticeId: null, forwardedFrom: null };

describe('prophet-count retrieval', () => {
  it('cites messenger verses for how many prophets and does not invent a number', async () => {
    const phrases: string[] = [];
    const result = await executeResearch({
      question: 'how many prophets in islam?',
      language: 'en',
      ports: ports({
        searchHadeeth: async (_lang, phrase) => {
          phrases.push(phrase);
          return [];
        },
        getVerses: async refs =>
          refs.map(ref => ({
            surah: ref.surah,
            ayah: ref.ayah,
            arabic: 'ورسلا قد قصصناهم عليك',
            translation:
              ref.ayah === 164
                ? 'And messengers We have related to you before, and messengers We have not related to you.'
                : 'We sent messengers before you. Some of them We have related.',
            translator: 'Test',
            version: '1',
            edition: 'english_rwwad',
            url: `https://quranenc.com/api/v1/translation/aya/english_rwwad/${ref.surah}/${ref.ayah}`,
          })),
        loadCommentary: async () => ({
          ok: true as const,
          spans: [
            {
              locator: 'Al-Mukhtasar 4:163–164',
              text: 'Allah named some messengers and did not name others. This passage does not give a total.',
              url: 'https://quranenc.com/en/browse/english_mokhtasar/4',
            },
          ],
        }),
      }),
      assignment: QURAN_DESK,
    });
    assert.ok(phrases.includes('prophets'));
    assert.ok(phrases.includes('messengers'));
    assert.ok(result.dossier.passages.some(passage => passage.text.includes('messengers We have not related')));
    assert.equal(result.job.agents?.find(agent => agent.role === 'Qur’an text')?.status, 'ran');
    assert.equal(result.job.agents?.find(agent => agent.role === 'Translation')?.status, 'ran');
    assert.equal(result.job.agents?.find(agent => agent.role === 'Tafsir')?.status, 'ran');
    assert.equal(result.job.agents?.find(agent => agent.role === 'Contextual research')?.status, 'ran');
    assert.equal(result.job.agents?.find(agent => agent.role === 'Evidence review')?.status, 'ran');
    assert.equal(result.dossier.answer?.insufficientEvidence, true);
    assert.match(result.dossier.answer?.paragraphs[0]?.text ?? '', /do not state a total number/);
    assert.equal(/\b124[,.]?000\b|\b25 prophets\b/i.test(JSON.stringify(result.dossier.answer)), false);
    assert.ok(result.job.interpretation?.scopes.some(scope => scope.id === 'total'));
    assert.equal(result.job.assignment?.scope, 'quran');
  });

  it('still searches hadith when the Qur’an source fails', async () => {
    let hadith = 0;
    const result = await executeResearch({
      question: 'how many prophets in islam?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => {
          hadith += 1;
          return [{ id: '77', title: 'Prophets' }];
        },
        loadHadeeth: async () => ({
          id: '77',
          title: 'Prophets',
          text: 'The prophets are many and their exact total is not in this record.',
          arabic: null,
          grade: null,
          attribution: 'A collection',
          explanation: null,
          url: 'https://hadeethenc.com/en/browse/hadith/77',
        }),
        getVerses: async () => {
          throw new Error('QuranEnc down');
        },
      }),
      assignment: QURAN_DESK,
    });
    assert.ok(hadith > 0);
    assert.ok(result.job.coverage.some(note => note.kind === 'source_unavailable' && note.provider === 'QuranEnc'));
    assert.equal(result.job.agents?.find(agent => agent.role === 'Qur’an text')?.status, 'unavailable');
    assert.ok(result.dossier.passages.some(passage => passage.text.includes('exact total is not')));
    assert.equal(result.dossier.answer?.insufficientEvidence, true);
    assert.equal(JSON.stringify(result.dossier.answer).includes('124000'), false);
  });

  it('does not call a retrieved verse a missing source when its wording is not kept', async () => {
    const result = await executeResearch({
      question: 'What is the serial number of the bicycle I lost in Colombo?',
      language: 'en',
      ports: ports({
        suggestSearch: async () => ({ available: true, failed: false, phrases: [], ayahs: [{ surah: 2, ayah: 2 }] }),
        getVerses: async refs =>
          refs.map(ref => ({
            surah: ref.surah,
            ayah: ref.ayah,
            arabic: 'ذلك الكتاب',
            translation: 'This is the Book about which there is no doubt.',
            translator: 'Test',
            version: '1',
            edition: 'en',
            url: 'https://quranenc.com/example',
          })),
      }),
      assignment: QURAN_DESK,
    });
    assert.equal(result.dossier.passages.length, 0);
    assert.equal(result.job.agents?.find(agent => agent.role === 'Qur’an text')?.status, 'not_run');
    assert.equal(result.job.agents?.find(agent => agent.role === 'Translation')?.status, 'not_run');
    assert.equal(result.job.agents?.find(agent => agent.role === 'Evidence review')?.status, 'not_run');
    assert.equal(result.job.agents?.some(agent => agent.status === 'unavailable'), false);
    assert.equal(JSON.stringify(result.job.coverage).includes('do not establish this claim'), false);
    assert.equal(JSON.stringify(result.job.coverage).includes('share a content term'), false);
  });
});

describe('corpus counts', () => {
  const verse = (surah: number, ayah: number, translation: string, arabic = 'نص') => ({
    surah,
    ayah,
    arabic,
    translation,
    translator: 'Test',
    version: '1',
    edition: 'english_rwwad',
    url: `https://quranenc.com/api/v1/translation/aya/english_rwwad/${surah}/${ayah}`,
  });

  it('counts a war word on a word boundary and a campaign only from the passage', () => {
    assert.equal(wordingInText('war', 'a warning'), false);
    assert.equal(wordingInText('war', 'in war'), true);
    assert.equal(wordingInText('battle', 'many battlefields'), false);
    assert.equal(wordingInText('battle', 'many battles'), false);
    assert.equal(wordingInText('battle', 'the battle of Uhud'), true);
    assert.equal(wordingInText('حرب', 'في الحرب'), true);
    assert.equal(wordingInText('حرب', 'محراب'), false);
    assert.equal(wordingInText('قتال', 'للقتال'), true);
    assert.equal(acceptedCampaign('Battle of Badr', 'victory at Badr', ['battle', 'war'])?.label, 'Badr');
    assert.equal(acceptedCampaign('battle', 'the battle of Uhud', ['battle', 'war']), null);
  });

  it('counts word occurrences and campaigns as separate lists', async () => {
    let hadith = 0;
    let wrote = 0;
    const result = await executeResearch({
      question: 'how many wars mentions in quran?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => {
          hadith += 1;
          return [{ id: '1', title: 'A narrator chain' }];
        },
        searchStudyHadith: async () => {
          hadith += 1;
          return [];
        },
        suggestSearch: async () => ({
          available: true,
          failed: false,
          phrases: ['battles mentioned in Quran'],
          ayahs: [
            { surah: 3, ayah: 121 },
            { surah: 3, ayah: 123 },
            { surah: 33, ayah: 9 },
            { surah: 9, ayah: 25 },
            { surah: 2, ayah: 2 },
          ],
        }),
        listWordings: async () => ({ available: true, failed: false, english: ['battle', 'war'], arabic: ['حرب'] }),
        searchQuran: async phrase => {
          if (phrase === 'battle') {
            return {
              total: 2,
              refs: [
                { surah: 3, ayah: 121 },
                { surah: 21, ayah: 80 },
              ],
              hits: [
                { surah: 3, ayah: 121, text: 'Remember when you set forth to the battle of Uhud.' },
                { surah: 21, ayah: 80, text: 'coats of mail to use in battle' },
              ],
            };
          }
          if (phrase === 'war') {
            return {
              total: 1,
              refs: [{ surah: 2, ayah: 216 }],
              hits: [{ surah: 2, ayah: 216, text: 'Prescribed for you is war, though it is hateful.' }],
            };
          }
          return { total: 0, refs: [], hits: [] };
        },
        assessRelevance: async (_question, _meaning, passages) => ({
          available: true,
          failed: false,
          keep: [],
          events: passages.flatMap(passage => {
            if (/Uhud/i.test(passage.text)) return [{ id: passage.id, campaign: 'Uhud' }];
            if (/Badr/i.test(passage.text)) return [{ id: passage.id, campaign: 'Badr' }];
            if (/Hunayn/i.test(passage.text)) return [{ id: passage.id, campaign: 'Hunayn' }];
            if (/Confederate/i.test(passage.text)) return [{ id: passage.id, campaign: 'Confederate' }];
            return [];
          }),
        }),
        getVerses: async refs =>
          refs.map(ref => {
            if (ref.surah === 3 && ref.ayah === 121) return verse(3, 121, 'Remember when you set forth to the battle of Uhud.');
            if (ref.surah === 3 && ref.ayah === 123) return verse(3, 123, 'Allah had already given you victory at Badr.');
            if (ref.surah === 33 && ref.ayah === 9) return verse(33, 9, 'When the Confederate forces came against you.');
            if (ref.surah === 9 && ref.ayah === 25) return verse(9, 25, 'Allah gave you victory on the day of Hunayn.');
            return verse(ref.surah, ref.ayah, 'This is the Book about which there is no doubt.');
          }),
        loadCommentary: async (_lang, surah) => ({
          ok: true as const,
          spans: [{ locator: `Al-Mukhtasar ${surah}:1`, text: 'The commentary describes the campaign in this passage.', url: 'https://quranenc.com/en/browse/english_mokhtasar/3' }],
        }),
        writeAnswer: async () => {
          wrote += 1;
          return {
            paragraphs: [{ text: 'The Qur’an mentions six wars.', citations: ['Q3-121'] }],
            insufficientEvidence: false,
          };
        },
      }),
      assignment: QURAN_DESK,
    });
    assert.equal(hadith, 0);
    assert.equal(wrote, 0);
    assert.match(result.job.interpretation?.meaning ?? '', /word-occurrence/i);
    assert.doesNotMatch(result.job.interpretation?.meaning ?? '', /listed for that reading/);
    assert.match(result.job.interpretation?.scopes.find(scope => scope.id === 'occurrence')?.text ?? '', /wording/i);
    assert.match(result.job.interpretation?.scopes.find(scope => scope.id === 'event')?.text ?? '', /apart from the word count/);
    assert.equal(result.job.agents?.some(agent => agent.team === 'hadith'), false);
    const word = result.dossier.answer?.paragraphs[0]?.text ?? '';
    const events = result.dossier.answer?.paragraphs[1]?.text ?? '';
    assert.match(word, /Word occurrence/);
    assert.match(word, /English wordings counted: battle, war/);
    assert.match(word, /Arabic wordings counted: حرب/);
    assert.match(word, /3 distinct occurrences remain/);
    assert.match(word, /Qur’an 3:121 — English “battle”/);
    assert.match(word, /Qur’an 21:80 — English “battle”/);
    assert.match(word, /Qur’an 2:216 — English “war”/);
    assert.equal(word.includes('3:123'), false);
    assert.match(events, /Historical events/);
    assert.match(events, /4 campaigns are named/);
    assert.match(events, /not the word count/);
    assert.match(events, /Uhud — Qur’an 3:121/);
    assert.match(events, /Badr — Qur’an 3:123/);
    assert.match(events, /Hunayn — Qur’an 9:25/);
    assert.match(events, /Confederate — Qur’an 33:9/);
    assert.equal(events.includes('21:80'), false);
    assert.equal(events.includes('2:216'), false);
    assert.equal(result.job.agents?.find(agent => agent.role === 'Qur’an text')?.status, 'ran');
    assert.equal(result.job.agents?.find(agent => agent.role === 'Translation')?.status, 'ran');
    assert.equal(result.job.agents?.find(agent => agent.role === 'Tafsir')?.status, 'ran');
    assert.equal(result.dossier.answer?.insufficientEvidence, false);
    assert.equal(/six/i.test(JSON.stringify(result.dossier.answer)), false);
    assert.equal(JSON.stringify(result.job.coverage).includes('share a content term'), false);
    assert.equal(JSON.stringify(result.job.coverage).includes('do not establish this claim'), false);
    const html = renderReportHtml(buildReportModel(result.job, result.dossier));
    assert.equal(html.includes('Transmission map'), false);
    assert.match(html, /Research activity/);
    assert.match(html, /3 distinct occurrences remain/);
    assert.match(html, /4 campaigns are named/);
  });

  it('counts a paraphrase from the wording it retrieves, not a fixed war list', async () => {
    const result = await executeResearch({
      question: 'How often does the Qur’an speak about orphans?',
      language: 'en',
      ports: ports({
        suggestSearch: async () => ({ available: true, failed: false, phrases: ['orphan'], ayahs: [{ surah: 93, ayah: 9 }] }),
        searchQuran: async () => ({ total: 0, refs: [], hits: [] }),
        assessRelevance: async () => ({ available: true, failed: false, keep: [], events: [] }),
        getVerses: async refs => refs.map(ref => verse(ref.surah, ref.ayah, 'So as for the orphan, do not oppress him.')),
      }),
      assignment: QURAN_DESK,
    });
    const text = result.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join('\n') ?? '';
    assert.match(text, /1 distinct occurrence remains/);
    assert.match(text, /English “orphan”/);
    assert.match(text, /93:9/);
    assert.match(text, /No retrieved passage names a campaign/);
    assert.equal(text.includes('3:123'), false);
    assert.equal(text.includes('Badr'), false);
    assert.equal(result.dossier.answer?.insufficientEvidence, false);
    assert.equal(result.job.agents?.some(agent => agent.team === 'hadith'), false);
  });

  it('does not keep a battle verse when review names no campaign and the wording is absent', async () => {
    const result = await executeResearch({
      question: 'how many wars mentions in quran?',
      language: 'en',
      ports: ports({
        suggestSearch: async () => ({ available: true, failed: false, phrases: [], ayahs: [{ surah: 3, ayah: 123 }] }),
        searchQuran: async () => ({ total: 1, refs: [{ surah: 2, ayah: 2 }] }),
        assessRelevance: async () => ({ available: true, failed: true, keep: [] }),
        getVerses: async refs =>
          refs.map(ref =>
            verse(
              ref.surah,
              ref.ayah,
              ref.ayah === 123 ? 'Allah had already given you victory at Badr.' : 'This is the Book about which there is no doubt.',
            ),
          ),
      }),
      assignment: QURAN_DESK,
    });
    assert.equal(result.dossier.passages.some(passage => passage.source.id === '3:123'), false);
    assert.equal(result.dossier.passages.some(passage => passage.source.id === '2:2'), false);
    const text = result.dossier.answer?.paragraphs[0]?.text ?? '';
    assert.match(text, /Word occurrence/);
    assert.match(text, /0 distinct occurrences remain/);
    assert.match(text, /No retrieved passage names a campaign/);
    assert.match(JSON.stringify(result.job.coverage), /Meaning review did not name a campaign/);
    assert.equal(/six/i.test(JSON.stringify(result.dossier.answer)), false);
  });
});

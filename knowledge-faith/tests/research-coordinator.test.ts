import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvidencePassage, ResearchDossierView, ResearchJobView } from '../src/shared/contracts/v1.ts';
import { coordinateQuestion, researchFingerprint } from '../src/shared/research/coordinator.ts';
import { buildReportModel, renderReportHtml } from '../src/shared/research/report.ts';
import { roundtableFromResearch } from '../src/shared/research/roundtable.ts';
import { buildAgentContributions } from '../src/server/research/contributions.ts';
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
    assert.equal(model.agentsRan.some(agent => agent.detail.includes('Invented sahih')), false);
    const contributed = html.split('Agents who did not produce a finding')[0];
    assert.equal(contributed.includes('Invented sahih chain'), false);
  });
});

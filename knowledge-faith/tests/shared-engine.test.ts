import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvidencePassage } from '../src/shared/contracts/v1.ts';
import { coordinateQuestion } from '../src/shared/research/coordinator.ts';
import { dedupePassages } from '../src/shared/research/corroboration.ts';
import { episodeIdForRevision, prependEpisodeRevision } from '../src/shared/research/episodeRevision.ts';
import { materialParts, reviewMaterialCoverage } from '../src/shared/research/materialCoverage.ts';
import { roundtableFromResearch } from '../src/shared/research/roundtable.ts';
import { buildReportModel } from '../src/shared/research/report.ts';
import { executeResearch, publishParallelRevision, type ResearchPorts } from '../src/server/research/engine.ts';
import { awaitParallelResult, consultParallel, parallelCredentialStatus } from '../src/server/research/parallelTask.ts';

function passage(partial: Partial<EvidencePassage> & Pick<EvidencePassage, 'id' | 'text'>): EvidencePassage {
  return {
    contractVersion: '1.0.0',
    source: {
      contractVersion: '1.0.0',
      id: partial.id,
      provider: 'HadeethEnc',
      language: 'en',
      edition: 'hadeethenc-en',
      version: null,
      title: partial.id,
      credits: [],
      canonicalUrl: `https://example.test/${partial.id}`,
      contentType: 'hadith',
      rights: { source: 'test', conditions: 'test', generatedWork: false, checkedOn: '2026-10-26' },
      retrievedAt: '2026-10-26T00:00:00.000Z',
      contentHash: null,
    },
    originalLanguage: 'en',
    arabic: null,
    locator: partial.id,
    context: null,
    readerRoute: null,
    role: 'source_text',
    publishedGrade: null,
    ...partial,
  };
}

const QUESTIONS = [
  { lang: 'en' as const, entry: 'quran' as const, text: 'What does Qur’an 2:255 mean, and how should it be applied today?' },
  { lang: 'ta' as const, entry: 'hadith' as const, text: 'இந்த ஹதீஸ் என்ன சொல்கிறது, அதன் அர்த்தம் என்ன?' },
  { lang: 'si' as const, entry: 'knowledge' as const, text: 'කුර්ආනයේ මෙම වැකිය කියන්නේ කුමක්ද සහ අද එය යොදවන්නේ කෙසේද?' },
  { lang: 'en' as const, entry: 'books' as const, text: 'What does the library say about the history of the Battle of Badr?' },
  { lang: 'en' as const, entry: 'knowledge' as const, text: 'What does the science literature say about fasting and metabolism?' },
];

describe('shared research plan', () => {
  it('keeps the original question and activates only the specialists it names', () => {
    for (const item of QUESTIONS) {
      const decision = coordinateQuestion({ question: item.text, entry: item.entry, language: item.lang });
      assert.equal(decision.action, 'research');
      assert.equal(decision.assignment.scope, item.entry);
      assert.equal(decision.assignment.forwardedFrom, null);
      assert.ok(decision.assignment.teams.length > 0);
    }
    const mixed = coordinateQuestion({
      question: 'What does Qur’an 2:255 mean, and which hadith explains the verse?',
      entry: 'books',
      language: 'en',
    });
    assert.equal(mixed.assignment.scope, 'books');
    assert.deepEqual(mixed.assignment.teams, ['quran', 'hadith']);
    const selectedBook = coordinateQuestion({
      question: 'What does Qur’an 2:255 mean, and which hadith explains the verse?',
      entry: 'books',
      language: 'en',
      bookId: 735805,
    });
    assert.deepEqual(selectedBook.assignment.teams, ['quran', 'hadith']);
    assert.equal(selectedBook.assignment.teams.includes('books'), false);
    const worship = coordinateQuestion({ question: 'How should wudu be performed?', entry: 'quran', language: 'en' });
    assert.equal(worship.assignment.scope, 'quran');
    assert.equal(worship.assignment.teams.includes('quran'), true);
    assert.equal(worship.assignment.teams.includes('hadith'), true);
  });

  it('does not treat a quotation as the meaning or the modern application', () => {
    const question = 'What does Qur’an 2:255 mean, and how should it be applied today?';
    const parts = materialParts(question);
    assert.equal(parts.some(part => part.kind === 'meaning'), true);
    assert.equal(parts.some(part => part.kind === 'application'), true);
    const review = reviewMaterialCoverage({
      question,
      language: 'en',
      passages: [passage({ id: 'Q2-255', text: 'Allah, there is no god except Him, the Ever-Living.', locator: 'Surah 2, ayah 255' })],
    });
    assert.equal(review.parts.find(part => part.kind === 'locate')?.status, 'answered');
    assert.equal(review.parts.find(part => part.kind === 'meaning')?.status, 'unresolved');
    assert.equal(review.parts.find(part => part.kind === 'application')?.status, 'unresolved');
    assert.equal(review.investigation, 'partial');
    const today = reviewMaterialCoverage({
      question,
      language: 'en',
      passages: [passage({ id: 'Q5-3', text: 'No blame will there be upon you today.', role: 'translation' })],
    });
    assert.equal(today.parts.find(part => part.kind === 'application')?.status, 'unresolved');
  });

  it('counts one page once when two agents cite it', () => {
    const first = passage({ id: 'E1', text: 'Actions are by intentions, and every person has only what they intended.' });
    const second = passage({ ...first, id: 'E1-again', role: 'commentary' });
    const deduped = dedupePassages([first, second]);
    assert.equal(deduped.passages.length, 1);
    assert.equal(deduped.shared.length, 1);
    assert.equal(deduped.citationAliases['E1-again'], 'E1');
    assert.match(deduped.shared[0].note, /not independent corroboration/);
    const sharedUrl = 'https://islamhouse.com/en/books/9/';
    const block = (id: string, text: string) => passage({
      id,
      text,
      source: {
        ...passage({ id, text }).source,
        provider: 'IslamHouse',
        canonicalUrl: sharedUrl,
        contentType: 'book',
      },
    });
    const distinct = dedupePassages([
      block('B9-b1', 'The Battle of Badr was fought in the second year after the Hijrah.'),
      block('B9-b2', 'The Muslims at Badr numbered just over three hundred.'),
    ]);
    assert.deepEqual(distinct.passages.map(item => item.id), ['B9-b1', 'B9-b2']);
    assert.equal(distinct.shared.length, 1);
    assert.match(distinct.shared[0].note, /one source, not independent corroboration/);
  });

  it('refuses a wrong-language passage as the answer', () => {
    const review = reviewMaterialCoverage({
      question: 'இந்த ஹதீஸ் என்ன சொல்கிறது, அதன் அர்த்தம் என்ன?',
      language: 'ta',
      passages: [passage({ id: 'E9', text: 'Actions are by intentions only.' })],
    });
    assert.equal(review.wrongLanguage, true);
    assert.equal(review.parts.every(part => part.status === 'unresolved'), true);
    assert.match(review.unresolved.join(' '), /not in the selected language/);
    const arabicOnly = reviewMaterialCoverage({
      question: 'இந்த ஹதீஸ் என்ன சொல்கிறது, அதன் அர்த்தம் என்ன?',
      language: 'ta',
      passages: [passage({ id: 'A1', text: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ', arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ', originalLanguage: 'ar' })],
    });
    assert.equal(arabicOnly.wrongLanguage, true);
    assert.equal(arabicOnly.parts.every(part => part.status === 'unresolved'), true);
  });

  it('does not replace the episode that is playing', () => {
    const kept = episodeIdForRevision({ currentEpisodeId: 'pod-1', playingEpisodeId: 'pod-1', revision: 2 });
    assert.equal(kept.episodeId, 'pod-1-r2');
    assert.equal(kept.replacedPlaying, false);
    const idle = episodeIdForRevision({ currentEpisodeId: 'pod-1', playingEpisodeId: null, revision: 2 });
    assert.equal(idle.episodeId, 'pod-1');
    const playing = { id: 'pod-1', audioBase64: 'AAAA', state: 'playable' as const, revision: 1 };
    const created = { id: 'pod-1', audioBase64: undefined, state: 'script-ready' as const, question: 'later' };
    const merged = prependEpisodeRevision({ episodes: [playing], created, playingEpisodeId: 'pod-1', revision: 2 });
    assert.equal(merged.changed, true);
    assert.equal(merged.episodes[0].id, 'pod-1-r2');
    assert.equal(merged.episodes[1], playing);
    assert.equal(merged.episodes[1].audioBase64, 'AAAA');
  });

  it('reports missing Parallel credentials without a live call', async () => {
    const status = parallelCredentialStatus({ PARALLEL_API_KEY: '' });
    assert.equal(status.configured, false);
    assert.equal(status.liveCallMade, false);
    let called = false;
    const result = await consultParallel({
      question: 'What does the verse mean?',
      language: 'en',
      apiKey: null,
      fetchImpl: async () => {
        called = true;
        throw new Error('should not be called');
      },
    });
    assert.equal(called, false);
    assert.equal(result.liveCallMade, false);
    assert.equal(result.status, 'credentials_missing');
    assert.equal(result.findings.length, 0);
  });

  it('keeps a failed provider blocked and a citation only when the task returns one', async () => {
    const failed = await consultParallel({
      question: 'history of Badr',
      language: 'en',
      apiKey: 'test-key',
      fetchImpl: async () => new Response('no', { status: 503 }),
    });
    assert.equal(failed.liveCallMade, true);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.findings.length, 0);

    const cited = await consultParallel({
      question: 'history of Badr',
      language: 'en',
      apiKey: 'test-key',
      fetchImpl: async () => Response.json({
        run_id: 'run-1',
        status: 'completed',
        output: {
          content: {
            findings: [{ claim: 'Badr was fought in 2 AH.', excerpt: 'The Battle of Badr took place in the second year after the Hijrah.', url: 'https://example.test/badr', title: 'Badr', confidence: 'medium' }],
          },
        },
      }),
    });
    assert.equal(cited.liveCallMade, true);
    assert.equal(cited.findings.length, 1);
    assert.equal(cited.findings[0].providerConfidence, 'medium');
    assert.equal(cited.findings[0].url, 'https://example.test/badr');

    const calls: string[] = [];
    const resumed = await awaitParallelResult({
      runId: 'run-later',
      apiKey: 'test-key',
      attempts: 2,
      timeoutSec: 1,
      fetchImpl: async (url) => {
        calls.push(String(url));
        if (calls.length === 1) return new Response('', { status: 408 });
        return Response.json({
          run_id: 'run-later',
          status: 'completed',
          output: {
            content: {
              findings: [{
                claim: 'The modern application of Badr is patience when outnumbered.',
                excerpt: 'The modern application of the Battle of Badr is patience when a community is outnumbered.',
                url: 'https://example.test/badr-application',
                title: 'Badr application',
                confidence: 'medium',
              }],
            },
          },
        });
      },
    });
    assert.equal(resumed.status, 'completed');
    assert.equal(resumed.runId, 'run-later');
    assert.equal(resumed.findings.length, 1);
    assert.equal(calls.length, 2);
  });
});

describe('shared engine against the current desks', () => {
  it('answers from the opened passage and leaves meaning open', async () => {
    const started = Date.now();
    const result = await executeResearch({
      question: 'What does Qur’an 2:255 mean, and how should it be applied today?',
      language: 'en',
      ports: {
        searchHadeeth: async () => [],
        loadHadeeth: async () => { throw new Error('not opened'); },
        getVerses: async () => [{
          surah: 2,
          ayah: 255,
          arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ',
          translation: 'Allah, there is no god except Him, the Ever-Living, the Sustainer of existence.',
          translator: 'Saheeh International',
          version: null,
          edition: 'quran-uthmani',
          url: 'https://quranenc.com/en/ayah/2/255',
        }],
        searchScience: async () => 'not_configured',
      } satisfies ResearchPorts,
      assignment: { scope: 'quran', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 15_000);
    assert.equal(result.job.parallel?.liveCallMade, false);
    assert.equal(result.job.parallel?.status, 'credentials_missing');
    assert.equal(result.job.agents?.some(agent => agent.role.includes('Deep Research & Source Verification')), true);
    assert.equal(result.job.materialParts?.find(part => part.kind === 'application')?.status, 'unresolved');
    assert.equal(result.job.investigation === 'complete', false);
    const script = roundtableFromResearch({
      question: result.job.question,
      language: 'en',
      answer: result.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '',
      passages: result.dossier.passages.map(item => ({ locator: item.locator, text: item.text, context: item.context, provider: item.source.provider })),
      unresolved: result.job.materialParts?.filter(part => part.status === 'unresolved').map(part => part.note),
      investigation: result.job.investigation,
      status: 'done',
    });
    if (script) {
      assert.match(script.lines.map(line => line.speaker).join(' '), /Brother Feroz/);
      assert.match(script.lines.map(line => line.text).join(' '), /stays open|application/i);
    }
    const model = buildReportModel(result.job, result.dossier);
    assert.match(model.answer ?? '', /stays open|not treated as the meaning/i);
    assert.equal(model.chain, null);
  });

  it('compares representative questions on coverage, citations, time, and cost', async () => {
    const verse = {
      surah: 2,
      ayah: 255,
      arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ',
      translation: 'Allah, there is no god except Him, the Ever-Living, the Sustainer of existence.',
      translator: 'Saheeh International',
      version: null,
      edition: 'quran-uthmani',
      url: 'https://quranenc.com/en/ayah/2/255',
    };
    const cases = [
      {
        name: 'quran-en',
        question: 'What does Qur’an 2:255 mean, and how should it be applied today?',
        language: 'en' as const,
        teams: ['quran'] as const,
        scope: 'quran' as const,
      },
      {
        name: 'hadith-ta',
        question: 'இந்த ஹதீஸ் என்ன சொல்கிறது, அதன் அர்த்தம் என்ன?',
        language: 'ta' as const,
        teams: ['hadith'] as const,
        scope: 'hadith' as const,
      },
      {
        name: 'quran-si',
        question: 'කුර්ආනය 2:255 හි අර්ථය කුමක්ද සහ අද එය යොදවන්නේ කෙසේද?',
        language: 'si' as const,
        teams: ['quran'] as const,
        scope: 'knowledge' as const,
      },
      {
        name: 'worship-en',
        question: 'How should wudu be performed?',
        language: 'en' as const,
        teams: ['quran', 'hadith'] as const,
        scope: 'knowledge' as const,
      },
      {
        name: 'books-history-en',
        question: 'What does the library say about the history of the Battle of Badr?',
        language: 'en' as const,
        teams: ['books'] as const,
        scope: 'books' as const,
      },
      {
        name: 'science-en',
        question: 'What does the science literature say about fasting and metabolism?',
        language: 'en' as const,
        teams: ['quran', 'hadith'] as const,
        scope: 'knowledge' as const,
      },
    ];
    for (const item of cases) {
      const started = Date.now();
      const result = await executeResearch({
        question: item.question,
        language: item.language,
        ports: {
          searchHadeeth: async () => ((item.teams as readonly string[]).includes('hadith') ? [{ id: '1', title: 'Wudu' }] : []),
          loadHadeeth: async () => ({
            id: '1',
            title: 'Wudu',
            text: item.language === 'ta'
              ? 'இந்த ஹதீஸ் செயல்கள் நோக்கத்தைப் பொறுத்தது என்று சொல்கிறது.'
              : 'Wudu begins with washing the hands before prayer.',
            arabic: 'الوضوء',
            grade: 'Authentic',
            attribution: 'Sahih Muslim',
            explanation: null,
            lessons: [],
            url: 'https://hadeethenc.com/en/browse/hadith/1',
          }),
          getVerses: async () => item.language === 'si'
            ? [{ ...verse, translation: 'Allah, there is no god except Him.', url: 'https://quranenc.com/si/ayah/2/255' }]
            : [verse],
          searchScience: async () => 'not_configured',
          readBook: async () => ({
            id: 9,
            title: 'The Battle of Badr',
            availability: 'readable',
            limitation: null,
            url: 'https://islamhouse.com/en/books/9/',
            language: 'en',
            blocks: [{ id: 'b1', text: 'The Battle of Badr is a named campaign in the second year after the Hijrah.' }],
          }),
        } satisfies ResearchPorts,
        assignment: { scope: item.scope, teams: [...item.teams], bookId: item.scope === 'books' ? 9 : null, noticeId: null, forwardedFrom: null },
      });
      const elapsed = Date.now() - started;
      assert.ok(elapsed < 15_000, item.name);
      assert.equal(result.job.parallel?.liveCallMade, false, item.name);
      assert.equal(result.job.question, item.question);
      assert.equal(result.dossier.passages.every(row => row.source.canonicalUrl.startsWith('https://')), true, item.name);
      const open = result.job.materialParts?.filter(part => part.status === 'unresolved').map(part => part.kind) ?? [];
      if (item.name === 'quran-en' || item.name === 'hadith-ta') assert.equal(open.includes('meaning'), true, item.name);
      if (item.name === 'quran-si') {
        assert.equal(result.job.coverage.some(note => note.kind === 'language_unavailable'), true);
        assert.equal(result.dossier.passages.length, 0);
        assert.equal(open.includes('meaning'), true);
        assert.equal(open.includes('application'), true);
      }
      if (item.name === 'worship-en') assert.equal(result.job.materialParts?.find(part => part.kind === 'worship')?.status, 'answered');
      if (item.name === 'books-history-en') {
        assert.equal(result.job.materialParts?.find(part => part.kind === 'history')?.status, 'answered');
        assert.equal(result.job.materialParts?.find(part => part.kind === 'books')?.status, 'answered');
      }
      if (item.name === 'science-en') assert.equal(result.job.materialParts?.find(part => part.kind === 'science')?.status, 'unresolved');
      assert.equal(buildReportModel(result.job, result.dossier).chain, null, item.name);
    }
  });

  it('blocks a failed provider and does not cite a wrong-language passage', async () => {
    const failed = await executeResearch({
      question: 'What is the hadith about intentions?',
      language: 'en',
      ports: {
        searchHadeeth: async () => { throw new Error('HadeethEnc is down'); },
        loadHadeeth: async () => { throw new Error('not opened'); },
        getVerses: async () => [],
        searchScience: async () => 'not_configured',
      } satisfies ResearchPorts,
      assignment: { scope: 'hadith', teams: ['hadith'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(failed.job.investigation, 'blocked');
    assert.equal(failed.job.parallel?.liveCallMade, false);
    assert.equal(roundtableFromResearch({
      question: failed.job.question,
      language: 'en',
      answer: 'A source did not respond.',
      passages: [{ locator: 'none', text: 'A source did not respond, so this part is not answered.' }],
      investigation: failed.job.investigation,
      status: 'done',
    }), null);

    const wrong = await executeResearch({
      question: 'இந்த ஹதீஸ் என்ன சொல்கிறது, அதன் அர்த்தம் என்ன?',
      language: 'ta',
      ports: {
        searchHadeeth: async () => [{ id: '9', title: 'Intentions', snippet: 'Actions are by intentions.' }],
        loadHadeeth: async () => ({
          id: '9',
          title: 'Intentions',
          text: 'Actions are by intentions, and every person shall have only what they intended.',
          arabic: null,
          grade: null,
          attribution: null,
          explanation: null,
          lessons: [],
          url: 'https://hadeethenc.com/en/browse/hadith/9',
        }),
        getVerses: async () => [],
        searchScience: async () => 'not_configured',
      } satisfies ResearchPorts,
      assignment: { scope: 'hadith', teams: ['hadith'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(wrong.dossier.passages.length, 0);
    assert.equal(wrong.job.materialParts?.every(part => part.status === 'unresolved'), true);
    assert.match(wrong.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '', /selected language/);
  });

  it('blocks a failed Qur’an source, searches science from the question, and cites a Parallel finding', async () => {
    const quranDown = await executeResearch({
      question: 'What does Qur’an 2:255 mean?',
      language: 'en',
      ports: {
        searchHadeeth: async () => [],
        loadHadeeth: async () => { throw new Error('not opened'); },
        getVerses: async () => { throw new Error('QuranEnc is down'); },
        searchScience: async () => 'not_configured',
      } satisfies ResearchPorts,
      assignment: { scope: 'quran', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(quranDown.job.investigation, 'blocked');
    assert.equal(quranDown.dossier.passages.length, 0);

    let scienceCalls = 0;
    await executeResearch({
      question: 'What does the Qur’an say about fasting, and what does the science literature say about metabolism?',
      language: 'en',
      ports: {
        searchHadeeth: async () => [],
        loadHadeeth: async () => { throw new Error('not opened'); },
        getVerses: async () => [],
        searchScience: async () => {
          scienceCalls += 1;
          return 'not_configured';
        },
      } satisfies ResearchPorts,
      assignment: { scope: 'quran', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(scienceCalls, 1);

    const researched = await executeResearch({
      question: 'What does the library say about the history of the Battle of Badr, and how should it be applied today?',
      language: 'en',
      ports: {
        searchHadeeth: async () => [],
        loadHadeeth: async () => { throw new Error('not opened'); },
        getVerses: async () => [],
        searchScience: async () => 'not_configured',
        readBook: async () => ({
          id: 9,
          title: 'The Battle of Badr',
          availability: 'readable',
          limitation: null,
          url: 'https://islamhouse.com/en/books/9/',
          language: 'en',
          blocks: [
            { id: 'b1', text: 'The Battle of Badr is a named campaign in the second year after the Hijrah.' },
            { id: 'b2', text: 'The history of the Battle of Badr records that the Muslims numbered just over three hundred.' },
          ],
        }),
      } satisfies ResearchPorts,
      assignment: { scope: 'books', teams: ['books'], bookId: 9, noticeId: null, forwardedFrom: null },
      parallel: {
        apiKey: 'test-key',
        pollMs: 1,
        fetchImpl: async () => Response.json({
          run_id: 'run-badr',
          status: 'completed',
          output: {
            content: {
              findings: [{
                claim: 'The modern application of Badr is patience when outnumbered.',
                excerpt: 'The modern application of the Battle of Badr is patience when a community is outnumbered.',
                url: 'https://example.test/badr-application',
                title: 'Badr application',
                confidence: 'medium',
              }],
            },
          },
        }),
      },
    });
    assert.equal(researched.dossier.passages.filter(item => item.id.startsWith('B9-')).length, 2);
    const parallelPassage = researched.dossier.passages.find(item => item.source.provider === 'Parallel');
    assert.ok(parallelPassage);
    const answer = researched.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '';
    assert.match(answer, /modern application of the Battle of Badr/i);
    assert.equal(researched.dossier.answer?.paragraphs.some(paragraph => paragraph.citations.includes(parallelPassage!.id)), true);
    assert.equal(researched.job.materialParts?.find(part => part.kind === 'application')?.status, 'answered');

    const revised = publishParallelRevision(researched, {
      status: 'completed',
      liveCallMade: true,
      runId: 'run-badr-2',
      processor: 'pro-fast',
      durationMs: 10,
      setup: null,
      findings: [{
        claim: 'A later note on Badr.',
        excerpt: 'A later Parallel note says the campaign is remembered for restraint after victory.',
        url: 'https://example.test/badr-later',
        title: 'Later Badr note',
        providerConfidence: 'low',
      }],
    });
    assert.equal(revised.job.parallel?.revision, 2);
    assert.match(revised.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '', /restraint after victory/);
    assert.equal(revised.job.id, researched.job.id);
  });
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { passageSupportsTopic } from '../src/shared/research.ts';
import { decomposeQuestion } from '../src/shared/research/decompose.ts';
import { materialParts, reviewMaterialCoverage } from '../src/shared/research/materialCoverage.ts';
import { researchOutcome } from '../src/shared/research/outcomes.ts';
import { roundtableFromResearch } from '../src/shared/research/roundtable.ts';
import { executeResearch, type ResearchPorts } from '../src/server/research/engine.ts';
import { clearSharedResearchJobs, getSharedResearchJob, startSharedResearchJob } from '../src/server/research/jobs.ts';

const CANNED_TAWHID = 'Tawhid is the greatest obligation upon the servant';

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

function hadith(id: string, text: string, grade: string | null = 'Authentic') {
  return {
    id,
    title: id,
    text,
    arabic: 'الأصل',
    grade,
    attribution: 'Test collection',
    explanation: null,
    url: `https://hadeethenc.com/en/browse/hadith/${id}`,
  };
}

describe('shared engine repair', () => {
  it('names the parts of a compound question without an internal locate label', () => {
    const question = 'What does Qur’an 2:255 mean, and how should it be applied today?';
    const parts = materialParts(question);
    assert.equal(parts.some(part => part.kind === 'meaning'), true);
    assert.equal(parts.some(part => part.kind === 'application'), true);
    assert.equal(parts.some(part => part.kind === 'locate'), true);
    const review = reviewMaterialCoverage({
      question,
      language: 'en',
      passages: [],
    });
    assert.equal(review.investigation, 'partial');
    assert.equal(review.unresolved.some(note => note.startsWith('locate:')), false);
    assert.match(review.unresolved.join(' '), /meaning|application|quotation/i);
  });

  it('does not finish Tawhid from an unrelated mercy verse, and cites a passage that is about it', async () => {
    const missed = await executeResearch({
      question: 'What is Tawhid?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => [{ id: 'mercy', title: 'Mercy' }],
        loadHadeeth: async () => hadith('mercy', 'My mercy encompasses all things.'),
      }),
    });
    const missedText = missed.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '';
    assert.equal(missed.dossier.passages.some(passage => /mercy encompasses/i.test(passage.text)), false);
    assert.equal(missed.job.investigation === 'complete', false);
    assert.equal(missedText.includes(CANNED_TAWHID), false);
    assert.match(missedText, /not a completed answer|does not address/i);
    assert.doesNotMatch(missedText, /Retrieved:|Parallel findings:|locate:/);

    const found = await executeResearch({
      question: 'What is Tawheed?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => [{ id: 't1', title: 'Tawhid' }],
        loadHadeeth: async () => hadith('t1', 'Tawhid is to single out Allah alone.'),
      }),
    });
    const foundText = found.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '';
    assert.match(foundText, /Tawhid is to single out Allah alone/);
    assert.equal(foundText.includes(CANNED_TAWHID), false);
    assert.equal(found.job.materialParts?.find(part => part.kind === 'explanation')?.status, 'answered');
    assert.equal(passageSupportsTopic('What is Tawheed?', 'Tawhid is to single out Allah alone.'), true);
    assert.ok(decomposeQuestion('What is Tawheed?').subquestions.some(sub => sub.queries.includes('tawhid')));
  });

  it('searches Arabic and English equivalents for Tamil and Sinhala without writing them into the answer', async () => {
    const plan = decomposeQuestion('தவ்ஹீத் என்றால் என்ன?');
    const queries = plan.subquestions.flatMap(sub => sub.queries);
    assert.ok(queries.some(query => /tawhid|توحيد/.test(query)));
    const sinhala = decomposeQuestion('සලාත් යනු කුමක්ද?');
    assert.ok(sinhala.subquestions.flatMap(sub => sub.queries).some(query => /prayer|صلاة/.test(query)));

    const result = await executeResearch({
      question: 'தவ்ஹீத் என்றால் என்ன?',
      language: 'ta',
      ports: ports({
        searchHadeeth: async (_lang, phrase) => (phrase.includes('தவ்ஹீத்') || phrase === 'tawhid' ? [{ id: 'ta1', title: 'தவ்ஹீத்' }] : []),
        loadHadeeth: async () => hadith('ta1', 'தவ்ஹீத் என்பது அல்லாஹ்வை மட்டும் வணங்குவது.'),
      }),
    });
    const text = result.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '';
    assert.match(text, /தவ்ஹீத் என்பது அல்லாஹ்வை மட்டும் வணங்குவது/);
    assert.doesNotMatch(text, /توحيد/);
  });

  it('keeps a Sinhala passage and does not treat a missing translation as absence', async () => {
    const kept = await executeResearch({
      question: 'සලාත් යනු කුමක්ද?',
      language: 'si',
      ports: ports({
        searchHadeeth: async () => [{ id: 'si1', title: 'සලාත්' }],
        loadHadeeth: async () => hadith('si1', 'සලාත් යනු අල්ලාහ් වෙනුවෙන් කරන වන්දනයයි.'),
      }),
    });
    assert.equal(kept.dossier.passages.length > 0, true);
    assert.match(kept.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '', /වන්දනය/);

    const missing = await executeResearch({
      question: 'සලාත් යනු කුමක්ද?',
      language: 'si',
      ports: ports({
        searchHadeeth: async () => [{ id: 'en1', title: 'Salah' }],
        loadHadeeth: async () => hadith('en1', 'Salah is worship offered to Allah.'),
      }),
    });
    assert.equal(missing.dossier.passages.length, 0);
    assert.equal(missing.job.coverage.some(note => note.kind === 'language_unavailable'), true);
    assert.match(missing.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '', /selected language/);
    assert.match(missing.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '', /not a finding that the subject is absent/);
    assert.equal(missing.job.investigation === 'complete', false);
  });

  it('rejects a false place, an unresolved comparison, and a scientific claim made from worship text', async () => {
    const tokyo = await executeResearch({
      question: 'Did the Prophet lead the Friday prayer in Tokyo?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => [{ id: 'madinah', title: 'Prayer' }],
        loadHadeeth: async () => hadith('madinah', 'The Prophet led the prayer in Madinah.'),
      }),
    });
    const tokyoText = tokyo.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '';
    assert.equal(tokyo.dossier.passages.length, 0);
    assert.equal(tokyo.job.investigation === 'complete', false);
    assert.doesNotMatch(tokyoText, /led the prayer in Tokyo|prayed in Tokyo/i);

    const compared = await executeResearch({
      question: 'What is the difference between zakat and sadaqah?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => [{ id: 'z', title: 'Zakat' }],
        loadHadeeth: async () => hadith('z', 'Zakat is a due on wealth.'),
      }),
    });
    assert.equal(compared.job.materialParts?.find(part => part.kind === 'comparison')?.status, 'unresolved');
    assert.doesNotMatch(compared.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '', /sadaqah is the same/i);

    const science = await executeResearch({
      question: 'What does the science literature say about fasting and metabolism?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => [{ id: 'wudu', title: 'Wudu' }],
        loadHadeeth: async () => hadith('wudu', 'Wudu begins with washing the hands before prayer.'),
      }),
    });
    assert.equal(science.dossier.passages.some(passage => /washing the hands/i.test(passage.text)), false);
    assert.equal(science.job.materialParts?.find(part => part.kind === 'science')?.status, 'unresolved');
  });

  it('quotes a supporting hadith the way the working hadith dossier quotes a retrieved narration', async () => {
    const result = await executeResearch({
      question: 'What is the hadith about intentions?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => [{ id: '1', title: 'Intentions' }],
        loadHadeeth: async () => hadith('1', 'Actions are but by intentions, and every person shall have only what they intended.'),
      }),
    });
    const text = result.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '';
    assert.match(text, /Actions are but by intentions/);
    assert.match(text, /Authentic/);
    assert.doesNotMatch(text, /Retrieved:|Parallel findings:/);
    assert.equal(result.job.investigation === 'blocked', false);
    const script = roundtableFromResearch({
      question: result.job.question,
      language: 'en',
      answer: text,
      passages: result.dossier.passages.map(item => ({ locator: item.locator, text: item.text, context: item.context, provider: item.source.provider })),
      unresolved: result.job.materialParts?.filter(part => part.status === 'unresolved').map(part => part.note),
      status: 'done',
      investigation: result.job.investigation,
    });
    assert.ok(script);
    const spoken = script.lines.map(line => line.text).join(' ');
    assert.match(spoken, /intentions/i);
    assert.match(spoken, /\?/);
    assert.doesNotMatch(spoken, /Retrieved:|Parallel findings:|locate:|HadeethEnc search|adapter/i);
    assert.equal(new Set(script.lines.map(line => line.speaker)).size >= 3, true);
  });

  it('keeps a slow relevant source, blocks a failed source, and reopens the saved result without searching again', async () => {
    const started = Date.now();
    const slow = await executeResearch({
      question: 'What are the rights of a neighbor?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => {
          await new Promise(resolve => setTimeout(resolve, 120));
          return [{ id: '9', title: 'Neighbor' }];
        },
        loadHadeeth: async () => hadith('9', 'The rights of a neighbor include kindness to that neighbor.'),
      }),
    });
    assert.ok(Date.now() - started < 15_000);
    assert.match(slow.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '', /rights of a neighbor/i);

    const failed = await executeResearch({
      question: 'What are the rights of a neighbor?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => {
          throw new Error('HadeethEnc is down');
        },
      }),
    });
    assert.equal(failed.job.investigation, 'blocked');
    assert.match(failed.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join(' ') ?? '', /provider failure/i);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-repair-'));
    const previous = process.env.DD_PERSIST_DIR;
    process.env.DD_PERSIST_DIR = dir;
    clearSharedResearchJobs();
    let searches = 0;
    try {
      const id = startSharedResearchJob('What are the rights of a neighbor?', 'en', ports({
        searchHadeeth: async () => {
          searches += 1;
          return [{ id: '9', title: 'Neighbor' }];
        },
        loadHadeeth: async () => hadith('9', 'The rights of a neighbor include kindness to that neighbor.'),
      }), {
        assignment: { scope: 'hadith', teams: ['hadith'], bookId: null, noticeId: null, forwardedFrom: null },
      });
      let saved = getSharedResearchJob(id);
      for (let attempt = 0; attempt < 40 && saved?.job.status !== 'done'; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 25));
        saved = getSharedResearchJob(id);
      }
      assert.equal(saved?.job.status, 'done');
      const calls = searches;
      clearSharedResearchJobs();
      const reopened = getSharedResearchJob(id);
      assert.equal(reopened?.job.id, id);
      assert.equal(reopened?.dossier?.passages.length, 1);
      assert.equal(searches, calls);
    } finally {
      if (previous === undefined) delete process.env.DD_PERSIST_DIR;
      else process.env.DD_PERSIST_DIR = previous;
      fs.rmSync(dir, { recursive: true, force: true });
      clearSharedResearchJobs();
    }
  });

  it('distinguishes still running from partial, failed, and complete', () => {
    const still = researchOutcome({
      question: 'What is Tawhid?',
      queryCount: 2,
      passageCount: 1,
      coverage: [],
      investigation: 'partial',
      parallelStatus: 'running',
      jobStatus: 'done',
    });
    assert.equal(still?.title, 'Research is still running.');
    assert.match(still?.detail ?? '', /will not replace audio/i);

    const failed = researchOutcome({
      question: 'What is Tawhid?',
      queryCount: 1,
      passageCount: 0,
      coverage: [],
      investigation: 'blocked',
      jobStatus: 'error',
    });
    assert.equal(failed?.title, 'Research failed.');

    const partial = researchOutcome({
      question: 'What does Qur’an 2:255 mean?',
      queryCount: 1,
      passageCount: 1,
      coverage: [],
      investigation: 'partial',
      jobStatus: 'done',
    });
    assert.equal(partial?.title, 'Research is partial.');

    const empty = researchOutcome({
      question: 'What is Tawhid?',
      queryCount: 1,
      passageCount: 0,
      coverage: [],
      investigation: 'complete',
      jobStatus: 'done',
    });
    assert.equal(empty?.title, 'This is not a completed answer.');
  });
});

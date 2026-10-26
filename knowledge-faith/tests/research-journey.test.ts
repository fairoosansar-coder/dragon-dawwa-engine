import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { readArchivedEpisodes, readArchivedRevisions, saveArchivedEpisode } from '../src/server/research/archive.ts';
import type { ResearchPorts } from '../src/server/research/engine.ts';
import { executeResearch, publishParallelRevision } from '../src/server/research/engine.ts';
import { clearSharedResearchJobs, getSharedResearchJob, startSharedResearchJob } from '../src/server/research/jobs.ts';
import { prependEpisodeRevision, readPlayingEpisodeId } from '../src/shared/research/episodeRevision.ts';
import { roundtableFromResearch } from '../src/shared/research/roundtable.ts';
import { answerStudioQuestion } from '../src/server/studio/service.ts';

const archiveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-archive-'));
const previousArchive = process.env.RESEARCH_ARCHIVE_DIR;

function ports(extra: Partial<ResearchPorts> = {}): ResearchPorts {
  return {
    searchHadeeth: async () => [],
    loadHadeeth: async () => {
      throw new Error('not opened');
    },
    getVerses: async () => [{
      surah: 2,
      ayah: 153,
      arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ',
      translation: 'O you who believe, seek help through patience and prayer.',
      translator: 'Saheeh International',
      version: null,
      edition: 'en',
      url: 'https://quranenc.com/en/ayah/2/153',
    }],
    searchScience: async () => 'not_configured',
    ...extra,
  };
}

describe('saved research outlives the memory cache', () => {
  before(() => {
    process.env.RESEARCH_ARCHIVE_DIR = archiveDir;
    clearSharedResearchJobs();
  });
  after(() => {
    clearSharedResearchJobs();
    if (previousArchive === undefined) delete process.env.RESEARCH_ARCHIVE_DIR;
    else process.env.RESEARCH_ARCHIVE_DIR = previousArchive;
    fs.rmSync(archiveDir, { recursive: true, force: true });
  });

  it('reloads the saved dossier after the memory job is gone', async () => {
    const id = startSharedResearchJob('What does Qur’an 2:153 say about patience and prayer?', 'en', ports());
    const deadline = Date.now() + 8_000;
    let saved = getSharedResearchJob(id);
    while (Date.now() < deadline && saved?.job.status === 'running') {
      await new Promise(resolve => setTimeout(resolve, 50));
      saved = getSharedResearchJob(id);
    }
    assert.equal(saved?.job.status, 'done');
    clearSharedResearchJobs();
    const reopened = getSharedResearchJob(id);
    assert.equal(reopened?.job.id, id);
    assert.equal(reopened?.job.status, 'done');
    assert.equal(reopened?.job.question, 'What does Qur’an 2:153 say about patience and prayer?');
    assert.ok((reopened?.dossier?.passages.length ?? 0) > 0);
    assert.ok(readArchivedRevisions(id).length >= 1);
  });

  it('keeps generated audio for a later reopen and does not replace a playing episode', () => {
    saveArchivedEpisode({
      id: 'pod-journey',
      jobId: 'job-journey',
      revision: 1,
      question: 'What does patience mean?',
      language: 'en',
      lines: [
        { speaker: 'Brother Feroz', role: 'Brother Feroz', text: 'The question is patience?' },
        { speaker: 'Dr. Layla al-Qasimi', role: 'Dr. Layla al-Qasimi', text: 'The passage establishes patience and prayer.' },
        { speaker: 'Dr. Zainab al-Mubarak', role: 'Dr. Zainab al-Mubarak', text: 'What should we refuse to add?' },
        { speaker: 'Dr. Layla al-Qasimi', role: 'Dr. Layla al-Qasimi', text: 'Only what the passage says.' },
      ],
      sources: ['Qur’an 2:153'],
      participants: [],
      reportHtml: '<p>Patience</p>',
      state: 'playable',
      savedAt: new Date().toISOString(),
      audioBase64: 'UklGRg==',
      mimeType: 'audio/wav',
    });
    const loaded = readArchivedEpisodes('job-journey');
    assert.equal(loaded[0]?.audioBase64, 'UklGRg==');
    const playing = { id: 'pod-journey', audioBase64: 'UklGRg==', revision: 1 };
    const doc = {
      querySelector(selector: string) {
        return selector === 'audio[data-episode="pod-journey"]' ? { paused: false, ended: false } : null;
      },
    };
    assert.equal(readPlayingEpisodeId(doc, 'pod-journey'), 'pod-journey');
    const merged = prependEpisodeRevision({
      episodes: [playing],
      created: { ...playing, audioBase64: 'NEW', revision: 2 },
      playingEpisodeId: readPlayingEpisodeId(doc, 'pod-journey'),
      revision: 2,
    });
    assert.equal(merged.episodes.find(item => item.id === 'pod-journey')?.audioBase64, 'UklGRg==');
    assert.equal(merged.episodes.find(item => item.id === 'pod-journey-r2')?.audioBase64, 'NEW');
  });
});

describe('Parallel revision and follow-up', () => {
  it('reconciles the running note and discusses a supported finding', async () => {
    const researched = await executeResearch({
      question: 'What does Qur’an 24:4 mean, and how should that ruling be applied today?',
      language: 'en',
      ports: ports({
        getVerses: async () => [{
          surah: 24,
          ayah: 4,
          arabic: 'وَالَّذِينَ يَرْمُونَ الْمُحْصَنَاتِ',
          translation: 'And those who accuse chaste women and do not produce four witnesses, flog them eighty lashes.',
          translator: 'Saheeh International',
          version: null,
          edition: 'en',
          url: 'https://quranenc.com/en/ayah/24/4',
        }],
        loadCommentary: async () => ({
          ok: true,
          spans: [{
            locator: 'Al-Mukhtasar 24:4',
            text: 'The verse requires four witnesses before a person is punished for an accusation against a chaste woman.',
            url: 'https://quranenc.com/en/browse/english/24/4',
          }],
        }),
      }),
      assignment: { scope: 'quran', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
      parallel: {
        apiKey: 'test-key',
        pollMs: 1,
        fetchImpl: async () => new Response(JSON.stringify({ run_id: 'run-24', status: 'queued' }), { status: 202 }),
      },
    });
    assert.equal(researched.job.parallel?.status, 'running');
    assert.match(researched.job.coverage.map(note => note.detail).join(' '), /still running|not in this revision/i);
    assert.equal(researched.job.materialParts?.find(part => part.kind === 'meaning')?.status, 'answered');
    assert.equal(researched.job.materialParts?.find(part => part.kind === 'application')?.status, 'unresolved');
    const revised = publishParallelRevision(researched, {
      status: 'completed',
      liveCallMade: true,
      runId: 'run-24',
      processor: 'pro-fast',
      durationMs: 5,
      setup: null,
      findings: [{
        claim: 'A narration records reciting the accusation verse when teaching the limit of testimony.',
        excerpt: 'When you teach this ruling, recite the verse and stop at the four-witness condition.',
        url: 'https://example.test/24-4',
        title: 'Teaching the witness condition',
        providerConfidence: 'medium',
      }],
    });
    const answer = revised.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join('\n') ?? '';
    assert.equal(revised.job.parallel?.revision, 2);
    assert.equal(revised.job.coverage.some(note => /still running/i.test(note.detail)), false);
    assert.match(revised.job.coverage.map(note => note.detail).join(' '), /Parallel returned 1 cited finding/);
    assert.match(answer, /recite the verse and stop at the four-witness condition/);
    assert.match(answer, /Practical suggestion recorded by a source/);
    assert.doesNotMatch(answer, /Parallel findings:/);
    assert.equal(revised.job.materialParts?.find(part => part.kind === 'application')?.status, 'unresolved');
    const script = roundtableFromResearch({
      question: revised.job.question,
      language: 'en',
      answer,
      passages: revised.dossier.passages.map(passage => ({
        locator: passage.locator,
        text: passage.text,
        context: passage.context,
        provider: passage.source.provider,
      })),
      unresolved: revised.job.materialParts?.filter(part => part.status === 'unresolved').map(part => part.note),
      investigation: revised.job.investigation,
      status: 'done',
    });
    assert.ok(script);
    const spoken = script.lines.map(line => line.text).join(' ');
    assert.match(spoken, /four-witness|four witnesses|recite the verse/i);
    assert.match(spoken, /stays open|application/i);
    assert.doesNotMatch(spoken, /Parallel findings:|was opened|source unavailable/i);
    assert.equal(script.lines.some(line => line.speaker !== 'Brother Feroz' && line.text.includes('?')), true);
  });

  it('treats an unrelated studio question as a limitation', async () => {
    const unsupported = await answerStudioQuestion({
      episodeId: 'tonight-mercy-ar-rahman',
      segmentId: 'seg-3',
      question: 'What is the population of Tokyo?',
      lang: 'en',
    }, ports({
      getVerses: async () => [{
        surah: 7,
        ayah: 156,
        arabic: 'وَرَحْمَتِي وَسِعَتْ كُلَّ شَيْءٍ',
        translation: 'My mercy encompasses all things.',
        translator: 'Saheeh International',
        version: null,
        edition: 'en',
        url: 'https://quranenc.com/en/ayah/7/156',
      }],
    }));
    assert.equal(unsupported.kind, 'limitation');
    assert.match(unsupported.note, /do not answer this question/i);
    assert.equal(unsupported.references.length, 0);
  });
});

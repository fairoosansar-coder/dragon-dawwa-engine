import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coordinateQuestion } from '../src/shared/research/coordinator.ts';
import { TAMIL_PRAYER_DEEDS, SINHALA_PRAYER_DEEDS, isPrayerDeedsQuestion } from '../src/shared/research/prayerDeeds.ts';
import { buildReportModel, renderReportHtml } from '../src/shared/research/report.ts';
import { roundtableFromResearch } from '../src/shared/research/roundtable.ts';
import { boundedRecoveryPhrases } from '../src/server/research/hadeethOpen.ts';
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

describe('not praying and the state of other deeds', () => {
  it('stays in Knowledge and does not route to fixed catalogue ids', () => {
    assert.equal(isPrayerDeedsQuestion(TAMIL_PRAYER_DEEDS), true);
    assert.equal(isPrayerDeedsQuestion(SINHALA_PRAYER_DEEDS), true);
    const decision = coordinateQuestion({ question: TAMIL_PRAYER_DEEDS, entry: 'knowledge', language: 'ta' });
    assert.equal(decision.action, 'research');
    assert.equal(decision.assignment.scope, 'knowledge');
    assert.equal(decision.assignment.teams.includes('hadith'), true);
    const recovery = boundedRecoveryPhrases([TAMIL_PRAYER_DEEDS]);
    assert.equal(recovery.includes('abandons the prayer'), false);
    assert.equal(recovery.includes('6261'), false);
  });

  it('does not open a predetermined hadith when the catalogue is empty', async () => {
    const phrases: string[] = [];
    const result = await executeResearch({
      question: TAMIL_PRAYER_DEEDS,
      language: 'ta',
      ports: ports({
        searchHadeeth: async (_lang, phrase) => {
          phrases.push(phrase);
          return [];
        },
      }),
      assignment: { scope: 'knowledge', teams: ['quran', 'hadith'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(phrases.includes('abandons the prayer'), false);
    assert.equal(phrases.includes('தொழுகையை விட்ட'), false);
    assert.equal(result.dossier.passages.some(passage => passage.id === 'E6261' || passage.id === 'E65093'), false);
    assert.equal(result.job.investigation, 'partial');
    assert.equal(result.job.parallel?.liveCallMade, false);
    assert.equal(result.job.parallel?.status, 'credentials_missing');
    assert.match(result.job.materialParts?.find(part => part.kind === 'meaning')?.note ?? '', /quotation was not treated as the meaning|No passage/i);
  });

  it('blocks a provider failure without a study-collection substitute, a chain, or an episode', async () => {
    let studyCalled = false;
    const result = await executeResearch({
      question: TAMIL_PRAYER_DEEDS,
      language: 'ta',
      ports: ports({
        searchHadeeth: async () => {
          throw new Error('HadeethEnc is down');
        },
        searchStudyHadith: async () => {
          studyCalled = true;
          return [];
        },
      }),
      assignment: { scope: 'knowledge', teams: ['quran', 'hadith'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(studyCalled, false);
    assert.equal(result.job.investigation, 'blocked');
    assert.equal(result.dossier.passages.length, 0);
    assert.ok(result.job.coverage.some(note => note.kind === 'source_unavailable' && /not a finding that the subject is absent/i.test(note.detail)));
    const model = buildReportModel(result.job, result.dossier);
    assert.equal(model.chain, null);
    const html = renderReportHtml(model);
    assert.match(html, /Investigation: blocked/);
    assert.equal(html.includes('4508'), false);
    assert.equal(roundtableFromResearch({
      question: TAMIL_PRAYER_DEEDS,
      language: 'ta',
      answer: 'A blocked run must not be spoken.',
      passages: [{ locator: 'HadeethEnc 4508', text: 'Do not precede Ramadan with a day of fasting.', provider: 'HadeethEnc' }],
      investigation: 'blocked',
      status: 'done',
    }), null);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { researchJobDone } from '../src/shared/contracts/examples.ts';
import type { ResearchJobResponse } from '../src/shared/contracts/v1.ts';
import type { TopicBrief } from '../src/shared/studio/contracts.ts';
import {
  asksForScience,
  formatClock,
  hasScholarlyTitle,
  playbackAction,
  roundtableCopy,
  toRoundtableEpisode,
} from '../src/shared/studio/roundtable.ts';
import { assembleRoundtableFromJob } from '../src/server/studio/roundtableFromJob.ts';
import { UpstreamError } from '../src/server/http.ts';

const TOPIC = 'What are the rights of a neighbor? How should someone visit the sick?';

function brief(topic: string, lang: TopicBrief['lang'] = 'en'): TopicBrief {
  return {
    topic,
    audience: 'general',
    lang,
    durationMinutes: 4,
    familyId: 'research-room',
    learningObjective: 'Hear the retrieved passage.',
    tone: 'warm_reflective',
    format: 'explanatory_dialogue',
  };
}

describe('roundtable listening', () => {
  it('builds a creative conversation without treating generated lines as proof', () => {
    const job: ResearchJobResponse = structuredClone(researchJobDone);
    job.dossier?.claims.push({
      claim: 'A neighbor must be visited every hour.',
      passageIds: ['E6103'],
      support: 'unsupported',
      citationExists: true,
      quotationFaithful: false,
      citationRelevant: false,
      note: 'The opened passage does not say this.',
    });
    job.dossier?.disagreements.push('Invented dispute that must not be spoken.');
    const built = assembleRoundtableFromJob(brief(TOPIC), job, 'rt-neighbor', '2026-10-22T00:00:00.000Z');
    const passage = job.dossier?.passages[0]?.text ?? '';
    const quote = built.episode.segments.find(segment => segment.text === passage);
    assert.ok(quote);
    assert.equal(built.episode.verification.unverified.includes(`Line ${quote.index + 1}`), false);
    assert.equal(built.episode.verification.supported, false);
    assert.ok(built.episode.verification.unverified.length > 0);
    assert.equal(built.episode.published, false);
    assert.equal(built.episode.editorialState, 'needs-review');
    assert.equal(built.episode.segments.some(segment => segment.hypotheticalExample), true);
    assert.match(built.episode.segments.find(segment => segment.hypotheticalExample)?.text ?? '', /example/i);
    assert.equal(built.episode.segments.some(segment => /visited every hour|Invented dispute/i.test(segment.text)), false);
    assert.equal(built.episode.disagreements.some(item => /Invented dispute/.test(item)), true);
    assert.equal(built.episode.segments.some(segment => hasScholarlyTitle(segment.speakerName) && segment.isGeneratedSpeaker), false);
    assert.ok(built.episode.segments.some(segment => segment.sectionLabel === 'Opening'));
    assert.match(built.episode.segments[0]?.text ?? '', /visit the sick\.$/);
    assert.doesNotMatch(built.episode.segments[0]?.text ?? '', /\?\./);
    assert.ok(built.episode.segments.some(segment => segment.sectionLabel === 'Question'));
    assert.ok(built.episode.segments.some(segment => segment.sectionLabel === 'Handover'));
    assert.ok(built.episode.segments.some(segment => segment.sectionLabel === 'Closing'));
    assert.equal(built.episode.references[0]?.grade, 'Authentic');
  });

  it('does not copy an English passage into a Tamil or Sinhala roundtable', () => {
    for (const lang of ['ta', 'si'] as const) {
      const job = structuredClone(researchJobDone);
      job.job.language = lang;
      assert.throws(
        () => assembleRoundtableFromJob(brief(TOPIC, lang), job, `rt-${lang}`, '2026-10-22T00:00:00.000Z'),
        (err: unknown) => err instanceof UpstreamError && err.status === 422 && /was not copied into the script/.test(err.message),
      );
    }
  });

  it('keeps a scientific limit separate and does not invent a study', () => {
    const job = structuredClone(researchJobDone);
    job.job.question = 'What does medicine say about visiting the sick?';
    const built = assembleRoundtableFromJob(
      brief(job.job.question),
      job,
      'rt-science',
      '2026-10-22T00:00:00.000Z',
    );
    const limit = built.episode.segments.find(segment => segment.scientificLimitation);
    assert.ok(limit);
    assert.match(limit.text, /No scientific study was retrieved/);
    assert.equal(built.episode.segments.some(segment => /science proves|clinical trial/i.test(segment.text)), false);
    assert.equal(asksForScience(job.job.question), true);
  });

  it('uses one playback control and keeps each language’s own benefit line', () => {
    assert.equal(playbackAction('idle'), 'play');
    assert.equal(playbackAction('paused'), 'play');
    assert.equal(playbackAction('ended'), 'play');
    assert.equal(playbackAction('playing'), 'pause');
    assert.equal(playbackAction('preparing'), 'pause');
    assert.equal(playbackAction('buffering'), 'pause');
    assert.equal(playbackAction('error'), 'retry');
    assert.equal(formatClock(65), '1:05');
    assert.notEqual(roundtableCopy('ta').benefit, roundtableCopy('en').benefit);
    assert.notEqual(roundtableCopy('si').benefit, roundtableCopy('en').benefit);
    const shaped = toRoundtableEpisode({
      ...assembleRoundtableFromJob(brief(TOPIC), structuredClone(researchJobDone), 'rt-shape', '2026-10-22T00:00:00.000Z').episode,
      id: 'already',
    });
    assert.equal(shaped.id.startsWith('roundtable-'), true);
    assert.equal(shaped.segments.filter(segment => segment.audioKind === 'presenter_narration').every(segment => segment.directAudioUrl == null), true);
  });
});

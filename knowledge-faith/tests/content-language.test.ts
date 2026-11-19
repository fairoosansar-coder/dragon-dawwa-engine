import assert from 'node:assert/strict';
import test from 'node:test';
import { languageFailureMessage, scriptMatchesLanguage, selectionStillCurrent } from '../src/engine/utils/contentLanguage.ts';
import { getLocalizedAnalysis } from '../src/engine/utils/localizedAnalysis.ts';
import { podcastAvailability, upsertSavedResearch, type SavedResearchRecord } from '../src/engine/utils/savedResearch.ts';
import { SAMPLE_HADITHS } from '../src/engine/data/sampleHadiths.ts';

const sinhala = 'අස්ර් නමාසය කවදාද? මෙය සිංහල පර්යේෂණයකි.';
const tamil = 'அஸ்ர் தொழுகை எப்போது? இது தமிழ் ஆய்வு.';

test('Sinhala text is accepted only as Sinhala', () => {
  assert.equal(scriptMatchesLanguage(sinhala, 'si'), true);
  assert.equal(scriptMatchesLanguage(sinhala, 'ta'), false);
  assert.equal(scriptMatchesLanguage(sinhala, 'en'), false);
  assert.match(languageFailureMessage('si'), /Tamil and English were not substituted/);
});

test('Tamil text is not accepted as Sinhala', () => {
  assert.equal(scriptMatchesLanguage(tamil, 'ta'), true);
  assert.equal(scriptMatchesLanguage(tamil, 'si'), false);
});

test('a late request cannot replace the current language', () => {
  const active = { token: 2, question: 'අස්ර් නමාසය', language: 'si' as const };
  assert.equal(selectionStillCurrent(active, { token: 1, question: 'அஸ்ர்', language: 'ta' }), false);
  assert.equal(selectionStillCurrent(active, { token: 2, question: 'අස්ර් නමාසය', language: 'si' }), true);
  assert.equal(selectionStillCurrent(active, { token: 2, question: 'අස්ර් නමාසය', language: 'en' }), false);
});

test('a stamped Sinhala dossier is not recast into Tamil or the intentions example', () => {
  const preset = SAMPLE_HADITHS[0].defaultData;
  const live = {
    ...preset,
    query_hadith: 'අස්ර් නමාසය කවදාද?',
    content_language: 'si' as const,
    agent_6_synthesis: {
      ...preset.agent_6_synthesis,
      podcast_script: sinhala,
      executive_report_markdown: sinhala,
    },
  };
  const shown = getLocalizedAnalysis(live, 'ta');
  assert.equal(shown.agent_6_synthesis.podcast_script, sinhala);
  assert.equal(shown.content_language, 'si');
});

test('saved Sinhala research does not keep a Tamil script', () => {
  const tamilRecord: SavedResearchRecord = {
    id: 'ta',
    question: 'actions',
    matn: 'actions',
    isnad: '',
    language: 'ta',
    timestamp: 1,
    savedAt: 1,
    status: 'ready',
    audioReady: true,
    analysis: { ...SAMPLE_HADITHS[0].defaultData, content_language: 'ta', query_hadith: 'actions' },
  };
  const next = upsertSavedResearch([tamilRecord], {
    question: 'අස්ර් නමාසය',
    language: 'si',
    status: 'failed',
    error: languageFailureMessage('si'),
  });
  const sinhala = next.find(item => item.language === 'si');
  assert.equal(sinhala?.analysis, undefined);
  assert.equal(sinhala?.status, 'failed');
  assert.equal(podcastAvailability(sinhala!), 'Retry needed');
  assert.equal(next.find(item => item.language === 'ta')?.audioReady, true);
});

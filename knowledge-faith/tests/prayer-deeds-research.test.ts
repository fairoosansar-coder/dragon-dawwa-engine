import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coordinateQuestion } from '../src/shared/research/coordinator.ts';
import {
  SINHALA_PRAYER_DEEDS,
  TAMIL_PRAYER_DEEDS,
  isPrayerDeedsQuestion,
} from '../src/shared/research/prayerDeeds.ts';
import { buildReportModel, renderReportHtml, transmissionNames } from '../src/shared/research/report.ts';
import { roundtableFromResearch } from '../src/shared/research/roundtable.ts';
import { executeResearch, type ResearchPorts } from '../src/server/research/engine.ts';
import type { EvidencePassage } from '../src/shared/contracts/v1.ts';

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

function record(id: string, text: string, arabic: string, attribution: string) {
  return {
    id,
    title: text.slice(0, 40),
    text,
    arabic,
    grade: 'Authentic',
    attribution,
    explanation: 'The publisher reads this narration as a warning. That reading is not the grade.',
    url: `https://hadeethenc.com/ta/browse/hadith/${id}`,
  };
}

describe('not praying and the state of other deeds', () => {
  it('recognises the Tamil and Sinhala relationship and leaves a general fast alone', () => {
    assert.equal(isPrayerDeedsQuestion(TAMIL_PRAYER_DEEDS), true);
    assert.equal(isPrayerDeedsQuestion(SINHALA_PRAYER_DEEDS), true);
    assert.equal(isPrayerDeedsQuestion('What is the ruling on fasting on Monday?'), false);
    assert.equal(isPrayerDeedsQuestion('දානය නොකරන අය ගැන කුමක්ද?'), false);
    const decision = coordinateQuestion({ question: TAMIL_PRAYER_DEEDS, entry: 'knowledge', language: 'ta' });
    assert.equal(decision.assignment.scope, 'knowledge');
    assert.deepEqual(decision.assignment.teams, ['quran', 'hadith']);
  });

  it('opens #6261 and #65093 for the Tamil question and does not cite a fasting record', async () => {
    let studyCalled = false;
    const result = await executeResearch({
      question: TAMIL_PRAYER_DEEDS,
      language: 'ta',
      ports: ports({
        searchHadeeth: async (_lang, phrase) => {
          if (phrase === 'தொழுகையை விட்ட') return [{ id: '6261', title: 'அஸ்ர்' }, { id: '65767', title: 'வெள்ளி' }];
          if (phrase === 'abandons the prayer') {
            return [
              { id: '65093', title: 'abandonment' },
              { id: '6261', title: 'அஸ்ர்' },
              { id: '65094', title: 'covenant' },
              { id: '4508', title: 'fast' },
            ];
          }
          return [];
        },
        loadHadeeth: async (_lang, id) => {
          if (id === '6261') {
            return record('6261', 'அஸ்ர் தொழுகையை விட்டவர் நற்செயல்கள் வீணாகிவிடும். இது நோன்பையோ தர்மத்தையோ பெயரிடவில்லை.', 'مَنْ تَرَكَ صَلَاةَ الْعَصْرِ فَقَدْ حَبِطَ عَمَلُهُ', 'Sahih al-Bukhari');
          }
          if (id === '65093') {
            return record('65093', 'தொழுகையை விடுவது ஒரு மனிதனுக்கும் இணைவைப்புக்கும் இடையில் நிற்கிறது. நோன்பு இதில் இல்லை.', 'بَيْنَ الرَّجُلِ وَبَيْنَ الشِّرْكِ تَرْكُ الصَّلَاةِ', 'Sahih Muslim');
          }
          if (id === '65094') {
            return record('65094', 'எங்களுக்கும் அவர்களுக்கும் இடையிலான உடன்படிக்கை தொழுகை. இது திர்மிதி 2621.', 'إِنَّ الْعَهْدَ الَّذِي بَيْنَنَا وَبَيْنَهُمُ الصَّلَاةُ', 'Sunan al-Tirmidhi 2621');
          }
          throw new Error(`unexpected ${id}`);
        },
        searchStudyHadith: async () => {
          studyCalled = true;
          return [];
        },
        getVerses: async refs => refs.map(ref => ({
          surah: ref.surah,
          ayah: ref.ayah,
          arabic: 'وَمَن يَكْفُرْ بِالْإِيمَانِ فَقَدْ حَبِطَ عَمَلُهُ',
          translation: 'And whoever denies faith — his work has become worthless',
          translator: 'Test',
          version: '1',
          edition: 'english_rwwad',
          url: `https://quranenc.com/api/v1/translation/aya/english_rwwad/${ref.surah}/${ref.ayah}`,
        })),
      }),
      assignment: { scope: 'knowledge', teams: ['quran', 'hadith'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(studyCalled, false);
    assert.equal(result.job.investigation, 'partial');
    const ids = result.dossier.passages.map(passage => passage.id);
    assert.ok(ids.includes('E6261'));
    assert.ok(ids.includes('E65093'));
    assert.equal(ids.includes('E4508'), false);
    assert.equal(ids.includes('E65767'), false);
    assert.equal(result.dossier.passages.some(passage => /denies faith/i.test(passage.text)), false);
    const support = result.dossier.passages.find(passage => passage.id === 'E6261');
    assert.equal(support?.source.edition, 'hadeethenc-ta');
    assert.match(support?.context ?? '', /transmission judgement/);
    assert.match(result.dossier.answer?.paragraphs[0]?.text ?? '', /நோன்பு/);
    assert.match(result.dossier.answer?.paragraphs[0]?.text ?? '', /சட்ட/);
    const html = renderReportHtml(buildReportModel(result.job, result.dossier));
    assert.match(html, /Investigation: partial/);
    assert.match(html, /6261/);
    assert.equal(html.includes('4508'), false);
    assert.equal(html.includes('denies faith'), false);
    assert.match(html, /No narrator chain was printed/);
    const script = roundtableFromResearch({
      question: TAMIL_PRAYER_DEEDS,
      language: 'ta',
      answer: result.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join('\n'),
      passages: result.dossier.passages.map(passage => ({ locator: passage.locator, text: passage.text, context: passage.context, provider: passage.source.provider })),
      investigation: result.job.investigation,
      status: 'done',
    });
    assert.ok(script);
    const spoken = script!.lines.map(line => line.text).join('\n');
    assert.match(spoken, /6261/);
    assert.match(spoken, /சட்ட/);
    assert.equal(spoken.includes('சனிக்கிழமை'), false);
    assert.equal(transmissionNames({
      arabic: null,
      locator: 'And whoever denies faith — his work has become worthless from Surah Al-Maidah 5',
      source: { provider: 'QuranEnc', contentType: 'quran' } as EvidencePassage['source'],
    }), null);
  });

  it('opens the same records for the Sinhala question', async () => {
    const result = await executeResearch({
      question: SINHALA_PRAYER_DEEDS,
      language: 'si',
      ports: ports({
        searchHadeeth: async (_lang, phrase) => {
          if (phrase === 'සලාතය අත්හැර') return [{ id: '65093', title: 'abandon' }];
          if (phrase === 'abandons the prayer') return [{ id: '6261', title: 'asr' }, { id: '65093', title: 'abandon' }];
          return [];
        },
        loadHadeeth: async (_lang, id) => record(
          id,
          id === '6261'
            ? 'අසර් සලාතය අත්හැරීම කටයුතු නිෂ්ඵල කරයි. උපවාසය මෙහි නම් නොවේ.'
            : 'සලාතය අත්හැරීම මිනිසා සහ ආදේශකය අතර පවතී. උපවාසය මෙහි නැත.',
          id === '6261' ? 'مَنْ تَرَكَ صَلَاةَ الْعَصْرِ فَقَدْ حَبِطَ عَمَلُهُ' : 'بَيْنَ الرَّجُلِ وَبَيْنَ الشِّرْكِ تَرْكُ الصَّلَاةِ',
          id === '6261' ? 'Sahih al-Bukhari' : 'Sahih Muslim',
        ),
      }),
      assignment: { scope: 'knowledge', teams: ['quran', 'hadith'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(result.job.investigation, 'partial');
    assert.equal(result.job.language, 'si');
    assert.ok(result.dossier.passages.some(passage => passage.id === 'E6261' && passage.source.edition === 'hadeethenc-si'));
    assert.ok(result.dossier.passages.some(passage => passage.id === 'E65093'));
    assert.match(result.dossier.answer?.paragraphs[0]?.text ?? '', /නීතිමය/);
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
    assert.equal(result.job.coverage.some(note => /HadeethEnc did not return this narration/i.test(note.detail)), false);
    const model = buildReportModel(result.job, result.dossier);
    assert.equal(model.chain, null);
    const html = renderReportHtml(model);
    assert.match(html, /Investigation: blocked/);
    assert.equal(html.includes('4508'), false);
    assert.equal(html.includes('denies faith'), false);
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

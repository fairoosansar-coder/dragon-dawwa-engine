import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { passageSupportsTopic } from '../src/shared/research.ts';
import { questionInvitesScripture } from '../src/shared/research/themes.ts';
import { QURAN_SYNTHESIS_HEART, parallelRequestForDesk, parallelTaskInput, DOMAIN_CONFIGS } from '../src/server/research/agentConfig.ts';
import { answerPrompt } from '../src/server/grounding.ts';
import { executeResearch, type ResearchPorts } from '../src/server/research/engine.ts';

const QUESTION = 'Why does something we resent still hold a benefit we cannot see, and how does reliance fit that?';
const AYAH = 'Fighting has been enjoined upon you while it is hateful to you. But perhaps you hate a thing and it is good for you; and perhaps you love a thing and it is bad for you. And Allah knows, while you know not.';
const TAFSIR = 'What people resent may carry good they do not see. Trust the One who prescribed it.';

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

describe('thematic tafsir synthesis', () => {
  it('keeps a searched ayah whose wording does not repeat the question', async () => {
    assert.equal(passageSupportsTopic(QUESTION, AYAH), false);
    const asked: string[] = [];
    const result = await executeResearch({
      question: QUESTION,
      language: 'en',
      ports: ports({
        searchQuran: async () => ({
          total: 1,
          refs: [{ surah: 2, ayah: 216 }],
          hits: [{ surah: 2, ayah: 216, text: AYAH }],
        }),
        getVerses: async refs => {
          for (const ref of refs) asked.push(`${ref.surah}:${ref.ayah}`);
          const opened = refs.map(ref => ({
            surah: ref.surah,
            ayah: ref.ayah,
            arabic: ref.ayah === 216 ? 'كُتِبَ عَلَيْكُمُ الْقِتَالُ' : 'جِيرَان',
            translation: ref.ayah === 216 ? AYAH : 'A neighbouring ayah opened for context.',
            translator: 'Saheeh International',
            version: null,
            edition: 'quran-uthmani',
            url: `https://quranenc.com/en/ayah/${ref.surah}/${ref.ayah}`,
          }));
          opened.push({
            surah: 2,
            ayah: 2,
            arabic: 'ذَٰلِكَ الْكِتَابُ',
            translation: 'This is the Book about which there is no doubt.',
            translator: 'Saheeh International',
            version: null,
            edition: 'quran-uthmani',
            url: 'https://quranenc.com/en/ayah/2/2',
          });
          return opened;
        },
        loadCommentary: async () => ({
          ok: true as const,
          spans: [{
            locator: 'Al-Mukhtasar 2:216',
            text: TAFSIR,
            url: 'https://quranenc.com/en/browse/english_mokhtasar/2',
          }],
        }),
      }),
      assignment: { scope: 'quran', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    const text = result.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join('\n') ?? '';
    assert.ok(asked.includes('2:216'));
    assert.equal(result.dossier.passages.some(passage => passage.source.id === '2:216'), true);
    assert.equal(result.dossier.passages.some(passage => passage.source.id === '2:2'), false);
    assert.match(text, /hateful to you/);
    assert.match(text, /Al-Mukhtasar 2:216/);
    assert.match(text, /Trust the One who prescribed it/);
    assert.match(text, /trust in Allah/i);
    assert.doesNotMatch(text, /A passage that answers the question was not opened/);
    assert.doesNotMatch(text, /does not address this question, so it is not cited/);
    assert.doesNotMatch(text, /No passage in the selected language addresses/);
    assert.equal(JSON.stringify(result.job.coverage).includes('2:216 was opened. Read for meaning and context, it does not address'), false);
  });

  it('keeps a suggested ayah for a theological question and drops one for an unrelated request', async () => {
    assert.equal(questionInvitesScripture(QUESTION), true);
    assert.equal(questionInvitesScripture('What is the serial number of the bicycle I lost in Colombo?'), false);
    const kept = await executeResearch({
      question: QUESTION,
      language: 'en',
      ports: ports({
        suggestSearch: async () => ({ available: true, failed: false, phrases: [], ayahs: [{ surah: 2, ayah: 216 }] }),
        getVerses: async refs => refs.map(ref => ({
          surah: ref.surah,
          ayah: ref.ayah,
          arabic: 'كُتِبَ عَلَيْكُمُ الْقِتَالُ',
          translation: ref.ayah === 216 ? AYAH : 'A neighbouring ayah opened for context.',
          translator: 'Saheeh International',
          version: null,
          edition: 'quran-uthmani',
          url: `https://quranenc.com/en/ayah/${ref.surah}/${ref.ayah}`,
        })),
      }),
      assignment: { scope: 'quran', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(kept.dossier.passages.some(passage => passage.source.id === '2:216'), true);
    assert.doesNotMatch(kept.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join('\n') ?? '', /A passage that answers the question was not opened/);

    const dropped = await executeResearch({
      question: 'What is the serial number of the bicycle I lost in Colombo?',
      language: 'en',
      ports: ports({
        suggestSearch: async () => ({ available: true, failed: false, phrases: [], ayahs: [{ surah: 2, ayah: 2 }] }),
        getVerses: async refs => refs.map(ref => ({
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
      assignment: { scope: 'quran', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    assert.equal(dropped.dossier.passages.length, 0);
  });

  it('tells Parallel and the answer writer to synthesize an opened ayah', () => {
    const quran = parallelTaskInput(DOMAIN_CONFIGS.quran, QUESTION, 'en');
    assert.match(quran, /tawakkul/i);
    assert.match(quran, /do not say that no passage addresses the question/i);
    assert.equal(quran.includes(QURAN_SYNTHESIS_HEART), true);
    const knowledge = parallelRequestForDesk('knowledge', QUESTION, 'en');
    assert.match(knowledge?.taskInput ?? '', /tawakkul/i);
    assert.match(knowledge?.taskInput ?? '', /deduce the surah and ayah/);
    const prompt = answerPrompt(QUESTION, 'en', [{
      id: 'Q1',
      kind: 'quran',
      label: "Qur'an 2:216",
      arabic: '',
      text: AYAH,
      attribution: 'Saheeh International',
      grades: [],
    }]);
    assert.match(prompt, /do not say that no passage addresses the question/i);
    assert.match(prompt, /Do not set insufficientEvidence only because the ayah/);
    assert.match(prompt, /Quote its Arabic and its translation/);
    assert.match(prompt, /practical comfort/);
    assert.match(prompt, /If Tamil or Sinhala tafsir text is missing, translate the opened Arabic or English commentary/);
    assert.match(QURAN_SYNTHESIS_HEART, /do not cite an unrelated verse/i);
  });

  it('keeps an opened 2:216 for a question about revelation through Jibril', async () => {
    const question = 'How did revelation reach the Prophet through Jibril?';
    assert.equal(questionInvitesScripture(question), true);
    assert.equal(questionInvitesScripture('What did Jibril bring?'), true);
    const result = await executeResearch({
      question,
      language: 'en',
      ports: ports({
        suggestSearch: async () => ({ available: true, failed: false, phrases: [], ayahs: [{ surah: 2, ayah: 216 }] }),
        getVerses: async refs => refs.map(ref => ({
          surah: ref.surah,
          ayah: ref.ayah,
          arabic: ref.ayah === 216 ? 'كُتِبَ عَلَيْكُمُ الْقِتَالُ' : 'جِيرَان',
          translation: ref.ayah === 216 ? AYAH : 'A neighbouring ayah opened for context.',
          translator: 'Saheeh International',
          version: null,
          edition: 'quran-uthmani',
          url: `https://quranenc.com/en/ayah/${ref.surah}/${ref.ayah}`,
        })),
      }),
      assignment: { scope: 'knowledge', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    const text = result.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join('\n') ?? '';
    assert.equal(result.dossier.passages.some(passage => passage.source.id === '2:216'), true);
    assert.match(text, /كُتِبَ عَلَيْكُمُ الْقِتَالُ/);
    assert.match(text, /hateful to you/);
    assert.match(text, /spiritual meaning/i);
    assert.match(text, /practical comfort/i);
    assert.match(text, /only when the opened tafsir states it/);
    assert.doesNotMatch(text, /No passage in the selected language addresses/);
    assert.doesNotMatch(text, /A passage that answers the question was not opened/);
    assert.doesNotMatch(text, /revealed in the year/i);
  });

  it('translates an opened English commentary into a Tamil answer without dropping the ayah', async () => {
    const result = await executeResearch({
      question: QUESTION,
      language: 'ta',
      ports: ports({
        searchQuran: async () => ({
          total: 1,
          refs: [{ surah: 2, ayah: 216 }],
          hits: [{ surah: 2, ayah: 216, text: 'போர் உங்களுக்கு விதிக்கப்பட்டுள்ளது' }],
        }),
        getVerses: async refs => refs.filter(ref => ref.ayah === 216).map(ref => ({
          surah: ref.surah,
          ayah: ref.ayah,
          arabic: 'كُتِبَ عَلَيْكُمُ الْقِتَالُ',
          translation: 'போர் உங்களுக்கு விதிக்கப்பட்டுள்ளது; அது உங்களுக்கு வெறுப்பானது.',
          translator: 'Jan Trust',
          version: null,
          edition: 'ta',
          url: `https://quranenc.com/ta/ayah/${ref.surah}/${ref.ayah}`,
        })),
        loadCommentary: async () => ({
          ok: true as const,
          spans: [{
            locator: 'Al-Mukhtasar 2:216',
            text: TAFSIR,
            url: 'https://quranenc.com/en/browse/english_mokhtasar/2',
          }],
        }),
      }),
      assignment: { scope: 'quran', teams: ['quran'], bookId: null, noticeId: null, forwardedFrom: null },
    });
    const text = result.dossier.answer?.paragraphs.map(paragraph => paragraph.text).join('\n') ?? '';
    assert.equal(result.dossier.passages.some(passage => passage.source.id === '2:216'), true);
    assert.equal(result.dossier.passages.some(passage => passage.role === 'commentary'), true);
    assert.match(text, /كُتِبَ عَلَيْكُمُ الْقِتَالُ/);
    assert.match(text, /போர் உங்களுக்கு விதிக்கப்பட்டுள்ளது/);
    assert.match(text, /Trust the One who prescribed it/);
    assert.match(text, /ஆன்மீக அர்த்தம்/);
    assert.match(text, /நடைமுறை ஆறுதல்/);
    assert.doesNotMatch(text, /No passage in the selected language addresses/);
    assert.doesNotMatch(text, /A passage that answers the question was not opened/);
  });
});

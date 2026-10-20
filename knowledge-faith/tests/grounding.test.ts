import test from 'node:test';
import assert from 'node:assert/strict';
import { ask, writePodcast, type JsonModel, type SourceFetchers } from '../src/server/gemini.ts';
import { sanitizeLines, sanitizeParagraphs, verseEvidence } from '../src/server/grounding.ts';
import type { Hadith, Verse } from '../src/shared/types.ts';

const verse = (key: string): Verse => {
  const [surah, ayah] = key.split(':').map(Number);
  return { key, surah, ayah, number: 1, arabic: 'ARABIC', translation: `SOURCE TEXT ${key}`, translator: 'T', lang: 'en', surahName: 'S' };
};

const fetchers: SourceFetchers = {
  verses: async refs => refs.filter(r => r.ayah <= 10).map(r => verse(`${r.surah}:${r.ayah}`)),
  hadith: async (ref): Promise<Hadith | null> =>
    ref.number === 1
      ? { collection: ref.collection, collectionName: 'Sahih al-Bukhari', number: 1, arabic: null, text: 'HADITH TEXT', lang: 'en', grades: [], book: 1, section: null }
      : null,
};

function scriptedModel(responses: unknown[]): JsonModel & { prompts: string[] } {
  const prompts: string[] = [];
  const model = (async (prompt: string) => {
    prompts.push(prompt);
    return { value: responses.shift(), model: 'fake' };
  }) as unknown as JsonModel & { prompts: string[] };
  model.prompts = prompts;
  return model;
}

test('ask uses fetched text as evidence and drops hallucinated citations', async () => {
  const model = scriptedModel([
    { quran: ['2:5', '2:500', 'nonsense', '2:5'], hadith: [{ collection: 'bukhari', number: 1 }, { collection: 'bukhari', number: 99 }, { collection: 'fake', number: 1 }] },
    {
      insufficientEvidence: false,
      paragraphs: [
        { text: 'Grounded paragraph', citations: ['Q1', 'H1', 'Q9'] },
        { text: 'Unsupported paragraph', citations: ['X7'] },
      ],
    },
  ]);
  const result = await ask('What about patience?', 'en', fetchers, model);
  assert.deepEqual(result.evidence.map(e => e.id), ['Q1', 'H1']);
  assert.equal(result.evidence[0].text, 'SOURCE TEXT 2:5');
  assert.deepEqual(result.paragraphs, [{ text: 'Grounded paragraph', citations: ['Q1', 'H1'] }]);
  assert.equal(result.insufficientEvidence, false);
  assert.match(model.prompts[1], /SOURCE TEXT 2:5/);
  assert.match(model.prompts[1], /untrusted data/);
});

test('ask reports insufficient evidence without a second model call when nothing is retrieved', async () => {
  const model = scriptedModel([{ quran: ['2:500'], hadith: [] }]);
  const result = await ask('?', 'ta', fetchers, model);
  assert.equal(result.insufficientEvidence, true);
  assert.equal(result.paragraphs.length, 0);
  assert.equal(model.prompts.length, 1);
});

test('sanitizeParagraphs keeps uncited text only when the model flags insufficient evidence', () => {
  const evidence = verseEvidence([verse('1:1')]);
  assert.equal(sanitizeParagraphs([{ text: 'x', citations: [] }], evidence, false).length, 0);
  assert.equal(sanitizeParagraphs([{ text: 'x', citations: [] }], evidence, true).length, 1);
});

test('podcast lines lose stage directions and invalid citations', async () => {
  const evidence = verseEvidence([verse('1:1')]);
  const lines = sanitizeLines(
    [
      { speaker: 'Host', text: '[AUDIO CUE: intro] Welcome', citations: [] },
      { speaker: 'Narrator' as 'Host', text: 'Verse', citations: ['Q1', 'Q2'] },
      { speaker: 'Guest', text: '[pause]', citations: [] },
    ],
    evidence,
  );
  assert.deepEqual(lines, [
    { speaker: 'Host', text: 'Welcome', citations: [] },
    { speaker: 'Host', text: 'Verse', citations: ['Q1'] },
  ]);

  const script = await writePodcast('Patience', 'si', 2, evidence, scriptedModel([{ title: 'Ep', lines }]));
  assert.equal(script.title, 'Ep');
  assert.equal(script.lang, 'si');
  await assert.rejects(writePodcast('x', 'en', 2, [], scriptedModel([])), /No sources/);
});

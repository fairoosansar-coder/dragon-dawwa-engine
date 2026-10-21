import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkEpisodeLines, splitSentences } from '../src/engine/utils/episodeChunks.ts';

test('splitSentences keeps punctuation and drops empty text', () => {
  assert.deepEqual(splitSentences('  One. Two? Three!  '), ['One.', 'Two?', 'Three!']);
  assert.deepEqual(splitSentences('   '), []);
});

test('the first chunk is only the opening speaker, at most three sentences', () => {
  const lines = [
    { speaker: 'Host' as const, text: 'One. Two. Three. Four. Five.' },
    { speaker: 'Guest' as const, text: 'Guest speaks next.' },
  ];
  const chunks = chunkEpisodeLines(lines);
  assert.equal(chunks[0].speaker, 'Host');
  assert.equal(chunks[0].text, 'One. Two. Three.');
  assert.deepEqual(chunks[0].lineIndexes, [0]);
  assert.equal(chunks[1].text, 'Four. Five.');
  assert.equal(chunks[2].speaker, 'Guest');
  assert.equal(chunks[2].text, 'Guest speaks next.');
});

test('up to three short lines from the same speaker stay together', () => {
  const lines = [
    { speaker: 'Host' as const, text: 'Alpha.' },
    { speaker: 'Host' as const, text: 'Beta.' },
    { speaker: 'Host' as const, text: 'Gamma.' },
    { speaker: 'Host' as const, text: 'Delta.' },
    { speaker: 'Guest' as const, text: 'Echo.' },
  ];
  const chunks = chunkEpisodeLines(lines);
  assert.deepEqual(
    chunks.map(chunk => [chunk.speaker, chunk.text, chunk.lineIndexes]),
    [
      ['Host', 'Alpha. Beta. Gamma.', [0, 1, 2]],
      ['Host', 'Delta.', [3]],
      ['Guest', 'Echo.', [4]],
    ],
  );
});

test('a speaker change starts the next chunk even when the first line is short', () => {
  const chunks = chunkEpisodeLines([
    { speaker: 'Host', text: 'Welcome.' },
    { speaker: 'Guest', text: 'Thank you.' },
  ]);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].speaker, 'Host');
  assert.equal(chunks[1].speaker, 'Guest');
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { concatWavClips, readWav, writeWav } from '../src/lib/episodeWav.ts';

function tone(rate: number, samples: number): Uint8Array {
  const pcm = new Uint8Array(samples * 2);
  const view = new DataView(pcm.buffer);
  for (let i = 0; i < samples; i += 1) view.setInt16(i * 2, i % 2 === 0 ? 1000 : -1000, true);
  return writeWav(pcm, rate);
}

describe('episode wav', () => {
  it('joins clips into one wav and keeps the samples', () => {
    const file = concatWavClips([tone(24000, 100), tone(24000, 50)], 0);
    const { pcm, rate } = readWav(file);
    assert.equal(rate, 24000);
    assert.equal(pcm.length, 300);
    assert.equal(file[0], 'R'.charCodeAt(0));
    assert.equal(file[8], 'W'.charCodeAt(0));
  });
});

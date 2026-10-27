import assert from 'node:assert/strict';
import { test } from 'node:test';
import { podcastPrompt } from '../src/server/grounding.ts';
import { getPodcastHostLabel, readPodcastHost, writePodcastHost } from '../src/lib/podcastHost.ts';
import { podcastHostLabel, sanitizePodcastHostName } from '../src/shared/podcastHost.ts';

test('the spoken label uses the saved name and honorific', () => {
  assert.equal(podcastHostLabel('', 'None'), 'Seeker');
  assert.equal(podcastHostLabel('   ', 'Brother'), 'Brother Seeker');
  assert.equal(podcastHostLabel('Feroz', 'Brother'), 'Brother Feroz');
  assert.equal(podcastHostLabel('Amina', 'Sister'), 'Sister Amina');
  assert.equal(podcastHostLabel('Feroz', 'None'), 'Feroz');
  assert.equal(podcastHostLabel('Brother Feroz', 'Brother'), 'Brother Feroz');
  assert.equal(sanitizePodcastHostName(' \n Seeker \n '), 'Seeker');
});

test('getPodcastHostLabel reads local preference and defaults to Seeker', () => {
  const saved = new Map<string, string>();
  const memory = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
    removeItem: (key: string) => {
      saved.delete(key);
    },
    clear: () => saved.clear(),
    key: () => null,
    length: 0,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true });
  saved.clear();
  assert.equal(readPodcastHost().userName, 'Seeker');
  assert.equal(readPodcastHost().honorific, 'None');
  assert.equal(getPodcastHostLabel(), 'Seeker');
  writePodcastHost({ userName: 'Feroz', honorific: 'Brother' });
  assert.equal(getPodcastHostLabel(), 'Brother Feroz');
  writePodcastHost({ userName: ' ', honorific: 'None' });
  assert.equal(getPodcastHostLabel(), 'Seeker');
});

test('the podcast script prompt uses the host name', () => {
  const prompt = podcastPrompt('Patience', 'en', [], 2, 'Sister Maryam');
  assert.match(prompt, /HOST NAME/);
  assert.match(prompt, /Sister Maryam/);
  assert.match(prompt, /warm welcome/i);
  assert.match(prompt, /practical lesson/i);
  assert.match(prompt, /approval sentence stays in the interface/);
  assert.match(prompt, /Do not say "I am a generated host"/);
  assert.match(podcastPrompt('Patience', 'ta', [], 2), /Tamil/);
  assert.match(podcastPrompt('Patience', 'ta', [], 2), /Seeker/);
  assert.match(podcastPrompt('Patience', 'si', [], 2), /Sinhala/);
});

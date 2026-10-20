import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeRefs, isValidRef, parseRefs, refKey } from '../src/shared/refs.ts';
import { minutesInZone, nextPrayer, qiblaBearing } from '../src/shared/spiritual.ts';
import { TOPICS, verseOfTheDay } from '../src/shared/topics.ts';
import { hadithEdition, findCollection } from '../src/shared/sources.ts';
import { pcmToWav, toWavBase64 } from '../src/server/wav.ts';
import { aladhanDate } from '../src/server/prayer.ts';
import { SAMPLE_HADITHS } from '../src/engine/data/sampleHadiths.ts';

test('parseRefs handles single ayahs, ranges and rejects nonsense', () => {
  assert.deepEqual(parseRefs('2:153'), [{ surah: 2, ayah: 153 }]);
  assert.deepEqual(parseRefs(' 96:1-3 ').map(refKey), ['96:1', '96:2', '96:3']);
  assert.deepEqual(parseRefs('115:1'), []);
  assert.deepEqual(parseRefs('2:5-1'), []);
  assert.deepEqual(parseRefs('2:1-200'), []);
  assert.deepEqual(parseRefs('Al-Baqarah 153'), []);
});

test('isValidRef checks against real surah lengths', () => {
  const counts = [7, 286];
  assert.equal(isValidRef({ surah: 2, ayah: 286 }, counts), true);
  assert.equal(isValidRef({ surah: 2, ayah: 287 }, counts), false);
  assert.equal(isValidRef({ surah: 3, ayah: 1 }, counts), false);
});

test('dedupeRefs removes duplicates and caps the list', () => {
  const refs = ['1:1', '1:1', '2:2', '3:3'].flatMap(parseRefs);
  assert.deepEqual(dedupeRefs(refs, refKey, 2).map(refKey), ['1:1', '2:2']);
});

test('every curated theme reference parses', () => {
  for (const topic of TOPICS) for (const ref of topic.refs) assert.ok(parseRefs(ref).length > 0, `${topic.id}: ${ref}`);
  assert.match(verseOfTheDay(new Date(2026, 9, 20)), /^\d+:\d+$/);
});

test('qibla bearing matches known values', () => {
  assert.ok(Math.abs(qiblaBearing(6.9271, 79.8612) - 293) < 2, 'Colombo ≈ 293°');
  assert.ok(Math.abs(qiblaBearing(51.5074, -0.1278) - 119) < 2, 'London ≈ 119°');
});

test('nextPrayer picks the upcoming prayer and wraps to Fajr', () => {
  const timings = { Fajr: '04:47', Dhuhr: '11:55', Asr: '15:16', Maghrib: '17:54', Isha: '19:00' };
  assert.deepEqual(nextPrayer(timings, 12 * 60), { name: 'Asr', minutesUntil: 196, tomorrow: false });
  assert.deepEqual(nextPrayer(timings, 23 * 60), { name: 'Fajr', minutesUntil: 60 + 4 * 60 + 47, tomorrow: true });
});

test('minutesInZone uses the location timezone', () => {
  const date = new Date('2026-10-20T00:30:00Z');
  assert.equal(minutesInZone(date, 'Asia/Colombo'), 6 * 60);
  assert.equal(minutesInZone(date, 'UTC'), 30);
});

test('hadith edition falls back to English when no translation exists', () => {
  assert.deepEqual(hadithEdition(findCollection('bukhari')!, 'ta'), { edition: 'tam-bukhari', lang: 'ta' });
  assert.deepEqual(hadithEdition(findCollection('nawawi')!, 'ta'), { edition: 'eng-nawawi', lang: 'en' });
  assert.deepEqual(hadithEdition(findCollection('muslim')!, 'si'), { edition: 'eng-muslim', lang: 'en' });
});

test('PCM is wrapped in a valid WAV header', () => {
  const wav = pcmToWav(Buffer.alloc(100), 24000);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt32LE(40), 100);
  const b64 = Buffer.from('abc').toString('base64');
  assert.equal(toWavBase64(b64, 'audio/wav'), b64);
  assert.equal(Buffer.from(toWavBase64(b64, 'audio/L16;codec=pcm;rate=16000'), 'base64').readUInt32LE(24), 16000);
});

test('aladhanDate converts ISO dates and rejects impossible ones', () => {
  assert.equal(aladhanDate(undefined), null);
  assert.equal(aladhanDate('2026-10-20'), '20-10-2026');
  assert.equal(aladhanDate('2028-02-29'), '29-02-2028');
  assert.throws(() => aladhanDate('2026-02-30'));
  assert.throws(() => aladhanDate('20-10-2026'));
});

test('staging dossier presets include the actions-by-intentions benchmark', () => {
  const preset = SAMPLE_HADITHS.find(p => p.id === 'actions-by-intentions');
  assert.ok(preset);
  assert.ok(preset.defaultData.agent_6_synthesis.podcast_script.length > 0);
  assert.ok(preset.defaultData.agent_2_isnad.narrator_sequence.length > 0);
});

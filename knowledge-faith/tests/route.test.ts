import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash } from '../src/lib/route.ts';

test('hash aliases keep prayer and staging links working', () => {
  assert.deepEqual(parseHash('#/prayer'), { path: 'spiritual', segments: [] });
  assert.deepEqual(parseHash('#/prayer/'), { path: 'spiritual', segments: [] });
  assert.deepEqual(parseHash('#/screen-16'), { path: 'spiritual', segments: [] });
  assert.deepEqual(parseHash('#/screen-17'), { path: 'hub', segments: ['scholar'] });
  assert.deepEqual(parseHash('#/spiritual/salah/times'), { path: 'spiritual', segments: ['salah', 'times'] });
  assert.deepEqual(parseHash('#/spiritual/zakah/calculator'), { path: 'spiritual', segments: ['zakah', 'calculator'] });
  assert.deepEqual(parseHash('#/quran/study'), { path: 'quran', segments: ['study'] });
  assert.deepEqual(parseHash('#/hadith/research'), { path: 'hadith', segments: ['research'] });
  assert.deepEqual(parseHash('#/studio/roundtable'), { path: 'studio', segments: ['roundtable'] });
  assert.deepEqual(parseHash(''), { path: 'hub', segments: [] });
  assert.deepEqual(parseHash('#/missing'), { path: 'hub', segments: [] });
});

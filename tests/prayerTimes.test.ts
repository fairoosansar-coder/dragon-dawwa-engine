import test from 'node:test';
import assert from 'node:assert/strict';
import { prayerUrl, parsePrayerResponse, prayers } from '../src/ds/prayerTimes.ts';
const fixture = () => ({ code: 200, data: { date: { gregorian: { date: '10-10-2026' } }, meta: { timezone: 'Asia/Colombo' }, timings: Object.fromEntries(prayers.map(p => [p, '05:30 (+0530)'])) } });
test('explicit date, coordinates, method and school survive URL construction', () => {
 const { url, day } = prayerUrl('8.31','80.40','2026-10-10','3','1');
 assert.equal(day, '10-10-2026');
 const u = new URL(url); assert.equal(u.searchParams.get('longitude'), '80.40'); assert.equal(u.searchParams.get('school'), '1');
});
test('invalid and absent coordinates are rejected', () => {
 for (const [lat, lon] of [['','80'],['NaN','80'],['91','0'],['0','181']]) assert.throws(() => prayerUrl(lat,lon,'2026-10-10','3','0'));
});
test('zero coordinates remain valid', () => assert.ok(prayerUrl('0','0','2026-10-10','3','0')));
test('only supported method and Asr selections are accepted', () => {
 assert.throws(() => prayerUrl('0','0','2026-10-10','999','0'));
 assert.throws(() => prayerUrl('0','0','2026-10-10','3','9'));
});
test('provider data is reduced to five times and its time zone', () => {
 const data = parsePrayerResponse(fixture(),'10-10-2026'); assert.equal(data.timings.Fajr,'05:30'); assert.equal(Object.keys(data.timings).length,5); assert.equal(data.timezone,'Asia/Colombo');
});
test('wrong-date responses are not displayed', () => assert.throws(() => parsePrayerResponse(fixture(),'11-10-2026')));
test('invalid or missing times and failed provider responses are rejected', () => {
 const p = fixture(); p.data.timings.Fajr = '25:90'; assert.throws(() => parsePrayerResponse(p,'10-10-2026'));
 assert.throws(() => parsePrayerResponse({ code: 429 },'10-10-2026'));
 assert.throws(() => parsePrayerResponse(null,'10-10-2026'));
});

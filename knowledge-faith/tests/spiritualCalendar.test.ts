import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatedHijri,
  checkFastDate,
  DEFAULT_CALENDAR,
  describeDay,
  describeRange,
  dueReminders,
  hijriFor,
  planReminders,
  suggestMakeupDates,
  todayIn,
  voluntarySuggestions,
  zonedInstant,
  type CalendarPrefs,
} from '../src/shared/spiritual/calendar.ts';

const prefs = (over: Partial<CalendarPrefs> = {}): CalendarPrefs => ({ ...DEFAULT_CALENDAR, ...over });

test('calculated Hijri dates follow the chosen basis and offset, and are labelled provisional', () => {
  assert.deepEqual(calculatedHijri('2026-10-21', 'islamic-umalqura'), { year: 1448, month: 5, day: 10 });
  assert.deepEqual(calculatedHijri('2026-10-21', 'islamic-civil'), { year: 1448, month: 5, day: 9 });
  assert.deepEqual(calculatedHijri('2026-10-21', 'islamic-umalqura', -1), { year: 1448, month: 5, day: 9 });
  assert.equal(hijriFor('2026-10-21', prefs()).status, 'provisional');
});

test('a user-confirmed month start overrides the calculation, including the day before it', () => {
  const confirmed = prefs({ confirmedStarts: { '1448-09': '2027-02-09' }, authority: 'Local committee' });
  assert.deepEqual(describeDay('2027-02-08', prefs()).occasions.includes('ramadan'), true);
  const before = describeDay('2027-02-08', confirmed);
  assert.equal(before.hijri.month, 8);
  assert.equal(before.hijri.day, 30);
  assert.equal(before.status, 'restricted');
  const first = hijriFor('2027-02-09', confirmed);
  assert.deepEqual(first, { date: { year: 1448, month: 9, day: 1 }, status: 'confirmed' });
  assert.equal(hijriFor('2027-03-09', confirmed).date.day, 29);
  assert.equal(hijriFor('2027-03-10', confirmed).status, 'provisional', 'day 30 stays provisional');
});

test('prohibited days override recommendations and are never suggested', () => {
  const eid = describeDay('2027-03-09', prefs());
  assert.equal(eid.status, 'prohibited');
  const tashriqMonday = describeDay('2027-05-17', prefs());
  assert.equal(tashriqMonday.status, 'prohibited');
  assert.ok(tashriqMonday.notes.includes('noteProhibitedOverrides'));
  const whiteTashriq = describeDay('2027-05-19', prefs());
  assert.equal(whiteTashriq.status, 'prohibited');
  const range = describeRange('2027-05-10', 14, prefs());
  const suggested = voluntarySuggestions(range, ['monday', 'thursday', 'white-days', 'arafah', 'dhul-hijjah']);
  assert.ok(suggested.every(d => d.status === 'recommended'));
  assert.ok(!suggested.some(d => ['2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19'].includes(d.iso)));
  assert.ok(suggested.some(d => d.iso === '2027-05-15'));
});

test('overlaps are explained: Ramadan, Friday, Arafah, provisional dates', () => {
  const ramadanMonday = describeDay('2027-02-08', prefs());
  assert.equal(ramadanMonday.status, 'obligatory');
  assert.ok(ramadanMonday.notes.includes('noteRamadanOverrides'));
  const fridayDhulHijjah = describeDay('2027-05-14', prefs());
  assert.equal(fridayDhulHijjah.status, 'recommended');
  assert.ok(fridayDhulHijjah.notes.includes('noteFridayCoincides'));
  const plainFriday = describeDay('2027-02-05', prefs());
  assert.equal(plainFriday.status, 'restricted');
  const arafah = describeDay('2027-05-15', prefs());
  assert.ok(arafah.notes.includes('noteArafahPilgrims'));
  assert.ok(arafah.notes.includes('noteProvisionalDate'));
});

test('make-up planning refuses prohibited days and Ramadan', () => {
  assert.deepEqual(checkFastDate('2027-03-09', prefs()), { ok: false, code: 'prohibited', occasions: ['eid-fitr'] });
  assert.equal(checkFastDate('2027-02-20', prefs()).code, 'ramadan');
  const dates = suggestMakeupDates('2027-03-08', 3, prefs());
  assert.deepEqual(dates, ['2027-03-10', '2027-03-11', '2027-03-12'], '8 March is Ramadan 30 and 9 March is Eid');
  assert.deepEqual(suggestMakeupDates('2027-03-08', 2, prefs(), ['2027-03-10']), ['2027-03-11', '2027-03-12']);
});

test('day boundaries follow the chosen timezone', () => {
  const instant = new Date('2026-10-21T20:30:00Z');
  assert.equal(todayIn('Asia/Colombo', instant), '2026-10-22');
  assert.equal(todayIn('America/New_York', instant), '2026-10-21');
  assert.equal(todayIn('Not/AZone', instant), '2026-10-21');
});

test('zoned instants handle offsets and daylight saving', () => {
  assert.equal(new Date(zonedInstant('2026-10-21', '20:00', 'Asia/Colombo')).toISOString(), '2026-10-21T14:30:00.000Z');
  assert.equal(new Date(zonedInstant('2026-07-01', '20:00', 'Europe/London')).toISOString(), '2026-07-01T19:00:00.000Z');
  assert.equal(new Date(zonedInstant('2026-12-01', '20:00', 'Europe/London')).toISOString(), '2026-12-01T20:00:00.000Z');
});

test('reminders: one per date, disabled means none, recalculated when settings change', () => {
  const reminders = { enabled: true, occasions: ['monday', 'white-days', 'dhul-hijjah', 'arafah'], includeMakeup: true, time: '20:00' };
  const plan = planReminders('2027-05-10', 14, prefs({ timezone: 'Asia/Colombo' }), reminders, ['2027-05-12', '2027-05-17']);
  const keys = plan.map(r => r.key);
  assert.equal(new Set(keys).size, keys.length, 'no duplicate reminders');
  assert.ok(!keys.includes('fast@2027-05-17'), 'no reminder for a prohibited day, even for a make-up fast');
  const monday = plan.find(r => r.forDate === '2027-05-10');
  assert.deepEqual(monday?.occasions, ['dhul-hijjah', 'monday']);
  assert.equal(new Date(monday!.fireAt).toISOString(), '2027-05-09T14:30:00.000Z');
  assert.ok(plan.find(r => r.forDate === '2027-05-12')?.makeup);

  assert.deepEqual(planReminders('2027-05-10', 14, prefs(), { ...reminders, enabled: false }), []);

  const shifted = planReminders('2027-05-10', 14, prefs({ timezone: 'Asia/Colombo', offsetDays: -1 }), reminders);
  assert.ok(shifted.some(r => r.forDate === '2027-05-16' && r.occasions.includes('arafah')), 'Arafah moves with the offset');
  assert.ok(!shifted.some(r => r.forDate === '2027-05-15' && r.occasions.includes('arafah')));

  const london = planReminders('2027-05-10', 1, prefs({ timezone: 'Europe/London' }), reminders);
  assert.equal(new Date(london[0].fireAt).toISOString(), '2027-05-09T19:00:00.000Z');
});

test('due reminders fire once and expire after a day', () => {
  const plan = planReminders('2027-05-10', 3, prefs({ timezone: 'UTC' }), { enabled: true, occasions: ['monday', 'dhul-hijjah'], includeMakeup: false, time: '20:00' });
  const at = Date.parse('2027-05-09T20:05:00Z');
  const due = dueReminders(plan, at, []);
  assert.deepEqual(due.map(r => r.key), ['fast@2027-05-10']);
  assert.deepEqual(dueReminders(plan, at, ['fast@2027-05-10']), []);
  assert.deepEqual(dueReminders(plan, Date.parse('2027-05-11T21:00:00Z'), []).map(r => r.key), ['fast@2027-05-12']);
});

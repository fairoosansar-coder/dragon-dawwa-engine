import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash } from '../src/lib/route.ts';
import { gregorianToHijri, gregorianToJdn, hijriToGregorian, isoDateInZone, parseIsoDate } from '../src/spiritual/hijri.ts';
import { applyPrayerOffsets, shiftClock } from '../src/spiritual/prayerAdjust.ts';
import { editorialLabel, isScholarReviewed, type EditorialMeta } from '../src/spiritual/editorial.ts';
import {
  buildReminders,
  canSchedule,
  civilIsoForIntention,
  evaluateHijriDay,
  isRestrictedHijri,
  resolveIntentionIso,
} from '../src/spiritual/fasting.ts';
import { calculateZakah, formatMinor, parseDecimal, sanitizeZakahSuggestion, type ZakahInput } from '../src/spiritual/zakah.ts';
import { ZAKAH_PROFILE } from '../src/spiritual/zakahProfile.ts';

const base = {
  currency: 'LKR',
  valuationDate: '2026-10-21',
  goldPricePerGram: '80',
  silverPricePerGram: '1',
  priceEnteredOn: '2026-10-20',
  hawl: 'complete' as const,
  liabilities: [],
};

function calc(partial: Partial<ZakahInput> & Pick<ZakahInput, 'assets'>): ReturnType<typeof calculateZakah> {
  return calculateZakah({ ...base, ...partial });
}

test('hash aliases keep prayer and staging links working', () => {
  const empty = new URLSearchParams();
  assert.deepEqual(parseHash('#/prayer'), { path: 'spiritual', segments: [], params: empty });
  assert.deepEqual(parseHash('#/prayer/'), { path: 'spiritual', segments: [], params: empty });
  assert.deepEqual(parseHash('#/screen-16'), { path: 'spiritual', segments: [], params: empty });
  assert.deepEqual(parseHash('#/screen-17'), { path: 'hub', segments: ['scholar'], params: empty });
  assert.deepEqual(parseHash('#/spiritual/salah/times'), { path: 'spiritual', segments: ['salah', 'times'], params: empty });
  assert.deepEqual(parseHash('#/spiritual/zakah/calculator'), { path: 'spiritual', segments: ['zakah', 'calculator'], params: empty });
  assert.deepEqual(parseHash('#/quran/study'), { path: 'quran', segments: ['study'], params: empty });
  assert.deepEqual(parseHash('#/hadith/research'), { path: 'hadith', segments: ['research'], params: empty });
  assert.deepEqual(parseHash('#/studio/roundtable'), { path: 'studio', segments: ['roundtable'], params: empty });
  assert.deepEqual(parseHash(''), { path: 'hub', segments: [], params: empty });
  assert.deepEqual(parseHash('#/missing'), { path: 'hub', segments: [], params: empty });
  assert.equal(parseHash('#/hadith/research?job=abc&fwd=1').params.get('job'), 'abc');
  assert.equal(parseHash('#/hadith/research?job=abc&fwd=1').params.get('fwd'), '1');
});

test('tabular Hijri round-trips and stays distinct from a sighting claim', () => {
  assert.deepEqual(hijriToGregorian({ year: 1, month: 1, day: 1 }), { year: 622, month: 7, day: 19 });
  assert.deepEqual(gregorianToHijri({ year: 2000, month: 1, day: 1 }), { year: 1420, month: 9, day: 24 });
  assert.equal(gregorianToJdn(2000, 1, 1), 2451545);
  const day = gregorianToHijri({ year: 2026, month: 10, day: 21 });
  assert.deepEqual(hijriToGregorian(day), { year: 2026, month: 10, day: 21 });
  assert.equal(parseIsoDate('2026-02-31'), null);
  assert.equal(isoDateInZone(new Date('2026-10-20T00:30:00Z'), 'Asia/Colombo'), '2026-10-20');
  assert.equal(isoDateInZone(new Date('2026-10-20T00:30:00Z'), 'UTC'), '2026-10-20');
  assert.equal(isoDateInZone(new Date('2026-10-20T18:30:00Z'), 'Asia/Colombo'), '2026-10-21');
});

test('local prayer adjustments wrap at midnight and do not change untouched times', () => {
  assert.equal(shiftClock('23:50', 20), '00:10');
  assert.equal(shiftClock('00:05', -10), '23:55');
  assert.equal(shiftClock('05:00', 500), '08:00');
  const next = applyPrayerOffsets(
    { Fajr: '04:47', Sunrise: '06:00', Dhuhr: '12:05', Asr: '15:20', Maghrib: '18:11', Isha: '19:25' },
    { Fajr: 2, Asr: -3 },
  );
  assert.equal(next.Fajr, '04:49');
  assert.equal(next.Asr, '15:17');
  assert.equal(next.Dhuhr, '12:05');
});

test('scholar-reviewed requires a recorded religious review', () => {
  const meta: EditorialMeta = {
    author: 'Dragon Dawwa editorial',
    updated: '2026-10-21',
    publicationState: 'published',
    reviews: [],
    translationEdition: null,
    languageReview: 'pending',
    interpretiveTradition: null,
  };
  assert.equal(isScholarReviewed(meta), false);
  assert.equal(editorialLabel(meta), 'not-reviewed');
  const reviewed: EditorialMeta = {
    ...meta,
    reviews: [{ stage: 'religious_review', reviewer: 'A reviewer', role: 'teacher', date: '2026-10-01' }],
  };
  assert.equal(isScholarReviewed(reviewed), true);
  assert.equal(isScholarReviewed({ ...reviewed, publicationState: 'draft' }), false);
  assert.equal(isScholarReviewed({ ...reviewed, publicationState: 'withdrawn' }), false);
});

test('fasting planner blocks restricted days, explains overlaps, and dedupes reminders', () => {
  const fitr = { year: 1446, month: 10, day: 1 };
  assert.equal(isRestrictedHijri(fitr), true);
  assert.equal(canSchedule(fitr, hijriToGregorian(fitr)).ok, false);
  const tashreeq = { year: 1446, month: 12, day: 13 };
  const tashreeqDay = evaluateHijriDay(tashreeq, hijriToGregorian(tashreeq));
  assert.equal(tashreeqDay.blocksVoluntaryFast, true);
  assert.ok(tashreeqDay.overridden.includes('white-days'));
  assert.ok(tashreeqDay.notes.includes('white-and-tashreeq'));
  const ashura = { year: 1447, month: 1, day: 10 };
  assert.equal(isRestrictedHijri(ashura), false);
  assert.ok(evaluateHijriDay(ashura, hijriToGregorian(ashura)).occasions.some(item => item.id === 'ashura'));

  const mondayEid = { year: 1446, month: 10, day: 1 };
  let found = false;
  for (let year = 1440; year < 1460 && !found; year++) {
    const hijri = { year, month: 10, day: 1 };
    const day = evaluateHijriDay(hijri, hijriToGregorian(hijri));
    if (day.occasions.some(item => item.id === 'monday-thursday') && day.blocksVoluntaryFast) found = true;
  }
  assert.equal(found, true);
  assert.equal(mondayEid.day, 1);

  const hijri = { year: 1446, month: 9, day: 2 };
  const iso = civilIsoForIntention(hijri, 0);
  const shifted = civilIsoForIntention(hijri, 1);
  assert.notEqual(iso, shifted);
  assert.equal(resolveIntentionIso(hijri, 'tabular', 1, null), iso);
  assert.equal(resolveIntentionIso(hijri, 'aladhan', 0, new Map()), null);
  const fires = buildReminders(
    [
      { id: 'voluntary:1446-9-2', kind: 'voluntary', hijri, iso: shifted, blocked: false },
      { id: 'voluntary:1446-9-2', kind: 'voluntary', hijri, iso: shifted, blocked: false },
      { id: 'makeup:1446-9-3', kind: 'makeup', hijri: { year: 1446, month: 9, day: 3 }, iso: shifted, blocked: false },
      { id: 'voluntary:1446-10-1', kind: 'voluntary', hijri: fitr, iso: '2025-03-31', blocked: true },
    ],
    true,
  );
  assert.deepEqual(fires, [{ iso: shifted, ids: ['voluntary:1446-9-2', 'makeup:1446-9-3'] }]);
  assert.deepEqual(buildReminders(fires.flatMap(() => []), false), []);
  assert.deepEqual(buildReminders([{ id: 'a', kind: 'voluntary', hijri, iso, blocked: false }], false), []);
});

test('zakah profile is versioned, unreviewed, and reproducible', () => {
  assert.equal(ZAKAH_PROFILE.version, '1.0.0');
  assert.equal(ZAKAH_PROFILE.scholarReviewed, false);
  const input: ZakahInput = {
    ...base,
    assets: [{ id: 'cash', category: 'cash', dedupeKey: 'wallet', amount: '1000' }],
  };
  const first = calculateZakah(input);
  const second = calculateZakah(input);
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.profileVersion, '1.0.0');
  assert.equal(first.scholarReviewed, false);
  assert.equal(first.educationalPreview, true);
  assert.equal(first.nisabMinor, '595.0000');
  assert.equal(first.exactDueMinor, '25.0000');
  assert.equal(first.dueMinor, '25.0000');
});

test('zakah thresholds, liabilities, metals, fx, stale prices, and duplicates', () => {
  const below = calc({ assets: [{ id: 'a', category: 'cash', dedupeKey: 'a', amount: '594.99' }] });
  assert.equal(below.ok && below.dueMinor, '0.0000');
  const at = calc({ assets: [{ id: 'a', category: 'cash', dedupeKey: 'a', amount: '595' }] });
  assert.equal(at.ok && at.exactDueMinor, '14.8750');
  assert.equal(at.ok && at.dueMinor, '14.8800');
  const tiny = calc({ assets: [{ id: 'a', category: 'cash', dedupeKey: 'a', amount: '10' }] });
  assert.equal(tiny.ok && tiny.dueMinor, '0.0000');

  const debt = calc({
    assets: [{ id: 'a', category: 'bank', dedupeKey: 'bank', amount: '2000' }],
    liabilities: [{ id: 'l', dedupeKey: 'loan', amount: '500' }],
  });
  assert.equal(debt.ok && debt.netMinor, '1500.0000');
  assert.equal(debt.ok && debt.dueMinor, '37.5000');
  const wiped = calc({
    assets: [{ id: 'a', category: 'cash', dedupeKey: 'cash', amount: '2000' }],
    liabilities: [{ id: 'l', dedupeKey: 'loan', amount: '3000' }],
  });
  assert.equal(wiped.ok && wiped.netMinor, '0.0000');
  assert.equal(wiped.ok && wiped.dueMinor, '0.0000');

  const gold = calc({
    assets: [{ id: 'g', category: 'gold', dedupeKey: 'gold', weight: '10', weightUnit: 'g', purityMode: 'karat', purity: '24' }],
  });
  assert.equal(gold.ok && gold.included[0]?.minor, '800.0000');
  assert.equal(gold.ok && gold.dueMinor, '20.0000');
  const karat = calc({
    assets: [{ id: 'g', category: 'gold', dedupeKey: 'gold', weight: '10', weightUnit: 'g', purityMode: 'karat', purity: '22' }],
  });
  assert.equal(karat.ok && karat.included[0]?.minor, '733.3600');
  assert.equal(karat.ok && karat.dueMinor, '18.3300');
  const fine = calc({
    assets: [{ id: 'g', category: 'gold', dedupeKey: 'gold', weight: '10', weightUnit: 'g', purityMode: 'fineness', purity: '916' }],
  });
  assert.equal(fine.ok && fine.included[0]?.minor, '732.8000');
  const ounce = calc({
    assets: [{ id: 'g', category: 'gold', dedupeKey: 'gold', weight: '1', weightUnit: 'oz', purityMode: 'karat', purity: '24' }],
  });
  assert.equal(ounce.ok && ounce.included[0]?.minor, '2488.2400');

  const fx = calc({
    assets: [{ id: 'u', category: 'cash', dedupeKey: 'usd', amount: '10', currency: 'USD', manualFx: '300' }],
  });
  assert.equal(fx.ok && fx.included[0]?.minor, '3000.0000');
  const noFx = calc({
    assets: [{ id: 'u', category: 'cash', dedupeKey: 'usd', amount: '10', currency: 'USD' }],
  });
  assert.equal(noFx.ok && noFx.excluded[0]?.reason, 'missing_fx');
  assert.equal(noFx.ok && noFx.dueMinor, null);

  const specialist = calc({
    assets: [
      { id: 'c', category: 'cash', dedupeKey: 'cash', amount: '1000' },
      { id: 'j', category: 'personal_jewellery', dedupeKey: 'ring', amount: '5000' },
      { id: 'f', category: 'zakat_al_fitr', dedupeKey: 'fitr', amount: '10' },
    ],
  });
  assert.equal(specialist.ok && specialist.included.length, 1);
  assert.deepEqual(
    specialist.ok && specialist.excluded.map(item => item.reason).sort(),
    ['fitr_separate', 'specialist_review'],
  );

  const stale = calc({
    priceEnteredOn: '2026-01-01',
    assets: [{ id: 'a', category: 'cash', dedupeKey: 'a', amount: '1000' }],
  });
  assert.equal(stale.ok && stale.stale, true);
  assert.equal(stale.ok && stale.dueMinor, null);
  assert.equal(stale.ok && stale.unresolved.includes('stale_rate'), true);
  const accepted = calc({
    priceEnteredOn: '2026-01-01',
    acceptStale: true,
    assets: [{ id: 'a', category: 'cash', dedupeKey: 'a', amount: '1000' }],
  });
  assert.equal(accepted.ok && accepted.dueMinor, '25.0000');

  const hawl = calc({
    hawl: 'unknown',
    assets: [{ id: 'a', category: 'cash', dedupeKey: 'a', amount: '1000' }],
  });
  assert.equal(hawl.ok && hawl.dueMinor, null);
  assert.equal(hawl.ok && hawl.unresolved.includes('ownership_period'), true);

  const duplicate = calc({
    assets: [
      { id: 'a', category: 'cash', dedupeKey: 'same', amount: '1000' },
      { id: 'b', category: 'bank', dedupeKey: 'same', amount: '1000' },
    ],
  });
  assert.equal(duplicate.ok, false);
  const invalid = calc({ assets: [{ id: 'a', category: 'cash', dedupeKey: 'a', amount: '-5' }] });
  assert.equal(invalid.ok && invalid.excluded[0]?.reason, 'invalid_amount');
  const missingPrice = calc({
    goldPricePerGram: undefined,
    silverPricePerGram: undefined,
    assets: [{ id: 'a', category: 'cash', dedupeKey: 'a', amount: '1000' }],
  });
  assert.equal(missingPrice.ok && missingPrice.dueMinor, null);
  assert.equal(missingPrice.ok && missingPrice.unresolved.includes('nisab_prices_required'), true);
  assert.equal(formatMinor(parseDecimal('1.5') ?? 0n), '1.5000');
});

test('zakah suggestions cannot smuggle amounts or unknown rules', () => {
  const clean = sanitizeZakahSuggestion({
    categories: ['gold', 'trading_inventory', 'cryptocurrency', 'zakat_al_fitr', 'invented'],
    questions: ['What is the weight in grams?', 'You owe 5000.'],
    amount: 5000,
    due: 125,
  });
  assert.deepEqual(clean.categories, ['gold', 'trading_inventory']);
  assert.deepEqual(clean.specialist, ['cryptocurrency', 'zakat_al_fitr']);
  assert.equal(clean.strippedAmounts, true);
  assert.equal(clean.questions.some(question => /\d/.test(question)), false);
});

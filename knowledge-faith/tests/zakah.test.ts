import test from 'node:test';
import assert from 'node:assert/strict';
import { add, div, mul, parseDec, round, toFixed, toPlain } from '../src/shared/spiritual/decimal.ts';
import { calculateZakah, findProfile, ZAKAH_PROFILES, zakatAlFitr, type ZakahInput } from '../src/shared/spiritual/zakah.ts';

const AT = '2026-10-21T08:00:00Z';
const rate = (value: string, extra: Partial<{ karat: number; asOf: string }> = {}) => ({ value, asOf: '2026-10-21T06:00:00Z', source: 'manual', ...extra });

function input(over: Partial<ZakahInput>): ZakahInput {
  return {
    profileId: 'nisab-silver',
    profileVersion: '1.0.0',
    currency: 'LKR',
    valuationDate: '2026-10-21',
    rates: { silver: rate('300'), gold: rate('24000') },
    assets: [],
    liabilities: [],
    hawl: 'yes',
    ...over,
  };
}

test('decimal arithmetic is exact and rejects ambiguous input', () => {
  assert.equal(toPlain(add(parseDec('0.1')!, parseDec('0.2')!)), '0.3');
  assert.equal(toFixed(parseDec('1,234,567.5')!, 2), '1234567.50');
  for (const bad of ['-5', '1e5', 'abc', '1.2.3', '1,23', '12,3456', '', ' ', '١٢']) assert.equal(parseDec(bad), null, bad);
  assert.equal(toFixed(round(parseDec('2.505')!, 2)), '2.51');
  assert.equal(toFixed(round(parseDec('2.5049')!, 2)), '2.50');
  assert.equal(toFixed(div(parseDec('1')!, parseDec('3')!, 6)), '0.333333');
  assert.throws(() => div(parseDec('1')!, parseDec('0')!, 2));
  assert.equal(toPlain(mul(parseDec('64')!, parseDec('0.025')!)), '1.6');
});

test('below nisab: nothing due', () => {
  const r = calculateZakah(input({ assets: [{ id: 'a', category: 'cash', amount: '100000' }] }), AT);
  assert.equal(r.ok, true);
  assert.equal(r.nisab?.threshold, '178500.00');
  assert.equal(r.nisab?.met, false);
  assert.equal(r.status, 'below-nisab');
  assert.equal(r.zakahDue, '0.00');
});

test('exactly at nisab counts as reaching it', () => {
  const r = calculateZakah(input({ assets: [{ id: 'a', category: 'bank', amount: '178,500' }] }), AT);
  assert.equal(r.nisab?.met, true);
  assert.equal(r.status, 'due');
  assert.equal(r.zakahDue, '4462.50');
});

test('above nisab with gold by weight, purity, and debts due now (gold profile)', () => {
  const r = calculateZakah(
    input({
      profileId: 'nisab-gold',
      assets: [
        { id: 'c', category: 'cash', amount: '1500000' },
        { id: 'g', category: 'gold', weight: '8', unit: 'pavan', karat: 22 },
      ],
      liabilities: [{ id: 'd', category: 'debts-due-now', amount: '100000' }],
    }),
    AT,
  );
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.nisab?.threshold, '2040000.00');
  assert.equal(r.included.find(l => l.entryId === 'g')?.value, '1408000.00');
  assert.equal(r.totals.assets, '2908000.00');
  assert.equal(r.totals.liabilities, '100000.00');
  assert.equal(r.totals.net, '2808000.00');
  assert.equal(r.zakahDue, '70200.00');
  assert.equal(r.rounding, 'half-up:2');
  assert.deepEqual(r.profile, { id: 'nisab-gold', version: '1.0.0', nameKey: 'zkProfileGold', review: { status: 'pending' } });
  assert.ok(r.warnings.some(w => w.code === 'profile-unreviewed'));
});

test('a metal price quoted for 22 karat is normalised to pure metal', () => {
  const pure = calculateZakah(input({ assets: [{ id: 'g', category: 'gold', weight: '10', unit: 'g', karat: 22 }] }), AT);
  const quoted22 = calculateZakah(
    input({ rates: { silver: rate('300'), gold: rate('22000', { karat: 22 }) }, assets: [{ id: 'g', category: 'gold', weight: '10', unit: 'g', karat: 22 }] }),
    AT,
  );
  assert.equal(pure.included[0].value, '220000.00');
  assert.equal(quoted22.included[0].value, '220000.00');
});

test('weight units convert exactly', () => {
  const r = calculateZakah(
    input({
      assets: [
        { id: 'k', category: 'silver', weight: '1', unit: 'kg' },
        { id: 't', category: 'silver', weight: '1', unit: 'tola', label: 'tola bar' },
        { id: 'o', category: 'silver', weight: '1', unit: 'troy-oz', label: 'coin' },
      ],
    }),
    AT,
  );
  assert.deepEqual(
    r.included.map(l => l.value),
    ['300000.00', '3499.14', '9331.04'],
  );
});

test('foreign currency uses the stated exchange rate and fails clearly without one', () => {
  const ok = calculateZakah(
    input({ rates: { silver: rate('300'), fx: { USD: rate('300') } }, assets: [{ id: 'u', category: 'bank', amount: '1000', currency: 'USD' }] }),
    AT,
  );
  assert.equal(ok.included[0].value, '300000.00');
  assert.equal(ok.zakahDue, '7500.00');
  const missing = calculateZakah(input({ assets: [{ id: 'u', category: 'bank', amount: '1000', currency: 'USD' }] }), AT);
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some(e => e.code === 'fx-missing'));
  assert.equal(missing.zakahDue, '0');
});

test('hawl not complete or unsure: nothing due now, conditional amount shown', () => {
  const assets = [{ id: 'a', category: 'cash' as const, amount: '200000' }];
  const no = calculateZakah(input({ assets, hawl: 'no' }), AT);
  assert.equal(no.status, 'hawl-incomplete');
  assert.equal(no.zakahDue, '0.00');
  assert.equal(no.conditionalAmount, '5000.00');
  const unsure = calculateZakah(input({ assets, hawl: 'unsure' }), AT);
  assert.equal(unsure.status, 'hawl-unresolved');
  assert.ok(unsure.unresolved.some(u => u.code === 'hawl-unconfirmed'));
});

test('liabilities: long-term debt is not deducted, and net never goes negative', () => {
  const r = calculateZakah(
    input({
      assets: [{ id: 'a', category: 'cash', amount: '200000' }],
      liabilities: [
        { id: 'm', category: 'long-term-debt', amount: '5000000' },
        { id: 'b', category: 'bills-due', amount: '300000' },
      ],
    }),
    AT,
  );
  assert.equal(r.liabilitiesNotApplied[0].reason, 'zkReasonLiabilityReview');
  assert.ok(r.unresolved.some(u => u.code === 'liability-needs-review'));
  assert.equal(r.totals.net, '0.00');
  assert.equal(r.status, 'below-nisab');
});

test('categories needing specialist review are excluded with reasons, never auto-treated', () => {
  const r = calculateZakah(
    input({
      assets: [
        { id: 'a', category: 'cash', amount: '200000' },
        { id: 'j', category: 'personal-jewellery', weight: '50', unit: 'g', karat: 22 },
        { id: 's', category: 'shares', amount: '900000' },
        { id: 'p', category: 'pension', amount: '900000' },
        { id: 'x', category: 'crypto', amount: '900000' },
        { id: 'h', category: 'personal-property', amount: '900000' },
      ],
    }),
    AT,
  );
  assert.equal(r.totals.assets, '200000.00');
  assert.deepEqual(
    r.excluded.map(e => [e.entryId, e.reason]),
    [
      ['j', 'zkReasonSpecialist'],
      ['s', 'zkReasonSpecialist'],
      ['p', 'zkReasonSpecialist'],
      ['x', 'zkReasonSpecialist'],
      ['h', 'zkReasonPersonalUse'],
    ],
  );
  assert.equal(r.unresolved.filter(u => u.code === 'category-needs-review').length, 4);
});

test('the same holding entered twice is not double-counted unless confirmed distinct', () => {
  const twice = calculateZakah(
    input({
      assets: [
        { id: 'a', category: 'bank', amount: '200000', label: 'Savings account' },
        { id: 'b', category: 'bank', amount: '200000', label: ' savings  ACCOUNT ' },
      ],
    }),
    AT,
  );
  assert.equal(twice.totals.assets, '200000.00');
  assert.equal(twice.excluded[0].reason, 'zkReasonDuplicate');
  assert.ok(twice.warnings.some(w => w.code === 'possible-duplicate'));
  const confirmed = calculateZakah(
    input({
      assets: [
        { id: 'a', category: 'bank', amount: '200000', label: 'Savings account' },
        { id: 'b', category: 'bank', amount: '200000', label: 'Savings account', distinctConfirmed: true },
      ],
    }),
    AT,
  );
  assert.equal(confirmed.totals.assets, '400000.00');
});

test('currency precision and half-up rounding of the final amount', () => {
  const kwd = calculateZakah(input({ currency: 'KWD', rates: { silver: rate('0.25') }, assets: [{ id: 'a', category: 'cash', amount: '1234.567' }] }), AT);
  assert.equal(kwd.nisab?.threshold, '148.750');
  assert.equal(kwd.zakahDue, '30.864');
  const jpy = calculateZakah(input({ currency: 'JPY', rates: { silver: rate('10') }, assets: [{ id: 'a', category: 'cash', amount: '1000001' }] }), AT);
  assert.equal(jpy.zakahDue, '25000');
  const tie = calculateZakah(input({ rates: { silver: rate('0.1') }, assets: [{ id: 'a', category: 'cash', amount: '100.20' }] }), AT);
  assert.equal(tie.zakahDue, '2.51');
});

test('invalid input is reported, never guessed', () => {
  const r = calculateZakah(
    input({
      assets: [
        { id: 'a', category: 'cash', amount: '-5' },
        { id: 'b', category: 'gold', weight: '0', unit: 'g' },
        { id: 'c', category: 'silver', weight: '5', unit: 'stone' as never },
        { id: 'd', category: 'gold', weight: '5', karat: 25 },
      ],
    }),
    AT,
  );
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.errors.map(e => e.code),
    ['amount-invalid', 'weight-invalid', 'unit-invalid', 'karat-invalid'],
  );
  assert.equal(calculateZakah(input({ currency: 'XYZ' }), AT).errors[0].code, 'currency-unsupported');
  assert.equal(calculateZakah(input({ valuationDate: '2026-02-30' }), AT).errors[0].code, 'valuation-date-invalid');
  assert.equal(calculateZakah(input({ hawl: 'maybe' as never }), AT).errors[0].code, 'hawl-missing');
  assert.equal(calculateZakah(input({ rates: {} }), AT).errors[0].code, 'nisab-rate-missing');
  assert.equal(
    calculateZakah(input({ assets: [{ id: 'a', category: 'cash', amount: '1' }, { id: 'a', category: 'cash', amount: '2' }] }), AT).errors[0].code,
    'entry-id-duplicate',
  );
});

test('stale or future-dated rates are flagged', () => {
  const stale = calculateZakah(input({ rates: { silver: rate('300', { asOf: '2026-10-17T00:00:00Z' }) } }), AT);
  assert.ok(stale.warnings.some(w => w.code === 'rate-stale' && w.params?.rate === 'silver'));
  const future = calculateZakah(input({ rates: { silver: rate('300', { asOf: '2026-11-01T00:00:00Z' }) } }), AT);
  assert.ok(future.warnings.some(w => w.code === 'rate-after-valuation'));
  const bad = calculateZakah(input({ rates: { silver: rate('300', { asOf: 'yesterday' }) } }), AT);
  assert.ok(bad.warnings.some(w => w.code === 'rate-date-invalid'));
});

test('profiles are versioned, frozen and reproducible', () => {
  assert.equal(calculateZakah(input({ profileVersion: '9.9.9' }), AT).errors[0].code, 'profile-unknown');
  assert.equal(findProfile('nisab-silver', '1.0.0')?.rate, '0.025');
  assert.throws(() => {
    (ZAKAH_PROFILES[0] as { rate: string }).rate = '0.03';
  });
  assert.throws(() => {
    (ZAKAH_PROFILES[0].assets as Record<string, string>).shares = 'money';
  });
  const i = input({ assets: [{ id: 'a', category: 'cash', amount: '987654.32' }] });
  assert.deepEqual(calculateZakah(i, AT), calculateZakah(structuredClone(i), AT));
  for (const p of ZAKAH_PROFILES) {
    assert.equal(p.review.status, 'pending', 'no profile may claim a review that was not recorded');
    for (const c of ['personal-jewellery', 'shares', 'pension', 'crypto', 'agriculture', 'livestock', 'rental-property', 'business-fixed-assets'] as const) {
      assert.equal(p.assets[c], 'specialist-review', `${p.id} ${c}`);
    }
  }
});

test('Zakat al-Fitr is calculated separately from wealth zakah', () => {
  assert.deepEqual(zakatAlFitr(5, '450', 'LKR'), { total: '2250.00' });
  assert.deepEqual(zakatAlFitr(0, '450', 'LKR'), { error: 'people-invalid' });
  assert.deepEqual(zakatAlFitr(2, 'x', 'LKR'), { error: 'amount-invalid' });
});

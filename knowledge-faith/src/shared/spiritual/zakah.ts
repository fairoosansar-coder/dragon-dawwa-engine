import {
  add,
  cmp,
  currencyPrecision,
  dec,
  div,
  isZero,
  max,
  mul,
  parseDec,
  round,
  sub,
  toFixed,
  toPlain,
  ZERO,
  type Dec,
} from './decimal.ts';
import { h, q, type SourceRef } from './sourceRefs.ts';

/**
 * Deterministic wealth-zakah engine. Every rule it applies comes from a versioned, frozen rule profile;
 * the engine never guesses a rule, and anything a profile does not cover is excluded with a reason.
 */
export const ZAKAH_ENGINE_VERSION = '1.0.0';

export type AssetCategory =
  | 'cash'
  | 'bank'
  | 'gold'
  | 'silver'
  | 'trade-inventory'
  | 'receivables'
  | 'receivables-doubtful'
  | 'personal-jewellery'
  | 'shares'
  | 'pension'
  | 'crypto'
  | 'agriculture'
  | 'livestock'
  | 'rental-property'
  | 'personal-property'
  | 'business-fixed-assets';

export type LiabilityCategory = 'debts-due-now' | 'bills-due' | 'long-term-debt';

export type AssetTreatment = 'money' | 'metal' | 'not-zakatable-in-profile' | 'specialist-review';
export type LiabilityTreatment = 'deduct' | 'specialist-review';

export const ASSET_CATEGORIES: AssetCategory[] = [
  'cash',
  'bank',
  'gold',
  'silver',
  'trade-inventory',
  'receivables',
  'receivables-doubtful',
  'personal-jewellery',
  'shares',
  'pension',
  'crypto',
  'agriculture',
  'livestock',
  'rental-property',
  'personal-property',
  'business-fixed-assets',
];

export const LIABILITY_CATEGORIES: LiabilityCategory[] = ['debts-due-now', 'bills-due', 'long-term-debt'];

export type WeightUnit = 'g' | 'kg' | 'troy-oz' | 'tola' | 'pavan';

/** Grams per unit. The pavan (sovereign) is the 8 g jeweller's unit used in Sri Lanka and South India. */
export const WEIGHT_UNITS: Record<WeightUnit, string> = {
  g: '1',
  kg: '1000',
  'troy-oz': '31.1034768',
  tola: '11.6638038',
  pavan: '8',
};

export type ReviewStatus = 'pending' | 'approved';

export interface ZakahRuleProfile {
  id: string;
  version: string;
  /** i18n key of the method name shown to the user. */
  nameKey: string;
  nisab: { basis: 'gold' | 'silver'; goldGrams: string; silverGrams: string };
  /** Applied to net zakatable wealth once nisab and the ownership year are satisfied. */
  rate: string;
  calendar: 'lunar';
  maxRateAgeHours: number;
  rounding: { mode: 'half-up'; at: 'final' };
  assets: Record<AssetCategory, AssetTreatment>;
  liabilities: Record<LiabilityCategory, LiabilityTreatment>;
  /** i18n keys describing each assumption the profile makes. */
  assumptions: string[];
  sources: SourceRef[];
  review: { status: ReviewStatus; reviewer?: string; role?: string; date?: string; notes?: string };
}

const COMMON_ASSETS: Record<AssetCategory, AssetTreatment> = {
  cash: 'money',
  bank: 'money',
  gold: 'metal',
  silver: 'metal',
  'trade-inventory': 'money',
  receivables: 'money',
  'receivables-doubtful': 'specialist-review',
  'personal-jewellery': 'specialist-review',
  shares: 'specialist-review',
  pension: 'specialist-review',
  crypto: 'specialist-review',
  agriculture: 'specialist-review',
  livestock: 'specialist-review',
  'rental-property': 'specialist-review',
  'personal-property': 'not-zakatable-in-profile',
  'business-fixed-assets': 'specialist-review',
};

const COMMON_LIABILITIES: Record<LiabilityCategory, LiabilityTreatment> = {
  'debts-due-now': 'deduct',
  'bills-due': 'deduct',
  'long-term-debt': 'specialist-review',
};

const COMMON_SOURCES: SourceRef[] = [
  q('9:60'),
  q('9:103'),
  q('2:267'),
  h('bukhari', 1447),
  h('abudawud', 1573),
  h('tirmidhi', 631),
  h('bukhari', 1395),
];

const COMMON_ASSUMPTIONS = [
  'zkAssumeLunar',
  'zkAssumeAnniversary',
  'zkAssumeMetricNisab',
  'zkAssumeInventoryMarket',
  'zkAssumeReceivablesStrong',
  'zkAssumeLiabilitiesDue',
  'zkAssumeMetalsInvestment',
];

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) freeze(v);
    Object.freeze(value);
  }
  return value;
}

/**
 * Both profiles reproduce the parameters most widely published by contemporary zakah bodies.
 * Neither has a recorded scholarly review yet, which the calculator states on every result.
 */
export const ZAKAH_PROFILES: readonly ZakahRuleProfile[] = freeze([
  {
    id: 'nisab-gold',
    version: '1.0.0',
    nameKey: 'zkProfileGold',
    nisab: { basis: 'gold', goldGrams: '85', silverGrams: '595' },
    rate: '0.025',
    calendar: 'lunar',
    maxRateAgeHours: 24,
    rounding: { mode: 'half-up', at: 'final' },
    assets: COMMON_ASSETS,
    liabilities: COMMON_LIABILITIES,
    assumptions: COMMON_ASSUMPTIONS,
    sources: COMMON_SOURCES,
    review: { status: 'pending' },
  },
  {
    id: 'nisab-silver',
    version: '1.0.0',
    nameKey: 'zkProfileSilver',
    nisab: { basis: 'silver', goldGrams: '85', silverGrams: '595' },
    rate: '0.025',
    calendar: 'lunar',
    maxRateAgeHours: 24,
    rounding: { mode: 'half-up', at: 'final' },
    assets: COMMON_ASSETS,
    liabilities: COMMON_LIABILITIES,
    assumptions: COMMON_ASSUMPTIONS,
    sources: COMMON_SOURCES,
    review: { status: 'pending' },
  },
]);

export function findProfile(id: string, version?: string): ZakahRuleProfile | undefined {
  const matches = ZAKAH_PROFILES.filter(p => p.id === id && (!version || p.version === version));
  return matches[matches.length - 1];
}

export interface RateInput {
  /** Price or exchange rate expressed in the calculation currency. */
  value: string;
  asOf: string;
  /** "manual" for user-entered values, otherwise the provider name. */
  source: string;
  /** For metal prices: the karat the quoted price refers to (24 = pure). */
  karat?: number;
}

export interface AssetEntry {
  id: string;
  category: AssetCategory;
  label?: string;
  /** Money categories. */
  amount?: string;
  /** Currency of `amount`; defaults to the calculation currency. */
  currency?: string;
  /** Metal categories. */
  weight?: string;
  unit?: WeightUnit;
  karat?: number;
  /** The user confirmed this entry is not the same holding as another entry with the same label. */
  distinctConfirmed?: boolean;
}

export interface LiabilityEntry {
  id: string;
  category: LiabilityCategory;
  label?: string;
  amount: string;
  currency?: string;
}

export type HawlAnswer = 'yes' | 'no' | 'unsure';

export interface ZakahInput {
  profileId: string;
  profileVersion: string;
  currency: string;
  /** YYYY-MM-DD: the user's zakah date. */
  valuationDate: string;
  rates: { gold?: RateInput; silver?: RateInput; fx?: Record<string, RateInput> };
  assets: AssetEntry[];
  liabilities: LiabilityEntry[];
  hawl: HawlAnswer;
}

export interface Issue {
  code: string;
  entryId?: string;
  params?: Record<string, string>;
}

export interface ResultLine {
  entryId: string;
  category: AssetCategory | LiabilityCategory;
  label: string;
  value?: string;
  /** How the value was obtained, e.g. "8 pavan × 22/24 × 25000.00 per g". */
  basis?: string;
  reason?: string;
}

export type DueStatus = 'due' | 'below-nisab' | 'hawl-incomplete' | 'hawl-unresolved';

export interface ZakahResult {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  unresolved: Issue[];
  engineVersion: string;
  profile: { id: string; version: string; nameKey: string; review: ZakahRuleProfile['review'] };
  currency: string;
  precision: number;
  valuationDate: string;
  calculatedAt: string;
  included: ResultLine[];
  excluded: ResultLine[];
  liabilitiesApplied: ResultLine[];
  liabilitiesNotApplied: ResultLine[];
  totals: { assets: string; liabilities: string; net: string };
  nisab: { basis: 'gold' | 'silver'; grams: string; threshold: string; met: boolean } | null;
  hawl: HawlAnswer;
  rate: string;
  rounding: string;
  /** Amount payable now; "0" when not due. */
  zakahDue: string;
  /** What would be due if the ownership year is complete, shown when the year is unconfirmed. */
  conditionalAmount: string | null;
  status: DueStatus | null;
  assumptions: string[];
  sources: SourceRef[];
}

const INTERNAL_SCALE = 12;

const normLabel = (s: string | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

function rateAgeIssue(name: string, rate: RateInput, valuationDate: string, maxHours: number): Issue | null {
  const asOf = Date.parse(rate.asOf);
  const valuationEnd = Date.parse(`${valuationDate}T23:59:59Z`);
  if (!Number.isFinite(asOf)) return { code: 'rate-date-invalid', params: { rate: name } };
  const hours = (valuationEnd - asOf) / 3_600_000;
  if (hours > maxHours) return { code: 'rate-stale', params: { rate: name, hours: String(Math.floor(hours)), max: String(maxHours) } };
  if (hours < -24) return { code: 'rate-after-valuation', params: { rate: name } };
  return null;
}

function validDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function calculateZakah(input: ZakahInput, calculatedAt: string): ZakahResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const unresolved: Issue[] = [];
  const profile = findProfile(input.profileId, input.profileVersion);
  const precision = currencyPrecision(input.currency);

  const empty = (): ZakahResult => ({
    ok: false,
    errors,
    warnings,
    unresolved,
    engineVersion: ZAKAH_ENGINE_VERSION,
    profile: profile
      ? { id: profile.id, version: profile.version, nameKey: profile.nameKey, review: profile.review }
      : { id: input.profileId, version: input.profileVersion, nameKey: '', review: { status: 'pending' } },
    currency: input.currency,
    precision: precision ?? 2,
    valuationDate: input.valuationDate,
    calculatedAt,
    included: [],
    excluded: [],
    liabilitiesApplied: [],
    liabilitiesNotApplied: [],
    totals: { assets: '0', liabilities: '0', net: '0' },
    nisab: null,
    hawl: input.hawl,
    rate: profile?.rate ?? '',
    rounding: '',
    zakahDue: '0',
    conditionalAmount: null,
    status: null,
    assumptions: profile?.assumptions ?? [],
    sources: profile?.sources ?? [],
  });

  if (!profile) {
    errors.push({ code: 'profile-unknown', params: { id: input.profileId, version: input.profileVersion } });
    return empty();
  }
  if (precision === null) errors.push({ code: 'currency-unsupported', params: { currency: input.currency } });
  if (!validDate(input.valuationDate)) errors.push({ code: 'valuation-date-invalid' });
  if (!['yes', 'no', 'unsure'].includes(input.hawl)) errors.push({ code: 'hawl-missing' });
  const ids = new Set<string>();
  for (const e of [...input.assets, ...input.liabilities]) {
    if (ids.has(e.id)) errors.push({ code: 'entry-id-duplicate', entryId: e.id });
    ids.add(e.id);
  }
  if (errors.length) return empty();

  const scale = precision as number;
  const usedRates = new Map<string, RateInput>();

  function rateValue(name: string, rate: RateInput | undefined): Dec | null {
    if (!rate) return null;
    const value = parseDec(rate.value);
    if (!value || isZero(value)) {
      errors.push({ code: 'rate-invalid', params: { rate: name } });
      return null;
    }
    usedRates.set(name, rate);
    return value;
  }

  /** Price of one gram of pure metal, normalising a quote for a lower karat. */
  function purePricePerGram(metal: 'gold' | 'silver'): Dec | null {
    const rate = input.rates[metal];
    const value = rateValue(metal, rate);
    if (!value || !rate) return null;
    const karat = rate.karat ?? 24;
    if (!Number.isInteger(karat) || karat < 1 || karat > 24) {
      errors.push({ code: 'rate-karat-invalid', params: { rate: metal } });
      return null;
    }
    return karat === 24 ? value : div(mul(value, dec(24)), dec(karat), INTERNAL_SCALE);
  }

  function toBase(amount: Dec, currency: string | undefined, entryId: string): Dec | null {
    const code = currency || input.currency;
    if (code === input.currency) return amount;
    if (currencyPrecision(code) === null) {
      errors.push({ code: 'currency-unsupported', entryId, params: { currency: code } });
      return null;
    }
    const fx = rateValue(`fx:${code}`, input.rates.fx?.[code]);
    if (!fx) {
      if (!errors.some(e => e.code === 'fx-missing' && e.params?.currency === code)) {
        errors.push({ code: 'fx-missing', entryId, params: { currency: code } });
      }
      return null;
    }
    return mul(amount, fx);
  }

  const included: ResultLine[] = [];
  const excluded: ResultLine[] = [];
  const seenLabels = new Map<string, string>();
  let assets = ZERO;
  const purePrices: Partial<Record<'gold' | 'silver', Dec | null>> = {};
  const priceFor = (metal: 'gold' | 'silver') => (metal in purePrices ? purePrices[metal]! : (purePrices[metal] = purePricePerGram(metal)));

  for (const entry of input.assets) {
    const label = entry.label?.trim() || '';
    const treatment = profile.assets[entry.category];
    if (!treatment) {
      errors.push({ code: 'category-unknown', entryId: entry.id, params: { category: String(entry.category) } });
      continue;
    }
    if (treatment === 'specialist-review' || treatment === 'not-zakatable-in-profile') {
      excluded.push({ entryId: entry.id, category: entry.category, label, reason: treatment === 'specialist-review' ? 'zkReasonSpecialist' : 'zkReasonPersonalUse' });
      if (treatment === 'specialist-review') unresolved.push({ code: 'category-needs-review', entryId: entry.id, params: { category: entry.category } });
      continue;
    }
    const key = normLabel(label);
    if (key && seenLabels.has(key) && !entry.distinctConfirmed) {
      excluded.push({ entryId: entry.id, category: entry.category, label, reason: 'zkReasonDuplicate' });
      warnings.push({ code: 'possible-duplicate', entryId: entry.id, params: { label, other: seenLabels.get(key)! } });
      continue;
    }

    let value: Dec | null = null;
    let basis = '';
    if (treatment === 'money') {
      const amount = parseDec(entry.amount);
      if (!amount) {
        errors.push({ code: 'amount-invalid', entryId: entry.id });
        continue;
      }
      value = toBase(amount, entry.currency, entry.id);
      if (entry.currency && entry.currency !== input.currency) {
        basis = `${toPlain(amount)} ${entry.currency} × ${input.rates.fx?.[entry.currency]?.value ?? '?'}`;
      }
    } else {
      const metal = entry.category as 'gold' | 'silver';
      const weight = parseDec(entry.weight);
      const unit = entry.unit ?? 'g';
      const karat = entry.karat ?? 24;
      if (!weight || isZero(weight)) {
        errors.push({ code: 'weight-invalid', entryId: entry.id });
        continue;
      }
      if (!Object.hasOwn(WEIGHT_UNITS, unit)) {
        errors.push({ code: 'unit-invalid', entryId: entry.id });
        continue;
      }
      if (!Number.isInteger(karat) || karat < 1 || karat > 24) {
        errors.push({ code: 'karat-invalid', entryId: entry.id });
        continue;
      }
      const price = priceFor(metal);
      if (!price) {
        if (!errors.some(e => e.code === 'metal-rate-missing' && e.params?.metal === metal)) {
          errors.push({ code: 'metal-rate-missing', params: { metal } });
        }
        continue;
      }
      const grams = mul(weight, parseDec(WEIGHT_UNITS[unit])!);
      const pure = div(mul(grams, dec(karat)), dec(24), INTERNAL_SCALE);
      value = mul(pure, price);
      basis = `${toPlain(weight)} ${unit} × ${karat}/24 = ${toFixed(round(pure, 4), 4)} g × ${toFixed(round(price, scale + 2), scale + 2)}`;
    }
    if (!value) continue;
    if (key) seenLabels.set(key, label);
    assets = add(assets, value);
    included.push({ entryId: entry.id, category: entry.category, label, value: toFixed(value, scale), basis });
  }

  const liabilitiesApplied: ResultLine[] = [];
  const liabilitiesNotApplied: ResultLine[] = [];
  let liabilities = ZERO;
  for (const entry of input.liabilities) {
    const label = entry.label?.trim() || '';
    const treatment = profile.liabilities[entry.category];
    if (!treatment) {
      errors.push({ code: 'category-unknown', entryId: entry.id, params: { category: String(entry.category) } });
      continue;
    }
    const amount = parseDec(entry.amount);
    if (!amount) {
      errors.push({ code: 'amount-invalid', entryId: entry.id });
      continue;
    }
    if (treatment === 'specialist-review') {
      liabilitiesNotApplied.push({ entryId: entry.id, category: entry.category, label, reason: 'zkReasonLiabilityReview' });
      unresolved.push({ code: 'liability-needs-review', entryId: entry.id, params: { category: entry.category } });
      continue;
    }
    const value = toBase(amount, entry.currency, entry.id);
    if (!value) continue;
    liabilities = add(liabilities, value);
    liabilitiesApplied.push({ entryId: entry.id, category: entry.category, label, value: toFixed(value, scale) });
  }

  const nisabMetal = profile.nisab.basis;
  const nisabGrams = parseDec(nisabMetal === 'gold' ? profile.nisab.goldGrams : profile.nisab.silverGrams)!;
  const nisabPrice = priceFor(nisabMetal);
  if (!nisabPrice && !errors.some(e => e.code === 'metal-rate-missing' && e.params?.metal === nisabMetal)) {
    errors.push({ code: 'nisab-rate-missing', params: { metal: nisabMetal } });
  }

  for (const [name, rate] of usedRates) {
    const issue = rateAgeIssue(name, rate, input.valuationDate, profile.maxRateAgeHours);
    if (issue) warnings.push(issue);
  }

  if (errors.length || !nisabPrice) {
    const result = empty();
    return { ...result, included, excluded, liabilitiesApplied, liabilitiesNotApplied };
  }

  const net = max(sub(assets, liabilities), ZERO);
  const threshold = mul(nisabGrams, nisabPrice);
  const met = cmp(net, threshold) >= 0;
  const computed = round(mul(net, parseDec(profile.rate)!), scale, profile.rounding.mode);
  const zero = toFixed(ZERO, scale);

  let status: DueStatus;
  if (!met) status = 'below-nisab';
  else if (input.hawl === 'no') status = 'hawl-incomplete';
  else if (input.hawl === 'unsure') status = 'hawl-unresolved';
  else status = 'due';
  if (status === 'hawl-unresolved') unresolved.push({ code: 'hawl-unconfirmed' });
  if (profile.review.status !== 'approved') warnings.push({ code: 'profile-unreviewed' });

  return {
    ok: true,
    errors,
    warnings,
    unresolved,
    engineVersion: ZAKAH_ENGINE_VERSION,
    profile: { id: profile.id, version: profile.version, nameKey: profile.nameKey, review: profile.review },
    currency: input.currency,
    precision: scale,
    valuationDate: input.valuationDate,
    calculatedAt,
    included,
    excluded,
    liabilitiesApplied,
    liabilitiesNotApplied,
    totals: { assets: toFixed(assets, scale), liabilities: toFixed(liabilities, scale), net: toFixed(net, scale) },
    nisab: { basis: nisabMetal, grams: toPlain(nisabGrams), threshold: toFixed(threshold, scale), met },
    hawl: input.hawl,
    rate: profile.rate,
    rounding: `half-up:${scale}`,
    zakahDue: status === 'due' ? toFixed(computed, scale) : zero,
    conditionalAmount: status === 'hawl-incomplete' || status === 'hawl-unresolved' ? toFixed(computed, scale) : null,
    status,
    assumptions: profile.assumptions,
    sources: profile.sources,
  };
}

/** Zakat al-Fitr is separate from wealth zakah: people × the per-person amount announced by the local authority. */
export function zakatAlFitr(people: number, perPerson: string, currency: string): { total: string } | { error: string } {
  const scale = currencyPrecision(currency);
  const amount = parseDec(perPerson);
  if (scale === null) return { error: 'currency-unsupported' };
  if (!Number.isInteger(people) || people < 1 || people > 100) return { error: 'people-invalid' };
  if (!amount) return { error: 'amount-invalid' };
  return { total: toFixed(round(mul(amount, dec(people)), scale), scale) };
}

import { ZAKAH_PROFILE, isEnabledCategory, isKnownCategory, type AssetCategory } from './zakahProfile.ts';

const SCALE = 4;
const FACTOR = 10n ** BigInt(SCALE);
const TROY_OZ_NUM = 19439673n;
const TROY_OZ_DEN = 6250000n;

export type WeightUnit = 'g' | 'oz';

export interface ZakahAssetInput {
  id: string;
  category: string;
  /** Same key on two rows is rejected so one balance cannot be entered twice. */
  dedupeKey: string;
  amount?: string;
  currency?: string;
  /** How many units of the base currency equal 1 unit of `currency`. Manual only. */
  manualFx?: string;
  weight?: string;
  weightUnit?: WeightUnit;
  purityMode?: 'karat' | 'fineness';
  purity?: string;
}

export interface ZakahLiabilityInput {
  id: string;
  dedupeKey: string;
  amount: string;
}

export interface ZakahInput {
  currency: string;
  valuationDate: string;
  goldPricePerGram?: string;
  silverPricePerGram?: string;
  /** Civil date the manual prices were written down. */
  priceEnteredOn?: string;
  acceptStale?: boolean;
  hawl: 'complete' | 'incomplete' | 'unknown';
  assets: ZakahAssetInput[];
  liabilities: ZakahLiabilityInput[];
}

export interface Line {
  id: string;
  category: string;
  minor: string;
  detail?: string;
}

export interface ExcludedLine {
  id: string;
  category: string;
  reason: string;
}

export interface ZakahSuccess {
  ok: true;
  profileId: string;
  profileVersion: string;
  scholarReviewed: false;
  educationalPreview: true;
  currency: string;
  valuationDate: string;
  included: Line[];
  excluded: ExcludedLine[];
  liabilities: Line[];
  nisabBasis: 'lower_of_gold_and_silver' | null;
  nisabGoldMinor: string | null;
  nisabSilverMinor: string | null;
  nisabMinor: string | null;
  grossMinor: string;
  liabilityMinor: string;
  netMinor: string;
  rate: string;
  /** Exact 2.5% at 4 decimal places, before currency rounding. Null when a due figure is not produced. */
  exactDueMinor: string | null;
  /** Payable figure rounded half-up to the currency scale. Null when not produced. */
  dueMinor: string | null;
  rounding: string;
  hawl: ZakahInput['hawl'];
  stale: boolean;
  assumptions: string[];
  unresolved: string[];
  warnings: string[];
}

export interface ZakahFailure {
  ok: false;
  errors: string[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('bad divisor');
  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;
  const q = n / denominator;
  const r = n % denominator;
  const rounded = r * 2n >= denominator ? q + 1n : q;
  return negative ? -rounded : rounded;
}

export function parseDecimal(raw: string | undefined, scale = SCALE): bigint | null {
  if (raw === undefined) return null;
  const s = raw.trim().replace(/,/g, '');
  if (!new RegExp(`^\\d+(\\.\\d{0,${scale}})?$`).test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  if (whole.length > 12) return null;
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt((frac + '0'.repeat(scale)).slice(0, scale));
}

export function formatMinor(minor: bigint, scale = SCALE): string {
  const negative = minor < 0n;
  const v = negative ? -minor : minor;
  const factor = 10n ** BigInt(scale);
  const whole = v / factor;
  const frac = (v % factor).toString().padStart(scale, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

function roundCurrency(minor4: bigint): bigint {
  const drop = SCALE - ZAKAH_PROFILE.currencyScale;
  const div = 10n ** BigInt(drop);
  return divRoundHalfUp(minor4, div) * div;
}

function daysBetween(earlier: string, later: string): number {
  const [ay, am, ad] = earlier.split('-').map(Number);
  const [by, bm, bd] = later.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

function weightToMilligrams(weight: string, unit: WeightUnit): bigint | null {
  const parsed = parseDecimal(weight, 4);
  if (parsed === null || parsed === 0n) return null;
  if (unit === 'g') return divRoundHalfUp(parsed * 1000n, 10n ** 4n);
  return divRoundHalfUp(parsed * TROY_OZ_NUM, TROY_OZ_DEN);
}

function pureMilligrams(weightMg: bigint, mode: 'karat' | 'fineness', purity: string): bigint | null {
  if (mode === 'karat') {
    const karat = parseDecimal(purity, 1);
    if (karat === null || karat <= 0n || karat > 240n) return null;
    return divRoundHalfUp(weightMg * karat, 240n);
  }
  const fine = parseDecimal(purity, 0);
  if (fine === null || fine <= 0n || fine > 1000n) return null;
  return divRoundHalfUp(weightMg * fine, 1000n);
}

function metalValue(asset: ZakahAssetInput, price: bigint | null): { minor: bigint } | { error: string } {
  if (price === null) return { error: 'missing_price' };
  const unit = asset.weightUnit ?? 'g';
  if (!asset.weight || !asset.purity || !asset.purityMode) return { error: 'missing_weight' };
  const mg = weightToMilligrams(asset.weight, unit);
  if (mg === null) return { error: 'invalid_weight' };
  const pure = pureMilligrams(mg, asset.purityMode, asset.purity);
  if (pure === null) return { error: 'invalid_purity' };
  return { minor: divRoundHalfUp(pure * price, 1000n) };
}

function cashValue(asset: ZakahAssetInput, base: string): { minor: bigint } | { error: string } {
  const amount = parseDecimal(asset.amount);
  if (amount === null) return { error: 'invalid_amount' };
  const currency = asset.currency || base;
  if (currency === base) return { minor: amount };
  const fx = parseDecimal(asset.manualFx);
  if (fx === null) return { error: 'missing_fx' };
  return { minor: divRoundHalfUp(amount * fx, FACTOR) };
}

export function calculateZakah(input: ZakahInput): ZakahSuccess | ZakahFailure {
  const errors: string[] = [];
  if (!input.currency.trim()) errors.push('currency');
  if (!ISO.test(input.valuationDate)) errors.push('valuation_date');
  if (!['complete', 'incomplete', 'unknown'].includes(input.hawl)) errors.push('hawl');
  if (!input.assets.length) errors.push('no_assets');
  const seen = new Set<string>();
  for (const asset of input.assets) {
    if (!asset.dedupeKey.trim()) errors.push(`dedupe:${asset.id}`);
    else if (seen.has(asset.dedupeKey)) errors.push(`duplicate:${asset.dedupeKey}`);
    else seen.add(asset.dedupeKey);
    if (!isKnownCategory(asset.category)) errors.push(`unknown_category:${asset.category}`);
  }
  for (const liability of input.liabilities) {
    if (!liability.dedupeKey.trim()) errors.push(`dedupe:${liability.id}`);
    else if (seen.has(liability.dedupeKey)) errors.push(`duplicate:${liability.dedupeKey}`);
    else seen.add(liability.dedupeKey);
  }
  if (errors.length) return { ok: false, errors };

  const goldPrice = parseDecimal(input.goldPricePerGram);
  const silverPrice = parseDecimal(input.silverPricePerGram);
  const included: Line[] = [];
  const excluded: ExcludedLine[] = [];
  const liabilities: Line[] = [];
  let gross = 0n;
  let liabilityTotal = 0n;

  for (const asset of input.assets) {
    if (asset.category === 'zakat_al_fitr') {
      excluded.push({ id: asset.id, category: asset.category, reason: 'fitr_separate' });
      continue;
    }
    if (!isEnabledCategory(asset.category)) {
      excluded.push({ id: asset.id, category: asset.category, reason: 'specialist_review' });
      continue;
    }
    const valued =
      asset.category === 'gold' || asset.category === 'silver'
        ? metalValue(asset, asset.category === 'gold' ? goldPrice : silverPrice)
        : cashValue(asset, input.currency);
    if ('error' in valued) {
      excluded.push({ id: asset.id, category: asset.category, reason: valued.error });
      continue;
    }
    gross += valued.minor;
    included.push({ id: asset.id, category: asset.category, minor: formatMinor(valued.minor) });
  }

  for (const liability of input.liabilities) {
    const amount = parseDecimal(liability.amount);
    if (amount === null) {
      excluded.push({ id: liability.id, category: 'liability', reason: 'invalid_amount' });
      continue;
    }
    liabilityTotal += amount;
    liabilities.push({ id: liability.id, category: 'eligible_debt', minor: formatMinor(amount) });
  }

  const net = gross > liabilityTotal ? gross - liabilityTotal : 0n;
  const warnings: string[] = [];
  const unresolved: string[] = [];
  let stale = false;
  if (input.priceEnteredOn && ISO.test(input.priceEnteredOn)) {
    const age = daysBetween(input.priceEnteredOn, input.valuationDate);
    if (age > ZAKAH_PROFILE.staleAfterDays || age < 0) {
      stale = true;
      warnings.push('stale_or_future_price');
    }
  } else if (goldPrice !== null || silverPrice !== null) {
    warnings.push('price_date_missing');
  }

  let nisabGold: bigint | null = null;
  let nisabSilver: bigint | null = null;
  let nisab: bigint | null = null;
  if (goldPrice === null || silverPrice === null) {
    unresolved.push('nisab_prices_required');
  } else {
    const goldMg = weightToMilligrams(ZAKAH_PROFILE.goldNisabGrams, 'g')!;
    const silverMg = weightToMilligrams(ZAKAH_PROFILE.silverNisabGrams, 'g')!;
    nisabGold = divRoundHalfUp(goldMg * goldPrice, 1000n);
    nisabSilver = divRoundHalfUp(silverMg * silverPrice, 1000n);
    nisab = nisabGold < nisabSilver ? nisabGold : nisabSilver;
  }

  if (input.hawl !== 'complete') unresolved.push('ownership_period');
  if (stale && !input.acceptStale) unresolved.push('stale_rate');
  if (!included.length) unresolved.push('nothing_included');

  const rate = `${ZAKAH_PROFILE.rateNumerator}/${ZAKAH_PROFILE.rateDenominator}`;
  let exact: bigint | null = null;
  let due: bigint | null = null;
  const meets =
    nisab !== null && net >= nisab && input.hawl === 'complete' && (!stale || input.acceptStale) && included.length > 0;
  const below = nisab !== null && net < nisab && input.hawl === 'complete' && (!stale || input.acceptStale) && included.length > 0;
  if (meets) {
    exact = divRoundHalfUp(net * BigInt(ZAKAH_PROFILE.rateNumerator), BigInt(ZAKAH_PROFILE.rateDenominator));
    due = roundCurrency(exact);
  } else if (below) {
    exact = 0n;
    due = 0n;
  }

  return {
    ok: true,
    profileId: ZAKAH_PROFILE.id,
    profileVersion: ZAKAH_PROFILE.version,
    scholarReviewed: false,
    educationalPreview: true,
    currency: input.currency,
    valuationDate: input.valuationDate,
    included,
    excluded,
    liabilities,
    nisabBasis: nisab === null ? null : 'lower_of_gold_and_silver',
    nisabGoldMinor: nisabGold === null ? null : formatMinor(nisabGold),
    nisabSilverMinor: nisabSilver === null ? null : formatMinor(nisabSilver),
    nisabMinor: nisab === null ? null : formatMinor(nisab),
    grossMinor: formatMinor(gross),
    liabilityMinor: formatMinor(liabilityTotal),
    netMinor: formatMinor(net),
    rate,
    exactDueMinor: exact === null ? null : formatMinor(exact),
    dueMinor: due === null ? null : formatMinor(due),
    rounding: 'half-up to 2 decimal places from 4 decimal-place arithmetic',
    hawl: input.hawl,
    stale,
    assumptions: [...ZAKAH_PROFILE.sources],
    unresolved,
    warnings,
  };
}

export function assetCategoryLabel(category: AssetCategory | string): string {
  return category;
}

/** Drops invented amounts. The model may only suggest categories and questions. */
export interface ZakahSuggestion {
  categories: string[];
  specialist: string[];
  questions: string[];
  strippedAmounts: boolean;
}

const QUESTION_MAX = 4;

export function sanitizeZakahSuggestion(raw: unknown): ZakahSuggestion {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const strippedAmounts = ['amounts', 'amount', 'due', 'total', 'values'].some(key => key in record);
  const categories: string[] = [];
  const specialist: string[] = [];
  const incoming = Array.isArray(record.categories) ? record.categories : [];
  for (const item of incoming) {
    const id = String(item);
    if (isEnabledCategory(id) && !categories.includes(id)) categories.push(id);
    else if ((ZAKAH_PROFILE.specialist as readonly string[]).includes(id) && !specialist.includes(id)) specialist.push(id);
    else if (id === 'zakat_al_fitr' && !specialist.includes(id)) specialist.push(id);
  }
  const questions = (Array.isArray(record.questions) ? record.questions : [])
    .map(item => String(item).replace(/\d[\d,]*(?:\.\d+)?/g, '…').trim())
    .filter(item => item.length > 0)
    .slice(0, QUESTION_MAX);
  return { categories, specialist, questions, strippedAmounts };
}

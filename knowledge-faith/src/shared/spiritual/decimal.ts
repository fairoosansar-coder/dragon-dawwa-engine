/**
 * Exact decimal arithmetic for money. A value is `coef × 10^-scale` with a BigInt coefficient, so sums,
 * products and conversions never pass through binary floating point.
 */
export interface Dec {
  readonly coef: bigint;
  readonly scale: number;
}

export type Rounding = 'half-up' | 'down';

const TEN = 10n;
const pow10 = (n: number): bigint => TEN ** BigInt(n);

export const dec = (coef: bigint | number, scale = 0): Dec => ({ coef: BigInt(coef), scale });
export const ZERO: Dec = dec(0);

/**
 * Parses a non-negative decimal written with an optional "." and optional "," or space thousands separators.
 * Returns null for anything else (negative numbers, exponents, multiple points, letters).
 */
export function parseDec(input: string | undefined | null): Dec | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim().replace(/[\s_]/g, '');
  if (!raw) return null;
  if (raw.includes(',') && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) return null;
  const s = raw.replace(/,/g, '');
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const frac = m[2] ?? '';
  if (frac.length > 18 || m[1].length > 30) return null;
  return { coef: BigInt(m[1] + frac), scale: frac.length };
}

function align(a: Dec, b: Dec): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  return [a.coef * pow10(scale - a.scale), b.coef * pow10(scale - b.scale), scale];
}

export function add(a: Dec, b: Dec): Dec {
  const [x, y, scale] = align(a, b);
  return { coef: x + y, scale };
}

export function sub(a: Dec, b: Dec): Dec {
  const [x, y, scale] = align(a, b);
  return { coef: x - y, scale };
}

export function mul(a: Dec, b: Dec): Dec {
  return { coef: a.coef * b.coef, scale: a.scale + b.scale };
}

export function cmp(a: Dec, b: Dec): -1 | 0 | 1 {
  const [x, y] = align(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export const isZero = (a: Dec) => a.coef === 0n;
export const isNegative = (a: Dec) => a.coef < 0n;
export const max = (a: Dec, b: Dec) => (cmp(a, b) >= 0 ? a : b);

/** Rounds to `scale` decimal places. Half-up rounds ties away from zero. */
export function round(a: Dec, scale: number, mode: Rounding = 'half-up'): Dec {
  if (a.scale <= scale) return { coef: a.coef * pow10(scale - a.scale), scale };
  const divisor = pow10(a.scale - scale);
  const negative = a.coef < 0n;
  const abs = negative ? -a.coef : a.coef;
  let q = abs / divisor;
  const r = abs % divisor;
  if (mode === 'half-up' && r * 2n >= divisor) q += 1n;
  return { coef: negative ? -q : q, scale };
}

/** Divides with `scale` digits kept, rounding the last digit by `mode`. Throws on division by zero. */
export function div(a: Dec, b: Dec, scale: number, mode: Rounding = 'half-up'): Dec {
  if (b.coef === 0n) throw new RangeError('Division by zero');
  // a/b = (a.coef / 10^a.scale) / (b.coef / 10^b.scale); compute with two guard digits, then round.
  const guard = scale + 2;
  const shift = guard - a.scale + b.scale;
  const num = shift >= 0 ? a.coef * pow10(shift) : a.coef;
  const den = shift >= 0 ? b.coef : b.coef * pow10(-shift);
  return round({ coef: num / den, scale: guard }, scale, mode);
}

export function toFixed(a: Dec, scale = a.scale): string {
  const r = round(a, scale);
  const negative = r.coef < 0n;
  const digits = (negative ? -r.coef : r.coef).toString().padStart(scale + 1, '0');
  const int = scale ? digits.slice(0, -scale) : digits;
  const frac = scale ? `.${digits.slice(-scale)}` : '';
  return `${negative ? '-' : ''}${int}${frac}`;
}

/** Drops trailing fractional zeros so stored values stay canonical ("12.50" → "12.5"). */
export function normalise(a: Dec): Dec {
  let { coef, scale } = a;
  while (scale > 0 && coef % TEN === 0n) {
    coef /= TEN;
    scale -= 1;
  }
  return { coef, scale };
}

export const toPlain = (a: Dec) => toFixed(normalise(a));

/** ISO 4217 minor-unit exponents for the currencies the calculator offers. */
export const CURRENCY_PRECISION: Record<string, number> = {
  LKR: 2,
  INR: 2,
  PKR: 2,
  BDT: 2,
  MVR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AUD: 2,
  CAD: 2,
  AED: 2,
  SAR: 2,
  QAR: 2,
  MYR: 2,
  SGD: 2,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  JPY: 0,
};

export const CURRENCIES = Object.keys(CURRENCY_PRECISION);

export function currencyPrecision(code: string): number | null {
  return Object.hasOwn(CURRENCY_PRECISION, code) ? CURRENCY_PRECISION[code] : null;
}

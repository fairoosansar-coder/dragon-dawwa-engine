/** Compare Arabic names without treating spelling marks or an extra alif as a different name. */

const MARKS = /[\u064B-\u0652\u0670\u0640\u06DF-\u06ED]/g;

export function normalizeArabicName(input: string): string {
  return input
    .replace(MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه');
}

/** Drops alif so الرحمن and الرحمان can match. Ya and waw stay, so الرحيم stays distinct. */
export function arabicNameKey(input: string): string {
  return normalizeArabicName(input).replace(/[^\u0621-\u064A]/g, '').replace(/ا/g, '');
}

export function matchByArabicName<T extends { arabic: string }>(arabic: string, records: readonly T[]): T | null {
  const key = arabicNameKey(arabic);
  if (!key) return null;
  const hits = records.filter(record => arabicNameKey(record.arabic) === key);
  return hits.length === 1 ? hits[0] : null;
}

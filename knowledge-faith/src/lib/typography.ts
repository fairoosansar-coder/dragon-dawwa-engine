import type { Lang } from '../shared/sources.ts';

export type WallFontClass = 'font-wall-ta' | 'font-wall-si' | 'font-wall-en';
export type ProfileFontClass = 'font-profile-ta' | 'font-profile-si' | 'font-profile-en';

const TAMIL_UNICODE_RE = /[\u0B80-\u0BFF]/u;
const SINHALA_UNICODE_RE = /[\u0D80-\u0DFF]/u;

export function resolveTextScriptLang(lang?: Lang | string | null, sampleText?: string | null): Lang {
  if (sampleText) {
    if (TAMIL_UNICODE_RE.test(sampleText)) return 'ta';
    if (SINHALA_UNICODE_RE.test(sampleText)) return 'si';
  }
  if (lang === 'ta' || lang === 'si') return lang;
  return 'en';
}

/**
 * Returns the Artistic Quote Wall typography class (`.font-wall-ta`, `.font-wall-si`, or `.font-wall-en`)
 * based on the passage script or active language.
 */
export function wallFontClass(lang?: Lang | string | null, sampleText?: string | null): WallFontClass {
  const resolved = resolveTextScriptLang(lang, sampleText);
  if (resolved === 'ta') return 'font-wall-ta';
  if (resolved === 'si') return 'font-wall-si';
  return 'font-wall-en';
}

/**
 * Returns the Clean Profile & Feed typography class (`.font-profile-ta`, `.font-profile-si`, or `.font-profile-en`)
 * based on the passage script or active language.
 */
export function profileFontClass(lang?: Lang | string | null, sampleText?: string | null): ProfileFontClass {
  const resolved = resolveTextScriptLang(lang, sampleText);
  if (resolved === 'ta') return 'font-profile-ta';
  if (resolved === 'si') return 'font-profile-si';
  return 'font-profile-en';
}

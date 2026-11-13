import type { Lang } from '../../shared/sources.ts';

const SINHALA = /[\u0D80-\u0DFF]/;
const TAMIL = /[\u0B80-\u0BFF]/;
const LATIN = /[A-Za-z]/;

export function languageLabel(lang: Lang): string {
  if (lang === 'si') return 'Sinhala';
  if (lang === 'ta') return 'Tamil';
  return 'English';
}

export function languageChip(lang: Lang): 'SI' | 'TA' | 'EN' {
  if (lang === 'si') return 'SI';
  if (lang === 'ta') return 'TA';
  return 'EN';
}

export function dictationCode(lang: Lang): 'si-LK' | 'ta-IN' | 'en-US' {
  if (lang === 'si') return 'si-LK';
  if (lang === 'ta') return 'ta-IN';
  return 'en-US';
}

/** Spoken research must contain the selected language. Arabic quotations may sit inside it. */
export function scriptMatchesLanguage(text: string, lang: Lang): boolean {
  const spoken = text.replace(/\[[^\]]*\]/g, ' ');
  const sinhala = SINHALA.test(spoken);
  const tamil = TAMIL.test(spoken);
  if (lang === 'si') return sinhala;
  if (lang === 'ta') return tamil;
  return LATIN.test(spoken) && !sinhala && !tamil;
}

export function generatedContentForLanguage(script: string, report: string): string {
  const generatedReport = report.split(/\n## Sources returned by Parallel\.ai\s*\n/i, 1)[0];
  return `${script}\n${generatedReport}`;
}

export function languageFailureMessage(lang: Lang): string {
  if (lang === 'si') {
    return 'Sinhala research did not return a Sinhala report. Tamil and English were not substituted. Please retry.';
  }
  if (lang === 'ta') {
    return 'Tamil research did not return a Tamil report. Sinhala and English were not substituted. Please retry.';
  }
  return 'English research did not return an English report. Please retry.';
}

export interface SelectionStamp {
  token: number;
  question: string;
  language: Lang;
}

/** A finished request may update the screen only when it is still the selected question and language. */
export function selectionStillCurrent(active: SelectionStamp, incoming: SelectionStamp): boolean {
  return active.token === incoming.token
    && active.language === incoming.language
    && active.question.trim() === incoming.question.trim();
}

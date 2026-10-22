import type { ResearchJobResponse } from '../contracts/v1.ts';
import type { Lang } from '../sources.ts';

const SCRIPT: Record<Lang, RegExp> = {
  en: /[A-Za-z]/,
  ta: /[\u0B80-\u0BFF]/,
  si: /[\u0D80-\u0DFF]/,
};

/** The opened text has to contain the requested script. English is not relabelled as Tamil or Sinhala. */
export function passageMatchesLanguage(text: string, lang: Lang): boolean {
  return SCRIPT[lang].test(text);
}

/** A running job keeps `dossier: null`. A script waits until the job is done and the dossier is present. */
export function jobReadyForScript(response: ResearchJobResponse | null | undefined): boolean {
  return Boolean(response && response.job.status === 'done' && response.dossier);
}

/** A poll response belongs to the job that was started for this question. */
export function isStaleResearchResponse(
  activeJobId: string,
  response: { job?: { id?: string } } | null | undefined,
): boolean {
  return response?.job?.id !== activeJobId;
}

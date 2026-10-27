/** Categories the hadith analyzer can send to POST /api/analyze. UI labels stay in English. */
export const ANALYSIS_CATEGORIES = [
  'Comparative Religion',
  'Modern Science & Religion',
  "Qur'an & Tafsir",
  'Hadith & Authentication',
  'Islamic History & Civilisation',
  'Faith & Philosophy',
  'Fiqh & Everyday Life',
  'Culture vs Religious Teaching',
  'Contemporary Issues & Ethics',
  'Spirituality & Character',
  'Family & Society',
  'Economics & Social Justice',
  'Scripture & Language Studies',
  'Misconceptions & FAQs',
  'Ask a Question',
] as const;

export type AnalysisCategory = (typeof ANALYSIS_CATEGORIES)[number];

export const HADITH_AUTHENTICATION_CATEGORY: AnalysisCategory = 'Hadith & Authentication';

/** Omitted category keeps the existing hadith clients on the six-agent path. */
export function usesHadithAuthentication(category: string | undefined | null): boolean {
  const value = category?.trim();
  return !value || value === HADITH_AUTHENTICATION_CATEGORY;
}

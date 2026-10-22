import type { Lang } from '../sources.ts';

/** The language a question asks for. Episode commands and fresh research use the same rule. */
export function languageRequestedByQuestion(question: string, fallback: Lang): Lang {
  if (/\bin tamil\b|தமிழில்|தமிழ்/i.test(question)) return 'ta';
  if (/\bin sinhala\b|සිංහල/i.test(question)) return 'si';
  if (/\bin english\b/i.test(question)) return 'en';
  return fallback;
}

/** Questions answered from the episode already on screen. Everything else starts a research job. */
export function questionUsesCurrentEpisode(question: string): boolean {
  const lower = question.trim().toLowerCase();
  if (/arabic term|what does .* mean|meaning of ar-rahman|meaning of rahmah|meaning of niyyah|அரபுச் சொல்|අරාබි වචනය/i.test(lower)) return true;
  if (/which hadith|what hadith|hadith supports|எந்த ஹதீஸ்|කුමන හදීසය/i.test(lower)) return true;
  if (/show the reference|show reference|what is the reference|explain that|explain this|simply|மேற்கோள்|யாது|விளக்கு|පැහැදිලි කරන්න|යොමුව/i.test(lower)) return true;
  return false;
}

/**
 * Qur'an & The Modern World Hub track — four deep-research benchmark cards.
 *
 * `question` is the user-facing / spoken prompt only.
 * `systemInstructions` holds internal QA rubrics that must never appear in the
 * visible question or be read aloud by the Host in roundtable intros.
 */

export interface ModernWorldBenchmark {
  id: string;
  title: string;
  blurb: string;
  /** Preloaded research question that seeds the Institutional Research Studio dossier. */
  question: string;
  /**
   * Internal evidence / routing instructions for models and pipelines.
   * Never concatenate into `question`, UI copy, or Host spoken lines.
   */
  systemInstructions: string;
  desk: 'quran' | 'seerah' | 'knowledge';
}

/** Phrases that must never leak into spoken Host intros or the visible question. */
const INTERNAL_GUARDRAIL_PATTERNS: RegExp[] = [
  /\s*Use opened Qur[’']an and Seerah evidence;?\s*never invent citations\.?/gi,
  /\s*Cite opened Qur[’']anic verses and authentic reports only\.?/gi,
  /\s*Use opened Qur[’']an and Hadith only;?\s*never invent grades or studies\.?/gi,
  /\s*Explain Hikmah from opened sources only;?\s*never invent citations\.?/gi,
  /\s*We will stay on Wahy and the 23-year civilizational arc[^.]*\./gi,
  /\s*—?\s*not unrelated jewelry rulings\.?/gi,
  /\s*never invent citations\.?/gi,
  /\s*never invent grades or studies\.?/gi,
];

/** Strip internal QA rubrics from a question string so Host TTS stays clean. */
export function stripInternalResearchGuardrails(text: string): string {
  let out = text;
  for (const re of INTERNAL_GUARDRAIL_PATTERNS) {
    out = out.replace(re, ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

export const MODERN_WORLD_BENCHMARKS: readonly ModernWorldBenchmark[] = [
  {
    id: 'twenty-three-year',
    title: '23-Year Prophetic Transformation',
    blurb: 'How an unlettered messenger after age 40 reshaped a fractured society into a lasting civilization through Wahy.',
    question:
      'Explain the 23-year Prophetic transformation: how did revelation (Wahy) enable an unlettered man after age 40 to transform a fractured Arabian society into an enduring global civilization?',
    systemInstructions:
      "Use opened Qur'an and Seerah evidence only. Stay on Wahy and the 23-year civilizational arc—not unrelated jewelry or gold-ring rulings. Never invent citations.",
    desk: 'seerah',
  },
  {
    id: 'primordial-universality',
    title: 'Primordial Universality from Adam',
    blurb: 'Islam as Fitrah — the shared message beginning with Adam (عليه السلام), father of all humanity.',
    question:
      'How does Islam teach primordial universality from Adam (عليه السلام) as the shared father of humanity, making the message Fitrah rather than a late regional religion?',
    systemInstructions:
      "Cite opened Qur'anic verses and authentic reports only. Never invent citations.",
    desk: 'quran',
  },
  {
    id: 'micro-sunnah-science',
    title: 'Micro-Sunnah & Modern Science',
    blurb: 'From dates and fasting to mental resilience — Prophetic habits meeting contemporary science with Hikmah.',
    question:
      'How do micro-level Sunnah practices (nutrition such as dates, fasting, sleep, mental resilience) show Hikmah that aligns with and often stands a step ahead of modern science?',
    systemInstructions:
      "Use opened Qur'an and Hadith only; never invent grades or studies.",
    desk: 'knowledge',
  },
  {
    id: 'macro-governance',
    title: 'Macro-Governance & Justice',
    blurb: 'Treaties, justice, and world governance — Qur’an and Sunnah as a coherent civilizational frame.',
    question:
      'How do Qur’an and Sunnah guide macro-justice, treaties, and world governance as a coherent civilizational system?',
    systemInstructions:
      'Explain Hikmah from opened sources only; never invent citations.',
    desk: 'quran',
  },
];

/** Stable seven-agent report id for a Modern World hub card (never collides with gold-ring jobs). */
export function modernWorldReportId(benchmarkId: string): string {
  return `7agent-modern-${benchmarkId}`;
}

export function modernWorldBenchmarkById(id: string): ModernWorldBenchmark | null {
  const clean = id.trim();
  const bare = clean.startsWith('7agent-modern-') ? clean.slice('7agent-modern-'.length) : clean;
  return MODERN_WORLD_BENCHMARKS.find(card => card.id === bare) ?? null;
}

/** Exact question match, or distinctive hub-card signature when the URL truncates the prompt. */
export function matchModernWorldBenchmark(question: string): ModernWorldBenchmark | null {
  const q = stripInternalResearchGuardrails(question).trim().toLowerCase();
  if (!q) return null;
  for (const card of MODERN_WORLD_BENCHMARKS) {
    if (q === card.question.trim().toLowerCase()) return card;
    if (q === stripInternalResearchGuardrails(card.question).trim().toLowerCase()) return card;
    // Legacy prompts that still carried guardrails in the question string
    const legacy = `${card.question} ${card.systemInstructions}`.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalizeResearchQuestion(question) === normalizeResearchQuestion(legacy)) return card;
  }
  const signatures: Array<{ id: string; re: RegExp }> = [
    { id: 'twenty-three-year', re: /23[- ]?year|prophetic transformation|unlettered.*40|wahy.*civilization/i },
    { id: 'primordial-universality', re: /primordial universality|fitrah|adam.*(humanity|father)|father of (all )?humanity/i },
    { id: 'micro-sunnah-science', re: /micro[- ]?(level )?sunnah|dates.*fasting|mental resilience|step ahead of modern science/i },
    { id: 'macro-governance', re: /macro[- ]?(justice|governance)|treaties.*governance|civilizational system/i },
  ];
  for (const sig of signatures) {
    if (sig.re.test(question)) {
      return MODERN_WORLD_BENCHMARKS.find(card => card.id === sig.id) ?? null;
    }
  }
  return null;
}

export function normalizeResearchQuestion(question: string): string {
  return stripInternalResearchGuardrails(question).trim().replace(/\s+/g, ' ').toLowerCase();
}

/** True when two prompts name the same research job (exact or Modern World signature). */
export function researchQuestionsAlign(a: string, b: string): boolean {
  const left = normalizeResearchQuestion(a);
  const right = normalizeResearchQuestion(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const matchA = matchModernWorldBenchmark(a);
  const matchB = matchModernWorldBenchmark(b);
  return Boolean(matchA && matchB && matchA.id === matchB.id);
}

/** Visible + spoken question for UI / Host; never includes systemInstructions. */
export function userFacingResearchQuestion(question: string): string {
  const matched = matchModernWorldBenchmark(question);
  if (matched) return matched.question;
  return stripInternalResearchGuardrails(question);
}

/** Internal rubric for model prompts when a hub card (or legacy prompt) is recognized. */
export function researchSystemInstructionsForQuestion(question: string): string {
  const matched = matchModernWorldBenchmark(question);
  return matched?.systemInstructions ?? '';
}

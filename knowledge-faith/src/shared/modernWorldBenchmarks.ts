/**
 * Qur'an & The Modern World Hub track — four deep-research benchmark cards.
 */

export interface ModernWorldBenchmark {
  id: string;
  title: string;
  blurb: string;
  /** Preloaded research question that seeds the Institutional Research Studio dossier. */
  question: string;
  desk: 'quran' | 'seerah' | 'knowledge';
}

export const MODERN_WORLD_BENCHMARKS: readonly ModernWorldBenchmark[] = [
  {
    id: 'twenty-three-year',
    title: '23-Year Prophetic Transformation',
    blurb: 'How an unlettered messenger after age 40 reshaped a fractured society into a lasting civilization through Wahy.',
    question:
      'Explain the 23-year Prophetic transformation: how did revelation (Wahy) enable an unlettered man after age 40 to transform a fractured Arabian society into an enduring global civilization? Use opened Qur’an and Seerah evidence; never invent citations.',
    desk: 'seerah',
  },
  {
    id: 'primordial-universality',
    title: 'Primordial Universality from Adam',
    blurb: 'Islam as Fitrah — the shared message beginning with Adam (عليه السلام), father of all humanity.',
    question:
      'How does Islam teach primordial universality from Adam (عليه السلام) as the shared father of humanity, making the message Fitrah rather than a late regional religion? Cite opened Qur’anic verses and authentic reports only.',
    desk: 'quran',
  },
  {
    id: 'micro-sunnah-science',
    title: 'Micro-Sunnah & Modern Science',
    blurb: 'From dates and fasting to mental resilience — Prophetic habits meeting contemporary science with Hikmah.',
    question:
      'How do micro-level Sunnah practices (nutrition such as dates, fasting, sleep, mental resilience) show Hikmah that aligns with and often stands a step ahead of modern science? Use opened Qur’an and Hadith only; never invent grades or studies.',
    desk: 'knowledge',
  },
  {
    id: 'macro-governance',
    title: 'Macro-Governance & Justice',
    blurb: 'Treaties, justice, and world governance — Qur’an and Sunnah as a coherent civilizational frame.',
    question:
      'How do Qur’an and Sunnah guide macro-justice, treaties, and world governance as a coherent civilizational system? Explain Hikmah from opened sources only; never invent citations.',
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
  const q = question.trim().toLowerCase();
  if (!q) return null;
  for (const card of MODERN_WORLD_BENCHMARKS) {
    if (q === card.question.trim().toLowerCase()) return card;
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
  return question.trim().replace(/\s+/g, ' ').toLowerCase();
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

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

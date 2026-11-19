import type { ChainLink, DragonDawwaAnalysis } from '../types/hadith.ts';

export type GradeTone = 'authentic' | 'acceptable' | 'weak' | 'rejected' | 'unspecified';

export interface PublishedGrade {
  grade: string;
  source: string;
  tone: GradeTone;
}

export interface EvidenceCounts {
  supporting: number;
  conflicting: number;
  unresolved: number;
  /** Contradiction notes printed in full, including notes that deny a conflict. */
  contradictionNotes: number;
  /** Contradiction notes excluded from the conflicting count because they state that no conflict was found. */
  negatedConflicts: number;
  supportingReports: number;
  corroboratingRecords: number;
}

const NEGATED_CONFLICT =
  /முரண்படவில்லை|முரண்பாடு இல்லை|முரண்பாடுகள் இல்லை|පටහැනි නොවේ|පරස්පරතා නොමැත|no contradiction|does not contradict|do not contradict|not contradict|no conflict|does not conflict|do not conflict|without conflict|no irregularity|not irregular/i;

const SUPPORTING_MATCH = new Set(['Direct Hadith Match', 'Corroborating Theme Passage']);

export function reportIdFor(query: string): string {
  const sum = Math.abs(query.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
  return `DD-${(sum % 90000) + 10000}`;
}

export function toneForGrade(grade: string): GradeTone {
  const s = grade.toLowerCase();
  if (/mawdu|fabricat|matruk|موضوع|mardud/.test(s)) return 'rejected';
  if (/da['’]?if|weak|ضعيف|munkar/.test(s)) return 'weak';
  if (/sahih|authentic|mutawatir|thabit|maqbool|صحيح|சரியானது|සැබෑ|හොඳ/.test(s)) return 'authentic';
  if (/hasan|حسن|හසන්/.test(s)) return 'acceptable';
  return 'unspecified';
}

/**
 * The ring repeats one published grade and the source named with it.
 * It does not convert a model score into a percentage.
 */
export function publishedAuthenticity(analysis: DragonDawwaAnalysis): PublishedGrade {
  const grading = analysis.agent_5_scholars_verdict?.gradings?.find(g => g.grading?.trim());
  if (grading) {
    return {
      grade: grading.grading.trim(),
      source: [grading.scholar, grading.reference].filter(Boolean).join(' · '),
      tone: toneForGrade(grading.grading),
    };
  }
  const record = analysis.agent_7_source_research?.retrieved_records?.find(r => r.published_grade?.trim());
  if (record?.published_grade) {
    return {
      grade: record.published_grade.trim(),
      source: [`HadeethEnc #${record.id}`, record.collection_attribution].filter(Boolean).join(' · '),
      tone: toneForGrade(record.published_grade),
    };
  }
  return {
    grade: 'Not supplied',
    source: 'No published grading was attached to this dossier.',
    tone: 'unspecified',
  };
}

export function statesNoConflict(text: string): boolean {
  return NEGATED_CONFLICT.test(text);
}

export function evidenceCounts(analysis: DragonDawwaAnalysis): EvidenceCounts {
  const reports = analysis.agent_4_shawahid_matn?.supporting_reports ?? [];
  const contradictions = analysis.agent_4_shawahid_matn?.contradictions ?? [];
  const records = analysis.agent_7_source_research?.retrieved_records ?? [];
  const unresolved = analysis.agent_7_source_research?.unresolved_questions ?? [];
  const negatedConflicts = contradictions.filter(statesNoConflict).length;
  const corroboratingRecords = records.filter(r => SUPPORTING_MATCH.has(r.match_status)).length;
  return {
    supporting: reports.length + corroboratingRecords,
    conflicting: contradictions.length - negatedConflicts,
    unresolved: unresolved.length,
    contradictionNotes: contradictions.length,
    negatedConflicts,
    supportingReports: reports.length,
    corroboratingRecords,
  };
}

export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}'’]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function samePerson(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return longer.startsWith(`${shorter} `);
}

/** A dossier name often pairs a Tamil or Arabic form with an English name in parentheses. */
function nameAliases(name: string): string[] {
  const found = new Set<string>();
  const add = (value: string) => {
    const key = nameKey(value);
    if (key) found.add(key);
  };
  add(name);
  for (const match of name.matchAll(/\(([^)]*)\)/g)) add(match[1]);
  return [...found];
}

function peopleMatch(left: string, right: string): boolean {
  return nameAliases(left).some(a => nameAliases(right).some(b => samePerson(a, b)));
}

export function linkBetween(from: string, to: string, links: ChainLink[]): ChainLink | undefined {
  return links.find(link => {
    const forward = peopleMatch(link.student, from) && peopleMatch(link.teacher, to);
    const reverse = peopleMatch(link.teacher, from) && peopleMatch(link.student, to);
    return forward || reverse;
  });
}

const QURAN_AS_CHAIN =
  /surah|ayah|\bverse\b|qur[’']?an|குர்ஆன்|வசனம்|سورة|denies faith|work has become worthless|தொழுகையை விடு|இணைவைப்ப|al-ma['’]?idah|المائدة/i;

const CHAIN_SOURCE = /tahdhib|siyar|isabah|hadeethenc|\d{2,}|bukhari|muslim|tirmidh|ibn hajar|dhahabi|kamal|jarh|ta'dil/i;

/** A transmission map is drawn only when every step is a person-to-person link with a cited reason. */
export function sourcedNarratorChain(sequence: readonly string[], links: readonly ChainLink[]): boolean {
  if (sequence.length < 2 || links.length < 1) return false;
  if (sequence.some(name => name.trim().length > 48 || QURAN_AS_CHAIN.test(name))) return false;
  for (let index = 0; index < sequence.length - 1; index += 1) {
    const link = linkBetween(sequence[index], sequence[index + 1], [...links]);
    if (!link) return false;
    const reason = link.historical_reasoning?.trim() ?? '';
    if (!reason || reason.length > 280 || QURAN_AS_CHAIN.test(reason) || !CHAIN_SOURCE.test(reason)) return false;
    if (QURAN_AS_CHAIN.test(link.teacher) || QURAN_AS_CHAIN.test(link.student)) return false;
    if (link.teacher.trim().length > 48 || link.student.trim().length > 48) return false;
  }
  return true;
}

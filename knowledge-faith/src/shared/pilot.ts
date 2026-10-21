import type { Lang } from './sources.ts';

export const PILOT_TOPIC = 'Intention, habit and everyday life.';
export const PILOT_HADEETH_IDS = ['4560', '5845'] as const;
export const PILOT_VERSES = [{ surah: 98, ayah: 5 }] as const;
export const PILOT_LIMITATION = 'The retrieved sources do not answer this question.';
export const PILOT_QUOTATION_NOTE = 'Retrieved passage. A written answer was not generated, and this has not been reviewed.';
export const PILOT_SYNTHESIS_NOTE = 'Our synthesis. This live answer has not been reviewed.';

export interface PilotClaim {
  id: string;
  group: string;
  role: 'original' | 'translation' | 'explanation';
  label: string;
  text: string;
  attribution: string;
  sourceUrl: string | null;
}

export interface PilotChapter {
  id: string;
  title: string;
  claims: PilotClaim[];
}

export interface PilotGap {
  source: string;
  message: string;
}

export interface PilotEpisode {
  topic: string;
  lang: Lang;
  published: false;
  review: 'editorial';
  narration: 'generated';
  chapters: PilotChapter[];
  lines: { text: string; citations: string[] }[];
  gaps: PilotGap[];
}

export interface PilotParagraph {
  text: string;
  citations: string[];
  role: 'quotation' | 'synthesis' | 'limitation';
}

export interface PilotAnswer {
  question: string;
  lang: Lang;
  review: 'unreviewed';
  kind: 'quotation' | 'synthesis' | 'limitation';
  note: string;
  paragraphs: PilotParagraph[];
  evidence: PilotClaim[];
}

const STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'is', 'are', 'was', 'were', 'what', 'does', 'do', 'did',
  'this', 'that', 'these', 'those', 'mean', 'means', 'meaning', 'explain', 'about', 'please', 'tell', 'me', 'how', 'why',
  'when', 'who', 'which', 'with', 'from', 'into', 'it', 'its', 'be', 'as', 'at', 'by', 'not', 'can', 'could', 'would',
  'should', 'hadith', 'quran', 'verse', 'passage', 'say', 'says', 'said',
]);

const POINTER = new Set(['this', 'that', 'here', 'explain', 'meaning', 'mean', 'means']);

export function contentTokens(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(token => token.length >= 3 && !STOP.has(token));
}

export function pointsAtPassage(question: string): boolean {
  return question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .some(token => POINTER.has(token));
}

function readable(claims: PilotClaim[]): PilotClaim[] {
  const seen = new Set<string>();
  return claims.filter(claim => {
    if (claim.role === 'explanation' || seen.has(claim.id)) return false;
    seen.add(claim.id);
    return true;
  });
}

/** Claims whose wording contains the question, or the passage being heard when the question points at it. */
export function claimsForQuestion(
  question: string,
  current: PilotClaim[],
  retrieved: PilotClaim[],
  playing: PilotClaim[] = current,
): PilotClaim[] | null {
  const tokens = contentTokens(question);
  if (tokens.length === 0) {
    const local = readable(current);
    return local.length ? local : null;
  }
  const hits = readable([...current, ...retrieved]).filter(claim => {
    const hay = `${claim.label}\n${claim.text}`.toLowerCase();
    return tokens.some(token => hay.includes(token));
  });
  if (hits.length) return hits;
  if (pointsAtPassage(question)) {
    const local = readable(playing);
    return local.length ? local : null;
  }
  return null;
}

export function sourcesForSupport(support: PilotClaim[], all: PilotClaim[]): PilotClaim[] {
  const groups = new Set(support.map(claim => claim.group));
  const seen = new Set<string>();
  return all.filter(claim => {
    if (!groups.has(claim.group) || seen.has(claim.id)) return false;
    seen.add(claim.id);
    return true;
  });
}

export function quotationParagraphs(support: PilotClaim[]): PilotParagraph[] {
  const used = new Set<string>();
  const paragraphs: PilotParagraph[] = [];
  for (const claim of support) {
    if (used.has(claim.group)) continue;
    const translation = support.find(item => item.group === claim.group && item.role === 'translation');
    const chosen = translation ?? claim;
    used.add(claim.group);
    paragraphs.push({ text: chosen.text, citations: [chosen.id], role: 'quotation' });
  }
  return paragraphs;
}

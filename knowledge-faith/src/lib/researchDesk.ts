import type { ResearchJobResponse, ResearchNoticeId, ResearchScope } from '../shared/contracts/v1.ts';
import type { Lang } from '../shared/sources.ts';
import { postJson } from './api.ts';

const HISTORY_KEY = 'kf-research-history';

export interface StoredResearch {
  id: string;
  question: string;
  language: string;
  scope: string;
  savedAt: string;
  response: ResearchJobResponse;
}

export function researchRoot(scope: ResearchScope): string {
  return scope === 'knowledge' ? 'hub' : scope;
}

export function researchHref(scope: ResearchScope, jobId: string, lang: Lang, forwarded: boolean, bookId?: number | null, question?: string): string {
  const params = new URLSearchParams({ job: jobId, lang });
  if (forwarded) params.set('fwd', '1');
  if (bookId && bookId > 0) params.set('book', String(bookId));
  if (question?.trim()) params.set('q', question.trim().slice(0, 800));
  return `#/${researchRoot(scope)}/research?${params.toString()}`;
}

export function readResearchHistory(): StoredResearch[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as StoredResearch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rememberResearch(item: StoredResearch) {
  const next = [item, ...readResearchHistory().filter(entry => entry.id !== item.id)].slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export interface StartedResearch {
  action: 'research' | 'forward' | 'clarify';
  id?: string;
  scope?: ResearchScope;
  noticeId?: ResearchNoticeId | null;
  clarificationId?: 'meaning' | null;
}

export async function beginResearch(input: {
  question: string;
  entry: ResearchScope;
  lang: Lang;
  bookId?: number | null;
  forwarded?: boolean;
  clarified?: boolean;
  priorQuestion?: string | null;
  force?: boolean;
  domainContext?: string | null;
}): Promise<StartedResearch> {
  return postJson<StartedResearch>('/api/research/jobs', {
    question: input.question,
    lang: input.lang,
    entry: input.entry,
    bookId: input.bookId ?? null,
    forwarded: input.forwarded === true,
    clarified: input.clarified === true,
    priorQuestion: input.priorQuestion ?? null,
    force: input.force === true,
    domainContext: input.domainContext ?? null,
  });
}

export function noticeText(id: ResearchNoticeId | null | undefined, t: Record<string, string>): string | null {
  if (id === 'forward-hadith') return t.noticeForwardHadith;
  if (id === 'forward-quran') return t.noticeForwardQuran;
  if (id === 'forward-books') return t.noticeForwardBooks;
  if (id === 'forward-knowledge') return t.noticeForwardKnowledge;
  return null;
}

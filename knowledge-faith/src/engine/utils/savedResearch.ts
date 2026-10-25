import type { DragonDawwaAnalysis } from '../types/hadith.ts';
import type { Lang } from '../../shared/sources.ts';
import { toLang } from '../../shared/sources.ts';

export const SAVED_RESEARCH_KEY = 'dragon_dawwa_recent_searches';

export type SavedResearchStatus = 'idle' | 'researching' | 'ready' | 'failed';

export interface SavedResearchRecord {
  id: string;
  /** Question text. `matn` is the same value for older readers of this storage key. */
  question: string;
  matn: string;
  isnad: string;
  language: Lang;
  timestamp: number;
  savedAt: number;
  status: SavedResearchStatus;
  error?: string;
  reportId?: string;
  revision?: string;
  jobId?: string;
  audioReady?: boolean;
  analysis?: DragonDawwaAnalysis;
}

export function savedKey(language: Lang, question: string): string {
  return `${language}::${question.trim()}`;
}

function asRecord(value: unknown): SavedResearchRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<SavedResearchRecord> & { matn?: string };
  const question = String(raw.question ?? raw.matn ?? '').trim();
  if (!question) return null;
  const language = toLang(raw.language);
  const savedAt = Number(raw.savedAt ?? raw.timestamp ?? Date.now());
  return {
    id: String(raw.id || `search_${savedAt}`),
    question,
    matn: question,
    isnad: String(raw.isnad ?? ''),
    language,
    timestamp: Number(raw.timestamp ?? savedAt),
    savedAt,
    status: raw.status === 'researching' || raw.status === 'ready' || raw.status === 'failed' ? raw.status : raw.analysis ? 'ready' : 'idle',
    error: typeof raw.error === 'string' ? raw.error : undefined,
    reportId: raw.reportId,
    revision: raw.revision,
    jobId: raw.jobId,
    audioReady: raw.audioReady === true,
    analysis: raw.analysis,
  };
}

export function readSavedResearch(storage: Pick<Storage, 'getItem'> | null = globalThis.localStorage): SavedResearchRecord[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(SAVED_RESEARCH_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(asRecord).filter((item): item is SavedResearchRecord => item !== null);
  } catch {
    return [];
  }
}

export function writeSavedResearch(records: SavedResearchRecord[], storage: Pick<Storage, 'setItem'> | null = globalThis.localStorage) {
  if (!storage) return;
  const slim = records.slice(0, 12).map(record => ({ ...record, matn: record.question }));
  try {
    storage.setItem(SAVED_RESEARCH_KEY, JSON.stringify(slim));
  } catch {
    const withoutAnalysis = slim.map((record, index) => (index === 0 ? record : { ...record, analysis: undefined }));
    try {
      storage.setItem(SAVED_RESEARCH_KEY, JSON.stringify(withoutAnalysis));
    } catch {
      /* keep the in-memory list when the device cannot store the dossier */
    }
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('hadith_search_updated'));
}

export function upsertSavedResearch(
  list: readonly SavedResearchRecord[],
  patch: Partial<SavedResearchRecord> & { question: string; language: Lang },
): SavedResearchRecord[] {
  const question = patch.question.trim();
  const existing = list.find(item => savedKey(item.language, item.question) === savedKey(patch.language, question));
  const failedWithoutReplacement = patch.status === 'failed';
  const keepReady = failedWithoutReplacement && existing?.analysis?.content_language === patch.language;
  const now = patch.savedAt ?? patch.timestamp ?? Date.now();
  const next: SavedResearchRecord = {
    id: existing?.id ?? patch.id ?? `search_${now}`,
    question,
    matn: question,
    isnad: patch.isnad ?? existing?.isnad ?? '',
    language: patch.language,
    timestamp: now,
    savedAt: now,
    status: keepReady ? 'ready' : patch.status ?? existing?.status ?? 'idle',
    error: patch.error,
    reportId: keepReady ? existing?.reportId : patch.reportId ?? (failedWithoutReplacement ? undefined : existing?.reportId),
    revision: keepReady ? existing?.revision : patch.revision ?? (failedWithoutReplacement ? undefined : existing?.revision),
    jobId: keepReady ? existing?.jobId : patch.jobId ?? (failedWithoutReplacement ? undefined : existing?.jobId),
    audioReady: keepReady ? existing?.audioReady : failedWithoutReplacement ? false : patch.audioReady ?? existing?.audioReady ?? false,
    analysis: keepReady ? existing?.analysis : failedWithoutReplacement ? undefined : patch.analysis === undefined ? existing?.analysis : patch.analysis,
  };
  if (patch.status === 'researching') next.status = 'researching';
  return [next, ...list.filter(item => savedKey(item.language, item.question) !== savedKey(patch.language, question))].slice(0, 12);
}

export function podcastAvailability(record: SavedResearchRecord): string {
  if (record.status === 'researching') return 'Research in progress';
  if (record.status === 'failed') return 'Retry needed';
  if (record.status === 'ready' && record.audioReady) return 'Podcast ready';
  if (record.status === 'ready') return 'No podcast yet';
  return 'No report yet';
}

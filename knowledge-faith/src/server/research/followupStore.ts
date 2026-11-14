/**
 * In-memory + on-disk persistence for Socratic Cross-Examine / Follow-Up threads
 * keyed by dossier id.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Lang } from '../../shared/sources.ts';

export interface FollowUpOpenedSource {
  id?: string;
  label: string;
  text?: string;
  url?: string;
}

export interface FollowUpTurn {
  id: string;
  at: string;
  language: Lang;
  userCounterArgument: string;
  reply: string;
  model: string;
  provider: 'anthropic' | 'gemini' | 'local';
  openedSourcesUsed: FollowUpOpenedSource[];
  targetedRetrievalRan: boolean;
}

export interface FollowUpThread {
  dossierId: string;
  originalQuestion: string;
  previousSynthesis: string;
  language: Lang;
  openedSources: FollowUpOpenedSource[];
  turns: FollowUpTurn[];
  updatedAt: string;
}

function persistRoot(): string {
  const base = process.env.DD_PERSIST_DIR?.trim() || process.env.KF_DATA_DIR?.trim() || path.join(process.cwd(), '.data');
  const dir = path.join(base, 'followup-threads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fileFor(dossierId: string): string {
  const safe = dossierId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return path.join(persistRoot(), `${safe}.json`);
}

const memory = new Map<string, FollowUpThread>();

export function loadFollowUpThread(dossierId: string): FollowUpThread | null {
  const id = dossierId.trim();
  if (!id) return null;
  const cached = memory.get(id);
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(fileFor(id), 'utf8');
    const parsed = JSON.parse(raw) as FollowUpThread;
    memory.set(id, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function saveFollowUpThread(thread: FollowUpThread): FollowUpThread {
  const next = { ...thread, updatedAt: new Date().toISOString() };
  memory.set(next.dossierId, next);
  try {
    fs.writeFileSync(fileFor(next.dossierId), JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.error('Follow-up thread persist failed:', (err as Error)?.message ?? err);
  }
  return next;
}

export function appendFollowUpTurn(
  dossierId: string,
  seed: Omit<FollowUpThread, 'turns' | 'updatedAt'> & { turns?: FollowUpTurn[] },
  turn: FollowUpTurn,
): FollowUpThread {
  const existing = loadFollowUpThread(dossierId);
  const thread: FollowUpThread = existing ?? {
    dossierId,
    originalQuestion: seed.originalQuestion,
    previousSynthesis: seed.previousSynthesis,
    language: seed.language,
    openedSources: seed.openedSources,
    turns: [],
    updatedAt: new Date().toISOString(),
  };
  thread.originalQuestion = seed.originalQuestion || thread.originalQuestion;
  thread.previousSynthesis = seed.previousSynthesis || thread.previousSynthesis;
  thread.language = seed.language || thread.language;
  if (seed.openedSources?.length) thread.openedSources = seed.openedSources;
  thread.turns = [...thread.turns, turn];
  return saveFollowUpThread(thread);
}

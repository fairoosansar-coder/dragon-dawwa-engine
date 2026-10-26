import { randomUUID } from 'node:crypto';
import type { ResearchAssignmentView, ResearchJobResponse } from '../../shared/contracts/v1.ts';
import { researchFingerprint } from '../../shared/research/coordinator.ts';
import type { Lang } from '../../shared/sources.ts';
import { UpstreamError } from '../http.ts';
import { archiveResearch, readArchivedJob } from './archive.ts';
import { executeResearch, publishParallelRevision, type ResearchPorts } from './engine.ts';
import { awaitParallelResult } from './parallelTask.ts';
import { defaultResearchPorts } from './ports.ts';

interface StoredJob extends ResearchJobResponse {
  controller: AbortController;
  createdAt: number;
  fingerprint: string;
}

const jobs = new Map<string, StoredJob>();
const JOB_TTL_MS = 15 * 60_000;
const MAX_JOBS = 30;
const MAX_RUNNING = 3;

function prune(now = Date.now()) {
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
  while (jobs.size > MAX_JOBS) {
    const oldest = jobs.keys().next().value;
    if (!oldest) break;
    jobs.delete(oldest);
  }
}

export function clearSharedResearchJobs() {
  for (const job of jobs.values()) job.controller.abort();
  jobs.clear();
}

function remember(stored: StoredJob) {
  if (!stored.dossier) return;
  if (stored.job.status !== 'done' && stored.job.status !== 'error' && stored.job.status !== 'cancelled') return;
  archiveResearch(stored.fingerprint, { contractVersion: '1.0.0', job: stored.job, dossier: stored.dossier });
}

export function getSharedResearchJob(id: string): ResearchJobResponse | undefined {
  prune();
  const job = jobs.get(id);
  if (job) return { contractVersion: '1.0.0', job: job.job, dossier: job.dossier };
  return readArchivedJob(id);
}

export function cancelSharedResearchJob(id: string): ResearchJobResponse | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  if (job.job.status !== 'running' && job.job.status !== 'queued') return getSharedResearchJob(id);
  job.controller.abort();
  job.job = { ...job.job, status: 'cancelled', finishedAt: new Date().toISOString() };
  return getSharedResearchJob(id);
}

export function startSharedResearchJob(
  question: string,
  language: Lang,
  ports: ResearchPorts = defaultResearchPorts(),
  options?: { assignment?: ResearchAssignmentView | null; force?: boolean },
): string {
  prune();
  const assignment = options?.assignment ?? null;
  const fingerprint = researchFingerprint(question, language, assignment ?? { scope: 'knowledge', teams: [], bookId: null });
  if (!options?.force) {
    for (const existing of jobs.values()) {
      if (existing.fingerprint === fingerprint && existing.job.status !== 'cancelled' && existing.job.status !== 'error') return existing.job.id;
    }
  }
  let running = 0;
  for (const job of jobs.values()) {
    if (job.job.status === 'running' || job.job.status === 'queued') running += 1;
  }
  if (running >= MAX_RUNNING) throw new UpstreamError('Too many research jobs are already running.', 429);
  const id = randomUUID();
  const controller = new AbortController();
  const stored: StoredJob = {
    contractVersion: '1.0.0',
    controller,
    createdAt: Date.now(),
    fingerprint,
    dossier: null,
    job: {
      contractVersion: '1.0.0',
      id,
      question,
      language,
      subquestions: [],
      status: 'running',
      progress: { step: 'understand', completed: 0, total: 4 },
      coverage: [],
      errors: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
      timingsMs: { totalMs: 0, sources: {} },
      assignment,
      agents: [],
    },
  };
  jobs.set(id, stored);
  void executeResearch({
    id,
    question,
    language,
    signal: controller.signal,
    ports,
    assignment,
    onProgress: snapshot => {
      const current = jobs.get(id);
      if (!current || current.job.status === 'cancelled') return;
      if (current.job.status !== 'running' && current.job.status !== 'queued') return;
      current.job = { ...snapshot, id, status: 'running' };
    },
  })
    .then(result => {
      const current = jobs.get(id);
      if (!current) return;
      if (current.job.status === 'cancelled') {
        current.dossier = result.dossier;
        current.job = { ...result.job, id, status: 'cancelled' };
        remember(current);
        return;
      }
      current.job = result.job;
      current.dossier = result.dossier;
      remember(current);
      const runId = result.job.parallel?.status === 'running' ? result.job.parallel.runId : null;
      if (runId) resumeParallel(id, runId);
    })
    .catch((err: unknown) => {
      const current = jobs.get(id);
      if (!current || current.job.status === 'cancelled') return;
      current.job = {
        ...current.job,
        status: 'error',
        finishedAt: new Date().toISOString(),
        errors: [...current.job.errors, { provider: 'research', message: err instanceof Error ? err.message : 'Research failed.' }],
      };
    });
  return id;
}

function resumeParallel(id: string, runId: string) {
  const stored = jobs.get(id);
  if (!stored) return;
  void awaitParallelResult({
    runId,
    signal: stored.controller.signal,
    attempts: 8,
    timeoutSec: 20,
  })
    .then(consult => {
      const current = jobs.get(id);
      if (!current || current.job.status === 'cancelled' || !current.dossier) return;
      if (consult.status === 'running' || consult.status === 'credentials_missing') return;
      const revised = publishParallelRevision({ job: current.job, dossier: current.dossier }, consult);
      current.job = revised.job;
      current.dossier = revised.dossier;
      remember(current);
    })
    .catch(() => {
      /* A failed continuation leaves the first revision in place. It does not invent findings. */
    });
}

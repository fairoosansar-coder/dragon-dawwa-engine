import { randomUUID } from 'node:crypto';
import type { ResearchJobResponse } from '../../shared/contracts/v1.ts';
import type { Lang } from '../../shared/sources.ts';
import { UpstreamError } from '../http.ts';
import { executeResearch, type ResearchPorts } from './engine.ts';
import { defaultResearchPorts } from './ports.ts';

interface StoredJob extends ResearchJobResponse {
  controller: AbortController;
  createdAt: number;
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

export function getSharedResearchJob(id: string): ResearchJobResponse | undefined {
  prune();
  const job = jobs.get(id);
  if (!job) return undefined;
  return { contractVersion: '1.0.0', job: job.job, dossier: job.dossier };
}

export function cancelSharedResearchJob(id: string): ResearchJobResponse | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  if (job.job.status !== 'running' && job.job.status !== 'queued') return getSharedResearchJob(id);
  job.controller.abort();
  job.job = { ...job.job, status: 'cancelled', finishedAt: new Date().toISOString() };
  return getSharedResearchJob(id);
}

export function startSharedResearchJob(question: string, language: Lang, ports: ResearchPorts = defaultResearchPorts()): string {
  prune();
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
    },
  };
  jobs.set(id, stored);
  void executeResearch({
    id,
    question,
    language,
    signal: controller.signal,
    ports,
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
        return;
      }
      current.job = result.job;
      current.dossier = result.dossier;
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

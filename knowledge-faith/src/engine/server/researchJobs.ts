import { randomUUID } from 'node:crypto';

export interface ResearchJob {
  id: string;
  status: 'running' | 'done' | 'error';
  result?: unknown;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, ResearchJob>();
const JOB_TTL_MS = 15 * 60_000;
const MAX_JOBS = 20;

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

/** Run research off the HTTP request so a proxy timeout cannot close it mid-flight. */
export function startResearchJob(work: () => Promise<unknown>, describeError: (err: unknown) => string): string {
  prune();
  const id = randomUUID();
  const job: ResearchJob = { id, status: 'running', createdAt: Date.now() };
  jobs.set(id, job);
  void work()
    .then(result => {
      const current = jobs.get(id);
      if (!current || current.status !== 'running') return;
      if (result && typeof result === 'object' && 'query_hadith' in result) {
        (result as { research_job_id?: string }).research_job_id = id;
      }
      current.status = 'done';
      current.result = result;
    })
    .catch(err => {
      const current = jobs.get(id);
      if (!current || current.status !== 'running') return;
      current.status = 'error';
      current.error = describeError(err);
    });
  return id;
}

export function getResearchJob(id: string): ResearchJob | undefined {
  prune();
  return jobs.get(id);
}

/** Test-only reset. */
export function clearResearchJobs() {
  jobs.clear();
}

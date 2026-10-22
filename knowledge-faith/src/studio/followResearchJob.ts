import type { ResearchJobResponse } from '../shared/contracts/v1.ts';
import type { Lang } from '../shared/sources.ts';
import { isStaleResearchResponse, jobReadyForScript } from '../shared/studio/jobReadiness.ts';

export interface FollowResearchJobOptions {
  question: string;
  lang: Lang;
  signal?: AbortSignal;
  onProgress?: (response: ResearchJobResponse) => void;
  fetchImpl?: typeof fetch;
  pauseMs?: number;
}

function abortError(): Error {
  const error = new Error('The research job was cancelled.');
  error.name = 'AbortError';
  return error;
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Starts a research job and follows it through the published HTTP API.
 * A null dossier is progress, not a script. A stale job id is ignored.
 * Cancelling the signal posts `/api/research/jobs/:id/cancel`.
 */
export async function followResearchJob(options: FollowResearchJobOptions): Promise<ResearchJobResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const pauseMs = options.pauseMs ?? 700;
  if (options.signal?.aborted) throw abortError();

  const created = await fetchImpl('/api/research/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: options.question, lang: options.lang }),
    signal: options.signal,
  });
  const createdBody = (await created.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!created.ok) throw new Error(createdBody.error ?? `Research could not be started (${created.status})`);
  const id = createdBody.id ?? '';
  if (!id) throw new Error('Research did not return a job id.');

  const cancel = () => {
    void fetchImpl(`/api/research/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }).catch(() => undefined);
  };
  if (options.signal?.aborted) {
    cancel();
    throw abortError();
  }
  const onAbort = () => cancel();
  options.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    for (;;) {
      if (options.signal?.aborted) throw abortError();
      let res: Response;
      try {
        res = await fetchImpl(`/api/research/jobs/${encodeURIComponent(id)}`, { signal: options.signal });
      } catch (err) {
        if (options.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) throw abortError();
        throw err;
      }
      const body = (await res.json().catch(() => null)) as ResearchJobResponse | { error?: string } | null;
      if (!res.ok) {
        const message = body && 'error' in body && body.error ? body.error : `Research job failed (${res.status})`;
        throw new Error(message);
      }
      if (!body || !('job' in body)) throw new Error('Research returned an unreadable job.');
      if (isStaleResearchResponse(id, body)) {
        await pause(pauseMs, options.signal);
        continue;
      }
      options.onProgress?.(body);
      if (body.job.status === 'cancelled') throw abortError();
      if (body.job.status === 'error') throw new Error(body.job.errors.at(-1)?.message ?? 'Research failed.');
      if (jobReadyForScript(body)) return body;
      if (body.job.status === 'done') throw new Error('The research job finished without a dossier.');
      await pause(pauseMs, options.signal);
    }
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
  }
}

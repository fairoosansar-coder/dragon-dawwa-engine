/**
 * Parallel Task API. The key is read only on the server.
 * Confidence returned here is provider metadata. It is not a hadith grade,
 * a religious certainty score, or human approval.
 */

export interface ParallelFinding {
  claim: string;
  excerpt: string;
  url: string;
  title: string;
  /** Provider metadata such as high, medium, or low. Not a hadith grade. */
  providerConfidence: string | null;
}

export interface ParallelConsult {
  status: 'credentials_missing' | 'running' | 'completed' | 'failed';
  liveCallMade: boolean;
  runId: string | null;
  findings: ParallelFinding[];
  setup: string | null;
  processor: string | null;
  durationMs: number;
}

const SETUP =
  'Set PARALLEL_AI_API_KEY or PARALLEL_API_KEY in the server environment. The browser never receives it. Direct source adapters still run. No Parallel verification is claimed until a task run returns.';

const CONFIDENCE_NOTE = 'Parallel confidence is provider metadata. It is not a hadith grade, a religious certainty score, or human approval.';

export function parallelApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const dedicated = env.PARALLEL_AI_API_KEY?.trim();
  if (dedicated) return dedicated;
  const key = env.PARALLEL_API_KEY?.trim();
  return key ? key : null;
}

export function parallelCredentialStatus(env: NodeJS.ProcessEnv = process.env): { configured: boolean; liveCallMade: false; setup: string } {
  const configured = Boolean(parallelApiKey(env));
  return { configured, liveCallMade: false, setup: configured ? 'A Parallel API key is set on the server. A task run is required before any Parallel finding is cited.' : SETUP };
}

interface TaskRun {
  run_id?: string;
  status?: string;
  output?: { content?: unknown; basis?: BasisItem[] } | string;
  basis?: BasisItem[];
}

interface BasisItem {
  confidence?: string;
  reasoning?: string;
  citations?: { url?: string; title?: string; excerpts?: string[] }[];
}

function findingsFrom(body: TaskRun): ParallelFinding[] {
  const basis = body.basis ?? (body.output && typeof body.output === 'object' ? body.output.basis : undefined) ?? [];
  const findings: ParallelFinding[] = [];
  for (const item of basis) {
    for (const citation of item.citations ?? []) {
      const excerpt = (citation.excerpts ?? []).find(text => text.trim().length > 20) ?? '';
      if (!citation.url || !excerpt) continue;
      findings.push({
        claim: item.reasoning?.trim() || excerpt.slice(0, 240),
        excerpt,
        url: citation.url,
        title: citation.title?.trim() || citation.url,
        providerConfidence: item.confidence?.trim() || null,
      });
    }
  }
  const content = body.output && typeof body.output === 'object' ? body.output.content : body.output;
  if (content && typeof content === 'object' && Array.isArray((content as { findings?: unknown }).findings)) {
    for (const row of (content as { findings: Record<string, unknown>[] }).findings) {
      const excerpt = typeof row.excerpt === 'string' ? row.excerpt.trim() : '';
      const url = typeof row.url === 'string' ? row.url.trim() : '';
      if (!excerpt || !url) continue;
      findings.push({
        claim: typeof row.claim === 'string' ? row.claim : excerpt.slice(0, 240),
        excerpt,
        url,
        title: typeof row.title === 'string' ? row.title : url,
        providerConfidence: typeof row.confidence === 'string' ? row.confidence : null,
      });
    }
  }
  const seen = new Set<string>();
  return findings.filter(finding => {
    const key = `${finding.url}\n${finding.excerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function consultParallel(input: {
  question: string;
  language: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiKey?: string | null;
  pollMs?: number;
  processor?: string;
}): Promise<ParallelConsult> {
  const started = Date.now();
  const apiKey = input.apiKey === undefined ? parallelApiKey() : input.apiKey;
  if (!apiKey) {
    return { status: 'credentials_missing', liveCallMade: false, runId: null, findings: [], setup: SETUP, processor: null, durationMs: Date.now() - started };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const processor = input.processor ?? 'pro-fast';
  const elapsed = () => Date.now() - started;
  try {
    const created = await fetchImpl('https://api.parallel.ai/v1/tasks/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      signal: input.signal,
      body: JSON.stringify({
        processor,
        input: input.question,
        task_spec: {
          output_schema: {
            type: 'json',
            json_schema: {
              type: 'object',
              properties: {
                findings: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      claim: { type: 'string' },
                      excerpt: { type: 'string', description: 'A supporting passage copied from the cited page.' },
                      url: { type: 'string' },
                      title: { type: 'string' },
                      confidence: { type: 'string', description: CONFIDENCE_NOTE },
                    },
                    required: ['claim', 'excerpt', 'url', 'title'],
                  },
                },
              },
              required: ['findings'],
            },
          },
        },
        metadata: { language: input.language, confidence: CONFIDENCE_NOTE },
      }),
    });
    if (!created.ok) {
      return { status: 'failed', liveCallMade: true, runId: null, findings: [], setup: `Parallel returned HTTP ${created.status}. No finding was invented.`, processor, durationMs: elapsed() };
    }
    const run = (await created.json()) as TaskRun;
    const runId = run.run_id ?? null;
    const immediate = findingsFrom(run);
    if (immediate.length || run.status === 'completed') {
      return { status: 'completed', liveCallMade: true, runId, findings: immediate, setup: null, processor, durationMs: elapsed() };
    }
    if (!runId) {
      return { status: 'failed', liveCallMade: true, runId: null, findings: [], setup: 'Parallel did not return a run id. No finding was invented.', processor, durationMs: elapsed() };
    }
    const wait = input.pollMs ?? 8_000;
    const result = await fetchImpl(`https://api.parallel.ai/v1/tasks/runs/${encodeURIComponent(runId)}/result?timeout=${Math.max(1, Math.ceil(wait / 1000))}`, {
      headers: { 'x-api-key': apiKey },
      signal: input.signal,
    });
    if (result.status === 408 || result.status === 202) {
      return { status: 'running', liveCallMade: true, runId, findings: [], setup: 'Parallel is still running. A later revision can carry its citations. This result does not claim them yet.', processor, durationMs: elapsed() };
    }
    if (!result.ok) {
      return { status: 'failed', liveCallMade: true, runId, findings: [], setup: `Parallel result returned HTTP ${result.status}. No finding was invented.`, processor, durationMs: elapsed() };
    }
    const body = (await result.json()) as TaskRun;
    return { status: 'completed', liveCallMade: true, runId, findings: findingsFrom(body), setup: null, processor, durationMs: elapsed() };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return {
      status: 'failed',
      liveCallMade: true,
      runId: null,
      findings: [],
      setup: err instanceof Error ? err.message : 'Parallel did not respond. No finding was invented.',
      processor,
      durationMs: elapsed(),
    };
  }
}

/**
 * Continue one existing Parallel run. The first research result is not held open for the whole task.
 * A completed result is a later revision. This does not start a second task.
 */
export async function awaitParallelResult(input: {
  runId: string;
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  processor?: string | null;
  timeoutSec?: number;
  attempts?: number;
}): Promise<ParallelConsult> {
  const started = Date.now();
  const apiKey = input.apiKey === undefined ? parallelApiKey() : input.apiKey;
  const processor = input.processor ?? null;
  if (!apiKey) {
    return { status: 'credentials_missing', liveCallMade: false, runId: input.runId, findings: [], setup: SETUP, processor, durationMs: Date.now() - started };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const attempts = Math.max(1, input.attempts ?? 6);
  const timeoutSec = Math.max(1, input.timeoutSec ?? 15);
  let lastStatus = 0;
  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (input.signal?.aborted) {
        const abort = new Error('aborted');
        abort.name = 'AbortError';
        throw abort;
      }
      const result = await fetchImpl(`https://api.parallel.ai/v1/tasks/runs/${encodeURIComponent(input.runId)}/result?timeout=${timeoutSec}`, {
        headers: { 'x-api-key': apiKey },
        signal: input.signal,
      });
      lastStatus = result.status;
      if (result.status === 408 || result.status === 202) continue;
      if (!result.ok) {
        return {
          status: 'failed',
          liveCallMade: true,
          runId: input.runId,
          findings: [],
          setup: `Parallel result returned HTTP ${result.status}. No finding was invented.`,
          processor,
          durationMs: Date.now() - started,
        };
      }
      const body = (await result.json()) as TaskRun;
      const findings = findingsFrom(body);
      if (body.status === 'completed' || findings.length > 0 || result.status === 200) {
        return { status: 'completed', liveCallMade: true, runId: input.runId, findings, setup: null, processor, durationMs: Date.now() - started };
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return {
      status: 'failed',
      liveCallMade: true,
      runId: input.runId,
      findings: [],
      setup: err instanceof Error ? err.message : 'Parallel did not respond. No finding was invented.',
      processor,
      durationMs: Date.now() - started,
    };
  }
  return {
    status: 'running',
    liveCallMade: true,
    runId: input.runId,
    findings: [],
    setup: lastStatus
      ? `Parallel is still running after HTTP ${lastStatus}. A later revision can carry its citations. This result does not claim them yet.`
      : 'Parallel is still running. A later revision can carry its citations. This result does not claim them yet.',
    processor,
    durationMs: Date.now() - started,
  };
}

export { CONFIDENCE_NOTE };

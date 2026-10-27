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

/** One agent's slice of a single Parallel task. Empty when that agent cited nothing. */
export interface ParallelAgentReport {
  id: string;
  status: 'ran' | 'not_run';
  finding: string;
  sources: { title: string; url: string; excerpt: string }[];
}

export interface ParallelAgentBrief {
  id: string;
  role: string;
  goal: string;
  sourceTarget: string;
}

export interface ParallelConsult {
  status: 'credentials_missing' | 'running' | 'completed' | 'failed';
  liveCallMade: boolean;
  runId: string | null;
  findings: ParallelFinding[];
  /** Present when the one task was asked to report each configured agent. */
  agentReports?: ParallelAgentReport[];
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

function contentObject(body: TaskRun): Record<string, unknown> | null {
  const content = body.output && typeof body.output === 'object' ? body.output.content : body.output;
  return content && typeof content === 'object' ? content as Record<string, unknown> : null;
}

function sourceRows(value: unknown): { title: string; url: string; excerpt: string }[] {
  if (!Array.isArray(value)) return [];
  const sources: { title: string; url: string; excerpt: string }[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const excerpt = typeof record.excerpt === 'string' ? record.excerpt.trim() : '';
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    if (!url || excerpt.length <= 20) continue;
    sources.push({ title: title || url, url, excerpt });
  }
  return sources;
}

/** Agent slices of one task. A report without a cited excerpt did not run. */
export function agentReportsFrom(body: TaskRun): ParallelAgentReport[] {
  const content = contentObject(body);
  const rows = content && Array.isArray(content.agents) ? content.agents : [];
  const reports: ParallelAgentReport[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id) continue;
    const sources = sourceRows(record.sources);
    const finding = typeof record.finding === 'string' ? record.finding.trim() : '';
    const ran = Boolean(finding) && sources.length > 0;
    reports.push({ id, status: ran ? 'ran' : 'not_run', finding: ran ? finding : '', sources: ran ? sources : [] });
  }
  return reports;
}

function findingsWithAgents(findings: ParallelFinding[], reports: readonly ParallelAgentReport[]): ParallelFinding[] {
  const merged = [...findings];
  for (const report of reports) {
    if (report.status !== 'ran') continue;
    for (const source of report.sources) {
      merged.push({
        claim: `[${report.id}] ${report.finding}`,
        excerpt: source.excerpt,
        url: source.url,
        title: source.title,
        providerConfidence: null,
      });
    }
  }
  const seen = new Set<string>();
  return merged.filter(finding => {
    const key = `${finding.url}\n${finding.excerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const FINDINGS_SCHEMA = {
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
} as const;

function taskSchema(agents?: readonly ParallelAgentBrief[]) {
  if (!agents?.length) return FINDINGS_SCHEMA;
  return {
    type: 'object',
    properties: {
      ...FINDINGS_SCHEMA.properties,
      agents: {
        type: 'array',
        description: 'One entry per configured agent. This is still a single task, not a separate model call per agent.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string', description: 'ran when a source excerpt is present, otherwise not_run.' },
            finding: { type: 'string' },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  url: { type: 'string' },
                  excerpt: { type: 'string' },
                },
                required: ['title', 'url', 'excerpt'],
              },
            },
          },
          required: ['id', 'status', 'finding'],
        },
      },
    },
    required: ['findings'],
  };
}

export async function consultParallel(input: {
  question: string;
  language: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiKey?: string | null;
  pollMs?: number;
  processor?: string;
  /** Replaces the task text. The caller still names one question. */
  taskInput?: string;
  /** When set, the same task is asked for one report per agent. It does not start more HTTP calls. */
  agents?: readonly ParallelAgentBrief[];
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
        input: input.taskInput?.trim() || input.question,
        task_spec: {
          output_schema: {
            type: 'json',
            json_schema: taskSchema(input.agents),
          },
        },
        metadata: {
          language: input.language,
          confidence: CONFIDENCE_NOTE,
          ...(input.agents?.length ? { agents: input.agents.map(agent => agent.id).join(',') } : {}),
        },
      }),
    });
    if (!created.ok) {
      return { status: 'failed', liveCallMade: true, runId: null, findings: [], setup: `Parallel returned HTTP ${created.status}. No finding was invented.`, processor, durationMs: elapsed() };
    }
    const run = (await created.json()) as TaskRun;
    const runId = run.run_id ?? null;
    const immediateReports = agentReportsFrom(run);
    const immediate = findingsFrom(run);
    if (immediate.length || immediateReports.some(report => report.status === 'ran') || run.status === 'completed') {
      return {
        status: 'completed',
        liveCallMade: true,
        runId,
        findings: findingsWithAgents(immediate, immediateReports),
        agentReports: immediateReports,
        setup: null,
        processor,
        durationMs: elapsed(),
      };
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
    const reports = agentReportsFrom(body);
    return {
      status: 'completed',
      liveCallMade: true,
      runId,
      findings: findingsWithAgents(findingsFrom(body), reports),
      agentReports: reports,
      setup: null,
      processor,
      durationMs: elapsed(),
    };
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

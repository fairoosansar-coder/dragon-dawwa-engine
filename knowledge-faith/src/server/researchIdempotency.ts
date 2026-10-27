import { rememberCompletedAnalysis } from '../engine/server/researchJobs.ts';
import type { ResearchAssignmentView, ResearchDossierView, ResearchJobResponse } from '../shared/contracts/v1.ts';
import type { Lang } from '../shared/sources.ts';
import { UpstreamError } from './http.ts';
import { rememberCompletedSharedJob } from './research/jobs.ts';

export interface CompletedResearch {
  id: string;
  status: 'done';
  kind: 'dossier' | 'episode' | null;
  data: unknown;
}

export interface ResearchIdentity {
  language: string;
  hadithInput?: string | null;
  question?: string | null;
  category?: string | null;
}

export interface SupabaseResearchConfig {
  url: string;
  apiKey: string;
  tables: string[];
}

export interface LookupOptions {
  fetch?: typeof fetch;
  config?: SupabaseResearchConfig | null;
}

const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function supabaseResearchConfig(env: NodeJS.ProcessEnv = process.env): SupabaseResearchConfig | null {
  const url = env.SUPABASE_URL?.replace(/\/$/, '') ?? '';
  const apiKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '';
  if (!url || !apiKey) return null;
  const tables = (env.SUPABASE_RESEARCH_TABLES || env.SUPABASE_RESEARCH_TABLE || 'research_records')
    .split(',')
    .map(name => name.trim())
    .filter(name => TABLE_NAME.test(name));
  if (!tables.length) return null;
  return { url, apiKey, tables };
}

/** PostgREST exact match. Quotes keep punctuation in hadith text inside the filter. */
export function eqFilter(value: string): string {
  return `eq."${value.replaceAll('"', '""')}"`;
}

function payloadOf(record: CompletedResearch): unknown {
  const data = record.data;
  if (isRecord(data) && isRecord(data.analysis) && !isRecord(data.agent_6_synthesis)) return data.analysis;
  return data;
}

export function analyzeReplayBody(record: CompletedResearch): Record<string, unknown> {
  const analysis = payloadOf(record);
  const spread = isRecord(analysis) ? analysis : {};
  return {
    ...spread,
    id: record.id,
    status: 'done',
    analysis,
    ...(record.kind ? { kind: record.kind } : {}),
  };
}

function isJobResponse(data: unknown): data is ResearchJobResponse {
  return isRecord(data) && isRecord(data.job) && typeof data.job.id === 'string' && 'dossier' in data;
}

export function sharedReplay(
  record: CompletedResearch,
  question: string,
  language: Lang,
  assignment: ResearchAssignmentView | null,
): ResearchJobResponse {
  const data = record.data;
  if (isJobResponse(data)) {
    return {
      contractVersion: '1.0.0',
      job: { ...data.job, id: record.id, status: 'done', question, language },
      dossier: data.dossier,
    };
  }
  const nested = isRecord(data) && isRecord(data.dossier) ? (data.dossier as unknown as ResearchDossierView) : null;
  const dossier = isRecord(data) && Array.isArray(data.passages) ? (data as unknown as ResearchDossierView) : nested;
  const now = new Date(0).toISOString();
  return {
    contractVersion: '1.0.0',
    job: {
      contractVersion: '1.0.0',
      id: record.id,
      question,
      language,
      subquestions: [],
      status: 'done',
      progress: { step: 'done', completed: 4, total: 4 },
      coverage: [],
      errors: [],
      startedAt: now,
      finishedAt: now,
      timingsMs: { totalMs: 0, sources: {} },
      assignment,
      agents: [],
    },
    dossier,
  };
}

async function readTable(
  config: SupabaseResearchConfig,
  table: string,
  params: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<unknown[] | null> {
  const url = `${config.url}/rest/v1/${table}?${params.toString()}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new UpstreamError('Could not check saved research before starting a new job.', 503);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new UpstreamError('Could not check saved research before starting a new job.', 503);
  const rows = (await response.json()) as unknown;
  if (!Array.isArray(rows)) throw new UpstreamError('Could not check saved research before starting a new job.', 503);
  return rows;
}

/**
 * Exact match for a finished dossier or episode.
 * Returns null when Supabase is not configured, so local runs keep starting jobs.
 * A configured database that cannot be read fails closed and does not start a duplicate job.
 */
export async function findCompletedResearch(identity: ResearchIdentity, options: LookupOptions = {}): Promise<CompletedResearch | null> {
  const config = 'config' in options ? options.config : supabaseResearchConfig();
  if (!config) return null;
  const fetchImpl = options.fetch ?? fetch;
  const language = identity.language.trim();
  const hadithInput = identity.hadithInput?.trim() ?? '';
  const question = identity.question?.trim() ?? '';
  const category = identity.category?.trim() ?? '';
  if (!language) return null;
  if (!hadithInput && !(question && category)) return null;

  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('status', 'eq.done');
  params.set('language', eqFilter(language));
  params.set('limit', '1');
  if (hadithInput) params.set('hadith_input', eqFilter(hadithInput));
  else {
    params.set('question', eqFilter(question));
    params.set('category', eqFilter(category));
  }

  let sawTable = false;
  for (const table of config.tables) {
    const rows = await readTable(config, table, params, fetchImpl);
    if (rows === null) continue;
    sawTable = true;
    for (const row of rows) {
      if (!isRecord(row) || row.status !== 'done' || row.data == null) continue;
      const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : '';
      if (!id) continue;
      const kind = row.kind === 'dossier' || row.kind === 'episode' ? row.kind : null;
      return { id, status: 'done', kind, data: row.data };
    }
  }
  if (!sawTable) throw new UpstreamError('Could not check saved research before starting a new job.', 503);
  return null;
}

/** Seed the poll cache and return the HTTP body. Null means the caller should start a job. */
export async function replayHadithAnalysis(
  hadithInput: string,
  language: string,
  options?: LookupOptions,
): Promise<Record<string, unknown> | null> {
  const found = await findCompletedResearch({ hadithInput, language }, options);
  if (!found) return null;
  rememberCompletedAnalysis(found.id, payloadOf(found));
  return analyzeReplayBody(found);
}

export async function replaySharedResearch(
  question: string,
  language: Lang,
  category: string,
  assignment: ResearchAssignmentView | null,
  options?: LookupOptions,
): Promise<ResearchJobResponse | null> {
  const found = await findCompletedResearch({ question, category, language }, options);
  if (!found) return null;
  const response = sharedReplay(found, question, language, assignment);
  rememberCompletedSharedJob(response, assignment);
  return response;
}

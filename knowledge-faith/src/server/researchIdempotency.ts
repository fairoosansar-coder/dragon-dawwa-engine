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
const DIRECT_DB_HOST = /^db\.([a-z0-9]+)\.supabase\.co$/i;

class LookupTransportError extends Error {
  override readonly cause: unknown;

  constructor(cause: unknown) {
    super('Saved research lookup could not reach Supabase');
    this.name = 'LookupTransportError';
    this.cause = cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * PostgREST lives on `https://<ref>.supabase.co`, which has IPv4.
 * `db.<ref>.supabase.co` is the direct database host and is IPv6-only, so fetch throws
 * ENETUNREACH when IPv6 egress is disabled. A pasted REST path is reduced to the origin
 * so the request is not sent to `/rest/v1/rest/v1/...`.
 */
export function supabaseApiOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return '';
  }
  if (parsed.username || parsed.password) return '';
  const direct = DIRECT_DB_HOST.exec(parsed.hostname);
  if (direct) return `https://${direct[1]}.supabase.co`;
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
  return parsed.origin;
}

function lookupHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'supabase';
  }
}

function transportCode(err: unknown): string {
  const seen = new Set<unknown>();
  let current = err;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if ('code' in current && typeof current.code === 'string' && current.code) return current.code;
    current = 'cause' in current ? current.cause : undefined;
  }
  return err instanceof Error ? err.name : 'Error';
}

export function supabaseResearchConfig(env: NodeJS.ProcessEnv = process.env): SupabaseResearchConfig | null {
  const rawUrl = env.SUPABASE_URL ?? '';
  const url = supabaseApiOrigin(rawUrl);
  const apiKey = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || '').replace(/\s+/g, '');
  if (!url || !apiKey) {
    if (rawUrl.trim() && !url) {
      console.error('Saved research lookup has no usable Supabase API origin. A new research job will start.');
    }
    return null;
  }
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

function unwrapStored(data: unknown): unknown {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      return data;
    }
  }
  if (isRecord(data) && isRecord(data.analysis) && !isRecord(data.agent_6_synthesis)) return data.analysis;
  return data;
}

function payloadOf(record: CompletedResearch): unknown {
  return unwrapStored(record.data);
}

/** Analysis object stored on a completed row. Null when the row has no JSON object. */
export function storedAnalysisJson(record: CompletedResearch): Record<string, unknown> | null {
  const analysis = unwrapStored(record.data);
  return isRecord(analysis) ? analysis : null;
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
  } catch (err) {
    throw new LookupTransportError(err);
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
 * Returns null when the host cannot be reached, so a missing DNS name or an IPv6-only
 * database host does not block a new job. A database that answers with an error still
 * fails closed and does not start a duplicate job.
 */
export async function findCompletedResearch(identity: ResearchIdentity, options: LookupOptions = {}): Promise<CompletedResearch | null> {
  const given = 'config' in options ? options.config : supabaseResearchConfig();
  if (!given) return null;
  const origin = supabaseApiOrigin(given.url);
  if (!origin) return null;
  const config = origin === given.url ? given : { ...given, url: origin };
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
  try {
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
  } catch (err) {
    if (err instanceof LookupTransportError) {
      console.error(
        `Saved research lookup could not reach ${lookupHost(config.url)} (${transportCode(err)}). A new research job will start.`,
      );
      return null;
    }
    throw err;
  }
  if (!sawTable) throw new UpstreamError('Could not check saved research before starting a new job.', 503);
  return null;
}

/** Category rows are keyed by question + canonical category, not by hadith text. */
export async function replayCategoryAnalysis(
  question: string,
  language: string,
  category: string,
  options?: LookupOptions,
): Promise<Record<string, unknown> | null> {
  const found = await findCompletedResearch({ question, category, language }, options);
  if (!found) return null;
  rememberCompletedAnalysis(found.id, payloadOf(found));
  return analyzeReplayBody(found);
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

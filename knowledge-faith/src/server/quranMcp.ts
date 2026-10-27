import { UpstreamError } from './http.ts';
import {
  MCP_EDITION_REJECTED,
  MCP_FAILED,
  MCP_REFUSED,
  parseAyahKey,
  parseEditionId,
  parseMcpMessages,
  projectEditions,
  projectMorphology,
  projectSearch,
  projectTafsir,
  searchArguments,
  structuredContent,
  tafsirArguments,
  toolFailureDetail,
  type McpEdition,
  type McpEditionType,
  type McpMorphology,
  type McpSearchResult,
  type McpTafsirResult,
} from '../shared/quranMcp.ts';

const MCP_URL = 'https://mcp.quran.ai/';
const TTL_MS = 12 * 60 * 60 * 1000;
const EMPTY_TTL_MS = 2 * 60 * 1000;
const MAX_ENTRIES = 200;
const GAP_MS = 1100;

interface CacheEntry {
  expires: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
let chain: Promise<void> = Promise.resolve();
let lastAt = 0;
let sessionId: string | null = null;
let opening: Promise<string> | null = null;
let rpcId = 1;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function remember(key: string, value: unknown, ttl: number): void {
  cache.set(key, { expires: Date.now() + ttl, value });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

function readCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

/** One hosted call at a time. The public server allows about one tool call a second. */
function paced<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastAt ? GAP_MS - (Date.now() - lastAt) : 0;
    if (wait > 0) await delay(wait);
    try {
      return await job();
    } finally {
      lastAt = Date.now();
    }
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function mcpPost(body: unknown, session: string | null): Promise<{ status: number; session: string | null; messages: unknown[] }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2025-03-26',
    'User-Agent': 'DragonDawwa/1.0 (Knowledge and Faith research)',
  };
  if (session) headers['Mcp-Session-Id'] = session;
  let response: Response;
  try {
    response = await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new UpstreamError(MCP_FAILED, 502);
  }
  const nextSession = response.headers.get('mcp-session-id') ?? session;
  const text = await response.text();
  if (response.status === 429) return { status: 429, session: nextSession, messages: [] };
  try {
    const messages = parseMcpMessages(text, response.headers.get('content-type'));
    return { status: response.status, session: nextSession, messages };
  } catch (error) {
    if (error instanceof Error && (error.message === 'refused' || error instanceof SyntaxError)) {
      throw new UpstreamError(MCP_REFUSED, 502);
    }
    throw new UpstreamError(MCP_FAILED, 502);
  }
}

async function openSession(): Promise<string> {
  const opened = await paced(() =>
    mcpPost(
      {
        jsonrpc: '2.0',
        id: rpcId++,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'dragon-dawwa', version: '0.1.0' },
        },
      },
      null,
    ),
  );
  if (opened.status !== 200 || !opened.session) throw new UpstreamError(MCP_REFUSED, 502);
  sessionId = opened.session;
  await paced(() => mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' }, sessionId));
  return sessionId;
}

async function ensureSession(): Promise<string> {
  if (sessionId) return sessionId;
  if (!opening) {
    opening = openSession().finally(() => {
      opening = null;
    });
  }
  return opening;
}

function messageFailed(messages: unknown[]): string | null {
  for (const message of messages) {
    const detail = toolFailureDetail(message);
    if (detail) return detail;
  }
  return null;
}

async function callTool(name: string, args: Record<string, unknown>, attempt = 0): Promise<unknown> {
  const sid = await ensureSession();
  const posted = await paced(() =>
    mcpPost(
      {
        jsonrpc: '2.0',
        id: rpcId++,
        method: 'tools/call',
        params: { name, arguments: args },
      },
      sid,
    ),
  );
  if (posted.session) sessionId = posted.session;
  const refused = posted.status === 429 || posted.status === 403 || messageFailed(posted.messages) === MCP_REFUSED;
  const expired = posted.status === 404 || posted.status === 400;
  if ((refused || expired) && attempt < 1) {
    if (expired) sessionId = null;
    await delay(GAP_MS);
    return callTool(name, args, attempt + 1);
  }
  if (posted.status === 429 || posted.status === 403) throw new UpstreamError(MCP_REFUSED, 502);
  if (posted.status < 200 || posted.status >= 300) throw new UpstreamError(MCP_FAILED, 502);
  const failure = messageFailed(posted.messages);
  if (failure) throw new UpstreamError(failure, 502);
  for (const message of posted.messages) {
    const payload = structuredContent(message);
    if (payload && typeof payload === 'object') return payload;
  }
  throw new UpstreamError(MCP_FAILED, 502);
}

async function load<T>(key: string, ttlFor: (value: T) => number, job: () => Promise<T>): Promise<T> {
  const hit = readCache<T>(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const run = job()
    .then(value => {
      remember(key, value, ttlFor(value));
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, run);
  return run;
}

export async function listMcpEditions(type: McpEditionType): Promise<McpEdition[]> {
  return load(`editions:${type}`, () => TTL_MS, async () => {
    const payload = await callTool('list_editions', { edition_type: type });
    return projectEditions(payload, type);
  });
}

export async function fetchMcpTafsir(ayah: string, edition: string): Promise<McpTafsirResult> {
  const args = tafsirArguments(ayah, edition);
  return load(`tafsir:${args.editions}:${args.ayahs}`, result => (result.passages.length ? TTL_MS : EMPTY_TTL_MS), async () => {
    const payload = await callTool('fetch_tafsir', args);
    return projectTafsir(payload, args.ayahs, args.editions);
  });
}

export async function fetchMcpMorphology(ayah: string): Promise<McpMorphology> {
  const key = parseAyahKey(ayah);
  if (!key) throw new UpstreamError('That verse cannot be requested.', 400);
  return load(`morphology:${key}`, result => (result.words.length ? TTL_MS : EMPTY_TTL_MS), async () => {
    const payload = await callTool('fetch_word_morphology', { ayah_key: key });
    return projectMorphology(payload, key);
  });
}

export async function searchMcpQuran(query: string, edition: string | null, surah: number | null): Promise<McpSearchResult> {
  const id = edition ? parseEditionId(edition) : null;
  if (edition && !id) throw new UpstreamError(MCP_EDITION_REJECTED, 400);
  const args = searchArguments(query, id, surah);
  const cacheKey = `search:${JSON.stringify(args)}`;
  return load(cacheKey, result => (result.hits.length ? TTL_MS : EMPTY_TTL_MS), async () => {
    const payload = await callTool('search_quran', args);
    return projectSearch(payload, query, id);
  });
}

/**
 * Anthropic Claude client used only for final multi-persona synthesis /
 * host reconciliation (and the hadith multi-persona dossier write-up).
 * Evidence gathering stays on Parallel / HadeethEnc / Gemini as configured.
 * When the key is missing or a call fails, callers fall back to Gemini.
 */

import { UpstreamError } from './http.ts';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
/** Default Claude Sonnet for final 7-role synthesis (override with ANTHROPIC_SYNTHESIS_MODEL). */
const DEFAULT_SYNTHESIS_MODEL = 'claude-sonnet-4-20250514';

export function hasAnthropicApiKey(value: string | undefined): value is string {
  const key = value?.trim() ?? '';
  return Boolean(key) && key !== 'MY_ANTHROPIC_API_KEY';
}

export function anthropicConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return hasAnthropicApiKey(env.ANTHROPIC_API_KEY);
}

export function anthropicSynthesisModel(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.ANTHROPIC_SYNTHESIS_MODEL?.trim();
  return override || DEFAULT_SYNTHESIS_MODEL;
}

export interface AnthropicJsonResult<T> {
  value: T;
  model: string;
  provider: 'anthropic';
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return typeof content === 'string' ? content : '';
  return content
    .map(block => {
      if (!block || typeof block !== 'object') return '';
      const row = block as { type?: string; text?: string };
      return row.type === 'text' && typeof row.text === 'string' ? row.text : '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseJsonObject<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Anthropic response did not contain a JSON object.');
  return JSON.parse(body.slice(start, end + 1)) as T;
}

function isTemporary(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err ?? '');
  return /429|529|503|UNAVAILABLE|overloaded|high demand|rate.?limit/i.test(msg);
}

/**
 * Messages API JSON completion for synthesis-only callers.
 * Does not replace Parallel evidence gathering or HadeethEnc open.
 */
export async function completeAnthropicJson<T>(input: {
  system: string;
  user: string;
  maxTokens?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiKey?: string | null;
  model?: string;
}): Promise<AnthropicJsonResult<T>> {
  const apiKey = input.apiKey === undefined ? process.env.ANTHROPIC_API_KEY : input.apiKey;
  if (!hasAnthropicApiKey(apiKey ?? undefined)) {
    throw new UpstreamError('Anthropic synthesis is not configured (ANTHROPIC_API_KEY missing).', 503);
  }
  const model = input.model?.trim() || anthropicSynthesisModel();
  const fetchImpl = input.fetchImpl ?? fetch;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (input.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      const response = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        signal: input.signal ?? AbortSignal.timeout(180_000),
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey!.trim(),
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: input.maxTokens ?? 8192,
          temperature: 0.2,
          system: input.system,
          messages: [{ role: 'user', content: input.user }],
        }),
      });
      const raw = await response.text();
      if (!response.ok) {
        const err = new Error(`Anthropic ${response.status}: ${raw.slice(0, 400)}`);
        (err as { status?: number }).status = response.status;
        throw err;
      }
      const payload = JSON.parse(raw) as { content?: unknown };
      const text = extractText(payload.content);
      if (!text) throw new Error('Anthropic returned an empty synthesis body.');
      return { value: parseJsonObject<T>(text), model, provider: 'anthropic' };
    } catch (err) {
      lastError = err;
      if (input.signal?.aborted) throw err;
      if (isTemporary(err) && attempt < 2) {
        await new Promise(r => setTimeout(r, 800 * attempt));
        continue;
      }
      break;
    }
  }
  console.error('Anthropic synthesis failed:', (lastError as Error)?.message ?? lastError);
  throw new UpstreamError('Anthropic synthesis is busy or unavailable. Falling back when possible.', 503);
}

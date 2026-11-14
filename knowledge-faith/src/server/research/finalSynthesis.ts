/**
 * Final multi-persona / host reconciliation write-up.
 * Prefers Claude Sonnet (opened-sources-only prompts); falls back to Gemini;
 * returns null when neither provider can complete so callers keep their local script.
 */

import type { Schema } from '@google/genai';
import { Type } from '@google/genai';
import { anthropicConfigured, completeAnthropicJson } from '../anthropic.ts';
import { generateJsonWithModels, geminiConfigured } from '../gemini.ts';
import { researchSystemInstructionsForQuestion, userFacingResearchQuestion } from '../../shared/modernWorldBenchmarks.ts';
import type { Lang } from '../../shared/sources.ts';
import { finalSynthesisSystemPrompt, SPEAKER_LABEL, type DomainAgentConfig } from './agentConfig.ts';

export type SynthesisProvider = 'anthropic' | 'gemini';

/** Minimal agent slice needed for host reconciliation (avoids importing the orchestrator). */
export interface SynthesisAgentBrief {
  id: string;
  role: string;
  persona: string;
  speaker: string;
  status: 'ran' | 'not_run';
  finding: string;
  sources: { title: string; url: string; excerpt: string }[];
}

export interface HostReconciliationResult {
  final_status: string;
  consensus_and_disagreements: string;
  executive_report_markdown: string;
  podcast_script: string;
  model: string;
  provider: SynthesisProvider;
}

const hostReconciliationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    final_status: { type: Type.STRING },
    consensus_and_disagreements: { type: Type.STRING },
    executive_report_markdown: { type: Type.STRING },
    podcast_script: { type: Type.STRING },
  },
  required: ['final_status', 'consensus_and_disagreements', 'executive_report_markdown', 'podcast_script'],
};

function agentBrief(agents: readonly SynthesisAgentBrief[]): string {
  return agents
    .map(agent => {
      const sources = agent.sources
        .slice(0, 4)
        .map(source => `  - ${source.title}: ${source.excerpt}${source.url ? ` (${source.url})` : ''}`)
        .join('\n');
      return [
        `Agent id: ${agent.id}`,
        `Role: ${agent.role}`,
        `Persona: ${agent.persona}`,
        `Speaker label: ${agent.speaker}`,
        `Status: ${agent.status}`,
        `Finding: ${agent.finding || '(empty)'}`,
        sources ? `Opened sources:\n${sources}` : 'Opened sources: none',
      ].join('\n');
    })
    .join('\n\n');
}

export function hostReconciliationUserPrompt(input: {
  question: string;
  language: Lang;
  categoryLabel: string;
  agents: readonly SynthesisAgentBrief[];
  baseExecutiveReport: string;
  basePodcastScript: string;
}): string {
  const languageRules =
    input.language === 'ta'
      ? [
          'Compose podcast_script DIRECTLY in natural scholarly Tamil (தமிழ்). Do not draft English then translate.',
          'Never transliterate English into Tamil script (ban: "டீசிங் புக் அண்ட் விஸ்டம்", Latin "Wahy", "முகவர்").',
          'Use: வஹீ, வேதத்தையும் ஞானத்தையும் கற்பித்தல், ஆய்வுக் குழு, நாகரிக எழுச்சி.',
          'Greeting: அஸ்ஸலாமு அலைக்கும் only — never வணக்கம்.',
        ].join(' ')
      : input.language === 'si'
        ? 'Compose podcast_script DIRECTLY in natural scholarly Sinhala. Do not draft English then translate. Do not transliterate English into Sinhala letters.'
        : 'Compose podcast_script in natural English.';

  return [
    'Write the final multi-persona host reconciliation for Dragon Dawwa Institutional Research Studio.',
    `Category: ${input.categoryLabel}`,
    `Output language: ${input.language} (en = English, ta = Tamil, si = Sinhala). Write podcast_script and narrative fields in that language.`,
    languageRules,
    `Question: ${userFacingResearchQuestion(input.question)}`,
    researchSystemInstructionsForQuestion(input.question)
      ? `Internal evidence rubric (never read aloud / never paste into spoken Host lines): ${researchSystemInstructionsForQuestion(input.question)}`
      : '',
    '',
    'OPENED AGENT FINDINGS (cite only these; never invent a verse, hadith, grade, or URL):',
    agentBrief(input.agents),
    '',
    'BASE EXECUTIVE REPORT (you may refine; keep the category/dispatch/source lists accurate):',
    input.baseExecutiveReport,
    '',
    'BASE PODCAST SCRIPT (compose/refine as native multi-persona dialogue in the output language; keep player labels such as',
    `${SPEAKER_LABEL.host} ${SPEAKER_LABEL.tariq} ${SPEAKER_LABEL.layla} etc.):`,
    input.basePodcastScript,
    '',
    'Return JSON with keys: final_status, consensus_and_disagreements, executive_report_markdown, podcast_script.',
    'final_status must remain "Not a hadith grade" for non-hadith desks.',
    'Preserve evidence discipline: opened sources only; never invent citations.',
  ].join('\n');
}

async function viaAnthropic(system: string, user: string, signal?: AbortSignal): Promise<HostReconciliationResult | null> {
  if (!anthropicConfigured()) return null;
  try {
    const { value, model } = await completeAnthropicJson<{
      final_status?: string;
      consensus_and_disagreements?: string;
      executive_report_markdown?: string;
      podcast_script?: string;
    }>({ system, user, signal });
    const podcast = String(value.podcast_script ?? '').trim();
    const report = String(value.executive_report_markdown ?? '').trim();
    if (!podcast || !report) return null;
    return {
      final_status: String(value.final_status ?? 'Not a hadith grade').trim() || 'Not a hadith grade',
      consensus_and_disagreements: String(value.consensus_and_disagreements ?? '').trim(),
      executive_report_markdown: report,
      podcast_script: podcast,
      model,
      provider: 'anthropic',
    };
  } catch (err) {
    console.error('Claude host reconciliation failed; trying Gemini fallback:', (err as Error)?.message ?? err);
    return null;
  }
}

/** Preferred Gemini Flash fallback when Anthropic is missing or fails. */
export const GEMINI_SYNTHESIS_FALLBACK_MODEL = 'gemini-3.8-flash';

async function viaGemini(system: string, user: string, signal?: AbortSignal): Promise<HostReconciliationResult | null> {
  if (!geminiConfigured()) return null;
  try {
    const { value, model } = await generateJsonWithModels<{
      final_status: string;
      consensus_and_disagreements: string;
      executive_report_markdown: string;
      podcast_script: string;
    }>(`${system}\n\n${user}`, hostReconciliationSchema, [GEMINI_SYNTHESIS_FALLBACK_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'], signal);
    const podcast = String(value.podcast_script ?? '').trim();
    const report = String(value.executive_report_markdown ?? '').trim();
    if (!podcast || !report) return null;
    return {
      final_status: String(value.final_status ?? 'Not a hadith grade').trim() || 'Not a hadith grade',
      consensus_and_disagreements: String(value.consensus_and_disagreements ?? '').trim(),
      executive_report_markdown: report,
      podcast_script: podcast,
      model,
      provider: 'gemini',
    };
  } catch (err) {
    console.error('Gemini host reconciliation failed:', (err as Error)?.message ?? err);
    return null;
  }
}

/** Claude first, then Gemini. Null means keep the deterministic local script. */
export async function writeHostReconciliation(input: {
  question: string;
  language: Lang;
  categoryLabel: string;
  agents: readonly SynthesisAgentBrief[];
  baseExecutiveReport: string;
  basePodcastScript: string;
  signal?: AbortSignal;
}): Promise<HostReconciliationResult | null> {
  const system = finalSynthesisSystemPrompt();
  const user = hostReconciliationUserPrompt(input);
  return (await viaAnthropic(system, user, input.signal)) ?? (await viaGemini(system, user, input.signal));
}

/** Exported for tests — confirms reconciliation agents still receive the persona-bearing system prompt. */
export function reconciliationUsesFinalPrompt(agents: readonly DomainAgentConfig[]): boolean {
  return agents.some(agent => agent.id === 'reconciliation' && agent.systemPrompt.includes(finalSynthesisSystemPrompt()));
}

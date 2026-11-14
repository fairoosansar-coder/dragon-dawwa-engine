/**
 * Socratic Cross-Examine / Follow-Up rebuttal handler.
 * Uses REBUTTAL_AND_SYNTHESIS_PERSONA; Claude Sonnet first, Gemini fallback.
 */

import { randomUUID } from 'node:crypto';
import { Type, type Schema } from '@google/genai';
import type { Lang } from '../../shared/sources.ts';
import { LANGUAGE_NAMES } from '../../shared/sources.ts';
import { anthropicConfigured, completeAnthropicJson } from '../anthropic.ts';
import { generateJsonWithModels, geminiConfigured } from '../gemini.ts';
import { followUpRebuttalSystemPrompt } from './agentConfig.ts';
import { GEMINI_SYNTHESIS_FALLBACK_MODEL } from './finalSynthesis.ts';
import { openHadeethEncForQuestion } from './hadeethOpen.ts';
import { expandSemanticQuery, mergeExpansionQueries } from './semanticExpansion.ts';
import {
  appendFollowUpTurn,
  loadFollowUpThread,
  type FollowUpOpenedSource,
  type FollowUpThread,
  type FollowUpTurn,
} from './followupStore.ts';
import { loadHadeeth, searchHadeeth } from '../hadeethenc.ts';

export interface FollowUpRequest {
  dossierId: string;
  originalQuestion: string;
  previousSynthesis: string;
  openedSources: FollowUpOpenedSource[];
  userCounterArgument: string;
  language: Lang;
}

export interface FollowUpResponse {
  dossierId: string;
  turn: FollowUpTurn;
  thread: FollowUpThread;
}

const replySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
  },
  required: ['reply'],
};

function needsTargetedRetrieval(counter: string): boolean {
  return /\b(?:verse|ayah|surah|hadith|hadeeth|bukhari|muslim|qur['’]?an|citation|prove|where does|show me)\b|\d{1,3}\s*:\s*\d{1,3}/i.test(counter);
}

async function targetedOpen(language: Lang, counter: string, question: string): Promise<FollowUpOpenedSource[]> {
  const expansion = await expandSemanticQuery(`${question}\n${counter}`, language);
  const queries = mergeExpansionQueries([counter.slice(0, 120)], expansion, language, 6);
  const opened = await openHadeethEncForQuestion({
    question: counter,
    language,
    queries,
    search: async (lang, phrase) => {
      const found = await searchHadeeth(lang, phrase.slice(0, 100), 1);
      return found.items.map(item => ({ id: item.id, title: item.title }));
    },
    load: async (lang, id) => {
      const record = await loadHadeeth(lang, id);
      return {
        id: record.id,
        title: record.title,
        text: record.text,
        arabic: record.arabic,
        grade: record.grade,
        attribution: record.attribution,
        explanation: record.explanation,
        lessons: record.lessons,
        url: record.sourceUrl,
      };
    },
  });
  return opened.records.slice(0, 4).map(record => ({
    id: record.id,
    label: `HadeethEnc ${record.id}`,
    text: [record.arabic, record.text, record.grade].filter(Boolean).join('\n').slice(0, 800),
    url: record.url,
  }));
}

function packet(sources: readonly FollowUpOpenedSource[]): string {
  if (!sources.length) return '(No additional opened sources for this turn.)';
  return sources
    .map((source, index) => `[S${index + 1}] ${source.label}\n${source.text ?? ''}${source.url ? `\nURL: ${source.url}` : ''}`)
    .join('\n\n');
}

async function writeRebuttal(input: {
  language: Lang;
  originalQuestion: string;
  previousSynthesis: string;
  counter: string;
  sources: FollowUpOpenedSource[];
}): Promise<{ reply: string; model: string; provider: FollowUpTurn['provider'] }> {
  const system = followUpRebuttalSystemPrompt();
  const user = [
    `Write in ${LANGUAGE_NAMES[input.language].english}.`,
    'Respond to the seeker’s counter-argument with Hikmah. Steel-man first. Never invent a citation.',
    '',
    `ORIGINAL QUESTION:\n${input.originalQuestion}`,
    '',
    `PREVIOUS SYNTHESIS:\n${input.previousSynthesis.slice(0, 6000)}`,
    '',
    `USER COUNTER-ARGUMENT:\n${input.counter}`,
    '',
    `OPENED SOURCES (cite only these):\n${packet(input.sources)}`,
    '',
    'Return JSON: { "reply": "..." }',
  ].join('\n');

  if (anthropicConfigured()) {
    try {
      const { value, model } = await completeAnthropicJson<{ reply?: string }>({ system, user, maxTokens: 4096 });
      const reply = String(value.reply ?? '').trim();
      if (reply) return { reply, model, provider: 'anthropic' };
    } catch (err) {
      console.error('Claude follow-up failed; falling back to Gemini:', (err as Error)?.message ?? err);
    }
  }

  if (geminiConfigured()) {
    try {
      const { value, model } = await generateJsonWithModels<{ reply: string }>(
        `${system}\n\n${user}`,
        replySchema,
        [GEMINI_SYNTHESIS_FALLBACK_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'],
      );
      const reply = String(value.reply ?? '').trim();
      if (reply) return { reply, model, provider: 'gemini' };
    } catch (err) {
      console.error('Gemini follow-up failed:', (err as Error)?.message ?? err);
    }
  }

  return {
    reply:
      'I hear the force of your objection. From the sources already opened for this dossier, I can only rest on what those passages actually state; I will not invent a verse or hadith that was not retrieved. Please open a specific citation and we can examine it together with Hikmah.',
    model: 'local-fallback',
    provider: 'local',
  };
}

export async function runResearchFollowUp(input: FollowUpRequest): Promise<FollowUpResponse> {
  const dossierId = String(input.dossierId ?? '').trim();
  const counter = String(input.userCounterArgument ?? '').trim();
  if (!dossierId) throw new Error('dossierId is required.');
  if (counter.length < 3) throw new Error('userCounterArgument is required.');

  const language = input.language ?? 'en';
  const opened = Array.isArray(input.openedSources) ? input.openedSources : [];
  let extra: FollowUpOpenedSource[] = [];
  let targetedRetrievalRan = false;
  if (needsTargetedRetrieval(counter)) {
    targetedRetrievalRan = true;
    try {
      extra = await targetedOpen(language, counter, input.originalQuestion || '');
    } catch (err) {
      console.error('Follow-up targeted retrieval failed:', (err as Error)?.message ?? err);
    }
  }
  const sourcesUsed = [...opened, ...extra].slice(0, 12);
  const written = await writeRebuttal({
    language,
    originalQuestion: input.originalQuestion || '',
    previousSynthesis: input.previousSynthesis || '',
    counter,
    sources: sourcesUsed,
  });

  const turn: FollowUpTurn = {
    id: `fu-${randomUUID().slice(0, 8)}`,
    at: new Date().toISOString(),
    language,
    userCounterArgument: counter,
    reply: written.reply,
    model: written.model,
    provider: written.provider,
    openedSourcesUsed: sourcesUsed,
    targetedRetrievalRan,
  };

  const thread = appendFollowUpTurn(
    dossierId,
    {
      dossierId,
      originalQuestion: input.originalQuestion || '',
      previousSynthesis: input.previousSynthesis || '',
      language,
      openedSources: opened,
    },
    turn,
  );

  return { dossierId, turn, thread };
}

export function getResearchFollowUpThread(dossierId: string): FollowUpThread | null {
  return loadFollowUpThread(dossierId);
}

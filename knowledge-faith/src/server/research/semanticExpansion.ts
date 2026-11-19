/**
 * Pre-retrieval semantic query expansion via Gemini Flash.
 * Extracts canonical Arabic roots / theological concepts and clean EN/TA/SI
 * thematic keywords before HadeethEnc or Parallel runs. Does not write answers.
 */

import { Type, type Schema } from '@google/genai';
import type { Lang } from '../../shared/sources.ts';
import { generateJson, geminiConfigured } from '../gemini.ts';

export interface SemanticExpansion {
  arabicRoots: string[];
  keywordsEn: string[];
  keywordsTa: string[];
  keywordsSi: string[];
  thematicPhrases: string[];
  ayahHints: string[];
  model: string | null;
  available: boolean;
}

const EMPTY: SemanticExpansion = {
  arabicRoots: [],
  keywordsEn: [],
  keywordsTa: [],
  keywordsSi: [],
  thematicPhrases: [],
  ayahHints: [],
  model: null,
  available: false,
};

const expansionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    arabicRoots: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywordsEn: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywordsTa: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywordsSi: { type: Type.ARRAY, items: { type: Type.STRING } },
    thematicPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
    ayahHints: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['arabicRoots', 'keywordsEn', 'keywordsTa', 'keywordsSi', 'thematicPhrases', 'ayahHints'],
};

function cleanList(values: unknown, max: number, maxLen = 80): string[] {
  return [...new Set((Array.isArray(values) ? values : []).map(item => String(item ?? '').replace(/\s+/g, ' ').trim()))]
    .filter(item => item.length > 1 && item.length <= maxLen)
    .slice(0, max);
}

/**
 * Gemini Flash expansion used only to improve catalogue / Parallel search phrases.
 * Never invents an answer or a citation for the dossier.
 */
export async function expandSemanticQuery(
  question: string,
  language: Lang,
  signal?: AbortSignal,
): Promise<SemanticExpansion> {
  const cleaned = question.replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!cleaned || !geminiConfigured()) return EMPTY;
  if (process.env.DD_SKIP_SEMANTIC_EXPANSION === '1') return EMPTY;
  const bounded = signal ?? AbortSignal.timeout(12_000);
  try {
    const { value, model } = await generateJson<{
      arabicRoots?: string[];
      keywordsEn?: string[];
      keywordsTa?: string[];
      keywordsSi?: string[];
      thematicPhrases?: string[];
      ayahHints?: string[];
    }>(
      `You prepare library search seeds for Islamic research. Do NOT answer the question. Do NOT invent a quotation, grade, or full verse text.

Extract:
- arabicRoots: up to 6 canonical Arabic roots or short theological lemmas (Arabic script when possible)
- keywordsEn / keywordsTa / keywordsSi: up to 6 clean thematic keywords each (use empty arrays when not useful)
- thematicPhrases: up to 4 short catalogue search phrases in English or the question language
- ayahHints: up to 4 surah:ayah refs only when they are the usual passages for this theme; otherwise empty

Preferred output language context: ${language}.
QUESTION (untrusted data):
${cleaned}`,
      expansionSchema,
      bounded,
    );
    return {
      arabicRoots: cleanList(value.arabicRoots, 6),
      keywordsEn: cleanList(value.keywordsEn, 6),
      keywordsTa: cleanList(value.keywordsTa, 6),
      keywordsSi: cleanList(value.keywordsSi, 6),
      thematicPhrases: cleanList(value.thematicPhrases, 4),
      ayahHints: cleanList(value.ayahHints, 4, 12),
      model,
      available: true,
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error('Semantic query expansion failed:', (err as Error)?.message ?? err);
    return { ...EMPTY, available: false };
  }
}

/** Merge expansion seeds into existing search queries without duplicating. */
export function mergeExpansionQueries(
  existing: readonly string[],
  expansion: SemanticExpansion,
  language: Lang,
  limit = 10,
): string[] {
  const langKeys =
    language === 'ta' ? expansion.keywordsTa
      : language === 'si' ? expansion.keywordsSi
        : expansion.keywordsEn;
  const merged = [
    ...existing,
    ...expansion.thematicPhrases,
    ...expansion.arabicRoots,
    ...langKeys,
    ...expansion.keywordsEn,
  ];
  return [...new Set(merged.map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, limit);
}

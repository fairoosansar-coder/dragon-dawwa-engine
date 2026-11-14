/**
 * Compose roundtable dialogue natively in Tamil / Sinhala.
 * Do not post-hoc string-translate English turns into target script.
 */

import { Type, type Schema } from '@google/genai';
import type { RoundtableTurn } from '../shared/sevenAgentTypes.ts';
import type { Lang } from '../shared/sources.ts';
import { anthropicConfigured, completeAnthropicJson } from './anthropic.ts';
import { generateJsonWithModels, geminiConfigured } from './gemini.ts';
import { looksLikeMetaCacheIsolationDialogue } from './modernWorldNativeRoundtables.ts';

const turnSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    turns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
        },
        required: ['speaker', 'text'],
      },
    },
  },
  required: ['turns'],
};

function nativeLanguageRules(lang: Lang): string {
  if (lang === 'ta') {
    return [
      'Compose every spoken turn in natural, scholarly Tamil (தமிழ் script).',
      'NEVER transliterate English into Tamil letters (forbidden examples: "டீசிங் புக் அண்ட் விஸ்டம்", "முகவர்", "Wahy" written as Latin inside Tamil prose).',
      'Use proper Tamil equivalents: வஹீ (for Wahy), வேதத்தையும் ஞானத்தையும் கற்பித்தல், ஆய்வுக் குழு, நாகரிக எழுச்சி, வெளிப்படுத்தல்.',
      'Keep speaker display names in English for UI (Brother Feroz, Dr. Tariq, etc.).',
      'Greeting must be அஸ்ஸலாமு அலைக்கும் — never வணக்கம்.',
    ].join('\n');
  }
  if (lang === 'si') {
    return [
      'Compose every spoken turn in natural, scholarly Sinhala (සිංහල script).',
      'Do not transliterate English phrases into Sinhala letters.',
      'Keep speaker display names in English for UI.',
      'Greeting must be අස්සලාමු අලයිකුම්.',
    ].join('\n');
  }
  return 'Compose in natural English.';
}

function systemPrompt(lang: Lang): string {
  return [
    'You are the Dragon Dawwa Roundtable Studio Director.',
    'Rewrite the English scholarly roundtable as a native dialogue in the target language.',
    'Preserve meaning, speakers, and evidence references. Do not invent new citations.',
    'Do NOT produce a literal machine translation; write as native panelists speaking.',
    'FORBIDDEN in spoken dialogue: QA/debug narration, cache isolation talk, “we refuse to paste gold-ring / Muslim 2089 / prior dossier” meta, software placeholders, or comments about unrelated previous research jobs.',
    'Answer only the seeker’s scholarly question with Qur’an, Seerah, Hadith, fiqh, and hikmah evidence.',
    nativeLanguageRules(lang),
  ].join('\n');
}

function userPrompt(turns: readonly RoundtableTurn[], lang: Lang): string {
  const english = turns
    .map((t, i) => `${i + 1}. ${t.speaker} (${t.role}): ${t.text}`)
    .join('\n');
  return [
    `Target language code: ${lang}`,
    'Return JSON { "turns": [ { "speaker": "...", "text": "..." }, ... ] } with the SAME speakers in the SAME order.',
    'English source dialogue (meaning only — do not copy Latin wording into Tamil/Sinhala):',
    english,
  ].join('\n\n');
}

/**
 * Prefer Claude, then Gemini. On failure returns null so callers can keep English
 * rather than emit broken transliteration via string MT.
 */
export async function composeNativeRoundtableTurns(
  turns: readonly RoundtableTurn[],
  lang: Lang,
): Promise<RoundtableTurn[] | null> {
  if (lang === 'en' || turns.length === 0) return turns.slice() as RoundtableTurn[];

  const system = systemPrompt(lang);
  const user = userPrompt(turns, lang);

  if (anthropicConfigured()) {
    try {
      const { value } = await completeAnthropicJson<{
        turns?: Array<{ speaker?: string; text?: string }>;
      }>({ system, user });
      const next = mergeNativeTurns(turns, value?.turns);
      if (next) return next;
    } catch (err) {
      console.error('Native roundtable (Claude) failed:', (err as Error)?.message ?? err);
    }
  }

  if (geminiConfigured()) {
    try {
      const { value } = await generateJsonWithModels<{
        turns: Array<{ speaker: string; text: string }>;
      }>(`${system}\n\n${user}`, turnSchema, ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash']);
      const next = mergeNativeTurns(turns, value?.turns);
      if (next) return next;
    } catch (err) {
      console.error('Native roundtable (Gemini) failed:', (err as Error)?.message ?? err);
    }
  }

  return null;
}

function mergeNativeTurns(
  source: readonly RoundtableTurn[],
  generated: Array<{ speaker?: string; text?: string }> | undefined,
): RoundtableTurn[] | null {
  if (!Array.isArray(generated) || generated.length !== source.length) return null;
  const out: RoundtableTurn[] = [];
  for (let i = 0; i < source.length; i++) {
    const text = String(generated[i]?.text ?? '').trim();
    if (text.length < 12) return null;
    out.push({
      ...source[i],
      speaker: source[i].speaker,
      text,
    });
  }
  // Never ship QA/cache-isolation meta as user-facing dialogue.
  if (looksLikeMetaCacheIsolationDialogue(out)) return null;
  return out;
}

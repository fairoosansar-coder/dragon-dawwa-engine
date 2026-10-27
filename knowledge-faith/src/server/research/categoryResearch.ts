/**
 * Category research for every analyzer topic except Hadith & Authentication.
 * Parallel.ai is called through consultParallel (the existing task-run client).
 * Gemini then writes the dossier the podcast player already parses.
 * API keys are read here and never logged.
 */

import type { DragonDawwaAnalysis } from '../../engine/types/hadith.ts';
import { generatedContentForLanguage, scriptMatchesLanguage, languageFailureMessage } from '../../engine/utils/contentLanguage.ts';
import { scrubVanakkam } from '../../engine/utils/tamilGreeting.ts';
import { hasGeminiApiKey } from '../loadEnv.ts';
import { awaitParallelResult, consultParallel, type ParallelConsult, type ParallelFinding } from './parallelTask.ts';

const CHAIR_PROMPT =
  "You are Amina, the Chair. Use this Parallel.ai research data to write an executive report and a podcast script. Output the exact JSON schema. Fill Agents 1-5 with 'N/A' or empty arrays since this is not a Hadith. For agent_6_synthesis.podcast_script, write a multi-voice script between BROTHER FEROZ (Host) and ZAYD (The Polymath Researcher). Zayd presents the scientific/comparative findings.";

const MODEL_CANDIDATES = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

export interface ParallelResearchDeps {
  geminiApiKey?: string;
  fetchImpl?: typeof fetch;
  pollMs?: number;
  deadlineMs?: number;
  generateContent?: (input: { systemInstruction: string; prompt: string }) => Promise<string>;
}

function languageName(lang: 'en' | 'ta' | 'si'): string {
  if (lang === 'ta') return 'Tamil (தமிழ்)';
  if (lang === 'si') return 'Sinhala (සිංහල)';
  return 'English';
}

function parallelQuestion(category: string, query: string, lang: 'en' | 'ta' | 'si'): string {
  return [
    `Category: ${category}`,
    `Question: ${query}`,
    `Language: ${languageName(lang)}`,
    'Return sources, surrounding context, and scholarly disagreements for this category and question.',
    'Each finding needs a source title, URL, and an excerpt copied from that page. Do not invent sources.',
  ].join('\n');
}

function parallelFailure(consult: ParallelConsult): Error {
  if (consult.status === 'credentials_missing') {
    return new Error('Parallel research is not configured. Set PARALLEL_AI_API_KEY or PARALLEL_API_KEY on the server. No sources were invented.');
  }
  if (consult.status === 'running') {
    return new Error('Parallel research is still running and did not return sources. An unfinished result was not marked as a completed answer.');
  }
  if (consult.findings.length === 0) {
    return new Error('Parallel research returned no sources. An empty result was not marked as a completed answer.');
  }
  const detail = consult.setup?.replace(/sk-|api[_-]?key|x-api-key/gi, '').trim();
  return new Error(detail ? `Parallel research failed. ${detail} No sources were invented.` : 'Parallel research failed. No sources were invented.');
}

function researchText(findings: ParallelFinding[]): string {
  return findings
    .map((finding, index) =>
      [
        `Finding ${index + 1}`,
        `Title: ${finding.title}`,
        `URL: ${finding.url}`,
        `Context and excerpt: ${finding.excerpt}`,
        `Claim: ${finding.claim}`,
        finding.providerConfidence
          ? `Provider confidence metadata (not a hadith grade): ${finding.providerConfidence}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

function sourceAppendix(findings: ParallelFinding[]): string {
  const lines = findings.map(finding => `- ${finding.title} — ${finding.url}\n  ${finding.excerpt}`).join('\n');
  return `## Sources returned by Parallel.ai\n${lines}\n\nOnly these sources were returned. Nothing outside this list was added.`;
}

function hostDisclaimer(lang: 'en' | 'ta' | 'si'): string {
  if (lang === 'ta') return 'இது உருவாக்கப்பட்ட ஸ்டூடியோ தொகுப்பாளர் உரை. இவை ஃபெரோஸின் தனிப்பட்ட அறிக்கையோ ஒப்புதலோ அல்ல.';
  if (lang === 'si') return 'මෙය නිර්මාණය කළ ස්ටුඩියෝ ඉදිරිපත් කරන්නෙකුගේ කථාවකි. මෙම වචන ෆෙරෝස්ගේ පුද්ගලික ප්‍රකාශයක් හෝ අනුමැතියක් නොවේ.';
  return 'This is a generated studio presenter. These words are not a personal statement or approval by Feroz.';
}

function frameGeneratedHost(script: string, lang: 'en' | 'ta' | 'si'): string {
  const disclaimer = hostDisclaimer(lang);
  const cleaned = script
    .replace(/^BROTHER FEROZ \(HOST\): This is a generated studio presenter\. These words are not a personal statement or approval by Feroz\.\s*/im, '')
    .trim();
  if (cleaned.includes(disclaimer)) return cleaned;
  return `BROTHER FEROZ (HOST): ${disclaimer}\n\n${cleaned}`;
}

function blankAgents(query: string): Pick<
  DragonDawwaAnalysis,
  'app_name' | 'query_hadith' | 'agent_1_takhrij' | 'agent_2_isnad' | 'agent_3_rijal' | 'agent_4_shawahid_matn' | 'agent_5_scholars_verdict'
> {
  return {
    app_name: 'Dragon Dawwa',
    query_hadith: query,
    agent_1_takhrij: { sources: [], variants_summary: 'N/A' },
    agent_2_isnad: { narrator_sequence: [], chain_links: [], overall_chain_status: 'N/A' },
    agent_3_rijal: { narrators: [] },
    agent_4_shawahid_matn: {
      supporting_reports: [],
      hidden_defects_ilal: [],
      contradictions: [],
      quranic_corroboration_arabic: 'N/A',
      quranic_corroboration_english: 'N/A',
    },
    agent_5_scholars_verdict: { gradings: [] },
  };
}

function systemInstruction(lang: 'en' | 'ta' | 'si'): string {
  const tamilRule =
    lang === 'ta'
      ? 'Never write வணக்கம். If a speaker greets anyone, the only greeting is அஸ்ஸலாமு அலைக்கும்.'
      : '';
  return `${CHAIR_PROMPT}

The host speaker label must stay "BROTHER FEROZ (HOST):" because the player splits on that label. In the host's spoken words, say that this is a generated studio presenter and not a personal statement or approval by Feroz.
Use this exact localized host disclaimer: "${hostDisclaimer(lang)}"
Label Zayd exactly "ZAYD (The Polymath Researcher):".
Write the executive report and the spoken podcast lines in ${languageName(lang)}. Keep speaker labels and UI headings in English. Keep Arabic quotations in Arabic.
Do not invent sources, URLs, quotations, or disagreements that are not in the Parallel.ai research data.
Set agent_6_synthesis.final_status to "Not a hadith grade" and purity_confidence_score to 0. This is not a hadith authentication.
Set app_name to "Dragon Dawwa" and query_hadith to the user question.
${tamilRule}`.trim();
}

async function generateWithGemini(system: string, prompt: string, apiKey: string): Promise<string> {
  const { GoogleGenAI } = await import('@google/genai');
  const { dragonDawwaResponseSchema } = await import('../../engine/server/hadithEngine.ts');
  const ai = new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: { timeout: 180000, headers: { 'User-Agent': 'aistudio-build' } },
  });
  let lastMessage = 'Gemini did not return a report.';
  for (const modelName of MODEL_CANDIDATES) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: system,
            responseMimeType: 'application/json',
            responseSchema: dragonDawwaResponseSchema,
            temperature: 0.2,
          },
        });
        const responseText = response.text?.trim() ?? '';
        if (responseText.startsWith('{')) return responseText;
        lastMessage = 'Gemini returned a response that was not the analysis JSON.';
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gemini request failed.';
        lastMessage = /api[_-]?key|x-goog-api-key/i.test(message) ? 'Gemini rejected the request.' : message;
        const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode;
        const highDemand = status === 503 || status === 429 || /503|429|high demand/i.test(message);
        if (highDemand && attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 800 * attempt));
          continue;
        }
        break;
      }
    }
  }
  throw new Error(`Gemini could not write the category report. ${lastMessage} No sources were invented.`);
}

export async function executeParallelResearch(
  category: string,
  query: string,
  lang: 'en' | 'ta' | 'si' = 'en',
  deps?: ParallelResearchDeps,
): Promise<DragonDawwaAnalysis> {
  const topic = category.trim();
  const question = query.trim();
  if (!topic) throw new Error('A category is required for Parallel research. No sources were invented.');
  if (!question) throw new Error('A question is required. No research was run.');

  const deadline = Date.now() + (deps?.deadlineMs ?? 600_000);
  const pollController = new AbortController();
  const deadlineTimer = setTimeout(() => pollController.abort(), Math.max(1, deadline - Date.now()));
  let consult: ParallelConsult;
  try {
    consult = await consultParallel({
      question: parallelQuestion(topic, question, lang),
      language: lang,
      fetchImpl: deps?.fetchImpl,
      pollMs: deps?.pollMs ?? 45_000,
      signal: pollController.signal,
    });
    while (consult.status === 'running' && consult.runId && Date.now() < deadline) {
      consult = await awaitParallelResult({
        runId: consult.runId,
        fetchImpl: deps?.fetchImpl,
        signal: pollController.signal,
        timeoutSec: Math.max(1, Math.ceil((deps?.pollMs ?? 45_000) / 1000)),
        attempts: Math.max(1, Math.min(6, Math.ceil((deadline - Date.now()) / (deps?.pollMs ?? 45_000)))),
      });
    }
  } catch (error) {
    if (Date.now() >= deadline) {
      throw new Error('Parallel research exceeded its completion deadline. The unfinished result was not marked as a completed answer.');
    }
    throw error;
  } finally {
    clearTimeout(deadlineTimer);
  }
  if (consult.status === 'running' && Date.now() >= deadline) {
    throw new Error('Parallel research exceeded its completion deadline. The unfinished result was not marked as a completed answer.');
  }
  if (consult.status !== 'completed' || consult.findings.length === 0) throw parallelFailure(consult);

  const system = systemInstruction(lang);
  const prompt = `Category: ${topic}\nQuestion: ${question}\n\nParallel.ai research data:\n${researchText(consult.findings)}`;
  const geminiKey = deps?.geminiApiKey === undefined ? process.env.GEMINI_API_KEY : deps.geminiApiKey;
  let raw: string;
  if (deps?.generateContent) {
    raw = await deps.generateContent({ systemInstruction: system, prompt });
  } else if (!hasGeminiApiKey(geminiKey)) {
    throw new Error('GEMINI_API_KEY is missing, so the Parallel research was not written up. No sources were invented.');
  } else {
    raw = await generateWithGemini(system, prompt, geminiKey);
  }

  let parsed: DragonDawwaAnalysis;
  try {
    parsed = JSON.parse(raw) as DragonDawwaAnalysis;
  } catch {
    throw new Error('Gemini did not return the analysis JSON. No completed answer was saved.');
  }
  const report = parsed.agent_6_synthesis?.executive_report_markdown?.trim() ?? '';
  const script = parsed.agent_6_synthesis?.podcast_script?.trim() ?? '';
  if (!report || !script) {
    throw new Error('Gemini returned an empty category report. An empty result was not marked as a completed answer.');
  }
  if (!/BROTHER\s+FEROZ/i.test(script) || !/ZAYD/i.test(script)) {
    throw new Error('Gemini did not return a podcast script the player can split into the host and Zayd. No completed answer was saved.');
  }

  const spokenScript = frameGeneratedHost(script, lang);
  const executive = `${report}\n\n${sourceAppendix(consult.findings)}\n\n---\n*Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies*`;
  const consensus = parsed.agent_6_synthesis?.consensus_and_disagreements?.trim()
    || 'Scholarly disagreements are limited to what Parallel.ai returned. No additional disagreement was invented.';
  const dossier: DragonDawwaAnalysis = scrubVanakkam({
    ...blankAgents(question),
    research_category: topic,
    version: '2.5 Enterprise Engine',
    platform_owner: 'Prime Dragon Technologies (Pvt) Ltd',
    designed_and_created_by: 'Aegis Intelligence Pvt Ltd, Sri Lanka',
    generated_at: new Date().toISOString(),
    agent_6_synthesis: {
      final_status: 'Not a hadith grade',
      purity_confidence_score: 0,
      consensus_and_disagreements: consensus,
      executive_report_markdown: executive,
      podcast_script: spokenScript,
    },
  });
  const spoken = generatedContentForLanguage(dossier.agent_6_synthesis.podcast_script, report);
  if (!scriptMatchesLanguage(spoken, lang)) throw new Error(languageFailureMessage(lang));
  dossier.content_language = lang;
  return dossier;
}

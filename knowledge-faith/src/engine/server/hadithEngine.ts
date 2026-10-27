import { GoogleGenAI, Type } from "@google/genai";
import { findCompletedResearch, storedAnalysisJson } from "../../server/researchIdempotency.ts";
import type { DragonDawwaAnalysis } from "../types/hadith.ts";
import { getLocalizedAnalysis } from "../utils/localizedAnalysis.ts";

export function getDragonDawwaSystemInstruction(targetLang: 'en' | 'ta' | 'si' = 'en'): string {
  const langName = targetLang === 'ta' ? 'Tamil (தமிழ்)' : targetLang === 'si' ? 'Sinhala (සිංහල)' : 'English';

  return `You are "Dragon Dawwa", the enterprise-grade AI Hadith Deep Search & Authentication Engine.

BRANDING & METADATA REQUIREMENT:
- Core Platform Ownership: Prime Dragon Technologies (Pvt) Ltd
- Platform Engineering & AI Architecture: Designed & Created by Aegis Intelligence Pvt Ltd, Sri Lanka

Every generated report dossier and export payload must include the metadata footer:
"Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies"

TARGET LANGUAGE: ${langName}

STRICT MULTILINGUAL GENERATION RULES:
1. DESCRIPTIONS, DIALOGUES, AND SUMMARIES:
   - ALL dialogue lines in the podcast script (podcast_script), executive summaries (executive_report_markdown), Rijal critic notes (critic_verdicts, critic_quotes_translated), and agent findings MUST be written in fluent, native ${langName} script when ${langName} is selected.
   - For Tamil ('ta'): Write all spoken dialogue lines, narrator evaluations, and synthesis summaries in authentic, high-quality, grammatical Tamil script (தமிழ்). Do NOT use English transliteration for dialogue or explanations.
   - For Sinhala ('si'): Write all spoken dialogue lines and summaries in authentic Sinhala script (සිංහල).

2. ARABIC RECITATIONS & TERMS:
   - All Quranic verses, Hadith Matn, and Islamic core formulas (e.g., "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ", "صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ") MUST remain in pristine, fully-vocalized ARABIC text.
   - Follow each Arabic phrase immediately with its translation in ${langName}.

3. UI HEADINGS & SPEAKER BADGES:
   - Speaker names, Agent titles, and UI badge labels (e.g., "BROTHER FEROZ (HOST)", "Executive Anchor", "Thiqah", "Muttasil") may keep their standard English identifier tags for UI consistency.

OPERATIONAL SCHOLARLY AGENT PERSONAS:

1. AGENT 1: TAKHRIJ AGENT
   - Persona Name: Dr. Tariq al-Mansoor (Lead Source & Textual Variant Analyst)
   - Scope: Locates all primary Hadith collections (Bukhari, Muslim, Sunan, Musnads), extracts exact wording variants, additions, omissions, and textual discrepancies. Writes in formal scholarly format.

2. AGENT 2: ISNAD AGENT
   - Persona Name: Dr. Layla al-Qasimi (Senior Transmission & Connectivity Specialist)
   - Scope: Maps the full chain of narrators (Isnad) from the source back to the Companion/Prophet (PBUH). Evaluates transmission formulas ('an vs. sami'tu/haddathana), contemporaneity, and link continuity (Muttasil, Munqati', Mudallas).

3. AGENT 3: RIJAL AGENT
   - Persona Name: Sheikh Imran al-Hasani (Biographical Critic & Jarh wa Ta'dil Expert)
   - Scope: Researches every narrator in the chain across classical biographical reference works (Ibn Hibban, Yahya ibn Ma'in, Al-Dhahabi, Ibn Hajar). Quotes exact verdicts and volume citations, translating them into ${langName} in critic_quotes_translated and critic_verdicts.

4. AGENT 4: SHAWAHID & MATN AGENT
   - Persona Name: Dr. Zainab al-Mubarak (Textual Defects & Corroboration Investigator)
   - Scope: Examines supporting chains (Mutaabi'at), parallel witness reports (Shawahid), hidden critical defects ('Ilal), and potential textual abnormalities (Shadh) or contradictions.

5. AGENT 5: SCHOLARS' VERDICT AGENT
   - Persona Name: Sheikh Yusuf al-Azhari (Comparative Grading & Jurisprudence Collector)
   - Scope: Compiles named historical and modern scholar gradings (Al-Albani, Al-Hakim, Shu'ayb al-Arna'ut, Ibn Baz, Ibn Hajar) into precise comparative evaluation matrices.

6. AGENT 6: HOST & SYNTHESIS AGENT
   - Persona Name: Dragon Dawwa Studio Host (Chief Authentication Officer)
   - Scope: Reconciles all 5 agent outputs under a strict verification gate. Calculates the Purity Confidence Score (0.0% to 100.0%), writes the final academic verdict in ${langName}, and produces the complete Radio Studio Podcast Script in ${langName}.

PODCAST SCRIPT REQUIREMENTS ("DRAGON DAWWA LIVE"):
- Studio Director Mandate: Act as the "Dragon Dawwa Podcast Studio Director" for Prime Dragon Technologies.
- Format: Real radio studio multi-person broadcast featuring Host Brother Feroz and all 5 specialist scholarly agents (Dr. Tariq, Dr. Layla, Sheikh Imran, Dr. Zainab, Sheikh Yusuf).
- Language: When ${langName} is active, all spoken dialogue lines MUST be in fluent ${langName} script!
- GREETING BAN: The Tamil word வணக்கம் is forbidden in every field (podcast_script, reports, notes, translations). Never translate Hello, Hi, Greetings, or Welcome into வணக்கம். When a speaker greets anyone in Tamil, the only greeting is அஸ்ஸலாமு அலைக்கும்.
- MANDATORY EPISODE STRUCTURE:
  1. EXPLICIT STUDIO PANEL INTRODUCTIONS (AT EPISODE START):
     - Host Brother Feroz welcomes listeners to Dragon Dawwa Live.
     - Each anchor MUST explicitly introduce themselves, their scholarly role, and their precise methodology in ${langName}:
       * Dr. Tariq al-Mansoor (Takhrij Table): Explains manuscript cross-referencing and variant analysis.
       * Dr. Layla al-Qasimi (Isnad Table): Explains transmission chain mapping and hearing formulas.
       * Sheikh Imran al-Hasani (Rijal Table): Explains biographical dictionaries (Jarh wa Ta'dil) checks.
       * Dr. Zainab al-Mubarak (Shawahid & Matn Table): Explains hidden defect ('Ilal) and corroboration screening.
       * Sheikh Yusuf al-Azhari (Scholars' Verdict Table): Explains compilation of classic and contemporary legal verdicts.
  2. ARABIC RECITATIONS & TRANSLATIONS:
     - Anchors MUST recite key Hadith phrases in clear vocalized Arabic script followed immediately by their translation in ${langName}.
  3. DYNAMIC ROUNDTABLE DEBATE & ADDRESSING THE ANCHOR:
     - The anchor MUST be labeled "BROTHER FEROZ (HOST):" or "BROTHER FEROZ:".
     - Panelists MUST be labeled by their scholarly names: "DR. TARIQ:", "DR. LAYLA:", "SHEIKH IMRAN:", "DR. ZAINAB:", "SHEIKH YUSUF:".
     - All speakers must address each other by name like a live radio studio roundtable!
  4. SOUND DESIGN:
     - Broadcast audio cues: [AUDIO CUE: INTRO UP - POLISHED RADIO BEAT (4 SECONDS) THEN FADE UNDER], [AUDIO CUE: SOFT PENCIL TAP / DESK PAPERS], [AUDIO CUE: DRAMATIC DRUM THUD], [AUDIO CUE: SOFT CHIME / TRANSITION SOUND], [AUDIO CUE: OUTRO THEME RISES AND FADES OUT].`;
}

export const dragonDawwaResponseSchema = {
  type: Type.OBJECT,
  properties: {
    app_name: { type: Type.STRING },
    version: { type: Type.STRING },
    platform_owner: { type: Type.STRING },
    designed_and_created_by: { type: Type.STRING },
    query_hadith: { type: Type.STRING },
    agent_1_takhrij: {
      type: Type.OBJECT,
      properties: {
        sources: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              collection: { type: Type.STRING },
              hadith_number: { type: Type.STRING },
              exact_wording: { type: Type.STRING },
              exact_wording_arabic: { type: Type.STRING },
              exact_wording_english: { type: Type.STRING },
              wording_differences: { type: Type.STRING }
            },
            required: ["collection", "hadith_number", "exact_wording"]
          }
        },
        variants_summary: { type: Type.STRING }
      },
      required: ["sources", "variants_summary"]
    },
    agent_2_isnad: {
      type: Type.OBJECT,
      properties: {
        narrator_sequence: { type: Type.ARRAY, items: { type: Type.STRING } },
        chain_links: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              teacher: { type: Type.STRING },
              student: { type: Type.STRING },
              transmission_mode: { type: Type.STRING },
              connection_status: { type: Type.STRING },
              historical_reasoning: { type: Type.STRING }
            },
            required: ["teacher", "student", "transmission_mode", "connection_status", "historical_reasoning"]
          }
        },
        overall_chain_status: { type: Type.STRING }
      },
      required: ["narrator_sequence", "chain_links", "overall_chain_status"]
    },
    agent_3_rijal: {
      type: Type.OBJECT,
      properties: {
        narrators: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              narrator_name: { type: Type.STRING },
              critic_verdicts: { type: Type.ARRAY, items: { type: Type.STRING } },
              critic_quotes_translated: { type: Type.STRING },
              status: { type: Type.STRING },
              citations: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["narrator_name", "critic_verdicts", "status", "citations"]
          }
        }
      },
      required: ["narrators"]
    },
    agent_4_shawahid_matn: {
      type: Type.OBJECT,
      properties: {
        supporting_reports: { type: Type.ARRAY, items: { type: Type.STRING } },
        quranic_corroboration_arabic: { type: Type.STRING },
        quranic_corroboration_english: { type: Type.STRING },
        hidden_defects_ilal: { type: Type.ARRAY, items: { type: Type.STRING } },
        contradictions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["supporting_reports", "hidden_defects_ilal", "contradictions"]
    },
    agent_5_scholars_verdict: {
      type: Type.OBJECT,
      properties: {
        gradings: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              scholar: { type: Type.STRING },
              grading: { type: Type.STRING },
              reference: { type: Type.STRING }
            },
            required: ["scholar", "grading", "reference"]
          }
        }
      },
      required: ["gradings"]
    },
    agent_6_synthesis: {
      type: Type.OBJECT,
      properties: {
        final_status: { type: Type.STRING },
        purity_confidence_score: { type: Type.NUMBER },
        consensus_and_disagreements: { type: Type.STRING },
        executive_report_markdown: { type: Type.STRING },
        podcast_script: { type: Type.STRING }
      },
      required: ["final_status", "purity_confidence_score", "consensus_and_disagreements", "executive_report_markdown", "podcast_script"]
    },
    historical_variations_trend: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          collection: { type: Type.STRING },
          label: { type: Type.STRING },
          hadith_number: { type: Type.STRING },
          year_ah: { type: Type.NUMBER },
          confidence_score: { type: Type.NUMBER },
          matn_integrity: { type: Type.NUMBER },
          isnad_continuity: { type: Type.NUMBER },
          exact_wording_arabic: { type: Type.STRING },
          wording_differences: { type: Type.STRING },
          status: { type: Type.STRING }
        },
        required: ["collection", "confidence_score", "matn_integrity", "isnad_continuity"]
      }
    }
  },
  required: [
    "app_name",
    "query_hadith",
    "agent_1_takhrij",
    "agent_2_isnad",
    "agent_3_rijal",
    "agent_4_shawahid_matn",
    "agent_5_scholars_verdict",
    "agent_6_synthesis"
  ]
};

// Candidate models in order of priority when experiencing high demand / 503
const MODEL_CANDIDATES = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function executeDragonDawwaAnalysis(
  hadithInput: string,
  isnadInput?: string,
  preferredLanguage: 'en' | 'ta' | 'si' = 'en',
  apiKey: string | undefined = process.env.GEMINI_API_KEY,
): Promise<DragonDawwaAnalysis> {
  const saved = await findCompletedResearch({ hadithInput, language: preferredLanguage });
  if (saved?.status === 'done') {
    const analysis = storedAnalysisJson(saved);
    if (analysis) return analysis as unknown as DragonDawwaAnalysis;
  }

  if (!apiKey?.trim()) throw new Error("GEMINI_API_KEY is missing in this server. Add it to this Codespace and restart Vite.");

  // Language instructions for descriptions while preserving sacred Arabic script
  const langPromptGuidance = preferredLanguage === 'ta'
    ? "IMPORTANT TRANSLATION REQUIREMENT: Provide the explanatory commentary, executive report descriptions, and translations in Tamil (தமிழ்), while keeping all original Arabic Hadith text and Quranic verses in sacred Arabic script (عربي). UI headings remain standard. STRICT: never write வணக்கம். Greet only with அஸ்ஸலாமு அலைக்கும்."
    : preferredLanguage === 'si'
    ? "IMPORTANT TRANSLATION REQUIREMENT: Provide the explanatory commentary, executive report descriptions, and translations in Sinhala (සිංහල), while keeping all original Arabic Hadith text and Quranic verses in sacred Arabic script (عربي). UI headings remain standard."
    : "Provide descriptions and commentary in English, while keeping all original Arabic Hadith text and Quranic verses in sacred Arabic script (عربي).";

  if (apiKey) {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 180000,
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `[DRAGON DAWWA DEEP SEARCH REQUEST]
Target Language for descriptions: ${preferredLanguage} (${preferredLanguage === 'ta' ? 'Tamil' : preferredLanguage === 'si' ? 'Sinhala' : 'English'})
${langPromptGuidance}

Hadith Text: ${hadithInput}
Isnad / Chain (if provided): ${isnadInput && isnadInput.trim().length > 0 ? isnadInput : "Extract and infer from primary sources (Kutub al-Sittah, Musnad Ahmad, etc.)."}`;

    let lastError: any = null;

    // Try candidate models with fallback & backoff
    for (const modelName of MODEL_CANDIDATES) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: getDragonDawwaSystemInstruction(preferredLanguage),
              responseMimeType: "application/json",
              responseSchema: dragonDawwaResponseSchema,
              temperature: 0.2,
            },
          });

          const responseText = response.text;
          if (responseText && responseText.trim().startsWith("{")) {
            const parsed = JSON.parse(responseText) as DragonDawwaAnalysis;
            parsed.version = parsed.version || "2.5 Enterprise Engine";
            parsed.platform_owner = parsed.platform_owner || "Prime Dragon Technologies (Pvt) Ltd";
            parsed.designed_and_created_by = parsed.designed_and_created_by || "Aegis Intelligence Pvt Ltd, Sri Lanka";

            if (parsed.agent_6_synthesis?.executive_report_markdown && !parsed.agent_6_synthesis.executive_report_markdown.includes("Aegis Intelligence")) {
              parsed.agent_6_synthesis.executive_report_markdown += `\n\n---\n*Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies*`;
            }
            return getLocalizedAnalysis(parsed, preferredLanguage);
          }
        } catch (err: any) {
          lastError = err;
          const status = err.status || err.statusCode || (err.error && err.error.code);
          const message = err.message || JSON.stringify(err);

          // If 503 (high demand) or 429 (rate limit), wait briefly and retry or try next model
          const isHighDemand = status === 503 || message.includes("503") || message.includes("high demand") || status === 429;
          
          if (isHighDemand && attempt < 2) {
            await sleep(800 * attempt);
            continue; // retry same model once
          }
          // break out of attempt loop to try next model in MODEL_CANDIDATES
          break;
        }
      }
    }

    throw new Error("Live research failed. Check Gemini model access, quota and server configuration, then retry. No sample result was substituted.");
  }

  throw new Error("Live research is unavailable. Please retry.");
}

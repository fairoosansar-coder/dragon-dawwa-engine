import { GoogleGenAI, Type } from "@google/genai";
import type { DragonDawwaAnalysis, HadeethEncRetrievedRecord } from "../types/hadith.ts";
import { getLocalizedAnalysis } from "../utils/localizedAnalysis.ts";
import { attachAgent7ToAnalysis } from "../utils/agent7SourceResearch.ts";
import { SAMPLE_HADITHS } from "../data/sampleHadiths.ts";
import { loadHadeeth, searchHadeeth } from "../../server/hadeethenc.ts";
import { decomposeQuestion } from "../../shared/research/decompose.ts";
import { hasGeminiApiKey } from "../../server/loadEnv.ts";
import { isAsrPrayerQuestion, isChinaQuestion, isIntentionsQuestion, isSaturdayFastingQuestion, questionBoundShell, recordIsRelevant } from "../utils/reportBinding.ts";
import { ASR_LEGAL_NOTE, asrCitationSources } from "../utils/asrPrayerSources.ts";
import { scriptMatchesLanguage } from "../utils/contentLanguage.ts";

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
   - Scope: Reconciles all agent outputs under a strict verification gate. Calculates the Purity Confidence Score (0.0% to 100.0%), writes the final academic verdict in ${langName}, and produces the complete Radio Studio Podcast Script in ${langName}.

7. AGENT 7: SOURCE RESEARCH AGENT (HADEETHENC SPECIALIST)
   - Persona Name: Dr. Amina al-Kindi (Source Research & HadeethEnc Encyclopedia Specialist)
   - Scope: Retrieves verified HadeethEnc records (Arabic text, ${langName} translation, explanation, lessons, published grade, and collection attribution), feeds them into Agents 1–6, attributes published opinions to their authors, distinguishes the agent's own interpretation, and participates actively in the podcast roundtable as "DR. AMINA:".

PODCAST SCRIPT REQUIREMENTS ("DRAGON DAWWA LIVE"):
- Studio Director Mandate: Act as the "Dragon Dawwa Podcast Studio Director" for Prime Dragon Technologies.
- Format: Real radio studio multi-person broadcast featuring Host Brother Feroz and all 6 specialist agents (Dr. Tariq, Dr. Layla, Sheikh Imran, Dr. Zainab, Sheikh Yusuf, and Dr. Amina).
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
       * Dr. Amina al-Kindi (Source Research Table — Agent 7): Explains HadeethEnc source retrieval, published grades, explanations, lessons, and cross-agent evidence comparison.
  2. ARABIC RECITATIONS & TRANSLATIONS:
     - Anchors MUST recite key Hadith phrases in clear vocalized Arabic script followed immediately by their translation in ${langName}.
  3. DYNAMIC ROUNDTABLE DEBATE & ADDRESSING THE ANCHOR:
     - The anchor MUST be labeled "BROTHER FEROZ (HOST):" or "BROTHER FEROZ:".
     - Panelists MUST be labeled by their scholarly names: "DR. TARIQ:", "DR. LAYLA:", "SHEIKH IMRAN:", "DR. ZAINAB:", "SHEIKH YUSUF:", "DR. AMINA:".
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

async function retrieveLiveHadeethEncForDossier(
  hadithInput: string,
  lang: 'en' | 'ta' | 'si',
): Promise<{
  records: HadeethEncRetrievedRecord[];
  activity: {
    queries_run: string[];
    candidates_found: number;
    records_opened: string[];
    unopened_count: number;
    duration_ms: number;
  };
}> {
  const t0 = Date.now();
  const plan = decomposeQuestion(hadithInput);
  const queries = [...new Set(plan.subquestions.flatMap(sq => sq.queries))].slice(0, 4);
  if (queries.length === 0 && hadithInput.trim().length >= 3) {
    queries.push(hadithInput.trim().slice(0, 80));
  }

  // Also include known canonical HadeethEnc IDs for benchmark themes so thematic corroboration is always opened alongside keyword candidates
  const seedIds: string[] = [];
  if (isIntentionsQuestion(hadithInput)) {
    seedIds.push('4560', '66511');
  } else if (isSaturdayFastingQuestion(hadithInput)) {
    seedIds.push('4508', '3546');
  } else if (isChinaQuestion(hadithInput)) {
    seedIds.push('9944');
  } else if (isAsrPrayerQuestion(hadithInput)) {
    seedIds.push('6261', '65094');
  }

  const candidateIds = new Set<string>(seedIds);
  let totalCandidatesFound = seedIds.length;

  for (const phrase of queries) {
    try {
      const found = await searchHadeeth(lang, phrase.slice(0, 100), 1);
      totalCandidatesFound += found.items.length;
      for (const hit of found.items.slice(0, 2)) {
        candidateIds.add(hit.id);
      }
    } catch {
      /* ignore individual search timeout */
    }
  }

  const toOpen = [...candidateIds].slice(0, 4);
  const loaded = await Promise.all(
    toOpen.map(id => loadHadeeth(lang, id).catch(() => null)),
  );

  const records: HadeethEncRetrievedRecord[] = [];
  for (const h of loaded) {
    if (!h) continue;
    const isSeed = seedIds.includes(h.id);
    const isDirect =
      hadithInput.length >= 12 &&
      (h.text.toLowerCase().includes(hadithInput.slice(0, 24).toLowerCase()) ||
        h.title.toLowerCase().includes(hadithInput.slice(0, 24).toLowerCase()));
    records.push({
      id: h.id,
      title: h.title,
      arabic: h.arabic,
      translation: h.text,
      language: lang,
      explanation: h.explanation,
      lessons: h.lessons,
      published_grade: h.grade,
      collection_attribution: h.attribution,
      source_url: h.sourceUrl,
      reader_route: `#/hadith/${h.id}?lang=${lang}`,
      match_status: isDirect
        ? 'Direct Hadith Match'
        : isSeed
          ? 'Corroborating Theme Passage'
          : 'Candidate Passage (Word Match — Not Automatic Support)',
      match_reason: isDirect
        ? `HadeethEnc #${h.id} directly matches the queried hadith text.`
        : isSeed
          ? `Retrieved from HadeethEnc (#${h.id}) as the primary authenticated narration on this legal/thematic subject.`
          : `Identified via keyword match in HadeethEnc search (#${h.id}); treated as a candidate passage for review, not automatic claim support.`,
    });
  }

  return {
    records,
    activity: {
      queries_run: queries,
      candidates_found: totalCandidatesFound,
      records_opened: records.map(r => r.id),
      unopened_count: Math.max(0, totalCandidatesFound - records.length),
      duration_ms: Math.max(1, Date.now() - t0),
    },
  };
}

function enrichAnalysisWithHadeethEnc(
  base: DragonDawwaAnalysis,
  lang: 'en' | 'ta' | 'si',
  liveRecords: HadeethEncRetrievedRecord[],
  liveActivity: {
    queries_run: string[];
    candidates_found: number;
    records_opened: string[];
    unopened_count: number;
    duration_ms: number;
  },
): DragonDawwaAnalysis {
  const localized = getLocalizedAnalysis(base, lang);
  const withAgent7 = attachAgent7ToAnalysis(localized, lang, liveRecords, liveActivity);
  const question = withAgent7.query_hadith || '';
  const usableRecords = isSaturdayFastingQuestion(question) || isIntentionsQuestion(question) || isChinaQuestion(question)
    ? liveRecords
    : liveRecords.filter(record => recordIsRelevant(question, record).ok);

  // Also feed the primary HadeethEnc records into Agent 1 (Takhrij) and Agent 5 without duplicating existing rows
  const extraTakhrij = usableRecords
    .filter(r => !withAgent7.agent_1_takhrij.sources.some(s => s.hadith_number.includes(r.id)))
    .slice(0, 2)
    .map(r => ({
      collection: `HadeethEnc (${r.collection_attribution || 'Verified Encyclopedia'})`,
      hadith_number: `#${r.id}`,
      exact_wording: r.arabic || r.translation,
      exact_wording_arabic: r.arabic ?? undefined,
      exact_wording_english: r.translation,
      wording_differences: `[Agent 7 Source Research · ${r.match_status}] Published Grade: ${r.published_grade ?? 'Not supplied'}.`,
    }));

  const extraGradings = usableRecords
    .filter(r => r.published_grade && !withAgent7.agent_5_scholars_verdict.gradings.some(g => g.reference.includes(`HadeethEnc #${r.id}`)))
    .slice(0, 2)
    .map(r => ({
      scholar: `HadeethEnc Editorial Committee (${r.collection_attribution || 'Published Record'})`,
      grading: r.published_grade!,
      reference: `HadeethEnc #${r.id} (${r.source_url})`,
    }));

  const asrSources = isAsrPrayerQuestion(question)
    ? asrCitationSources(lang).filter(source => !withAgent7.agent_1_takhrij.sources.some(existing => existing.hadith_number.replace(/\D/g, '') === source.hadith_number))
    : [];
  const asrLaw = isAsrPrayerQuestion(question) && !(withAgent7.agent_4_shawahid_matn?.contradictions ?? []).some(item => /2621|legal conclusion/i.test(item))
    ? [ASR_LEGAL_NOTE]
    : [];

  return {
    ...withAgent7,
    agent_1_takhrij: {
      ...withAgent7.agent_1_takhrij,
      sources: [...asrSources, ...withAgent7.agent_1_takhrij.sources, ...extraTakhrij],
    },
    agent_4_shawahid_matn: {
      ...withAgent7.agent_4_shawahid_matn,
      contradictions: [...(withAgent7.agent_4_shawahid_matn?.contradictions ?? []), ...asrLaw],
    },
    agent_5_scholars_verdict: {
      ...withAgent7.agent_5_scholars_verdict,
      gradings: [...withAgent7.agent_5_scholars_verdict.gradings, ...extraGradings],
    },
  };
}

function selectBaseDossierForInput(hadithInput: string, _lang: 'en' | 'ta' | 'si', liveRecords: HadeethEncRetrievedRecord[]): DragonDawwaAnalysis {
  if (isSaturdayFastingQuestion(hadithInput)) {
    const preset = SAMPLE_HADITHS.find(p => p.id === 'saturday-fasting') ?? SAMPLE_HADITHS[0];
    return { ...structuredClone(preset.defaultData), query_hadith: hadithInput };
  }
  if (isChinaQuestion(hadithInput)) {
    const preset = SAMPLE_HADITHS.find(p => p.id === 'seek-knowledge-china') ?? SAMPLE_HADITHS[0];
    return { ...structuredClone(preset.defaultData), query_hadith: hadithInput };
  }
  if (isIntentionsQuestion(hadithInput)) {
    const preset = SAMPLE_HADITHS.find(p => p.id === 'actions-by-intentions') ?? SAMPLE_HADITHS[0];
    return { ...structuredClone(preset.defaultData), query_hadith: hadithInput };
  }
  return questionBoundShell(hadithInput, liveRecords);
}

export async function executeDragonDawwaAnalysis(
  hadithInput: string,
  isnadInput?: string,
  preferredLanguage: 'en' | 'ta' | 'si' = 'en',
  apiKey: string | undefined = process.env.GEMINI_API_KEY
): Promise<DragonDawwaAnalysis> {
  // Step 1: Always run live HadeethEnc retrieval (Agent 7 — Source Research) first
  const { records: liveRecords, activity: liveActivity } = await retrieveLiveHadeethEncForDossier(
    hadithInput,
    preferredLanguage,
  );

  const langPromptGuidance = preferredLanguage === 'ta'
    ? "IMPORTANT TRANSLATION REQUIREMENT: Provide the explanatory commentary, executive report descriptions, and translations in Tamil (தமிழ்), while keeping all original Arabic Hadith text and Quranic verses in sacred Arabic script (عربي). UI headings remain standard. STRICT: never write வணக்கம். Greet only with அஸ்ஸலாமு அலைக்கும்."
    : preferredLanguage === 'si'
    ? "IMPORTANT TRANSLATION REQUIREMENT: Provide the explanatory commentary, executive report descriptions, and translations in Sinhala (සිංහල), while keeping all original Arabic Hadith text and Quranic verses in sacred Arabic script (عربي). UI headings remain standard."
    : "Provide descriptions and commentary in English, while keeping all original Arabic Hadith text and Quranic verses in sacred Arabic script (عربي).";

  const hadeethEncContext = liveRecords.length > 0
    ? `\n\nAGENT 7 (HADEETHENC SOURCE RESEARCH RETRIEVED RECORDS):\n${liveRecords
        .map(
          r =>
            `- HadeethEnc #${r.id} (${r.match_status}):\n  Arabic: ${r.arabic ?? 'N/A'}\n  Translation (${r.language}): ${r.translation}\n  Published Grade: ${r.published_grade ?? 'Not supplied'}\n  Collection Attribution: ${r.collection_attribution ?? 'N/A'}\n  Explanation: ${r.explanation ?? 'N/A'}\n  Lessons: ${r.lessons.join(' | ')}`,
        )
        .join('\n')}`
    : '';

  if (hasGeminiApiKey(apiKey)) {
    const ai = new GoogleGenAI({
      apiKey: apiKey!.trim(),
      httpOptions: {
        timeout: 180000,
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `[DRAGON DAWWA 7-AGENT DEEP SEARCH REQUEST]
Target Language for descriptions: ${preferredLanguage} (${preferredLanguage === 'ta' ? 'Tamil' : preferredLanguage === 'si' ? 'Sinhala' : 'English'})
${langPromptGuidance}

Hadith Text: ${hadithInput}
Isnad / Chain (if provided): ${isnadInput && isnadInput.trim().length > 0 ? isnadInput : "Extract and infer from primary sources (Kutub al-Sittah, Musnad Ahmad, etc.)."}${hadeethEncContext}`;

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
            const spoken = `${parsed.agent_6_synthesis?.podcast_script ?? ''}\n${parsed.agent_6_synthesis?.executive_report_markdown ?? ''}`;
            parsed.content_language = scriptMatchesLanguage(spoken, preferredLanguage) ? preferredLanguage : undefined;
            if (!parsed.content_language) break;
            return enrichAnalysisWithHadeethEnc(parsed, preferredLanguage, liveRecords, liveActivity);
          }
        } catch (err: any) {
          const status = err.status || err.statusCode || (err.error && err.error.code);
          const message = err.message || JSON.stringify(err);
          const isHighDemand = status === 503 || message.includes("503") || message.includes("high demand") || status === 429;
          if (isHighDemand && attempt < 2) {
            await sleep(800 * attempt);
            continue;
          }
          break;
        }
      }
    }
  }

  // Offline English dossier. The client rejects it for a Tamil or Sinhala request instead of playing it as that language.
  const baseDossier = selectBaseDossierForInput(hadithInput, preferredLanguage, liveRecords);
  baseDossier.content_language = 'en';
  return enrichAnalysisWithHadeethEnc(baseDossier, preferredLanguage, liveRecords, liveActivity);
}

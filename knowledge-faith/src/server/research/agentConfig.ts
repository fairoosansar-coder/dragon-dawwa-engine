/**
 * Seven-agent map for the Dragon Dawwa research engine.
 *
 * Hadith & Authentication records the existing matn, isnad, and six-plus-synthesis
 * roles. That path still runs through Gemini and does not read this file.
 * Qur'an, Fiqh, and Seerah each have their own roles and source targets.
 * Studio voice labels stay the ones the podcast player already parses.
 */

import type { ResearchAssignmentView, ResearchScope, ResearchTeamId } from '../../shared/contracts/v1.ts';

/**
 * Final synthesis voice for Qur'an, Knowledge, and the other non-hadith desks.
 * Hadith authentication does not use this prompt.
 */
export const CIVILIZATIONAL_BRIDGE_PROMPT = `
You are an authentic, deeply learned, and compassionate Islamic research synthesis engine designed to be accessible to seekers of all backgrounds, especially those unfamiliar with Islamic texts.

CRITICAL OPERATIONAL RULES:
1. THE HISTORICAL CONTEXT IMPERATIVE:
   - When encountering sensitive, complex, or seemingly harsh verses (e.g., passages concerning warfare, treaties, or disbelievers), NEVER present an isolated literal fragment.
   - You MUST explain the Asbab al-Nuzul (occasions of revelation), the sociopolitical context of 7th-century Arabia, the specific breach of peace treaties that precipitated the event, and the strict Islamic legal limits of combat (self-defense, non-combatant immunity).
   - Clarify the deeper divine wisdom and justice behind the decree, answering *why* it was revealed and *how* classical scholars (e.g., Ibn Kathir, Al-Qurtubi, Al-Razi) understood its scope.

2. UNIVERSAL SACRED HISTORY:
   - Recognize that the Quran names 25 prophets while traditions acknowledge roughly 124,000 messengers sent across history to all nations, starting with Adam.
   - Frame Islam not as an insular historical development, but as the culmination and continuation of the primordial truth (Fitrah) sent to humanity.
   - Approach other religious traditions with dignity, academic integrity, and respect, highlighting shared spiritual yearnings and ethical values without theological distortion.

3. TONE & ACCESSIBILITY:
   - Never mock, belittle, or dismiss another tradition, questioner, or worldview.
   - Speak to the human heart. If a questioner is troubled, misinformed by social media clips, or wrestling with an apparent contradiction, address their underlying concern with warmth, patient reason, and intellectual honesty.
   - Avoid overly dense, unexplained legal jargon. Make classical scholarly nuance intuitive and clear to anyone who has never opened a Quran.
`;

/** A named tafsir is quoted only from commentary this research opened. */
export const OPENED_CLASSICAL_LIMIT =
  'A named classical comment is quoted only when that commentary was actually opened. When it was not opened, explain the historical and legal frame without inventing a quotation or attributing a sentence to Ibn Kathir, Al-Qurtubi, or Al-Razi. Do not drop a relevant opened ayah.';

/**
 * Final synthesis for an opened ayah.
 * The model answers the reader. It does not discard the ayah for a missing keyword.
 */
export const QURAN_SYNTHESIS_HEART =
  'You are a learned, compassionate scholar speaking to the reader. When an ayah has been opened, answer their question from that ayah. Quote its Arabic and its translation. State the occasion of revelation (asbab al-nuzul) and a classical tafsir only when the opened commentary states them. Then give the spiritual meaning and a practical comfort drawn from that opened wording. Bring in the opened tafsir, and the overarching theme the ayah teaches, such as tawakkul (trust in Allah) when the ayah is about reliance, trial, or what people dislike. Do not answer with a raw dump of the verse alone, and do not say that no passage addresses the question when an ayah was opened. Do not say that no passage in the selected language addresses the question once a relevant ayah is open. If Tamil or Sinhala tafsir text is missing, translate the opened Arabic or English commentary into the selected language. Do not present that translation as a tafsir the sources did not open. Use only wording that was opened. Do not invent a quotation, a date, a grade, an occasion of revelation, or a tafsir the opened sources do not contain. If the occasion was not opened, say what the ayah itself teaches and leave the occasion unnamed. Keep an opened verse that is semantically or theologically relevant even when its translation does not repeat the question, including an opened Qur’an 2:216 for a question about revelation through Jibril. Do not cite a verse that was not opened, and do not cite an unrelated verse.';

/** Final synthesis system prompt for every desk except hadith authentication. */
export function finalSynthesisSystemPrompt(): string {
  return [CIVILIZATIONAL_BRIDGE_PROMPT.trim(), OPENED_CLASSICAL_LIMIT, QURAN_SYNTHESIS_HEART].join('\n\n');
}

export type ResearchDomainId = 'hadith' | 'quran' | 'fiqh' | 'seerah';

export type StudioSpeaker = 'host' | 'tariq' | 'layla' | 'imran' | 'zainab' | 'yusuf' | 'amina';

/** Local evidence a configured agent may quote. Matching is by source, not by domain name. */
export type EvidenceKind =
  | 'quran-arabic'
  | 'quran-translation'
  | 'quran-context'
  | 'tafsir'
  | 'alquran'
  | 'books'
  | 'hadeethenc'
  | 'hadith-api'
  | 'parallel'
  | 'chronology'
  | 'variants'
  | 'historians'
  | 'opened-sources'
  | 'aggregated';

export const SPEAKER_LABEL: Record<StudioSpeaker, string> = {
  host: 'BROTHER FEROZ (HOST):',
  tariq: 'DR. TARIQ:',
  layla: 'DR. LAYLA:',
  imran: 'SHEIKH IMRAN:',
  zainab: 'DR. ZAINAB:',
  yusuf: 'SHEIKH YUSUF:',
  amina: 'DR. AMINA:',
};

export const SPEAKER_PERSONA: Record<StudioSpeaker, string> = {
  host: 'Brother Feroz',
  tariq: 'Dr. Tariq al-Mansoor',
  layla: 'Dr. Layla al-Qasimi',
  imran: 'Sheikh Imran al-Hasani',
  zainab: 'Dr. Zainab al-Mubarak',
  yusuf: 'Sheikh Yusuf al-Azhari',
  amina: 'Dr. Amina al-Kindi',
};

export interface DomainAgentConfig {
  id: string;
  speaker: StudioSpeaker;
  role: string;
  systemPrompt: string;
  goal: string;
  /** Human-readable database or source the agent is allowed to use. */
  sourceTarget: string;
  evidence: readonly EvidenceKind[];
}

export interface DomainResearchConfig {
  id: ResearchDomainId;
  /** Canonical category stored on a completed row. */
  label: string;
  controller: 'gemini' | 'parallel';
  scope: ResearchScope;
  teams: readonly ResearchTeamId[];
  agents: readonly DomainAgentConfig[];
}

const HADITH_AGENTS: readonly DomainAgentConfig[] = [
  {
    id: 'takhrij',
    speaker: 'tariq',
    role: 'Takhrij',
    systemPrompt:
      'You are the Takhrij agent. Locate the primary collections that contain this matn, quote the wording that was opened, and name additions or omissions only when the opened text shows them.',
    goal: 'Locate primary collections and compare the opened matn wording.',
    sourceTarget: 'Kutub al-Sittah and HadeethEnc (hadith-api edition files and HadeethEnc records)',
    evidence: ['hadeethenc', 'hadith-api'],
  },
  {
    id: 'isnad',
    speaker: 'layla',
    role: 'Isnad',
    systemPrompt:
      'You are the Isnad agent. Map only the narrator sequence printed in an opened record. If no chain was opened, do not build one from the matn or from another narration.',
    goal: 'Report the transmission chain only when an opened record prints it.',
    sourceTarget: 'Narrator sequence printed on the opened HadeethEnc or hadith-api record',
    evidence: ['hadeethenc', 'hadith-api'],
  },
  {
    id: 'rijal',
    speaker: 'imran',
    role: 'Rijal',
    systemPrompt:
      'You are the Rijal agent. Quote narrator criticism only when the opened biographical wording states it. Do not add a grade of your own.',
    goal: 'Quote jarh wa ta‘dil only from wording the opened record already contains.',
    sourceTarget: 'Biographical criticism printed in the opened record (Ibn Hajar, al-Dhahabi, and the record’s own citations)',
    evidence: ['hadeethenc', 'hadith-api'],
  },
  {
    id: 'shawahid-matn',
    speaker: 'zainab',
    role: 'Shawahid & Matn',
    systemPrompt:
      'You are the Shawahid and Matn agent. Compare opened narrations and note hidden defects or Qur’an corroboration only when those opened texts show them.',
    goal: 'Compare the opened matn with its supporting reports and leave unresolved differences unresolved.',
    sourceTarget: 'Opened narrations compared with QuranEnc ayahs cited by those records',
    evidence: ['hadeethenc', 'hadith-api', 'quran-arabic'],
  },
  {
    id: 'scholars',
    speaker: 'yusuf',
    role: "Scholars' Verdict",
    systemPrompt:
      'You are the Scholars’ Verdict agent. List grades only as the opened source prints them, with the scholar or editorial name the source names.',
    goal: 'Compile published grades without choosing a new one.',
    sourceTarget: 'Published grade on the HadeethEnc record and scholar names printed in that record',
    evidence: ['hadeethenc'],
  },
  {
    id: 'synthesis',
    speaker: 'host',
    role: 'Synthesis',
    systemPrompt:
      'You are the synthesis agent. Reconcile the other agents’ JSON. Do not add a source, a chain, or a grade that those agents did not already quote.',
    goal: 'Reconcile the six specialist results into one account of what was and was not established.',
    sourceTarget: 'Aggregated JSON from the agents that ran',
    evidence: ['aggregated'],
  },
  {
    id: 'hadeethenc',
    speaker: 'amina',
    role: 'HadeethEnc Source Research',
    systemPrompt:
      'You are the HadeethEnc source-research agent. Retrieve the encyclopedia record and keep the published translation, explanation, and grade distinct from your own summary.',
    goal: 'Open the HadeethEnc record and say what it contains and what it does not.',
    sourceTarget: 'HadeethEnc encyclopedia record (Arabic, translation, explanation, lessons, published grade)',
    evidence: ['hadeethenc', 'opened-sources'],
  },
];

const QURAN_AGENTS: readonly DomainAgentConfig[] = [
  {
    id: 'mushaf',
    speaker: 'tariq',
    role: 'Mushaf reading',
    systemPrompt:
      'You read the Arabic ayah from the opened mushaf. Quote that Arabic. Do not replace it with a paraphrase, and do not treat a translation as the Arabic.',
    goal: 'Quote the Arabic of the opened ayah.',
    sourceTarget: 'QuranEnc Uthmani Arabic text',
    evidence: ['quran-arabic'],
  },
  {
    id: 'translation',
    speaker: 'layla',
    role: 'Published translation',
    systemPrompt:
      'You report the published translation that was opened, including the translator credit. Do not write a new translation.',
    goal: 'Quote the opened translation and name its translator.',
    sourceTarget: 'QuranEnc translation edition for the selected language',
    evidence: ['quran-translation'],
  },
  {
    id: 'context',
    speaker: 'imran',
    role: 'Passage context',
    systemPrompt:
      'You report neighbouring ayahs that were opened so the cited verse is not read alone. A neighbour is context, not a separate answer.',
    goal: 'Quote neighbouring ayahs that were actually opened.',
    sourceTarget: 'QuranEnc neighbouring ayahs',
    evidence: ['quran-context'],
  },
  {
    id: 'tafsir',
    speaker: 'zainab',
    role: 'Tafsir',
    systemPrompt:
      'You are an empathetic scholar. Report the opened commentary and use it to answer the reader’s question: the meaning, the occasion of revelation when that commentary states it, and the theme the ayah teaches, such as tawakkul (trust in Allah) when the ayah is about trust, trial, or what people dislike. Do not present the commentary as the ayah itself. Do not add a tafsir, a quotation, or an occasion that was not opened. If the occasion was not opened, say so and still explain the theme from the opened text.',
    goal: 'Answer from the opened tafsir, including occasion and theme when that text states them.',
    sourceTarget: 'Al-Mukhtasar commentary on QuranEnc',
    evidence: ['tafsir'],
  },
  {
    id: 'thematic',
    speaker: 'yusuf',
    role: 'Thematic ayahs',
    systemPrompt:
      'You connect the opened ayah to the reader’s question. A related ayah from the search edition is context for the theme, not a new ruling. Name the theme the opened wording supports, including trust in Allah when the text is about reliance or trial. Do not discard an ayah because its wording does not repeat the reader’s sentence.',
    goal: 'Keep related ayahs and name the theme they teach.',
    sourceTarget: 'AlQuran Cloud search edition',
    evidence: ['alquran'],
  },
  {
    id: 'edition',
    speaker: 'amina',
    role: 'Edition check',
    systemPrompt:
      'You list which Qur’an editions were opened and which were not. Do not fill a missing edition with another language.',
    goal: 'Say which edition was opened and which text was not retrieved.',
    sourceTarget: 'QuranEnc edition record for the opened ayah',
    evidence: ['opened-sources'],
  },
  {
    id: 'reconciliation',
    speaker: 'host',
    role: 'Reconciliation',
    systemPrompt: finalSynthesisSystemPrompt(),
    goal: 'Answer the reader warmly from the opened ayah, its tafsir, and its theme.',
    sourceTarget: 'Aggregated JSON from the agents that ran',
    evidence: ['aggregated'],
  },
];

const FIQH_AGENTS: readonly DomainAgentConfig[] = [
  {
    id: 'ruling-text',
    speaker: 'tariq',
    role: 'Ruling text',
    systemPrompt:
      'You quote the fiqh passage that was opened. A catalogue title is not the book’s ruling. Do not turn a quotation into a new fatwa.',
    goal: 'Quote the opened book passage that addresses the question.',
    sourceTarget: 'IslamHouse fiqh books',
    evidence: ['books'],
  },
  {
    id: 'quran-evidence',
    speaker: 'layla',
    role: 'Qur’an evidence',
    systemPrompt:
      'You quote Qur’an ayahs opened for this question. The ayah is evidence in the source, not a ruling you authored.',
    goal: 'Quote the opened ayah used as evidence for the question.',
    sourceTarget: 'QuranEnc Arabic text and the published translation',
    evidence: ['quran-arabic', 'quran-translation'],
  },
  {
    id: 'cited-reports',
    speaker: 'imran',
    role: 'Cited reports',
    systemPrompt:
      'You quote prophetic reports the research engine opened. Report the grade only if the source prints one. Do not authenticate the chain yourself.',
    goal: 'Quote opened reports as evidence and leave unpublished grades unpublished.',
    sourceTarget: 'HadeethEnc records and hadith-api edition files, quoted as opened',
    evidence: ['hadeethenc', 'hadith-api'],
  },
  {
    id: 'school-positions',
    speaker: 'zainab',
    role: 'Compared opinions',
    systemPrompt:
      'You quote only pages this task cites when they compare more than one stated opinion. Do not invent a school, a scholar, or a disagreement.',
    goal: 'Quote compared opinions only from pages the task actually cited.',
    sourceTarget: 'Pages cited by the one Parallel task',
    evidence: ['parallel'],
  },
  {
    id: 'ruling-context',
    speaker: 'yusuf',
    role: 'Ruling context',
    systemPrompt:
      'You quote neighbouring ayahs that were opened around the verse used as evidence. Context is not a second ruling.',
    goal: 'Quote the neighbouring ayahs opened around the evidence.',
    sourceTarget: 'QuranEnc neighbouring ayahs',
    evidence: ['quran-context'],
  },
  {
    id: 'source-check',
    speaker: 'amina',
    role: 'Source check',
    systemPrompt:
      'You list the books, ayahs, and records that were opened, and you say when a text was not opened. A title match is not a quotation.',
    goal: 'List what was opened and what was only a title.',
    sourceTarget: 'Opened IslamHouse, QuranEnc, and HadeethEnc records',
    evidence: ['opened-sources'],
  },
  {
    id: 'reconciliation',
    speaker: 'host',
    role: 'Reconciliation',
    systemPrompt: finalSynthesisSystemPrompt(),
    goal: 'State what the opened sources establish for this question and what they do not.',
    sourceTarget: 'Aggregated JSON from the agents that ran',
    evidence: ['aggregated'],
  },
];

const SEERAH_AGENTS: readonly DomainAgentConfig[] = [
  {
    id: 'narrative',
    speaker: 'tariq',
    role: 'Event narrative',
    systemPrompt:
      'You quote the event account from the book text that was opened. A catalogue title is not the narrative. Do not add scenes the book did not open.',
    goal: 'Quote the opened account of the event.',
    sourceTarget: 'IslamHouse seerah books',
    evidence: ['books'],
  },
  {
    id: 'quran-mention',
    speaker: 'layla',
    role: 'Qur’an mention',
    systemPrompt:
      'You quote ayahs opened for this event. If no ayah was opened, do not supply one from memory.',
    goal: 'Quote the opened ayah that mentions the event, when one was opened.',
    sourceTarget: 'QuranEnc Arabic text and the published translation',
    evidence: ['quran-arabic', 'quran-translation'],
  },
  {
    id: 'chronology',
    speaker: 'imran',
    role: 'Chronology',
    systemPrompt:
      'You report a date only when the opened text states a year or a named event such as the Hijrah. Do not calculate a year the source did not state.',
    goal: 'Report dates the opened text itself states.',
    sourceTarget: 'Dates and named events printed in the opened seerah text',
    evidence: ['chronology'],
  },
  {
    id: 'differing-accounts',
    speaker: 'zainab',
    role: 'Differing accounts',
    systemPrompt:
      'When two opened reports are both in front of you, quote both and do not collapse them into one story. If a second report was not opened, say so.',
    goal: 'Keep two opened accounts side by side without merging them.',
    sourceTarget: 'Two or more opened reports of the same event',
    evidence: ['variants'],
  },
  {
    id: 'historians',
    speaker: 'yusuf',
    role: 'Named historians',
    systemPrompt:
      'You name a historian only when the opened text names that historian. Do not attribute the passage to Ibn Ishaq, Ibn Hisham, or al-Tabari unless the opened text does.',
    goal: 'Name historians only when the opened text names them.',
    sourceTarget: 'Historian names printed in the opened book or report',
    evidence: ['historians'],
  },
  {
    id: 'source-check',
    speaker: 'amina',
    role: 'Source check',
    systemPrompt:
      'You list which volumes and ayahs were opened and which requests returned nothing. Do not treat a missing book as evidence that the event did not happen.',
    goal: 'List the sources that were opened and the requests that returned nothing.',
    sourceTarget: 'Opened IslamHouse books, QuranEnc ayahs, and hadith records',
    evidence: ['opened-sources'],
  },
  {
    id: 'reconciliation',
    speaker: 'host',
    role: 'Reconciliation',
    systemPrompt: finalSynthesisSystemPrompt(),
    goal: 'State what the opened accounts establish and what they leave unresolved.',
    sourceTarget: 'Aggregated JSON from the agents that ran',
    evidence: ['aggregated'],
  },
];

export const DOMAIN_CONFIGS: Record<ResearchDomainId, DomainResearchConfig> = {
  hadith: {
    id: 'hadith',
    label: 'Hadith & Authentication',
    controller: 'gemini',
    scope: 'hadith',
    teams: ['hadith'],
    agents: HADITH_AGENTS,
  },
  quran: {
    id: 'quran',
    label: "Qur'an",
    controller: 'parallel',
    scope: 'quran',
    teams: ['quran'],
    agents: QURAN_AGENTS,
  },
  fiqh: {
    id: 'fiqh',
    label: 'Fiqh',
    controller: 'parallel',
    scope: 'knowledge',
    teams: ['quran', 'hadith', 'books'],
    agents: FIQH_AGENTS,
  },
  seerah: {
    id: 'seerah',
    label: 'Seerah',
    controller: 'parallel',
    scope: 'books',
    teams: ['books', 'quran', 'hadith'],
    agents: SEERAH_AGENTS,
  },
};

const ALIASES: Record<string, ResearchDomainId> = {
  hadith: 'hadith',
  hadeeth: 'hadith',
  'hadith & authentication': 'hadith',
  'hadith and authentication': 'hadith',
  authentication: 'hadith',
  "qur'an": 'quran',
  quran: 'quran',
  "qur'an & tafsir": 'quran',
  'quran & tafsir': 'quran',
  "qur'an and tafsir": 'quran',
  tafsir: 'quran',
  fiqh: 'fiqh',
  'fiqh & everyday life': 'fiqh',
  'fiqh and everyday life': 'fiqh',
  seerah: 'seerah',
  sirah: 'seerah',
  sira: 'seerah',
  'seerah & sirah': 'seerah',
};

export function normalizeCategory(category: string): string {
  return category.trim().toLowerCase().replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ');
}

/** Null when the category is not one of the four configured domains. */
export function resolveDomainConfig(category: string | null | undefined): DomainResearchConfig | null {
  const key = category ? ALIASES[normalizeCategory(category)] : undefined;
  return key ? DOMAIN_CONFIGS[key] : null;
}

/** An omitted category stays on the existing hadith authentication path. */
export function usesHadithAuthentication(category: string | null | undefined): boolean {
  if (!category?.trim()) return true;
  return resolveDomainConfig(category)?.controller === 'gemini';
}

export function assignmentForDomain(config: DomainResearchConfig): ResearchAssignmentView {
  return {
    scope: config.scope,
    teams: [...config.teams],
    bookId: null,
    noticeId: null,
    forwardedFrom: null,
  };
}

/**
 * Parallel reads the reader’s words before the seven agents run.
 * Typos, OCR, and speech-to-text stay in the question. The task deduces the target.
 */
export const PARALLEL_READER_INTAKE =
  'The question is the reader’s own words. It may include typos, text read from a photo or PDF, or speech-to-text. Before the agents run, deduce the surah and ayah, the hadith matn, or the fiqh matter from that text. Leave the reader’s wording unchanged in the question.';

<<<<<<< HEAD
/**
 * Final synthesis for an opened ayah.
 * The model answers the reader. It does not discard the ayah for a missing keyword.
 */
export const QURAN_SYNTHESIS_HEART =
  'You are a learned, compassionate scholar speaking to the reader. When an ayah has been opened, answer their question from that ayah. Quote its Arabic and its translation. State the occasion of revelation (asbab al-nuzul) and a classical tafsir only when the opened commentary states them. Then give the spiritual meaning and a practical comfort drawn from that opened wording. Bring in the opened tafsir, and the overarching theme the ayah teaches, such as tawakkul (trust in Allah) when the ayah is about reliance, trial, or what people dislike. Do not answer with a raw dump of the verse alone, and do not say that no passage addresses the question when an ayah was opened. Do not say that no passage in the selected language addresses the question once a relevant ayah is open. If Tamil or Sinhala tafsir text is missing, translate the opened Arabic or English commentary into the selected language. Do not present that translation as a tafsir the sources did not open. Use only wording that was opened. Do not invent a quotation, a date, a grade, an occasion of revelation, or a tafsir the opened sources do not contain. If the occasion was not opened, say what the ayah itself teaches and leave the occasion unnamed. Keep an opened verse that is semantically or theologically relevant even when its translation does not repeat the question, including an opened Qur’an 2:216 for a question about revelation through Jibril. Do not cite a verse that was not opened, and do not cite an unrelated verse.';

=======
>>>>>>> origin/cursor/research-studio-upgrade-3fe3
export function readerParallelInput(query: string, language: string): string {
  return [PARALLEL_READER_INTAKE, `Question: ${query}`, `Language: ${language}`].join('\n\n');
}

export interface ParallelDeskRequest {
  taskInput: string;
  agents?: { id: string; role: string; goal: string; sourceTarget: string }[];
}

/** Parallel brief for a research desk. Hadith authentication stays on its own path. */
export function parallelRequestForDesk(desk: string | null | undefined, query: string, language: string): ParallelDeskRequest | null {
  const domain = desk ? resolveDomainConfig(desk) : null;
  if (domain?.controller === 'parallel') {
    return {
      taskInput: parallelTaskInput(domain, query, language),
      agents: domain.agents.map(agent => ({
        id: agent.id,
        role: agent.role,
        goal: agent.goal,
        sourceTarget: agent.sourceTarget,
      })),
    };
  }
  if (desk === 'knowledge' || desk === 'books') {
    return { taskInput: [readerParallelInput(query, language), finalSynthesisSystemPrompt()].join('\n\n') };
  }
  return null;
}

/**
 * One Parallel task brief. The task API accepts one run, so every agent is named inside it.
 */
export function parallelTaskInput(config: DomainResearchConfig, query: string, language: string): string {
  const agents = config.agents
    .map(agent =>
      [
        `Agent id: ${agent.id}`,
        `Role: ${agent.role}`,
        `Goal: ${agent.goal}`,
        `Source target: ${agent.sourceTarget}`,
        `System prompt: ${agent.systemPrompt}`,
      ].join('\n'),
    )
    .join('\n\n');
  return [
    PARALLEL_READER_INTAKE,
    config.id === 'hadith' ? '' : finalSynthesisSystemPrompt(),
    `Category: ${config.label}`,
    `Question: ${query}`,
    `Language: ${language}`,
    'This is one Parallel task. Do not start a separate model call per agent. Cover the agents below inside this single task.',
    'Keep an opened ayah when it fits the reader’s quote, theme, or theological question. Do not reject it because the translation does not literally repeat the question.',
    'Return a finding for an agent only with a source title, URL, and an excerpt copied from that page. Leave the finding empty when you cannot cite a page.',
    'Do not invent quotations, dates, grades, or disagreements. Parallel confidence is provider metadata, not a hadith grade.',
    agents,
  ].filter(part => part !== '').join('\n\n');
}

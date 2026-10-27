/**
 * Seven-agent map for the Dragon Dawwa research engine.
 *
 * Hadith & Authentication records the existing matn, isnad, and six-plus-synthesis
 * roles. That path still runs through Gemini and does not read this file.
 * Qur'an, Fiqh, and Seerah each have their own roles and source targets.
 * Studio voice labels stay the ones the podcast player already parses.
 */

import type { ResearchAssignmentView, ResearchScope, ResearchTeamId } from '../../shared/contracts/v1.ts';

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
      'You report commentary that was opened, attributed to that commentary. Do not present the commentary as the ayah, and do not add a tafsir that was not opened.',
    goal: 'Quote opened commentary and keep it distinct from the ayah.',
    sourceTarget: 'Al-Mukhtasar commentary on QuranEnc',
    evidence: ['tafsir'],
  },
  {
    id: 'thematic',
    speaker: 'yusuf',
    role: 'Thematic ayahs',
    systemPrompt:
      'You list other ayahs the search edition returned for this subject. A search hit is not a tafsir and not a ruling.',
    goal: 'List related ayahs the search edition actually returned.',
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
    systemPrompt:
      'You reconcile the other agents’ JSON into what the opened text establishes. Do not add an ayah, a commentary, or a ruling that was not opened.',
    goal: 'State what the opened Qur’an sources establish and what they do not.',
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
    systemPrompt:
      'You reconcile the other agents’ JSON. Do not issue a fatwa, a madhhab, or a grade that the opened sources did not state.',
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
    systemPrompt:
      'You reconcile the other agents’ JSON into what the opened accounts establish. Do not add a date, a name, or a scene that was not opened.',
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
    `Category: ${config.label}`,
    `Question: ${query}`,
    `Language: ${language}`,
    'This is one Parallel task. Do not start a separate model call per agent. Cover the agents below inside this single task.',
    'Return a finding for an agent only with a source title, URL, and an excerpt copied from that page. Leave the finding empty when you cannot cite a page.',
    'Do not invent quotations, dates, grades, or disagreements. Parallel confidence is provider metadata, not a hadith grade.',
    agents,
  ].join('\n\n');
}

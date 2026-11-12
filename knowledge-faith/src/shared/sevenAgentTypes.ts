import type { Lang } from './sources.ts';

export interface SpecialistAgentFinding {
  agentNumber: number;
  agentId:
    | 'quran_tafsir'
    | 'hadith_sunnah'
    | 'isnad_rijal'
    | 'fiqh_consensus'
    | 'linguistic_maqasid'
    | 'modern_science'
    | 'executive_synthesis';
  title: string;
  personaName: string;
  roleBadge: string;
  verdictBadge: string;
  confidenceScore: string;
  arabicQuote?: string;
  arabicReference?: string;
  summary: string;
  keyPoints: string[];
  citations: string[];
  isScienceSpotlight?: boolean;
}

export interface ModernScienceForesight {
  headline: string;
  badge: string;
  summary: string;
  empiricalPillars: Array<{
    domain: string;
    finding: string;
    oneStepAheadNote: string;
  }>;
  methodologicalNote: string;
}

export interface RoundtableTurn {
  speaker: string;
  role: string;
  voiceProfile: 'tariq' | 'yusuf' | 'noor';
  text: string;
}

export interface SevenAgentResearchDossier {
  id: string;
  question: string;
  lang: Lang;
  verdictHeadline: string;
  verdictClassification: string;
  confidenceScore: number;
  executiveSummary: string;
  agents: SpecialistAgentFinding[];
  scienceForesight: ModernScienceForesight;
  roundtableTurns: RoundtableTurn[];
  roundtableScriptText: string;
  createdAt: string;
}

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

/** Parse dossier generation time; invalid/missing timestamps sort as oldest. */
export function dossierCreatedAtMs(
  dossier: Pick<SevenAgentResearchDossier, 'createdAt'>,
): number {
  const raw = dossier?.createdAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/** Newest generated dossiers first (`createdAt` descending). */
export function sortDossiersNewestFirst<T extends Pick<SevenAgentResearchDossier, 'createdAt'>>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => dossierCreatedAtMs(b) - dossierCreatedAtMs(a));
}

/** When merging duplicates by question, keep the more recently generated copy. */
export function preferNewerDossier(
  a: SevenAgentResearchDossier,
  b: SevenAgentResearchDossier,
): SevenAgentResearchDossier {
  return dossierCreatedAtMs(a) >= dossierCreatedAtMs(b) ? a : b;
}

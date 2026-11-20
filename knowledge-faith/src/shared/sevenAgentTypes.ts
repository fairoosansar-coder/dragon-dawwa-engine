import type { Lang } from './sources.ts';

/** Synthesis completion state — never invent a confidence % for incomplete work. */
export type SevenAgentSynthesisStatus =
  | 'sources_only'
  | 'live_synthesis'
  | 'authored'
  | 'unavailable';

/** Subtle dossier-header provenance badge labels (Report Origin). */
export type SevenAgentReportOrigin =
  | 'live_synthesis'
  | 'curated_benchmark'
  | 'cached_dossier'
  | 'sources_only'
  | 'unavailable';

export const SEVEN_AGENT_REPORT_ORIGIN_LABEL: Record<SevenAgentReportOrigin, string> = {
  live_synthesis: 'Live Synthesis',
  curated_benchmark: 'Curated Benchmark',
  cached_dossier: 'Cached Dossier',
  sources_only: 'Sources Only',
  unavailable: 'Unavailable',
};

/** Shared evidence row hydrated from `/api/research/jobs` so both endpoints cite the same set. */
export interface SevenAgentRetrievedPassage {
  id: string;
  locator: string;
  text: string;
  arabic?: string | null;
  provider?: string;
  publishedGrade?: string | null;
  readerRoute?: string | null;
  canonicalUrl?: string | null;
}

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
  /** Null when live synthesis has not completed (sources_only / unavailable). */
  confidenceScore: number | null;
  executiveSummary: string;
  agents: SpecialistAgentFinding[];
  scienceForesight: ModernScienceForesight;
  roundtableTurns: RoundtableTurn[];
  roundtableScriptText: string;
  createdAt: string;
  /** Honest synthesis state for UI precedence and banners. */
  status: SevenAgentSynthesisStatus;
  /** Report Origin Badge in the dossier header. */
  reportOrigin: SevenAgentReportOrigin;
  /** Passages shared with a matching research job (when hydrated). */
  retrievedPassages?: SevenAgentRetrievedPassage[];
}

/** True when the board must not replace completed research-job passages. */
export function isSourcesOnlyOrUnavailable(
  dossier: Pick<SevenAgentResearchDossier, 'status'> | null | undefined,
): boolean {
  return dossier?.status === 'sources_only' || dossier?.status === 'unavailable';
}

export function reportOriginLabel(
  origin: SevenAgentReportOrigin | null | undefined,
): string {
  if (!origin) return SEVEN_AGENT_REPORT_ORIGIN_LABEL.sources_only;
  return SEVEN_AGENT_REPORT_ORIGIN_LABEL[origin];
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

/**
 * Cap by save/insert (MRU) order. Do not sort by createdAt before capping —
 * sorted storage would put an older just-saved item last so the next save drops it.
 * Newest-generated ordering belongs on read/display only.
 */
export function capByInsertOrder<T>(items: readonly T[], limit: number): T[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return items.slice(0, safeLimit);
}

/** When merging duplicates by question, keep the more recently generated copy. */
export function preferNewerDossier(
  a: SevenAgentResearchDossier,
  b: SevenAgentResearchDossier,
): SevenAgentResearchDossier {
  return dossierCreatedAtMs(a) >= dossierCreatedAtMs(b) ? a : b;
}

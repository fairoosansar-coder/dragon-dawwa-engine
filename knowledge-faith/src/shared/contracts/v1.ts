/**
 * Shared research contract v1 for Dragon Dawwa Studio.
 *
 * Studio should start work with POST /api/research/jobs and read GET /api/research/jobs/:id.
 * Cancel with POST /api/research/jobs/:id/cancel.
 * Playback stays in Studio. This contract does not start audio.
 * Do not send the raw question to one literal search box. The job returns the subquestions and queries it actually ran.
 */
export const RESEARCH_CONTRACT_VERSION = '1.0.0' as const;

export type ContractVersion = typeof RESEARCH_CONTRACT_VERSION;

export type ContentLanguage = 'en' | 'ta' | 'si';

export type ContentKind = 'article' | 'book' | 'audio' | 'video' | 'pdf' | 'quran' | 'hadith' | 'name' | 'science' | 'other';

export type PassageRole = 'source_text' | 'translation' | 'commentary' | 'generated' | 'empirical';

export type ResearchStatus = 'queued' | 'running' | 'done' | 'cancelled' | 'error';

export type ResearchScope = 'knowledge' | 'quran' | 'hadith' | 'books';

export type ResearchTeamId = 'quran' | 'hadith' | 'books';

export type AgentRunStatus = 'ran' | 'not_run' | 'unavailable';

export type ResearchNoticeId = 'forward-hadith' | 'forward-quran' | 'forward-books' | 'forward-knowledge';

/** What one specialist actually did on this job. A role that did not run is not a finding. */
export interface AgentContribution {
  id: string;
  team: ResearchTeamId;
  role: string;
  status: AgentRunStatus;
  detail: string;
}

export interface ResearchAssignmentView {
  scope: ResearchScope;
  teams: ResearchTeamId[];
  bookId: number | null;
  noticeId: ResearchNoticeId | null;
  forwardedFrom: ResearchScope | null;
}

export type QuestionDomain = 'scripture' | 'explanation' | 'practice' | 'history' | 'science' | 'mixed';

export type CoverageKind =
  | 'evidence_found'
  | 'no_relevant_evidence'
  | 'source_unavailable'
  | 'language_unavailable'
  | 'budget_exhausted'
  | 'conflicting_evidence'
  | 'scholarly_review_required'
  | 'science_not_configured';

export type ClaimSupport = 'supported' | 'unsupported' | 'unfaithful' | 'citation_missing' | 'insufficient';

export interface RightsMetadata {
  source: string;
  conditions: string;
  /** True only for text Dragon Dawwa wrote. Source passages stay false. */
  generatedWork: boolean;
  checkedOn: string;
}

export interface SourceCredit {
  role: string;
  name: string | null;
}

export interface SourceRecord {
  contractVersion: ContractVersion;
  id: string;
  provider: string;
  language: string;
  edition: string | null;
  version: string | null;
  title: string;
  credits: SourceCredit[];
  canonicalUrl: string;
  contentType: ContentKind;
  rights: RightsMetadata;
  retrievedAt: string;
  contentHash: string | null;
}

export interface EvidencePassage {
  contractVersion: ContractVersion;
  id: string;
  source: SourceRecord;
  text: string;
  originalLanguage: string;
  arabic: string | null;
  locator: string;
  context: string | null;
  readerRoute: string | null;
  role: PassageRole;
  /** Grade string published on the source record. Null when the source omitted it. */
  publishedGrade: string | null;
}

export interface ResearchSubquestion {
  id: string;
  text: string;
  domain: QuestionDomain;
  queries: string[];
}

export interface CoverageNote {
  kind: CoverageKind;
  provider: string;
  detail: string;
}

export interface ResearchProgress {
  step: string;
  completed: number;
  total: number;
}

export interface ResearchTimings {
  totalMs: number;
  sources: Record<string, number>;
}

export interface QuestionInterpretationView {
  meaning: string;
  scopes: { id: string; text: string }[];
}

export interface ResearchJobView {
  contractVersion: ContractVersion;
  id: string;
  question: string;
  language: ContentLanguage;
  subquestions: ResearchSubquestion[];
  status: ResearchStatus;
  progress: ResearchProgress;
  coverage: CoverageNote[];
  errors: { provider: string; message: string }[];
  startedAt: string;
  finishedAt: string | null;
  timingsMs: ResearchTimings;
  /** Present when the coordinating agent assigned this job. Older jobs omit it. */
  assignment?: ResearchAssignmentView | null;
  /** Roles that were assigned. Includes roles that did not run, marked not_run. */
  agents?: AgentContribution[];
  /** Readings of the question, recorded before search. Older jobs omit it. */
  interpretation?: QuestionInterpretationView | null;
}

export interface ClaimEvidence {
  claim: string;
  passageIds: string[];
  support: ClaimSupport;
  citationExists: boolean;
  quotationFaithful: boolean | null;
  citationRelevant: boolean | null;
  note: string;
}

export interface ResearchAnswerParagraph {
  text: string;
  citations: string[];
}

/** A readable answer written only from retrieved passages. */
export interface ResearchAnswer {
  paragraphs: ResearchAnswerParagraph[];
  insufficientEvidence: boolean;
  /** assistant: the study model wrote from the packet. retrieved: the packet was quoted because the model did not write. */
  writer: 'assistant' | 'retrieved';
}

export interface ResearchDossierView {
  contractVersion: ContractVersion;
  jobId: string;
  passages: EvidencePassage[];
  claims: ClaimEvidence[];
  unresolved: string[];
  disagreements: string[];
  verificationNote: string;
  /** Older jobs omit this. Null when nothing was retrieved to write from. */
  answer?: ResearchAnswer | null;
}

export interface ResearchJobResponse {
  contractVersion: ContractVersion;
  job: ResearchJobView;
  dossier: ResearchDossierView | null;
}

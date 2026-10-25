/**
 * Dragon Dawwa - Hadith Deep Search & Authentication Engine Types
 * 7-Agent Architecture (Preserving Agents 1–6 + Adding Agent 7: Source Research via HadeethEnc)
 */

export interface SourceTakhrij {
  collection: string;
  hadith_number: string;
  exact_wording: string;
  exact_wording_arabic?: string;
  exact_wording_english?: string;
  wording_differences?: string;
}

export interface Agent1Takhrij {
  sources: SourceTakhrij[];
  variants_summary: string;
}

export interface ChainLink {
  teacher: string;
  student: string;
  transmission_mode: string;
  connection_status: 'Connected (Muttasil)' | 'Broken (Munqati\')' | 'Broken (Mu\'allaq)' | 'Uncertain (Mudallas)' | 'Uncertain (Mu\'an\'an)' | string;
  historical_reasoning: string;
}

export interface Agent2Isnad {
  narrator_sequence: string[];
  chain_links: ChainLink[];
  overall_chain_status: string;
}

export type NarratorGrade = 
  | 'Thiqah Thiqah' 
  | 'Thiqah' 
  | 'Saduq' 
  | 'Saduq Yahim' 
  | 'Da\'if' 
  | 'Matruk' 
  | 'Majhul' 
  | 'Mawdu\' / Wadda\''
  | string;

export interface NarratorBio {
  narrator_name: string;
  critic_verdicts: string[];
  critic_quotes_translated?: string;
  status: NarratorGrade;
  citations: string[];
}

export interface Agent3Rijal {
  narrators: NarratorBio[];
}

export interface Agent4ShawahidMatn {
  supporting_reports: string[];
  quranic_corroboration_arabic?: string;
  quranic_corroboration_english?: string;
  hidden_defects_ilal: string[];
  contradictions: string[];
}

export interface ScholarGrading {
  scholar: string;
  grading: 'Sahih' | 'Hasan' | 'Da\'if' | 'Mawdu\'' | 'Shadh' | 'Sahih Lighayrihi' | 'Hasan Lighayrihi' | string;
  reference: string;
}

export interface Agent5ScholarsVerdict {
  gradings: ScholarGrading[];
}

export interface HistoricalVariationPoint {
  id: string;
  collection: string;
  label: string;
  hadith_number?: string;
  year_ah?: number;
  confidence_score: number;
  matn_integrity: number;
  isnad_continuity: number;
  exact_wording_arabic?: string;
  wording_differences?: string;
  defect_flag?: string;
  status: 'Sahih' | 'Hasan' | 'Da\'if' | 'Mawdu\'' | 'Shadh' | string;
}

export interface Agent6Synthesis {
  final_status: string;
  purity_confidence_score: number;
  consensus_and_disagreements: string;
  executive_report_markdown: string;
  podcast_script: string;
}

/* ---------- Agent 7: Source Research (HadeethEnc Encyclopedia Specialist) ---------- */

export interface HadeethEncRetrievedRecord {
  id: string;
  title: string;
  arabic: string | null;
  translation: string;
  language: 'en' | 'ta' | 'si';
  explanation: string | null;
  lessons: string[];
  published_grade: string | null;
  collection_attribution: string | null;
  source_url: string;
  reader_route: string;
  /** A word match identifies a candidate passage; it never automatically labels a claim "Supported". */
  match_status: 'Direct Hadith Match' | 'Candidate Passage (Word Match — Not Automatic Support)' | 'Corroborating Theme Passage';
  match_reason: string;
}

export interface AttributedScholarlyOpinion {
  author_or_source: string;
  opinion_text: string;
  reference: string;
}

export interface Agent7CrossAgentResponse {
  target_agent: string;
  response_text: string;
  cited_references: string[];
}

export interface Agent7ResearchActivity {
  queries_run: string[];
  candidates_found: number;
  records_opened: string[];
  unopened_count: number;
  duration_ms: number;
  note: string;
}

export interface Agent7SourceResearch {
  persona_name: string;
  role_title: string;
  summary_established: string;
  retrieved_records: HadeethEncRetrievedRecord[];
  attributed_opinions: AttributedScholarlyOpinion[];
  agent_interpretation: string;
  responses_to_agents: Agent7CrossAgentResponse[];
  unresolved_questions: string[];
  research_activity: Agent7ResearchActivity;
}

export interface DragonDawwaAnalysis {
  app_name: 'Dragon Dawwa' | string;
  version?: string;
  platform_owner?: string;
  designed_and_created_by?: string;
  query_hadith: string;
  research_job_id?: string;
  agent_1_takhrij: Agent1Takhrij;
  agent_2_isnad: Agent2Isnad;
  agent_3_rijal: Agent3Rijal;
  agent_4_shawahid_matn: Agent4ShawahidMatn;
  agent_5_scholars_verdict: Agent5ScholarsVerdict;
  agent_6_synthesis: Agent6Synthesis;
  agent_7_source_research?: Agent7SourceResearch;
  historical_variations_trend?: HistoricalVariationPoint[];
}

export interface SampleHadithPreset {
  id: string;
  title: string;
  category: string;
  hadith_text: string;
  isnad_text?: string;
  defaultData: DragonDawwaAnalysis;
}

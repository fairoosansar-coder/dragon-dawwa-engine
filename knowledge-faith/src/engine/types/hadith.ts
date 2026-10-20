/**
 * Dragon Dawwa - Hadith Deep Search & Authentication Engine Types
 * Based on Google AI Studio 6-Agent Architecture
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
  transmission_mode: string; // e.g. "haddathana", "'an", "sami'tu", "akhbarana"
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
  confidence_score: number; // 0.0 - 100.0
  matn_integrity: number; // 0.0 - 100.0
  isnad_continuity: number; // 0.0 - 100.0
  exact_wording_arabic?: string;
  wording_differences?: string;
  defect_flag?: string;
  status: 'Sahih' | 'Hasan' | 'Da\'if' | 'Mawdu\'' | 'Shadh' | string;
}

export interface Agent6Synthesis {
  final_status: string;
  purity_confidence_score: number; // 0.0 - 100.0
  consensus_and_disagreements: string;
  executive_report_markdown: string;
  podcast_script: string;
}

export interface DragonDawwaAnalysis {
  app_name: 'Dragon Dawwa' | string;
  version?: string;
  platform_owner?: string;
  designed_and_created_by?: string;
  query_hadith: string;
  agent_1_takhrij: Agent1Takhrij;
  agent_2_isnad: Agent2Isnad;
  agent_3_rijal: Agent3Rijal;
  agent_4_shawahid_matn: Agent4ShawahidMatn;
  agent_5_scholars_verdict: Agent5ScholarsVerdict;
  agent_6_synthesis: Agent6Synthesis;
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

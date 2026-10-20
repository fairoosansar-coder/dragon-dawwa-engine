export interface FuzzyNormalizationResult {
  raw_input: string;
  matched_hadith_id: string;
  canonical_arabic: string;
  canonical_english: string;
  canonical_primary_source: string;
  canonical_isnad: string;
  fuzzy_similarity_ratio: number; // 0.0 - 1.0
  detected_intents: string[];
  spelling_corrections_applied: { original: string; corrected: string }[];
  is_close_match: boolean;
}

export interface BenchmarkCorpusItem {
  id: string;
  title: string;
  tag: string;
  score: string;
  scoreValue: number;
  scoreType: 'success' | 'warning' | 'danger';
  matn: string;
  isnad: string;
  category: string;
}

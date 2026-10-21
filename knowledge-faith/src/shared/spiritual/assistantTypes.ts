import type { Lang } from '../sources.ts';
import type { AnswerParagraph, Evidence } from '../types.ts';
import type { AssetCategory, LiabilityCategory } from './zakah.ts';

export interface StudyAnswer {
  question: string;
  lang: Lang;
  paragraphs: AnswerParagraph[];
  evidence: Evidence[];
  insufficientEvidence: boolean;
  /** Asked when the question depends on personal circumstances the sources cannot settle. */
  clarifyingQuestions: string[];
  /** The retrieved material shows a recognised difference of opinion. */
  differencesNoted: boolean;
  /** Draft the user can edit and take to a qualified scholar. Never sent anywhere by the app. */
  scholarQuestionDraft: string;
  model: string;
}

/** A field the assistant proposes from the user's own words. Nothing is added until the user confirms it. */
export interface ZakahSuggestion {
  kind: 'asset' | 'liability';
  category: AssetCategory | LiabilityCategory;
  label: string;
  /** Copied verbatim from the user's text; suggestions with numbers not in the text are discarded. */
  amount?: string;
  weight?: string;
  unit?: string;
  karat?: number;
  currency?: string;
  quote: string;
}

export interface ZakahAssist {
  suggestions: ZakahSuggestion[];
  followUpQuestions: string[];
  terms: { term: string; explanation: string }[];
  discarded: number;
  model: string;
}

/** The only parts of a result sent for explanation: structure and codes, never amounts. */
export interface ZakahExplainInput {
  profileId: string;
  profileVersion: string;
  status: string;
  nisabBasis: 'gold' | 'silver';
  nisabMet: boolean;
  hawl: string;
  includedCategories: string[];
  excluded: { category: string; reason: string }[];
  liabilitiesNotApplied: string[];
  unresolved: string[];
  lang: Lang;
}

export interface ZakahExplanation {
  paragraphs: string[];
  scholarQuestions: string[];
  model: string;
}

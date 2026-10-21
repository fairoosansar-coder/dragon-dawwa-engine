export const EDITORIAL_STAGES = [
  'draft',
  'source_check',
  'religious_review',
  'language_review',
  'approved',
  'published',
  'withdrawn',
] as const;

export type EditorialStage = (typeof EDITORIAL_STAGES)[number];

export interface ReviewRecord {
  stage: 'source_check' | 'religious_review' | 'language_review';
  reviewer: string;
  role: string;
  date: string;
}

export interface EditorialMeta {
  author: string;
  updated: string;
  publicationState: EditorialStage;
  reviews: ReviewRecord[];
  translationEdition: string | null;
  languageReview: 'pending' | 'recorded';
  interpretiveTradition: string | null;
}

/** A verified label requires a named religious-review record. Draft text never qualifies. */
export function isScholarReviewed(meta: Pick<EditorialMeta, 'reviews' | 'publicationState'>): boolean {
  if (meta.publicationState === 'draft' || meta.publicationState === 'withdrawn') return false;
  return meta.reviews.some(
    review =>
      review.stage === 'religious_review' &&
      review.reviewer.trim().length > 0 &&
      review.role.trim().length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(review.date),
  );
}

export function editorialLabel(meta: EditorialMeta): 'scholar-reviewed' | 'not-reviewed' {
  return isScholarReviewed(meta) ? 'scholar-reviewed' : 'not-reviewed';
}

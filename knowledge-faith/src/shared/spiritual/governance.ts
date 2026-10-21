import { LANGS, type Lang } from '../sources.ts';
import { PROSE_SECTIONS, type GuideSectionId } from './catalog.ts';

/**
 * Editorial workflow for religious guides:
 * Draft → Source check → Religious review → Language review → Approved → Published, with withdrawal and revisions.
 * A transition is allowed only for a user holding the required role, and review stages require a recorded
 * approving review in the current round, so "scholar reviewed" can never be shown without one.
 */
export type Role = 'author' | 'source-checker' | 'religious-reviewer' | 'language-reviewer' | 'publisher';
export const ROLES: Role[] = ['author', 'source-checker', 'religious-reviewer', 'language-reviewer', 'publisher'];

export type PublicationState = 'draft' | 'source-check' | 'religious-review' | 'language-review' | 'approved' | 'published' | 'withdrawn';

export type ReviewKind = 'source' | 'religious' | 'language';

export interface EditorUser {
  id: string;
  name: string;
  roles: Role[];
  /** Public description of qualifications, shown alongside a religious review, e.g. "Graduate of …". */
  credential?: string;
}

export interface EditorialReview {
  id: string;
  kind: ReviewKind;
  decision: 'approved' | 'changes-requested';
  reviewer: { id: string; name: string; role: Role; credential?: string };
  date: string;
  notes: string;
  /** Language reviews are per language. */
  lang?: Lang;
  round: number;
}

export interface HistoryEntry {
  at: string;
  by: string;
  action: string;
  from: PublicationState;
  to: PublicationState;
}

export type SectionText = Partial<Record<GuideSectionId, Partial<Record<Lang, string>>>>;

export interface GuideRevision {
  rev: number;
  state: PublicationState;
  round: number;
  author: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  withdrawnAt?: string;
  sections: SectionText;
  /** Named edition or translator for each language's text. */
  translationEdition: Partial<Record<Lang, string>>;
  /** Interpretive tradition(s) the text follows or presents, e.g. "Presents Hanafi and Shafi'i positions". */
  interpretiveTradition: string;
  changeNote: string;
  /** Editor-only working notes. */
  notes: string;
  reviews: EditorialReview[];
  history: HistoryEntry[];
}

export interface GuideRecord {
  slug: string;
  revisions: GuideRevision[];
}

export type Action =
  | 'submit'
  | 'pass-source-check'
  | 'pass-religious-review'
  | 'pass-language-review'
  | 'publish'
  | 'request-changes'
  | 'withdraw';

interface TransitionRule {
  from: PublicationState[];
  to: PublicationState;
  roles: Role[];
  requires?: ReviewKind;
}

export const TRANSITIONS: Record<Action, TransitionRule> = {
  submit: { from: ['draft'], to: 'source-check', roles: ['author'] },
  'pass-source-check': { from: ['source-check'], to: 'religious-review', roles: ['source-checker'], requires: 'source' },
  'pass-religious-review': { from: ['religious-review'], to: 'language-review', roles: ['religious-reviewer'], requires: 'religious' },
  'pass-language-review': { from: ['language-review'], to: 'approved', roles: ['language-reviewer'], requires: 'language' },
  publish: { from: ['approved'], to: 'published', roles: ['publisher'] },
  'request-changes': {
    from: ['source-check', 'religious-review', 'language-review', 'approved'],
    to: 'draft',
    roles: ['source-checker', 'religious-reviewer', 'language-reviewer', 'publisher'],
  },
  withdraw: { from: ['published'], to: 'withdrawn', roles: ['publisher'] },
};

/** Which review kinds each role may record. */
export const REVIEW_ROLE: Record<ReviewKind, Role> = {
  source: 'source-checker',
  religious: 'religious-reviewer',
  language: 'language-reviewer',
};

export class EditorialError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function hasRole(user: EditorUser, roles: Role[]): boolean {
  return user.roles.some(r => roles.includes(r));
}

/** Languages that have text in at least one prose section. */
export function contentLanguages(rev: GuideRevision): Lang[] {
  return LANGS.filter(l => PROSE_SECTIONS.some(s => (rev.sections[s]?.[l] ?? '').trim()));
}

export function approvedReviews(rev: GuideRevision, kind: ReviewKind): EditorialReview[] {
  return rev.reviews.filter(r => r.kind === kind && r.round === rev.round && r.decision === 'approved');
}

/** Languages whose text passed language review in the revision's current round. */
export function approvedLanguages(rev: GuideRevision): Lang[] {
  const reviewed = new Set(approvedReviews(rev, 'language').map(r => r.lang));
  return contentLanguages(rev).filter(l => reviewed.has(l));
}

export function missingRequirement(rev: GuideRevision, action: Action): string | null {
  const rule = TRANSITIONS[action];
  if (action === 'submit' && contentLanguages(rev).length === 0) return 'The revision has no text to review.';
  if (!rule.requires) return null;
  if (rule.requires === 'language') {
    const langs = contentLanguages(rev);
    const reviewed = new Set(approvedReviews(rev, 'language').map(r => r.lang));
    const missing = langs.filter(l => !reviewed.has(l));
    return missing.length ? `Language review is missing for: ${missing.join(', ')}.` : null;
  }
  return approvedReviews(rev, rule.requires).length ? null : `An approving ${rule.requires} review must be recorded first.`;
}

export function allowedActions(rev: GuideRevision, user: EditorUser): Action[] {
  return (Object.keys(TRANSITIONS) as Action[]).filter(action => {
    const rule = TRANSITIONS[action];
    return rule.from.includes(rev.state) && hasRole(user, rule.roles) && !missingRequirement(rev, action);
  });
}

export function applyTransition(record: GuideRecord, revNumber: number, action: Action, user: EditorUser, now: string): GuideRevision {
  const rev = record.revisions.find(r => r.rev === revNumber);
  if (!rev) throw new EditorialError('Revision not found', 404);
  const rule = TRANSITIONS[action];
  if (!rule) throw new EditorialError('Unknown action', 400);
  if (!hasRole(user, rule.roles)) throw new EditorialError(`This action requires the role: ${rule.roles.join(' or ')}.`, 403);
  if (!rule.from.includes(rev.state)) throw new EditorialError(`Cannot ${action} a revision in state ${rev.state}.`, 409);
  const missing = missingRequirement(rev, action);
  if (missing) throw new EditorialError(missing, 409);

  const from = rev.state;
  rev.state = rule.to;
  rev.updatedAt = now;
  if (action === 'request-changes') rev.round += 1;
  if (action === 'publish') {
    rev.publishedAt = now;
    for (const other of record.revisions) {
      if (other !== rev && other.state === 'published') {
        other.state = 'withdrawn';
        other.withdrawnAt = now;
        other.history.push({ at: now, by: user.id, action: 'superseded', from: 'published', to: 'withdrawn' });
      }
    }
  }
  if (action === 'withdraw') rev.withdrawnAt = now;
  rev.history.push({ at: now, by: user.id, action, from, to: rule.to });
  return rev;
}

export function addReview(
  rev: GuideRevision,
  user: EditorUser,
  input: { kind: ReviewKind; decision: 'approved' | 'changes-requested'; notes: string; lang?: Lang },
  id: string,
  now: string,
): EditorialReview {
  const role = REVIEW_ROLE[input.kind];
  if (!role) throw new EditorialError('Unknown review kind', 400);
  if (!user.roles.includes(role)) throw new EditorialError(`Recording a ${input.kind} review requires the role: ${role}.`, 403);
  const stage: Record<ReviewKind, PublicationState> = { source: 'source-check', religious: 'religious-review', language: 'language-review' };
  if (rev.state !== stage[input.kind]) throw new EditorialError(`A ${input.kind} review can only be recorded during ${stage[input.kind]}.`, 409);
  if (input.kind === 'religious' && user.id === rev.author.id) {
    throw new EditorialError('The author of a revision cannot record its religious review.', 403);
  }
  if (input.kind === 'language' && (!input.lang || !LANGS.includes(input.lang))) throw new EditorialError('Language reviews need a language.', 400);
  const review: EditorialReview = {
    id,
    kind: input.kind,
    decision: input.decision,
    reviewer: { id: user.id, name: user.name, role, ...(user.credential ? { credential: user.credential } : {}) },
    date: now,
    notes: input.notes.slice(0, 2000),
    ...(input.kind === 'language' ? { lang: input.lang } : {}),
    round: rev.round,
  };
  rev.reviews.push(review);
  rev.updatedAt = now;
  return review;
}

/* ---------- What readers may see ---------- */

export interface PublicReviewSummary {
  name: string;
  role: Role;
  credential?: string;
  date: string;
  lang?: Lang;
}

export interface PublicGuide {
  slug: string;
  status: 'published' | 'in-preparation' | 'withdrawn';
  rev?: number;
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
  /** True only when the published revision carries an approving religious review. */
  scholarReviewed: boolean;
  reviews: { source: PublicReviewSummary[]; religious: PublicReviewSummary[]; language: PublicReviewSummary[] };
  /** Languages whose text passed language review. */
  languages: Lang[];
  /** Requested language when available; null when the guide is not available in it. */
  lang: Lang | null;
  sections: Partial<Record<GuideSectionId, string>>;
  translationEdition?: string;
  interpretiveTradition?: string;
  changeNote?: string;
}

const summary = (r: EditorialReview): PublicReviewSummary => ({
  name: r.reviewer.name,
  role: r.reviewer.role,
  ...(r.reviewer.credential ? { credential: r.reviewer.credential } : {}),
  date: r.date,
  ...(r.lang ? { lang: r.lang } : {}),
});

/** Projects a guide record to what an anonymous reader may see: only the published revision, only reviewed languages. */
export function publicGuide(record: GuideRecord | undefined, slug: string, lang: Lang): PublicGuide {
  const empty: PublicGuide = {
    slug,
    status: 'in-preparation',
    scholarReviewed: false,
    reviews: { source: [], religious: [], language: [] },
    languages: [],
    lang: null,
    sections: {},
  };
  if (!record) return empty;
  const published = record.revisions.find(r => r.state === 'published');
  if (!published) {
    const withdrawn = record.revisions.some(r => r.state === 'withdrawn' && r.publishedAt);
    return withdrawn ? { ...empty, status: 'withdrawn' } : empty;
  }
  const languages = approvedLanguages(published);
  const shown = languages.includes(lang) ? lang : null;
  const sections: Partial<Record<GuideSectionId, string>> = {};
  if (shown) {
    for (const s of PROSE_SECTIONS) {
      const text = published.sections[s]?.[shown]?.trim();
      if (text) sections[s] = text;
    }
  }
  const religious = approvedReviews(published, 'religious');
  return {
    slug,
    status: 'published',
    rev: published.rev,
    publishedAt: published.publishedAt,
    updatedAt: published.updatedAt,
    author: published.author.name,
    scholarReviewed: religious.length > 0,
    reviews: {
      source: approvedReviews(published, 'source').map(summary),
      religious: religious.map(summary),
      language: approvedReviews(published, 'language').map(summary),
    },
    languages,
    lang: shown,
    sections,
    translationEdition: shown ? published.translationEdition[shown] : undefined,
    interpretiveTradition: published.interpretiveTradition || undefined,
    changeNote: published.changeNote || undefined,
  };
}

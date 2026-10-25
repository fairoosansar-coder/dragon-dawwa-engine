import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  overallReviewStatus,
  REVIEW_STATUS_LABEL,
  type ReviewOutcome,
  type ReviewRole,
  type ReviewStatus,
} from '../../shared/research/revision.ts';

export interface StoredReview {
  role: ReviewRole;
  reviewerId: string;
  reviewerName: string;
  qualification: string;
  organisation: string;
  outcome: ReviewOutcome;
  notes: string;
  declarationAccepted: true;
  submittedAt: string;
  revision: string;
  contentSha256: string;
}

export interface StoredExport {
  exportId: string;
  at: string;
  revision: string;
  contentSha256: string;
}

interface RevisionRecord {
  revision: string;
  contentSha256: string;
  reviews: StoredReview[];
  exports: StoredExport[];
}

interface ReportRecord {
  current: RevisionRecord;
  history: RevisionRecord[];
}

export interface PublicReviewer {
  id: string;
  name: string;
  roles: string[];
  canSubmitSources: boolean;
  canSubmitFindings: boolean;
}

export interface PublicReview {
  revision: string;
  contentSha256: string;
  status: ReviewStatus;
  statusLabel: string;
  reviews: StoredReview[];
  history: RevisionRecord[];
  exports: StoredExport[];
  digitalReviewAvailable: boolean;
  viewer: PublicReviewer | null;
}

export class ReviewError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function emptyRevision(revision: string, contentSha256: string): RevisionRecord {
  return { revision, contentSha256, reviews: [], exports: [] };
}

function publicReview(record: ReportRecord, digitalReviewAvailable: boolean, viewer: PublicReviewer | null): PublicReview {
  const status = overallReviewStatus(record.current.reviews);
  return {
    revision: record.current.revision,
    contentSha256: record.current.contentSha256,
    status,
    statusLabel: REVIEW_STATUS_LABEL[status],
    reviews: record.current.reviews,
    history: record.history,
    exports: record.current.exports,
    digitalReviewAvailable,
    viewer,
  };
}

/**
 * Reviews are bound to a content revision. A changed question, quotation, translation,
 * finding, or conclusion archives the previous reviews and clears the current revision.
 * Nothing here stores a signature image.
 */
export class HumanReviewStore {
  private reports = new Map<string, ReportRecord>();

  constructor(private readonly filePath?: string) {
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { reports?: Record<string, ReportRecord> };
      for (const [id, record] of Object.entries(parsed.reports ?? {})) this.reports.set(id, record);
    } catch {
      this.reports.clear();
    }
  }

  private save() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const reports = Object.fromEntries(this.reports);
    fs.writeFileSync(this.filePath, JSON.stringify({ reports }));
  }

  /** Aligns the stored revision with the dossier now on screen. Does not approve anything. */
  sync(reportKey: string, revision: string, contentSha256: string, digitalReviewAvailable: boolean, viewer: PublicReviewer | null): PublicReview {
    let record = this.reports.get(reportKey);
    if (!record) {
      record = { current: emptyRevision(revision, contentSha256), history: [] };
      this.reports.set(reportKey, record);
      this.save();
      return publicReview(record, digitalReviewAvailable, viewer);
    }
    if (record.current.revision !== revision || record.current.contentSha256 !== contentSha256) {
      if (record.current.reviews.length || record.current.exports.length) record.history.push(record.current);
      record.current = emptyRevision(revision, contentSha256);
      this.save();
    }
    return publicReview(record, digitalReviewAvailable, viewer);
  }

  submit(input: {
    reportKey: string;
    revision: string;
    contentSha256: string;
    reviewerId: string;
    reviewerName: string;
    roles: string[];
    role: ReviewRole;
    qualification: string;
    organisation: string;
    outcome: ReviewOutcome;
    notes: string;
    declarationAccepted: boolean;
    submittedAt: string;
  }): PublicReview {
    const requiredRole = input.role === 'sources' ? 'source-checker' : 'religious-reviewer';
    if (!input.roles.includes(requiredRole)) {
      throw new ReviewError('This account is not authorised for that review role.', 403);
    }
    if (!input.declarationAccepted) throw new ReviewError('The declaration must be confirmed before a review is recorded.', 400);
    const record = this.reports.get(input.reportKey) ?? { current: emptyRevision(input.revision, input.contentSha256), history: [] };
    if (record.current.revision !== input.revision || record.current.contentSha256 !== input.contentSha256) {
      throw new ReviewError('This review does not match the current report revision. Reload the report and review that revision.', 409);
    }
    if (record.current.reviews.some(review => review.reviewerId === input.reviewerId && review.role === input.role)) {
      throw new ReviewError('This account has already submitted this review role for the current revision.', 409);
    }
    if (record.current.reviews.some(review => review.reviewerId === input.reviewerId)) {
      throw new ReviewError('The same account cannot complete both review roles for this revision.', 403);
    }
    if (record.current.reviews.some(review => review.role === input.role)) {
      throw new ReviewError('This role already has a review for the current revision.', 409);
    }
    record.current.reviews.push({
      role: input.role,
      reviewerId: input.reviewerId,
      reviewerName: input.reviewerName,
      qualification: input.qualification,
      organisation: input.organisation,
      outcome: input.outcome,
      notes: input.notes,
      declarationAccepted: true,
      submittedAt: input.submittedAt,
      revision: input.revision,
      contentSha256: input.contentSha256,
    });
    this.reports.set(input.reportKey, record);
    this.save();
    return publicReview(record, true, null);
  }

  /** Records which revision was exported. It does not change any review or the verification status. */
  recordExport(reportKey: string, revision: string, contentSha256: string, at: string): { exportId: string; status: ReviewStatus } {
    const record = this.reports.get(reportKey) ?? { current: emptyRevision(revision, contentSha256), history: [] };
    if (record.current.revision !== revision) {
      if (record.current.reviews.length || record.current.exports.length) record.history.push(record.current);
      record.current = emptyRevision(revision, contentSha256);
    }
    const before = overallReviewStatus(record.current.reviews);
    const exportId = `exp-${randomUUID()}`;
    record.current.exports.push({ exportId, at, revision, contentSha256 });
    this.reports.set(reportKey, record);
    this.save();
    const after = overallReviewStatus(record.current.reviews);
    if (before !== after) throw new ReviewError('Recording an export changed the verification status.', 500);
    return { exportId, status: after };
  }
}

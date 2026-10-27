import express from 'express';
import type { DragonDawwaAnalysis } from '../../engine/types/hadith.ts';
import { getLocalizedAnalysis } from '../../engine/utils/localizedAnalysis.ts';
import { bindReport } from '../../engine/utils/reportBinding.ts';
import { attachAgent7ToAnalysis } from '../../engine/utils/agent7SourceResearch.ts';
import { reportIdFor } from '../../engine/utils/reportPresentation.ts';
import { reportIdentity, type ReviewOutcome, type ReviewRole } from '../../shared/research/revision.ts';
import type { Lang } from '../../shared/sources.ts';
import { toLang } from '../../shared/sources.ts';
import { UpstreamError } from '../http.ts';
import { authenticate, type EditorAccount } from '../spiritual/editorialStore.ts';
import { getResearchJob } from '../../engine/server/researchJobs.ts';
import { HumanReviewStore, ReviewError } from './humanReviewStore.ts';

const ROLES: ReviewRole[] = ['sources', 'findings'];
const OUTCOMES: ReviewOutcome[] = ['approved', 'approved_with_corrections', 'revision_required'];

function prepared(analysis: DragonDawwaAnalysis, lang: Lang) {
  const localized = getLocalizedAnalysis(analysis, lang);
  const enriched = bindReport(
    localized.agent_7_source_research ? localized : attachAgent7ToAnalysis(localized, lang),
  );
  return reportIdentity(enriched, reportIdFor(enriched.query_hadith), lang);
}

function viewerFrom(accounts: EditorAccount[], header: string | undefined) {
  const user = authenticate(accounts, header);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    roles: user.roles,
    canSubmitSources: user.roles.includes('source-checker'),
    canSubmitFindings: user.roles.includes('religious-reviewer'),
  };
}

function text(value: unknown, max: number): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw.slice(0, max);
}

export function humanReviewRouter(deps: { accounts: EditorAccount[]; reviews: HumanReviewStore }): express.Router {
  const router = express.Router();

  const load = (jobId: string, lang: Lang) => {
    const job = getResearchJob(jobId);
    if (!job || job.status !== 'done' || !job.result || typeof job.result !== 'object') {
      throw new UpstreamError('This report is no longer available. Run the research again before requesting review.', 404);
    }
    return prepared(job.result as DragonDawwaAnalysis, lang);
  };

  router.get('/api/reports/:jobId/review', (req, res, next) => {
    try {
      const lang = toLang(req.query.lang);
      const identity = load(String(req.params.jobId), lang);
      const viewer = viewerFrom(deps.accounts, req.headers.authorization);
      const review = deps.reviews.sync(
        String(req.params.jobId),
        identity.revision,
        identity.contentSha256,
        deps.accounts.length > 0,
        viewer,
      );
      res.set('Cache-Control', 'no-store');
      res.json({
        ...review,
        question: identity.question,
        reportId: identity.reportId,
        language: identity.language,
        generatedAt: identity.generatedAt,
        cryptographicSignature: false,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/reports/:jobId/review', (req, res, next) => {
    try {
      const user = authenticate(deps.accounts, req.headers.authorization);
      if (!user) throw new UpstreamError('Sign in with a reviewer access token.', 401);
      const lang = toLang(req.body?.lang ?? req.query.lang);
      const identity = load(String(req.params.jobId), lang);
      const role = req.body?.role;
      const outcome = req.body?.outcome;
      if (!ROLES.includes(role)) throw new UpstreamError('Choose the review role assigned to this account.', 400);
      if (!OUTCOMES.includes(outcome)) throw new UpstreamError('Choose a review outcome.', 400);
      const qualification = text(req.body?.qualification, 300);
      if (!qualification) throw new UpstreamError('Qualification / relevant expertise is required.', 400);
      deps.reviews.sync(String(req.params.jobId), identity.revision, identity.contentSha256, true, null);
      const review = deps.reviews.submit({
        reportKey: String(req.params.jobId),
        revision: identity.revision,
        contentSha256: identity.contentSha256,
        reviewerId: user.id,
        reviewerName: user.name,
        roles: user.roles,
        role,
        qualification,
        organisation: text(req.body?.organisation, 300),
        outcome,
        notes: text(req.body?.notes, 4000),
        declarationAccepted: req.body?.declarationAccepted === true,
        submittedAt: new Date().toISOString(),
      });
      res.status(201).json({ ...review, cryptographicSignature: false });
    } catch (error) {
      next(error instanceof ReviewError ? new UpstreamError(error.message, error.status) : error);
    }
  });

  router.post('/api/reports/:jobId/review/export', (req, res, next) => {
    try {
      const lang = toLang(req.body?.lang ?? req.query.lang);
      const identity = load(String(req.params.jobId), lang);
      const recorded = deps.reviews.recordExport(String(req.params.jobId), identity.revision, identity.contentSha256, new Date().toISOString());
      res.status(201).json({ ...recorded, revision: identity.revision, cryptographicSignature: false });
    } catch (error) {
      next(error instanceof ReviewError ? new UpstreamError(error.message, error.status) : error);
    }
  });

  return router;
}

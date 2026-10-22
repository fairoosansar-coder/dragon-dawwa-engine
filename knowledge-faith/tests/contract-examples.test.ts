import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RESEARCH_JOBS_PATH,
  cancelResearchJobResponse,
  createResearchJobAccepted,
  createResearchJobQueries,
  createResearchJobRequest,
  researchJobDone,
  researchJobRunning,
} from '../src/shared/contracts/examples.ts';

test('research contract examples keep the question out of the search list', () => {
  assert.equal(createResearchJobAccepted.contractVersion, '1.0.0');
  assert.equal(RESEARCH_JOBS_PATH, '/api/research/jobs');
  const queries: readonly string[] = createResearchJobQueries;
  assert.equal(queries.includes(createResearchJobRequest.question), false);
  assert.equal(researchJobRunning.dossier, null);
  assert.equal(researchJobRunning.job.status, 'running');
  assert.equal(researchJobDone.job.status, 'done');
  assert.equal(researchJobDone.dossier?.passages[0]?.publishedGrade, 'Authentic');
  assert.equal(researchJobDone.dossier?.claims[0]?.support, 'supported');
  assert.equal(cancelResearchJobResponse.job.status, 'cancelled');
  assert.match(researchJobDone.dossier?.verificationNote ?? '', /not a scholarly verdict/);
});

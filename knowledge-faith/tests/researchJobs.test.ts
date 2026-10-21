import test from 'node:test';
import assert from 'node:assert/strict';
import { clearResearchJobs, getResearchJob, startResearchJob } from '../src/engine/server/researchJobs.ts';

test('research job stays running until the background work finishes', async () => {
  clearResearchJobs();
  const id = startResearchJob(
    () => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 30)),
    err => (err instanceof Error ? err.message : 'failed'),
  );
  assert.equal(getResearchJob(id)?.status, 'running');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(getResearchJob(id)?.status, 'done');
  assert.deepEqual(getResearchJob(id)?.result, { ok: true });
  assert.equal(getResearchJob('missing'), undefined);
});

test('research job stores the caller-facing failure message', async () => {
  clearResearchJobs();
  const id = startResearchJob(
    () => Promise.reject(new Error('gemini down')),
    () => 'The hadith research engine could not complete this request. Please retry.',
  );
  await new Promise(resolve => setTimeout(resolve, 20));
  const job = getResearchJob(id);
  assert.equal(job?.status, 'error');
  assert.match(job?.error ?? '', /could not complete/);
});

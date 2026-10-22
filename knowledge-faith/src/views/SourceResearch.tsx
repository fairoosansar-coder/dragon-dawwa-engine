import { useEffect, useState, type FormEvent } from 'react';
import { postJson, useRemote } from '../lib/api.ts';
import { useApp } from '../lib/store.tsx';
import type { ResearchJobResponse } from '../shared/contracts/v1.ts';
import { researchOutcome } from '../shared/research/outcomes.ts';
import { Button, Card, ErrorNote, Notice } from '../components/ui.tsx';

export function SourceResearch() {
  const { lang, config } = useApp();
  const [question, setQuestion] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const remote = useRemote<ResearchJobResponse>(jobId ? `/api/research/jobs/${jobId}` : null);
  const running = remote.data?.job.status === 'running' || remote.data?.job.status === 'queued';

  useEffect(() => {
    if (!running) return;
    // A step can last longer than one refresh without changing its progress count.
    // Keep asking until the job leaves running, including when the snapshot looks unchanged.
    const timer = window.setInterval(() => remote.reload(), 700);
    return () => window.clearInterval(timer);
  }, [running, remote.reload]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    try {
      const created = await postJson<{ id: string }>('/api/research/jobs', { question, lang });
      setJobId(created.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'The research job could not be started.');
    }
  }

  async function cancel() {
    if (!jobId) return;
    await postJson(`/api/research/jobs/${jobId}/cancel`, {});
    remote.reload();
  }

  const job = remote.data?.job;
  const dossier = remote.data?.dossier;
  const passageCount = dossier?.passages.length ?? 0;
  const finished = job?.status === 'done' || job?.status === 'error' || job?.status === 'cancelled';
  const outcome = job && finished
    ? researchOutcome({
        question: job.question,
        queryCount: job.subquestions.reduce((total, sub) => total + sub.queries.length, 0),
        passageCount,
        coverage: job.coverage,
      })
    : null;

  return (
    <div className="mb-8 space-y-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Source research</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-pine">Ask with the sources in view</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
          A question is split into searches. A retrieved passage keeps the grade and reference printed by its source. This check does not call a library sahih.
        </p>
        {config && config.ai === false && (
          <p className="mt-3 text-sm text-ink/70">
            Live study help and spoken audio are not available on this server. Research uses the words in your question.
          </p>
        )}
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-pine" htmlFor="source-question">
            Question
          </label>
          <textarea
            id="source-question"
            value={question}
            onChange={event => setQuestion(event.target.value)}
            rows={4}
            maxLength={800}
            className="w-full rounded-2xl border border-pine/20 bg-white px-4 py-3 text-base"
            placeholder="What are the rights of a neighbor? How should someone visit the sick?"
          />
          <div className="flex gap-3">
            <Button type="submit" disabled={question.trim().length < 3 || running}>
              Research sources
            </Button>
            {running && (
              <Button type="button" variant="soft" onClick={() => void cancel()}>
                Cancel
              </Button>
            )}
          </div>
        </form>
        {submitError && <div className="mt-3"><ErrorNote message={submitError} /></div>}
      </Card>

      {job && (
        <Card>
          <p className="text-sm font-medium text-pine">
            {job.status === 'running' ? job.progress.step : job.status}
            {job.timingsMs.totalMs ? ` · ${job.timingsMs.totalMs} ms` : ''}
          </p>
          {job.subquestions.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm">
              {job.subquestions.map(sub => (
                <li key={sub.id}>
                  <span className="font-medium">{sub.text}</span>
                  {sub.queries.length > 0 && <span className="text-ink/70"> · searches: {sub.queries.join(' · ')}</span>}
                </li>
              ))}
            </ul>
          )}
          {outcome && passageCount === 0 && (
            <div className="mt-4">
              <Notice>
                <p className="font-semibold">{outcome.title}</p>
                <p className="mt-1">{outcome.detail}</p>
                {outcome.retry && (
                  <div className="mt-3">
                    <Button type="button" variant="soft" onClick={() => void onSubmit({ preventDefault() {} } as FormEvent)}>
                      Retry
                    </Button>
                  </div>
                )}
              </Notice>
            </div>
          )}
          <ul className="mt-4 space-y-2">
            {job.coverage
              .filter(note => !note.detail.startsWith('Live Gemini is not configured'))
              .map(note => (
                <li key={`${note.kind}-${note.provider}-${note.detail}`}>
                  <p className="text-sm leading-relaxed text-ink/80">{note.detail}</p>
                </li>
              ))}
          </ul>
          {job.errors.map(error => (
            <p key={`${error.provider}-${error.message}`} className="mt-2 text-sm text-red-900">
              {error.provider}: {error.message}
            </p>
          ))}
        </Card>
      )}

      {dossier && (
        <section className="space-y-3" aria-label="Retrieved passages">
          <h2 className="font-display text-2xl font-bold text-pine">Retrieved passages</h2>
          {dossier.claims.map(claim => (
            <Notice key={claim.claim}>
              {claim.support === 'supported' && <span className="font-semibold">Supported. </span>}
              {claim.note}
              {claim.passageIds.length > 0 && <span> Passages: {claim.passageIds.join(', ')}.</span>}
            </Notice>
          ))}
          {dossier.unresolved.map(item => (
            <Notice key={item}>{item}</Notice>
          ))}
          {dossier.passages.map(passage => (
            <Card key={passage.id}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pine">
                {passage.source.provider} · {passage.role.replaceAll('_', ' ')}
              </p>
              <h3 className="mt-2 font-display text-xl font-bold text-pine">{passage.source.title}</h3>
              {passage.publishedGrade && <p className="mt-2 text-sm font-medium">Published grade: {passage.publishedGrade}</p>}
              <p className="mt-2 text-sm text-ink/70">{passage.locator}</p>
              {passage.arabic && (
                <p lang="ar" dir="rtl" className="mt-4 text-2xl leading-loose">
                  {passage.arabic}
                </p>
              )}
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed" lang={passage.originalLanguage}>
                {passage.text}
              </p>
              {passage.context && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-pine">Context and notes</summary>
                  <p className="mt-2 text-sm leading-relaxed text-ink/80">{passage.context}</p>
                </details>
              )}
              {passage.readerRoute && (
                <a className="mt-3 inline-block text-sm font-medium text-pine underline" href={passage.readerRoute}>
                  Open in the library
                </a>
              )}
            </Card>
          ))}
          {outcome && passageCount > 0 && (
            <Notice>
              <p className="font-semibold">{outcome.title}</p>
              <p className="mt-1">{outcome.detail}</p>
            </Notice>
          )}
          <p className="text-sm text-ink/70">{dossier.verificationNote}</p>
        </section>
      )}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
    </div>
  );
}

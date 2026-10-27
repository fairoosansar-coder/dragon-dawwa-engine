import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ResearchJobResponse, ResearchScope } from '../shared/contracts/v1.ts';
import { buildReportModel, renderReportHtml } from '../shared/research/report.ts';
import { materialPartLabel } from '../shared/research/materialCoverage.ts';
import { researchOutcome } from '../shared/research/outcomes.ts';
import { toLang, type Lang } from '../shared/sources.ts';
import { useRemote } from '../lib/api.ts';
import { beginResearch, noticeText, readResearchHistory, rememberResearch, researchHref, type StoredResearch } from '../lib/researchDesk.ts';
import { questionsToResearch, separateQuestions } from '../shared/research/questions.ts';
import { useApp } from '../lib/store.tsx';
import { Button, ErrorNote, Loading, Notice } from '../components/ui.tsx';
import { FullReport } from './FullReport.tsx';

const DossierWorkbench = lazy(() => import('../engine/DossierWorkbench.tsx'));

export function ResearchDesk({ entry, params }: { entry: ResearchScope; params: URLSearchParams }) {
  const { t, lang, setLang } = useApp();
  const paramLang = params.get('lang');
  const bookId = Number(params.get('book'));
  const selectedBook = Number.isInteger(bookId) && bookId > 0 ? bookId : null;
  const [question, setQuestion] = useState(params.get('q') ?? '');
  const askedParam = params.get('q');
  const jobParam = params.get('job');
  const [jobId, setJobId] = useState<string | null>(jobParam);
  const [notice, setNotice] = useState<string | null>(null);
  const [clarify, setClarify] = useState(false);
  const [clarified, setClarified] = useState(params.get('clarified') === '1');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StoredResearch[]>([]);
  const [chapters, setChapters] = useState<{ id: string; scope: ResearchScope; question: string; forwarded?: boolean }[]>([]);
  const remote = useRemote<ResearchJobResponse>(jobId ? `/api/research/jobs/${jobId}` : null);
  const running = remote.data?.job.status === 'running' || remote.data?.job.status === 'queued';
  const parallelPending = remote.data?.job.status === 'done' && remote.data.job.parallel?.status === 'running';

  useEffect(() => {
    if (paramLang === 'en' || paramLang === 'ta' || paramLang === 'si') setLang(paramLang);
  }, [paramLang, setLang]);

  useEffect(() => {
    setJobId(jobParam);
    if (!askedParam) return;
    const parts = separateQuestions(askedParam);
    setQuestion(parts[0] ?? askedParam);
  }, [jobParam, askedParam]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem('kf-research-chapters') || '[]') as { id: string; scope: ResearchScope; question: string; forwarded?: boolean }[];
      setChapters(Array.isArray(parsed) ? parsed : []);
    } catch {
      setChapters([]);
    }
  }, [jobId]);

  useEffect(() => {
    setHistory(readResearchHistory().filter(item => item.scope === entry));
  }, [entry, remote.data?.job.status]);

  useEffect(() => {
    if (!running && !parallelPending) return;
    const timer = window.setInterval(() => remote.reload(), parallelPending ? 2000 : 700);
    return () => window.clearInterval(timer);
  }, [running, parallelPending, remote.reload]);

  useEffect(() => {
    const response = remote.data;
    const job = response?.job;
    const dossier = response?.dossier;
    if (!response || !job || !dossier || (job.status !== 'done' && job.status !== 'error' && job.status !== 'cancelled')) return;
    rememberResearch({
      id: job.id,
      question: job.question,
      language: job.language,
      scope: job.assignment?.scope ?? entry,
      savedAt: job.finishedAt ?? new Date().toISOString(),
      response,
    });
    setHistory(readResearchHistory().filter(item => item.scope === entry));
  }, [remote.data, entry]);

  useEffect(() => {
    const id = remote.data?.job.assignment?.noticeId;
    const text = noticeText(id, t as unknown as Record<string, string>);
    if (text) setNotice(text);
  }, [remote.data?.job.assignment?.noticeId, t]);

  async function researchOne(asked: string, extra?: { clarified?: boolean; prior?: string | null; force?: boolean }) {
    return beginResearch({
      question: asked,
      entry,
      lang,
      bookId: selectedBook,
      forwarded: params.get('fwd') === '1',
      clarified: extra?.clarified ?? clarified,
      priorQuestion: extra?.clarified ? extra.prior ?? null : null,
      force: extra?.force,
    });
  }

  async function submit(event?: FormEvent, extra?: { clarified?: boolean; prior?: string | null; force?: boolean }) {
    event?.preventDefault();
    const clarifying = extra?.clarified === true;
    const pieces = questionsToResearch(question, clarifying ? null : remote.data?.job.question ?? null, clarifying);
    if (!pieces.length) return;
    setError(null);
    try {
      const startedChapters: { id: string; scope: ResearchScope; question: string; forwarded: boolean }[] = [];
      for (const piece of pieces) {
        const started = await researchOne(piece, extra);
        if (started.action === 'clarify' || !started.id || !started.scope) {
          setClarify(true);
          setQuestion(piece);
          return;
        }
        startedChapters.push({ id: started.id, scope: started.scope, question: piece, forwarded: started.action === 'forward' });
      }
      setClarify(false);
      setQuestion(startedChapters[0].question);
      if (startedChapters.length > 1) {
        sessionStorage.setItem('kf-research-chapters', JSON.stringify(startedChapters));
        setChapters(startedChapters);
      }
      const first = startedChapters[0];
      const href = researchHref(first.scope, first.id, lang, first.forwarded, selectedBook, first.question);
      if (first.scope !== entry || window.location.hash !== href) {
        window.location.hash = href;
        return;
      }
      setJobId(first.id);
      remote.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The research job could not be started.');
    }
  }

  async function researchSeparate(piece: string) {
    setError(null);
    try {
      const started = await researchOne(piece, { force: true });
      if (started.action === 'clarify' || !started.id || !started.scope) {
        setClarify(true);
        setQuestion(piece);
        return;
      }
      setClarify(false);
      setQuestion(piece);
      const href = researchHref(started.scope, started.id, lang, started.action === 'forward', selectedBook, piece);
      if (started.scope !== entry || window.location.hash !== href) {
        window.location.hash = href;
        return;
      }
      setJobId(started.id);
      remote.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The research job could not be started.');
    }
  }

  const savedReport = useMemo(() => history.find(item => item.id === jobId) ?? null, [history, jobId]);
  const job = remote.data?.job ?? (remote.loading ? undefined : savedReport?.response.job);
  const dossier = remote.data?.dossier ?? (remote.loading ? null : savedReport?.response.dossier ?? null);
  const model = job ? buildReportModel(job, dossier) : null;
  const finished = job?.status === 'done' || job?.status === 'error' || job?.status === 'cancelled';
  const outcome = job && finished
    ? researchOutcome({
        question: job.question,
        queryCount: job.subquestions.reduce((total, sub) => total + sub.queries.length, 0),
        passageCount: dossier?.passages.length ?? 0,
        coverage: job.coverage,
        investigation: job.investigation,
        parallelStatus: job.parallel?.status,
        jobStatus: job.status,
      })
    : null;
  const heading = entry === 'knowledge' ? t.askIslam : entry === 'quran' ? t.researchQuran : entry === 'hadith' ? t.researchHadith : t.researchBooks;
  const description = entry === 'knowledge' ? t.askIslamBody : t.askIslamBody;

  function download() {
    if (!model || !job) return;
    const blob = new Blob([renderReportHtml(model)], { type: 'text/html' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `dragon-dawwa-report-${job.id}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  const liveModel = model ?? (savedReport && !remote.loading ? buildReportModel(savedReport.response.job, savedReport.response.dossier) : null);
  const citedPassages = (liveModel?.passages ?? []).filter(
    passage => !passage.context?.startsWith('Neighbouring') && (liveModel?.citationIds.length ? liveModel.citationIds.includes(passage.id) : true),
  );
  const otherQuestions = job ? separateQuestions(job.question).slice(1) : [];
  const offersPodcast = job?.investigation !== 'blocked' && otherQuestions.length === 0 && (dossier?.passages.length ?? savedReport?.response.dossier?.passages.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gold/50 bg-white px-5 py-6 sm:px-7">
        <h1 className="font-display text-4xl font-bold leading-tight text-pine">{heading}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/75">{description}</p>
        {selectedBook && <p className="mt-2 text-sm text-pine">IslamHouse {selectedBook}</p>}
        <form onSubmit={event => void submit(event)} className="mt-5 space-y-3">
          <label className="sr-only" htmlFor="research-question">{heading}</label>
          <textarea
            id="research-question"
            value={question}
            onChange={event => setQuestion(event.target.value)}
            rows={4}
            maxLength={800}
            placeholder={t.askIslamPlaceholder}
            className="w-full rounded-3xl border border-pine/20 bg-sand px-4 py-4 text-base leading-relaxed"
          />
          <Button type="submit" disabled={question.trim().length < 3 || running} className="w-full py-3 sm:w-auto">
            {t.researchMyQuestion}
          </Button>
        </form>
        {otherQuestions.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm leading-relaxed text-ink/75">This record joined more than one question. Each question keeps its own research.</p>
            {otherQuestions.map(item => (
              <Button key={item} type="button" variant="soft" onClick={() => void researchSeparate(item)}>
                {item}
              </Button>
            ))}
          </div>
        )}
        {chapters.length > 1 && (
          <ul className="mt-4 space-y-2">
            {chapters.map((chapter, index) => (
              <li key={chapter.id}>
                <a href={researchHref(chapter.scope, chapter.id, lang, chapter.forwarded === true, selectedBook, chapter.question)} className="text-sm font-medium text-pine hover:underline">
                  Chapter {index + 1}. {chapter.question}
                </a>
              </li>
            ))}
          </ul>
        )}
        {notice && <div className="mt-4"><Notice>{notice}</Notice></div>}
        {clarify && (
          <form
            className="mt-4 space-y-3"
            onSubmit={event => {
              setClarified(true);
              void submit(event, { clarified: true, prior: question });
            }}
          >
            <p className="text-sm font-medium text-pine">{t.clarifyMeaning}</p>
            <textarea
              value={question}
              onChange={event => setQuestion(event.target.value)}
              rows={3}
              className="w-full rounded-3xl border border-pine/20 bg-sand px-4 py-3 text-base"
            />
            <Button type="submit">{t.researchMyQuestion}</Button>
          </form>
        )}
        {error && <div className="mt-4"><ErrorNote message={error} /></div>}
      </section>

      {job && running && (
        <section className="rounded-3xl border border-pine/10 bg-parchment p-5" aria-live="polite">
          <h2 className="font-display text-2xl font-bold text-pine">{t.researchProgress}</h2>
          <ResearchActivity job={job} />
        </section>
      )}
      {running && <Loading label={t.researchProgress} />}
      {remote.error && !savedReport && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {outcome && (
        <Notice>
          <span className="font-semibold">{outcome.title} </span>
          {outcome.detail}
          {outcome.retry && (
            <span className="mt-3 block">
              <Button type="button" variant="soft" onClick={() => void submit(undefined, { force: true })}>
                {t.retry}
              </Button>
            </span>
          )}
        </Notice>
      )}

      {liveModel && finished && (
        <div className="space-y-4">
          <section className="rounded-3xl border border-gold bg-white p-5" data-research-answer>
            <h2 className="font-display text-2xl font-bold text-pine">Answer</h2>
            {job?.interpretation?.meaning && <p className="mt-2 text-sm leading-relaxed text-ink/80">{job.interpretation.meaning}</p>}
            {job?.interpretation?.scopes?.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/80">
                {job.interpretation.scopes.map(scope => (
                  <li key={scope.id}>{scope.text}</li>
                ))}
              </ul>
            ) : null}
            {liveModel.answer ? <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">{liveModel.answer}</p> : <p className="mt-3 text-sm text-muted">No answer was written from the retrieved passages.</p>}
            {job?.materialParts?.some(part => part.status === 'unresolved') && (
              <ul className="mt-3 space-y-1 text-sm text-ink/80" data-material-coverage>
                {job.materialParts.filter(part => part.status === 'unresolved').map(part => (
                  <li key={part.id}><span className="font-semibold text-pine">{materialPartLabel(part.kind)}. </span>{part.note}</li>
                ))}
              </ul>
            )}
            {job?.parallel?.liveCallMade && job.parallel.status === 'running' && (
              <p className="mt-3 text-sm leading-relaxed text-ink/75" data-parallel-status>
                Further sources are still being read. Findings already supported stay on this page. A later revision will not replace audio that is playing.
              </p>
            )}
            {job?.parallel?.liveCallMade && job.parallel.status === 'failed' && (
              <p className="mt-3 text-sm leading-relaxed text-ink/75" data-parallel-status>
                One research source failed. That is a source failure, not a finding that the subject is absent.
              </p>
            )}
            {job?.parallel && !job.parallel.liveCallMade && (
              <p className="mt-3 text-sm leading-relaxed text-ink/75" data-parallel-status>
                Further source research was not called.
              </p>
            )}
            {liveModel.answerArabic && (
              <p className="mt-3 font-arabic text-2xl leading-loose" dir="rtl" lang="ar">{liveModel.answerArabic}</p>
            )}
            <h3 className="mt-4 font-display text-lg font-bold text-pine">Citations</h3>
            {citedPassages.length === 0 && <p className="mt-2 text-sm text-muted">No passage was kept.</p>}
            <ul className="mt-2 space-y-2 text-sm">
              {citedPassages.map(passage => (
                <li key={passage.id}>
                  <span className="font-semibold text-pine">{passage.locator}</span>
                  <span className="text-muted"> · {passage.source.provider}{passage.publishedGrade ? ` · ${passage.publishedGrade}` : ''}</span>
                </li>
              ))}
            </ul>
          </section>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={download}>{t.downloadReport}</Button>
            {job && offersPodcast && (
              <a href={`#/podcast?job=${job.id}&lang=${lang}`} className="inline-flex items-center rounded-full border border-pine/20 px-4 py-2 text-sm font-medium text-pine">
                {t.makePodcast}
              </a>
            )}
          </div>
          <FullReport model={liveModel} />
        </div>
      )}
      {job && finished && (
        <details className="rounded-3xl border border-pine/10 bg-parchment p-5">
          <summary className="cursor-pointer font-display text-xl font-bold text-pine">{t.researchProgress}</summary>
          <ResearchActivity job={job} />
        </details>
      )}

      {entry === 'hadith' && (
        <details className="rounded-3xl border border-pine/15 bg-white/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-pine">{t.researchHadith}</summary>
          <div className="mt-4">
            <Suspense fallback={<Loading />}>
              <DossierWorkbench />
            </Suspense>
          </div>
        </details>
      )}

      <section>
        <h2 className="font-display text-2xl font-bold text-pine">{t.previousResearch}</h2>
        {history.length === 0 && <p className="mt-2 text-sm text-muted">{t.previousEmpty}</p>}
        <ul className="mt-3 space-y-2">
          {history.map(item => (
            <li key={item.id}>
              <a href={researchHref(entry, item.id, item.language as Lang, false, selectedBook)} className="text-sm font-medium text-pine hover:underline">
                {item.question}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ResearchActivity({ job }: { job: ResearchJobResponse['job'] }) {
  return (
    <>
      <p className="mt-2 text-sm text-ink/80">
        {job.status === 'running' ? job.progress.step : job.status} · {job.progress.completed}/{job.progress.total}
        {job.language ? ` · ${job.language}` : ''}
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {(job.agents ?? []).map(agent => (
          <li key={agent.id}>
            <span className="font-medium text-pine">{agent.role}</span>
            <span className="text-muted"> · {agent.status === 'ran' ? 'contributed' : agent.status === 'unavailable' ? 'source unavailable' : 'did not run'}</span>
          </li>
        ))}
      </ul>
      {job.subquestions.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-ink/75">
          {job.subquestions.map(sub => (
            <li key={sub.id}>{sub.text}{sub.queries.length ? ` · ${sub.queries.join(' · ')}` : ''}</li>
          ))}
        </ul>
      )}
    </>
  );
}

export function openResearchLanguage(value: string | null): Lang | null {
  if (value === 'en' || value === 'ta' || value === 'si') return toLang(value);
  return null;
}

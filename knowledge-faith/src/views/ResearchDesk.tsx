import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ResearchJobResponse, ResearchScope } from '../shared/contracts/v1.ts';
import { buildReportModel, renderReportHtml } from '../shared/research/report.ts';
import { ContentText } from '../components/ContentText.tsx';
import { materialPartLabel } from '../shared/research/materialCoverage.ts';
import { researchOutcome } from '../shared/research/outcomes.ts';
import { toLang, type Lang } from '../shared/sources.ts';
import { useRemote } from '../lib/api.ts';
import { beginResearch, noticeText, readResearchHistory, rememberResearch, researchDeskHref, researchHref, type StoredResearch } from '../lib/researchDesk.ts';
import type { ResearchDeskName } from '../lib/route.ts';
import { ResearchActionRow, ResearchFrame } from '../engine/ResearchFrame.tsx';
import { DomainResearchForm } from './DomainResearchForm.tsx';
import { questionsToResearch, separateQuestions } from '../shared/research/questions.ts';
import { useApp } from '../lib/store.tsx';
import { Button, ErrorNote, Loading, Notice } from '../components/ui.tsx';
import { FullReport } from './FullReport.tsx';

const DossierWorkbench = lazy(() => import('../engine/DossierWorkbench.tsx'));

const DESK_FRAME: Record<Exclude<ResearchDeskName, 'hadith'>, { title: string; arabic: string; subtitle: string }> = {
  quran: {
    title: 'Explore a verse, understand its reading',
    arabic: 'القرآن',
    subtitle: 'Ask in your own words. A photo, a file, or the microphone can fill the box.',
  },
  knowledge: {
    title: 'Explore a question, understand its sources',
    arabic: 'طلب العلم فريضة',
    subtitle: 'Ask in your own words. A photo, a file, or the microphone can fill the box.',
  },
  books: {
    title: 'Explore a book, understand its sources',
    arabic: 'الكتاب',
    subtitle: 'Ask in your own words. A photo, a file, or the microphone can fill the box.',
  },
  fiqh: {
    title: 'Explore a practice, understand its sources',
    arabic: 'الفقه',
    subtitle: 'Ask in your own words. The sources are read, and the answer stays with those sources.',
  },
  seerah: {
    title: 'Explore an event in the life of the Prophet',
    arabic: 'السيرة',
    subtitle: 'Ask in your own words. A photo, a file, or the microphone can fill the box.',
  },
};

export function ResearchDesk({ entry, desk = entry, params }: { entry: ResearchScope; desk?: ResearchDeskName; params: URLSearchParams }) {
  const { t, lang, setLang } = useApp();
  const paramLang = params.get('lang');
  const bookParam = params.get('book') ?? '';
  const bookId = Number(bookParam);
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

  function bookForRequest(): number | null {
    return selectedBook;
  }

  function hrefFor(scope: ResearchScope, id: string, forwarded: boolean, asked: string) {
    const bookId = bookForRequest();
    if ((desk === 'fiqh' || desk === 'seerah') && !forwarded) return researchDeskHref(desk, entry, id, lang, false, null, asked);
    return researchHref(scope, id, lang, forwarded, bookId, asked);
  }

  async function researchOne(asked: string, extra?: { clarified?: boolean; prior?: string | null; force?: boolean }) {
    return beginResearch({
      question: asked,
      entry,
      desk,
      lang,
      bookId: desk === 'books' ? bookForRequest() : selectedBook,
      forwarded: params.get('fwd') === '1',
      clarified: extra?.clarified ?? clarified,
      priorQuestion: extra?.clarified ? extra.prior ?? null : null,
      force: extra?.force,
    });
  }

  async function submit(event?: FormEvent, extra?: { clarified?: boolean; prior?: string | null; force?: boolean; asked?: string }) {
    event?.preventDefault();
    const clarifying = extra?.clarified === true;
    const field = extra?.asked ?? question;
    const pieces = questionsToResearch(field, clarifying ? null : remote.data?.job.question ?? null, clarifying);
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
      const href = hrefFor(first.scope, first.id, first.forwarded, first.question);
      if (window.location.hash !== href) {
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
      const href = hrefFor(started.scope, started.id, started.action === 'forward', piece);
      if (window.location.hash !== href) {
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
  const frame = desk === 'hadith' ? null : DESK_FRAME[desk];

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
      {desk === 'hadith' ? (
        <Suspense fallback={<Loading />}>
          <DossierWorkbench />
        </Suspense>
      ) : frame && (
        <ResearchFrame
          title={frame.title}
          arabic={frame.arabic}
          subtitle={frame.subtitle}
          actions={
            <ResearchActionRow
              onFullReport={() => document.getElementById('research-full-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              onRoundtable={() => {
                if (job && offersPodcast) window.location.hash = `#/podcast?job=${job.id}&lang=${lang}`;
              }}
            />
          }
        >
          <DomainResearchForm
            desk={desk}
            question={question}
            running={running}
            clarify={clarify}
            clarifyText={t.clarifyMeaning}
            onQuestion={setQuestion}
            onSubmit={(event, asked) => {
              if (clarify) {
                setClarified(true);
                void submit(event, { clarified: true, prior: question, asked });
                return;
              }
              void submit(event, { asked });
            }}
            onStarter={asked => {
              setQuestion(asked);
              setClarify(false);
              void submit(undefined, { asked });
            }}
          />
        </ResearchFrame>
      )}
      {desk !== 'hadith' && (
        <div className="space-y-4">
          {otherQuestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm leading-relaxed text-ink/75">This record joined more than one question. Each question keeps its own research.</p>
              {otherQuestions.map(item => (
                <Button key={item} type="button" variant="soft" onClick={() => void researchSeparate(item)}>
                  {item}
                </Button>
              ))}
            </div>
          )}
          {chapters.length > 1 && (
            <ul className="space-y-2">
              {chapters.map((chapter, index) => (
                <li key={chapter.id}>
                  <a href={hrefFor(chapter.scope, chapter.id, chapter.forwarded === true, chapter.question)} className="text-sm font-medium text-pine hover:underline">
                    Chapter {index + 1}. {chapter.question}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {notice && <Notice>{notice}</Notice>}
          {error && <ErrorNote message={error} />}
        </div>
      )}

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
              <Button type="button" variant="soft" onClick={() => void submit(undefined, { force: true, asked: job?.question ?? question })}>
                {t.retry}
              </Button>
            </span>
          )}
        </Notice>
      )}

      {liveModel && finished && (
        <div id="research-full-report" className="space-y-4">
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
            {liveModel.answer ? <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed"><ContentText text={liveModel.answer} /></p> : <p className="mt-3 text-sm text-muted">No answer was written from the retrieved passages.</p>}
            {job?.materialParts?.some(part => part.status === 'unresolved') && (
              <ul className="mt-3 space-y-1 text-sm text-ink/80" data-material-coverage>
                {job.materialParts.filter(part => part.status === 'unresolved').map(part => (
                  <li key={part.id}><span className="font-semibold text-pine">{materialPartLabel(part.kind)}. </span><ContentText text={part.note} /></li>
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
            <Button type="button" onClick={download}>Download Full Report</Button>
            {job && offersPodcast && (
              <a href={`#/podcast?job=${job.id}&lang=${lang}`} className="inline-flex items-center rounded-full border border-pine/20 px-4 py-2 text-sm font-medium text-pine">
                Make a roundtable episode
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

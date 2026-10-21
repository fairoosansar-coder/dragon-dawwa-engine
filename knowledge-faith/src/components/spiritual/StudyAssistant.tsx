import { useState, type FormEvent } from 'react';
import { MessageCircleQuestion, Sparkles } from 'lucide-react';
import type { StudyAnswer } from '../../shared/spiritual/assistantTypes.ts';
import type { TopicId } from '../../shared/spiritual/catalog.ts';
import { postJson, useRemote } from '../../lib/api.ts';
import { spHref } from '../../lib/spiritualFormat.ts';
import { setQuestionPrefill, useSp } from '../../lib/spiritualStore.ts';
import { Callout, Panel, PanelTitle, SpButton, inputClass } from './ornaments.tsx';

export function useSpiritualStatus() {
  return useRemote<{ ai: boolean; editorial: boolean }>('/api/spiritual/status');
}

export function StudyAssistant({ topic, guide }: { topic: TopicId; guide?: string }) {
  const { s, lang } = useSp();
  const status = useSpiritualStatus();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<StudyAnswer | null>(null);

  async function ask(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      setAnswer(await postJson<StudyAnswer>('/api/spiritual/study', { question: q, lang, topic, guide }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const evidenceIndex = new Map(answer?.evidence.map((ev, i) => [ev.id, i + 1]) ?? []);

  return (
    <Panel className="sp-no-print">
      <PanelTitle sub={s.studyHint}>
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gilt-deep" aria-hidden /> {s.studyTitle}
        </span>
      </PanelTitle>
      {status.data && !status.data.ai ? (
        <Callout tone="info">{s.studyOff}</Callout>
      ) : (
        <>
          <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`sp-study-${guide ?? topic}`} className="sr-only">
              {s.studyPlaceholder}
            </label>
            <input
              id={`sp-study-${guide ?? topic}`}
              className={inputClass}
              value={question}
              maxLength={600}
              placeholder={s.studyPlaceholder}
              onChange={e => setQuestion(e.target.value)}
            />
            <SpButton type="submit" disabled={busy || !question.trim()}>
              {busy ? s.studyBusy : s.studyAsk}
            </SpButton>
          </form>
          <p className="mt-2 text-xs text-ink/55">{s.studyDisclosure}</p>
          {error && (
            <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </p>
          )}
          {answer && (
            <div className="mt-4 space-y-3" aria-live="polite">
              <p className="text-xs font-semibold uppercase tracking-wider text-lapis">{s.aiNote}</p>
              {answer.insufficientEvidence && <Callout tone="caution">{s.studyInsufficient}</Callout>}
              {answer.paragraphs.map((p, i) => (
                <p key={i} lang={answer.lang} className="leading-relaxed">
                  {p.text}{' '}
                  {p.citations.map(c => (
                    <sup key={c} className="ml-0.5 rounded bg-emerald/10 px-1 text-[10px] font-semibold text-emerald">
                      {evidenceIndex.get(c) ?? '?'}
                    </sup>
                  ))}
                </p>
              ))}
              {answer.differencesNoted && <Callout tone="caution">{s.studyDifferences}</Callout>}
              {answer.clarifyingQuestions.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-emerald">{s.studyClarify}</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-ink/80">
                    {answer.clarifyingQuestions.map(q => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {answer.evidence.length > 0 && (
                <details className="rounded-2xl bg-ivory p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-emerald">
                    {s.evidence} ({answer.evidence.length})
                  </summary>
                  <ol className="mt-2 space-y-2 text-sm">
                    {answer.evidence.map((ev, i) => (
                      <li key={ev.id}>
                        <span className="font-semibold text-emerald">
                          {i + 1}. {ev.label}
                        </span>
                        <span className="block text-ink/80">{ev.text}</span>
                        <span className="block text-xs text-ink/55">{ev.attribution}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              {answer.scholarQuestionDraft && (
                <div className="rounded-2xl border border-emerald/10 p-3">
                  <p className="text-sm font-semibold text-emerald">{s.studyDraft}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">{answer.scholarQuestionDraft}</p>
                  <SpButton
                    variant="soft"
                    className="mt-2"
                    onClick={() => {
                      setQuestionPrefill({ topic, question: answer.scholarQuestionDraft, context: '' });
                      window.location.hash = spHref('questions');
                    }}
                  >
                    <MessageCircleQuestion className="h-4 w-4" aria-hidden /> {s.studyUseDraft}
                  </SpButton>
                </div>
              )}
              <p className="text-[11px] text-ink/45">{answer.model}</p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

import { useState } from 'react';
import { CheckCircle2, HelpCircle, MessageSquarePlus, Send, ShieldCheck } from 'lucide-react';
import {
  answerScholarQuestion,
  listScholarQuestions,
  submitScholarQuestion,
  type ScholarQuestionItem,
} from '../../lib/verseShare.ts';
import { LANGUAGE_NAMES, type Lang } from '../../shared/sources.ts';

export function AdminQAInbox() {
  const [questions, setQuestions] = useState<ScholarQuestionItem[]>(() => listScholarQuestions());
  const [activeId, setActiveId] = useState<string | null>(
    () => listScholarQuestions().find(q => q.status === 'open')?.id ?? null,
  );
  const [answerDraft, setAnswerDraft] = useState('');
  const [citationsDraft, setCitationsDraft] = useState('Qur’an 4:101, Sahih Muslim 686');
  const [newQuestionDraft, setNewQuestionDraft] = useState('');
  const [newQuestionLang, setNewQuestionLang] = useState<Lang>('en');
  const [toast, setToast] = useState<string | null>(null);

  const openQuestions = questions.filter(q => q.status === 'open');
  const answeredQuestions = questions.filter(q => q.status === 'answered');

  const handlePublishAnswer = async (id: string) => {
    if (!answerDraft.trim()) return;
    const citations = citationsDraft
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);
    const next = await answerScholarQuestion({
      id,
      answer: answerDraft,
      citations,
    });
    setQuestions(next);
    setAnswerDraft('');
    setActiveId(next.find(q => q.status === 'open')?.id ?? null);
    setToast('Published verified scholarly response! Now visible in the Seeker Q&A Knowledge Archive.');
  };

  const handleFlagNewQuestion = async () => {
    if (!newQuestionDraft.trim()) return;
    await submitScholarQuestion({
      question: newQuestionDraft,
      language: newQuestionLang,
    });
    const next = listScholarQuestions();
    setQuestions(next);
    setNewQuestionDraft('');
    setToast('Added seeker question to the Scholar Q&A Inbox.');
  };

  return (
    <div data-admin-qa-inbox className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-stone-900 sm:text-base">
              Scholar Q&A Inbox ({openQuestions.length} Open · {answeredQuestions.length} Answered)
            </h3>
            <p className="text-xs text-stone-600">
              Review seeker queries flagged for human scholarly verification and publish cited answers.
            </p>
          </div>
        </div>

        {/* Quick Seeker Inquiry Flag Input */}
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 sm:flex-row sm:items-center">
          <select
            value={newQuestionLang}
            onChange={event => setNewQuestionLang(event.target.value as Lang)}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800"
          >
            <option value="en">English</option>
            <option value="ta">Tamil</option>
            <option value="si">Sinhala</option>
          </select>
          <input
            type="text"
            data-qa-new-question-input
            value={newQuestionDraft}
            onChange={event => setNewQuestionDraft(event.target.value)}
            placeholder="Log a seeker question for scholarly review…"
            className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
          />
          <button
            type="button"
            data-qa-new-question-submit
            onClick={() => void handleFlagNewQuestion()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#073C30] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0A2E23]"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span>Add to Inbox</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          data-admin-qa-toast
          className="rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-950"
        >
          ✦ {toast}
        </div>
      )}

      {/* Open Inquiries */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Open Seeker Inquiries Awaiting Scholarly Answer ({openQuestions.length})
        </h4>
        {openQuestions.map(item => {
          const expanded = activeId === item.id;
          return (
            <article
              key={item.id}
              data-qa-open-item={item.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                    <HelpCircle className="h-3 w-3" aria-hidden />
                    <span>Open Inquiry</span>
                  </span>
                  <span className="text-xs font-semibold text-stone-900">{item.userName}</span>
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                    {LANGUAGE_NAMES[item.language]?.english ?? 'English'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveId(expanded ? null : item.id)}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  {expanded ? 'Hide Editor' : 'Draft Verified Response →'}
                </button>
              </div>

              <p lang={item.language} className="mt-2.5 font-sans text-sm font-medium leading-relaxed text-stone-900">
                “{item.question}”
              </p>

              {expanded && (
                <div className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                  <label className="block text-xs font-semibold text-stone-700">
                    Verified Scholarly Response
                    <textarea
                      rows={3}
                      data-qa-answer-input={item.id}
                      value={answerDraft}
                      onChange={event => setAnswerDraft(event.target.value)}
                      placeholder="Write a clear, source-grounded response citing Qur’an and authentic Sunnah…"
                      className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white p-3 text-xs leading-relaxed text-stone-900 focus:border-[#073C30] focus:outline-none"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-stone-700">
                    Primary Citations (comma-separated)
                    <input
                      type="text"
                      value={citationsDraft}
                      onChange={event => setCitationsDraft(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                    />
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      data-qa-publish-answer={item.id}
                      onClick={() => void handlePublishAnswer(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0A2E23]"
                    >
                      <Send className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                      <span>Publish Verified Answer</span>
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Answered Archive */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Answered Scholarly Archive ({answeredQuestions.length})
        </h4>
        {answeredQuestions.map(item => (
          <article
            key={item.id}
            data-qa-answered-item={item.id}
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
                <CheckCircle2 className="h-3 w-3 text-emerald-700" aria-hidden />
                <span>Answered</span>
              </span>
              <span className="font-semibold text-stone-900">{item.userName}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-stone-800">Q: {item.question}</p>
            <div className="mt-2 rounded-xl border border-emerald-800/15 bg-emerald-50/50 p-3 text-xs leading-relaxed text-stone-800">
              <p>{item.answer}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-900">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  <span>{item.answeredBy}</span>
                </span>
                {item.citations?.length ? (
                  <span>Citations: {item.citations.join(' · ')}</span>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

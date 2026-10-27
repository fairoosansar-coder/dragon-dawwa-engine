import type { FormEvent } from 'react';
import type { ResearchDeskName } from '../lib/route.ts';
import { Button } from '../components/ui.tsx';
import { readerQuestion } from './domainQuestion.ts';
import { ResearchCapture } from './ResearchCapture.tsx';
import { RESEARCH_STARTERS } from './researchStarters.ts';

const QUESTION_LABEL = 'What is your question, or what passage are you looking at?';

export function DomainResearchForm({
  desk,
  question,
  running,
  clarify,
  clarifyText,
  onQuestion,
  onSubmit,
  onStarter,
}: {
  desk: Exclude<ResearchDeskName, 'hadith'>;
  question: string;
  running: boolean;
  clarify: boolean;
  clarifyText: string;
  onQuestion: (value: string) => void;
  onSubmit: (event: FormEvent, asked: string) => void;
  onStarter?: (question: string) => void;
}) {
  const asked = readerQuestion(question);
  const starters = RESEARCH_STARTERS[desk] ?? [];

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (asked.length < 3) return;
        onSubmit(event, asked);
      }}
      className="space-y-4"
    >
      {starters.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-[var(--surface-raised)] p-4 shadow-lg" data-research-starters={desk}>
          <span className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
            <span className="inline-block animate-pulse" aria-hidden>⚡</span>
            Starter questions
          </span>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {starters.map(starter => (
              <button
                key={starter.id}
                type="button"
                data-testid={`research-starter-${starter.id}`}
                disabled={running}
                onClick={() => onStarter?.(starter.question)}
                className="cursor-pointer rounded-xl border border-slate-800 bg-[var(--surface-raised)] p-3.5 text-left transition-all hover:border-slate-700 hover:bg-[var(--surface-hover)] disabled:cursor-wait"
              >
                <h4 className="text-xs font-bold text-slate-200">{starter.title}</h4>
                <p className="mt-1 truncate text-[11px] text-slate-400">{starter.detail}</p>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-[var(--text-body)]" htmlFor="research-question">
          {QUESTION_LABEL}
        </label>
        <ResearchCapture value={question} onChange={onQuestion} disabled={running} />
      </div>
      {clarify && <p className="text-sm font-medium text-[var(--text-body)]">{clarifyText}</p>}
      {desk === 'fiqh' && (
        <p className="text-sm leading-relaxed text-[var(--text-body)]/80">This asks the sources about a practice. It does not issue a ruling.</p>
      )}
      <Button type="submit" disabled={running || asked.length < 3} className="w-full py-3 sm:w-auto">
        Research
      </Button>
    </form>
  );
}

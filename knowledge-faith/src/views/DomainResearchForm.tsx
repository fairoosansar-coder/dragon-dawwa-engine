import type { FormEvent } from 'react';
import type { ResearchDeskName } from '../lib/route.ts';
import { Button } from '../components/ui.tsx';
import { readerQuestion } from './domainQuestion.ts';
import { ResearchCapture } from './ResearchCapture.tsx';

const QUESTION_LABEL = 'What is your question, or what passage are you looking at?';

export function DomainResearchForm({
  desk,
  question,
  running,
  clarify,
  clarifyText,
  onQuestion,
  onSubmit,
}: {
  desk: Exclude<ResearchDeskName, 'hadith'>;
  question: string;
  running: boolean;
  clarify: boolean;
  clarifyText: string;
  onQuestion: (value: string) => void;
  onSubmit: (event: FormEvent, asked: string) => void;
}) {
  const asked = readerQuestion(question);

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (asked.length < 3) return;
        onSubmit(event, asked);
      }}
      className="space-y-4"
    >
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

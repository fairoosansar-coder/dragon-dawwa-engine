import type { CoverageKind } from '../contracts/v1.ts';

export interface OutcomeNote {
  kind: CoverageKind | string;
  detail: string;
}

export interface ResearchOutcome {
  title: string;
  detail: string;
  retry: boolean;
}

function kept(question: string): string {
  const text = question.trim();
  return text ? ` Your question is still here: “${text}”.` : '';
}

/**
 * Product copy for a finished research job.
 * These four results stay separate. None of them is labeled “no relevant evidence”.
 */
export function researchOutcome(input: {
  question: string;
  queryCount: number;
  passageCount: number;
  coverage: readonly OutcomeNote[];
}): ResearchOutcome | null {
  const question = kept(input.question);
  const unreachable = input.coverage.some(note => note.kind === 'source_unavailable' || note.kind === 'language_unavailable');
  const incomplete = input.coverage.some(note => note.kind === 'budget_exhausted');
  const unprocessed =
    input.queryCount === 0 || input.coverage.some(note => note.detail.startsWith('We could not process the question'));

  if (input.passageCount > 0) {
    if (unreachable) {
      return {
        title: 'A source could not be reached.',
        detail: `Some sources did not respond. The passages below are only what could be opened.${question} You can retry.`,
        retry: true,
      };
    }
    if (incomplete) {
      return {
        title: 'Research is incomplete.',
        detail: `Not every planned page was opened. The passages below are only what was retrieved.${question} You can retry.`,
        retry: true,
      };
    }
    return null;
  }
  const lookedAndMissed = input.coverage.some(
    note => note.kind === 'no_relevant_evidence' || /was opened/i.test(note.detail),
  );
  if (unprocessed) {
    return {
      title: 'We could not process the question.',
      detail: `No searchable words remained after the question was read.${question} Try again, or use a shorter wording.`,
      retry: true,
    };
  }
  if (unreachable) {
    return {
      title: 'A source could not be reached.',
      detail: `This is not a finding that the subject is absent.${question} You can retry.`,
      retry: true,
    };
  }
  if (lookedAndMissed) {
    return {
      title: 'The retrieved sources do not establish this claim.',
      detail: `The sources that responded were read. They do not establish the claim.${question} You can retry, or ask with different words.`,
      retry: true,
    };
  }
  if (incomplete) {
    return {
      title: 'Research is incomplete.',
      detail: `The search stopped before the libraries were read.${question} You can retry.`,
      retry: true,
    };
  }
  return {
    title: 'Available evidence does not sufficiently support an answer.',
    detail: `The sources that responded did not contain enough support.${question} You can retry, or ask with different words.`,
    retry: true,
  };
}

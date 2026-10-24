import type { AgentContribution } from '../contracts/v1.ts';
import type { Lang } from '../sources.ts';

export interface RoundtableLine {
  speaker: string;
  role: string;
  text: string;
}

export interface RoundtableScript {
  title: string;
  language: Lang;
  question: string;
  lines: RoundtableLine[];
  participants: { id: string; role: string; team: string }[];
}

const HOST = 'Research coordinator';

/** A roundtable uses only agents that actually ran. It quotes their recorded contribution. */
export function roundtableFromResearch(input: {
  question: string;
  language: Lang;
  agents: readonly AgentContribution[];
}): RoundtableScript | null {
  const contributors = input.agents.filter(agent => agent.status === 'ran' && agent.detail.trim());
  if (!contributors.length) return null;
  const participants = contributors.map(agent => ({ id: agent.id, role: agent.role, team: agent.team }));
  const lines: RoundtableLine[] = [
    {
      speaker: HOST,
      role: 'Coordinates the research teams',
      text: `The question is: ${input.question.trim()} The language is ${input.language}. The people at the table are ${participants.map(agent => agent.role).join(', ')}.`,
    },
    ...contributors.map(agent => ({
      speaker: agent.role,
      role: agent.role,
      text: agent.detail.trim(),
    })),
  ];
  return {
    title: input.question.trim().slice(0, 140),
    language: input.language,
    question: input.question.trim(),
    lines,
    participants,
  };
}

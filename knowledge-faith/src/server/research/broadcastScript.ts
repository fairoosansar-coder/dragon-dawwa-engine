/**
 * Domain-agnostic broadcast script.
 * The writer sees agent JSON that already ran. It does not choose a domain,
 * a source, or a role. Speaker labels stay the podcast player’s labels.
 * The host line is a generated presenter, not a research agent.
 */

import { userFacingResearchQuestion } from '../../shared/modernWorldBenchmarks.ts';
import { sanitizePodcastHostName } from '../../shared/podcastHost.ts';
import type { Lang } from '../../shared/sources.ts';
import { speakableTurn, studioCopy,listenerProbe } from '../../shared/research/studioDialogue.ts';

export interface BroadcastAgent {
  id: string;
  role: string;
  persona: string;
  /** Player label, including the colon, such as "DR. TARIQ:". */
  speaker: string;
  status: 'ran' | 'not_run';
  finding: string;
}

export interface BroadcastScriptInput {
  question: string;
  language: Lang;
  agents: readonly BroadcastAgent[];
  /** Spoken studio partner. Empty becomes "Seeker". */
  hostName?: string | null;
}

const LEGACY_HOST_SPEAKER = 'BROTHER FEROZ (HOST):';

function hostLabel(hostName: string): string {
  return `${hostName} (HOST):`;
}

function isHostSpeaker(speaker: string, label: string): boolean {
  return speaker === label || speaker === LEGACY_HOST_SPEAKER || /^host\b/i.test(speaker);
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function everydayQuestion(question: string): string {
  let text = clean(question).replace(/^[“”"'‘’]+|[“”"'‘’]+$/g, '');
  if (!/[?؟.]$/.test(text)) text = `${text}?`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The saved host name is a player label. The first spoken line is the question. */
export function generatedHostLine(question: string, language: Lang, hostName?: string | null): string {
  const asked = everydayQuestion(userFacingResearchQuestion(question));
  return speakableTurn(asked,language)?asked:studioCopy[language].hook;
}

/** Agents that ran, in the order they were aggregated. The host disclosure is separate. */
export function agentsThatRan(agents: readonly BroadcastAgent[]): BroadcastAgent[] {
  return agents.filter(agent => agent.status === 'ran' && clean(agent.finding).length > 0);
}

export function writeBroadcastScript(input: BroadcastScriptInput): string {
  const hostName = sanitizePodcastHostName(input.hostName);
  const label = hostLabel(hostName);
  const lines = [
    '[AUDIO CUE: INTRO UP - POLISHED RADIO BEAT (4 SECONDS) THEN FADE UNDER]',
    `${label} ${generatedHostLine(input.question, input.language, hostName)}`,
  ];
  let previousFinding: string | undefined;
  for (const agent of agentsThatRan(input.agents)) {
    if (isHostSpeaker(agent.speaker, label)) {
      lines.push(`${label} ${speakableTurn(agent.finding,input.language)?clean(agent.finding):studioCopy[input.language].end}`);
      continue;
    }
    if(previousFinding && lines.length===3)lines.push(`${label} ${listenerProbe(input.language,previousFinding,'source')}`);
    lines.push(`${agent.speaker} ${speakableTurn(agent.finding,input.language)?clean(agent.finding):studioCopy[input.language].limit}`);
    previousFinding = agent.finding;
  }
  lines.push('[AUDIO CUE: OUTRO THEME RISES AND FADES OUT]');
  return lines.join('\n\n');
}

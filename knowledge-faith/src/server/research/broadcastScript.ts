/**
 * Domain-agnostic broadcast script.
 * The writer sees agent JSON that already ran. It does not choose a domain,
 * a source, or a role. Speaker labels stay the podcast player’s labels.
 * The host line is a generated presenter, not a research agent.
 */

import { sanitizePodcastHostName } from '../../shared/podcastHost.ts';
import type { Lang } from '../../shared/sources.ts';

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

/** Generated-host disclosure. The same sentence is used for every category. */
export function generatedHostLine(question: string, language: Lang, hostName?: string | null): string {
  const host = sanitizePodcastHostName(hostName);
  const asked = everydayQuestion(question);
  if (language === 'ta') {
    return `${host}, வரவேற்கிறோம். கேள்வி இது: ${asked} இது உருவாக்கப்பட்ட நிகழ்வு. நான் உருவாக்கப்பட்ட தொகுப்பாளர். ${host} இந்தச் சொற்களைப் பேசவில்லை, இவற்றை அங்கீகரிக்கவும் இல்லை. நாங்கள் அறிஞர்கள் அல்ல.`;
  }
  if (language === 'si') {
    return `${host}, සාදරයෙන් පිළිගනිමු. ප්‍රශ්නය මෙයයි: ${asked} මෙය නිර්මාණය කළ වැඩසටහනකි. මම නිර්මාණය කළ ඉදිරිපත් කරන්නෙක්. ${host} මේ වචන කථා කළේ නැත, ඒවා අනුමත කළේත් නැත. අපි විද්වතුන් නොවෙමු.`;
  }
  return `Welcome, ${host}. Your question is: ${asked} This is a generated episode. I am a generated host. ${host} did not speak these words and did not approve them. We are not scholars.`;
}

function contributorLine(agent: BroadcastAgent, language: Lang, hostName: string): string {
  const finding = clean(agent.finding);
  if (language === 'ta') {
    return `${hostName}, நான் ${agent.persona}. நான் உருவாக்கப்பட்ட பங்களிப்பாளர். என் பொறுப்பு ${agent.role}. திறந்த மூலம் சொல்வது இது: ${finding}`;
  }
  if (language === 'si') {
    return `${hostName}, මම ${agent.persona}. මම නිර්මාණය කළ දායකයෙක්. මගේ කාර්යය ${agent.role}. විවෘත මූලාශ්‍රය කියන්නේ මෙයයි: ${finding}`;
  }
  return `${hostName}, I am ${agent.persona}, a generated contributor. My role is ${agent.role}. The opened source says: ${finding}`;
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
  for (const agent of agentsThatRan(input.agents)) {
    if (isHostSpeaker(agent.speaker, label)) {
      lines.push(`${label} ${hostName}, ${clean(agent.finding)}`);
      continue;
    }
    lines.push(`${agent.speaker} ${contributorLine(agent, input.language, hostName)}`);
  }
  lines.push('[AUDIO CUE: OUTRO THEME RISES AND FADES OUT]');
  return lines.join('\n\n');
}

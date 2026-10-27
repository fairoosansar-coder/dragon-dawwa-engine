/**
 * Domain-agnostic broadcast script.
 * The writer sees agent JSON that already ran. It does not choose a domain,
 * a source, or a role. Speaker labels stay the podcast player’s labels.
 * The host line is a generated presenter, not a research agent.
 */

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
}

const HOST = 'BROTHER FEROZ (HOST):';

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function everydayQuestion(question: string): string {
  let text = clean(question).replace(/^[“”"'‘’]+|[“”"'‘’]+$/g, '');
  if (!/[?؟.]$/.test(text)) text = `${text}?`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Generated-host disclosure. The same sentence is used for every category. */
export function generatedHostLine(question: string, language: Lang): string {
  const asked = everydayQuestion(question);
  if (language === 'ta') {
    return `கேள்வி இது: ${asked} நான் உருவாக்கப்பட்ட தொகுப்பாளர். என்னுடன் பேசுபவர்களும் உருவாக்கப்பட்டவர்கள். பிரதர் ஃபெரோஸ் இந்தச் சொற்களைப் பேசவில்லை, இவற்றை அங்கீகரிக்கவும் இல்லை. நாங்கள் அறிஞர்கள் அல்ல.`;
  }
  if (language === 'si') {
    return `ප්‍රශ්නය මෙයයි: ${asked} මම නිර්මාණය කළ ඉදිරිපත් කරන්නෙක්. අනෙක් අයත් නිර්මාණය කළ අයයි. බ්‍රදර් ෆෙරෝස් මේ වචන කථා කළේ නැත, ඒවා අනුමත කළේත් නැත. අපි විද්වතුන් නොවෙමු.`;
  }
  return `Welcome to Dragon Dawwa Live. The question is: ${asked} I am a generated host. The contributors with me are generated too. Brother Feroz did not speak these words and did not approve them. We are not scholars.`;
}

function contributorLine(agent: BroadcastAgent, language: Lang): string {
  const finding = clean(agent.finding);
  if (language === 'ta') {
    return `நான் ${agent.persona}. நான் உருவாக்கப்பட்ட பங்களிப்பாளர். என் பொறுப்பு ${agent.role}. திறந்த மூலம் சொல்வது இது: ${finding}`;
  }
  if (language === 'si') {
    return `මම ${agent.persona}. මම නිර්මාණය කළ දායකයෙක්. මගේ කාර්යය ${agent.role}. විවෘත මූලාශ්‍රය කියන්නේ මෙයයි: ${finding}`;
  }
  return `I am ${agent.persona}, a generated contributor. My role is ${agent.role}. The opened source says: ${finding}`;
}

/** Agents that ran, in the order they were aggregated. The host disclosure is separate. */
export function agentsThatRan(agents: readonly BroadcastAgent[]): BroadcastAgent[] {
  return agents.filter(agent => agent.status === 'ran' && clean(agent.finding).length > 0);
}

export function writeBroadcastScript(input: BroadcastScriptInput): string {
  const lines = [
    '[AUDIO CUE: INTRO UP - POLISHED RADIO BEAT (4 SECONDS) THEN FADE UNDER]',
    `${HOST} ${generatedHostLine(input.question, input.language)}`,
  ];
  for (const agent of agentsThatRan(input.agents)) {
    if (agent.speaker === HOST) {
      lines.push(`${HOST} ${clean(agent.finding)}`);
      continue;
    }
    lines.push(`${agent.speaker} ${contributorLine(agent, input.language)}`);
  }
  lines.push('[AUDIO CUE: OUTRO THEME RISES AND FADES OUT]');
  return lines.join('\n\n');
}

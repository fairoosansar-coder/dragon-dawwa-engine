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

/** A short lesson for the ear. Locators and long quotations stay out of the spoken line. */
function spokenFinding(text: string): string {
  const stripped = clean(text)
    .replace(/\bSurah\s+\d+\s*,\s*ayah\s+\d+\s*:\s*/gi, '')
    .replace(/[“"][^”"]{120,}[”"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = stripped.split(/(?<=[.!?؟])\s+/).map(part => part.trim()).find(part => part.length >= 12) ?? stripped;
  return sentence.length > 160 ? `${sentence.slice(0, 157).trim()}…` : sentence;
}

/** One language for the conversation. A foreign sentence is introduced as a translation. */
function inConversation(language: Lang, lesson: string): string {
  const latin = /[A-Za-z]/.test(lesson);
  const tamil = /[\u0B80-\u0BFF]/.test(lesson);
  const sinhala = /[\u0D80-\u0DFF]/.test(lesson);
  if (language === 'ta' && latin && !tamil) return `ஆங்கில மூலத்தின் பொருளைத் தமிழுடன் வைக்கிறேன்: ${lesson}`;
  if (language === 'si' && latin && !sinhala) return `ඉංග්‍රීසි මූලයේ අර්ථය සිංහල සමඟ තබමු: ${lesson}`;
  if (language === 'en' && tamil && !latin) return `The Tamil wording, kept on purpose, is: ${lesson}`;
  if (language === 'en' && sinhala && !latin) return `The Sinhala wording, kept on purpose, is: ${lesson}`;
  return lesson;
}

/** Warm welcome. The page header carries the generated-presenter note, so the voice does not. */
export function generatedHostLine(question: string, language: Lang, hostName?: string | null): string {
  const host = sanitizePodcastHostName(hostName);
  const asked = everydayQuestion(question);
  if (language === 'ta') return `${host}, வரவேற்கிறோம். இன்று நாம் உங்கள் கேள்வியுடன் அமர்கிறோம்: ${asked}`;
  if (language === 'si') return `${host}, සාදරයෙන් පිළිගනිමු. අද අපි ඔබේ ප්‍රශ්නය සමඟ වාඩි වෙමු: ${asked}`;
  return `Welcome, ${host}. Today we sit with your question: ${asked}`;
}

function contributorLine(agent: BroadcastAgent, language: Lang, hostName: string): string {
  const lesson = inConversation(language, spokenFinding(agent.finding));
  if (language === 'ta') {
    return `${hostName}, ${agent.persona} இங்கே இருக்கிறேன். தோழரின் தருணத்தையும் நடைமுறைப் பாடத்தையும் சொல்கிறேன். ${lesson}`;
  }
  if (language === 'si') {
    return `${hostName}, මම ${agent.persona}. සගයාගේ මොහොත සහ ප්‍රායෝගික පාඩම කියමි. ${lesson}`;
  }
  return `${hostName}, this is ${agent.persona}. Let us sit with the person and the moment. The practical lesson is ${lesson}`;
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

import type { AgentContribution } from '../contracts/v1.ts';
import type { Lang } from '../sources.ts';
import { separateQuestions } from './questions.ts';

export interface RoundtableLine {
  speaker: string;
  role: string;
  text: string;
}

export interface RoundtablePassage {
  locator: string;
  text: string;
  context?: string | null;
  provider?: string;
}

export interface RoundtableScript {
  title: string;
  language: Lang;
  question: string;
  lines: RoundtableLine[];
  participants: { id: string; role: string; team: string }[];
  /** Full citations for the transcript and Sources panel. Never narrated. */
  sources: string[];
}

const HOST = 'Brother Feroz';
const PASSAGE = 'Dr. Layla al-Qasimi';
const DISTINCTION = 'Dr. Zainab al-Mubarak';
const DEEP = 'Dr. Amina al-Kindi';

const STATUS =
  /arabic was retrieved|translation retrieved|evidence review|insufficient:|the language is\b|the people at the table|source_unavailable|source unavailable|neighbouring ayah|al-mukhtasar was opened|was opened for the cited|did not run|contributed ·|no phrase|search returned no records|coverage note|language code/i;

const INVENTORY =
  /english wordings|arabic wordings|word-occurrence count is \d+|distinct occurrence|\bwar, wars, warfare\b|\bbattle, battles, fighting, combat\b/i;

const INVENTED_TOTAL = /\b124[,.]?000\b|\b25 prophets\b|\btwenty[- ]five prophets\b|\bsix times\b/i;

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function spokenPassage(text: string): string {
  return clean(text)
    .replace(/\[\d+\]/g, '')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function everydayQuestion(question: string): string {
  let text = clean(question).replace(/^[“”"'‘’]+|[“”"'‘’]+$/g, '');
  text = text.replace(/\bquran\b/gi, 'the Qur’an');
  text = text.replace(/\bwars mentions\b/gi, 'mentions of war');
  if (!/[?؟.]$/.test(text)) text = `${text}?`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function quranRef(locator: string): string | null {
  const match = locator.match(/Surah\s+(\d+)\s*,\s*ayah\s+(\d+)/i);
  return match ? `Qur’an ${match[1]}:${match[2]}` : null;
}

function sourceLines(answer: string, passages: readonly RoundtablePassage[]): string[] {
  const fromAnswer = answer
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^(?:Qur’an|Qur'an) \d+:\d+\b/.test(line) || /^.+ — (?:Qur’an|Qur'an) \d+:\d+/.test(line));
  const fromPassages = passages
    .filter(passage => passage.locator.trim() && !passage.context?.startsWith('Neighbouring'))
    .map(passage => [passage.locator.trim(), passage.provider?.trim()].filter(Boolean).join(' · '));
  return [...new Set([...fromAnswer, ...fromPassages])];
}

interface PreparedPassage {
  ref: string;
  text: string;
  campaign: string | null;
  unnamed: boolean;
  wording: boolean;
}

function prepareQuran(passages: readonly RoundtablePassage[]): PreparedPassage[] {
  const prepared: PreparedPassage[] = [];
  for (const passage of passages) {
    if (passage.context?.startsWith('Neighbouring')) continue;
    const ref = quranRef(passage.locator);
    const text = spokenPassage(passage.text);
    if (!ref || text.length < 12 || STATUS.test(text)) continue;
    const context = passage.context ?? '';
    const campaign = context.match(/Historical event:\s*([^.]+)/i)?.[1]?.trim() || null;
    prepared.push({
      ref,
      text,
      campaign,
      unnamed: /does not name the campaign/i.test(context),
      wording: /Word occurrence:/i.test(context),
    });
  }
  return prepared;
}

function line(speaker: string, text: string): RoundtableLine {
  return { speaker, role: speaker, text: clean(text) };
}

function corpusConversation(question: string, passages: readonly RoundtablePassage[]): RoundtableLine[] | null {
  const prepared = prepareQuran(passages);
  const campaigns: PreparedPassage[] = [];
  for (const passage of prepared) {
    if (!passage.campaign) continue;
    if (campaigns.some(item => item.ref === passage.ref)) continue;
    campaigns.push(passage);
  }
  const contrast =
    prepared.find(passage => passage.wording && !passage.campaign && !passage.unnamed) ??
    prepared.find(passage => passage.wording && !passage.campaign);
  if (campaigns.length < 1 || !contrast) return null;
  const told = campaigns
    .slice(0, 2)
    .map(passage => `At ${passage.ref}, the passage says: ${passage.text}`)
    .join(' ');
  return [
    line(
      HOST,
      `The question is: ${everydayQuestion(question)} I am a generated host. The two contributors with me are generated too. We are not scholars. We will talk about what the opened passages say.`,
    ),
    line(PASSAGE, `I'll start with the passages that name a campaign. ${told}`),
    line(
      DISTINCTION,
      'Those are named campaigns, because the passage itself names the event and says what happened. A wording hit is different. What does the passage we kept for that contrast actually say?',
    ),
    line(
      PASSAGE,
      `${contrast.ref} says: ${contrast.text} That passage does not tell the story of a named campaign.`,
    ),
    line(
      DISTINCTION,
      'Then I heard the passage, and I did not hear it name a campaign the way those other passages do. The wording can be present while the subject is something else. What is established is that the wording count and the named campaigns are separate. What is not established is one mixed total. These passages do not give one.',
    ),
    line(
      HOST,
      'You are reading the same passages and keeping two readings apart. A listener can hold what those passages say. What is not established is a single total that mixes a wording hit with a named campaign. This was only this question.',
    ),
  ];
}

function generalConversation(input: {
  question: string;
  answer: string;
  passages: readonly RoundtablePassage[];
  insufficientEvidence?: boolean;
  unresolved?: readonly string[];
}): RoundtableLine[] | null {
  const usable = input.passages
    .filter(passage => !passage.context?.startsWith('Neighbouring'))
    .map(passage => ({ label: quranRef(passage.locator) ?? passage.locator, text: spokenPassage(passage.text) }))
    .filter(passage => passage.text.length >= 12 && !STATUS.test(passage.text))
    .slice(0, 2);
  if (!usable.length) return null;
  const told = usable.map(passage => `${passage.label} says: ${passage.text}`).join(' ');
  const deniesTotal = input.insufficientEvidence || /do not state a total|does not state a total/i.test(input.answer);
  return [
    line(
      HOST,
      `The question is: ${everydayQuestion(input.question)} I am a generated host. The two contributors with me are generated too. We are not scholars.`,
    ),
    line(PASSAGE, told),
    line(
      DISTINCTION,
      deniesTotal
        ? 'Do these passages state a total, or do they only say what you just read?'
        : 'What should we refuse to add beyond what you just read?',
    ),
    line(
      PASSAGE,
      deniesTotal
        ? 'They do not state a total. This episode will not add one. What they establish is only what they say.'
        : 'What is established is what those passages say. What they do not say stays outside the conclusion.',
    ),
    line(HOST, 'That is the conclusion for this question, from this dossier alone.'),
    ...(input.unresolved ?? []).slice(0, 2).map(note => line(DEEP, `This part stays open. ${note}`)),
  ];
}

/** Retrieval logs, wording inventories, language codes, and invented totals must not be spoken. */
export function scriptMayBeSpoken(lines: readonly { text: string; speaker?: string }[], allowed: string): boolean {
  const spoken = lines.map(item => item.text).join(' ');
  if (!spoken.trim() || lines.length < 4) return false;
  const named = lines.filter(item => item.speaker);
  if (named.length) {
    const speakers = new Set(named.map(item => item.speaker));
    if (speakers.size < 3) return false;
    const contributorAsked = named.some(item => item.speaker && !/^host\b/i.test(item.speaker) && item.text.includes('?'));
    if (!contributorAsked) return false;
  }
  if (STATUS.test(spoken) || INVENTORY.test(spoken)) return false;
  if (INVENTED_TOTAL.test(spoken) && !INVENTED_TOTAL.test(allowed)) return false;
  return true;
}

/**
 * A spoken episode is a generated host and two generated contributors.
 * They talk about what the passages say. Citation lists and status logs stay out of the script.
 */
export function roundtableFromResearch(input: {
  question: string;
  language: Lang;
  agents?: readonly AgentContribution[];
  answer?: string | null;
  passages?: readonly RoundtablePassage[];
  insufficientEvidence?: boolean;
  unresolved?: readonly string[];
  status?: 'done' | 'running' | 'error' | 'cancelled' | 'queued';
  investigation?: 'complete' | 'partial' | 'blocked';
}): RoundtableScript | null {
  if (input.investigation === 'blocked') return null;
  if (input.status && input.status !== 'done') return null;
  const questions = separateQuestions(input.question);
  if (questions.length !== 1) return null;
  const question = questions[0];
  const passages = input.passages ?? [];
  const answer = input.answer?.trim() ?? '';
  if (!passages.length || !answer) return null;
  const corpus = /Word occurrence\./i.test(answer);
  const lines = corpus
    ? corpusConversation(question, passages)
    : generalConversation({ question, answer, passages, insufficientEvidence: input.insufficientEvidence, unresolved: input.unresolved });
  if (!lines || !scriptMayBeSpoken(lines, answer)) return null;
  return {
    title: question.slice(0, 140),
    language: input.language,
    question,
    lines,
    participants: [
      { id: 'feroz-generated', role: `${HOST} (generated host)`, team: 'roundtable' },
      { id: 'layla-generated', role: `${PASSAGE} (generated)`, team: 'quran' },
      { id: 'zainab-generated', role: `${DISTINCTION} (generated)`, team: 'hadith' },
      { id: 'amina-generated', role: `${DEEP} (generated)`, team: 'deep-research' },
    ],
    sources: sourceLines(answer, passages),
  };
}

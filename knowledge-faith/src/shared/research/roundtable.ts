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

const HOST = 'Host (generated)';
const RESEARCHER = 'Researcher (generated)';

const STATUS =
  /arabic was retrieved|translation retrieved|evidence review|insufficient:|the language is\b|the people at the table|source_unavailable|source unavailable|neighbouring ayah|al-mukhtasar was opened|was opened for the cited|did not run|contributed ·|no phrase|search returned no records|coverage note|language code/i;

const INVENTED_TOTAL = /\b124[,.]?000\b|\b25 prophets\b|\btwenty[- ]five prophets\b|\bsix times\b/i;

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function everydayQuestion(question: string): string {
  let text = clean(question).replace(/^[“”"'‘’]+|[“”"'‘’]+$/g, '');
  text = text.replace(/\bquran\b/gi, 'the Qur’an');
  text = text.replace(/\bwars mentions\b/gi, 'mentions of war');
  if (!/[?؟.]$/.test(text)) text = `${text}?`;
  return text.charAt(0).toUpperCase() + text.slice(1);
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

function proseSentences(answer: string): string[] {
  return answer
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !/^(?:Campaigns|Word occurrences)$/.test(line))
    .filter(line => !/^(?:Qur’an|Qur'an) \d+:\d+\b/.test(line) && !/^.+ — (?:Qur’an|Qur'an) \d+:\d+/.test(line))
    .flatMap(line => line.split(/(?<=[.!?])\s+/))
    .map(sentence =>
      clean(sentence)
        .replace(/^Word occurrence\.\s*/i, '')
        .replace(/^Historical events\.\s*/i, ''),
    )
    .filter(sentence => sentence.length > 12 && !STATUS.test(sentence));
}

function corpusFindings(answer: string): { word: string; events: string; contributions: string[] } | null {
  if (!/Word occurrence\./i.test(answer)) return null;
  const count = answer.match(/(\d+) distinct occurrence/);
  if (!count) return null;
  const english = answer.match(/English wordings counted: ([^.]+)\./)?.[1]?.trim();
  const arabic = answer.match(/Arabic wordings counted: ([^.]+)\./)?.[1]?.trim();
  if (!english || !arabic) return null;
  const incomplete = /not a complete census/i.test(answer);
  const word = `The word-occurrence count is ${count[1]}. The same wording in the same verse was counted once. The English wordings are ${english}. The Arabic wordings are ${arabic}.${incomplete ? ' Not every match is listed, so this is not a complete census.' : ''}`;
  const named = answer.match(/(\d+) campaigns? (?:is|are) named/i);
  const events = /No retrieved passage names a campaign/i.test(answer)
    ? 'No retrieved passage names a campaign, so there is no second count of battles.'
    : named
      ? `Separately, ${named[1]} ${named[1] === '1' ? 'campaign is' : 'campaigns are'} named in the retrieved passages. That number is not the word count.`
      : '';
  if (!events) return null;
  const namedLines: string[] = [];
  const unnamedLines: string[] = [];
  const unnamedRefs = new Set<string>();
  for (const line of answer.split('\n')) {
    const campaign = line.match(/^(.+?) — ((?:Qur’an|Qur'an) .+)\.$/);
    if (campaign && !/^(?:Qur’an|Qur'an)\b/.test(campaign[1])) {
      namedLines.push(`${campaign[1]} is named at ${campaign[2]}.`);
      continue;
    }
    const unnamed = line.match(/^((?:Qur’an|Qur'an) \d+:\d+) narrates a conflict and does not name the campaign\.$/);
    if (unnamed) {
      unnamedLines.push(`${unnamed[1]} narrates a conflict and does not name the campaign.`);
      unnamedRefs.add(unnamed[1]);
    }
  }
  const campaignRefs = new Set(namedLines.join(' ').match(/(?:Qur’an|Qur'an) \d+:\d+/g) ?? []);
  const wordLines = answer
    .split('\n')
    .map(line => line.match(/^((?:Qur’an|Qur'an) \d+:\d+) — (English|Arabic) “(.+)”\.$/))
    .filter((match): match is RegExpMatchArray => Boolean(match));
  const shared = wordLines.find(match => unnamedRefs.has(match[1]) && !campaignRefs.has(match[1]));
  const wordOnly = wordLines.find(match => !unnamedRefs.has(match[1]) && !campaignRefs.has(match[1]));
  const contributions = [...namedLines, ...unnamedLines.slice(0, 2)];
  if (shared) {
    contributions.push(`${shared[1]} is also in the word count, because it contains the ${shared[2]} wording “${shared[3]}”.`);
  }
  if (wordOnly) {
    contributions.push(`${wordOnly[1]} is in the word count because it contains the ${wordOnly[2]} wording “${wordOnly[3]}”. It is not a named campaign.`);
  }
  return { word, events, contributions };
}

function passageContributions(passages: readonly RoundtablePassage[]): string[] {
  const lines: string[] = [];
  for (const passage of passages) {
    if (!passage.locator.trim() || passage.context?.startsWith('Neighbouring')) continue;
    const context = clean(passage.context ?? '');
    if (/Historical event:/i.test(context)) {
      const name = context.match(/Historical event:\s*([^.]+)/i)?.[1]?.trim();
      if (name) lines.push(`${passage.locator} names ${name}.`);
      continue;
    }
    if (/does not name the campaign/i.test(context)) {
      lines.push(`${passage.locator} narrates a conflict and does not name the campaign.`);
      continue;
    }
    if (/Word occurrence:/i.test(context) && !/Historical event:/i.test(context)) {
      const wording = context.match(/Word occurrence:\s*([^.]+)/i)?.[1]?.trim();
      if (wording) lines.push(`${passage.locator} is in the word count because it contains ${wording}.`);
      continue;
    }
    const snippet = clean(passage.text).slice(0, 180);
    if (snippet && !STATUS.test(snippet)) lines.push(`${passage.locator} contributes this: ${snippet}`);
    if (lines.length >= 3) break;
  }
  return lines.slice(0, 3);
}

function line(speaker: string, text: string): RoundtableLine {
  return { speaker, role: speaker, text: clean(text) };
}

/** Retrieval logs, language codes, and invented totals must not be spoken. */
export function scriptMayBeSpoken(lines: readonly { text: string }[], allowed: string): boolean {
  const spoken = lines.map(item => item.text).join(' ');
  if (!spoken.trim() || lines.length < 4) return false;
  if (STATUS.test(spoken)) return false;
  if (INVENTED_TOTAL.test(spoken) && !INVENTED_TOTAL.test(allowed)) return false;
  return true;
}

/**
 * A spoken episode is a host and a generated researcher talking about one question's evidence.
 * Agent status lines stay out of the script.
 */
export function roundtableFromResearch(input: {
  question: string;
  language: Lang;
  agents?: readonly AgentContribution[];
  answer?: string | null;
  passages?: readonly RoundtablePassage[];
  insufficientEvidence?: boolean;
  status?: 'done' | 'running' | 'error' | 'cancelled' | 'queued';
}): RoundtableScript | null {
  if (input.status && input.status !== 'done') return null;
  const questions = separateQuestions(input.question);
  if (questions.length !== 1) return null;
  const question = questions[0];
  const passages = input.passages ?? [];
  const answer = input.answer?.trim() ?? '';
  if (!passages.length || !answer) return null;
  const sources = sourceLines(answer, passages);
  const corpus = corpusFindings(answer);
  const prose = proseSentences(answer);
  const contributions = corpus?.contributions.length ? corpus.contributions : passageContributions(passages);
  const finding = corpus ? `${corpus.word} ${corpus.events}` : prose.slice(0, 3).join(' ');
  if (!finding || STATUS.test(finding)) return null;
  const limit = input.insufficientEvidence || /do not state a total|does not state a total|not a complete census/i.test(`${answer}\n${finding}`);
  const contributionText = contributions.slice(0, 6).join(' ');
  const lines = [
    line(
      HOST,
      `The question is: ${everydayQuestion(question)} I am a generated host, and the researcher with me is generated too. We are not scholars.`,
    ),
    line(RESEARCHER, finding),
    line(
      HOST,
      corpus
        ? 'Those are two different counts. What do the passages themselves contribute, without mixing the word count and the campaigns?'
        : 'What do the opened passages contribute, and what do they leave unsettled?',
    ),
    line(
      RESEARCHER,
      contributionText ||
        (limit
          ? 'The opened passages do not go further than what I just said. A number they do not state is not part of this episode.'
          : 'That finding is only what the opened passages support.'),
    ),
    line(HOST, 'So what can a listener hold onto, and what is still open?'),
    line(
      RESEARCHER,
      corpus
        ? 'What is established is the word-occurrence count, and, separately, the campaigns the opened passages name. What is not established is one number that mixes those two readings, or a campaign name the passage itself does not give.'
        : limit
          ? 'What is established is only what those passages say. What is not established is a total, a name, or a combined figure that the passages do not give. This episode will not add one.'
          : 'What is established is the finding from the passages that were opened. What they do not say stays outside the conclusion.',
    ),
    line(HOST, 'That is the conclusion for this question, from this dossier alone.'),
  ];
  if (!scriptMayBeSpoken(lines, answer)) return null;
  return {
    title: question.slice(0, 140),
    language: input.language,
    question,
    lines,
    participants: [
      { id: 'host-generated', role: HOST, team: 'roundtable' },
      { id: 'researcher-generated', role: RESEARCHER, team: 'roundtable' },
    ],
    sources,
  };
}

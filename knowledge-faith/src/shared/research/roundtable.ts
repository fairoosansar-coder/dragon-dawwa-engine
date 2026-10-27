import type { AgentContribution } from '../contracts/v1.ts';
import type { Lang } from '../sources.ts';
import { recordsPractice } from './materialCoverage.ts';
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

function gist(text: string): string {
  const spoken = spokenPassage(text).replace(/^(?:\d+\.\s*)+/, '');
  const sentences = spoken.split(/(?<=[.!?؟])\s/).map(sentence => sentence.trim()).filter(sentence => sentence.length >= 12);
  let sentence = sentences[0] ?? spoken;
  if (sentence.length < 40 && sentences[1]) sentence = `${sentence} ${sentences[1]}`;
  return sentence.length > 180 ? `${sentence.slice(0, 177).trim()}…` : sentence;
}

function generalConversation(input: {
  question: string;
  answer: string;
  passages: readonly RoundtablePassage[];
  language: Lang;
  insufficientEvidence?: boolean;
  unresolved?: readonly string[];
}): RoundtableLine[] | null {
  const usable = input.passages
    .filter(passage => !passage.context?.startsWith('Neighbouring'))
    .map(passage => ({
      text: spokenPassage(passage.text),
      provider: passage.provider,
      explained: passage.provider === 'Parallel' || /commentary|attributed explanation/i.test(passage.context ?? ''),
    }))
    .filter(passage => passage.text.length >= 12 && !STATUS.test(passage.text));
  if (!usable.length) return null;
  const deniesTotal = /do not state a total|does not state a total/i.test(input.answer);
  const openNotes = [...new Set((input.unresolved ?? []).map(note => note.trim()).filter(Boolean))].slice(0, 2);
  if (deniesTotal) {
    const told = usable.slice(0, 2).map(passage => gist(passage.text)).join(' ');
    return [
      line(HOST, `The question is: ${everydayQuestion(input.question)} I am a generated host. The two contributors with me are generated too. We are not scholars.`),
      line(PASSAGE, `The passages say this: ${told}`),
      line(DISTINCTION, 'Do these passages state a total, or do they only say what you just heard?'),
      line(PASSAGE, 'They do not state a total. This episode will not add one. What they establish is only what they say.'),
      line(HOST, 'That is the conclusion for this question, from this dossier alone.'),
      ...openNotes.map(note => line(DEEP, `This part stays open. ${note}`)),
    ];
  }
  const primary = usable[0];
  const further = usable.find(passage => passage !== primary && (passage.provider === 'Parallel' || recordsPractice(passage.text))) ?? usable[1];
  const primaryPoint = gist(primary.text);
  const furtherPoint = further ? gist(further.text) : '';
  const practice = further ? recordsPractice(further.text) : recordsPractice(primary.text);
  const host = input.language === 'ta'
    ? `கேள்வி இது: ${everydayQuestion(input.question)} நான் உருவாக்கப்பட்ட தொகுப்பாளர். எங்களுடன் இருப்பவர்களும் உருவாக்கப்பட்டவர்கள். நாங்கள் அறிஞர்கள் அல்ல.`
    : input.language === 'si'
      ? `ප්‍රශ්නය මෙයයි: ${everydayQuestion(input.question)} මම නිර්මාණය කළ ඉදිරිපත් කරන්නෙක්. අනෙක් දෙදෙනාත් නිර්මාණය කළ අයයි. අපි විද්වතුන් නොවෙමු.`
      : `The question is: ${everydayQuestion(input.question)} I am a generated host. The two contributors with me are generated too. We are not scholars.`;
  const established = input.language === 'ta'
    ? `இந்தப் பகுதி நிறுவுவது இது: ${primaryPoint}`
    : input.language === 'si'
      ? `මෙම කොටසෙන් පෙනෙන්නේ මෙයයි: ${primaryPoint}`
      : `What this passage establishes is this: ${primaryPoint}`;
  const ask = further
    ? input.language === 'ta'
      ? `இன்னொரு பகுதி இதைச் சேர்க்கிறது: ${furtherPoint} முதல் பகுதி விட்டுவைத்ததை இது முடிக்கிறதா?`
      : input.language === 'si'
        ? `තවත් කොටසක් මෙය එකතු කරයි: ${furtherPoint} පළමු කොටස නිම නොකළ දේ මෙය වසා දමයිද?`
        : `Another passage adds this: ${furtherPoint} Does that close what the first passage left open?`
    : input.language === 'ta'
      ? 'இப்போது கேட்டதைத் தாண்டி எதைச் சேர்க்க மறுக்க வேண்டும்?'
      : input.language === 'si'
        ? 'දැන් අසා ඇති දේට වඩා අප එකතු නොකළ යුත්තේ කුමක්ද?'
        : 'What should we refuse to add beyond what you just heard?';
  const reply = further
    ? practice
      ? input.language === 'ta'
        ? 'அந்தக் கருத்து அந்த ஆதாரம் பதிவு செய்த நடைமுறை. அதை நாம் ஒரு புதிய தீர்ப்பாக ஆக்கவில்லை. நிறுவப்பட்டது ஆதாரங்கள் சொல்வது மட்டும்.'
        : input.language === 'si'
          ? 'එම කරුණ එම මූලාශ්‍රය සටහන් කළ පිළිවෙතකි. අපි එය නව තීන්දුවක් කළේ නැත. පිහිටුවා ඇත්තේ මූලාශ්‍ර කියන දේ පමණි.'
          : 'That further point is a practice the source records. We did not turn it into a new ruling. What is established is what those sources say.'
      : further.explained
        ? input.language === 'ta'
          ? 'அது ஆதாரம் சொல்லும் விளக்கம். நிறுவப்பட்டது அந்த விளக்கம். ஆதாரம் சொல்லாதது முடிவுக்கு வெளியே இருக்கும்.'
          : input.language === 'si'
            ? 'එය මූලාශ්‍රයේ පැහැදිලි කිරීමයි. පිහිටුවා ඇත්තේ එම පැහැදිලි කිරීමයි. මූලාශ්‍ර නොකියන දේ නිගමනයෙන් පිටතය.'
            : 'That is the source’s explanation. What is established is that explanation. What the sources do not say stays outside the conclusion.'
        : input.language === 'ta'
          ? 'அந்த அடுத்தப் பகுதி சொல்வது அவ்வளவுதான். அதை ஒரு தீர்ப்பாக ஆக்கவில்லை. நிறுவப்பட்டது ஆதாரங்கள் சொல்வது மட்டும்.'
          : input.language === 'si'
            ? 'එම ඊළඟ කොටස කියන්නේ එපමණයි. අපි එය තීන්දුවක් කළේ නැත. පිහිටුවා ඇත්තේ මූලාශ්‍ර කියන දේ පමණි.'
            : 'That further passage says only what you just heard. We did not turn it into a ruling. What is established is what those sources say.'
    : input.language === 'ta'
      ? 'நிறுவப்பட்டது அந்தப் பகுதி சொல்வது. அது சொல்லாதது முடிவுக்கு வெளியே இருக்கும்.'
      : input.language === 'si'
        ? 'පිහිටුවා ඇත්තේ එම කොටස කියන දේයි. එය නොකියන දේ නිගමනයෙන් පිටතය.'
        : 'What is established is what that passage says. What it does not say stays outside the conclusion.';
  const close = input.language === 'ta'
    ? 'இந்தக் கேள்விக்கு இந்த ஆவணத்திலிருந்து இதுவே முடிவு.'
    : input.language === 'si'
      ? 'මෙම ප්‍රශ්නයට මෙම ලේඛනයෙන් මෙය නිගමනයයි.'
      : 'That is the conclusion for this question, from this dossier alone.';
  const openLead = input.language === 'ta' ? 'இந்தப் பகுதி திறந்தே இருக்கிறது.' : input.language === 'si' ? 'මෙම කොටස විවෘතව පවතී.' : 'This part stays open.';
  return [
    line(HOST, host),
    line(PASSAGE, established),
    line(DISTINCTION, ask),
    line(PASSAGE, reply),
    line(HOST, close),
    ...openNotes.map(note => line(DEEP, `${openLead} ${note}`)),
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
    : generalConversation({
        question,
        answer,
        passages,
        language: input.language,
        insufficientEvidence: input.insufficientEvidence,
        unresolved: input.unresolved,
      });
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

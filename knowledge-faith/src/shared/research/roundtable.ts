import type { AgentContribution } from '../contracts/v1.ts';
import { sanitizePodcastHostName } from '../podcastHost.ts';
import type { Lang } from '../sources.ts';
import { asksWhen, recordsPractice, timingClause } from './materialCoverage.ts';
import { separateQuestions } from './questions.ts';

export interface RoundtableLine {
  speaker: string;
  role: string;
  text: string;
  /** Chapter title for the continuous transcript. Not spoken. */
  chapter?: string;
  /** Approximate start, m:ss, scaled to the episode audio. Not spoken. */
  at?: string;
}

export interface RoundtablePassage {
  locator: string;
  text: string;
  context?: string | null;
  provider?: string;
  role?: string;
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

export const DEFAULT_HOST_NAME = 'Seeker';

export function episodeHostName(value?: string | null): string {
  return sanitizePodcastHostName(value);
}
const TARIQ = 'Dr. Tariq al-Mansoor';
const PASSAGE = 'Dr. Layla al-Qasimi';
const IMRAN = 'Sheikh Imran al-Hasani';
const DISTINCTION = 'Dr. Zainab al-Mubarak';
const YUSUF = 'Sheikh Yusuf al-Azhari';
const DEEP = 'Dr. Amina al-Kindi';

interface Persona {
  name: string;
  id: string;
  team: string;
}

const PERSONAS: readonly Persona[] = [
  { name: TARIQ, id: 'tariq-generated', team: 'hadith' },
  { name: PASSAGE, id: 'layla-generated', team: 'quran' },
  { name: IMRAN, id: 'imran-generated', team: 'hadith' },
  { name: DISTINCTION, id: 'zainab-generated', team: 'hadith' },
  { name: YUSUF, id: 'yusuf-generated', team: 'hadith' },
  { name: DEEP, id: 'amina-generated', team: 'deep-research' },
];

/** Warm welcome. The page header says the presenters are generated, so the voice does not. */
function generatedHost(question: string, language: Lang, hostName: string): string {
  const asked = everydayQuestion(question);
  if (language === 'ta') return `${hostName}, வரவேற்கிறோம். இன்று நாம் உங்கள் கேள்வியுடன் அமர்கிறோம்: ${asked}`;
  if (language === 'si') return `${hostName}, සාදරයෙන් පිළිගනිමු. අද අපි ඔබේ ප්‍රශ්නය සමඟ වාඩි වෙමු: ${asked}`;
  return `Welcome, ${hostName}. Today we sit with your question: ${asked}`;
}

function shortName(name: string): string {
  return name.replace(/^(?:Dr\.|Sheikh|Brother)\s+/i, '').split(/\s+/)[0] || name;
}

/** Personas whose agents ran. The host is a generated presenter, not a research agent. */
function personasForAgents(agents: readonly AgentContribution[] | undefined): Set<string> | null {
  if (!agents) return null;
  const names = new Set<string>();
  for (const agent of agents) {
    if (agent.status !== 'ran') continue;
    const role = agent.role.toLowerCase();
    if (/isnad|qur.an text|translation|passage analysis/.test(role)) names.add(PASSAGE);
    if (/rijal/.test(role)) names.add(IMRAN);
    if (/shawahid|evidence review|comparison/.test(role)) names.add(DISTINCTION);
    if (/scholar|tafsir/.test(role)) names.add(YUSUF);
    if (/takhrij|discovery/.test(role)) names.add(TARIQ);
    if (/hadeethenc|deep research|source verification/.test(role)) names.add(DEEP);
  }
  return names;
}

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

function corpusConversation(question: string, passages: readonly RoundtablePassage[], hostName: string): RoundtableLine[] | null {
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
  const told = campaigns.slice(0, 2).map(campaignMoment).join('. ');
  return [
    line(hostName, generatedHost(question, 'en', hostName)),
    line(PASSAGE, `${hostName}, we will not read the page aloud. ${told}.`),
    line(
      DISTINCTION,
      `${hostName}, those are named campaigns, the historical moments themselves. A wording hit is a different human situation. What does the contrast teach?`,
    ),
    line(PASSAGE, `${hostName}, that other wording is not the story of a named campaign. A word can appear while the subject is patience, hardship, or ordinary life.`),
    line(
      DISTINCTION,
      `${hostName}, the wording can be present while the subject is something else. What is established is that the wording count and the named campaigns are separate. What is not established is one mixed total. These passages do not give one.`,
    ),
  ];
}

function addressed(question: string, text: string, context?: string | null): string {
  const clause = asksWhen(question) ? timingClause(question, `${text}\n${context ?? ''}`) : null;
  return gist(clause ?? text);
}

function gist(text: string): string {
  const spoken = spokenPassage(text).replace(/^(?:\d+\.\s*)+/, '');
  const sentences = spoken.split(/(?<=[.!?؟])\s/).map(sentence => sentence.trim()).filter(sentence => sentence.length >= 12);
  let sentence = sentences[0] ?? spoken;
  if (sentence.length < 40 && sentences[1]) sentence = `${sentence} ${sentences[1]}`;
  return sentence.length > 160 ? `${sentence.slice(0, 157).trim()}…` : sentence;
}

/** Keep one language. A foreign sentence is announced as a translation, not dropped in. */
function voiced(language: Lang, lesson: string): string {
  const latin = /[A-Za-z]/.test(lesson);
  const tamil = /[\u0B80-\u0BFF]/.test(lesson);
  const sinhala = /[\u0D80-\u0DFF]/.test(lesson);
  if (language === 'ta' && latin && !tamil) return `ஆங்கில மூலத்தின் பொருளைத் தமிழுடன் வைக்கிறேன்: ${lesson}`;
  if (language === 'si' && latin && !sinhala) return `ඉංග්‍රීසි මූලයේ අර්ථය සිංහල සමඟ තබමු: ${lesson}`;
  if (language === 'en' && tamil && !latin) return `The Tamil wording, kept on purpose, is: ${lesson}`;
  if (language === 'en' && sinhala && !latin) return `The Sinhala wording, kept on purpose, is: ${lesson}`;
  return lesson;
}

function campaignMoment(passage: PreparedPassage): string {
  const name = passage.campaign ?? 'that day';
  if (/grateful/i.test(passage.text)) return `${name}, when the people were in need, and the lesson is gratitude`;
  if (/pride/i.test(passage.text)) return `${name}, when pride in their numbers failed them`;
  return `${name}, the historical moment we are sitting with`;
}

function generalConversation(input: {
  question: string;
  answer: string;
  passages: readonly RoundtablePassage[];
  language: Lang;
  agents?: readonly AgentContribution[];
  disagreements?: readonly string[];
  insufficientEvidence?: boolean;
  unresolved?: readonly string[];
  hostName: string;
}): RoundtableLine[] | null {
  const usable = input.passages
    .filter(passage => !passage.context?.startsWith('Neighbouring'))
    .map(passage => ({
      text: spokenPassage(passage.text),
      context: passage.context,
      provider: passage.provider,
      role: passage.role,
      ref: quranRef(passage.locator),
      explained: passage.provider === 'Parallel' || passage.role === 'commentary' || /commentary|attributed explanation/i.test(passage.context ?? ''),
      empirical: passage.provider === 'OpenAlex' || passage.role === 'empirical',
    }))
    .filter(passage => passage.text.length >= 12 && !STATUS.test(passage.text));
  if (!usable.length) return null;
  const deniesTotal = /do not state a total|does not state a total/i.test(input.answer);
  const openNotes = [...new Set((input.unresolved ?? []).map(note => note.trim()).filter(note => note && !STATUS.test(note)))].slice(0, 2);
  const allowed = personasForAgents(input.agents);
  const can = (name: string) => !allowed || allowed.has(name);
  const reader = [PASSAGE, TARIQ, DEEP, DISTINCTION, YUSUF, IMRAN].find(can);
  const asker = [DISTINCTION, DEEP, TARIQ, YUSUF, IMRAN, PASSAGE].find(name => name !== reader && can(name));
  const hostName = input.hostName;
  if (!reader) return null;
  const close = input.language === 'ta'
    ? 'உங்கள் கேள்வியிலிருந்து நாம் எடுத்துச் செல்லும் பாடம் இதுவே.'
    : input.language === 'si'
      ? 'ඔබේ ප්‍රශ්නයෙන් අප රැගෙන යන පාඩම මෙයයි.'
      : 'That is the lesson we will carry from your question.';
  const openLead = input.language === 'ta' ? 'இந்தப் பகுதி திறந்தே இருக்கிறது.' : input.language === 'si' ? 'මෙම කොටස විවෘතව පවතී.' : 'This part stays open.';
  if (deniesTotal) {
    const told = voiced(input.language, usable.slice(0, 2).map(passage => gist(passage.text)).join(' '));
    const countAsk = input.language === 'ta'
      ? 'இந்தப் பகுதிகள் ஒரு மொத்த எண்ணைச் சொல்கின்றனவா, அல்லது இப்போது கேட்டதை மட்டும் சொல்கின்றனவா?'
      : input.language === 'si'
        ? 'මෙම කොටස් මුළු ගණනක් කියයිද, නැතහොත් දැන් අසා ඇති දේ පමණක් කියයිද?'
        : 'Do these passages state a total, or do they only say what you just heard?';
    const countReply = input.language === 'ta'
      ? 'அவை ஒரு மொத்த எண்ணைச் சொல்லவில்லை. இந்த அத்தியாயம் ஒன்றைச் சேர்க்காது. நிறுவப்பட்டது அவை சொல்வது மட்டும்.'
      : input.language === 'si'
        ? 'ඒවා මුළු ගණනක් කියන්නේ නැත. මෙම කථාව එකක් එකතු නොකරයි. පිහිටුවා ඇත්තේ ඒවා කියන දේ පමණි.'
        : 'They do not state a total. This episode will not add one. What they establish is only what they say.';
    return [
      line(hostName, generatedHost(input.question, input.language, hostName)),
      line(reader, `${hostName}, ${input.language === 'en' ? `the passages say this: ${told}` : told} ${countAsk}`),
      line(hostName, countReply),
      line(asker ?? reader, `${hostName}, ${close}`),
      ...openNotes.map(note => line(asker ?? hostName, `${hostName}, ${openLead} ${note}`)),
    ];
  }
  const primary = usable[0];
  const further = usable.find(passage => passage !== primary && (passage.explained || passage.empirical || recordsPractice(passage.text))) ?? usable[1];
  const primaryPoint = voiced(input.language, addressed(input.question, primary.text, primary.context));
  const furtherPoint = further ? voiced(input.language, addressed(input.question, further.text, further.context)) : '';
  const practice = further ? recordsPractice(further.text) : recordsPractice(primary.text);
  const grade = input.language === 'en' ? input.answer.match(/The source prints this grade: [^.]+\./)?.[0] ?? '' : '';
  const established = input.language === 'ta'
    ? primary.empirical
      ? `இந்தப் பகுதி நிறுவுவது ஒரு அனுபவ ஆய்வுக் குறிப்பு. இது வேதவாக்கியமோ நபிமொழியோ அல்ல: ${primaryPoint}`
      : primary.explained
        ? `இந்தப் பகுதி நிறுவுவது மூலத்தின் விளக்கம். இது புதிய தீர்ப்பு அல்ல: ${primaryPoint}`
        : `இந்தப் பகுதி நிறுவுவது இது: ${primaryPoint}`
    : input.language === 'si'
      ? primary.empirical
        ? `මෙම කොටසෙන් පෙනෙන්නේ අත්දැකීම් සටහනකි. එය ශුද්ධ ලියවිල්ලක් හෝ වදනක් නොවේ: ${primaryPoint}`
        : primary.explained
          ? `මෙම කොටසෙන් පෙනෙන්නේ මූලාශ්‍රයේ පැහැදිලි කිරීමයි. එය නව තීන්දුවක් නොවේ: ${primaryPoint}`
          : `මෙම කොටසෙන් පෙනෙන්නේ මෙයයි: ${primaryPoint}`
      : primary.empirical
        ? `This is an empirical finding, not scripture and not a narration. The practical lesson is ${primaryPoint}`
        : primary.explained
          ? `The lesson is the explanation we opened, not a new ruling: ${primaryPoint}`
          : `Let us sit with the person and the moment. The practical lesson is ${primaryPoint}`;
  const ask = further
    ? input.language === 'ta'
      ? `${hostName}, இன்னொரு பகுதி இதைச் சேர்க்கிறது: ${furtherPoint} முதல் பகுதி விட்டுவைத்ததை இது முடிக்கிறதா?`
      : input.language === 'si'
        ? `${hostName}, තවත් කොටසක් මෙය එකතු කරයි: ${furtherPoint} පළමු කොටස නිම නොකළ දේ මෙය වසා දමයිද?`
        : `${hostName}, another passage adds this: ${furtherPoint} Does that close what the first passage left open?`
    : input.language === 'ta'
      ? `${hostName}, இப்போது கேட்டதைத் தாண்டி எதைச் சேர்க்க மறுக்க வேண்டும்?`
      : input.language === 'si'
        ? `${hostName}, දැන් අසා ඇති දේට වඩා අප එකතු නොකළ යුත්තේ කුමක්ද?`
        : `${hostName}, what should we refuse to add beyond what you just heard?`;
  const reply = !further && practice
    ? input.language === 'ta'
      ? 'நிறுவப்பட்டது அந்த ஆதாரம் பதிவு செய்த நடைமுறை. அதை நாம் ஒரு புதிய தீர்ப்பாக ஆக்கவில்லை.'
      : input.language === 'si'
        ? 'පිහිටුවා ඇත්තේ එම මූලාශ්‍රය සටහන් කළ පිළිවෙතයි. අපි එය නව තීන්දුවක් කළේ නැත.'
        : 'What is established is a practice the source records. We did not turn it into a new ruling. What it does not say stays outside the conclusion.'
    : further
    ? further.empirical
      ? input.language === 'ta'
        ? 'அந்த அடுத்தக் குறிப்பு அனுபவ ஆய்வு. அது வேதவாக்கியம் அல்ல. வேதவாக்கியம் அந்த ஆய்வின் சான்று அல்ல. நிறுவப்பட்டது ஒவ்வொரு மூலமும் சொல்வது மட்டும்.'
        : input.language === 'si'
          ? 'එම ඊළඟ සටහන අත්දැකීම් සාක්ෂියකි. එය ශුද්ධ ලියවිල්ල නොවේ. ශුද්ධ ලියවිල්ල එම සාක්ෂිය නොවේ. පිහිටුවා ඇත්තේ එක් එක් මූලාශ්‍රය කියන දේ පමණි.'
          : 'That further point is an empirical finding. It is not scripture, and the scripture is not that finding. What is established is only what each source says.'
      : practice
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
  const recorded = [...new Set((input.disagreements ?? []).map(item => clean(item)))]
    .filter(item => item && !STATUS.test(item) && !INVENTORY.test(item) && !/not independent corroboration|cited \d+ times/i.test(item))
    .slice(0, 1);
  const stay = input.language === 'ta'
    ? 'இதை இந்தப் பகுதியிலேயே விட்டுவைக்கலாமா?'
    : input.language === 'si'
      ? 'මෙය කොටස කියන දේ සමඟ තබමුද?'
      : 'Shall we leave it with what the passage says?';
  const lines: RoundtableLine[] = [
    line(hostName, generatedHost(input.question, input.language, hostName)),
    line(reader, `${hostName}, ${grade ? `${established} ${grade}` : established}`),
  ];
  if (recorded.length) {
    const disagreementSpeaker = can(YUSUF) && YUSUF !== reader ? YUSUF : (asker ?? reader);
    const disagreement = input.language === 'en'
      ? `${hostName}, the dossier records this disagreement, and we will not invent a side: ${gist(recorded[0])} Do we leave that disagreement standing?`
      : input.language === 'ta'
        ? 'ஆவணம் ஒரு கருத்து வேறுபாட்டைப் பதிவு செய்கிறது. நாம் ஒரு பக்கத்தை உருவாக்கவில்லை. அந்த வேறுபாட்டை அப்படியே விட்டுவைக்கிறோமா?'
        : 'ලේඛනය මතභේදයක් සටහන් කරයි. අපි පැත්තක් නිර්මාණය කළේ නැත. එම මතභේදය එලෙසම තබමුද?';
    lines.push(line(disagreementSpeaker, disagreement));
    lines.push(line(
      reader,
      input.language === 'ta'
        ? 'அந்தக் கருத்து வேறுபாடு பகுதிக்கு அருகில் நிற்கிறது. நாம் ஆவணம் தேர்ந்தெடுக்காத பக்கத்தைத் தேர்ந்தெடுக்கவில்லை.'
        : input.language === 'si'
          ? 'එම මතභේදය කොටස අසල පවතී. ලේඛනය නොතෝරූ පැත්තක් අපි තෝරා නැත.'
          : 'That disagreement stays beside the passage. What is established is what the sources say. We did not choose a side the dossier does not choose.',
    ));
  } else {
    lines.push(line(asker ?? hostName, ask));
    lines.push(line(reader, `${hostName}, ${reply} ${stay}`));
  }
  if (can(IMRAN)) {
    const judged = usable.find(passage => /\b(?:thiqa|trustworthy|weak|liar|matruk|majhul)\b|صدوق|ضعيف|ثقة/i.test(passage.text));
    const spoken = judged ? gist(judged.text) : '';
    if (spoken && !STATUS.test(spoken)) {
      const judgement = input.language === 'en'
        ? `The opened wording includes a narrator judgement, and we did not add a grade of our own: ${spoken}`
        : input.language === 'ta'
          ? `திறந்த சொற்களில் ஒரு அறிவிப்பாளர் குறிப்பு உள்ளது. நாமே ஒரு தரத்தைச் சேர்க்கவில்லை: ${spoken}`
          : `විවෘත වදනේ වාර්තාකරුවෙකු ගැන සටහනක් ඇත. අපිම ශ්‍රේණියක් එකතු කළේ නැත: ${spoken}`;
      const carrier = lines.find(item => item.speaker === reader);
      if (carrier) carrier.text = `${carrier.text} ${judgement}`;
    }
  }
  lines.push(line(hostName, `${hostName}, ${close}`));
  if (openNotes.length) lines.push(line(asker ?? hostName, `${hostName}, ${openLead} ${openNotes.join(' ')}`));
  return lines;
}

/** Retrieval logs, wording inventories, language codes, and invented totals must not be spoken. */
export function scriptMayBeSpoken(lines: readonly { text: string; speaker?: string }[], allowed: string): boolean {
  const spoken = lines.map(item => item.text).join(' ');
  if (!spoken.trim() || lines.length < 4) return false;
  const named = lines.filter(item => item.speaker);
  if (named.length) {
    const speakers = new Set(named.map(item => item.speaker));
    if (speakers.size < 2) return false;
    const hostSpeaker = named.find(item => item.speaker)?.speaker;
    const contributorAsked = named.some(item => item.speaker && item.speaker !== hostSpeaker && !/^host\b/i.test(item.speaker) && item.text.includes('?'));
    if (!contributorAsked) return false;
  }
  if (STATUS.test(spoken) || INVENTORY.test(spoken)) return false;
  if (INVENTED_TOTAL.test(spoken) && !INVENTED_TOTAL.test(allowed)) return false;
  return true;
}

function formatStamp(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Chapter markers sit beside the dialogue. They are not spoken and they are not snippet cards. */
function withChapters(lines: RoundtableLine[]): RoundtableLine[] {
  const titles = ['Opening', 'The passage', 'What remains', 'Close'];
  let cursor = 0;
  return lines.map((item, index) => {
    const at = formatStamp(cursor);
    cursor += Math.max(12, item.text.split(/\s+/).length * 0.45);
    const chapter = index === 0 ? 'Opening' : index === lines.length - 1 ? 'Close' : titles[Math.min(index, titles.length - 1)];
    return { ...item, chapter, at };
  });
}

/**
 * A spoken episode is a generated host and one generated scholar.
 * They talk through the opened passages. Citation lists and status logs stay out of the script.
 */
export function roundtableFromResearch(input: {
  question: string;
  language: Lang;
  agents?: readonly AgentContribution[];
  answer?: string | null;
  passages?: readonly RoundtablePassage[];
  disagreements?: readonly string[];
  insufficientEvidence?: boolean;
  unresolved?: readonly string[];
  status?: 'done' | 'running' | 'error' | 'cancelled' | 'queued';
  investigation?: 'complete' | 'partial' | 'blocked';
  /** Spoken name of the studio partner. Empty becomes "Seeker". */
  hostName?: string | null;
}): RoundtableScript | null {
  if (input.investigation === 'blocked') return null;
  if (input.status && input.status !== 'done') return null;
  const questions = separateQuestions(input.question);
  if (questions.length !== 1) return null;
  const question = questions[0];
  const passages = input.passages ?? [];
  const answer = input.answer?.trim() ?? '';
  if (!passages.length || !answer) return null;
  const hostName = episodeHostName(input.hostName);
  const corpus = /Word occurrence\./i.test(answer);
  const lines = corpus
    ? corpusConversation(question, passages, hostName)
    : generalConversation({
        question,
        answer,
        passages,
        language: input.language,
        agents: input.agents,
        disagreements: input.disagreements,
        insufficientEvidence: input.insufficientEvidence,
        unresolved: input.unresolved,
        hostName,
      });
  if (!lines || !scriptMayBeSpoken(lines, answer)) return null;
  const spoken = withChapters(lines);
  const speaking = new Set(spoken.map(item => item.speaker));
  return {
    title: question.slice(0, 140),
    language: input.language,
    question,
    lines: spoken,
    participants: [
      ...(speaking.has(hostName) ? [{ id: 'host-generated', role: `${hostName} (generated host)`, team: 'host' }] : []),
      ...PERSONAS.filter(person => speaking.has(person.name)).map(person => ({
        id: person.id,
        role: `${person.name} (generated)`,
        team: person.team,
      })),
    ],
    sources: sourceLines(answer, passages),
  };
}

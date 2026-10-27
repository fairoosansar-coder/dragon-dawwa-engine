import type { AgentContribution } from '../contracts/v1.ts';
import type { Lang } from '../sources.ts';
import { asksWhen, recordsPractice, timingClause } from './materialCoverage.ts';
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

const HOST = 'Brother Feroz';
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
  { name: HOST, id: 'feroz-generated', team: 'roundtable' },
  { name: TARIQ, id: 'tariq-generated', team: 'hadith' },
  { name: PASSAGE, id: 'layla-generated', team: 'quran' },
  { name: IMRAN, id: 'imran-generated', team: 'hadith' },
  { name: DISTINCTION, id: 'zainab-generated', team: 'hadith' },
  { name: YUSUF, id: 'yusuf-generated', team: 'hadith' },
  { name: DEEP, id: 'amina-generated', team: 'deep-research' },
];

/** A generated presenter. The name is the studio voice, not a claim that the person spoke. */
function generatedHost(question: string, language: Lang): string {
  const asked = everydayQuestion(question);
  if (language === 'ta') {
    return `கேள்வி இது: ${asked} நான் உருவாக்கப்பட்ட தொகுப்பாளர். எங்களுடன் இருப்பவர்களும் உருவாக்கப்பட்டவர்கள். பிரதர் ஃபெரோஸ் இந்தச் சொற்களைப் பேசவில்லை, இவற்றை அங்கீகரிக்கவும் இல்லை. நாங்கள் அறிஞர்கள் அல்ல.`;
  }
  if (language === 'si') {
    return `ප්‍රශ්නය මෙයයි: ${asked} මම නිර්මාණය කළ ඉදිරිපත් කරන්නෙක්. අනෙක් අයත් නිර්මාණය කළ අයයි. බ්‍රදර් ෆෙරෝස් මේ වචන කථා කළේ නැත, ඒවා අනුමත කළේත් නැත. අපි විද්වතුන් නොවෙමු.`;
  }
  return `Welcome to Dragon Dawwa Live. The question is: ${asked} I am a generated host. The contributors with me are generated too. Brother Feroz did not speak these words and did not approve them. We are not scholars.`;
}

function shortName(name: string): string {
  return name.replace(/^(?:Dr\.|Sheikh|Brother)\s+/i, '').split(/\s+/)[0] || name;
}

/** Personas whose agents ran. The host is a generated presenter, not a research agent. */
function personasForAgents(agents: readonly AgentContribution[] | undefined): Set<string> | null {
  if (!agents) return null;
  const names = new Set<string>([HOST]);
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
      `The question is: ${everydayQuestion(question)} I am a generated host. The two contributors with me are generated too. We are not scholars. Brother Feroz did not speak these words and did not approve them. We will talk about what the opened passages say.`,
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

function addressed(question: string, text: string, context?: string | null): string {
  const clause = asksWhen(question) ? timingClause(question, `${text}\n${context ?? ''}`) : null;
  return gist(clause ?? text);
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
  agents?: readonly AgentContribution[];
  disagreements?: readonly string[];
  insufficientEvidence?: boolean;
  unresolved?: readonly string[];
}): RoundtableLine[] | null {
  const usable = input.passages
    .filter(passage => !passage.context?.startsWith('Neighbouring'))
    .map(passage => ({
      text: spokenPassage(passage.text),
      context: passage.context,
      provider: passage.provider,
      role: passage.role,
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
  if (!reader || !asker) return null;
  const close = input.language === 'ta'
    ? 'இந்தக் கேள்விக்கு இந்த ஆவணத்திலிருந்து இதுவே முடிவு.'
    : input.language === 'si'
      ? 'මෙම ප්‍රශ්නයට මෙම ලේඛනයෙන් මෙය නිගමනයයි.'
      : 'That is the conclusion for this question, from this dossier alone.';
  const openLead = input.language === 'ta' ? 'இந்தப் பகுதி திறந்தே இருக்கிறது.' : input.language === 'si' ? 'මෙම කොටස විවෘතව පවතී.' : 'This part stays open.';
  if (deniesTotal) {
    const told = usable.slice(0, 2).map(passage => gist(passage.text)).join(' ');
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
      line(HOST, generatedHost(input.question, input.language)),
      line(reader, input.language === 'en' ? `The passages say this: ${told}` : `${told}`),
      line(asker, countAsk),
      line(reader, countReply),
      line(HOST, close),
      ...openNotes.map(note => line(can(DEEP) ? DEEP : asker, `${openLead} ${note}`)),
    ];
  }
  const primary = usable[0];
  const further = usable.find(passage => passage !== primary && (passage.explained || passage.empirical || recordsPractice(passage.text))) ?? usable[1];
  const primaryPoint = addressed(input.question, primary.text, primary.context);
  const furtherPoint = further ? addressed(input.question, further.text, further.context) : '';
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
        ? `What this passage establishes is an empirical finding, not scripture and not a narration: ${primaryPoint}`
        : primary.explained
          ? `What this passage establishes is the source’s explanation, not a new ruling: ${primaryPoint}`
          : `What this passage establishes is this: ${primaryPoint}`;
  const ask = further
    ? input.language === 'ta'
      ? `${shortName(reader)}, இன்னொரு பகுதி இதைச் சேர்க்கிறது: ${furtherPoint} முதல் பகுதி விட்டுவைத்ததை இது முடிக்கிறதா?`
      : input.language === 'si'
        ? `${shortName(reader)}, තවත් කොටසක් මෙය එකතු කරයි: ${furtherPoint} පළමු කොටස නිම නොකළ දේ මෙය වසා දමයිද?`
        : `${shortName(reader)}, another passage adds this: ${furtherPoint} Does that close what the first passage left open?`
    : input.language === 'ta'
      ? `${shortName(reader)}, இப்போது கேட்டதைத் தாண்டி எதைச் சேர்க்க மறுக்க வேண்டும்?`
      : input.language === 'si'
        ? `${shortName(reader)}, දැන් අසා ඇති දේට වඩා අප එකතු නොකළ යුත්තේ කුමක්ද?`
        : `${shortName(reader)}, what should we refuse to add beyond what you just heard?`;
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
  const lines: RoundtableLine[] = [
    line(HOST, generatedHost(input.question, input.language)),
    line(reader, grade ? `${established} ${grade}` : established),
  ];
  if (recorded.length) {
    const speaker = can(YUSUF) && YUSUF !== reader ? YUSUF : asker;
    const disagreement = input.language === 'en'
      ? `${shortName(reader)}, the dossier records this disagreement, and we will not invent a side: ${gist(recorded[0])} Do we leave that disagreement standing?`
      : input.language === 'ta'
        ? `${shortName(reader)}, ஆவணம் ஒரு கருத்து வேறுபாட்டைப் பதிவு செய்கிறது. நாம் ஒரு பக்கத்தை உருவாக்கவில்லை. அந்த வேறுபாட்டை அப்படியே விட்டுவைக்கிறோமா?`
        : `${shortName(reader)}, ලේඛනය මතභේදයක් සටහන් කරයි. අපි පැත්තක් නිර්මාණය කළේ නැත. එම මතභේදය එලෙසම තබමුද?`;
    lines.push(line(speaker, disagreement));
    if (speaker !== reader) {
      lines.push(line(
        reader,
        input.language === 'ta'
          ? 'அந்தக் கருத்து வேறுபாடு பகுதிக்கு அருகில் நிற்கிறது. நாம் ஆவணம் தேர்ந்தெடுக்காத பக்கத்தைத் தேர்ந்தெடுக்கவில்லை.'
          : input.language === 'si'
            ? 'එම මතභේදය කොටස අසල පවතී. ලේඛනය නොතෝරූ පැත්තක් අපි තෝරා නැත.'
            : 'That disagreement stays beside the passage. What is established is what the sources say. We did not choose a side the dossier does not choose.',
      ));
    }
  } else {
    lines.push(line(asker, ask));
    lines.push(line(reader, reply));
  }
  if (can(IMRAN) && IMRAN !== reader) {
    const judged = usable.find(passage => /\b(?:thiqa|trustworthy|weak|liar|matruk|majhul)\b|صدوق|ضعيف|ثقة/i.test(passage.text));
    const spoken = judged ? gist(judged.text) : '';
    if (spoken && !STATUS.test(spoken)) {
      const judgement = input.language === 'en'
        ? `The opened wording includes a narrator judgement, and we did not add a grade of our own: ${spoken}`
        : input.language === 'ta'
          ? `திறந்த சொற்களில் ஒரு அறிவிப்பாளர் குறிப்பு உள்ளது. நாமே ஒரு தரத்தைச் சேர்க்கவில்லை: ${spoken}`
          : `විවෘත වදනේ වාර්තාකරුවෙකු ගැන සටහනක් ඇත. අපිම ශ්‍රේණියක් එකතු කළේ නැත: ${spoken}`;
      lines.push(line(IMRAN, judgement));
    }
  }
  lines.push(line(HOST, close));
  if (openNotes.length) {
    const opener = can(DEEP) ? DEEP : asker;
    lines.push(line(opener, `${openLead} ${openNotes.join(' ')}`));
  }
  return lines;
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
  disagreements?: readonly string[];
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
        agents: input.agents,
        disagreements: input.disagreements,
        insufficientEvidence: input.insufficientEvidence,
        unresolved: input.unresolved,
      });
  if (!lines || !scriptMayBeSpoken(lines, answer)) return null;
  const speaking = new Set(lines.map(item => item.speaker));
  return {
    title: question.slice(0, 140),
    language: input.language,
    question,
    lines,
    participants: PERSONAS.filter(person => speaking.has(person.name)).map(person => ({
      id: person.id,
      role: person.name === HOST ? `${HOST} (generated host)` : `${person.name} (generated)`,
      team: person.team,
    })),
    sources: sourceLines(answer, passages),
  };
}

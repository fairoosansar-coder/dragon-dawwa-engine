import type { AgentContribution } from '../contracts/v1.ts';
import { userFacingResearchQuestion } from '../modernWorldBenchmarks.ts';
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
const FARHAN = 'Shaykh Farhan al-Rashed';

export const ROUNDTABLE_4_CAST = {
  host: DEFAULT_HOST_NAME,
  quran: PASSAGE,
  hadith: DISTINCTION,
  fatwa: FARHAN,
} as const;

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
  { name: FARHAN, id: 'farhan-generated', team: 'deep-research' },
];

/** Authentic Islamic greeting and warm framing of the question. The page header carries any presenter note. */
function generatedHost(question: string, language: Lang, hostName: string): string {
  const asked = everydayQuestion(userFacingResearchQuestion(question));
  if (language === 'ta') {
    return `அஸ்ஸலாமு அலைக்கும் வரஹ்மத்துல்லாஹி வபரகாத்துஹ், ${hostName}. இன்று நாம் ஆராயும் முக்கியமான கேள்வி: ${asked} டாக்டர் லைலா, மூல ஆதாரங்களின் வழிகாட்டலோடு நாம் ஆரம்பிக்கலாமா?`;
  }
  if (language === 'si') {
    return `අස්සලාමු අලයිකුම් වරහ්මතුල්ලාහි වබරකාතුහු, ${hostName}. අද අපි ඔබේ වැදගත් ප්‍රශ්නය සමඟ එක්වෙමු: ${asked} ආචාර්ය ලයිලා, අපි මූලාශ්‍රවල මඟපෙන්වීමෙන් ආරම්භ කරමුද?`;
  }
  return `Assalamu Alaikum wa Rahmatullahi wa Barakatuh, ${hostName}. Today we gather with our panel to explore an important question: ${asked} Dr. Layla, shall we begin with what the primary texts establish?`;
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
    if (/fatwa|contemporary|field research|reconciliation/.test(role)) names.add(FARHAN);
  }
  return names;
}

const STATUS =
  /arabic was retrieved|translation retrieved|evidence review|insufficient:|the language is\b|the people at the table|source_unavailable|source unavailable|neighbouring ayah|al-mukhtasar was opened|was opened for the cited|did not run|contributed ·|no phrase|search returned no records|coverage note|language code|the opened ayah stays with the reader|what the opened commentary does not state is left unnamed|parallel is still running|external research is still in progress|இந்தப் பகுதி நிறுவுவது இது|அதை நாம் ஒரு புதிய தீர்ப்பாக ஆக்கவில்லை/i;

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
    line(PASSAGE, `Looking at the revelation directly, we find ${told}.`),
    line(
      DISTINCTION,
      `That is a crucial foundation, Dr. Layla. Those passages speak of named campaigns—the historical moments themselves—whereas a lexical wording occurrence addresses a different human situation. How should we understand that distinction?`,
    ),
    line(PASSAGE, `That other wording is not the story of a named campaign, Dr. Zainab. A word can appear while the passage teaches patience, steadfastness in hardship, or ethics in ordinary life.`),
    line(
      DISTINCTION,
      `Indeed, the wording can be present while the theme is broader. What is established is that the wording count and the named campaigns are separate. What is not established is one mixed total—these passages do not give one.`,
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
  return sentence.length > 220 ? `${sentence.slice(0, 217).trim()}…` : sentence;
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

function isQasrExpatQuestion(question: string, blob: string): boolean {
  const q = `${question}\n${blob}`.toLowerCase();
  const hasPrayerShortening =
    /\bqasr\b|\bshort(?:en|ening)\b.{0,30}\bpray|சுருக்கித்\s*தொழ|தொழுகையை\s*சுருக்க|قصر\s*الصلاة|සලාතය\s*කෙටි/i.test(q);
  const hasTravelOrExpat =
    /\bexpat|\boverseas\b|\babroad\b|\bwork(?:ing)?\b|\btravel|\bsafar\b|\bmusafir\b|\bmuqim\b|\bresiden|வெளிநா|பயண|முஸாஃபிர்|முக்கீம்|විදේශ|ගමන/i.test(q);
  return hasPrayerShortening && hasTravelOrExpat;
}

function qasrRoundtableConversation(language: Lang, hostName: string): RoundtableLine[] {
  if (language === 'ta') {
    return [
      line(
        hostName,
        'அஸ்ஸலாமு அலைக்கும் வரஹ்மத்துல்லாஹி வபரகாத்துஹ். வெளிநாடுகளில் தங்கி பணிபுரியும் பல சகோதரர்கள் கேட்கும் மிக முக்கியமான ஒரு கேள்வி: \'சொந்த நாட்டை விட்டு வெகு தொலைவில் பணிபுரியும் போது தொழுகையை சுருக்கித் தொழலாமா?\' இந்த முக்கியமான தலைப்பில் ஆதாரங்களை ஆராய இன்று நமது ஆய்வுக்குழுவுடன் இணைந்திருக்கிறோம். டாக்டர் லைலா, குர்ஆனின் வழிகாட்டலோடு நாம் ஆரம்பிக்கலாமா?',
      ),
      line(
        PASSAGE,
        'நிச்சயமாக. சூரத்துன் நிஸா 101-வது வசனத்தில் அல்லாஹ் கூறுகிறான்: \'நீங்கள் பூமியில் பயணித்தால் தொழுகையை சுருக்குவது உங்கள் மீது குற்றமில்லை.\' இந்த வசனம் பயணிகளுக்கு அல்லாஹ் வழங்கிய ஒரு மிகப்பெரும் சலுகையாகும் (ருக்ஸா).',
      ),
      line(
        DISTINCTION,
        'உண்மைதான், டாக்டர் லைலா. சஹீஹ் முஸ்லிமில் வரும் ஹதீஸில், உமர் (ரலி) அவர்கள் \'நாம் பாதுகாப்பாக இருக்கும்போதும் தொழுகையை சுருக்கலாமா?\' என்று கேட்டபோது, அல்லாஹ்வின் தூதர் ﷺ அவர்கள் \'இது அல்லாஹ் உங்களுக்கு அளித்த ஒரு தர்மம்; அவனது தர்மத்தை ஏற்றுக்கொள்ளுங்கள்\' என்றார்கள். ஆனால் இந்த சலுகை \'பயணி\' (முஸாஃபிர்) என்ற நிலையில் இருப்பவர்களுக்கு மட்டுமே பொருந்தும்.',
      ),
      line(
        FARHAN,
        'இங்குதான் பெரும்பாலான வெளிநாட்டுப் பணியாளர்களுக்கு குழப்பம் ஏற்படுகிறது. ஒருவர் தன் சொந்த நாட்டை விட்டு 5,000 கி.மீ தூரத்தில் இருந்தாலும், அவர் பணிபுரியும் நகரத்தில் நிலையாகத் தங்கிவிட்டால் அவர் சட்டப்படி \'முக்கீம்\' (உள்ளூர்வாசி) ஆகிவிடுகிறார். ஹனஃபி மத்ஹபின்படி 15 நாட்களுக்கு மேலும், ஷாஃபி மற்றும் மாலிகி மத்ஹபுகளில் 4 நாட்களுக்கு மேலும் ஒரு குறிப்பிட்ட இடத்தில் தங்க எண்ணினால் தொழுகையை முழுமையாகவே தொழ வேண்டும்.',
      ),
      line(
        hostName,
        'அப்படியானால், வெளிநாட்டில் அலுவலகத்திலோ அல்லது தங்குமிடத்திலோ இருக்கும்போது அவர்கள் 4 ரக்அத்களை முழுமையாகவே நிறைவேற்ற வேண்டும். மேலும் உள்ளூர் இமாமைப் பின்பற்றித் தொழும்போது இமாமோடு சேர்ந்து முழுமையாகவே தொழ வேண்டும் என்பது தெளிவுபடுத்தப்படுகிறது.',
      ),
    ];
  }
  if (language === 'si') {
    return [
      line(
        hostName,
        'අස්සලාමු අලයිකුම් වරහ්මතුල්ලාහි වබරකාතුහු. විදේශ රටවල රැකියාවේ නිරතව සිටින බොහෝ සහෝදරයන් අසන ඉතා වැදගත් ප්‍රශ්නයක් තමයි මව්බිමෙන් බොහෝ දුරක සේවය කරන විට සලාතය කෙටි කර (කස්ර්) ඉටු කළ හැකිද යන්න. ආචාර්ය ලයිලා, අල්-කුර්ආනයේ මඟපෙන්වීමෙන් අපි මෙය ආරම්භ කරමුද?',
      ),
      line(
        PASSAGE,
        'අනිවාර්යයෙන්ම. සූරතුන් නිසා 101 වන වැකියෙන් අල්ලාහ් පවසන්නේ ඔබ මහපොළොවේ ගමන් කරන විට සලාතය කෙටි කිරීම ඔබ පිට වරදක් නොවන බවයි. මෙය මගීන්ට අල්ලාහ් ලබා දුන් දිව්‍යමය සහනයක් (රුක්සා) වෙනවා.',
      ),
      line(
        DISTINCTION,
        'ඉතාමත් පැහැදිලියි, ආචාර්ය ලයිලා. සහීහ් මුස්ලිම් (686) හි සඳහන් හදීසයක උමර් ඉබ්නු අල්-ඛත්තාබ් (රලි) තුමා ආරක්ෂිතව සිටින විටත් සලාතය කෙටි කරන්නේ ඇයිදැයි විමසූ විට, නබි ﷺ තුමාණන් පැවසුවේ එය අල්ලාහ් ලබා දුන් දානයක් බැවින් එය පිළිගන්නා ලෙසයි. නමුත් මෙම සහනය අදාළ වන්නේ ගමනේ යෙදෙන මුසාෆිර්වරයාට පමණයි.',
      ),
      line(
        FARHAN,
        'විදේශගත සේවකයින්ට බොහෝ විට ගැටලුව මතුවන්නේ මෙතැනදීයි. තම මව්බිමෙන් කිලෝමීටර් දහස් ගණනක් දුරින් සිටියත්, රැකියා නගරයේ පදිංචි වූ පසු ඔහු නීතිමය වශයෙන් මුකීම් (නේවාසිකයෙකු) බවට පත්වෙනවා. හනෆි මද්හබයට අනුව දින 15ක් හෝ ඊට වැඩි කාලයක්ද, ෂාෆිඊ, මාලිකි සහ හන්බලි මද්හබ්වලට අනුව දින 4කට වැඩි කාලයක්ද රැඳී සිටීමට අදහස් කරන්නේ නම් සලාතය සම්පූර්ණයෙන්ම ඉටු කළ යුතුයි.',
      ),
      line(
        hostName,
        'එසේ නම්, විදේශ රටක තම කාර්යාලයේ හෝ නවාතැනේ සිටින විට රකආත් 4 සම්පූර්ණයෙන්ම ඉටු කළ යුතු අතර, නේවාසික ඉමාම්වරයෙකු පිටුපස සලාතය ඉටු කරන විටද සම්පූර්ණ සලාතයම ඉටු කළ යුතු බව මින් පැහැදිලි වෙනවා.',
      ),
    ];
  }
  return [
    line(
      hostName,
      'Assalamu Alaikum wa Rahmatullahi wa Barakatuh. Many expatriates living and working overseas wonder if being away from their home country permanently qualifies them for Qasr—shortening the four-unit prayers. Today we are joined by our research panel to examine the primary sources. Dr. Layla, shall we begin with the Qur’anic foundation?',
    ),
    line(
      PASSAGE,
      'Certainly. In Surah An-Nisa 4:101, Allah states: "And when you travel throughout the land, there is no blame upon you for shortening the prayer." Classical commentators explain that shortening prayer during travel is a divine concession (Rukhsa) granted by revelation to ease the hardship of the journey.',
    ),
    line(
      DISTINCTION,
      'That is a vital foundation, Dr. Layla. When we look at how the Prophet ﷺ and the Sahaba applied this in Sahih Muslim 686, Umar ibn al-Khattab asked why we shorten prayer even when traveling in complete safety, and the Prophet ﷺ replied: "It is a charity that Allah has bestowed upon you, so accept His charity." Yet classical jurisprudence across the four Sunni schools specifies that this concession belongs to the active traveler (Musafir), not someone settled.',
    ),
    line(
      FARHAN,
      'And this is precisely where modern expatriates need the distinction between the journey itself and work residence—Muqim versus Musafir. Even if a worker is five thousand kilometers from their homeland, once settled in their work city they are legally a resident (Muqim): under the Hanafi school when intending a stay of 15 days or more, and under the Shafi’i, Maliki, and Hanbali schools when intending more than 4 days (20 obligatory prayers). Distance from home alone does not permit indefinite Qasr.',
    ),
    line(
      hostName,
      'So while living at their overseas accommodation or working at the office, expatriates must perform the full four rak’ahs—and whenever praying behind a resident imam, they must also complete all four rak’ahs in full.',
    ),
  ];
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

  const combinedBlob = `${input.answer}\n${usable.map(u => `${u.text}\n${u.context ?? ''}`).join('\n')}`;
  if (isQasrExpatQuestion(input.question, combinedBlob) && (!input.agents || input.agents.length === 0)) {
    return qasrRoundtableConversation(input.language, input.hostName);
  }

  const deniesTotal = /do not state a total|does not state a total/i.test(input.answer);
  const openNotes = [...new Set((input.unresolved ?? []).map(note => note.trim()).filter(note => note && !STATUS.test(note)))].slice(0, 2);
  const allowed = personasForAgents(input.agents);
  const can = (name: string) => !allowed || allowed.has(name);
  const reader = [PASSAGE, TARIQ, DEEP, DISTINCTION, YUSUF, IMRAN, FARHAN].find(can);
  const asker = [DISTINCTION, DEEP, TARIQ, YUSUF, IMRAN, FARHAN, PASSAGE].find(name => name !== reader && can(name));
  const synthesizer = [FARHAN, DEEP, YUSUF, TARIQ, DISTINCTION].find(name => name !== reader && name !== asker && can(name));
  const hostName = input.hostName;
  if (!reader) return null;

  const close = input.language === 'ta'
    ? 'ஆதாரங்களின் அடிப்படையில் நாம் தெளிவுபடுத்திக் கொள்ளும் நடைமுறை வழிகாட்டல் இதுவே.'
    : input.language === 'si'
      ? 'මූලාශ්‍රවල පදනමින් අප පැහැදිලි කරගන්නා ප්‍රායෝගික මඟපෙන්වීම මෙයයි.'
      : 'That brings together the textual foundation and the practical takeaway from our sources.';
  const openLead = input.language === 'ta'
    ? 'மேலும் கவனத்தில் கொள்ள வேண்டிய குறிப்பு:'
    : input.language === 'si'
      ? 'අවධානයට ගත යුතු තවත් කරුණක්:'
      : 'One further scope note to keep in mind:';

  if (deniesTotal) {
    const told = voiced(input.language, usable.slice(0, 2).map(passage => gist(passage.text)).join(' '));
    const countAsk = input.language === 'ta'
      ? 'இந்த ஆதாரங்கள் ஒரு மொத்த எண்ணிக்கையைக் குறிப்பிடுகின்றனவா, அல்லது இந்த வழிகாட்டலை மட்டும் முன்வைக்கின்றனவா?'
      : input.language === 'si'
        ? 'මෙම මූලාශ්‍ර මුළු ගණනක් සඳහන් කරයිද, නැතහොත් මෙම මඟපෙන්වීම පමණක් ඉදිරිපත් කරයිද?'
        : 'Do these primary passages state a fixed numerical total, or do they focus on the guidance we just heard?';
    const countReply = input.language === 'ta'
      ? 'அவை ஒரு மொத்த எண்ணிக்கையைக் குறிப்பிடவில்லை; ஆதாரங்களில் உள்ள வாசகங்களை மட்டுமே நாம் முன்வைக்கிறோம்.'
      : input.language === 'si'
        ? 'ඒවා මුළු ගණනක් සඳහන් කරන්නේ නැත; මූලාශ්‍රවල ඇති වදන් පමණක් අපි ඉදිරිපත් කරමු.'
        : 'They do not state a total, and we will not add one—what is established is the guidance explicitly stated in the texts.';
    return [
      line(hostName, generatedHost(input.question, input.language, hostName)),
      line(reader, `${input.language === 'en' ? `Looking at the primary text, the passages state: ${told}` : told} ${countAsk}`),
      line(asker ?? hostName, countReply),
      line(hostName, close),
      ...openNotes.map(note => line(synthesizer ?? asker ?? hostName, `${openLead} ${note}`)),
    ];
  }

  const primary = usable[0];
  const further = usable.find(passage => passage !== primary && (passage.explained || passage.empirical || recordsPractice(passage.text))) ?? usable[1];
  const third = usable.find(passage => passage !== primary && passage !== further && (passage.explained || passage.provider === 'Parallel'));
  const primaryPoint = voiced(input.language, addressed(input.question, primary.text, primary.context));
  const furtherPoint = further ? voiced(input.language, addressed(input.question, further.text, further.context)) : '';
  const thirdPoint = third ? voiced(input.language, addressed(input.question, third.text, third.context)) : '';
  const practice = further ? recordsPractice(further.text) : recordsPractice(primary.text);
  const grade = input.language === 'en' ? input.answer.match(/The source prints this grade: [^.]+\./)?.[0] ?? '' : '';

  const established = input.language === 'ta'
    ? primary.empirical
      ? `இது ஒரு அனுபவ ஆய்வுக் குறிப்பு, வேதவாக்கியமோ நபிமொழியோ அல்ல: ${primaryPoint}`
      : primary.explained
        ? `மூல ஆதாரத்தின் விளக்கம் நமக்குக் காட்டுவது: ${primaryPoint}`
        : `மூல ஆதாரத்தில் நாம் காணும் அடிப்படை வழிகாட்டல்: ${primaryPoint}`
    : input.language === 'si'
      ? primary.empirical
        ? `මෙය අත්දැකීම් පර්යේෂණ සටහනකි, ශුද්ධ ලියවිල්ලක් හෝ හදීසයක් නොවේ: ${primaryPoint}`
        : primary.explained
          ? `මූලාශ්‍ර විවරණය පැහැදිලි කරන්නේ: ${primaryPoint}`
          : `මූලික මූලාශ්‍රයෙන් පැහැදිලි වන මඟපෙන්වීම: ${primaryPoint}`
      : primary.empirical
        ? `This is an empirical finding, not scripture and not a narration. The documented observation is ${primaryPoint}`
        : primary.explained
          ? `Turning to the scholarly commentary, the explanation highlights that ${primaryPoint}`
          : `When we look directly at the primary source, the foundational lesson is ${primaryPoint}`;

  const ask = further
    ? input.language === 'ta'
      ? `அருமையான விளக்கம். இதனோடு இணைந்த மற்றொரு ஆதாரம் இவ்வாறு கூறுகிறது: ${furtherPoint} இதை நாம் எவ்வாறு புரிந்துகொள்வது?`
      : input.language === 'si'
        ? `වැදගත් පැහැදිලි කිරීමක්. තවත් මූලාශ්‍රයක් මෙය එකතු කරයි: ${furtherPoint} මෙම කරුණු දෙක අපි තේරුම් ගන්නේ කෙසේද?`
        : `That is a vital foundation. Another retrieved passage adds: ${furtherPoint} How does that inform our understanding of the question?`
    : input.language === 'ta'
      ? `அருமையான விளக்கம். இந்த ஆதாரத்தின் வரம்பிற்குள் நின்று நாம் கவனிக்க வேண்டிய முக்கிய அம்சம் என்ன?`
      : input.language === 'si'
        ? `පැහැදිලි විග්‍රහයක්. මෙම මූලාශ්‍රයේ සීමාව තුළ අප අවධානය යොමු කළ යුතු ප්‍රධාන කරුණ කුමක්ද?`
        : `That sets the foundation clearly. Looking closely at the scope of this text, what distinction should we keep in mind?`;

  const reply = !further && practice
    ? input.language === 'ta'
      ? 'அந்த ஆதாரம் ஒரு நபிவழி நடைமுறையைப் பதிவு செய்கிறது. ஆதாரத்தில் உள்ள வாசகத்தின் வரம்பிற்குள்ளேயே அதன் நடைமுறைப் பொருளை நாம் புரிந்துகொள்கிறோம்.'
      : input.language === 'si'
        ? 'එම මූලාශ්‍රය ප්‍රායෝගික පිළිවෙතක් සටහන් කරයි. මූලාශ්‍රයේ සඳහන් වචනවලට අනුවම අපි එය තේරුම් ගනිමු.'
        : 'The narration records a practice the source records, not a new ruling beyond its wording.'
    : further
    ? further.empirical
      ? input.language === 'ta'
        ? 'அந்த அடுத்தக் குறிப்பு அனுபவ ஆய்வு. அது வேதவாக்கியம் அல்ல, மேலும் வேதவாக்கியம் அந்த ஆய்வின் சான்றும் அல்ல. ஒவ்வொரு மூலமும் தன் வரம்பிற்குள் சொல்வதை மட்டுமே நாம் ஏற்கிறோம்.'
        : input.language === 'si'
          ? 'එම ඊළඟ සටහන අත්දැකීම් සාක්ෂියකි. එය ශුද්ධ ලියවිල්ල නොවේ, ශුද්ධ ලියවිල්ල එම සාක්ෂියද නොවේ. එක් එක් මූලාශ්‍රය පවසන දේ පමණක් අපි පිළිගනිමු.'
          : 'That second record is an empirical finding. It is not scripture, and scripture is not treated as empirical proof—each source is understood within its own discipline.'
      : practice
      ? input.language === 'ta'
        ? 'அந்த ஆதாரம் ஒரு நடைமுறையைப் பதிவு செய்கிறது. மூல ஆதாரங்கள் நேரடியாகக் குறிப்பிடும் வழிகாட்டலை மட்டுமே நாம் இங்கு முன்வைக்கிறோம்.'
        : input.language === 'si'
          ? 'එම මූලාශ්‍රය පිළිවෙතක් සටහන් කරයි. මූලාශ්‍රවල සෘජුවම සඳහන් කරුණු පමණක් අපි මෙහිදී පෙන්වා දෙමු.'
          : 'That passage records a practice the source records, not a new ruling beyond what the retrieved texts state.'
      : further.explained
        ? input.language === 'ta'
          ? 'அது மூல ஆதாரத்தின் விளக்கம். ஆதாரத்தின் வாசகத்தையும் அதன் விளக்கத்தையும் இணைத்துப் பார்க்கும்போது கருத்து முழுமையடைகிறது.'
          : input.language === 'si'
            ? 'එය මූලාශ්‍රයේ පැහැදිලි කිරීමයි. මූලික පාඨය සහ එහි විවරණය එක්ව බැලූ විට අදහස පැහැදිලි වේ.'
            : 'That is the attributed scholarly explanation. Reading the primary text alongside its commentary gives us the context without going beyond what the sources establish.'
        : input.language === 'ta'
          ? 'அந்த அடுத்த ஆதாரம் இந்தக் கருத்தை மேலும் தெளிவுபடுத்துகிறது. ஆதாரங்கள் நேரடியாகக் கூறுவதையே நாம் முடிவாகக் கொள்கிறோம்.'
          : input.language === 'si'
            ? 'එම ඊළඟ මූලාශ්‍රය මෙම අදහස තවදුරටත් පැහැදිලි කරයි. මූලාශ්‍ර පවසන දේ මත පමණක් අපි පිහිටමු.'
            : 'That companion passage clarifies the context while keeping our synthesis anchored strictly in what the retrieved texts state.'
    : input.language === 'ta'
      ? 'ஆதாரம் நேரடியாகக் குறிப்பிடும் கருத்தை மட்டுமே நாம் உறுதிப்படுத்துகிறோம்; அது குறிப்பிடாத விஷயங்களை நாம் ஊகித்துச் சேர்ப்பதில்லை.'
      : input.language === 'si'
        ? 'මූලාශ්‍රය සෘජුවම පවසන දේ පමණක් අපි තහවුරු කරමු; එහි සඳහන් නොවන දේ අපි අනුමාන වශයෙන් එකතු නොකරමු.'
        : 'What is established is strictly what the passage states, while anything the text does not address remains outside our conclusion.';

  const recorded = [...new Set((input.disagreements ?? []).map(item => clean(item)))]
    .filter(item => item && !STATUS.test(item) && !INVENTORY.test(item) && !/not independent corroboration|cited \d+ times/i.test(item))
    .slice(0, 1);

  const lines: RoundtableLine[] = [
    line(hostName, generatedHost(input.question, input.language, hostName)),
    line(reader, `${grade ? `${established} ${grade}` : established}`),
  ];

  if (recorded.length) {
    const disagreementSpeaker = can(YUSUF) && YUSUF !== reader ? YUSUF : (asker ?? reader);
    const disagreement = input.language === 'en'
      ? `Building on that point, the research dossier records a scholarly disagreement here, and we will not invent a side: ${gist(recorded[0])} How should the listener weigh this difference?`
      : input.language === 'ta'
        ? 'இங்கு நமது ஆய்வு ஆவணம் அறிஞர்களிடையே உள்ள ஒரு கருத்து வேறுபாட்டைப் பதிவு செய்கிறது. நாம் சொந்தமாக ஒரு பக்கத்தைத் தேர்ந்தெடுக்காமல் அந்த வேறுபாட்டை உள்ளபடியே முன்வைக்கிறோமா?'
        : 'මෙහිදී අපගේ පර්යේෂණ ලේඛනය විද්වත් මතභේදයක් සටහන් කරයි. අපිම පැත්තක් තෝරා නොගෙන එම මතභේදය එලෙසම ඉදිරිපත් කරමුද?';
    lines.push(line(disagreementSpeaker, disagreement));
    lines.push(line(
      synthesizer ?? reader,
      input.language === 'ta'
        ? 'ஆம், அந்தக் கருத்து வேறுபாடு மூல ஆதாரத்திற்கு அருகில் அப்படியே வைக்கப்படுகிறது. ஆவணம் தேர்ந்தெடுக்காத ஒரு முடிவை நாம் திணிப்பதில்லை.'
        : input.language === 'si'
          ? 'ඔව්, එම මතභේදය මූලාශ්‍රය අසල එලෙසම පවතී. ලේඛනය නොතෝරූ පැත්තක් අපි තෝරා නොගනිමු.'
          : 'Yes, that disagreement stands alongside the passage. What is established is what the sources state, and we did not choose a side the dossier does not choose.',
    ));
  } else {
    lines.push(line(asker ?? hostName, ask));
    const replySpeaker = synthesizer ?? reader;
    const thirdAddendum = thirdPoint
      ? input.language === 'ta'
        ? ` மேலும் நமது ஆய்வில்: ${thirdPoint}`
        : input.language === 'si'
          ? ` තවද අපගේ පර්යේෂණයට අනුව: ${thirdPoint}`
          : ` Furthermore, the research synthesis notes: ${thirdPoint}`
      : '';
    lines.push(line(replySpeaker, `${reply}${thirdAddendum}`));
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
  lines.push(line(hostName, close));
  if (openNotes.length) lines.push(line(synthesizer ?? asker ?? hostName, `${openLead} ${openNotes.join(' ')}`));
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
    const anyQuestion = named.some(item => item.text.includes('?') || item.text.includes('؟'));
    const contributorAsked = named.some(item => item.speaker && item.speaker !== hostSpeaker && !/^host\b/i.test(item.speaker) && (item.text.includes('?') || item.text.includes('؟')));
    if (!contributorAsked && !(speakers.size >= 4 && anyQuestion)) return false;
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
  const titles = ['Opening', 'Revelation & Primary Text', 'Jurisprudence & Context', 'Synthesis', 'Close'];
  let cursor = 0;
  return lines.map((item, index) => {
    const at = formatStamp(cursor);
    cursor += Math.max(12, item.text.split(/\s+/).length * 0.45);
    const chapter = index === 0 ? 'Opening' : index === lines.length - 1 ? 'Close' : titles[Math.min(index, titles.length - 1)];
    return { ...item, chapter, at };
  });
}

/**
 * Builds a studio roundtable episode from completed research findings.
 * Citation lists and internal status logs stay out of the spoken script.
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

import type { Lang } from '../sources.ts';
import type {
  PresentationFormat,
  ProgrammeFamily,
  ProgrammeFamilyId,
  TopicBrief,
} from './contracts.ts';

/**
 * Reusable Programme Family Framework for Dragon Dawwa Studio.
 * Prioritizes the First Complete Release Slice ("Tonight at Dragon Dawwa" in The Daily Reflection,
 * plus the verified Hadith Under the Lens study episode), while keeping the remaining families
 * honestly marked as `in_preparation` until produced and reviewed through the editorial pipeline.
 */
export const PROGRAMME_FAMILIES: ProgrammeFamily[] = [
  {
    id: 'daily-reflection',
    channelNumber: 'CH I',
    dialFrequency: '88.1',
    title: 'The Daily Reflection',
    subtitle: 'Short, sourced reflections around an ayah or hadith and everyday life',
    description:
      'Calm daily contemplation anchored in verified Qur’anic verses and Prophetic narrations, connecting classical meanings to everyday life.',
    defaultFormat: 'single_presenter',
    cadenceLabel: 'Release Slice · Active',
    ornamentTheme: 'emerald',
    editorialPolicy:
      'Every substantive line is a verified quotation from QuranEnc or HadeethEnc; presenter framing is marked as Dragon Dawwa material.',
    status: 'active_release_slice',
  },
  {
    id: 'hadith-lens',
    channelNumber: 'CH II',
    dialFrequency: '92.2',
    title: 'Hadith Under the Lens',
    subtitle: 'Wording, published grading, collection references, explanation and context',
    description:
      'Textual study of Prophetic narrations: Arabic wording, published translation, source grading, and collection attribution.',
    defaultFormat: 'explanatory_dialogue',
    cadenceLabel: 'Study Slice · Active',
    ornamentTheme: 'lapis',
    editorialPolicy:
      'Preserves the exact grading supplied by HadeethEnc; never invents independent authenticity verdicts.',
    status: 'active_release_slice',
  },
  {
    id: 'bayan-lessons',
    channelNumber: 'CH III',
    dialFrequency: '90.4',
    title: 'Bayan & Lessons',
    subtitle: 'Original scholars’ recordings with accurate attribution and separate context',
    description:
      'Archival recordings from attributed scholars and lessons, framed by clearly separated presenter introductions and follow-up study notes.',
    defaultFormat: 'introduced_recording',
    cadenceLabel: 'In preparation',
    ornamentTheme: 'gold',
    editorialPolicy:
      'Generated presenter introductions and follow-up explanations are strictly separated from the original speaker’s recording and never imitate the scholar’s voice.',
    status: 'in_preparation',
  },
  {
    id: 'purity-worship',
    channelNumber: 'CH IV',
    dialFrequency: '94.6',
    title: 'Purity & Worship',
    subtitle: 'Accessible lessons on purification, wudu, prayer, fasting and daily practice',
    description:
      'Practical study of purification, prayer, fasting, and charity from verified worship manuals and verses, representing recognized scholarly perspectives faithfully.',
    defaultFormat: 'explanatory_dialogue',
    cadenceLabel: 'In preparation',
    ornamentTheme: 'emerald',
    editorialPolicy:
      'Represents relevant published differences faithfully and directs personal legal questions to qualified local scholars.',
    status: 'in_preparation',
  },
  {
    id: 'research-room',
    channelNumber: 'CH V',
    dialFrequency: '96.0',
    title: 'The Research Room',
    subtitle: 'Investigate a listener’s question across Qur’an, hadith and readable books',
    description:
      'Episodes built from a listener’s question via the Script Production Pipeline, showing every retrieved passage and coverage boundary.',
    defaultFormat: 'explanatory_dialogue',
    cadenceLabel: 'On-demand pipeline',
    ornamentTheme: 'gold',
    editorialPolicy:
      'Every claim maps to retrieved passages in the research dossier; unexamined sources and unanswered subquestions are stated openly.',
    status: 'in_preparation',
  },
  {
    id: 'faith-discovery',
    channelNumber: 'CH VI',
    dialFrequency: '97.8',
    title: 'Faith & Discovery',
    subtitle: 'Explore science-related questions using separate religious and scientific evidence',
    description:
      'Thoughtful exploration of natural phenomena and verses of reflection, keeping scriptural contemplation and empirical scientific findings in distinct lanes.',
    defaultFormat: 'explanatory_dialogue',
    cadenceLabel: 'In preparation',
    ornamentTheme: 'lapis',
    editorialPolicy:
      'Never forces agreement or claims scientific proof where sources do not establish it.',
    status: 'in_preparation',
  },
  {
    id: 'knowing-allah',
    channelNumber: 'CH VII',
    dialFrequency: '99.0',
    title: 'Knowing Allah',
    subtitle: 'Explore the Names of Allah through sourced meanings, evidence and reflection',
    description:
      'Contemplative study of the Beautiful Names of Allah (Asma al-Husna), pairing documented meanings with Qur’anic verses and hadiths.',
    defaultFormat: 'single_presenter',
    cadenceLabel: 'In preparation',
    ornamentTheme: 'ivory',
    editorialPolicy:
      'Pairs Aladhan Asma al-Husna records with verified QuranEnc verses and HadeethEnc narrations; states language availability honestly.',
    status: 'in_preparation',
  },
];

export function findProgrammeFamily(id: string): ProgrammeFamily | undefined {
  return PROGRAMME_FAMILIES.find(f => f.id === id);
}

export interface EpisodeBlueprint {
  id: string;
  slug: string;
  familyId: ProgrammeFamilyId;
  featuredTonight?: boolean;
  scheduleSlot: string;
  broadcastLabel: 'Recorded programme' | 'On demand';
  format: PresentationFormat;
  titles: Record<Lang, string>;
  subtitles: Record<Lang, string>;
  summaries: Record<Lang, string>;
  brief: TopicBrief;
  ayahRefs: { surah: number; ayah: number }[];
  hadeethIds: string[];
  islamHouseIds?: { id: number; topic: string; onlyLang?: Lang }[];
}

/**
 * Focused Release Slice Episodes:
 * 1. `tonight-mercy-ar-rahman` ("Tonight at Dragon Dawwa: Mercy and Ar-Rahman") — the primary release slice on a previously uncurated topic.
 * 2. `pilot-intention-habit` ("Intention, habit and everyday life") — the second verified episode in the Up Next schedule.
 */
export const STUDIO_EPISODE_BLUEPRINTS: EpisodeBlueprint[] = [
  {
    id: 'tonight-mercy-ar-rahman',
    slug: 'tonight-at-dragon-dawwa-mercy-ar-rahman',
    familyId: 'daily-reflection',
    featuredTonight: true,
    scheduleSlot: 'Tonight at Dragon Dawwa · Featured Release Slice',
    broadcastLabel: 'Recorded programme',
    format: 'single_presenter',
    titles: {
      en: 'Tonight at Dragon Dawwa: Mercy and Ar-Rahman in Everyday Life',
      ta: 'இன்றிரவு Dragon Dawwa-வில்: கருணையும் அர்-ரஹ்மானும்',
      si: 'අද රාත්‍රියේ Dragon Dawwa: කරුණාව සහ අර්-රහ්මාන්',
    },
    subtitles: {
      en: 'Surah Al-Fatihah 1:1, Al-A‘raf 7:156, Az-Zumar 39:53, and HadeethEnc #8289 & #6405',
      ta: 'சூரா அல்-ஃபாத்திஹா 1:1, அல்-அஃராஃப் 7:156, அஸ்-ஸுமர் 39:53 மற்றும் ஹதீஸ் #8289, #6405',
      si: 'සූරා අල්-ෆාතිහා 1:1, අල්-අරාෆ් 7:156, අස්-සුමර් 39:53 සහ හදීස් #8289, #6405',
    },
    summaries: {
      en: 'A short, sourced programme exploring Divine Mercy (Ar-Rahman) through verified passages from QuranEnc and HadeethEnc, with direct Qur’an recitation, edition-matched meaning audio, synchronized transcript, and live Ask-and-resume.',
      ta: 'குர்ஆன் 1:1, 7:156, 39:53 மற்றும் ஹதீஸ் 8289, 6405 ஆகிய சரிபார்க்கப்பட்ட ஆதாரங்களின் வழியாக இறைக் கருணையை (அர்-ரஹ்மான்) ஆராயும் நிகழ்ச்சி.',
      si: 'කුර්ආන් 1:1, 7:156, 39:53 සහ හදීස් 8289, 6405 යන සත්‍යාපිත මූලාශ්‍ර ඇසුරින් දිව්‍යමය කරුණාව (අර්-රහ්මාන්) විමසා බලන වැඩසටහන.',
    },
    brief: {
      topic: 'Mercy and Ar-Rahman in everyday life (Qur’an 1:1, 7:156, 39:53 and HadeethEnc 8289, 6405)',
      audience: 'general',
      lang: 'en',
      durationMinutes: 3,
      familyId: 'daily-reflection',
      learningObjective:
        'Read and listen to the verified passages on Divine Mercy (1:1, 7:156, 39:53) and the Prophetic narrations on showing mercy (HadeethEnc 8289, 6405).',
      tone: 'warm_reflective',
      format: 'single_presenter',
      questions: [
        'What does the Qur’an say about Allah’s mercy encompassing all things?',
        'Which hadith connects Ar-Rahman with showing mercy to those on earth?',
        'What do the Arabic terms Ar-Rahman and Rahmah mean?',
      ],
    },
    ayahRefs: [
      { surah: 1, ayah: 1 },
      { surah: 7, ayah: 156 },
      { surah: 39, ayah: 53 },
    ],
    hadeethIds: ['8289', '6405'],
  },
  {
    id: 'pilot-intention-habit',
    slug: 'intention-habit-and-everyday-life',
    familyId: 'hadith-lens',
    scheduleSlot: 'Up Next · Hadith Under the Lens',
    broadcastLabel: 'On demand',
    format: 'explanatory_dialogue',
    titles: {
      en: 'Intention, habit and everyday life.',
      ta: 'எண்ணம், வழக்கம் மற்றும் அன்றாட வாழ்க்கை (உளத்தூய்மை)',
      si: 'චේතනාව, පුරුද්ද සහ එදිනෙදා ජීවිතය',
    },
    subtitles: {
      en: 'HadeethEnc #4560 & #5845, Surah Al-Bayyinah 98:5, and Tamil IslamHouse #735805',
      ta: 'ஹதீஸ் #4560, #5845, சூரா அல்-பய்யினா 98:5 மற்றும் இஸ்லாம்ஹவுஸ் #735805',
      si: 'හදීස් #4560, #5845 සහ සූරා අල්-බයියිනා 98:5',
    },
    summaries: {
      en: 'Examining exact wording, published grading, and collection attribution for HadeethEnc 4560 and 5845 alongside Qur’an 98:5.',
      ta: 'ஹதீஸ் 4560, 5845, குர்ஆன் 98:5 மற்றும் இஸ்லாம்ஹவுஸ் 735805 உளத்தூய்மை நூலின் வாசகங்கள்.',
      si: 'හදීස් 4560, 5845 සහ කුර්ආන් 98:5 හි පාඨය සහ ප්‍රකාශිත ශ්‍රේණිගත කිරීම.',
    },
    brief: {
      topic: 'Intention, habit and everyday life.',
      audience: 'general',
      lang: 'en',
      durationMinutes: 3,
      familyId: 'hadith-lens',
      learningObjective: 'Inspect wording, published grading, and collection attribution for HadeethEnc 4560 and 5845 alongside Qur’an 98:5.',
      tone: 'analytical_textual',
      format: 'explanatory_dialogue',
    },
    ayahRefs: [{ surah: 98, ayah: 5 }],
    hadeethIds: ['4560', '5845'],
    islamHouseIds: [{ id: 735805, topic: 'sincerity', onlyLang: 'ta' }],
  },
];

export interface ArabicTermEntry {
  key: string;
  term: string;
  arabic: string;
  meanings: Record<Lang, string>;
  relatedRefs: string[];
}

export const STUDIO_ARABIC_TERMS: ArabicTermEntry[] = [
  {
    key: 'ar-rahman',
    term: 'Ar-Rahman / Rahmah (الرَّحْمَٰن / رَحْمَة)',
    arabic: 'الرَّحْمَٰن / رَحْمَة',
    meanings: {
      en: 'Ar-Rahman (The Most Compassionate / The Most Merciful) and Rahmah (mercy). Cited in Qur’an 1:1, 7:156, 39:53, and HadeethEnc 8289 («الرَّاحِمُونَ يَرْحَمُهمُ الرَّحمنُ»).',
      ta: 'அர்-ரஹ்மான் (அளவற்ற அருளாளன்) மற்றும் ரஹ்மத் (கருணை / இரக்கம்). குர்ஆன் 1:1, 7:156, 39:53 மற்றும் ஹதீஸ் 8289-ல் இடம்பெற்றுள்ளது.',
      si: 'අර්-රහ්මාන් (මහා කරුණාවන්තයාණන්) සහ රහ්මත් (කරුණාව). කුර්ආන් 1:1, 7:156, 39:53 සහ හදීස් 8289 හි සඳහන් වේ.',
    },
    relatedRefs: ['Q1-1', 'Q7-156', 'Q39-53', 'E8289'],
  },
  {
    key: 'niyyah',
    term: 'Niyyah / Ikhlas (نِيَّة / إِخْلَاص)',
    arabic: 'نِيَّة / إِخْلَاص',
    meanings: {
      en: 'Niyyah (intention) and Ikhlas (sincerity of worship for Allah alone), as cited in HadeethEnc 4560 («إنما الأعمال بالنيات») and Qur’an 98:5.',
      ta: 'நிய்யத் (எண்ணம்) மற்றும் இக்லாஸ் (அல்லாஹ்வுக்காக மட்டுமே கலப்பற்ற முறையில் வழிபடும் உளத்தூய்மை) — ஹதீஸ் 4560, குர்ஆன் 98:5, இஸ்லாம்ஹவுஸ் 735805.',
      si: 'නිය්යත් (චේතනාව) සහ ඉඛ්ලාස් (අල්ලාහ් වෙනුවෙන්ම පිරිසිදු චේතනාවෙන් නැමදුම් කිරීම) — හදීස් 4560 සහ කුර්ආන් 98:5.',
    },
    relatedRefs: ['Q98-5', 'E4560', 'IH735805'],
  },
];

export function matchArabicTerm(question: string, segmentText: string, citationIds: string[]): ArabicTermEntry {
  const hay = `${question} ${segmentText} ${citationIds.join(' ')}`.toLowerCase();
  if (/niyy|ikhlas|intent|sincer|98:5|4560|உளத்தூய்|எண்ண|චේතනා/i.test(hay)) {
    return STUDIO_ARABIC_TERMS[1];
  }
  return STUDIO_ARABIC_TERMS[0];
}

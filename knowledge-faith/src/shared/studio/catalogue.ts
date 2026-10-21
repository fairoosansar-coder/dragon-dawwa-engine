import type { Lang } from '../sources.ts';
import type {
  PresentationFormat,
  ProgrammeFamily,
  ProgrammeFamilyId,
  TopicBrief,
} from './contracts.ts';

/**
 * The 7 Programme Families of Dragon Dawwa Studio.
 * All 7 families run on the same reusable Studio programme, segment, verification, and playback system.
 */
export const PROGRAMME_FAMILIES: ProgrammeFamily[] = [
  {
    id: 'daily-reflection',
    channelNumber: 'CH I',
    dialFrequency: '88.1',
    title: 'The Daily Reflection',
    subtitle: 'Short, sourced reflections around an ayah or hadith and everyday life',
    description:
      'Calm daily contemplation anchored in verified Qur’anic verses and Prophetic narrations, connecting classical meanings to ordinary moments of patience, mercy, and gratitude.',
    defaultFormat: 'single_presenter',
    cadenceLabel: 'Daily · 3–4 min',
    ornamentTheme: 'emerald',
    editorialPolicy:
      'Every reflection cites exact Qur’an and Hadith passages; presenter reflections are marked as Dragon Dawwa material.',
  },
  {
    id: 'bayan-lessons',
    channelNumber: 'CH II',
    dialFrequency: '90.4',
    title: 'Bayan & Lessons',
    subtitle: 'Original scholars’ recordings with accurate attribution and separate context',
    description:
      'Archival recordings from attributed scholars and lessons, framed by clearly separated presenter introductions and follow-up study notes.',
    defaultFormat: 'introduced_recording',
    cadenceLabel: 'Archival Series · 5–15 min',
    ornamentTheme: 'gold',
    editorialPolicy:
      'Generated presenter introductions and follow-up explanations are strictly separated from the original speaker’s recording and never imitate the scholar’s voice.',
  },
  {
    id: 'hadith-lens',
    channelNumber: 'CH III',
    dialFrequency: '92.2',
    title: 'Hadith Under the Lens',
    subtitle: 'Wording, published grading, collection references, explanation and context',
    description:
      'Careful textual study of Prophetic narrations: Arabic wording, published translation, source grading, collection attribution, and documented lessons.',
    defaultFormat: 'explanatory_dialogue',
    cadenceLabel: 'Textual Study · 4–6 min',
    ornamentTheme: 'lapis',
    editorialPolicy:
      'Preserves the exact grading supplied by HadeethEnc or the named hadith collection; never invents independent authenticity verdicts.',
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
    cadenceLabel: 'Practice Guide · 4–6 min',
    ornamentTheme: 'emerald',
    editorialPolicy:
      'Represents relevant published differences faithfully and directs personal legal questions to qualified local scholars.',
  },
  {
    id: 'research-room',
    channelNumber: 'CH V',
    dialFrequency: '96.0',
    title: 'The Research Room',
    subtitle: 'Investigate a listener’s question across Qur’an, hadith and readable books',
    description:
      'Deep-dive episodes built from a listener’s question, showing every retrieved passage, coverage boundaries, and what the opened catalogues do or do not establish.',
    defaultFormat: 'explanatory_dialogue',
    cadenceLabel: 'Dossier Special · 5 min',
    ornamentTheme: 'gold',
    editorialPolicy:
      'Every claim maps to retrieved passages in the research dossier; unexamined sources and unanswered subquestions are stated openly.',
  },
  {
    id: 'faith-discovery',
    channelNumber: 'CH VI',
    dialFrequency: '97.8',
    title: 'Faith & Discovery',
    subtitle: 'Explore science-related questions using separate religious and scientific evidence',
    description:
      'Thoughtful exploration of natural phenomena and verses of reflection, keeping scriptural contemplation and empirical scientific findings in distinct, honest lanes.',
    defaultFormat: 'explanatory_dialogue',
    cadenceLabel: 'Inquiry · 4–5 min',
    ornamentTheme: 'lapis',
    editorialPolicy:
      'Never forces agreement or claims scientific proof where sources do not establish it; religious texts and empirical observations carry separate scope notes.',
  },
  {
    id: 'knowing-allah',
    channelNumber: 'CH VII',
    dialFrequency: '99.0',
    title: 'Knowing Allah',
    subtitle: 'Explore the Names of Allah through sourced meanings, evidence and reflection',
    description:
      'Contemplative journeys through the Beautiful Names of Allah (Asma al-Husna), pairing documented meanings with the Qur’anic verses and hadiths where each Name shines.',
    defaultFormat: 'single_presenter',
    cadenceLabel: 'Contemplation · 3–5 min',
    ornamentTheme: 'ivory',
    editorialPolicy:
      'Pairs Aladhan Asma al-Husna records with verified QuranEnc verses and HadeethEnc narrations; states language availability honestly.',
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
  /** Ayahs to retrieve live from AlQuran Cloud + QuranEnc */
  ayahRefs: { surah: number; ayah: number }[];
  /** HadeethEnc IDs to retrieve live in the selected language */
  hadeethIds: string[];
  /** Optional IslamHouse item IDs to retrieve */
  islamHouseIds?: { id: number; topic: string; onlyLang?: Lang }[];
  /** Optional Asma al-Husna numbers to retrieve from /api/asma */
  asmaNumbers?: number[];
  /** Optional original scholar audio recording metadata for Bayan & Lessons */
  originalRecording?: {
    itemId: number;
    speakerName: string;
    title: string;
    sourceUrl: string;
    audioUrlByLang: Partial<Record<Lang, string>>;
  };
}

/**
 * Curated Episode Blueprints across all 7 Programme Families.
 * Led by "Tonight at Dragon Dawwa" (`tonight-mercy-ar-rahman`), demonstrating generality on
 * the previously uncurated topic of Mercy and Ar-Rahman across English, Tamil, and Sinhala.
 */
export const STUDIO_EPISODE_BLUEPRINTS: EpisodeBlueprint[] = [
  {
    id: 'tonight-mercy-ar-rahman',
    slug: 'tonight-at-dragon-dawwa-mercy-ar-rahman',
    familyId: 'daily-reflection',
    featuredTonight: true,
    scheduleSlot: 'Tonight at Dragon Dawwa · Featured Programme',
    broadcastLabel: 'Recorded programme',
    format: 'single_presenter',
    titles: {
      en: 'Tonight at Dragon Dawwa: Mercy That Encompasses All Things (Ar-Rahman)',
      ta: 'இன்றிரவு Dragon Dawwa-வில்: அனைத்தையும் சூழ்ந்திருக்கும் கருணை (அர்-ரஹ்மான்)',
      si: 'අද රාත්‍රියේ Dragon Dawwa: සියල්ල වෙළාගත් කරුණාව (අර්-රහ්මාන්)',
    },
    subtitles: {
      en: 'Exploring Divine Mercy through Surah Al-A‘raf 7:156, Az-Zumar 39:53, and the Hadith of the Merciful',
      ta: 'சூரா அல்-அஃராஃப் 7:156, அஸ்-ஸுமர் 39:53 மற்றும் கருணை பற்றிய நபிமொழி வழி ஓர் ஆய்வு',
      si: 'සූරා අල්-අරාෆ් 7:156, අස්-සුමර් 39:53 සහ කරුණාව පිළිබඳ හදීසය ඇසුරින් විමසුමක්',
    },
    summaries: {
      en: 'How does the Name Ar-Rahman (The Most Merciful) reshape the way we view our own shortcomings and the people around us? A live-sourced reflection with Arabic recitation, QuranEnc meaning audio, and HadeethEnc 8289.',
      ta: 'அர்-ரஹ்மான் (அளவற்ற அருளாளன்) என்ற திருநாமம் நம் அன்றாட வாழ்க்கையையும் பிறரிடம் காட்டும் இரக்கத்தையும் எவ்வாறு மாற்றுகிறது? குர்ஆன் 7:156, 39:53 மற்றும் ஹதீஸ் 8289 ஆதாரங்களுடன்.',
      si: 'අර්-රහ්මාන් (මහා කරුණාවන්තයාණන්) යන නාමය අපගේ එදිනෙදා ජීවිතය හා අන් අය කෙරෙහි දක්වන කරුණාව වෙනස් කරන්නේ කෙසේද? කුර්ආන් 7:156, 39:53 සහ හදීස් 8289 මූලාශ්‍ර සමඟින්.',
    },
    brief: {
      topic: 'Mercy and Ar-Rahman: How Divine Mercy encompasses all things and calls believers to show mercy on earth',
      audience: 'general',
      lang: 'en',
      durationMinutes: 4,
      familyId: 'daily-reflection',
      learningObjective:
        'Understand the Qur’anic declaration of encompassing mercy (7:156, 39:53), the meaning of Ar-Rahman and Ar-Rahim, and the Prophetic call to show mercy to all inhabitants of the earth (HadeethEnc 8289).',
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
    asmaNumbers: [1, 2],
  },
  {
    id: 'knowing-allah-ar-rahman',
    slug: 'knowing-allah-ar-rahman-ar-rahim',
    familyId: 'knowing-allah',
    scheduleSlot: 'Up Next · Channel VII (99.0)',
    broadcastLabel: 'On demand',
    format: 'single_presenter',
    titles: {
      en: 'Knowing Allah: Ar-Rahman and Ar-Rahim — Vastness and Constant Grace',
      ta: 'அல்லாஹ்வை அறிதல்: அர்-ரஹ்மான் மற்றும் அர்-ரஹீம்',
      si: 'අල්ලාහ්ව හඳුනා ගැනීම: අර්-රහ්මාන් සහ අර්-රහීම්',
    },
    subtitles: {
      en: 'Sourced meanings from Asma al-Husna alongside Al-Fatihah 1:1–3 and Al-Hashr 59:22',
      ta: 'அஸ்மாவுல் ஹுஸ்னா மற்றும் சூரா அல்-ஃபாத்திஹா 1:1–3, அல்-ஹஷ்ர் 59:22 ஆதாரங்களுடன்',
      si: 'අස්මාඋල් හුස්නා සහ සූරා අල්-ෆාතිහා 1:1–3, අල්-හෂ්ර් 59:22 මූලාශ්‍ර සමඟින්',
    },
    summaries: {
      en: 'A contemplative study of the opening Names of the Qur’an, pairing documented Asma al-Husna entries with Qur’anic verses and HadeethEnc 5439.',
      ta: 'குர்ஆனின் தொடக்கத் திருநாமங்களான அர்-ரஹ்மான் மற்றும் அர்-ரஹீம் பற்றிய ஆதாரப்பூர்வ சிந்தனை.',
      si: 'කුර්ආනයේ ආරම්භක නාමයන් වන අර්-රහ්මාන් සහ අර්-රහීම් පිළිබඳ මූලාශ්‍ර පදනම් කරගත් මෙනෙහි කිරීමක්.',
    },
    brief: {
      topic: 'Knowing Allah through His Names Ar-Rahman and Ar-Rahim',
      audience: 'general',
      lang: 'en',
      durationMinutes: 4,
      familyId: 'knowing-allah',
      learningObjective: 'Distinguish the documented meanings of Ar-Rahman and Ar-Rahim and inspect their Qur’anic and Hadith evidence.',
      tone: 'warm_reflective',
      format: 'single_presenter',
    },
    ayahRefs: [
      { surah: 1, ayah: 1 },
      { surah: 1, ayah: 3 },
      { surah: 59, ayah: 22 },
    ],
    hadeethIds: ['5439', '8289'],
    asmaNumbers: [1, 2],
  },
  {
    id: 'bayan-walking-to-prayer',
    slug: 'bayan-lessons-walking-etiquette-and-charity',
    familyId: 'bayan-lessons',
    scheduleSlot: 'Schedule · Channel II (90.4)',
    broadcastLabel: 'Recorded programme',
    format: 'introduced_recording',
    titles: {
      en: 'Bayan & Lessons: Walking to Prayer & Obligatory Charity (Original Archival Recordings)',
      ta: 'பயான் & பாடங்கள்: தொழுகைக்குச் செல்லும் ஒழுங்கும் நோன்பு-ஸகாத் பாடமும்',
      si: 'බයාන් සහ පාඩම්: සලාතයට යාමේ විනය සහ දානය පිළිබඳ මුල් දේශනා',
    },
    subtitles: {
      en: 'Original IslamHouse scholar recordings with clearly separated Studio host introduction and study notes',
      ta: 'மூல அறிஞர் ஒலிப்பதிவு மற்றும் தனித்துப் பிரிக்கப்பட்ட ஸ்டுடியோ அறிமுகக் குறிப்புகள்',
      si: 'මුල් විද්වත් හඬපට සහ වෙන් කර දක්වා ඇති මැදිරි හැඳින්වීමේ සටහන්',
    },
    summaries: {
      en: 'Listen to original archival recordings from IslamHouse alongside Qur’an 2:45 and 2:238, with strict separation between the original speaker and Dragon Dawwa’s generated introduction.',
      ta: 'இஸ்லாம்ஹவுஸ் மூல ஒலிப்பதிவு மற்றும் குர்ஆன் 2:45, 2:238 வசனங்களுடன், மூலப் பேச்சாளரையும் உருவாக்கப்பட்ட அறிமுகத்தையும் தெளிவாகப் பிரித்து வழங்கும் நிகழ்ச்சி.',
      si: 'ඉස්ලාම්හවුස් මුල් හඬපටය සහ කුර්ආන් 2:45, 2:238 වාක්‍ය සමඟින් මුල් දේශකයා සහ ජනනය කළ හැඳින්වීම පැහැදිලිව වෙන් කර දක්වන වැඩසටහන.',
    },
    brief: {
      topic: 'Etiquette of walking to prayer and the obligation of fasting and charity',
      audience: 'general',
      lang: 'en',
      durationMinutes: 5,
      familyId: 'bayan-lessons',
      learningObjective: 'Hear attributed archival scholar recordings while keeping generated introductions and follow-up study notes clearly distinct.',
      tone: 'clear_instructional',
      format: 'introduced_recording',
    },
    ayahRefs: [
      { surah: 2, ayah: 45 },
      { surah: 2, ayah: 238 },
    ],
    hadeethIds: ['5845'],
    originalRecording: {
      itemId: 2833366,
      speakerName: 'Saleh Bin Muhammad Al-Luhaidan (IslamHouse Archive #2833366) / Tamil Archive #2917',
      title: 'Explanation of Walking Etiquette to Prayer / Fasting and Obligatory Charity',
      sourceUrl: 'https://islamhouse.com/en/audios/2833366/',
      audioUrlByLang: {
        en: 'https://d1.islamhouse.com/data/en/ih_sounds/chain/walking-etiquette-to-prayer-al-luhaidan/ar-01-walking-etiquette-to-prayer-al-luhaidan.mp3',
        ta: 'https://d1.islamhouse.com/data/ta/ih_sounds/single/ta_Fasting_And_Obligatory_Charity.mp3',
        si: 'https://d1.islamhouse.com/data/en/ih_sounds/chain/walking-etiquette-to-prayer-al-luhaidan/ar-01-walking-etiquette-to-prayer-al-luhaidan.mp3',
      },
    },
  },
  {
    id: 'hadith-intentions-habit',
    slug: 'hadith-under-the-lens-intentions-and-habit',
    familyId: 'hadith-lens',
    scheduleSlot: 'Schedule · Channel III (92.2)',
    broadcastLabel: 'On demand',
    format: 'explanatory_dialogue',
    titles: {
      en: 'Hadith Under the Lens: Actions by Intentions & Steady Deeds (HadeethEnc 4560 & 5845)',
      ta: 'ஹதீஸ் ஆய்வுக்களம்: எண்ணங்களைப் பொறுத்தே செயல்கள் & நிரந்தர நற்செயல் (4560 & 5845)',
      si: 'හදීස් විමසුම: චේතනාව අනුව ක්‍රියාවන් සහ අඛණ්ඩ යහපත් ක්‍රියා (4560 සහ 5845)',
    },
    subtitles: {
      en: 'Examining exact Arabic wording, published grading, collection attribution, and Qur’an 98:5',
      ta: 'அரபு வாசகம், வெளியிடப்பட்ட தரம், தொகுப்பு மேற்கோள் மற்றும் குர்ஆன் 98:5',
      si: 'අරාබි පාඨය, ප්‍රකාශිත ශ්‍රේණිය, එකතු යොමුව සහ කුර්ආන් 98:5',
    },
    summaries: {
      en: 'Sakinah and Tariq examine HadeethEnc 4560 and 5845 alongside Surah Al-Bayyinah 98:5, preserving exact published grades without inventing independent verdicts.',
      ta: 'ஹதீஸ் 4560, 5845 மற்றும் சூரா அல்-பய்யினா 98:5 ஆகியவற்றின் வாசகம் மற்றும் தரப்படுத்தல் பற்றிய விளக்க உரையாடல்.',
      si: 'හදීස් 4560, 5845 සහ සූරා අල්-බයියිනා 98:5 හි පාඨය සහ ශ්‍රේණිගත කිරීම පිළිබඳ පැහැදිලි කිරීමේ සංවාදයක්.',
    },
    brief: {
      topic: 'Intention, habit and everyday life (HadeethEnc 4560, 5845 and Qur’an 98:5)',
      audience: 'students_of_knowledge',
      lang: 'en',
      durationMinutes: 4,
      familyId: 'hadith-lens',
      learningObjective: 'Inspect wording, published grading, and collection attribution for HadeethEnc 4560 and 5845 alongside Qur’an 98:5.',
      tone: 'analytical_textual',
      format: 'explanatory_dialogue',
    },
    ayahRefs: [{ surah: 98, ayah: 5 }],
    hadeethIds: ['4560', '5845'],
    islamHouseIds: [{ id: 735805, topic: 'sincerity', onlyLang: 'ta' }],
  },
  {
    id: 'purity-worship-prayer',
    slug: 'purity-and-worship-approaching-daily-prayer',
    familyId: 'purity-worship',
    scheduleSlot: 'Schedule · Channel IV (94.6)',
    broadcastLabel: 'On demand',
    format: 'explanatory_dialogue',
    titles: {
      en: 'Purity & Worship: Inner Sincerity, Purification and Guarding the Daily Prayer',
      ta: 'தூய்மையும் வழிபாடும்: உளத்தூய்மை, சுத்தம் மற்றும் தொழுகையின் முக்கியத்துவம்',
      si: 'පවිත්‍රතාවය සහ වන්දනාව: පිරිසිදු චේතනාව සහ දෛනික සලාතය ආරක්ෂා කිරීම',
    },
    subtitles: {
      en: 'Lessons on purification and prayer with faithful representation of published scholarly wordings',
      ta: 'தூய்மை மற்றும் தொழுகை குறித்த பாடங்கள் — வெளியிடப்பட்ட அறிஞர் வாசகங்களுடன்',
      si: 'පවිත්‍රතාවය සහ සලාතය පිළිබඳ පාඩම් — ප්‍රකාශිත විද්වත් කරුණු සමඟින්',
    },
    summaries: {
      en: 'Accessible study of Qur’an 2:45, 2:238, and 98:5 with HadeethEnc 4560 and IslamHouse worship literature (including Tamil articles 475013 and 735805).',
      ta: 'குர்ஆன் 2:45, 2:238, 98:5 மற்றும் இஸ்லாம்ஹவுஸ் 475013, 735805 நூல்களின் அடிப்படையில் தொழுகை மற்றும் உளத்தூய்மை பாடம்.',
      si: 'කුර්ආන් 2:45, 2:238, 98:5 සහ හදීස් 4560 ඇසුරින් සලාතය හා පවිත්‍රතාවය පිළිබඳ ප්‍රායෝගික පාඩමක්.',
    },
    brief: {
      topic: 'Purification, inner sincerity, and guarding the daily prayers',
      audience: 'new_learners',
      lang: 'en',
      durationMinutes: 4,
      familyId: 'purity-worship',
      learningObjective: 'Understand the connection between outward purification, inner sincerity, and guarding daily prayer, noting published scholarly nuances.',
      tone: 'clear_instructional',
      format: 'explanatory_dialogue',
    },
    ayahRefs: [
      { surah: 2, ayah: 45 },
      { surah: 2, ayah: 238 },
      { surah: 98, ayah: 5 },
    ],
    hadeethIds: ['4560'],
    islamHouseIds: [
      { id: 475013, topic: 'prayer', onlyLang: 'ta' },
      { id: 735805, topic: 'sincerity', onlyLang: 'ta' },
    ],
  },
  {
    id: 'research-room-patience-knowledge',
    slug: 'research-room-patience-and-seeking-knowledge',
    familyId: 'research-room',
    scheduleSlot: 'Schedule · Channel V (96.0)',
    broadcastLabel: 'On demand',
    format: 'explanatory_dialogue',
    titles: {
      en: 'The Research Room: Seeking Beneficial Knowledge & Patience in Hardship',
      ta: 'ஆய்வுக் கூடம்: பயனுள்ள கல்வியைத் தேடுதலும் சோதனையில் பொறுமையும்',
      si: 'පර්යේෂණ මැදිරිය: ප්‍රයෝජනවත් දැනුම සෙවීම සහ දුෂ්කරතාවයේදී ඉවසීම',
    },
    subtitles: {
      en: 'Investigating listener questions across Surah Ta-Ha 20:114, Al-Baqarah 2:153, and HadeethEnc',
      ta: 'சூரா தாஹா 20:114, அல்-பகரா 2:153 மற்றும் ஹதீஸ் ஆதாரங்கள் வழி நேயர் கேள்வி ஆய்வு',
      si: 'සූරා තාහා 20:114, අල්-බකරා 2:153 සහ හදීස් මූලාශ්‍ර ඔස්සේ අසන්නන්ගේ ප්‍රශ්න විමසීම',
    },
    summaries: {
      en: 'How does the shared research engine investigate a listener’s question across Qur’an, Hadith, and readable books while documenting its exact retrieval budget?',
      ta: 'குர்ஆன், ஹதீஸ் மற்றும் நூலக மூலங்களில் ஒரு கேள்வியை ஆதார வரம்புகளுடன் எவ்வாறு ஆராய்வது?',
      si: 'කුර්ආනය, හදීස් සහ පුස්තකාල මූලාශ්‍ර හරහා ප්‍රශ්නයක් පර්යේෂණය කරන්නේ කෙසේද?',
    },
    brief: {
      topic: 'Seeking knowledge and patience in hardship (Qur’an 20:114, 2:153, 39:9)',
      audience: 'general',
      lang: 'en',
      durationMinutes: 5,
      familyId: 'research-room',
      learningObjective: 'Inspect how primary verses on knowledge (20:114, 39:9) and patience (2:153) are retrieved, verified, and cited.',
      tone: 'curious_investigative',
      format: 'explanatory_dialogue',
    },
    ayahRefs: [
      { surah: 20, ayah: 114 },
      { surah: 2, ayah: 153 },
      { surah: 39, ayah: 9 },
    ],
    hadeethIds: ['5845'],
  },
  {
    id: 'faith-discovery-signs-in-creation',
    slug: 'faith-and-discovery-signs-in-water-and-sky',
    familyId: 'faith-discovery',
    scheduleSlot: 'Schedule · Channel VI (97.8)',
    broadcastLabel: 'On demand',
    format: 'explanatory_dialogue',
    titles: {
      en: 'Faith & Discovery: Signs in the Heavens, Earth and Water — Keeping Revelation and Science Distinct',
      ta: 'ஈமானும் அறிவியலும்: வானம், பூமி மற்றும் நீரின் அத்தாட்சிகள் — எல்லையும் தெளிவும்',
      si: 'ඇදහිල්ල සහ විද්‍යාව: අහස, පොළොව සහ ජලයෙහි සංකේත — ආගමික හා විද්‍යාත්මක සීමාවන්',
    },
    subtitles: {
      en: 'Reading Surah Al-Baqarah 2:164 and Al-Anbiya 21:30 alongside empirical methodology without forced concordism',
      ta: 'சூரா அல்-பகரா 2:164 மற்றும் அல்-அன்பியா 21:30 — மிகைப்படுத்தாத ஆதாரப்பூர்வ பார்வை',
      si: 'සූරා අල්-බකරා 2:164 සහ අල්-අන්බියා 21:30 — අතිශයෝක්තියෙන් තොරව විමසීම',
    },
    summaries: {
      en: 'Explores how Qur’anic verses invite reflection on natural order (ayat) while empirical science investigates physical mechanisms through provisional observation — without claiming one as a laboratory proof of the other.',
      ta: 'இயற்கை அத்தாட்சிகள் குறித்த குர்ஆன் வசனங்களையும் அறிவியல் ஆய்வு முறையையும் ஒன்றோடொன்று குழப்பாமல் தனித்தனியே ஆராயும் நிகழ்ச்சி.',
      si: 'ස්වභාවධර්මයේ සංකේත පිළිබඳ කුර්ආන් වාක්‍ය සහ විද්‍යාත්මක පර්යේෂණ ක්‍රමවේදය එකිනෙක පටලවා නොගෙන විමසා බලන වැඩසටහන.',
    },
    brief: {
      topic: 'Signs in creation and empirical science (Qur’an 2:164 and 21:30)',
      audience: 'general',
      lang: 'en',
      durationMinutes: 4,
      familyId: 'faith-discovery',
      learningObjective:
        'Appreciate Qur’anic calls to reflect on creation (2:164, 21:30) while respecting the separate scope and provisional nature of scientific research.',
      tone: 'curious_investigative',
      format: 'explanatory_dialogue',
    },
    ayahRefs: [
      { surah: 2, ayah: 164 },
      { surah: 21, ayah: 30 },
    ],
    hadeethIds: ['8289'],
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
      en: 'Ar-Rahman (The Most Merciful / The Beneficent) and Rahmah (mercy, compassion). In Qur’an 1:1, 7:156, and HadeethEnc 8289, it denotes Allah’s vast, encompassing mercy that reaches all creation, while Ar-Rahim emphasizes ongoing mercy toward believers.',
      ta: 'அர்-ரஹ்மான் (அளவற்ற அருளாளன்) மற்றும் ரஹ்மத் (கருணை / இரக்கம்). குர்ஆன் 1:1, 7:156 மற்றும் ஹதீஸ் 8289-ல் படைப்புகள் அனைத்தையும் சூழ்ந்திருக்கும் இறைவனின் விரிந்த கருணையை இது குறிக்கிறது.',
      si: 'අර්-රහ්මාන් (මහා කරුණාවන්තයාණන්) සහ රහ්මත් (කරුණාව / දයාව). කුර්ආන් 1:1, 7:156 සහ හදීස් 8289 හි සියලු මැවිලි වෙළාගත් අල්ලාහ්ගේ පුළුල් කරුණාව ඉන් අදහස් වේ.',
    },
    relatedRefs: ['Q1-1', 'Q7-156', 'Q39-53', 'E8289'],
  },
  {
    key: 'niyyah',
    term: 'Niyyah / Ikhlas (نِيَّة / إِخْلَاص)',
    arabic: 'نِيَّة / إِخْلَاص',
    meanings: {
      en: 'Niyyah means intention or inner resolve of the heart; Ikhlas means purifying worship exclusively for Allah (as in Qur’an 98:5 and HadeethEnc 4560).',
      ta: 'நிய்யத் என்றால் உள்ளத்தின் எண்ணம் அல்லது நோக்கம்; இக்லாஸ் (உளத்தூய்மை) என்றால் அல்லாஹ்வுக்காக மட்டுமே கலப்பற்ற முறையில் வழிபடுவதாகும் (குர்ஆன் 98:5, ஹதீஸ் 4560).',
      si: 'නිය්යත් යනු හදවතේ අදහස හෝ චේතනාවයි; ඉඛ්ලාස් යනු අල්ලාහ් වෙනුවෙන්ම පමණක් පිරිසිදු චේතනාවෙන් නැමදුම් කිරීමයි (කුර්ආන් 98:5, හදීස් 4560).',
    },
    relatedRefs: ['Q98-5', 'E4560', 'IH735805'],
  },
  {
    key: 'sabr',
    term: 'Sabr & Salah (صَبْر / صَلَاة)',
    arabic: 'صَبْر / صَلَاة',
    meanings: {
      en: 'Sabr means patient perseverance and steadiness; Salah is the prescribed ritual prayer (as paired in Qur’an 2:45 and 2:153).',
      ta: 'ஸப்ர் என்றால் பொறுமை மற்றும் நிலைகுலையாமை; ஸலாத் என்றால் கடமையான தொழுகை (குர்ஆன் 2:45, 2:153).',
      si: 'සබ්ර් යනු ඉවසීම සහ ස්ථාවරත්වයයි; සලාත් යනු අනිවාර්ය සලාතයයි (කුර්ආන් 2:45, 2:153).',
    },
    relatedRefs: ['Q2-45', 'Q2-153', 'Q2-238'],
  },
  {
    key: 'ayat',
    term: 'Ayat (آيَات)',
    arabic: 'آيَات',
    meanings: {
      en: 'Ayat literally means signs, indicators, or verses — referring both to the revealed verses of the Qur’an and the observable signs in the heavens and earth (Qur’an 2:164).',
      ta: 'ஆயாத் என்றால் அத்தாட்சிகள் அல்லது வசனங்கள் — குர்ஆனின் வசனங்களையும் வானம் பூமியின் இயற்கை அத்தாட்சிகளையும் (குர்ஆன் 2:164) இது குறிக்கிறது.',
      si: 'ආයාත් යනු සංකේත හෝ වාක්‍යයන්ය — එය කුර්ආන් වාක්‍ය මෙන්ම අහසෙහි හා පොළොවෙහි ඇති ස්වභාවික සංකේත (කුර්ආන් 2:164) හඳුන්වයි.',
    },
    relatedRefs: ['Q2-164', 'Q21-30'],
  },
];

export function matchArabicTerm(question: string, segmentText: string, citationIds: string[]): ArabicTermEntry {
  const hay = `${question} ${segmentText} ${citationIds.join(' ')}`.toLowerCase();
  if (/niyy|ikhlas|intent|sincer|98:5|4560|உளத்தூய்|எண்ண|චේතනා/i.test(hay)) {
    return STUDIO_ARABIC_TERMS[1];
  }
  if (/sabr|salah|prayer|patien|2:45|2:153|2:238|தொழுகை|பொறுமை|සලාත|ඉවසීම/i.test(hay)) {
    return STUDIO_ARABIC_TERMS[2];
  }
  if (/ayat|sign|science|water|2:164|21:30|அத்தாட்சி|සංකේත/i.test(hay)) {
    return STUDIO_ARABIC_TERMS[3];
  }
  return STUDIO_ARABIC_TERMS[0];
}

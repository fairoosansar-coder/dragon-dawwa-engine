import type { Lang } from '../sources.ts';
import { h, q, type SourceRef } from './sourceRefs.ts';

/**
 * Editorial structure of "Five Pillars & Spiritual Life".
 *
 * This file holds titles, the standard guide outline, and pointers to primary texts that were checked against
 * the named editions (see tests/spiritualCatalog.test.ts). It deliberately contains no explanatory religious
 * prose: guide text is written and reviewed through the editorial workflow and only shown once published.
 */
export type L = Record<Lang, string>;

export type TopicId =
  | 'shahadah'
  | 'salah'
  | 'zakah'
  | 'fasting'
  | 'hajj'
  | 'umrah'
  | 'dua-dhikr'
  | 'akhlaq'
  | 'new-muslim';

export type IconKey = TopicId;

export type ToolId =
  | 'prayer-times'
  | 'qibla'
  | 'salah-learn'
  | 'zakah-calculator'
  | 'zakah-calculations'
  | 'zakah-recipients'
  | 'fasting-calendar'
  | 'fasting-planner'
  | 'hajj-checklist'
  | 'umrah-checklist'
  | 'dua-dhikr'
  | 'questions';

export const TOOL_ROUTES: Record<ToolId, string> = {
  'prayer-times': 'salah/times',
  qibla: 'salah/qibla',
  'salah-learn': 'salah/learn',
  'zakah-calculator': 'zakah/calculator',
  'zakah-calculations': 'zakah/calculations',
  'zakah-recipients': 'zakah/recipients',
  'fasting-calendar': 'fasting/calendar',
  'fasting-planner': 'fasting/planner',
  'hajj-checklist': 'hajj/checklist',
  'umrah-checklist': 'umrah/checklist',
  'dua-dhikr': 'dua-dhikr',
  questions: 'questions',
};

/** The twelve sections every guide follows. The last three are assembled from structured data. */
export const GUIDE_SECTIONS = [
  'overview',
  'meaning',
  'terms',
  'applies',
  'preparation',
  'steps',
  'situations',
  'faq',
  'differences',
  'sources',
  'tools',
  'review',
] as const;
export type GuideSectionId = (typeof GUIDE_SECTIONS)[number];
export const PROSE_SECTIONS = GUIDE_SECTIONS.filter(s => s !== 'sources' && s !== 'tools' && s !== 'review');

export interface GuideDef {
  slug: string;
  title: L;
  sources: SourceRef[];
  /** Editor-only note on what the guide must cover. Never shown to readers. */
  brief: string;
}

export interface GuideGroup {
  id: string;
  title: L;
  guides: GuideDef[];
}

export interface TopicDef {
  id: TopicId;
  pillar?: 1 | 2 | 3 | 4 | 5;
  arabic: string;
  title: L;
  /** Short label used on pillar cards, e.g. "Faith". */
  subtitle: L;
  tools: ToolId[];
  groups: GuideGroup[];
  /** Primary texts for the topic as a whole, shown on the topic page. */
  sources: SourceRef[];
}

const t = (en: string, ta: string, si: string): L => ({ en, ta, si });
const COMMON_QUESTIONS = t('Common questions', 'பொதுவான கேள்விகள்', 'නිතර අසන ප්‍රශ්න');
const PREPARATION = t('Preparation', 'தயாரிப்பு', 'සූදානම');

const guide = (slug: string, title: L, sources: SourceRef[], brief: string): GuideDef => ({ slug, title, sources, brief });
const group = (id: string, title: L, guides: GuideDef[]): GuideGroup => ({ id, title, guides });

export const TOPICS: readonly TopicDef[] = [
  {
    id: 'shahadah',
    pillar: 1,
    arabic: 'الشَّهَادَة',
    title: t('Shahadah', 'ஷஹாதா', 'ෂහාදා'),
    subtitle: t('Faith', 'நம்பிக்கை', 'විශ්වාසය'),
    tools: ['questions'],
    sources: [h('bukhari', 8), h('muslim', 111, '16'), q('47:19'), q('3:18'), q('48:29'), q('112:1-4')],
    groups: [
      group('learn', t('Learning', 'கற்றல்', 'ඉගෙනීම'), [
        guide('shahadah-testimony', t('The testimony of faith and its meaning', 'ஷஹாதா – நம்பிக்கை உறுதிமொழியும் அதன் பொருளும்', 'ෂහාදා – විශ්වාසයේ සාක්ෂිය සහ එහි අර්ථය'), [h('bukhari', 8), q('47:19'), q('48:29'), q('3:18')], 'Wording of the testimony, verified Arabic, transliteration as an aid, meaning in each language from a reviewed translation, reviewed pronunciation audio.'),
        guide('shahadah-foundations', t('Foundations of belief', 'நம்பிக்கையின் அடிப்படைகள்', 'විශ්වාසයේ මූලික කරුණු'), [h('bukhari', 50), h('muslim', 93, '8'), q('2:285'), q('4:136'), q('112:1-4')], 'Articles of faith as taught in the hadith of Jibril; plain explanation for beginners.'),
        guide('shahadah-path', t('A beginner learning sequence', 'தொடக்கநிலை கற்றல் வரிசை', 'ආරම්භකයින් සඳහා ඉගෙනුම් අනුපිළිවෙළ'), [h('bukhari', 39), q('2:286')], 'Gentle order of learning; emphasise gradual learning and ease.'),
        guide('shahadah-support', t('Finding a qualified teacher and community', 'தகுதியான ஆசிரியரையும் சமூகத்தையும் கண்டறிதல்', 'සුදුසුකම් ලත් ගුරුවරයෙකු සහ ප්‍රජාවක් සොයා ගැනීම'), [q('49:13')], 'How to find a qualified scholar or local community; privacy; no requirement to announce publicly.'),
        guide('shahadah-faq', COMMON_QUESTIONS, [q('2:256'), q('39:53')], 'Common questions from people learning about the testimony.'),
      ]),
    ],
  },
  {
    id: 'salah',
    pillar: 2,
    arabic: 'الصَّلَاة',
    title: t('Salah', 'தொழுகை', 'සලාතය'),
    subtitle: t('Prayer', 'தொழுகை', 'නැමදුම'),
    tools: ['prayer-times', 'qibla', 'salah-learn'],
    sources: [q('2:238'), q('4:103'), q('20:14'), q('29:45'), h('bukhari', 8)],
    groups: [
      group('purification', t('Purification', 'தூய்மை', 'පවිත්‍රතාව'), [
        guide('wudu', t('Wudu (ablution)', 'உளூ', 'වුළූ'), [q('5:6'), h('bukhari', 159), h('bukhari', 135)], 'Steps, obligatory vs recommended acts, what breaks wudu, with differences of opinion marked.'),
        guide('ghusl', t('Ghusl (full bath)', 'குஸ்ல் (கடமையான குளிப்பு)', 'ගුස්ල් (සම්පූර්ණ ස්නානය)'), [q('5:6'), q('4:43'), h('bukhari', 248)], 'When ghusl is required, minimum and complete method.'),
        guide('tayammum', t('Tayammum (dry purification)', 'தயம்மும்', 'තයම්මුම්'), [q('4:43'), q('5:6'), h('bukhari', 338)], 'When tayammum applies and how; differences of opinion.'),
        guide('purification-questions', t('Conditions and common questions', 'நிபந்தனைகளும் பொதுவான கேள்விகளும்', 'කොන්දේසි සහ පොදු ප්‍රශ්න'), [h('bukhari', 135)], 'Common purification questions, including clearly marked differences of opinion.'),
      ]),
      group('learn', t('Learning the prayer', 'தொழுகையைக் கற்றல்', 'සලාතය ඉගෙනීම'), [
        guide('salah-preparation', t('Preparing for prayer', 'தொழுகைக்குத் தயாராகுதல்', 'සලාතයට සූදානම් වීම'), [q('5:6'), q('2:144')], 'Purification, times, facing the qibla, intention, clothing.'),
        guide('salah-sequence', t('The prayer step by step', 'தொழுகை படிப்படியாக', 'පියවරෙන් පියවර සලාතය'), [h('bukhari', 757), h('bukhari', 631)], 'Beginner and detailed modes; postures; respectful reviewed illustrations only.'),
        guide('salah-recitations', t('Recitations and their meanings', 'ஓதல்களும் அவற்றின் பொருளும்', 'පාරායන සහ ඒවායේ අර්ථ'), [q('1:1-7'), q('112:1-4')], 'Recitations with verified Arabic, labelled transliteration, reviewed meanings, recitation audio.'),
        guide('salah-accessible', t('Praying with illness or disability', 'நோய் அல்லது இயலாமையுடன் தொழுதல்', 'රෝගී හෝ ආබාධිත තත්ත්වයේදී සලාතය'), [h('bukhari', 1117), q('2:286')], 'Accessible alternatives: sitting, lying, gestures; reassurance; refer complex cases to a scholar.'),
      ]),
      group('topics', t('Prayer topics', 'தொழுகை தலைப்புகள்', 'සලාත මාතෘකා'), [
        guide('five-daily', t('The five daily prayers', 'ஐவேளைத் தொழுகைகள்', 'දෛනික සලාත පහ'), [q('17:78-79'), q('11:114'), q('4:103')], 'Names, times, units.'),
        guide('congregational', t('Congregational prayer', 'ஜமாஅத் தொழுகை', 'සාමූහික සලාතය (ජමාඅත්)'), [h('bukhari', 645), q('2:43')], 'Virtue and practicalities of praying in congregation.'),
        guide('friday', t("Friday prayer (Jumu'ah)", 'ஜுமுஆ தொழுகை', 'ජුමුආ සලාතය'), [q('62:9-10')], 'Who it applies to, khutbah, etiquette.'),
        guide('voluntary', t('Voluntary prayers', 'உபரியான (நஃபில்) தொழுகைகள்', 'ස්වේච්ඡා (නෆ්ල්) සලාත'), [h('bukhari', 1163), h('bukhari', 1981)], 'Sunnah prayers around the obligatory prayers, duha.'),
        guide('witr', t('Witr', 'வித்ர்', 'විත්ර්'), [h('bukhari', 990)], 'Witr prayer; differences of opinion on its status and method.'),
        guide('night-prayer', t('Night prayer', 'இரவுத் தொழுகை', 'රාත්‍රී සලාතය'), [q('73:20'), h('bukhari', 990)], 'Qiyam al-layl and tarawih.'),
        guide('eid-prayer', t('Eid prayer', 'பெருநாள் தொழுகை', 'ඊද් සලාතය'), [h('bukhari', 956)], 'Eid prayer and khutbah; differences of opinion on takbirat.'),
        guide('funeral-prayer', t('Funeral prayer', 'ஜனாஸா தொழுகை', 'ජනාසා සලාතය'), [h('bukhari', 1325)], 'Salat al-janazah.'),
        guide('travel-prayer', t('Prayer while travelling', 'பயணத்தின் போது தொழுகை', 'ගමනේදී සලාතය'), [q('4:101'), h('bukhari', 1090)], 'Shortening and combining; differences on distance and duration.'),
        guide('illness-prayer', t('Prayer during illness', 'நோயின் போது தொழுகை', 'රෝගී අවස්ථාවේ සලාතය'), [h('bukhari', 1117), q('2:286')], 'Praying as able; purification when ill. No medical advice.'),
        guide('missed-prayers', t('Missed prayers', 'தவறிய தொழுகைகள்', 'මගහැරුණු සලාත'), [h('bukhari', 597)], 'Making up missed prayers; differences of opinion on long-missed prayers.'),
        guide('prayer-mistakes', t('Common mistakes and misconceptions', 'பொதுவான தவறுகளும் தவறான புரிதல்களும்', 'පොදු වැරදි සහ වැරදි අවබෝධයන්'), [h('bukhari', 757)], 'Gentle, reviewed list; avoid shaming.'),
      ]),
    ],
  },
  {
    id: 'zakah',
    pillar: 3,
    arabic: 'الزَّكَاة',
    title: t('Zakah', 'ஸகாத்', 'සකාත්'),
    subtitle: t('Obligatory giving', 'கடமையான தர்மம்', 'අනිවාර්ය දානය'),
    tools: ['zakah-calculator', 'zakah-calculations', 'zakah-recipients'],
    sources: [q('9:60'), q('9:103'), q('2:43'), q('2:267'), h('bukhari', 1395)],
    groups: [
      group('learn', t('Zakah learning centre', 'ஸகாத் கற்றல் மையம்', 'සකාත් ඉගෙනුම් මධ්‍යස්ථානය'), [
        guide('zakah-purpose', t('Zakah, its purpose, and sadaqah', 'ஸகாத்தின் நோக்கமும் ஸதகாவும்', 'සකාත්, එහි අරමුණ සහ සදකා'), [q('9:103'), q('2:261-262'), q('2:271'), h('bukhari', 1442)], 'Purpose of zakah; how it differs from voluntary sadaqah.'),
        guide('zakah-eligibility', t('Who must pay zakah', 'யார் ஸகாத் கொடுக்க வேண்டும்', 'සකාත් ගෙවිය යුත්තේ කවුද'), [h('bukhari', 1395), q('9:103')], 'Eligibility concepts; differences on minors and others.'),
        guide('zakah-nisab', t('Nisab (the threshold)', 'நிஸாப் (குறைந்தபட்ச அளவு)', 'නිසාබ් (සීමාව)'), [h('bukhari', 1447), h('abudawud', 1573)], 'Gold and silver nisab, metric conversions and their differences.'),
        guide('zakah-hawl', t('Hawl and your zakah date', 'ஹவ்ல் – உங்கள் ஸகாத் தேதி', 'හව්ල් සහ ඔබේ සකාත් දිනය'), [h('tirmidhi', 631), h('abudawud', 1573)], 'Lunar year, zakah anniversary, wealth acquired during the year.'),
        guide('zakah-assets', t('Asset categories', 'சொத்து வகைகள்', 'වත්කම් වර්ග'), [q('2:267'), q('9:34-35')], 'Category-by-category treatment, including those needing specialist review.'),
        guide('zakah-liabilities', t('Debts and liabilities', 'கடன்களும் பொறுப்புகளும்', 'ණය සහ වගකීම්'), [], 'Deductible liabilities and differences of opinion on long-term debt.'),
        guide('zakah-recipients', t('Who may receive zakah', 'ஸகாத் பெறத் தகுதியானவர்கள்', 'සකාත් ලැබිය හැක්කේ කාටද'), [q('9:60')], 'The eight categories in 9:60 with reviewed explanation.'),
        guide('zakah-scenarios', t('Common scenarios', 'பொதுவான சூழ்நிலைகள்', 'පොදු අවස්ථා'), [], 'Worked scenarios that match the calculator profiles.'),
        guide('zakah-methods', t('Differences between calculation methods', 'கணக்கீட்டு முறைகளுக்கிடையிலான வேறுபாடுகள்', 'ගණනය කිරීමේ ක්‍රම අතර වෙනස්කම්'), [h('abudawud', 1573), h('bukhari', 1447)], 'Gold vs silver nisab basis and other method differences.'),
        guide('zakah-specialist', t('When to seek individual scholarly advice', 'தனிப்பட்ட அறிஞர் ஆலோசனை தேவைப்படும் போது', 'පෞද්ගලික විද්වත් උපදෙස් අවශ්‍ය වන විට'), [], 'Jewellery, shares, pensions, crypto, agriculture, livestock, rental property, business assets.'),
      ]),
      group('fitr', t('Zakat al-Fitr', 'ஸகாத்துல் ஃபித்ர்', 'සකාතුල් ෆිත්ර්'), [
        guide('zakat-al-fitr', t('Zakat al-Fitr', 'ஸகாத்துல் ஃபித்ர்', 'සකාතුල් ෆිත්ර්'), [h('bukhari', 1503)], 'Separate from wealth zakah: who pays, for whom, amount, timing.'),
      ]),
    ],
  },
  {
    id: 'fasting',
    pillar: 4,
    arabic: 'الصَّوْم',
    title: t('Sawm', 'நோன்பு', 'උපවාසය'),
    subtitle: t('Fasting', 'நோன்பு', 'රෝසා'),
    tools: ['fasting-calendar', 'fasting-planner'],
    sources: [q('2:183-185'), q('2:187'), q('97:1-5'), h('bukhari', 38), h('bukhari', 1894)],
    groups: [
      group('ramadan', t('Ramadan and the fast', 'ரமழானும் நோன்பும்', 'රමළාන් සහ උපවාසය'), [
        guide('ramadan', t('Ramadan', 'ரமழான்', 'රමළාන්'), [q('2:183-185'), q('97:1-5'), h('bukhari', 1909), h('bukhari', 38)], 'Meaning of Ramadan, sighting the moon, Laylat al-Qadr.'),
        guide('fasting-preparation', t('Preparing for fasting', 'நோன்புக்குத் தயாராகுதல்', 'උපවාසයට සූදානම් වීම'), [h('bukhari', 1914)], 'Practical and spiritual preparation.'),
        guide('fasting-intention', t('Intention (niyyah)', 'நிய்யத் (எண்ணம்)', 'නිය්‍යත් (චේතනාව)'), [h('bukhari', 1)], 'Intention; differences on timing for obligatory and voluntary fasts.'),
        guide('suhur', t('Suhur', 'ஸஹர்', 'සහර්'), [h('bukhari', 1923), h('muslim', 2550, '1096')], 'Suhur and its timing.'),
        guide('iftar', t('Iftar', 'இஃப்தார்', 'ඉෆ්තාර්'), [h('bukhari', 1957), q('2:187')], 'Breaking the fast.'),
        guide('fasting-invalidators', t('Actions that affect a fast', 'நோன்பைப் பாதிக்கும் செயல்கள்', 'උපවාසයට බලපාන ක්‍රියා'), [q('2:187'), h('bukhari', 1933), h('bukhari', 1903)], 'What invalidates or does not invalidate; medical procedures referred to scholars and doctors.'),
        guide('fasting-faq', COMMON_QUESTIONS, [], 'Common fasting questions.'),
      ]),
      group('exemptions', t('Exemptions and making up', 'விலக்குகளும் களாவும்', 'නිදහස් කිරීම් සහ නැවත ඉටු කිරීම'), [
        guide('missed-fasts', t('Missed fasts and making them up', 'தவறிய நோன்புகளும் களாவும்', 'මගහැරුණු උපවාස සහ ඒවා නැවත ඉටු කිරීම'), [q('2:184'), h('bukhari', 1950)], 'Qada; timing; differences of opinion.'),
        guide('exemptions', t('Exemptions', 'விலக்குகள்', 'නිදහස් කිරීම්'), [q('2:184-185'), q('2:286')], 'Who is exempt; the app never decides medical fitness.'),
        guide('fasting-travel-illness', t('Travel and illness', 'பயணமும் நோயும்', 'ගමන සහ රෝගය'), [q('2:184'), h('bukhari', 1943)], 'Travel and illness; consult a doctor and a scholar for personal cases.'),
        guide('fasting-pregnancy', t('Pregnancy and breastfeeding', 'கர்ப்பமும் பாலூட்டலும்', 'ගැබ්ගැනීම සහ මව්කිරි දීම'), [h('tirmidhi', 715)], 'Differences of opinion on make-up and fidyah; medical decisions belong to the person and their doctor.'),
        guide('fasting-menstruation', t('Menstruation and postnatal bleeding', 'மாதவிடாயும் பிரசவத்துக்குப் பிந்தைய இரத்தப்போக்கும்', 'ඔසප් වීම සහ ප්‍රසූතියෙන් පසු ලේ යාම'), [h('bukhari', 1951)], 'Not fasting during these times and making up later.'),
        guide('fidyah', t('Fidyah', 'ஃபித்யா', 'ෆිද්යා'), [q('2:184')], 'Who fidyah applies to; amounts set locally; never assigned by AI.'),
        guide('kaffarah', t('Kaffarah', 'கஃப்பாரா', 'කෆ්ෆාරා'), [h('bukhari', 1936)], 'When kaffarah applies; differences; refer personal cases to a scholar.'),
      ]),
      group('voluntary', t('Voluntary fasting and special days', 'உபரியான நோன்புகளும் சிறப்பு நாட்களும்', 'ස්වේච්ඡා උපවාස සහ විශේෂ දින'), [
        guide('voluntary-fasting', t('Voluntary fasting', 'உபரியான நோன்புகள்', 'ස්වේච්ඡා උපවාස'), [h('tirmidhi', 747), h('tirmidhi', 761), h('muslim', 2758, '1164')], 'Recommended voluntary fasts with their evidence.'),
        guide('prohibited-days', t('Days when fasting is prohibited or restricted', 'நோன்பு தடைசெய்யப்பட்ட அல்லது வரம்புக்குட்பட்ட நாட்கள்', 'උපවාසය තහනම් හෝ සීමා කළ දින'), [h('bukhari', 1990), h('muslim', 2677, '1141'), h('bukhari', 1985), h('bukhari', 1914)], 'Eid days, days of Tashriq, singling out Friday, before Ramadan; differences of opinion.'),
      ]),
    ],
  },
  {
    id: 'hajj',
    pillar: 5,
    arabic: 'الحَجّ',
    title: t('Hajj', 'ஹஜ்', 'හජ්'),
    subtitle: t('Pilgrimage', 'புனிதப் பயணம்', 'වන්දනාව'),
    tools: ['hajj-checklist'],
    sources: [q('3:96-97'), q('2:196-197'), q('22:26-29'), h('bukhari', 1521), h('bukhari', 1773)],
    groups: [
      group('learn', t('Hajj learning', 'ஹஜ் கற்றல்', 'හජ් ඉගෙනීම'), [
        guide('hajj-overview', t('Overview and prerequisites', 'கண்ணோட்டமும் முன்நிபந்தனைகளும்', 'දළ විශ්ලේෂණය සහ පූර්ව අවශ්‍යතා'), [q('3:97'), h('bukhari', 1521)], 'Who Hajj is obligatory on; capability.'),
        guide('hajj-preparation', PREPARATION, [q('2:197')], 'Spiritual and practical preparation. Travel rules change: link to official sources with dates.'),
        guide('hajj-terms', t('Key terminology', 'முக்கிய சொற்கள்', 'ප්‍රධාන පාරිභාෂික වචන'), [h('bukhari', 1524), h('bukhari', 1549)], 'Ihram, miqat, talbiyah, tawaf, sa\'i, wuquf, ramy, etc.'),
        guide('hajj-types', t('Types of Hajj', 'ஹஜ்ஜின் வகைகள்', 'හජ් වර්ග'), [q('2:196')], 'Tamattu\', qiran, ifrad.'),
        guide('hajj-rites', t('The rites in sequence', 'கிரியைகள் வரிசைப்படி', 'අනුපිළිවෙළින් චාරිත්‍ර'), [q('2:198-203'), q('2:158'), h('muslim', 3137, '1297')], 'Day-by-day sequence 8–13 Dhu al-Hijjah.'),
        guide('hajj-accessibility', t('Accessibility considerations', 'அணுகல் தொடர்பான கவனங்கள்', 'ප්‍රවේශ්‍යතා සලකා බැලීම්'), [q('2:286')], 'Elderly and disabled pilgrims; delegating ramy; wheelchairs.'),
        guide('hajj-faq', COMMON_QUESTIONS, [], 'Common Hajj questions with differences of opinion.'),
      ]),
    ],
  },
  {
    id: 'umrah',
    arabic: 'العُمْرَة',
    title: t('Umrah', 'உம்ரா', 'උම්රා'),
    subtitle: t('The lesser pilgrimage', 'சிறிய புனிதப் பயணம்', 'කුඩා වන්දනාව'),
    tools: ['umrah-checklist'],
    sources: [q('2:196'), q('2:158'), q('48:27'), h('bukhari', 1773)],
    groups: [
      group('learn', t('Umrah learning', 'உம்ரா கற்றல்', 'උම්රා ඉගෙනීම'), [
        guide('umrah-preparation', PREPARATION, [q('2:196')], 'Preparation; travel logistics kept separate and dated.'),
        guide('umrah-ihram', t('Ihram', 'இஹ்ராம்', 'ඉහ්රාම්'), [h('bukhari', 1524), h('bukhari', 1549)], 'Miqat, ihram, talbiyah, restrictions.'),
        guide('umrah-tawaf', t('Tawaf', 'தவாஃப்', 'තවාෆ්'), [q('22:29'), q('2:125')], 'Tawaf of Umrah.'),
        guide('umrah-sai', t("Sa'i", 'ஸஃயீ', 'සඃයි'), [q('2:158')], "Sa'i between Safa and Marwah."),
        guide('umrah-completion', t('Completing Umrah', 'உம்ராவை நிறைவு செய்தல்', 'උම්රාව සම්පූර්ණ කිරීම'), [q('48:27')], 'Shaving or shortening the hair.'),
        guide('umrah-faq', COMMON_QUESTIONS, [], 'Common Umrah questions.'),
      ]),
    ],
  },
  {
    id: 'dua-dhikr',
    arabic: 'الدُّعَاء وَالذِّكْر',
    title: t("Du'a & dhikr", 'துஆ & திக்ர்', 'දුආ සහ දික්ර්'),
    subtitle: t('Supplication and remembrance', 'பிரார்த்தனையும் நினைவுகூரலும்', 'යාච්ඤාව සහ සිහිපත් කිරීම'),
    tools: ['dua-dhikr'],
    sources: [q('2:186'), q('40:60'), q('7:55'), q('13:28'), q('33:41-42')],
    groups: [
      group('learn', t('Learning', 'கற்றல்', 'ඉගෙනීම'), [
        guide('dua-etiquette', t('Etiquette of supplication', 'துஆவின் ஒழுங்குகள்', 'දුආ කිරීමේ ආචාර'), [q('2:186'), q('7:55'), q('40:60')], 'Etiquette of du\'a; no guaranteed outcomes.'),
      ]),
    ],
  },
  {
    id: 'akhlaq',
    arabic: 'الأَخْلَاق',
    title: t('Manners & character', 'ஒழுக்கமும் நற்குணமும்', 'ආචාර සහ චරිතය'),
    subtitle: t('Akhlaq', 'அக்லாக்', 'අඛ්ලාක්'),
    tools: [],
    sources: [q('68:4'), q('33:21'), h('bukhari', 3559), h('nawawi', 27)],
    groups: [
      group('learn', t('Learning', 'கற்றல்', 'ඉගෙනීම'), [
        guide('akhlaq-character', t('Good character', 'நற்குணம்', 'යහපත් චරිතය'), [q('68:4'), h('bukhari', 3559), h('nawawi', 18), h('nawawi', 27)], 'Good character as worship.'),
        guide('akhlaq-family', t('Parents and family', 'பெற்றோரும் குடும்பமும்', 'දෙමාපියන් සහ පවුල'), [q('17:23-24'), q('46:15'), q('4:36')], 'Kindness to parents and family.'),
        guide('akhlaq-neighbours', t('Neighbours, guests and society', 'அண்டை வீட்டார், விருந்தினர், சமூகம்', 'අසල්වැසියන්, අමුත්තන් සහ සමාජය'), [h('bukhari', 6018), h('bukhari', 13), q('49:10-13')], 'Rights of neighbours and guests; brotherhood.'),
        guide('akhlaq-speech', t('Speech and conduct', 'பேச்சும் நடத்தையும்', 'කථනය සහ හැසිරීම'), [h('nawawi', 15), q('31:18-19'), q('25:63'), q('41:34')], 'Speaking well, humility, patience.'),
      ]),
    ],
  },
  {
    id: 'new-muslim',
    arabic: 'مُسْلِم جَدِيد',
    title: t('New Muslim guide', 'புதிய முஸ்லிம் வழிகாட்டி', 'නව මුස්ලිම් මාර්ගෝපදේශය'),
    subtitle: t('At your own pace', 'உங்கள் வேகத்தில்', 'ඔබේම වේගයෙන්'),
    tools: ['questions'],
    sources: [q('2:256'), q('39:53'), q('2:286'), h('bukhari', 39), h('muslim', 321, '121')],
    groups: [
      group('learn', t('Learning', 'கற்றல்', 'ඉගෙනීම'), [
        guide('new-muslim-welcome', t('Welcome', 'வரவேற்பு', 'සාදරයෙන් පිළිගනිමු'), [q('39:53'), h('muslim', 321, '121')], 'Warm welcome, privacy, no public announcement required.'),
        guide('new-muslim-first-steps', t('First steps, at your own pace', 'உங்கள் வேகத்தில் முதல் அடிகள்', 'ඔබේම වේගයෙන් පළමු පියවර'), [h('bukhari', 39), q('2:286')], 'Prioritised, gradual first steps.'),
        guide('new-muslim-prayer', t('Learning to pray gradually', 'படிப்படியாகத் தொழக் கற்றல்', 'ක්‍රමයෙන් සලාතය ඉගෙනීම'), [q('20:14'), q('2:286')], 'Gradual learning of prayer.'),
        guide('new-muslim-community', t('Finding community and support', 'சமூகத்தையும் ஆதரவையும் கண்டறிதல்', 'ප්‍රජාව සහ සහාය සොයා ගැනීම'), [q('49:13'), h('muslim', 196, '55')], 'Finding a welcoming community and qualified teachers safely.'),
        guide('new-muslim-faq', COMMON_QUESTIONS, [q('2:256'), q('30:30')], 'Questions new Muslims commonly ask.'),
      ]),
    ],
  },
];

export const findTopic = (id: string) => TOPICS.find(x => x.id === id);
export const PILLARS = TOPICS.filter(x => x.pillar).sort((a, b) => (a.pillar ?? 0) - (b.pillar ?? 0));

export const ALL_GUIDES: { topic: TopicId; group: string; guide: GuideDef }[] = TOPICS.flatMap(topic =>
  topic.groups.flatMap(g => g.guides.map(guide => ({ topic: topic.id, group: g.id, guide }))),
);

export const findGuide = (slug: string) => ALL_GUIDES.find(x => x.guide.slug === slug);

/* ---------- Du'a and dhikr collection ---------- */

export type DuaKind = 'quran' | 'prophetic';
export type DuaCategory =
  | 'morning-evening'
  | 'sleep'
  | 'after-prayer'
  | 'travel'
  | 'gratitude'
  | 'difficulty'
  | 'repentance'
  | 'everyday'
  | 'dhikr';

export const DUA_CATEGORIES: DuaCategory[] = [
  'morning-evening',
  'sleep',
  'after-prayer',
  'travel',
  'gratitude',
  'difficulty',
  'repentance',
  'everyday',
  'dhikr',
];

export interface SourcedCount {
  /** Repetitions stated in the cited narration, in order. */
  steps: { phrase: string; count: number }[];
  /** i18n key for the scope stated in the narration, e.g. "after every prayer". */
  scopeKey: string;
}

export interface DuaEntry {
  id: string;
  kind: DuaKind;
  category: DuaCategory;
  source: SourceRef;
  /** Only present when the narration itself states a number. */
  count?: SourcedCount;
}

const dq = (id: string, category: DuaCategory, ref: string): DuaEntry => ({ id, kind: 'quran', category, source: q(ref) });
const dp = (id: string, category: DuaCategory, collection: string, number: number, conventional?: string, count?: SourcedCount): DuaEntry => ({
  id,
  kind: 'prophetic',
  category,
  source: h(collection, number, conventional),
  ...(count ? { count } : {}),
});

export const DUAS: readonly DuaEntry[] = [
  dp('morning-afiyah', 'morning-evening', 'abudawud', 5074),
  dp('evening-mulk', 'morning-evening', 'muslim', 6908, '2723'),
  dp('sayyid-istighfar', 'morning-evening', 'bukhari', 6306),
  dp('sleep-bismika', 'sleep', 'bukhari', 6312),
  dp('sleep-aslamtu', 'sleep', 'bukhari', 6311),
  dp('sleep-bed', 'sleep', 'bukhari', 6320),
  dp('after-salam', 'after-prayer', 'muslim', 1334, '591'),
  dp('after-tasbih', 'after-prayer', 'muslim', 1352, '597', {
    scopeKey: 'countAfterEveryPrayer',
    steps: [
      { phrase: 'سُبْحَانَ اللَّهِ', count: 33 },
      { phrase: 'الْحَمْدُ لِلَّهِ', count: 33 },
      { phrase: 'اللَّهُ أَكْبَرُ', count: 33 },
      { phrase: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ', count: 1 },
    ],
  }),
  dp('travel-mount', 'travel', 'muslim', 3275, '1342'),
  dq('travel-sakhkhara', 'travel', '43:13-14'),
  dq('gratitude-solomon', 'gratitude', '27:19'),
  dq('gratitude-parents', 'gratitude', '46:15'),
  dq('difficulty-yunus', 'difficulty', '21:87'),
  dq('difficulty-ayyub', 'difficulty', '21:83'),
  dq('difficulty-musa-chest', 'difficulty', '20:25-28'),
  dq('difficulty-patience', 'difficulty', '2:250'),
  dq('difficulty-hasbuna', 'difficulty', '3:173'),
  dq('difficulty-capacity', 'difficulty', '2:286'),
  dq('difficulty-need', 'difficulty', '28:24'),
  dp('difficulty-karb', 'difficulty', 'bukhari', 6345),
  dq('repent-adam', 'repentance', '7:23'),
  dq('repent-believers', 'repentance', '3:16'),
  dq('repent-excess', 'repentance', '3:147'),
  dq('repent-mercy', 'repentance', '23:118'),
  dq('repent-nuh', 'repentance', '71:28'),
  dp('repent-hundred', 'repentance', 'muslim', 6858, '2702'),
  dq('everyday-good', 'everyday', '2:201'),
  dq('everyday-hearts', 'everyday', '3:8'),
  dq('everyday-knowledge', 'everyday', '20:114'),
  dq('everyday-family', 'everyday', '25:74'),
  dq('everyday-parents', 'everyday', '17:24'),
  dq('everyday-brothers', 'everyday', '59:10'),
  dq('everyday-prayer', 'everyday', '14:40-41'),
  dq('everyday-guidance', 'everyday', '18:10'),
  dq('everyday-refuge', 'everyday', '23:97-98'),
  dq('everyday-accept', 'everyday', '2:127-128'),
  dp('dhikr-subhan-hundred', 'dhikr', 'bukhari', 6405, undefined, {
    scopeKey: 'countPerDay',
    steps: [{ phrase: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', count: 100 }],
  }),
  dp('dhikr-two-words', 'dhikr', 'bukhari', 6682),
  dq('dhikr-remember', 'dhikr', '2:152'),
  dq('dhikr-hearts', 'dhikr', '13:28'),
  dq('dhikr-much', 'dhikr', '33:41-42'),
];

/* ---------- Hajj and Umrah checklists ---------- */

export interface ChecklistItem {
  id: string;
  /** i18n key. */
  labelKey: string;
  kind: 'learning' | 'logistics';
}

const learn = (id: string): ChecklistItem => ({ id, labelKey: `ck_${id}`, kind: 'learning' });
const logi = (id: string): ChecklistItem => ({ id, labelKey: `ck_${id}`, kind: 'logistics' });

export const CHECKLISTS: Record<'hajj' | 'umrah', ChecklistItem[]> = {
  hajj: [
    learn('teacher'),
    learn('guides'),
    learn('types'),
    learn('clothing'),
    learn('duas'),
    logi('documents'),
    logi('health'),
    logi('operator'),
    logi('group-plan'),
    logi('medication'),
    logi('footwear'),
    logi('money'),
  ],
  umrah: [
    learn('teacher'),
    learn('guides'),
    learn('clothing'),
    learn('duas'),
    logi('documents'),
    logi('health'),
    logi('operator'),
    logi('medication'),
    logi('footwear'),
    logi('money'),
  ],
};

import type { Lang } from '../shared/sources.ts';
import { editorialLabel, type EditorialMeta } from './editorial.ts';
import type { OccasionId } from './fasting.ts';

export type Copy = Record<Lang, string>;

export function text(copy: Copy | undefined, lang: Lang): string {
  return copy?.[lang]?.trim() ?? '';
}

export const SLOTS = [
  'overview',
  'meaning',
  'terms',
  'who',
  'preparation',
  'steps',
  'situations',
  'faq',
  'opinions',
  'sources',
  'tools',
  'review',
] as const;

export type SlotId = (typeof SLOTS)[number];

export interface Term {
  arabic: string;
  name: Copy;
}

export interface GuideSection {
  id: SlotId;
  status: 'published' | 'withheld';
  paragraphs?: Copy[];
  arabic?: string;
  transliteration?: string;
  meanings?: Copy;
  terms?: Term[];
  verseRefs?: string[];
  steps?: Copy[];
}

export interface GuideLink {
  href: string;
  label: Copy;
}

export interface Guide {
  id: string;
  path: string[];
  title: Copy;
  summary: Copy;
  meta: EditorialMeta;
  sections: GuideSection[];
  links: GuideLink[];
}

const META: EditorialMeta = {
  author: 'Dragon Dawwa editorial',
  updated: '2026-10-21',
  publicationState: 'published',
  reviews: [],
  translationEdition: null,
  languageReview: 'pending',
  interpretiveTradition: null,
};

const c = (en: string, ta: string, si: string): Copy => ({ en, ta, si });

const REVIEW: Copy = c(
  'No religious-review record is stored for this page. “Scholar reviewed” is not claimed. Tamil and Sinhala interface labels are not a published translation edition.',
  'இந்தப் பக்கத்துக்கு மத ஆய்வுப் பதிவு எதுவும் சேமிக்கப்படவில்லை. “அறிஞர் பரிசீலித்தது” என்று சொல்லப்படவில்லை.',
  'මෙම පිටුව සඳහා ආගමික සමාලෝචන වාර්තාවක් ගබඩා කර නැත. “විද්වත් සමාලෝචිත” යැයි නොකියයි.',
);

function section(partial: Partial<GuideSection> & Pick<GuideSection, 'id' | 'status'>): GuideSection {
  return partial;
}

function guide(input: Omit<Guide, 'sections' | 'meta'> & { sections: GuideSection[] }): Guide {
  const byId = new Map(input.sections.map(item => [item.id, item]));
  const sections = SLOTS.map(id => byId.get(id) ?? { id, status: 'withheld' as const });
  if (!sections.find(item => item.id === 'review' && item.status === 'published')) {
    sections[SLOTS.indexOf('review')] = section({ id: 'review', status: 'published', paragraphs: [REVIEW] });
  }
  return { ...input, meta: META, sections };
}

const shahadahMeaning = c(
  'I bear witness that there is no god except Allah, and I bear witness that Muhammad is the Messenger of Allah.',
  'அல்லாஹ்வைத் தவிர வேறு இறைவன் இல்லை என்று நான் சாட்சி கூறுகிறேன்; முஹம்மத் அல்லாஹ்வின் தூதர் என்று நான் சாட்சி கூறுகிறேன்.',
  'අල්ලාහ් හැර වෙනත් දෙවියෙකු නොමැති බවට මම සාක්ෂි දෙමි; මුහම්මද් අල්ලාහ්ගේ රසූල් බවට මම සාක්ෂි දෙමි.',
);

export const GUIDES: Guide[] = [
  guide({
    id: 'shahadah',
    path: ['shahadah'],
    title: c('Shahadah — Faith', 'ஷஹாதா — நம்பிக்கை', 'ෂහාදා — විශ්වාසය'),
    summary: c(
      'A private study page for the testimony of faith. It does not ask you to announce anything.',
      'நம்பிக்கை சாட்சியைத் தனியாகப் படிக்கும் பக்கம். எதையும் அறிவிக்கச் சொல்லாது.',
      'විශ්වාස සාක්ෂිය පෞද්ගලිකව ඉගෙන ගැනීමේ පිටුවකි. කිසිවක් ප්‍රකාශ කරන ලෙස ඉල්ලන්නේ නැත.',
    ),
    links: [
      { href: '#/spiritual/new-muslim', label: c('New Muslim guide', 'புதிய முஸ்லிம் வழிகாட்டி', 'නව මුස්ලිම් මාර්ගෝපදේශය') },
      { href: '#/spiritual/questions', label: c('Prepare a question', 'கேள்வியைத் தயாரிக்க', 'ප්‍රශ්නයක් සූදානම් කරන්න') },
      { href: '#/quran/study', label: c('Qur’an reader', 'குர்ஆன் வாசிப்பு', 'කුර්ආන් කියවීම') },
    ],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'This page is a private study aid. It does not register a conversion, ask for identity documents, or ask you to post publicly. It does not judge where you are in your learning.',
            'இது தனிப்பட்ட கற்றல் உதவி. மதம் மாற்றத்தைப் பதிவு செய்யாது, அடையாள ஆவணம் கேட்காது, பொதுப் பதிவு கேட்காது.',
            'මෙය පෞද්ගලික ඉගෙනුම් ආධාරයකි. ආගම වෙනස් කිරීමක් ලියාපදිංචි නොකරයි, හැඳුනුම් ලේඛන ඉල්ලන්නේ නැත, ප්‍රසිද්ධ පළ කිරීමක් ඉල්ලන්නේ නැත.',
          ),
        ],
      }),
      section({
        id: 'meaning',
        status: 'published',
        arabic: 'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا ٱللَّٰهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ ٱللَّٰهِ',
        transliteration: 'Ashhadu an lā ilāha illā Llāh, wa ashhadu anna Muḥammadan rasūlu Llāh.',
        meanings: shahadahMeaning,
        paragraphs: [
          c(
            'The Arabic is the commonly recited testimony. Wording in particular narrations can differ; those narrations are not copied here because a source-checked reference is not stored. The transliteration is only a pronunciation aid. The meaning is an editorial rendering, not a named published translation.',
            'அரபி வாக்கியம் பொதுவாகச் சொல்லப்படும் சாட்சி. ஒலிபெயர்ப்பு உச்சரிப்பு உதவி மட்டும். பொருள் ஒரு பெயரிடப்பட்ட மொழிபெயர்ப்புப் பதிப்பு அல்ல.',
            'අරාබි වාක්‍යය සාමාන්‍යයෙන් කියවන සාක්ෂියයි. ලිපි හරවා ලිවීම උච්චාරණ ආධාරයක් පමණි. අර්ථය නම් කළ ප්‍රකාශිත පරිවර්තනයක් නොවේ.',
          ),
        ],
      }),
      section({
        id: 'terms',
        status: 'published',
        terms: [
          { arabic: 'شَهَادَة', name: c('Shahadah — testimony', 'ஷஹாதா — சாட்சி', 'ෂහාදා — සාක්ෂිය') },
          { arabic: 'إِيمَان', name: c('Iman — faith. A definition is not published on this page.', 'ஈமான் — நம்பிக்கை. வரையறை இங்கு வெளியிடப்படவில்லை.', 'ඊමාන් — විශ්වාසය. නිර්වචනය මෙහි පළ කර නැත.') },
        ],
      }),
      section({
        id: 'who',
        status: 'published',
        paragraphs: [
          c(
            'Anyone who wants to learn, including beginners and new Muslims. This page does not decide a person’s faith.',
            'கற்க விரும்புவோர் அனைவருக்கும். இது ஒருவரின் நம்பிக்கையைத் தீர்மானிக்காது.',
            'ඉගෙන ගැනීමට කැමති ඕනෑම අයෙකුට. මෙය කෙනෙකුගේ විශ්වාසය තීරණය නොකරයි.',
          ),
        ],
      }),
      section({
        id: 'preparation',
        status: 'published',
        paragraphs: [
          c(
            'Nothing has to be uploaded. If you want personal support, prepare a question for a qualified teacher or a local community. This app does not send that question.',
            'எதையும் பதிவேற்ற வேண்டியதில்லை. தனிப்பட்ட உதவி வேண்டினால் தகுதியான ஆசிரியருக்கோ சமூகத்துக்கோ ஒரு கேள்வியைத் தயாரிக்கலாம். இந்தச் செயலி அதை அனுப்பாது.',
            'කිසිවක් උඩුගත කළ යුතු නැත. පෞද්ගලික සහයක් අවශ්‍ය නම් සුදුසු ගුරුවරයෙකුට හෝ ප්‍රජාවකට ප්‍රශ්නයක් සූදානම් කරන්න. මෙම යෙදුම එය යවන්නේ නැත.',
          ),
        ],
      }),
      section({
        id: 'steps',
        status: 'published',
        paragraphs: [
          c(
            'This is a study sequence, not a list of religious obligations and not a public declaration.',
            'இது ஒரு படிப்பு வரிசை. கடமைப் பட்டியல் அல்ல; பொது அறிவிப்பு அல்ல.',
            'මෙය ඉගෙනුම් අනුපිළිවෙලකි. ආගමික යුතුකම් ලැයිස්තුවක් හෝ ප්‍රසිද්ධ ප්‍රකාශයක් නොවේ.',
          ),
        ],
        steps: [
          c('Read the testimony and its meaning on this page.', 'இந்தப் பக்கத்தில் சாட்சியையும் அதன் பொருளையும் படிக்கவும்.', 'මෙම පිටුවේ සාක්ෂිය සහ එහි අර්ථය කියවන්න.'),
          c('Open Surah al-Ikhlas in the Qur’an reader.', 'குர்ஆன் வாசிப்பில் சூரா அல்-இக்லாஸைத் திறக்கவும்.', 'කුර්ආන් කියවීමේ සූරා අල්-ඉඛ්ලාස් විවෘත කරන්න.'),
          c('Use the prayer-times tool only when you want that practical help.', 'நடைமுறை உதவி வேண்டும்போது மட்டும் தொழுகை நேரக் கருவியைப் பயன்படுத்தவும்.', 'ප්‍රායෝගික උදව් අවශ්‍ය විට පමණක් සලාත වේලා මෙවලම භාවිතා කරන්න.'),
          c('Prepare a question if you want to speak with a qualified person.', 'தகுதியான ஒருவரிடம் பேச விரும்பினால் கேள்வியைத் தயாரிக்கவும்.', 'සුදුසුකම් ලත් අයෙකු සමඟ කතා කිරීමට අවශ්‍ය නම් ප්‍රශ්නයක් සූදානම් කරන්න.'),
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['112:1-4', '3:18', '47:19'] }),
      section({
        id: 'tools',
        status: 'published',
        paragraphs: [c('Related parts of the app.', 'செயலியின் தொடர்புடைய பகுதிகள்.', 'යෙදුමේ අදාළ කොටස්.')],
      }),
    ],
  }),
  guide({
    id: 'salah',
    path: ['salah'],
    title: c('Salah — Prayer', 'ஸலாஹ் — தொழுகை', 'සලාතය — යාච්ඤාව'),
    summary: c(
      'Tools for prayer times and Qibla, plus study pages. Step-by-step rulings are not published.',
      'தொழுகை நேரமும் கிப்லாவும், மற்றும் படிப்புப் பக்கங்கள். படிப்படியான தீர்ப்புகள் வெளியிடப்படவில்லை.',
      'සලාත වේලා සහ කිබ්ලා මෙවලම්, සහ අධ්‍යයන පිටු. පියවරෙන් පියවර තීන්දු පළ කර නැත.',
    ),
    links: [
      { href: '#/spiritual/salah/times', label: c('Prayer times', 'தொழுகை நேரம்', 'සලාත වේලා') },
      { href: '#/spiritual/salah/qibla', label: c('Qibla', 'கிப்லா', 'කිබ්ලා') },
      { href: '#/spiritual/salah/learn', label: c('Learning prayer', 'தொழுகை கற்றல்', 'සලාතය ඉගෙනීම') },
      { href: '#/spiritual/salah/purification', label: c('Purification', 'தூய்மை', 'පිරිසිදුවීම') },
      { href: '#/spiritual/salah/topics', label: c('Prayer topics', 'தொழுகை தலைப்புகள்', 'සලාත මාතෘකා') },
    ],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'Use the tools for calculated prayer times and a Qibla bearing. Lessons on how to pray are limited to passages the Qur’an reader can retrieve. A full prayer manual is not published.',
            'கணக்கிடப்பட்ட தொழுகை நேரத்துக்கும் கிப்லா திசைக்கும் கருவிகளைப் பயன்படுத்தவும். முழுத் தொழுகை கையேடு வெளியிடப்படவில்லை.',
            'ගණනය කළ සලාත වේලා සහ කිබ්ලා දිශාව සඳහා මෙවලම් භාවිතා කරන්න. සම්පූර්ණ සලාත් අත්පොතක් පළ කර නැත.',
          ),
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['2:45', '20:14'] }),
      section({ id: 'tools', status: 'published', paragraphs: [c('Open a tool from the links.', 'இணைப்புகளிலிருந்து ஒரு கருவியைத் திறக்கவும்.', 'සබැඳි වලින් මෙවලමක් විවෘත කරන්න.')] }),
    ],
  }),
  guide({
    id: 'salah-learn',
    path: ['salah', 'learn'],
    title: c('Learning prayer', 'தொழுகை கற்றல்', 'සලාතය ඉගෙනීම'),
    summary: c(
      'Beginner view and detailed view. Postures and the full sequence are waiting for review.',
      'தொடக்கப் பார்வையும் விரிவான பார்வையும். நிலைகளும் முழு வரிசையும் ஆய்வுக்காகக் காத்திருக்கின்றன.',
      'ආරම්භක දසුන සහ විස්තර දසුන. ඉරියව් සහ සම්පූර්ණ අනුපිළිවෙල සමාලෝචනය බලාපොරොත්තුවෙන් ඇත.',
    ),
    links: [
      { href: '#/spiritual/salah/times', label: c('Prayer times', 'தொழுகை நேரம்', 'සලාත වේලා') },
      { href: '#/quran', label: c('Simple Qur’an reader', 'எளிய குர்ஆன் வாசிப்பு', 'සරල කුර්ආන් කියවීම') },
    ],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'Beginner view keeps the retrieved text of al-Fatiha and the tools. Detailed view also shows the headings that are not yet published, so the gaps stay visible. Audio on al-Fatiha is Arabic recitation, not a spoken translation.',
            'தொடக்கப் பார்வை அல்-ஃபாத்திஹாவின் பெறப்பட்ட உரையையும் கருவிகளையும் வைக்கிறது. அல்-ஃபாத்திஹா ஒலி அரபு ஓதல்; பேசும் மொழிபெயர்ப்பு அல்ல.',
            'ආරම්භක දසුන අල්-ෆාතිහාගේ ලබාගත් පාඨය සහ මෙවලම් තබයි. ශ්‍රව්‍යය අරාබි පාරායනයයි; කථන පරිවර්තනයක් නොවේ.',
          ),
        ],
      }),
      section({
        id: 'preparation',
        status: 'published',
        paragraphs: [
          c(
            'Choose a city or allow location before looking up prayer times. The app does not guess a location. Purification steps are on a separate page and are not yet a lesson.',
            'தொழுகை நேரத்தைப் பார்ப்பதற்கு முன் ஒரு நகரத்தைத் தேர்ந்தால் செய்யுங்கள் அல்லது இருப்பிடத்தை அனுமதியுங்கள். செயலி இருப்பிடத்தை யூகிக்காது.',
            'සලාත වේලා බැලීමට පෙර නගරයක් තෝරන්න හෝ ස්ථානයට අවසර දෙන්න. යෙදුම ස්ථානයක් අනුමාන නොකරයි.',
          ),
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['1:1-7'] }),
      section({ id: 'tools', status: 'published', paragraphs: [c('Prayer times and the Qur’an reader.', 'தொழுகை நேரமும் குர்ஆன் வாசிப்பும்.', 'සලාත වේලා සහ කුර්ආන් කියවීම.')] }),
    ],
  }),
  guide({
    id: 'salah-purification',
    path: ['salah', 'purification'],
    title: c('Purification', 'தூய்மை', 'පිරිසිදුවීම'),
    summary: c(
      'Wudu, ghusl, and tayammum are named here. Steps and differences of opinion are not published.',
      'உளூ, குஸ்ல், தயம்மும் இங்கு பெயரிடப்பட்டுள்ளன. படிகளும் கருத்து வேறுபாடுகளும் வெளியிடப்படவில்லை.',
      'වුදූ, ගුස්ල්, සහ තයම්මුම් මෙහි නම් කර ඇත. පියවර සහ මතභේද පළ කර නැත.',
    ),
    links: [{ href: '#/spiritual/salah/learn', label: c('Learning prayer', 'தொழுகை கற்றல்', 'සලාතය ඉගෙනීම') }],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'This page reserves a place for purification. It does not yet give the steps, the conditions, or the differences of opinion. The verse below is shown from the named translation only.',
            'இந்தப் பக்கம் தூய்மைக்கு இடம் ஒதுக்குகிறது. படிகள், நிபந்தனைகள், கருத்து வேறுபாடுகள் இன்னும் இல்லை. கீழுள்ள வசனம் பெயரிடப்பட்ட மொழிபெயர்ப்பில் மட்டும்.',
            'මෙම පිටුව පිරිසිදුවීම සඳහා ඉඩක් වෙන් කරයි. පියවර, කොන්දේසි, හෝ මතභේද තවම නැත. පහත වාක්‍යය නම් කළ පරිවර්තනයෙන් පමණි.',
          ),
        ],
      }),
      section({
        id: 'terms',
        status: 'published',
        terms: [
          { arabic: 'وُضُوء', name: c('Wudu. Definition withheld.', 'உளூ. வரையறை நிறுத்தப்பட்டுள்ளது.', 'වුදූ. නිර්වචනය රඳවා ඇත.') },
          { arabic: 'غُسْل', name: c('Ghusl. Definition withheld.', 'குஸ்ல். வரையறை நிறுத்தப்பட்டுள்ளது.', 'ගුස්ල්. නිර්වචනය රඳවා ඇත.') },
          { arabic: 'تَيَمُّم', name: c('Tayammum. Definition withheld.', 'தயம்மும். வரையறை நிறுத்தப்பட்டுள்ளது.', 'තයම්මුම්. නිර්වචනය රඳවා ඇත.') },
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['5:6'] }),
    ],
  }),
];

const TOPICS: { id: string; title: Copy; refs: string[] }[] = [
  { id: 'five-daily', title: c('Five daily prayers', 'ஐந்து நேரத் தொழுகை', 'දිනපතා සලාත් පහ'), refs: ['2:238', '4:103', '11:114', '17:78'] },
  { id: 'congregation', title: c('Congregational prayer', 'ஜமாஅத் தொழுகை', 'ජමාඅත් සලාතය'), refs: [] },
  { id: 'friday', title: c('Friday prayer', 'வெள்ளிக்கிழமைத் தொழுகை', 'සිකුරාදා සලාතය'), refs: ['62:9-10'] },
  { id: 'voluntary', title: c('Voluntary prayers', 'கூடுதல் தொழுகைகள்', 'ස්වේච්ඡා සලාත්'), refs: [] },
  { id: 'witr', title: c('Witr', 'வித்ர்', 'විත්ර්'), refs: [] },
  { id: 'night', title: c('Night prayer', 'இரவுத் தொழுகை', 'රාත්‍රී සලාතය'), refs: ['17:79', '73:1-4'] },
  { id: 'eid', title: c('Eid prayer', 'ஈத் தொழுகை', 'ඊද් සලාතය'), refs: [] },
  { id: 'funeral', title: c('Funeral prayer', 'ஜனாஸா தொழுகை', 'ජනාසා සලාතය'), refs: [] },
  { id: 'travel', title: c('Travel-related guidance', 'பயணம் தொடர்பான வழிகாட்டல்', 'ගමනාන්ත මග පෙන්වීම'), refs: ['4:101-103'] },
  { id: 'illness', title: c('Illness-related guidance', 'நோய் தொடர்பான வழிகாட்டல்', 'රෝගීභාවය පිළිබඳ මග පෙන්වීම'), refs: [] },
  { id: 'missed', title: c('Missed prayer questions', 'தவறிய தொழுகை கேள்விகள்', 'මග හැරුණු සලාත් ප්‍රශ්න'), refs: [] },
  { id: 'mistakes', title: c('Common mistakes and misconceptions', 'பொதுவான தவறுகளும் தவறான புரிதல்களும்', 'පොදු වැරදි සහ වරදවා වටහා ගැනීම්'), refs: [] },
];

for (const topic of TOPICS) {
  GUIDES.push(
    guide({
      id: `salah-${topic.id}`,
      path: ['salah', 'topics', topic.id],
      title: topic.title,
      summary: c(
        'A reviewed lesson for this topic is not published. Related Qur’an passages are shown when a reference is stored.',
        'இந்தத் தலைப்புக்கு ஆய்வு செய்யப்பட்ட பாடம் வெளியிடப்படவில்லை. சேமித்த குர்ஆன் குறிப்புகள் இருந்தால் காட்டப்படும்.',
        'මෙම මාතෘකාව සඳහා සමාලෝචිත පාඩමක් පළ කර නැත. ගබඩා කළ කුර්ආන් යොමු ඇත්නම් පෙන්වයි.',
      ),
      links: [{ href: '#/spiritual/salah/topics', label: c('All prayer topics', 'அனைத்துத் தலைப்புகள்', 'සියලු මාතෘකා') }],
      sections: [
        section({
          id: 'overview',
          status: 'published',
          paragraphs: [
            c(
              'This topic needs a reviewed lesson before guidance is published. The page does not invent a ruling.',
              'வழிகாட்டல் வெளியிடப்படுவதற்கு முன் இந்தத் தலைப்புக்கு ஆய்வு செய்யப்பட்ட பாடம் தேவை. தீர்ப்பு புனையப்படவில்லை.',
              'මග පෙන්වීම පළ කිරීමට පෙර මෙම මාතෘකාවට සමාලෝචිත පාඩමක් අවශ්‍යයි. තීන්දුවක් නිර්මාණය නොකෙරේ.',
            ),
          ],
        }),
        ...(topic.refs.length ? [section({ id: 'sources' as const, status: 'published' as const, verseRefs: topic.refs })] : []),
      ],
    }),
  );
}

GUIDES.push(
  guide({
    id: 'zakah',
    path: ['zakah'],
    title: c('Zakah — Obligatory giving', 'ஸகாத் — கடமையான கொடை', 'සකාත් — අනිවාර්ය දීම'),
    summary: c(
      'How the educational calculator behaves, and what it refuses to decide. Zakat al-Fitr is separate.',
      'கல்விக் கணிப்பான் எப்படிச் செயல்படுகிறது, எதைத் தீர்மானிக்க மறுக்கிறது. ஃபித்ர் ஸகாத் தனி.',
      'අධ්‍යාපනික ගණකය හැසිරෙන ආකාරය සහ එය තීරණය නොකරන දේ. ෆිත්ර් සකාත් වෙනමයි.',
    ),
    links: [
      { href: '#/spiritual/zakah/calculator', label: c('Calculator', 'கணிப்பான்', 'ගණකය') },
      { href: '#/spiritual/zakah/calculations', label: c('Saved calculations', 'சேமித்த கணக்குகள்', 'සුරැකි ගණනය') },
      { href: '#/spiritual/zakah/recipients', label: c('Recipient categories', 'பெறுநர் வகைகள்', 'ලබන්නන්ගේ වර්ග') },
    ],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'Zakah is the pillar of obligatory giving. This page does not decide whether it is due for you. Sadaqah is commonly used for voluntary giving; the legal distinction is not given as a ruling here.',
            'ஸகாத் கடமையான கொடையின் தூண். இது உங்களுக்குக் கடமையா என்பதைத் தீர்மானிக்காது. ஸதகா பொதுவாக தன்னார்வக் கொடைக்குப் பயன்படும்; சட்ட வேறுபாடு இங்குத் தீர்ப்பாக இல்லை.',
            'සකාත් යනු අනිවාර්ය දීමේ කුළුණයි. එය ඔබට නියමද යන්න මෙය තීරණය නොකරයි. සදකා සාමාන්‍යයෙන් ස්වේච්ඡා දීමට යෙදේ; නීතිමය වෙනස මෙහි තීන්දුවක් ලෙස නැත.',
          ),
        ],
      }),
      section({
        id: 'meaning',
        status: 'published',
        paragraphs: [
          c(
            'The calculator uses one draft profile: 2.5% after a nisab test. It is not scholar-reviewed. Categories without a complete rule are marked for a specialist and are not calculated. Zakat al-Fitr is never folded into the wealth figure.',
            'கணிப்பான் ஒரு வரைவு விதியைப் பயன்படுத்துகிறது: நிஸாபுக்குப் பிறகு 2.5%. அது அறிஞர் பரிசீலனை அல்ல. முழு விதி இல்லாத வகைகள் நிபுணருக்குக் குறிக்கப்படும். ஃபித்ர் ஸகாத் சேர்க்கப்படாது.',
            'ගණකය කෙටුම්පත් රීතියක් යොදයි: නිසාබ් පරීක්ෂණයෙන් පසු 2.5%. එය විද්වත් සමාලෝචිත නොවේ. සම්පූර්ණ රීතියක් නැති වර්ග විශේෂඥයෙකුට යොමු වේ. ෆිත්ර් සකාත් එකතු නොවේ.',
          ),
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['9:60', '2:43'] }),
      section({ id: 'tools', status: 'published', paragraphs: [c('The calculator explains its own scope before you enter figures.', 'தொகைகளை உள்ளிடுவதற்கு முன் கணிப்பான் தன் எல்லையை விளக்கும்.', 'අගයන් ඇතුළත් කිරීමට පෙර ගණකය තම සීමාව පැහැදිලි කරයි.')] }),
    ],
  }),
  guide({
    id: 'zakah-recipients',
    path: ['zakah', 'recipients'],
    title: c('Recipient categories', 'பெறுநர் வகைகள்', 'ලබන්නන්ගේ වර්ග'),
    summary: c(
      'Qur’an 9:60 in the named translation. Applying the categories to a person is not done here.',
      'பெயரிடப்பட்ட மொழிபெயர்ப்பில் குர்ஆன் 9:60. ஒருவருக்கு வகைகளைப் பொருத்துவது இங்கில்லை.',
      'නම් කළ පරිවර්තනයේ කුර්ආන් 9:60. කෙනෙකුට වර්ග යෙදීම මෙහි සිදු නොවේ.',
    ),
    links: [{ href: '#/spiritual/zakah', label: c('Zakah learning', 'ஸகாத் கற்றல்', 'සකාත් ඉගෙනීම') }],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'Read the verse in the translation selected for your language. A commentary and a decision about a particular recipient are not published.',
            'உங்கள் மொழிக்குத் தேர்ந்த மொழிபெயர்ப்பில் வசனத்தைப் படிக்கவும். விளக்கவுரையும் ஒரு குறிப்பிட்ட பெறுநரைப் பற்றிய முடிவும் வெளியிடப்படவில்லை.',
            'ඔබේ භාෂාවට තෝරා ඇති පරිවර්තනයේ වාක්‍යය කියවන්න. විවරණයක් හෝ යම් ලබන්නෙකු පිළිබඳ තීරණයක් පළ කර නැත.',
          ),
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['9:60'] }),
    ],
  }),
  guide({
    id: 'fasting',
    path: ['fasting'],
    title: c('Sawm — Fasting', 'ஸவ்ம் — நோன்பு', 'සව්ම් — උපවාසය'),
    summary: c(
      'Ramadan in the named Qur’an translation, a calculated calendar, and a private planner. Medical and expiation rulings are not published.',
      'பெயரிடப்பட்ட குர்ஆன் மொழிபெயர்ப்பில் ரமளான், கணக்கு நாள்காட்டி, தனிப்பட்ட திட்டமிடுதல். மருத்துவ மற்றும் பரிகாரத் தீர்ப்புகள் இல்லை.',
      'නම් කළ කුර්ආන් පරිවර්තනයේ රමදාන්, ගණනය කළ දින දර්ශනය, පෞද්ගලික සැලසුම. වෛද්‍ය සහ ප්‍රායශ්චිත්ත තීන්දු නැත.',
    ),
    links: [
      { href: '#/spiritual/fasting/calendar', label: c('Fasting calendar', 'நோன்பு நாள்காட்டி', 'උපවාස දින දර්ශනය') },
      { href: '#/spiritual/fasting/planner', label: c('Planner', 'திட்டமிடுதல்', 'සැලසුම') },
      { href: '#/spiritual/calendar', label: c('Worship calendar', 'வழிபாட்டு நாள்காட்டி', 'ආගමික දින දර්ශනය') },
    ],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'The verses below are the app’s named translation. This page does not decide who must fast, whether an illness allows a break, or whether fidyah or kaffarah is due. It will not assess medical fitness.',
            'கீழுள்ள வசனங்கள் செயலியின் பெயரிடப்பட்ட மொழிபெயர்ப்பு. யார் நோற்க வேண்டும், நோய் இடைவெளி தருமா, ஃபித்யா அல்லது கஃப்பாரா கடமையா என்பதை இது தீர்மானிக்காது. மருத்துவத் தகுதியை மதிப்பிடாது.',
            'පහත වාක්‍ය යෙදුමේ නම් කළ පරිවර්තනයයි. කවුරුන් උපවසිය යුතුද, රෝගයක් විවේකයට ඉඩ දෙනවාද, ෆිද්යා හෝ කෆ්ෆාරා නියමද යන්න මෙය තීරණය නොකරයි. වෛද්‍ය සුදුසුකම තක්සේරු නොකරයි.',
          ),
        ],
      }),
      section({
        id: 'situations',
        status: 'published',
        paragraphs: [
          c(
            'Travel, illness, pregnancy, breastfeeding, menstruation, and postnatal bleeding need a qualified answer for a real situation. Those lessons are withheld. Missed-fast arithmetic is not assigned by the planner; a personal make-up list is only a private note.',
            'பயணம், நோய், கர்ப்பம், பாலூட்டுதல், மாதவிடாய், பிரசவ இரத்தம் ஆகியவற்றுக்கு உண்மையான சூழலில் தகுதியான பதில் வேண்டும். அந்தப் பாடங்கள் நிறுத்தப்பட்டுள்ளன.',
            'ගමන, රෝගය, ගැබ්ගැනීම, කිරිදීම, ඔප්පු වීම, සහ ප්‍රසව රුධිරය සඳහා සුදුසු පිළිතුරක් අවශ්‍යයි. ඒ පාඩම් රඳවා ඇත.',
          ),
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['2:183-185'] }),
      section({ id: 'tools', status: 'published', paragraphs: [c('Calendar dates follow the authority you select. They can be provisional.', 'நாள்காட்டி தேதிகள் நீங்கள் தேர்ந்த அதிகாரத்தைப் பின்பற்றும். அவை தற்காலிகமாக இருக்கலாம்.', 'දින දර්ශන දිනයන් ඔබ තෝරන අධිකාරිය අනුවයි. ඒවා තාවකාලික විය හැක.')] }),
    ],
  }),
  guide({
    id: 'hajj',
    path: ['hajj'],
    title: c('Hajj — Pilgrimage', 'ஹஜ் — யாத்திரை', 'හජ් — වන්දනාව'),
    summary: c(
      'Distinct from Umrah. Ritual sequence and visa rules are not published. A personal preparation list is available.',
      'உம்ராவிலிருந்து தனி. சடங்கு வரிசையும் விசா விதிகளும் வெளியிடப்படவில்லை. தனிப்பட்ட தயாரிப்புப் பட்டியல் உள்ளது.',
      'උම්රාවෙන් වෙනස්. චාරිත්‍ර අනුපිළිවෙල සහ වීසා නීති පළ කර නැත. පෞද්ගලික සූදානම් ලැයිස්තුවක් ඇත.',
    ),
    links: [
      { href: '#/spiritual/hajj/checklist', label: c('Hajj checklist', 'ஹஜ் பட்டியல்', 'හජ් ලැයිස්තුව') },
      { href: '#/spiritual/umrah', label: c('Umrah', 'உம்ரா', 'උම්රා') },
    ],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'Hajj and Umrah are different. This page does not teach the ritual order and does not state visa, permit, fee, or health-entry rules. Those change and are not copied here without a dated official source.',
            'ஹஜ்ஜும் உம்ராவும் வேறு. சடங்கு வரிசை இங்கு இல்லை. விசா, அனுமதி, கட்டணம், சுகாதார நுழைவு விதிகள் இல்லை.',
            'හජ් සහ උම්රා වෙනස්. චාරිත්‍ර පිළිවෙල මෙහි නැත. වීසා, බලපත්‍ර, ගාස්තු, සෞඛ්‍ය ඇතුළු වීමේ නීති නැත.',
          ),
        ],
      }),
      section({
        id: 'preparation',
        status: 'published',
        paragraphs: [
          c(
            'Ask your group about walking distance, rest, wheelchair access, and medicine. This is practical preparation, not a ruling and not medical advice.',
            'நடைதூரம், ஓய்வு, சக்கர நாற்காலி வசதி, மருந்து பற்றி உங்கள் குழுவிடம் கேளுங்கள். இது நடைமுறைத் தயாரிப்பு; தீர்ப்பு அல்ல; மருத்துவ அறிவுரை அல்ல.',
            'ඇවිදීමේ දුර, විවේකය, රෝද පුටු පහසුව, ඖෂධ ගැන ඔබේ කණ්ඩායමෙන් අසන්න. මෙය ප්‍රායෝගික සූදානමයි; තීන්දුවක් හෝ වෛද්‍ය උපදෙසක් නොවේ.',
          ),
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['3:97', '2:196-197'] }),
      section({ id: 'tools', status: 'published', paragraphs: [c('The checklist stores ticks only on this device.', 'பட்டியல் குறிகள் இந்தச் சாதனத்தில் மட்டும்.', 'ලැයිස්තු සලකුණු මෙම උපාංගයේ පමණි.')] }),
    ],
  }),
  guide({
    id: 'umrah',
    path: ['umrah'],
    title: c('Umrah', 'உம்ரா', 'උම්රා'),
    summary: c(
      'Separate from Hajj. Ihram, tawaf, sa‘i, and completion are not taught as a ritual manual here.',
      'ஹஜ்ஜிலிருந்து தனி. இஹ்ராம், தவாஃப், சஅய், நிறைவு ஆகியவை சடங்குக் கையேடாக இங்கில்லை.',
      'හජ් වලින් වෙනම. ඉහ්රාම්, තවාෆ්, සඃඊ, සහ නිමාව චාරිත්‍ර අත්පොතක් ලෙස මෙහි නැත.',
    ),
    links: [
      { href: '#/spiritual/umrah/checklist', label: c('Umrah checklist', 'உம்ரா பட்டியல்', 'උම්රා ලැයිස්තුව') },
      { href: '#/spiritual/hajj', label: c('Hajj', 'ஹஜ்', 'හජ්') },
    ],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'Umrah is not Hajj. A ritual sequence for ihram, tawaf, sa‘i, and completion is withheld until review. Travel rules are not hardcoded.',
            'உம்ரா ஹஜ் அல்ல. இஹ்ராம், தவாஃப், சஅய், நிறைவுக்கான சடங்கு வரிசை ஆய்வுவரை நிறுத்தப்பட்டுள்ளது. பயண விதிகள் நிரந்தரமாக எழுதப்படவில்லை.',
            'උම්රා හජ් නොවේ. ඉහ්රාම්, තවාෆ්, සඃඊ, සහ නිමාව සඳහා චාරිත්‍ර අනුපිළිවෙල සමාලෝචනය තෙක් රඳවා ඇත. සංචාර නීති ස්ථිරව ලියා නැත.',
          ),
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['2:196'] }),
      section({ id: 'tools', status: 'published', paragraphs: [c('Use the Umrah checklist, not the Hajj one.', 'ஹஜ் பட்டியலை அல்ல, உம்ரா பட்டியலைப் பயன்படுத்தவும்.', 'හජ් ලැයිස්තුව නොව උම්රා ලැයිස්තුව භාවිතා කරන්න.')] }),
    ],
  }),
  guide({
    id: 'akhlaq',
    path: ['akhlaq'],
    title: c('Islamic manners and character', 'இஸ்லாமிய நடத்தை', 'ඉස්ලාමීය හැසිරීම'),
    summary: c(
      'Related Qur’an passages. A character course is not published.',
      'தொடர்புடைய குர்ஆன் பகுதிகள். ஒரு ஒழுக்கப் பாடத்திட்டம் வெளியிடப்படவில்லை.',
      'අදාළ කුර්ආන් කොටස්. චරිත පාඨමාලාවක් පළ කර නැත.',
    ),
    links: [{ href: '#/quran/study', label: c('Qur’an reader', 'குர்ஆன் வாசிப்பு', 'කුර්ආන් කියවීම') }],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'Read the passages below in the named translation. A commentary on character is not published on this page.',
            'கீழுள்ள பகுதிகளைப் பெயரிடப்பட்ட மொழிபெயர்ப்பில் படிக்கவும். குணம் பற்றிய விளக்கவுரை இங்கில்லை.',
            'පහත කොටස් නම් කළ පරිවර්තනයෙන් කියවන්න. චරිතය පිළිබඳ විවරණයක් මෙහි නැත.',
          ),
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['49:11-12', '31:18-19'] }),
    ],
  }),
  guide({
    id: 'new-muslim',
    path: ['new-muslim'],
    title: c('New Muslim guide', 'புதிய முஸ்லிம் வழிகாட்டி', 'නව මුස්ලිම් මාර්ගෝපදේශය'),
    summary: c(
      'A quiet starting point. No announcement, no documents, no public profile.',
      'அமைதியான தொடக்கம். அறிவிப்பு இல்லை, ஆவணம் இல்லை, பொது சுயவிவரம் இல்லை.',
      'නිහඬ ආරම්භයක්. නිවේදනයක් නැත, ලේඛන නැත, ප්‍රසිද්ධ පැතිකඩක් නැත.',
    ),
    links: [
      { href: '#/spiritual/shahadah', label: c('Shahadah', 'ஷஹாதா', 'ෂහාදා') },
      { href: '#/spiritual/questions', label: c('Prepare a question', 'கேள்வியைத் தயாரிக்க', 'ප්‍රශ්නයක් සූදානම් කරන්න') },
      { href: '#/spiritual/salah/learn', label: c('Learning prayer', 'தொழுகை கற்றல்', 'සලාතය ඉගෙනීම') },
    ],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'You can read here without telling anyone. The app does not create a public conversion post and does not ask who you are.',
            'யாரிடமும் சொல்லாமல் இங்கே படிக்கலாம். செயலி பொது மதம்மாற்றப் பதிவை உருவாக்காது; நீங்கள் யார் என்று கேட்காது.',
            'කාටවත් නොකියා මෙහි කියවිය හැක. යෙදුම ප්‍රසිද්ධ පරිවර්තන පළ කිරීමක් සාදන්නේ නැත; ඔබ කවුදැයි අසන්නේ නැත.',
          ),
        ],
      }),
      section({
        id: 'who',
        status: 'published',
        paragraphs: [
          c(
            'Beginners, new Muslims, and anyone curious. Progress you mark stays on this device and is not a score.',
            'தொடக்கநிலையினர், புதிய முஸ்லிம்கள், ஆர்வமுள்ளோர். நீங்கள் குறிக்கும் முன்னேற்றம் இந்தச் சாதனத்தில் இருக்கும்; அது மதிப்பெண் அல்ல.',
            'ආරම්භකයින්, නව මුස්ලිම්වරුන්, සහ කුතුහලයෙන් සිටින අය. ඔබ සලකුණු කරන ප්‍රගතිය මෙම උපාංගයේ පවතී; එය ලකුණු ගණනක් නොවේ.',
          ),
        ],
      }),
      section({
        id: 'steps',
        status: 'published',
        steps: [
          c('Read the testimony page when you want to.', 'விரும்பும்போது சாட்சிப் பக்கத்தைப் படிக்கவும்.', 'අවශ්‍ය විට සාක්ෂි පිටුව කියවන්න.'),
          c('Read Surah al-Ikhlas in the Qur’an reader.', 'குர்ஆன் வாசிப்பில் சூரா அல்-இக்லாஸைப் படிக்கவும்.', 'කුර්ආන් කියවීමේ සූරා අල්-ඉඛ්ලාස් කියවන්න.'),
          c('Write a question for a person you trust. Nothing is sent.', 'நீங்கள் நம்பும் ஒருவருக்குக் கேள்வி எழுதுங்கள். எதுவும் அனுப்பப்படாது.', 'ඔබ විශ්වාස කරන අයෙකුට ප්‍රශ්නයක් ලියන්න. කිසිවක් යවන්නේ නැත.'),
        ],
      }),
      section({ id: 'sources', status: 'published', verseRefs: ['112:1-4'] }),
    ],
  }),
  guide({
    id: 'dua',
    path: ['dua-dhikr'],
    title: c('Du’a and dhikr', 'துஆவும் திக்ரும்', 'දුආ සහ සිකර්'),
    summary: c(
      'Qur’anic passages from the named translation. No prescribed counts and no promised outcomes.',
      'பெயரிடப்பட்ட மொழிபெயர்ப்பிலிருந்து குர்ஆன் பகுதிகள். நிர்ணய எண்ணிக்கையும் உறுதியான பலனும் இல்லை.',
      'නම් කළ පරිවර්තනයෙන් කුර්ආන් කොටස්. නියමිත ගණන් හෝ පොරොන්දු වූ ප්‍රතිඵල නැත.',
    ),
    links: [{ href: '#/hadith', label: c('Hadith library', 'ஹதீஸ் நூலகம்', 'හදීස් පුස්තකාලය') }],
    sections: [
      section({
        id: 'overview',
        status: 'published',
        paragraphs: [
          c(
            'Cards below are Qur’anic passages retrieved from the same reader as the rest of the app. Prophetic supplications are not listed until a collection, number, and grading source are stored. The counter is a personal target, not a prescribed count.',
            'கீழுள்ள அட்டைகள் செயலியின் அதே வாசிப்பிலிருந்து பெறப்பட்ட குர்ஆன் பகுதிகள். நபிமொழி பிரார்த்தனைகள், தொகுப்பு, எண், தர ஆதாரம் சேமிக்கும்வரை இல்லை. எண்ணி தனிப்பட்ட இலக்கு.',
            'පහත කාඩ්පත් යෙදුමේම කියවීමෙන් ලබාගත් කුර්ආන් කොටස්ය. එකතුව, අංකය, සහ ශ්‍රේණි මූලාශ්‍රයක් ගබඩා වන තුරු නබි ප්‍රාර්ථනා ලැයිස්තුගත නොවේ. ගණකය පෞද්ගලික ඉලක්කයකි.',
          ),
        ],
      }),
      section({ id: 'tools', status: 'published', paragraphs: [c('Search and the counter are on this page.', 'தேடலும் எண்ணியும் இந்தப் பக்கத்தில்.', 'සෙවීම සහ ගණකය මෙම පිටුවේය.')] }),
    ],
  }),
);

export const PRAYER_TOPICS = TOPICS;

export function findGuide(segments: string[]): Guide | undefined {
  const exact = GUIDES.find(item => item.path.join('/') === segments.join('/'));
  if (exact) return exact;
  if (segments.length > 1 && SLOTS.includes(segments[segments.length - 1] as SlotId)) {
    return GUIDES.find(item => item.path.join('/') === segments.slice(0, -1).join('/'));
  }
  return undefined;
}

export function guideById(id: string): Guide | undefined {
  return GUIDES.find(item => item.id === id);
}

export interface OccasionCopy {
  id: OccasionId;
  title: Copy;
  meaning: Copy;
  evidence: Copy;
  conditions: Copy;
  who: Copy;
  dateBasis: Copy;
  differences: Copy;
  restrictions: Copy;
  verseRefs: string[];
}

const notHadith = c(
  'No hadith reference is attached. A number is not shown, because this app does not assign “sahih” without a retrieved narration and its grader.',
  'ஹதீஸ் குறிப்பு இணைக்கப்படவில்லை. பெறப்பட்ட அறிக்கையும் அதன் தரமிடுபவரும் இல்லாமல் “ஸஹீஹ்” சொல்லப்படாது.',
  'හදීස් යොමුවක් එකතු කර නැත. ලබාගත් වාර්තාවක් සහ එහි ශ්‍රේණිකරු නොමැතිව “සහීහ්” යැයි නොකියයි.',
);

export const OCCASIONS: OccasionCopy[] = [
  {
    id: 'ramadan',
    title: c('Ramadan', 'ரமளான்', 'රමදාන්'),
    meaning: c('The month of fasting named in the passages below.', 'கீழுள்ள பகுதிகளில் பெயரிடப்பட்ட நோன்பு மாதம்.', 'පහත කොටස්වල නම් කළ උපවාස මාසය.'),
    evidence: c('The evidence on this card is the named Qur’an translation. No extra reward is stated.', 'இந்த அட்டையின் சான்று பெயரிடப்பட்ட குர்ஆன் மொழிபெயர்ப்பு. கூடுதல் பலன் சொல்லப்படவில்லை.', 'මෙම කාඩ්පතේ සාක්ෂිය නම් කළ කුර්ආන් පරිවර්තනයයි. අමතර ප්‍රතිඵලයක් කියන්නේ නැත.'),
    conditions: c('Who must fast is not decided here.', 'யார் நோற்க வேண்டும் என்பது இங்கே தீர்மானிக்கப்படவில்லை.', 'කවුරුන් උපවසිය යුතුද යන්න මෙහි තීරණය නොවේ.'),
    who: c('Readers who want the month’s context.', 'மாதத்தின் பின்னணியை விரும்பும் வாசகர்கள்.', 'මාසයේ පසුබිම අවශ්‍ය පාඨකයන්.'),
    dateBasis: c('Month 9 on the calendar authority you selected. The label is calculated or provisional.', 'நீங்கள் தேர்ந்த நாள்காட்டி அதிகாரத்தில் 9ஆம் மாதம். குறிப்பு கணக்கிடப்பட்டது அல்லது தற்காலிகம்.', 'ඔබ තෝරන දින දර්ශන අධිකාරියේ 9 වන මාසය. ලේබලය ගණනය කළ හෝ තාවකාලිකයි.'),
    differences: c('Local sighting can differ from this calendar. Use the shift or another authority rather than treating one grid as final.', 'உள்ளூர் பிறைப் பார்வை இந்த நாள்காட்டியிலிருந்து மாறலாம்.', 'ප්‍රදේශීය චන්ද්‍ර දර්ශනය මෙම දින දර්ශනයෙන් වෙනස් විය හැක.'),
    restrictions: c('The planner does not file Ramadan as a voluntary fast and does not tell you that a fast is owed.', 'திட்டமிடுதல் ரமளானை தன்னார்வ நோன்பாகப் பதிவு செய்யாது; நோன்பு கடமை என்று சொல்லாது.', 'සැලසුම රමදාන් ස්වේච්ඡා උපවාසයක් ලෙස ලියන්නේ නැත; උපවාසයක් නියම බව නොකියයි.'),
    verseRefs: ['2:183-185'],
  },
  {
    id: 'shawwal-six',
    title: c('Six days of Shawwal', 'ஷவ்வாலின் ஆறு நாட்கள்', 'ෂව්වාල් දින සය'),
    meaning: c('Days after Eid al-Fitr in which six voluntary fasts are often discussed.', 'ஈதுல் ஃபித்ருக்குப் பின் ஆறு தன்னார்வ நோன்புகள் பேசப்படும் நாட்கள்.', 'ඊදුල් ෆිත්ර් වලින් පසු ස්වේච්ඡා උපවාස සයක් ගැන කතා කරන දින.'),
    evidence: notHadith,
    conditions: c('Whether the days must be consecutive is not ruled on.', 'நாட்கள் தொடர்ச்சியாக இருக்க வேண்டுமா என்பது தீர்ப்பில்லை.', 'දින අඛණ්ඩ විය යුතුද යන්න තීන්දු කර නැත.'),
    who: c('Not decided.', 'தீர்மானிக்கப்படவில்லை.', 'තීරණය කර නැත.'),
    dateBasis: c('Shawwal 2–7 on the selected calendar. Shawwal 1 is Eid and is withheld.', 'தேர்ந்த நாள்காட்டியில் ஷவ்வால் 2–7. ஷவ்வால் 1 ஈத்; அது நிறுத்தப்படும்.', 'තෝරාගත් දින දර්ශනයේ ෂව්වාල් 2–7. ෂව්වාල් 1 ඊද්; එය රඳවයි.'),
    differences: c('Start dates move with moon sighting. This card does not pick a school.', 'தொடக்கத் தேதி பிறைப் பார்வையுடன் நகரும். இந்த அட்டை ஒரு மத்ஹபைத் தேர்ந்தெடுக்காது.', 'ආරම්භක දින චන්ද්‍ර දර්ශනය සමඟ වෙනස් වේ. මෙම කාඩ්පත මද්හබක් තෝරන්නේ නැත.'),
    restrictions: c('The planner will not place a voluntary fast on 1 Shawwal.', 'திட்டமிடுதல் 1 ஷவ்வாலில் தன்னார்வ நோன்பை வைக்காது.', 'සැලසුම ෂව්වාල් 1 දින ස්වේච්ඡා උපවාසයක් නොතබයි.'),
    verseRefs: [],
  },
  {
    id: 'monday-thursday',
    title: c('Mondays and Thursdays', 'திங்கள் மற்றும் வியாழன்', 'සඳුදා සහ බ්‍රහස්පතින්දා'),
    meaning: c('Two weekdays on which a voluntary fast is often mentioned.', 'தன்னார்வ நோன்பு அடிக்கடி சொல்லப்படும் இரண்டு வார நாட்கள்.', 'ස්වේච්ඡා උපවාසයක් නිතර කියවෙන සතියේ දින දෙක.'),
    evidence: notHadith,
    conditions: c('No extra conditions are published.', 'கூடுதல் நிபந்தனைகள் வெளியிடப்படவில்லை.', 'අමතර කොන්දේසි පළ කර නැත.'),
    who: c('Not decided.', 'தீர்மானிக்கப்படவில்லை.', 'තීරණය කර නැත.'),
    dateBasis: c('Monday and Thursday in the timezone you selected.', 'நீங்கள் தேர்ந்த நேர மண்டலத்தில் திங்கள் மற்றும் வியாழன்.', 'ඔබ තෝරන වේලා කලාපයේ සඳුදා සහ බ්‍රහස්පතින්දා.'),
    differences: notHadith,
    restrictions: c('If that weekday is also a restricted Hijri date, the restriction overrides this suggestion.', 'அந்த வார நாள் தடைசெய்யப்பட்ட ஹிஜ்ரி தேதியாகவும் இருந்தால், தடை இந்தப் பரிந்துரையை மீறும்.', 'එම සතියේ දිනය සීමිත හිජ්රි දිනයක් ද නම්, සීමාව මෙම යෝජනාව ඉක්මවයි.'),
    verseRefs: [],
  },
  {
    id: 'white-days',
    title: c('The white days', 'வெண்மை நாட்கள்', 'සුදු දින'),
    meaning: c('The 13th, 14th, and 15th of a Hijri month, often discussed as voluntary fasts.', 'ஒரு ஹிஜ்ரி மாதத்தின் 13, 14, 15. தன்னார்வ நோன்புகளாக அடிக்கடி பேசப்படும்.', 'හිජ්රි මාසයක 13, 14, 15. ස්වේච්ඡා උපවාස ලෙස නිතර සාකච්ඡා වේ.'),
    evidence: notHadith,
    conditions: c('No extra conditions are published.', 'கூடுதல் நிபந்தனைகள் வெளியிடப்படவில்லை.', 'අමතර කොන්දේසි පළ කර නැත.'),
    who: c('Not decided.', 'தீர்மானிக்கப்படவில்லை.', 'තීරණය කර නැත.'),
    dateBasis: c('Hijri days 13–15 on the selected authority.', 'தேர்ந்த அதிகாரத்தில் ஹிஜ்ரி 13–15.', 'තෝරාගත් අධිකාරියේ හිජ්රි 13–15.'),
    differences: c('The civil date of these days moves if the month starts on a different sighting.', 'மாதம் வேறு பிறைப் பார்வையில் தொடங்கினால் இந்த நாட்களின் சிவில் தேதி நகரும்.', 'වෙනත් දර්ශනයකින් මාසය ආරම්භ වුවහොත් මෙම දිනවල සිවිල් දිනය වෙනස් වේ.'),
    restrictions: c('On 13 Dhul Hijjah the days of Tashreeq override this suggestion.', 'துல் ஹிஜ்ஜா 13இல் தஷ்ரீக் நாட்கள் இந்தப் பரிந்துரையை மீறும்.', 'දුල් හිජ්ජා 13 දින තෂ්රීක් දින මෙම යෝජනාව ඉක්මවයි.'),
    verseRefs: [],
  },
  {
    id: 'arafah',
    title: c('Day of ʿArafah', 'அரஃபா நாள்', 'අරෆා දිනය'),
    meaning: c('The 9th of Dhul Hijjah. People at the pilgrimage and people elsewhere are not given one practical rule here.', 'துல் ஹிஜ்ஜா 9. யாத்திரையில் இருப்பவருக்கும் மற்றவருக்கும் ஒரே நடைமுறை விதி இங்கில்லை.', 'දුල් හිජ්ජා 9. වන්දනාවේ සිටින අයට සහ අන් අයට එකම ප්‍රායෝගික රීතියක් මෙහි නැත.'),
    evidence: notHadith,
    conditions: c('Whether a person standing at ʿArafah fasts is not decided.', 'அரஃபாவில் நிற்பவர் நோற்பாரா என்பது தீர்மானிக்கப்படவில்லை.', 'අරෆාහි සිටින අයෙකු උපවසනවාද යන්න තීරණය කර නැත.'),
    who: c('Not decided. Ask a qualified teacher about your own case.', 'தீர்மானிக்கப்படவில்லை. உங்கள் நிலைக்குத் தகுதியான ஆசிரியரிடம் கேளுங்கள்.', 'තීරණය කර නැත. ඔබේ අවස්ථාව ගැන සුදුසු ගුරුවරයෙකුගෙන් අසන්න.'),
    dateBasis: c('Dhul Hijjah 9 on the selected calendar.', 'தேர்ந்த நாள்காட்டியில் துல் ஹிஜ்ஜா 9.', 'තෝරාගත් දින දර්ශනයේ දුල් හිජ්ජා 9.'),
    differences: notHadith,
    restrictions: c('The next day is Eid al-Adha, which the planner withholds.', 'அடுத்த நாள் ஈதுல் அள்ஹா; திட்டமிடுதல் அதை நிறுத்தும்.', 'ඊළඟ දිනය ඊදුල් අල්හා; සැලසුම එය රඳවයි.'),
    verseRefs: [],
  },
  {
    id: 'ashura',
    title: c('ʿAshura', 'ஆஷூரா', 'ආෂූරා'),
    meaning: c('The 10th of Muharram, with the 9th and 11th shown as related dates. A ruling about which of them to fast is not published.', 'முஹர்ரம் 10. 9 மற்றும் 11 தொடர்புடைய தேதிகளாகக் காட்டப்படும். எதை நோற்க வேண்டும் என்ற தீர்ப்பு இல்லை.', 'මුහරම් 10. 9 සහ 11 අදාළ දින ලෙස පෙන්වයි. කුමක් උපවසිය යුතුද යන තීන්දුවක් නැත.'),
    evidence: notHadith,
    conditions: c('No conditions are published.', 'நிபந்தனைகள் வெளியிடப்படவில்லை.', 'කොන්දේසි පළ කර නැත.'),
    who: c('Not decided.', 'தீர்மானிக்கப்படவில்லை.', 'තීරණය කර නැත.'),
    dateBasis: c('Muharram 9, 10, and 11 on the selected calendar.', 'தேர்ந்த நாள்காட்டியில் முஹர்ரம் 9, 10, 11.', 'තෝරාගත් දින දර්ශනයේ මුහරම් 9, 10, 11.'),
    differences: c('Which combination of these days is preferred is not stated.', 'இந்த நாட்களில் எந்தச் சேர்க்கை விரும்பத்தக்கது என்று சொல்லப்படவில்லை.', 'මෙම දිනවල කුමන සංයෝජනය වඩාත් සුදුසුද යන්න නොකියයි.'),
    restrictions: c('None of these three dates is on the planner’s Eid block list.', 'இந்த மூன்று தேதிகளும் திட்டமிடுதலின் ஈத் தடைப் பட்டியலில் இல்லை.', 'මෙම දින තුන සැලසුමේ ඊද් වාරණ ලැයිස්තුවේ නැත.'),
    verseRefs: [],
  },
  {
    id: 'dhul-hijjah',
    title: c('The first days of Dhul Hijjah', 'துல் ஹிஜ்ஜாவின் முதல் நாட்கள்', 'දුල් හිජ්ජාගේ මුල් දින'),
    meaning: c('The first nine days are marked so the month can be read in context. A virtue or a required fast is not stated.', 'முதல் ஒன்பது நாட்கள் மாதத்தைப் பின்னணியில் படிக்கக் குறிக்கப்படுகின்றன. ஒரு சிறப்பும் கட்டாய நோன்பும் சொல்லப்படவில்லை.', 'මුල් දින නවය සන්දර්භයෙන් කියවීමට සලකුණු කර ඇත. ගුණයක් හෝ අනිවාර්ය උපවාසයක් කියන්නේ නැත.'),
    evidence: notHadith,
    conditions: c('Day 9 is also ʿArafah. Day 10 is not included here because it is Eid.', '9ஆம் நாள் அரஃபாவும் ஆகும். 10ஆம் நாள் ஈத் என்பதால் இங்கே சேர்க்கப்படவில்லை.', '9 වන දිනය අරෆා ද වේ. 10 වන දිනය ඊද් නිසා මෙහි ඇතුළත් නැත.'),
    who: c('Not decided.', 'தீர்மானிக்கப்படவில்லை.', 'තීරණය කර නැත.'),
    dateBasis: c('Dhul Hijjah 1–9 on the selected calendar.', 'தேர்ந்த நாள்காட்டியில் துல் ஹிஜ்ஜா 1–9.', 'තෝරාගත් දින දර්ශනයේ දුල් හිජ්ජා 1–9.'),
    differences: notHadith,
    restrictions: c('Days 10–13 are withheld from voluntary fasting.', '10–13 நாட்கள் தன்னார்வ நோன்பிலிருந்து நிறுத்தப்படும்.', '10–13 දින ස්වේච්ඡා උපවාසයෙන් රඳවයි.'),
    verseRefs: [],
  },
  {
    id: 'eid-fitr',
    title: c('Eid al-Fitr', 'ஈதுல் ஃபித்ர்', 'ඊදුල් ෆිත්ර්'),
    meaning: c('The first of Shawwal. The planner will not schedule a fast on this calculated date.', 'ஷவ்வால் முதல் நாள். இந்தக் கணக்குத் தேதியில் திட்டமிடுதல் நோன்பை வைக்காது.', 'ෂව්වාල් පළමු දිනය. මෙම ගණනය කළ දිනයේ සැලසුම උපවාසයක් නොසලසයි.'),
    evidence: notHadith,
    conditions: c('This block is a planner safety default, not a personal ruling. Sighting can move the day.', 'இந்தத் தடை திட்டமிடுதலின் பாதுகாப்பு இயல்பு. தனிப்பட்ட தீர்ப்பு அல்ல. பிறைப் பார்வை நாளை நகர்த்தலாம்.', 'මෙම වාරණය සැලසුමේ ආරක්ෂිත පෙරනිමියකි. පෞද්ගලික තීන්දුවක් නොවේ.'),
    who: c('Applied to the planner only.', 'திட்டமிடுதலுக்கு மட்டும்.', 'සැලසුමට පමණි.'),
    dateBasis: c('1 Shawwal.', '1 ஷவ்வால்.', 'ෂව්වාල් 1.'),
    differences: c('If your community’s Eid is a day earlier or later, set the calendar shift. Do not assume this grid matches a local announcement.', 'உங்கள் சமூகத்தின் ஈத் ஒரு நாள் முன்னோ பின்னோ இருந்தால் நாள்காட்டி நகர்வை அமையுங்கள்.', 'ඔබේ ප්‍රජාවේ ඊද් දිනක් ඉදිරියට හෝ පසුපසට නම් දින දර්ශන මාරුව සකසන්න.'),
    restrictions: c('Voluntary and make-up fasts are refused on this date.', 'இந்தத் தேதியில் தன்னார்வ மற்றும் ஈடுசெய்யும் நோன்புகள் மறுக்கப்படும்.', 'මෙම දිනයේ ස්වේච්ඡා සහ පිරවුම් උපවාස ප්‍රතික්ෂේප වේ.'),
    verseRefs: [],
  },
  {
    id: 'eid-adha',
    title: c('Eid al-Adha', 'ஈதுல் அள்ஹா', 'ඊදුල් අල්හා'),
    meaning: c('The 10th of Dhul Hijjah. The planner will not schedule a fast.', 'துல் ஹிஜ்ஜா 10. திட்டமிடுதல் நோன்பை வைக்காது.', 'දුල් හිජ්ජා 10. සැලසුම උපවාසයක් නොසලසයි.'),
    evidence: notHadith,
    conditions: c('Planner safety default, not a personal ruling.', 'திட்டமிடுதலின் பாதுகாப்பு இயல்பு; தனிப்பட்ட தீர்ப்பு அல்ல.', 'සැලසුමේ ආරක්ෂිත පෙරනිමිය; පෞද්ගලික තීන්දුවක් නොවේ.'),
    who: c('Applied to the planner only.', 'திட்டமிடுதலுக்கு மட்டும்.', 'සැලසුමට පමණි.'),
    dateBasis: c('10 Dhul Hijjah.', '10 துல் ஹிஜ்ஜா.', 'දුල් හිජ්ජා 10.'),
    differences: c('Sighting can move Eid. Adjust the calendar rather than treating one calculation as an announcement.', 'பிறைப் பார்வை ஈதை நகர்த்தலாம்.', 'දර්ශනය ඊද් චලනය කළ හැක.'),
    restrictions: c('Voluntary and make-up fasts are refused.', 'தன்னார்வ மற்றும் ஈடுசெய்யும் நோன்புகள் மறுக்கப்படும்.', 'ස්වේච්ඡා සහ පිරවුම් උපවාස ප්‍රතික්ෂේප වේ.'),
    verseRefs: [],
  },
  {
    id: 'tashreeq',
    title: c('Days of Tashreeq', 'தஷ்ரீக் நாட்கள்', 'තෂ්රීක් දින'),
    meaning: c('The 11th, 12th, and 13th of Dhul Hijjah. The planner withholds voluntary fasts.', 'துல் ஹிஜ்ஜா 11, 12, 13. திட்டமிடுதல் தன்னார்வ நோன்புகளை நிறுத்தும்.', 'දුල් හිජ්ජා 11, 12, 13. සැලසුම ස්වේච්ඡා උපවාස රඳවයි.'),
    evidence: notHadith,
    conditions: c('The 13th is also a white day. The restriction is explained on the calendar instead of offering both as equal suggestions.', '13ஆம் நாள் வெண்மை நாளும் ஆகும். இரண்டையும் சமப் பரிந்துரையாக வழங்குவதற்குப் பதிலாக நாள்காட்டி தடையை விளக்கும்.', '13 වන දිනය සුදු දිනයක් ද වේ. දෙකම සමාන යෝජනා ලෙස දීම වෙනුවට දින දර්ශනය සීමාව පැහැදිලි කරයි.'),
    who: c('Applied to the planner only.', 'திட்டமிடுதலுக்கு மட்டும்.', 'සැලසුමට පමණි.'),
    dateBasis: c('11–13 Dhul Hijjah.', '11–13 துல் ஹிஜ්ஜா.', 'දුල් හිජ්ජා 11–13.'),
    differences: notHadith,
    restrictions: c('Voluntary and make-up fasts are refused.', 'தன்னார்வ மற்றும் ஈடுசெய்யும் நோன்புகள் மறுக்கப்படும்.', 'ස්වේච්ඡා සහ පිරවුම් උපවාස ප්‍රතික්ෂේප වේ.'),
    verseRefs: [],
  },
];

export function occasionById(id: string): OccasionCopy | undefined {
  return OCCASIONS.find(item => item.id === id);
}

export const DUA_CATEGORIES = ['everyday', 'difficulty', 'guidance', 'family', 'protection', 'morning', 'sleep', 'after-prayer', 'travel', 'gratitude', 'repentance'] as const;

export interface DuaEntry {
  id: string;
  category: (typeof DUA_CATEGORIES)[number];
  refs: string[];
  kind: 'quran';
}

export const DUA_ENTRIES: DuaEntry[] = [
  { id: '2:201', category: 'everyday', refs: ['2:201'], kind: 'quran' },
  { id: '2:286', category: 'difficulty', refs: ['2:286'], kind: 'quran' },
  { id: '3:8', category: 'guidance', refs: ['3:8'], kind: 'quran' },
  { id: '20:25-28', category: 'guidance', refs: ['20:25-28'], kind: 'quran' },
  { id: '25:74', category: 'family', refs: ['25:74'], kind: 'quran' },
  { id: '112:1-4', category: 'protection', refs: ['112:1-4'], kind: 'quran' },
  { id: '113:1-5', category: 'protection', refs: ['113:1-5'], kind: 'quran' },
  { id: '114:1-6', category: 'protection', refs: ['114:1-6'], kind: 'quran' },
];

export const DHIKR = [
  { arabic: 'سُبْحَانَ ٱللَّٰهِ', meaning: c('Glory be to Allah. Editorial rendering, not a named edition.', 'அல்லாஹ் மகிமைப்படுவான். ஆசிரியர் வரைவு.', 'අල්ලාහ්ට මහිමය. කතෘ කෙටුම්පතකි.') },
  { arabic: 'ٱلْحَمْدُ لِلَّٰهِ', meaning: c('Praise be to Allah. Editorial rendering.', 'அல்லாஹ்வுக்கே புகழ். ஆசிரியர் வரைவு.', 'ප්‍රශංසාව අල්ලාහ්ටයි. කතෘ කෙටුම්පතකි.') },
  { arabic: 'ٱللَّٰهُ أَكْبَرُ', meaning: c('Allah is greater. Editorial rendering.', 'அல்லாஹ் மிகப் பெரியவன். ஆசிரியர் வரைவு.', 'අල්ලාහ් ශ්‍රේෂ්ඨයි. කතෘ කෙටුම්පතකි.') },
  { arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', meaning: c('There is no god except Allah. Editorial rendering.', 'அல்லாஹ்வைத் தவிர இறைவன் இல்லை. ஆசிரியர் வரைவு.', 'අල්ලාහ් හැර දෙවියෙකු නැත. කතෘ කෙටුම්පතකි.') },
  { arabic: 'أَسْتَغْفِرُ ٱللَّٰهَ', meaning: c('I ask Allah for forgiveness. Editorial rendering.', 'அல்லாஹ்விடம் மன்னிப்பு கேட்கிறேன். ஆசிரியர் வரைவு.', 'අල්ලාහ්ගෙන් සමාව ඉල්ලමි. කතෘ කෙටුම්පතකි.') },
];

export interface SearchHit {
  href: string;
  title: string;
  kind: string;
}

export function searchSpiritual(query: string, lang: Lang): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const item of GUIDES) {
    const blob = [item.title[lang], item.summary[lang], ...item.sections.flatMap(section => section.paragraphs?.map(p => p[lang]) ?? [])]
      .join(' ')
      .toLowerCase();
    if (blob.includes(needle)) hits.push({ href: `#/spiritual/${item.path.join('/')}`, title: item.title[lang], kind: item.id });
  }
  for (const item of OCCASIONS) {
    if (`${item.title[lang]} ${item.meaning[lang]}`.toLowerCase().includes(needle)) {
      hits.push({ href: `#/spiritual/fasting/occasions/${item.id}`, title: item.title[lang], kind: 'occasion' });
    }
  }
  return hits.slice(0, 12);
}

export function guideHasReviewClaim(guide: Guide): boolean {
  return editorialLabel(guide.meta) === 'scholar-reviewed';
}

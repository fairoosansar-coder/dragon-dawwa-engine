import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lang } from '../shared/sources.ts';
import { readSeekerSession, sanitizeSeekerEmblem, type SeekerAuthMethod, type SeekerEmblem } from './seekerAuth.ts';

export type WallPostTheme = 'emerald' | 'amethyst' | 'obsidian' | 'sapphire' | 'amber';

export interface WallThemeSpec {
  id: WallPostTheme;
  label: string;
  classes: string;
  cssGradient: string;
  canvasStops: [string, string, string];
  accentHex: string;
  pillBorderClass: string;
}

export const WALL_THEMES: Record<WallPostTheme, WallThemeSpec> = {
  emerald: {
    id: 'emerald',
    label: 'Emerald',
    classes: 'bg-gradient-to-br from-[#041B14] via-[#0A2E23] to-[#041B14] border-[#D4AF37]/35',
    cssGradient: 'linear-gradient(135deg, #041B14 0%, #0A2E23 50%, #041B14 100%)',
    canvasStops: ['#041B14', '#0A2E23', '#041B14'],
    accentHex: '#D4AF37',
    pillBorderClass: 'border-[#D4AF37]/45',
  },
  amethyst: {
    id: 'amethyst',
    label: 'Amethyst',
    classes: 'bg-gradient-to-br from-[#1A0B2E] via-[#2A0845] to-[#120524] border-[#E0B0FF]/35',
    cssGradient: 'linear-gradient(135deg, #1A0B2E 0%, #2A0845 50%, #120524 100%)',
    canvasStops: ['#1A0B2E', '#2A0845', '#120524'],
    accentHex: '#E0B0FF',
    pillBorderClass: 'border-[#E0B0FF]/45',
  },
  obsidian: {
    id: 'obsidian',
    label: 'Obsidian',
    classes: 'bg-gradient-to-br from-[#0B0F10] via-[#1A2326] to-[#0B0F10] border-stone-600/40',
    cssGradient: 'linear-gradient(135deg, #0B0F10 0%, #1A2326 50%, #0B0F10 100%)',
    canvasStops: ['#0B0F10', '#1A2326', '#0B0F10'],
    accentHex: '#D4AF37',
    pillBorderClass: 'border-stone-500/45',
  },
  sapphire: {
    id: 'sapphire',
    label: 'Sapphire',
    classes: 'bg-gradient-to-br from-[#051329] via-[#0B2545] to-[#030D1B] border-sky-400/35',
    cssGradient: 'linear-gradient(135deg, #051329 0%, #0B2545 50%, #030D1B 100%)',
    canvasStops: ['#051329', '#0B2545', '#030D1B'],
    accentHex: '#7DD3FC',
    pillBorderClass: 'border-sky-400/45',
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    classes: 'bg-gradient-to-br from-[#241407] via-[#3D230D] to-[#1C0F05] border-amber-500/35',
    cssGradient: 'linear-gradient(135deg, #241407 0%, #3D230D 50%, #1C0F05 100%)',
    canvasStops: ['#241407', '#3D230D', '#1C0F05'],
    accentHex: '#F59E0B',
    pillBorderClass: 'border-amber-500/45',
  },
};

export const WALL_THEME_LIST: WallThemeSpec[] = [
  WALL_THEMES.emerald,
  WALL_THEMES.amethyst,
  WALL_THEMES.obsidian,
  WALL_THEMES.sapphire,
  WALL_THEMES.amber,
];

export function sanitizeWallTheme(value: unknown): WallPostTheme {
  if (
    value === 'emerald' ||
    value === 'amethyst' ||
    value === 'obsidian' ||
    value === 'sapphire' ||
    value === 'amber'
  ) {
    return value;
  }
  return 'emerald';
}

export interface DhikrReactionSpec {
  id: string;
  transliteration: string;
  arabic: string;
  meaning: string;
  kind: 'dhikr' | 'asma';
}

export const CORE_DHIKR_REACTIONS: readonly DhikrReactionSpec[] = [
  { id: 'mashaallah', transliteration: 'Māshā’Allāh', arabic: 'ما شاء الله', meaning: 'As Allah willed', kind: 'dhikr' },
  { id: 'allahu_akbar', transliteration: 'Allāhu Akbar', arabic: 'الله أكبر', meaning: 'Allah is the Greatest', kind: 'dhikr' },
  { id: 'subhanallah', transliteration: 'SubḥānAllāh', arabic: 'سبحان الله', meaning: 'Glory be to Allah', kind: 'dhikr' },
  { id: 'alhamdulillah', transliteration: 'Alḥamdulillāh', arabic: 'الحمد لله', meaning: 'All praise is due to Allah', kind: 'dhikr' },
  { id: 'amin', transliteration: 'Āmīn', arabic: 'آمين', meaning: 'O Allah, accept', kind: 'dhikr' },
];

export interface ContextualDivineName {
  id: string;
  transliteration: string;
  arabic: string;
  meaning: string;
}

const DIVINE_NAME_CATALOG: Record<string, ContextualDivineName> = {
  al_ahad: { id: 'asma:al_ahad', transliteration: 'Al-Aḥad', arabic: 'الأَحَدُ', meaning: 'The One and Indivisible' },
  al_qayyum: { id: 'asma:al_qayyum', transliteration: 'Al-Qayyūm', arabic: 'الْقَيُّومُ', meaning: 'The All-Sustaining' },
  al_hayy: { id: 'asma:al_hayy', transliteration: 'Al-Ḥayy', arabic: 'الْحَيُّ', meaning: 'The Ever-Living' },
  ar_rahman: { id: 'asma:ar_rahman', transliteration: 'Ar-Raḥmān', arabic: 'الرَّحْمَٰنُ', meaning: 'The Entirely Merciful' },
  al_ghafur: { id: 'asma:al_ghafur', transliteration: 'Al-Ghafūr', arabic: 'الْغَفُورُ', meaning: 'The All-Forgiving' },
  al_fattah: { id: 'asma:al_fattah', transliteration: 'Al-Fattāḥ', arabic: 'الْفَتَّاحُ', meaning: 'The Opener of Relief' },
  al_latif: { id: 'asma:al_latif', transliteration: 'Al-Laṭīf', arabic: 'اللَّطِيفُ', meaning: 'The Subtle and Kind' },
  al_alim: { id: 'asma:al_alim', transliteration: 'Al-ʿAlīm', arabic: 'الْعَلِيمُ', meaning: 'The All-Knowing' },
  al_hakim: { id: 'asma:al_hakim', transliteration: 'Al-Ḥakīm', arabic: 'الْحَكِيمُ', meaning: 'The All-Wise' },
  an_nur: { id: 'asma:an_nur', transliteration: 'An-Nūr', arabic: 'النُّورُ', meaning: 'The Light' },
  al_hadi: { id: 'asma:al_hadi', transliteration: 'Al-Hādī', arabic: 'الْهَادِي', meaning: 'The Guide' },
  as_sabur: { id: 'asma:as_sabur', transliteration: 'Aṣ-Ṣabūr', arabic: 'الصَّبُورُ', meaning: 'The Most Patient' },
  al_wakil: { id: 'asma:al_wakil', transliteration: 'Al-Wakīl', arabic: 'الْوَكِيلُ', meaning: 'The Disposer of Affairs' },
  ash_shakur: { id: 'asma:ash_shakur', transliteration: 'Ash-Shakūr', arabic: 'الشَّكُورُ', meaning: 'The Appreciative' },
};

/**
 * Contextual Asma-ul-Husna engine: returns 2 to 3 Divine Names relevant to a verse's surah, ayah, and text/reflection.
 */
export function getContextualNamesOfAllah(
  surah: number,
  ayah: number,
  content = '',
): ContextualDivineName[] {
  const picked: ContextualDivineName[] = [];
  const add = (key: keyof typeof DIVINE_NAME_CATALOG) => {
    const item = DIVINE_NAME_CATALOG[key];
    if (item && !picked.some(p => p.id === item.id)) picked.push(item);
  };

  const lower = content.toLowerCase();

  // Specific Surah & Ayah matches
  if ((surah === 2 && ayah === 255) || surah === 112 || /kursi|tawhid|oneness|deity|slumber|قَيُّوم|أَحَد/i.test(content)) {
    add('al_ahad');
    add('al_qayyum');
    add('al_hayy');
  }
  if ((surah === 20 && ayah === 114) || (surah === 2 && ayah === 269) || surah === 96 || /knowledge|wisdom|learn|teach|scholar|عِلْم|حِكْم/i.test(content)) {
    add('al_alim');
    add('al_hakim');
  }
  if (surah === 94 || (surah === 2 && ayah === 286) || /hardship|ease|relief|burden|trial|عُسْر|يُسْر|وُسْعَهَا/i.test(content)) {
    add('al_fattah');
    add('al_latif');
  }
  if (surah === 1 || (surah === 2 && ayah <= 5) || (surah === 24 && ayah === 35) || /guidance|light|straight path|mindful|righteous|هُدًى|نُور|صِرَٰط/i.test(content)) {
    add('an_nur');
    add('al_hadi');
  }
  if (/mercy|merciful|forgive|forgiveness|compassion|رَحْم|غَفُور|அருளாளன்|කරුණා/i.test(lower)) {
    add('al_ghafur');
    add('ar_rahman');
  }
  if (/patience|patient|sabr|persevere|trust|rely|صَبْر|وَكِيل|பொறுமை|ඉවසීම/i.test(lower)) {
    add('as_sabur');
    add('al_wakil');
  }
  if (/praise|gratitude|thankful|alhamdulillah|حَمْد|شَكُور|புகழ்|ನன்றி|ප්‍රශංසා/i.test(lower)) {
    add('ash_shakur');
    add('ar_rahman');
  }

  // Ensure 2 to 3 names are always returned
  if (picked.length < 2) {
    add('ar_rahman');
    add('al_hadi');
  }
  if (picked.length < 2) {
    add('al_qayyum');
  }

  return picked.slice(0, 3);
}

export function formatPostTimestamp(iso: string, nowMs = Date.now()): { absolute: string; relative: string; combined: string } {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return { absolute: 'Nov 8, 2026 · 5:30 PM', relative: 'Recent', combined: 'Nov 8, 2026 · 5:30 PM' };
    }
    const datePart = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const absolute = `${datePart} · ${timePart}`;
    const diffSec = Math.max(0, Math.floor((nowMs - d.getTime()) / 1000));
    let relative = 'Just now';
    if (diffSec >= 86400 * 7) {
      relative = `${Math.floor(diffSec / (86400 * 7))}w ago`;
    } else if (diffSec >= 86400) {
      relative = `${Math.floor(diffSec / 86400)}d ago`;
    } else if (diffSec >= 3600) {
      relative = `${Math.floor(diffSec / 3600)}h ago`;
    } else if (diffSec >= 60) {
      relative = `${Math.floor(diffSec / 60)}m ago`;
    }
    return { absolute, relative, combined: `${absolute} (${relative})` };
  } catch {
    return { absolute: 'Nov 8, 2026 · 5:30 PM', relative: 'Recent', combined: 'Nov 8, 2026 · 5:30 PM' };
  }
}

export interface FaithWallReply {
  id: string;
  postId: string;
  userId?: string;
  authorName: string;
  authorRole: string;
  authorEmblem?: SeekerEmblem;
  authorAvatarUrl?: string | null;
  text: string;
  createdAt: string;
}

export interface ReadingLink {
  surah?: number;
  ayah?: number;
  lang?: Lang;
  edition?: string;
}

export interface ShareVerse {
  surah: number;
  ayah: number;
  arabic: string;
  translation: string;
  footnotes?: string;
  surahName: string;
  translationTitle?: string;
  translationKey?: string;
  translationVersion?: string;
  translationDescription?: string;
  /** Shown in place of the surah:ayah line when this share is not a verse. */
  reference?: string;
  /** Catalogue name. Verse shares stay QuranEnc when this is omitted. */
  sourceLabel?: string;
}

export function parseReadingLink(hash: string): ReadingLink {
  const query = hash.split('?')[1]?.split('#')[0] ?? '';
  const params = new URLSearchParams(query);
  const link: ReadingLink = {};
  const surah = Number(params.get('surah'));
  if (Number.isInteger(surah) && surah >= 1 && surah <= 114) link.surah = surah;
  const ayah = Number(params.get('ayah'));
  if (Number.isInteger(ayah) && ayah >= 1 && ayah <= 286) link.ayah = ayah;
  const lang = params.get('lang');
  if (lang === 'en' || lang === 'ta' || lang === 'si') link.lang = lang;
  const edition = params.get('edition') ?? '';
  if (/^[a-z0-9_]+$/.test(edition)) link.edition = edition;
  return link;
}

export function readingLinkHash(input: { surah: number; ayah: number; lang: Lang; edition: string; mode?: 'book' | 'study' }): string {
  const params = new URLSearchParams({
    surah: String(input.surah),
    ayah: String(input.ayah),
    lang: input.lang,
    edition: input.edition,
  });
  return `#/quran/${input.mode ?? 'book'}?${params.toString()}`;
}

export function absoluteReadingUrl(hash: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname;
  return `${origin}${hash}`;
}

/** Full verse wording, footnotes, and attribution. Nothing is shortened or rewritten. */
export function verseShareText(verse: ShareVerse): string {
  const parts = [verse.arabic, verse.translation];
  if (verse.footnotes) parts.push(verse.footnotes);
  parts.push(verse.reference ?? `${verse.surahName} ${verse.surah}:${verse.ayah}`);
  if (verse.translationTitle) parts.push(verse.translationTitle);
  const identity = [verse.translationKey, verse.translationVersion].filter(Boolean).join(' · ');
  if (identity) parts.push(identity);
  if (verse.translationDescription) parts.push(verse.translationDescription);
  parts.push(verse.sourceLabel ?? 'QuranEnc');
  return parts.join('\n\n');
}

export type WallPostType = 'reflection' | 'podcast' | 'good_deed';
export type WallPostStatus = 'pending' | 'approved' | 'rejected';
export type GoodDeedCategory = 'charity' | 'dhikr' | 'kindness';

export interface FaithWallPost {
  id: string;
  userId?: string;
  type?: WallPostType;
  status?: WallPostStatus;
  isPinned?: boolean;
  isOfficialBroadcast?: boolean;
  isAnonymous?: boolean;
  deedCategory?: GoodDeedCategory;
  deedTitle?: string;
  joinedCount?: number;
  userJoined?: boolean;
  surah: number;
  ayah: number;
  surahName: string;
  arabic: string;
  translation: string;
  reflection: string;
  lang: Lang;
  url: string;
  theme?: WallPostTheme;
  podcastId?: string;
  podcastTitle?: string;
  podcastAudioUrl?: string;
  podcastDuration?: string;
  podcastCitations?: string[];
  hadithCollection?: string;
  hadithNumber?: number;
  hadithGrade?: string;
  cardDataUrl?: string;
  authorName?: string;
  authorHandle?: string;
  authorRole?: string;
  authorEmblem?: SeekerEmblem;
  authorAvatarUrl?: string | null;
  authorAuthProvider?: SeekerAuthMethod;
  verified?: boolean;
  likes?: number;
  liked?: boolean;
  reactions?: Record<string, number>;
  userReactions?: string[];
  replies?: FaithWallReply[];
  saved?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CompletedPodcastOption {
  id: string;
  title: string;
  summary: string;
  duration: string;
  audioUrl: string;
  lang: Lang;
  citations: string[];
  surah: number;
  ayah: number;
  surahName: string;
  arabic: string;
  translation: string;
  createdAt: string;
}

export const SEEDED_COMPLETED_PODCASTS: CompletedPodcastOption[] = [
  {
    id: 'pod-qasr-travelers-4-101',
    title: 'Shortening Prayer (Qaṣr) on Journeys: Qur’an 4:101 & Prophetic Practice',
    summary: '4-persona scholarly roundtable examining Surah An-Nisa 4:101, Sahih Muslim narrations on travel distance, and contemporary expatriate rulings.',
    duration: '06:42',
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/594.mp3',
    lang: 'en',
    citations: ['Qur’an 4:101', 'Sahih Muslim 686', 'Al-Mukhtasar 4:101'],
    surah: 4,
    ayah: 101,
    surahName: 'An-Nisa',
    arabic: 'وَإِذَا ضَرَبْتُمْ فِى ٱلْأَرْضِ فَلَيْسَ عَلَيْكُمْ جُنَاحٌ أَن تَقْصُرُوا۟ مِنَ ٱلصَّلَوٰةِ',
    translation: 'And when you travel throughout the land, there is no blame upon you for shortening the prayer.',
    createdAt: '2026-11-07T14:20:00.000Z',
  },
  {
    id: 'pod-sabr-mercy-2-153',
    title: 'Patience & Prayer in Times of Trial: Tafsir of Surah Al-Baqara 2:153–157',
    summary: 'Dr. Layla al-Qasimi and Shaykh Farhan explore how sabr and salah anchor the believer through loss and uncertainty.',
    duration: '08:15',
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/160.mp3',
    lang: 'en',
    citations: ['Qur’an 2:153', 'Qur’an 2:155', 'Sahih al-Bukhari 5641'],
    surah: 2,
    ayah: 153,
    surahName: 'Al-Baqara',
    arabic: 'يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ',
    translation: 'O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.',
    createdAt: '2026-11-06T20:00:00.000Z',
  },
  {
    id: 'pod-tamil-gratitude-14-7',
    title: 'நன்றியுணர்வும் இறை அருளும்: சூரா இப்ராஹீம் 14:7 ஆய்வு உரையாடல்',
    summary: 'குர்ஆன் 14:7 மற்றும் ஹதீஸ் ஆதாரங்களின் அடிப்படையில் நன்றியுணர்வின் ஆன்மீகப் பரிமாணங்கள்.',
    duration: '05:50',
    audioUrl: 'https://d.quranenc.com/data/audio/tamil_omar_brief/014007.mp3',
    lang: 'ta',
    citations: ['Qur’an 14:7', 'Al-Mukhtasar 14:7'],
    surah: 14,
    ayah: 7,
    surahName: 'Ibrahim',
    arabic: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ',
    translation: 'நீங்கள் நன்றி செலுத்தினால், உங்களுக்கு நான் மென்மேலும் அதிகப்படுத்துவேன்.',
    createdAt: '2026-11-05T16:40:00.000Z',
  },
];

export type ModerationMode = 'instant' | 'review';
export type DeskPaletteId = 'emerald-gold' | 'amethyst-obsidian' | 'parchment-slate';

export interface ClientAdminSettings {
  moderationMode: ModerationMode;
  heroBannerUrl: string;
  deskPalette: DeskPaletteId;
}

export interface ScholarQuestionItem {
  id: string;
  userId?: string;
  userName: string;
  question: string;
  language: Lang;
  status: 'open' | 'answered';
  answer?: string;
  answeredBy?: string;
  citations?: string[];
  createdAt: string;
  answeredAt?: string;
}

export const ADMIN_SETTINGS_EVENT = 'kf-admin-settings-updated';
export const SCHOLAR_QA_EVENT = 'kf-scholar-qa-updated';

const ADMIN_SETTINGS_KEY = 'kf-admin-settings';
const WALL_MODERATION_MAP_KEY = 'kf-wall-moderation-status';
const SCHOLAR_QUESTIONS_KEY = 'kf-scholar-questions';

export const FAITH_WALL_EVENT = 'kf-faith-wall-updated';

const WALL_STORAGE_KEY = 'kf-public-faith-wall';
const WALL_LIKES_KEY = 'kf-public-faith-wall-likes';
const WALL_REACTIONS_KEY = 'kf-public-faith-wall-reactions';
const WALL_REPLIES_KEY = 'kf-public-faith-wall-replies';
const WALL_SAVED_KEY = 'kf-public-faith-wall-saved';
const WALL_JOINED_SUNNAH_KEY = 'kf-public-faith-wall-joined-sunnah';
const COMMUNITY_CIRCLE_KEY = 'kf-weekly-community-circle';
const WALL_NOTIFICATIONS_KEY = 'kf-wall-notifications';

export const SEEDED_FAITH_WALL_POSTS: FaithWallPost[] = [
  {
    id: 'seed-wall-sunnah-kahf',
    type: 'good_deed',
    status: 'approved',
    isAnonymous: true,
    deedCategory: 'dhikr',
    deedTitle: 'Read Surah Al-Kahf on Friday & Morning Adhkar',
    joinedCount: 48,
    surah: 18,
    ayah: 10,
    surahName: 'Al-Kahf',
    arabic: 'رَبَّنَآ ءَاتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا',
    translation: 'Our Lord, grant us from Yourself mercy and prepare for us from our affair right guidance.',
    reflection: 'Completed my morning Adhkar and the opening verses of Surah Al-Kahf. Sharing anonymously to encourage our circle—join this Sunnah today!',
    lang: 'en',
    theme: 'emerald',
    url: '#/quran/book?surah=18&ayah=10&lang=en&edition=english_rwwad',
    authorName: 'Anonymous Seeker',
    authorHandle: '@anonymous',
    authorRole: 'Sincere Sunnah Pledge',
    authorEmblem: 'emerald-lamp',
    verified: true,
    likes: 19,
    reactions: {
      amin: 19,
      alhamdulillah: 14,
      mashaallah: 11,
    },
    replies: [],
    createdAt: '2026-11-06T20:15:00.000Z',
  },
  {
    id: 'seed-wall-hadith-bukhari-1',
    type: 'reflection',
    status: 'approved',
    surah: 1,
    ayah: 1,
    surahName: 'Sahih al-Bukhari',
    hadithCollection: 'Sahih al-Bukhari',
    hadithNumber: 1,
    hadithGrade: 'Sahih',
    arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    translation: 'Actions are judged only by intentions, and every person shall have only what they intended.',
    reflection: 'Imam al-Shafi‘i noted that this foundational Hadith of Umar ibn al-Khattab encompasses a third of sacred knowledge—reminding us to renew our ikhlas before every word and deed.',
    lang: 'en',
    theme: 'emerald',
    url: '#/hadith',
    authorName: 'Sheikh Farhan Siddiqui',
    authorHandle: '@sheikhfarhansiddiqui',
    authorRole: 'Classical Hadith Circle',
    authorEmblem: 'emerald-lamp',
    verified: true,
    likes: 53,
    reactions: {
      amin: 24,
      subhanallah: 18,
      alhamdulillah: 16,
    },
    replies: [],
    createdAt: '2026-11-06T19:45:00.000Z',
  },
  {
    id: 'seed-wall-2-255-en',
    surah: 2,
    ayah: 255,
    surahName: 'Al-Baqara',
    arabic: 'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ',
    translation: 'Allah — there is no deity except Him, the Ever-Living, the All-Sustaining. Neither drowsiness overtakes Him nor sleep.',
    reflection: 'Reciting Ayat al-Kursi before sleep brings unshakable tranquility—knowing the Ever-Living Sustainer never slumbers over His creation.',
    lang: 'en',
    theme: 'emerald',
    url: '#/quran/book?surah=2&ayah=255&lang=en&edition=english_rwwad',
    authorName: 'Dr. Layla al-Qasimi',
    authorRole: 'Qur’anic Studies Fellow',
    authorEmblem: 'rub-el-hizb',
    verified: true,
    likes: 48,
    reactions: {
      subhanallah: 19,
      allahu_akbar: 15,
      amin: 14,
      'asma:al_qayyum': 22,
      'asma:al_ahad': 16,
    },
    replies: [
      {
        id: 'seed-reply-1',
        postId: 'seed-wall-2-255-en',
        authorName: 'Ustadh Tariq M.',
        authorRole: 'Verified Teacher',
        authorEmblem: 'crescent-star',
        text: 'SubḥānAllāh, pairing Al-Ḥayy with Al-Qayyūm is the greatest anchor of tawakkul.',
        createdAt: '2026-11-06T19:10:00.000Z',
      },
    ],
    createdAt: '2026-11-06T18:30:00.000Z',
  },
  {
    id: 'seed-wall-94-5-en',
    surah: 94,
    ayah: 5,
    surahName: 'Ash-Sharh',
    arabic: 'فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
    translation: 'For indeed, with hardship comes ease. Indeed, with hardship comes ease.',
    reflection: 'Notice the preposition “ma‘a” (with), not merely “after”—relief is woven alongside the trial itself for those who persevere with sabr.',
    lang: 'en',
    theme: 'amethyst',
    url: '#/quran/book?surah=94&ayah=5&lang=en&edition=english_rwwad',
    authorName: 'Ustadh Tariq M.',
    authorRole: 'Verified Teacher',
    authorEmblem: 'crescent-star',
    verified: true,
    likes: 64,
    reactions: {
      alhamdulillah: 28,
      mashaallah: 18,
      amin: 18,
      'asma:al_fattah': 24,
      'asma:al_latif': 19,
    },
    replies: [],
    createdAt: '2026-11-06T15:15:00.000Z',
  },
  {
    id: 'seed-wall-1-2-ta',
    userId: 'seeker-fairoosseeker',
    type: 'reflection',
    status: 'approved',
    surah: 1,
    ayah: 2,
    surahName: 'Al-Faatiha',
    arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    translation: 'புகழ் அனைத்தும் அகிலங்களின் இறைவனாகிய அல்லாஹ்வுக்கே உரியது.',
    reflection: 'ஒவ்வொரு தொழுகையிலும் நாம் மீண்டும் மீண்டும் ஓதும் இந்த வசனம், நன்றியுணர்வே ஈமானின் அடிப்படை என்பதை நினைவூட்டுகிறது.',
    lang: 'ta',
    theme: 'sapphire',
    url: '#/quran/book?surah=1&ayah=2&lang=ta&edition=tamil_omar_brief',
    authorName: 'Brother Feroz Ansar',
    authorHandle: '@brotherferozansar',
    authorRole: 'Community Researcher',
    authorEmblem: 'octagon-rosette',
    verified: true,
    likes: 37,
    reactions: {
      alhamdulillah: 21,
      subhanallah: 16,
      'asma:ar_rahman': 15,
      'asma:al_hadi': 12,
    },
    replies: [],
    createdAt: '2026-11-06T12:00:00.000Z',
  },
  {
    id: 'seed-wall-podcast-feroz-1',
    userId: 'seeker-fairoosseeker',
    type: 'podcast',
    status: 'approved',
    surah: 4,
    ayah: 101,
    surahName: 'An-Nisa',
    arabic: 'وَإِذَا ضَرَبْتُمْ فِى ٱلْأَرْضِ فَلَيْسَ عَلَيْكُمْ جُنَاحٌ أَن تَقْصُرُوا۟ مِنَ ٱلصَّلَوٰةِ',
    translation: 'And when you travel throughout the land, there is no blame upon you for shortening the prayer.',
    reflection: 'In this roundtable episode, our 4-scholar panel examines how Qur’an 4:101 and Sahih Muslim 686 frame the mercy of Qaṣr prayer for travelers.',
    lang: 'en',
    theme: 'emerald',
    podcastId: 'pod-qasr-travelers-4-101',
    podcastTitle: 'Shortening Prayer (Qaṣr) on Journeys: Qur’an 4:101 & Prophetic Practice',
    podcastAudioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/594.mp3',
    podcastDuration: '06:42',
    podcastCitations: ['Qur’an 4:101', 'Sahih Muslim 686', 'Al-Mukhtasar 4:101'],
    url: '#/podcast',
    authorName: 'Brother Feroz Ansar',
    authorHandle: '@brotherferozansar',
    authorRole: 'Community Researcher',
    authorEmblem: 'rub-el-hizb',
    verified: true,
    likes: 42,
    reactions: {
      mashaallah: 19,
      alhamdulillah: 14,
      'asma:ar_rahman': 17,
    },
    replies: [],
    createdAt: '2026-11-06T14:00:00.000Z',
  },
  {
    id: 'seed-wall-2-286-si',
    type: 'reflection',
    status: 'approved',
    surah: 2,
    ayah: 286,
    surahName: 'Al-Baqara',
    arabic: 'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    translation: 'අල්ලාහ් කිසිදු ආත්මයකට එහි හැකියාවට වඩා බරක් නොපවරයි.',
    reflection: 'ජීවිතයේ කුමන පරීක්ෂාවක් පැමිණියද, එය දරාගැනීමේ ශක්තිය අල්ලාහ් අප තුළම තබා ඇති බව මෙම වාක්‍යයෙන් සනාථ වේ.',
    lang: 'si',
    theme: 'amber',
    url: '#/quran/book?surah=2&ayah=286&lang=si&edition=sinhalese_mahir',
    authorName: 'Sister Amina K.',
    authorHandle: '@sisteraminak',
    authorRole: 'Student of Knowledge',
    authorEmblem: 'emerald-lamp',
    verified: true,
    likes: 29,
    reactions: {
      amin: 17,
      mashaallah: 12,
      'asma:al_fattah': 11,
      'asma:al_latif': 14,
    },
    replies: [],
    createdAt: '2026-11-06T09:45:00.000Z',
  },
];

export const SEEDED_PENDING_WALL_POSTS: FaithWallPost[] = [
  {
    id: 'seed-pending-wall-20-114',
    userId: 'seeker-zaydalansari',
    type: 'reflection',
    status: 'pending',
    surah: 20,
    ayah: 114,
    surahName: 'Ta-Ha',
    arabic: 'وَقُل رَّبِّ زِدْنِى عِلْمًا',
    translation: 'And say: My Lord, increase me in knowledge.',
    reflection: 'Beginning my morning study of Usool al-Tafsir with this prophetic supplication for beneficial knowledge.',
    lang: 'en',
    theme: 'obsidian',
    url: '#/quran/book?surah=20&ayah=114&lang=en&edition=english_rwwad',
    authorName: 'Ustadh Zayd al-Ansari',
    authorHandle: '@ustadhzayd',
    authorRole: 'Seeker of Knowledge',
    authorEmblem: 'crescent-star',
    verified: true,
    likes: 1,
    reactions: { amin: 1 },
    replies: [],
    createdAt: '2026-11-07T16:10:00.000Z',
  },
  {
    id: 'seed-pending-podcast-2-153',
    userId: 'seeker-laylamansoor',
    type: 'podcast',
    status: 'pending',
    surah: 2,
    ayah: 153,
    surahName: 'Al-Baqara',
    arabic: 'يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ',
    translation: 'O you who have believed, seek help through patience and prayer.',
    reflection: 'Sharing our latest roundtable episode on how sabr and salah work together during family hardship.',
    lang: 'en',
    theme: 'amethyst',
    podcastId: 'pod-sabr-mercy-2-153',
    podcastTitle: 'Patience & Prayer in Times of Trial: Tafsir of Surah Al-Baqara 2:153–157',
    podcastAudioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/160.mp3',
    podcastDuration: '08:15',
    podcastCitations: ['Qur’an 2:153', 'Qur’an 2:155', 'Sahih al-Bukhari 5641'],
    url: '#/podcast',
    authorName: 'Sister Layla Mansoor',
    authorHandle: '@sisterlayla',
    authorRole: 'Student of Qur’anic Tafsir',
    authorEmblem: 'octagon-rosette',
    verified: true,
    likes: 1,
    reactions: { amin: 1 },
    replies: [],
    createdAt: '2026-11-07T17:05:00.000Z',
  },
];

export const SEEDED_SCHOLAR_QUESTIONS: ScholarQuestionItem[] = [
  {
    id: 'qa-seed-1',
    userName: 'Brother Bilal R.',
    question: 'When combining Maghrib and Isha prayers during heavy rain or travel, do we recite the Sunnah rawatib prayers between them or after both fard prayers?',
    language: 'en',
    status: 'open',
    createdAt: '2026-11-07T11:30:00.000Z',
  },
  {
    id: 'qa-seed-2',
    userName: 'Sister Fathima S.',
    question: 'தொழுகையில் சூரா அல்-ஃபாத்திஹாவுக்குப் பிறகு சிறிய சூராக்களை ஓதும்போது வரிசைக் கிரமத்தைப் பேணுவது அவசியமா?',
    language: 'ta',
    status: 'open',
    createdAt: '2026-11-07T09:15:00.000Z',
  },
  {
    id: 'qa-seed-3',
    userName: 'Ustadh Tariq M.',
    question: 'How do classical mufassirun reconcile the apparent lexical count of “yawm” in the Qur’an with contextual usages such as “yawma’idhin”?',
    language: 'en',
    status: 'answered',
    answer: 'Classical scholars of ‘Ulum al-Qur’an distinguish between the singular indeterminate/determinate noun “yawm” (day) and compound adverbial forms such as “yawma’idhin” (on that Day). Both are examined in context rather than by detached string counting.',
    answeredBy: 'Dr. Layla al-Qasimi · Institutional Scholarly Board',
    citations: ['Surah Al-Baqara 2:85', 'Al-Itqan fi Ulum al-Quran'],
    createdAt: '2026-11-06T10:00:00.000Z',
    answeredAt: '2026-11-06T15:40:00.000Z',
  },
];

const memoryWallPosts: FaithWallPost[] = [];
const memoryLikedIds = new Set<string>();
const memoryUserReactions = new Map<string, Set<string>>();
const memoryPostReplies = new Map<string, FaithWallReply[]>();
const memorySavedPostIds = new Set<string>();
const memoryModerationStatus = new Map<string, { status?: WallPostStatus; isPinned?: boolean }>();
let memoryAdminSettings: ClientAdminSettings = {
  moderationMode: 'instant',
  heroBannerUrl: '/assets/banner-art.jpg',
  deskPalette: 'emerald-gold',
};
let memoryScholarQuestions: ScholarQuestionItem[] = [];

function readModerationMap(): Record<string, { status?: WallPostStatus; isPinned?: boolean }> {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(WALL_MODERATION_MAP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed as Record<string, { status?: WallPostStatus; isPinned?: boolean }>;
      }
    } catch {
      /* ignore */
    }
  }
  const out: Record<string, { status?: WallPostStatus; isPinned?: boolean }> = {};
  memoryModerationStatus.forEach((val, key) => {
    out[key] = val;
  });
  return out;
}

function saveModerationMap(map: Record<string, { status?: WallPostStatus; isPinned?: boolean }>) {
  memoryModerationStatus.clear();
  for (const [k, v] of Object.entries(map)) {
    memoryModerationStatus.set(k, v);
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WALL_MODERATION_MAP_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }
}

export function readAdminSettings(): ClientAdminSettings {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(ADMIN_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ClientAdminSettings>;
        if (parsed && typeof parsed === 'object') {
          return {
            moderationMode: parsed.moderationMode === 'review' ? 'review' : 'instant',
            heroBannerUrl: parsed.heroBannerUrl || '/assets/banner-art.jpg',
            deskPalette:
              parsed.deskPalette === 'amethyst-obsidian' || parsed.deskPalette === 'parchment-slate'
                ? parsed.deskPalette
                : 'emerald-gold',
          };
        }
      }
    } catch {
      /* ignore */
    }
  }
  return { ...memoryAdminSettings };
}

export async function saveAdminSettings(patch: Partial<ClientAdminSettings>): Promise<ClientAdminSettings> {
  const current = readAdminSettings();
  const next: ClientAdminSettings = {
    moderationMode: patch.moderationMode ?? current.moderationMode,
    heroBannerUrl: patch.heroBannerUrl ?? current.heroBannerUrl,
    deskPalette: patch.deskPalette ?? current.deskPalette,
  };
  memoryAdminSettings = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(ADMIN_SETTINGS_EVENT));
  }
  if (typeof fetch === 'function') {
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch {
      /* local settings already saved */
    }
  }
  return next;
}

function readLikedSet(): Set<string> {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(WALL_LIKES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed.map(String));
      }
    } catch {
      /* ignore */
    }
  }
  return new Set(memoryLikedIds);
}

function saveLikedSet(set: Set<string>) {
  memoryLikedIds.clear();
  set.forEach(id => memoryLikedIds.add(id));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WALL_LIKES_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  }
}

function readUserReactionsMap(): Record<string, string[]> {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(WALL_REACTIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed as Record<string, string[]>;
      }
    } catch {
      /* ignore */
    }
  }
  const out: Record<string, string[]> = {};
  memoryUserReactions.forEach((set, postId) => {
    out[postId] = [...set];
  });
  return out;
}

function saveUserReactionsMap(map: Record<string, string[]>) {
  memoryUserReactions.clear();
  for (const [postId, list] of Object.entries(map)) {
    memoryUserReactions.set(postId, new Set(list));
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WALL_REACTIONS_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }
}

function readRepliesMap(): Record<string, FaithWallReply[]> {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(WALL_REPLIES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed as Record<string, FaithWallReply[]>;
      }
    } catch {
      /* ignore */
    }
  }
  const out: Record<string, FaithWallReply[]> = {};
  memoryPostReplies.forEach((list, postId) => {
    out[postId] = [...list];
  });
  return out;
}

function saveRepliesMap(map: Record<string, FaithWallReply[]>) {
  memoryPostReplies.clear();
  for (const [postId, list] of Object.entries(map)) {
    memoryPostReplies.set(postId, list);
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WALL_REPLIES_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }
}

function readSavedPostIds(): Set<string> {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(WALL_SAVED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed.map(String));
      }
    } catch {
      /* ignore */
    }
  }
  return new Set(memorySavedPostIds);
}

function saveSavedPostIds(set: Set<string>) {
  memorySavedPostIds.clear();
  set.forEach(id => memorySavedPostIds.add(id));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WALL_SAVED_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  }
}

const memoryJoinedSunnahIds = new Set<string>();
let memoryCircleCompleted = false;
let memoryNotificationsRead = false;

function readJoinedSunnahSet(): Set<string> {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(WALL_JOINED_SUNNAH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed.map(String));
      }
    } catch {
      /* ignore */
    }
  }
  return new Set(memoryJoinedSunnahIds);
}

function saveJoinedSunnahSet(set: Set<string>) {
  memoryJoinedSunnahIds.clear();
  set.forEach(id => memoryJoinedSunnahIds.add(id));
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WALL_JOINED_SUNNAH_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  }
}

export function toggleSunnahJoin(postId: string): FaithWallPost[] {
  const joined = readJoinedSunnahSet();
  if (joined.has(postId)) joined.delete(postId);
  else joined.add(postId);
  saveJoinedSunnahSet(joined);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FAITH_WALL_EVENT));
  }
  return listFaithWallPosts();
}

export interface CommunityCircleState {
  id: string;
  completedCount: number;
  targetCount: number;
  percent: number;
  userCompleted: boolean;
}

export function readCommunityCircle(): CommunityCircleState {
  let userCompleted = memoryCircleCompleted;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(COMMUNITY_CIRCLE_KEY);
      if (raw === 'true') userCompleted = true;
      else if (raw === 'false') userCompleted = false;
    } catch {
      /* ignore */
    }
  }
  const baseCount = 39;
  const targetCount = 50;
  const completedCount = userCompleted ? baseCount + 1 : baseCount;
  const percent = Math.min(100, Math.round((completedCount / targetCount) * 100));
  return {
    id: 'jumuah-kahf-circle',
    completedCount,
    targetCount,
    percent,
    userCompleted,
  };
}

export function toggleCommunityCirclePart(): CommunityCircleState {
  const current = readCommunityCircle();
  const next = !current.userCompleted;
  memoryCircleCompleted = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(COMMUNITY_CIRCLE_KEY, String(next));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(FAITH_WALL_EVENT));
  }
  return readCommunityCircle();
}

export interface WallNotificationItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  href: string;
  timeAgo: string;
  unread: boolean;
}

export function listWallNotifications(): WallNotificationItem[] {
  let allRead = memoryNotificationsRead;
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage.getItem(WALL_NOTIFICATIONS_KEY) === 'read') {
        allRead = true;
      }
    } catch {
      /* ignore */
    }
  }
  return [
    {
      id: 'notif-1',
      actor: 'Ustadh Tariq M. & 18 Seekers',
      action: 'joined the Friday Sunnah pledge',
      target: 'Read Surah Al-Kahf on Friday',
      href: '#/quran/wall',
      timeAgo: '12m ago',
      unread: !allRead,
    },
    {
      id: 'notif-2',
      actor: 'Dr. Layla al-Qasimi',
      action: 'said Āmīn & replied on',
      target: 'Surah Al-Baqara 2:255',
      href: '#/quran/wall',
      timeAgo: '1h ago',
      unread: !allRead,
    },
    {
      id: 'notif-3',
      actor: 'Jumu’ah Kahf Circle',
      action: 'reached 78% of this week’s goal',
      target: '39 / 50 Seekers completed',
      href: '#/quran/wall',
      timeAgo: '3h ago',
      unread: false,
    },
  ];
}

export function markAllWallNotificationsRead(): WallNotificationItem[] {
  memoryNotificationsRead = true;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WALL_NOTIFICATIONS_KEY, 'read');
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(FAITH_WALL_EVENT));
  }
  return listWallNotifications();
}

function readStoredWallPosts(): FaithWallPost[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(WALL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as FaithWallPost[];
      }
    } catch {
      /* ignore storage errors */
    }
  }
  return [...memoryWallPosts];
}

export function listAllFaithWallPosts(includeAllStatuses = false): FaithWallPost[] {
  const liked = readLikedSet();
  const reactionsMap = readUserReactionsMap();
  const repliesMap = readRepliesMap();
  const savedSet = readSavedPostIds();
  const joinedSet = readJoinedSunnahSet();
  const modMap = readModerationMap();
  const session = readSeekerSession();
  const userPosts = readStoredWallPosts();
  const seen = new Set(userPosts.map(item => item.id));
  const allSeeds = [...SEEDED_FAITH_WALL_POSTS, ...SEEDED_PENDING_WALL_POSTS];
  const combined = [...userPosts, ...allSeeds.filter(seed => !seen.has(seed.id))];
  const hydrated = combined.map(post => {
    const isLiked = liked.has(post.id);
    const isJoined = joinedSet.has(post.id);
    const userReacted = new Set(reactionsMap[post.id] ?? []);
    if (isLiked) userReacted.add('amin');

    const baseReactions: Record<string, number> = { ...(post.reactions ?? {}) };
    if (baseReactions.amin === undefined && typeof post.likes === 'number') {
      baseReactions.amin = post.likes;
    }
    for (const reactionId of userReacted) {
      baseReactions[reactionId] = (baseReactions[reactionId] ?? 0) + 1;
    }

    const baseLikes = typeof post.likes === 'number' ? post.likes : 1;
    const baseJoined = typeof post.joinedCount === 'number' ? post.joinedCount : post.type === 'good_deed' ? 12 : 8;
    const isCurrentUser = Boolean(session?.user && post.userId && post.userId === session.user.id);
    const extraReplies = repliesMap[post.id] ?? [];
    const existingReplyIds = new Set((post.replies ?? []).map(r => r.id));
    const mergedReplies = [...(post.replies ?? []), ...extraReplies.filter(r => !existingReplyIds.has(r.id))];
    const modOverride = modMap[post.id];
    const effectiveStatus: WallPostStatus = modOverride?.status ?? post.status ?? 'approved';
    const effectivePinned = modOverride?.isPinned !== undefined ? modOverride.isPinned : Boolean(post.isPinned);
    const isAnon = Boolean(post.isAnonymous);
    const authorName = isAnon
      ? 'Anonymous Seeker'
      : post.isOfficialBroadcast
        ? post.authorName || 'Dragon Dawwa Editorial Board'
        : isCurrentUser
          ? session!.user.name
          : post.authorName || 'Community Seeker';

    return {
      ...post,
      type: post.type ?? 'reflection',
      status: effectiveStatus,
      isPinned: effectivePinned,
      isAnonymous: isAnon,
      joinedCount: baseJoined + (isJoined ? 1 : 0),
      userJoined: isJoined,
      theme: sanitizeWallTheme(post.theme),
      authorName,
      authorHandle: isAnon
        ? '@anonymous'
        : post.authorHandle ||
          `@${authorName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'seeker'}`,
      authorRole: isAnon
        ? 'Sincere Sunnah Pledge'
        : post.isOfficialBroadcast
          ? '✦ Official Institutional Broadcast'
          : isCurrentUser
            ? session!.user.kunyah
            : post.authorRole || 'Faith Wall Contributor',
      authorEmblem: isCurrentUser ? session!.user.emblem : sanitizeSeekerEmblem(post.authorEmblem),
      authorAvatarUrl: isCurrentUser ? session!.user.avatarUrl ?? post.authorAvatarUrl ?? null : post.authorAvatarUrl ?? null,
      authorAuthProvider: isCurrentUser
        ? session!.user.authProvider ?? (session!.user.provider === 'google' ? 'google' : 'password')
        : post.authorAuthProvider,
      verified: isCurrentUser ? true : Boolean(post.verified || post.isOfficialBroadcast || post.id.startsWith('seed-wall-')),
      liked: isLiked || userReacted.has('amin'),
      likes: baseLikes + (userReacted.size > 0 && !post.liked ? userReacted.size : isLiked && !post.liked ? 1 : 0),
      reactions: baseReactions,
      userReactions: [...userReacted],
      replies: mergedReplies,
      saved: savedSet.has(post.id),
    };
  });

  const filtered = includeAllStatuses
    ? hydrated
    : hydrated.filter(post => post.status === 'approved');

  return filtered.sort((a, b) => {
    if (Boolean(b.isPinned) !== Boolean(a.isPinned)) return b.isPinned ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function listFaithWallPosts(): FaithWallPost[] {
  return listAllFaithWallPosts(false);
}

export async function moderateFaithWallPost(
  postId: string,
  patch: { status?: WallPostStatus; isPinned?: boolean },
): Promise<FaithWallPost[]> {
  const modMap = readModerationMap();
  modMap[postId] = { ...(modMap[postId] ?? {}), ...patch };
  saveModerationMap(modMap);

  const stored = readStoredWallPosts();
  const idx = stored.findIndex(item => item.id === postId);
  if (idx !== -1) {
    stored[idx] = {
      ...stored[idx],
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.isPinned !== undefined ? { isPinned: patch.isPinned } : {}),
      updatedAt: new Date().toISOString(),
    };
    persistUserPosts(stored);
  } else if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FAITH_WALL_EVENT));
  }

  if (typeof fetch === 'function') {
    try {
      await fetch(`/api/admin/wall/posts/${encodeURIComponent(postId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch {
      /* local moderation already saved */
    }
  }
  return listAllFaithWallPosts(true);
}

function persistUserPosts(next: FaithWallPost[]) {
  memoryWallPosts.splice(0, memoryWallPosts.length, ...next);
  if (typeof window !== 'undefined') {
    try {
      const compactForStorage = next.map(({ cardDataUrl: _cardDataUrl, ...rest }) => rest);
      window.localStorage.setItem(WALL_STORAGE_KEY, JSON.stringify(compactForStorage));
    } catch {
      /* keep in memory */
    }
    window.dispatchEvent(new Event(FAITH_WALL_EVENT));
  }
}

export function toggleFaithWallLike(postId: string): FaithWallPost[] {
  const liked = readLikedSet();
  if (liked.has(postId)) liked.delete(postId);
  else liked.add(postId);
  saveLikedSet(liked);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FAITH_WALL_EVENT));
  }
  return listFaithWallPosts();
}

export function toggleFaithWallReaction(postId: string, reactionId: string): FaithWallPost[] {
  const map = readUserReactionsMap();
  const current = new Set(map[postId] ?? []);
  const liked = readLikedSet();

  if (reactionId === 'amin' && liked.has(postId)) {
    liked.delete(postId);
    saveLikedSet(liked);
    current.delete('amin');
  } else if (current.has(reactionId)) {
    current.delete(reactionId);
  } else {
    current.add(reactionId);
  }

  map[postId] = [...current];
  saveUserReactionsMap(map);

  const session = readSeekerSession();
  if (typeof fetch === 'function' && session?.token) {
    void fetch(`/api/wall/posts/${encodeURIComponent(postId)}/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ reactionId }),
    }).catch(() => undefined);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FAITH_WALL_EVENT));
  }
  return listFaithWallPosts();
}

export function toggleFaithWallBookmark(postId: string): FaithWallPost[] {
  const savedSet = readSavedPostIds();
  if (savedSet.has(postId)) savedSet.delete(postId);
  else savedSet.add(postId);
  saveSavedPostIds(savedSet);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FAITH_WALL_EVENT));
  }
  return listFaithWallPosts();
}

export async function addFaithWallReply(postId: string, text: string): Promise<FaithWallReply | null> {
  const cleaned = text.trim().slice(0, 500);
  if (!cleaned) return null;
  const session = readSeekerSession();
  const seeker = session?.user ?? null;
  const reply: FaithWallReply = {
    id: `reply-${postId}-${Date.now()}`,
    postId,
    userId: seeker?.id,
    authorName: seeker?.name || 'Community Seeker',
    authorRole: seeker?.kunyah || 'Seeker of Knowledge',
    authorEmblem: seeker?.emblem ?? 'rub-el-hizb',
    authorAvatarUrl: seeker?.avatarUrl ?? null,
    text: cleaned,
    createdAt: new Date().toISOString(),
  };

  const map = readRepliesMap();
  const existing = map[postId] ?? [];
  map[postId] = [...existing, reply];
  saveRepliesMap(map);

  if (typeof fetch === 'function' && session?.token) {
    try {
      await fetch(`/api/wall/posts/${encodeURIComponent(postId)}/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify(reply),
      });
    } catch {
      /* local reply already saved */
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FAITH_WALL_EVENT));
  }
  return reply;
}

export async function publishFaithWallPost(input: {
  verse: ShareVerse;
  lang: Lang;
  url: string;
  reflection?: string;
  theme?: WallPostTheme;
  type?: WallPostType;
  status?: WallPostStatus;
  isPinned?: boolean;
  isOfficialBroadcast?: boolean;
  isAnonymous?: boolean;
  deedCategory?: GoodDeedCategory;
  deedTitle?: string;
  podcastId?: string;
  podcastTitle?: string;
  podcastAudioUrl?: string;
  podcastDuration?: string;
  podcastCitations?: string[];
  hadithCollection?: string;
  hadithNumber?: number;
  hadithGrade?: string;
  authorName?: string;
  authorRole?: string;
  cardDataUrl?: string;
}): Promise<FaithWallPost> {
  const session = readSeekerSession();
  const seeker = session?.user ?? null;
  const chosenTheme = sanitizeWallTheme(input.theme);
  const postType: WallPostType =
    input.type === 'podcast' ? 'podcast' : input.type === 'good_deed' ? 'good_deed' : 'reflection';
  if (postType === 'podcast' && !input.podcastId && !input.podcastTitle) {
    throw new Error('Sharing a podcast requires selecting a completed Research Podcast episode.');
  }
  if (
    postType === 'reflection' &&
    (!input.verse || (!input.verse.arabic && !input.verse.translation))
  ) {
    throw new Error('Sharing a reflection requires selecting a sacred Qur’an or Hadith passage.');
  }
  const settings = readAdminSettings();
  const isOfficial = Boolean(input.isOfficialBroadcast);
  const isAnon = Boolean(input.isAnonymous);
  const status: WallPostStatus =
    isOfficial || input.status === 'approved'
      ? 'approved'
      : input.status === 'pending' || settings.moderationMode === 'review'
        ? 'pending'
        : 'approved';
  const authorName = isAnon
    ? 'Anonymous Seeker'
    : isOfficial
      ? input.authorName || 'Dragon Dawwa Editorial Board'
      : seeker?.name || (input.authorName ?? '').trim() || 'Community Seeker';

  const post: FaithWallPost = {
    id:
      postType === 'podcast'
        ? `wall-pod-${Date.now()}`
        : postType === 'good_deed'
          ? `wall-deed-${Date.now()}`
          : `wall-${input.verse.surah}-${input.verse.ayah}-${Date.now()}`,
    userId: isAnon ? undefined : seeker?.id,
    type: postType,
    status,
    isPinned: Boolean(input.isPinned || isOfficial),
    isOfficialBroadcast: isOfficial,
    isAnonymous: isAnon,
    deedCategory: input.deedCategory,
    deedTitle: input.deedTitle,
    joinedCount: postType === 'good_deed' ? 1 : 0,
    userJoined: postType === 'good_deed',
    surah: input.verse.surah,
    ayah: input.verse.ayah,
    surahName: input.verse.surahName,
    arabic: input.verse.arabic,
    translation: input.verse.translation.replace(/\[\d+\]/g, '').trim(),
    reflection: (input.reflection ?? '').trim().slice(0, 500),
    lang: input.lang,
    url: input.url,
    theme: chosenTheme,
    podcastId: input.podcastId,
    podcastTitle: input.podcastTitle,
    podcastAudioUrl: input.podcastAudioUrl,
    podcastDuration: input.podcastDuration,
    podcastCitations: input.podcastCitations,
    hadithCollection: input.hadithCollection,
    hadithNumber: input.hadithNumber,
    hadithGrade: input.hadithGrade,
    cardDataUrl: input.cardDataUrl,
    authorName,
    authorHandle: isAnon
      ? '@anonymous'
      : `@${authorName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'seeker'}`,
    authorRole: isAnon
      ? 'Sincere Sunnah Pledge'
      : isOfficial
        ? '✦ Official Institutional Broadcast'
        : seeker?.kunyah || (input.authorRole ?? '').trim() || 'Faith Wall Contributor',
    authorEmblem: seeker?.emblem ?? 'rub-el-hizb',
    authorAvatarUrl: seeker?.avatarUrl ?? null,
    authorAuthProvider: seeker?.authProvider ?? (seeker?.provider === 'google' ? 'google' : undefined),
    verified: Boolean(seeker || isOfficial),
    likes: 1,
    liked: false,
    reactions: { amin: 1 },
    userReactions: [],
    replies: [],
    createdAt: new Date().toISOString(),
  };

  const existingUserPosts = readStoredWallPosts();
  const next = [post, ...existingUserPosts.filter(item => item.id !== post.id)].slice(0, 50);
  persistUserPosts(next);

  if (typeof fetch === 'function') {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.token) headers.Authorization = `Bearer ${session.token}`;
      await fetch('/api/wall/posts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: post.id,
          userId: post.userId,
          type: post.type,
          status: post.status,
          isPinned: post.isPinned,
          isOfficialBroadcast: post.isOfficialBroadcast,
          surah: post.surah,
          ayah: post.ayah,
          surahName: post.surahName,
          arabic: post.arabic,
          translation: post.translation,
          reflection: post.reflection,
          theme: post.theme,
          podcastId: post.podcastId,
          podcastTitle: post.podcastTitle,
          podcastAudioUrl: post.podcastAudioUrl,
          podcastDuration: post.podcastDuration,
          podcastCitations: post.podcastCitations,
          hadithCollection: post.hadithCollection,
          hadithNumber: post.hadithNumber,
          hadithGrade: post.hadithGrade,
          authorName: post.authorName,
          authorRole: post.authorRole,
          authorEmblem: post.authorEmblem,
          authorAvatarUrl: post.authorAvatarUrl,
          authorAuthProvider: post.authorAuthProvider,
          verified: post.verified,
          likes: post.likes,
          reactions: post.reactions,
          lang: post.lang,
          url: post.url,
          createdAt: post.createdAt,
        }),
      });
    } catch {
      /* offline or local mode: kept in local/in-memory state */
    }
  }

  return post;
}

export function listScholarQuestions(): ScholarQuestionItem[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(SCHOLAR_QUESTIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const seen = new Set(parsed.map((q: ScholarQuestionItem) => q.id));
          return [...(parsed as ScholarQuestionItem[]), ...SEEDED_SCHOLAR_QUESTIONS.filter(q => !seen.has(q.id))];
        }
      }
    } catch {
      /* ignore */
    }
  }
  const seen = new Set(memoryScholarQuestions.map(q => q.id));
  return [...memoryScholarQuestions, ...SEEDED_SCHOLAR_QUESTIONS.filter(q => !seen.has(q.id))];
}

function saveScholarQuestionsList(list: ScholarQuestionItem[]) {
  memoryScholarQuestions = [...list];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SCHOLAR_QUESTIONS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(SCHOLAR_QA_EVENT));
  }
}

export async function submitScholarQuestion(input: {
  question: string;
  language: Lang;
}): Promise<ScholarQuestionItem> {
  const session = readSeekerSession();
  const item: ScholarQuestionItem = {
    id: `qa-${Date.now()}`,
    userId: session?.user.id,
    userName: session?.user.name || 'Community Seeker',
    question: input.question.trim().slice(0, 1000),
    language: input.language,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  const all = listScholarQuestions();
  saveScholarQuestionsList([item, ...all.filter(q => q.id !== item.id)]);
  if (typeof fetch === 'function') {
    try {
      await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
    } catch {
      /* ignore */
    }
  }
  return item;
}

export async function answerScholarQuestion(input: {
  id: string;
  answer: string;
  answeredBy?: string;
  citations?: string[];
}): Promise<ScholarQuestionItem[]> {
  const session = readSeekerSession();
  const all = listScholarQuestions();
  const updated = all.map(q => {
    if (q.id !== input.id) return q;
    return {
      ...q,
      status: 'answered' as const,
      answer: input.answer.trim().slice(0, 4000),
      answeredBy:
        input.answeredBy?.trim() ||
        (session?.user ? `${session.user.name} · Institutional Scholarly Board` : 'Institutional Scholarly Board'),
      citations: input.citations ?? q.citations,
      answeredAt: new Date().toISOString(),
    };
  });
  saveScholarQuestionsList(updated);
  if (typeof fetch === 'function') {
    try {
      await fetch(`/api/admin/questions/${encodeURIComponent(input.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch {
      /* ignore */
    }
  }
  return updated;
}

export interface UserProfilePortfolio {
  id: string;
  name: string;
  handle: string;
  roleBadge: string;
  kunyah: string;
  bio: string;
  emblem: SeekerEmblem;
  avatarUrl: string | null;
  bannerUrl: string;
  joinedAt: string;
  isSelf: boolean;
  approvedPosts: FaithWallPost[];
  pendingPosts: FaithWallPost[];
  reflectionsCount: number;
  podcastsCount: number;
}

export function resolveUserProfilePortfolio(targetIdOrHandle?: string | null): UserProfilePortfolio {
  const session = readSeekerSession();
  const currentUser = session?.user ?? null;
  const allPosts = listAllFaithWallPosts(true);
  const settings = readAdminSettings();

  const cleanTarget = (targetIdOrHandle ?? '').replace(/^@/, '').trim().toLowerCase();
  const isSelf =
    !cleanTarget ||
    cleanTarget === 'me' ||
    Boolean(
      currentUser &&
        (currentUser.id.toLowerCase() === cleanTarget ||
          (currentUser.handle ?? '').replace(/^@/, '').toLowerCase() === cleanTarget ||
          currentUser.name.toLowerCase().replace(/[^a-z0-9]+/g, '') === cleanTarget.replace(/[^a-z0-9]+/g, '')),
    );

  if (isSelf && currentUser) {
    const handle = currentUser.handle || `@${currentUser.name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'seeker'}`;
    const userPosts = allPosts.filter(
      p =>
        p.userId === currentUser.id ||
        p.authorName?.toLowerCase() === currentUser.name.toLowerCase() ||
        (p.authorHandle ?? '').toLowerCase() === handle.toLowerCase(),
    );
    const approvedPosts = userPosts.filter(p => p.status === 'approved');
    const pendingPosts = userPosts.filter(p => p.status === 'pending');
    const roleLabel = currentUser.kunyah || 'Community Researcher';

    return {
      id: currentUser.id,
      name: currentUser.name,
      handle,
      roleBadge: roleLabel,
      kunyah: currentUser.kunyah,
      bio:
        currentUser.bio ||
        'Reflecting on the Makki and Madani revelations, prophetic narrations, and multidisciplinary tafsir.',
      emblem: currentUser.emblem,
      avatarUrl: currentUser.avatarUrl ?? null,
      bannerUrl: currentUser.bannerUrl || settings.heroBannerUrl || '/assets/banner-art.jpg',
      joinedAt: currentUser.createdAt || '2026-10-01T00:00:00.000Z',
      isSelf: true,
      approvedPosts,
      pendingPosts,
      reflectionsCount: approvedPosts.filter(p => (p.type ?? 'reflection') === 'reflection').length,
      podcastsCount: approvedPosts.filter(p => p.type === 'podcast').length,
    };
  }

  // Resolve another community author from posts
  const matchingPosts = allPosts.filter(p => {
    const handleClean = (p.authorHandle ?? '').replace(/^@/, '').toLowerCase();
    const nameClean = (p.authorName ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const targetAlnum = cleanTarget.replace(/[^a-z0-9]+/g, '');
    return (
      (p.userId ?? '').toLowerCase() === cleanTarget ||
      handleClean === targetAlnum ||
      nameClean === targetAlnum ||
      (targetAlnum.length >= 5 && (handleClean.includes(targetAlnum) || nameClean.includes(targetAlnum)))
    );
  });

  const sample = matchingPosts[0] ?? SEEDED_FAITH_WALL_POSTS[0];
  const approvedPosts = matchingPosts.filter(p => p.status === 'approved');
  const authorName = sample.authorName || 'Dr. Layla al-Qasimi';
  const handle = sample.authorHandle || `@${authorName.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

  return {
    id: sample.userId || handle,
    name: authorName,
    handle,
    roleBadge: sample.authorRole || 'Verified Scholar',
    kunyah: sample.authorRole || 'Verified Scholar',
    bio: 'Contributing verified Qur’anic reflections, classical tafsir insights, and sourced roundtable discussions.',
    emblem: sample.authorEmblem ?? 'rub-el-hizb',
    avatarUrl: sample.authorAvatarUrl ?? null,
    bannerUrl: settings.heroBannerUrl || '/assets/banner-art.jpg',
    joinedAt: sample.createdAt || '2026-10-15T00:00:00.000Z',
    isSelf: false,
    approvedPosts,
    pendingPosts: [],
    reflectionsCount: approvedPosts.filter(p => (p.type ?? 'reflection') === 'reflection').length,
    podcastsCount: approvedPosts.filter(p => p.type === 'podcast').length,
  };
}

export async function updateFaithWallPost(
  postId: string,
  reflection: string,
  theme?: WallPostTheme,
): Promise<FaithWallPost | null> {
  const session = readSeekerSession();
  const existingUserPosts = readStoredWallPosts();
  const idx = existingUserPosts.findIndex(item => item.id === postId);
  if (idx === -1) return null;
  const target = existingUserPosts[idx];
  if (target.userId && session?.user && target.userId !== session.user.id) {
    return null;
  }
  const updated: FaithWallPost = {
    ...target,
    reflection: reflection.trim().slice(0, 600),
    theme: theme ? sanitizeWallTheme(theme) : sanitizeWallTheme(target.theme),
    authorName: session?.user.name || target.authorName,
    authorRole: session?.user.kunyah || target.authorRole,
    authorEmblem: session?.user.emblem || target.authorEmblem,
    authorAvatarUrl: session?.user.avatarUrl ?? target.authorAvatarUrl ?? null,
    authorAuthProvider: session?.user.authProvider ?? target.authorAuthProvider,
    verified: Boolean(session?.user || target.verified),
    updatedAt: new Date().toISOString(),
  };
  const next = [...existingUserPosts];
  next[idx] = updated;
  persistUserPosts(next);

  if (typeof fetch === 'function' && session?.token) {
    try {
      await fetch(`/api/wall/posts/${encodeURIComponent(postId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ reflection: updated.reflection, theme: updated.theme }),
      });
    } catch {
      /* local update already persisted */
    }
  }
  return updated;
}

export async function deleteFaithWallPost(postId: string): Promise<boolean> {
  const session = readSeekerSession();
  const existingUserPosts = readStoredWallPosts();
  const target = existingUserPosts.find(item => item.id === postId);
  if (!target) return false;
  if (target.userId && session?.user && target.userId !== session.user.id) {
    return false;
  }
  const next = existingUserPosts.filter(item => item.id !== postId);
  persistUserPosts(next);

  if (typeof fetch === 'function' && session?.token) {
    try {
      await fetch(`/api/wall/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });
    } catch {
      /* local deletion already persisted */
    }
  }
  return true;
}

/** Break on spaces. A token wider than the line is split, and every character is kept. */
export function wrapWords(text: string, maxWidth: number, measure: (sample: string) => number): string[] {
  if (!text) return [];
  if (maxWidth < 1) return [text];
  const lines: string[] = [];
  let current = '';
  const commit = () => {
    if (current) lines.push(current);
    current = '';
  };
  for (const word of text.split(' ')) {
    if (!word) continue;
    const trial = current ? `${current} ${word}` : word;
    if (current && measure(trial) <= maxWidth) {
      current = trial;
      continue;
    }
    if (current) commit();
    if (measure(word) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (chunk && measure(next) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else chunk = next;
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines;
}

export function packLines<T>(items: T[], max: number): T[][] {
  const size = Math.max(1, Math.trunc(max));
  const cards: T[][] = [];
  for (const item of items) {
    const last = cards[cards.length - 1];
    if (!last || last.length >= size) cards.push([item]);
    else last.push(item);
  }
  return cards;
}

/** The query on the current hash until it has been written into language, edition, and place. */
export function usePendingReadingLink(): { hashQuery: string; link: ReadingLink | null; consume: () => void } {
  const [hashQuery, setHashQuery] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash.split('?')[1] ?? ''));
  const [appliedQuery, setAppliedQuery] = useState<string | null>(null);
  useEffect(() => {
    const onChange = () => setHashQuery(window.location.hash.split('?')[1] ?? '');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const link = useMemo(() => {
    if (!hashQuery || hashQuery === appliedQuery) return null;
    const parsed = parseReadingLink(`#/?${hashQuery}`);
    return parsed.surah || parsed.ayah || parsed.lang || parsed.edition ? parsed : null;
  }, [appliedQuery, hashQuery]);
  const consume = useCallback(() => setAppliedQuery(hashQuery), [hashQuery]);
  return useMemo(() => ({ hashQuery, link, consume }), [consume, hashQuery, link]);
}

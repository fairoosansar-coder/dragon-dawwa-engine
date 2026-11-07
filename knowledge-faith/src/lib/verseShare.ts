import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lang } from '../shared/sources.ts';

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

export interface FaithWallPost {
  id: string;
  surah: number;
  ayah: number;
  surahName: string;
  arabic: string;
  translation: string;
  reflection: string;
  lang: Lang;
  url: string;
  cardDataUrl?: string;
  authorName?: string;
  authorRole?: string;
  likes?: number;
  liked?: boolean;
  createdAt: string;
}

export const FAITH_WALL_EVENT = 'kf-faith-wall-updated';

const WALL_STORAGE_KEY = 'kf-public-faith-wall';
const WALL_LIKES_KEY = 'kf-public-faith-wall-likes';

export const SEEDED_FAITH_WALL_POSTS: FaithWallPost[] = [
  {
    id: 'seed-wall-2-255-en',
    surah: 2,
    ayah: 255,
    surahName: 'Al-Baqara',
    arabic: 'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ',
    translation: 'Allah — there is no deity except Him, the Ever-Living, the All-Sustaining. Neither drowsiness overtakes Him nor sleep.',
    reflection: 'Reciting Ayat al-Kursi before sleep brings unshakable tranquility—knowing the Ever-Living Sustainer never slumbers over His creation.',
    lang: 'en',
    url: '#/quran/book?surah=2&ayah=255&lang=en&edition=english_rwwad',
    authorName: 'Dr. Layla al-Qasimi',
    authorRole: 'Qur’anic Studies Fellow',
    likes: 48,
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
    url: '#/quran/book?surah=94&ayah=5&lang=en&edition=english_rwwad',
    authorName: 'Ustadh Tariq M.',
    authorRole: 'Verified Teacher',
    likes: 64,
    createdAt: '2026-11-06T15:15:00.000Z',
  },
  {
    id: 'seed-wall-1-2-ta',
    surah: 1,
    ayah: 2,
    surahName: 'Al-Faatiha',
    arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    translation: 'புகழ் அனைத்தும் அகிலங்களின் இறைவனாகிய அல்லாஹ்வுக்கே உரியது.',
    reflection: 'ஒவ்வொரு தொழுகையிலும் நாம் மீண்டும் மீண்டும் ஓதும் இந்த வசனம், நன்றியுணர்வே ஈமானின் அடிப்படை என்பதை நினைவூட்டுகிறது.',
    lang: 'ta',
    url: '#/quran/book?surah=1&ayah=2&lang=ta&edition=tamil_omar_brief',
    authorName: 'Brother Feroz A.',
    authorRole: 'Community Researcher',
    likes: 37,
    createdAt: '2026-11-06T12:00:00.000Z',
  },
  {
    id: 'seed-wall-2-286-si',
    surah: 2,
    ayah: 286,
    surahName: 'Al-Baqara',
    arabic: 'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    translation: 'අල්ලාහ් කිසිදු ආත්මයකට එහි හැකියාවට වඩා බරක් නොපවරයි.',
    reflection: 'ජීවිතයේ කුමන පරීක්ෂාවක් පැමිණියද, එය දරාගැනීමේ ශක්තිය අල්ලාහ් අප තුළම තබා ඇති බව මෙම වාක්‍යයෙන් සනාථ වේ.',
    lang: 'si',
    url: '#/quran/book?surah=2&ayah=286&lang=si&edition=sinhalese_mahir',
    authorName: 'Sister Amina K.',
    authorRole: 'Student of Knowledge',
    likes: 29,
    createdAt: '2026-11-06T09:45:00.000Z',
  },
];

const memoryWallPosts: FaithWallPost[] = [];
const memoryLikedIds = new Set<string>();

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

export function listFaithWallPosts(): FaithWallPost[] {
  const liked = readLikedSet();
  const userPosts = readStoredWallPosts();
  const seen = new Set(userPosts.map(item => item.id));
  const combined = [...userPosts, ...SEEDED_FAITH_WALL_POSTS.filter(seed => !seen.has(seed.id))];
  return combined.map(post => {
    const isLiked = liked.has(post.id);
    const baseLikes = typeof post.likes === 'number' ? post.likes : 1;
    return {
      ...post,
      authorName: post.authorName || 'Community Seeker',
      authorRole: post.authorRole || 'Faith Wall Contributor',
      liked: isLiked,
      likes: baseLikes + (isLiked && !post.liked ? 1 : 0),
    };
  });
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

export async function publishFaithWallPost(input: {
  verse: ShareVerse;
  lang: Lang;
  url: string;
  reflection?: string;
  authorName?: string;
  cardDataUrl?: string;
}): Promise<FaithWallPost> {
  const post: FaithWallPost = {
    id: `wall-${input.verse.surah}-${input.verse.ayah}-${Date.now()}`,
    surah: input.verse.surah,
    ayah: input.verse.ayah,
    surahName: input.verse.surahName,
    arabic: input.verse.arabic,
    translation: input.verse.translation.replace(/\[\d+\]/g, '').trim(),
    reflection: (input.reflection ?? '').trim().slice(0, 600),
    lang: input.lang,
    url: input.url,
    cardDataUrl: input.cardDataUrl,
    authorName: (input.authorName ?? '').trim() || 'Community Seeker',
    authorRole: 'Faith Wall Contributor',
    likes: 1,
    liked: false,
    createdAt: new Date().toISOString(),
  };

  const existingUserPosts = readStoredWallPosts();
  const next = [post, ...existingUserPosts.filter(item => item.id !== post.id)].slice(0, 50);
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

  if (typeof fetch === 'function') {
    try {
      await fetch('/api/wall/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: post.id,
          surah: post.surah,
          ayah: post.ayah,
          surahName: post.surahName,
          arabic: post.arabic,
          translation: post.translation,
          reflection: post.reflection,
          authorName: post.authorName,
          authorRole: post.authorRole,
          likes: post.likes,
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

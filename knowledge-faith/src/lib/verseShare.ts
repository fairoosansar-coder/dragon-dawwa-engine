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
  parts.push(`${verse.surahName} ${verse.surah}:${verse.ayah}`);
  if (verse.translationTitle) parts.push(verse.translationTitle);
  const identity = [verse.translationKey, verse.translationVersion].filter(Boolean).join(' · ');
  if (identity) parts.push(identity);
  if (verse.translationDescription) parts.push(verse.translationDescription);
  parts.push('QuranEnc');
  return parts.join('\n\n');
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

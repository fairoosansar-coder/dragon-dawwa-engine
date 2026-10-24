import type { Lang } from '../shared/sources.ts';
import { wrapWords, type ShareVerse } from './verseShare.ts';

const WIDTH = 1080;
const PAD = 72;
const INNER = WIDTH - PAD * 2;
const MAX_HEIGHT = 1600;
const SAND = '#FAF6EC';
const PINE = '#064936';
const INK = '#172720';
const MUTED = '#637069';
const GOLD = '#C9A14E';

interface DrawnLine {
  text: string;
  family: string;
  size: number;
  dir: 'rtl' | 'ltr';
  color: string;
  gap: number;
}

function lineHeight(line: DrawnLine): number {
  return line.size + line.gap;
}

async function fontReady(family: string, size: number, sample: string): Promise<boolean> {
  const spec = `${size}px "${family}"`;
  try {
    await document.fonts.load(spec, sample);
  } catch {
    return false;
  }
  return document.fonts.check(spec, sample);
}

function paint(lines: DrawnLine[], height: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = SAND;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = PINE;
  ctx.fillRect(0, 0, WIDTH, 14);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, height - 10, WIDTH, 10);
  let y = PAD;
  for (const line of lines) {
    ctx.font = `${line.size}px "${line.family}"`;
    ctx.direction = line.dir;
    ctx.textAlign = line.dir === 'rtl' ? 'right' : 'left';
    ctx.fillStyle = line.color;
    const width = ctx.measureText(line.text).width;
    if (width > INNER + 1) return null;
    y += line.size;
    ctx.fillText(line.text, line.dir === 'rtl' ? WIDTH - PAD : PAD, y);
    y += line.gap;
  }
  return canvas;
}

function stack(cards: HTMLCanvasElement[]): HTMLCanvasElement | null {
  const gap = 28;
  const height = cards.reduce((sum, card) => sum + card.height, 0) + gap * Math.max(0, cards.length - 1);
  const sheet = document.createElement('canvas');
  sheet.width = WIDTH;
  sheet.height = height;
  const ctx = sheet.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#E7F2EC';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  let y = 0;
  for (const card of cards) {
    ctx.drawImage(card, 0, y);
    y += card.height + gap;
  }
  return sheet;
}

function wrapBlock(text: string, family: string, size: number, dir: 'rtl' | 'ltr', color: string, gap: number): DrawnLine[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.font = `${size}px "${family}"`;
  ctx.direction = dir;
  const lines = wrapWords(text, INNER, sample => ctx.measureText(sample).width);
  return lines.map(row => ({ text: row, family, size, dir, color, gap }));
}

/**
 * Draw the verse as one or more cards. A font that cannot draw the script refuses the image
 * instead of substituting another face. Text that does not fit continues on the next card.
 */
export async function renderVerseImage(
  verse: ShareVerse,
  lang: Lang,
): Promise<{ cards: string[]; sheet: string } | { error: string }> {
  if (typeof document === 'undefined') return { error: 'The verse image could not be drawn because a required font did not load.' };
  const meaningFamily = lang === 'ta' ? 'Noto Sans Tamil' : lang === 'si' ? 'Noto Sans Sinhala' : 'Inter';
  const meaningSample = lang === 'ta' ? 'அவர்கள்' : lang === 'si' ? 'ඔවුන්' : verse.translation.slice(0, 24) || 'Meaning';
  const [arabicOk, meaningOk] = await Promise.all([
    fontReady('Amiri Quran', 54, 'بِسْمِ ٱللَّهِ'),
    fontReady(meaningFamily, 34, meaningSample),
  ]);
  if (!arabicOk || !meaningOk) return { error: 'The verse image could not be drawn because a required font did not load.' };

  const reference = verse.reference ?? `${verse.surahName} ${verse.surah}:${verse.ayah}`;
  const header = wrapBlock(reference, 'Inter', 28, 'ltr', PINE, 18);
  const continued = wrapBlock('Continued', 'Inter', 22, 'ltr', MUTED, 16);
  const attribution = [
    verse.translationTitle,
    [verse.translationKey, verse.translationVersion].filter(Boolean).join(' · '),
    verse.translationDescription,
    verse.sourceLabel ?? 'QuranEnc',
  ]
    .filter(Boolean)
    .join('\n');
  const footer = attribution
    .split('\n')
    .flatMap(row => wrapBlock(row, 'Inter', 22, 'ltr', MUTED, 10));
  const body = [
    ...wrapBlock(verse.arabic, 'Amiri Quran', 54, 'rtl', INK, 16),
    ...wrapBlock(verse.translation, meaningFamily, 34, 'ltr', INK, 14),
    ...(verse.footnotes
      ? [...wrapBlock('Footnotes', 'Inter', 22, 'ltr', PINE, 10), ...wrapBlock(verse.footnotes, meaningFamily, 28, 'ltr', INK, 12)]
      : []),
  ];
  if (!body.length) return { error: 'The verse image could not be drawn because a required font did not load.' };

  const fixed = (extra: DrawnLine[]) => PAD * 2 + 24 + [...header, ...extra, ...footer].reduce((sum, row) => sum + lineHeight(row), 0);
  const cards: HTMLCanvasElement[] = [];
  let rest = body;
  let index = 0;
  while (rest.length) {
    const extra = index === 0 ? [] : continued;
    const budget = Math.max(80, MAX_HEIGHT - fixed(extra));
    let used = 0;
    let count = 0;
    for (const row of rest) {
      const next = used + lineHeight(row);
      if (count > 0 && next > budget) break;
      used += lineHeight(row);
      count += 1;
    }
    const taken = rest.slice(0, count);
    rest = rest.slice(count);
    const lines = [...header, ...extra, ...taken, ...footer];
    const height = PAD * 2 + lines.reduce((sum, row) => sum + lineHeight(row), 0);
    const card = paint(lines, height);
    if (!card) return { error: 'The verse image could not be drawn because a required font did not load.' };
    cards.push(card);
    index += 1;
    if (index > 40) return { error: 'This passage is too long for one image. Copy the text for the full wording.' };
  }
  const sheet = stack(cards);
  if (!sheet) return { error: 'The verse image could not be drawn because a required font did not load.' };
  return { cards: cards.map(card => card.toDataURL('image/png')), sheet: sheet.toDataURL('image/png') };
}

import type { Lang } from '../shared/sources.ts';
import { wrapWords, type ShareVerse } from './verseShare.ts';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 675;
export const BRAND_FOOTER_LEFT = 'DRAGON DAWWA · Institutional Research Studio';
export const BRAND_FOOTER_RIGHT = 'dragondawwa.com';
export const CARD_BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

const OUTER_FRAME = 24;
const INNER_FRAME = 34;
const CONTENT_PAD_X = 76;
const CONTENT_WIDTH = CARD_WIDTH - CONTENT_PAD_X * 2;

const OBSIDIAN_START = '#031812';
const EMERALD_MID = '#0A2E23';
const OBSIDIAN_END = '#041812';
const GOLD = '#D4AF37';
const PURE_WHITE = '#FFFFFF';
const WARM_IVORY = '#F3E8C8';

export function formatVerseCardBadge(verse: Pick<ShareVerse, 'surah' | 'ayah' | 'surahName' | 'reference'>): string {
  if (verse.reference) {
    return `✦ ${verse.reference.toUpperCase()}`;
  }
  const cleanName = (verse.surahName || 'QURAN').replace(/^Surah\s+/i, '').trim().toUpperCase();
  return `✦ SURAH ${cleanName} ${verse.surah}:${verse.ayah}`;
}

export function formatQuotedTranslation(translation: string): string {
  const cleaned = translation.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const stripped = cleaned.replace(/^[“"']+|[”"']+$/g, '').trim();
  return `“${stripped}”`;
}

async function fontReady(family: string, size: number, sample: string): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts) return false;
  const spec = `${size}px "${family}"`;
  try {
    await document.fonts.load(spec, sample);
  } catch {
    return false;
  }
  return document.fonts.check(spec, sample);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawRosetteWatermark(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.06)';
  ctx.lineWidth = 1.25;

  for (let i = 0; i < 8; i += 1) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.strokeRect(-radius * 0.52, -radius * 0.52, radius * 1.04, radius * 1.04);
    ctx.restore();
  }

  for (const scale of [0.38, 0.74, 1]) {
    ctx.beginPath();
    ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCornerOrnaments(ctx: CanvasRenderingContext2D) {
  const corners = [
    { x: INNER_FRAME, y: INNER_FRAME, sx: 1, sy: 1 },
    { x: CARD_WIDTH - INNER_FRAME, y: INNER_FRAME, sx: -1, sy: 1 },
    { x: INNER_FRAME, y: CARD_HEIGHT - INNER_FRAME, sx: 1, sy: -1 },
    { x: CARD_WIDTH - INNER_FRAME, y: CARD_HEIGHT - INNER_FRAME, sx: -1, sy: -1 },
  ];
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.72)';
  ctx.fillStyle = 'rgba(212, 175, 55, 0.72)';
  ctx.lineWidth = 1.75;

  for (const c of corners) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(c.sx, c.sy);

    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(0, 8);
    ctx.quadraticCurveTo(0, 0, 8, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(15, 6);
    ctx.lineTo(20, 10);
    ctx.lineTo(15, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function paintIlluminatedBackground(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  grad.addColorStop(0, OBSIDIAN_START);
  grad.addColorStop(0.5, EMERALD_MID);
  grad.addColorStop(1, OBSIDIAN_END);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const glow = ctx.createRadialGradient(
    CARD_WIDTH / 2,
    CARD_HEIGHT * 0.45,
    30,
    CARD_WIDTH / 2,
    CARD_HEIGHT * 0.45,
    460,
  );
  glow.addColorStop(0, 'rgba(212, 175, 55, 0.09)');
  glow.addColorStop(1, 'rgba(212, 175, 55, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  drawRosetteWatermark(ctx, CARD_WIDTH / 2, CARD_HEIGHT / 2, 230);
  drawRosetteWatermark(ctx, 130, 130, 95);
  drawRosetteWatermark(ctx, CARD_WIDTH - 130, CARD_HEIGHT - 130, 95);

  ctx.save();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.52)';
  ctx.lineWidth = 2;
  drawRoundedRect(
    ctx,
    OUTER_FRAME,
    OUTER_FRAME,
    CARD_WIDTH - OUTER_FRAME * 2,
    CARD_HEIGHT - OUTER_FRAME * 2,
    18,
  );
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.24)';
  ctx.lineWidth = 1;
  drawRoundedRect(
    ctx,
    INNER_FRAME,
    INNER_FRAME,
    CARD_WIDTH - INNER_FRAME * 2,
    CARD_HEIGHT - INNER_FRAME * 2,
    12,
  );
  ctx.stroke();
  ctx.restore();

  drawCornerOrnaments(ctx);
}

function paintHeaderAndFooter(
  ctx: CanvasRenderingContext2D,
  badgeText: string,
  pageNote?: string,
) {
  const topY = 66;

  // Top-left gold pill badge
  ctx.save();
  ctx.font = '600 15px "Inter", sans-serif';
  ctx.direction = 'ltr';
  const label = pageNote ? `${badgeText} · ${pageNote}` : badgeText;
  const textWidth = ctx.measureText(label).width;
  const pillW = textWidth + 36;
  const pillH = 36;
  const pillX = CONTENT_PAD_X;
  const pillY = topY;

  ctx.fillStyle = 'rgba(212, 175, 55, 0.14)';
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
  ctx.lineWidth = 1.25;
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 999);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = GOLD;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pillX + 18, pillY + pillH / 2 + 0.5);
  ctx.restore();

  // Top-right decorative gold Bismillah & star rosette
  ctx.save();
  ctx.fillStyle = 'rgba(212, 175, 55, 0.88)';
  ctx.font = '24px "Amiri Quran", serif';
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`۞  ${CARD_BISMILLAH}`, CARD_WIDTH - CONTENT_PAD_X, topY + 18);
  ctx.restore();

  // Footer rule + discreet brand attribution
  const footerY = CARD_HEIGHT - 60;
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CONTENT_PAD_X, footerY - 18);
  ctx.lineTo(CARD_WIDTH - CONTENT_PAD_X, footerY - 18);
  ctx.stroke();

  ctx.fillStyle = 'rgba(212, 175, 55, 0.72)';
  ctx.font = '500 13px "Inter", sans-serif';
  ctx.direction = 'ltr';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(BRAND_FOOTER_LEFT, CONTENT_PAD_X, footerY);
  ctx.textAlign = 'right';
  ctx.fillText(BRAND_FOOTER_RIGHT, CARD_WIDTH - CONTENT_PAD_X, footerY);
  ctx.restore();
}

interface FittedLayout {
  arabicSize: number;
  arabicGap: number;
  arabicLines: string[];
  meaningSize: number;
  meaningGap: number;
  meaningLines: string[];
  totalHeight: number;
}

function measureLayout(
  ctx: CanvasRenderingContext2D,
  arabic: string,
  quotedTranslation: string,
  meaningFamily: string,
  arabicSize: number,
  meaningSize: number,
): FittedLayout {
  const arabicGap = Math.round(arabicSize * 0.48);
  const meaningGap = Math.round(meaningSize * 0.42);

  ctx.font = `${arabicSize}px "Amiri Quran", serif`;
  ctx.direction = 'rtl';
  const arabicLines = wrapWords(arabic, CONTENT_WIDTH - 32, sample => ctx.measureText(sample).width);

  ctx.font = `400 ${meaningSize}px "${meaningFamily}", Georgia, serif`;
  ctx.direction = 'ltr';
  const meaningLines = wrapWords(quotedTranslation, CONTENT_WIDTH - 48, sample => ctx.measureText(sample).width);

  const arabicBlock = arabicLines.length * (arabicSize + arabicGap);
  const meaningBlock = meaningLines.length * (meaningSize + meaningGap);
  const dividerSpace = arabicLines.length && meaningLines.length ? 30 : 0;

  return {
    arabicSize,
    arabicGap,
    arabicLines,
    meaningSize,
    meaningGap,
    meaningLines,
    totalHeight: arabicBlock + dividerSpace + meaningBlock,
  };
}

function paintCard(
  badgeText: string,
  arabicLines: string[],
  arabicSize: number,
  arabicGap: number,
  meaningLines: string[],
  meaningFamily: string,
  meaningSize: number,
  meaningGap: number,
  pageNote?: string,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  paintIlluminatedBackground(ctx);
  paintHeaderAndFooter(ctx, badgeText, pageNote);

  const topBound = 122;
  const bottomBound = CARD_HEIGHT - 92;
  const available = bottomBound - topBound;

  const arabicBlock = arabicLines.length * (arabicSize + arabicGap);
  const meaningBlock = meaningLines.length * (meaningSize + meaningGap);
  const dividerSpace = arabicLines.length && meaningLines.length ? 28 : 0;
  const total = arabicBlock + dividerSpace + meaningBlock;

  let y = topBound + Math.max(0, (available - total) / 2);

  if (arabicLines.length > 0) {
    ctx.save();
    ctx.font = `${arabicSize}px "Amiri Quran", serif`;
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PURE_WHITE;
    ctx.shadowColor = 'rgba(212, 175, 55, 0.25)';
    ctx.shadowBlur = 20;

    for (const line of arabicLines) {
      y += arabicSize;
      ctx.fillText(line, CARD_WIDTH / 2, y);
      y += arabicGap;
    }
    ctx.restore();
  }

  if (arabicLines.length > 0 && meaningLines.length > 0) {
    const midY = y + dividerSpace / 2 - 4;
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.fillStyle = 'rgba(212, 175, 55, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CARD_WIDTH / 2 - 70, midY);
    ctx.lineTo(CARD_WIDTH / 2 - 12, midY);
    ctx.moveTo(CARD_WIDTH / 2 + 12, midY);
    ctx.lineTo(CARD_WIDTH / 2 + 70, midY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(CARD_WIDTH / 2, midY - 4);
    ctx.lineTo(CARD_WIDTH / 2 + 4, midY);
    ctx.lineTo(CARD_WIDTH / 2, midY + 4);
    ctx.lineTo(CARD_WIDTH / 2 - 4, midY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    y += dividerSpace;
  }

  if (meaningLines.length > 0) {
    ctx.save();
    ctx.font = `400 ${meaningSize}px "${meaningFamily}", Georgia, serif`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = WARM_IVORY;

    for (const line of meaningLines) {
      y += meaningSize;
      ctx.fillText(line, CARD_WIDTH / 2, y);
      y += meaningGap;
    }
    ctx.restore();
  }

  return canvas;
}

function stackCards(cards: HTMLCanvasElement[]): HTMLCanvasElement | null {
  if (cards.length === 1) return cards[0];
  const gap = 24;
  const height = cards.reduce((sum, card) => sum + card.height, 0) + gap * Math.max(0, cards.length - 1);
  const sheet = document.createElement('canvas');
  sheet.width = CARD_WIDTH;
  sheet.height = height;
  const ctx = sheet.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = OBSIDIAN_START;
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  let y = 0;
  for (const card of cards) {
    ctx.drawImage(card, 0, y);
    y += card.height + gap;
  }
  return sheet;
}

/**
 * Draw the verse as a 1200x675 (16:9 HD) illuminated Islamic manuscript social card.
 * Uses pure white Arabic script with soft gold glow, warm ivory quoted translation,
 * and the Dragon Dawwa Institutional Research Studio brand footer.
 */
export async function renderVerseImage(
  verse: ShareVerse,
  lang: Lang,
): Promise<{ cards: string[]; sheet: string } | { error: string }> {
  if (typeof document === 'undefined') {
    return { error: 'The verse image could not be drawn because a required font did not load.' };
  }
  const meaningFamily = lang === 'ta' ? 'Noto Sans Tamil' : lang === 'si' ? 'Noto Sans Sinhala' : 'Fraunces';
  const fallbackFamily = lang === 'ta' ? 'Noto Sans Tamil' : lang === 'si' ? 'Noto Sans Sinhala' : 'Inter';
  const meaningSample = lang === 'ta' ? 'அவர்கள்' : lang === 'si' ? 'ඔවුන්' : verse.translation.slice(0, 24) || 'Meaning';
  const [arabicOk, meaningOk] = await Promise.all([
    fontReady('Amiri Quran', 48, 'بِسْمِ ٱللَّهِ'),
    fontReady(meaningFamily, 28, meaningSample).then(ok => (ok ? true : fontReady(fallbackFamily, 28, meaningSample))),
  ]);
  if (!arabicOk || !meaningOk) {
    return { error: 'The verse image could not be drawn because a required font did not load.' };
  }

  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return { error: 'The verse image could not be drawn because a required font did not load.' };

  const badgeText = formatVerseCardBadge(verse);
  const quotedTranslation = formatQuotedTranslation(verse.translation);
  const availableHeight = CARD_HEIGHT - 122 - 92;

  const sizeSteps: Array<[number, number]> = [
    [48, 26],
    [42, 24],
    [36, 22],
    [32, 20],
    [28, 18],
  ];

  let chosen = measureLayout(probe, verse.arabic, quotedTranslation, meaningFamily, 28, 18);
  for (const [arSize, trSize] of sizeSteps) {
    const candidate = measureLayout(probe, verse.arabic, quotedTranslation, meaningFamily, arSize, trSize);
    if (candidate.totalHeight <= availableHeight) {
      chosen = candidate;
      break;
    }
  }

  if (chosen.totalHeight <= availableHeight) {
    const single = paintCard(
      badgeText,
      chosen.arabicLines,
      chosen.arabicSize,
      chosen.arabicGap,
      chosen.meaningLines,
      meaningFamily,
      chosen.meaningSize,
      chosen.meaningGap,
    );
    if (!single) return { error: 'The verse image could not be drawn because a required font did not load.' };
    const dataUrl = single.toDataURL('image/png');
    return { cards: [dataUrl], sheet: dataUrl };
  }

  // For very long verses (e.g. 2:282), paginate cleanly across 1200x675 HD cards
  const cards: HTMLCanvasElement[] = [];
  const maxLinesPerCard = 6;
  const arChunks: string[][] = [];
  for (let i = 0; i < chosen.arabicLines.length; i += maxLinesPerCard) {
    arChunks.push(chosen.arabicLines.slice(i, i + maxLinesPerCard));
  }
  const trChunks: string[][] = [];
  for (let i = 0; i < chosen.meaningLines.length; i += maxLinesPerCard) {
    trChunks.push(chosen.meaningLines.slice(i, i + maxLinesPerCard));
  }
  const totalPages = Math.max(arChunks.length, trChunks.length, 1);
  if (totalPages > 20) {
    return { error: 'This passage is too long for one image. Copy the text for the full wording.' };
  }
  for (let i = 0; i < totalPages; i += 1) {
    const card = paintCard(
      badgeText,
      arChunks[i] ?? [],
      chosen.arabicSize,
      chosen.arabicGap,
      trChunks[i] ?? [],
      meaningFamily,
      chosen.meaningSize,
      chosen.meaningGap,
      totalPages > 1 ? `${i + 1}/${totalPages}` : undefined,
    );
    if (!card) return { error: 'The verse image could not be drawn because a required font did not load.' };
    cards.push(card);
  }
  const sheet = stackCards(cards);
  if (!sheet) return { error: 'The verse image could not be drawn because a required font did not load.' };
  return { cards: cards.map(card => card.toDataURL('image/png')), sheet: sheet.toDataURL('image/png') };
}

/** Real mushaf locations and reading-bar jumps. No verse text is created here. */

export interface MushafMark {
  surah: number;
  ayah: number;
  page: number;
  juz: number;
  hizb: number;
}

export interface SurahJumpInfo {
  number: number;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
}

export type ReadingJump =
  | { kind: 'verse'; surah: number; ayah: number }
  | { kind: 'surah'; surah: number }
  | { kind: 'page'; page: number }
  | { kind: 'juz'; juz: number };

export function hizbFromQuarter(quarter: number | undefined | null): number | null {
  if (typeof quarter !== 'number' || !Number.isInteger(quarter) || quarter < 1 || quarter > 240) return null;
  return Math.ceil(quarter / 4);
}

export function mushafMark(input: {
  surah?: number;
  ayah?: number;
  page?: number;
  juz?: number;
  hizbQuarter?: number;
}): MushafMark | null {
  const hizb = hizbFromQuarter(input.hizbQuarter);
  if (
    !Number.isInteger(input.surah) ||
    !Number.isInteger(input.ayah) ||
    !Number.isInteger(input.page) ||
    !Number.isInteger(input.juz) ||
    hizb == null ||
    (input.surah as number) < 1 ||
    (input.surah as number) > 114 ||
    (input.ayah as number) < 1 ||
    (input.page as number) < 1 ||
    (input.page as number) > 604 ||
    (input.juz as number) < 1 ||
    (input.juz as number) > 30
  ) {
    return null;
  }
  return { surah: input.surah as number, ayah: input.ayah as number, page: input.page as number, juz: input.juz as number, hizb };
}

function looseName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^surah\s+/, '')
    .replace(/^al[\s-]+/, '');
}

function findSurah(raw: string, surahs: SurahJumpInfo[]): SurahJumpInfo | undefined {
  const q = raw.trim().toLowerCase().replace(/^surah\s+/, '');
  const loose = looseName(raw);
  return surahs.find(item => {
    const name = item.englishName.toLowerCase();
    return q === name || q === String(item.number) || loose === looseName(item.englishName) || q === item.englishNameTranslation.toLowerCase();
  });
}

/** A search box jump. A bare number 1–114 is a surah. Juz and page need those words, except pages above 114. */
export function parseReadingJump(raw: string, surahs: SurahJumpInfo[]): ReadingJump | null {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return null;
  const page = text.match(/^(?:page|p)\s*(\d{1,3})$/i);
  if (page) {
    const n = Number(page[1]);
    return n >= 1 && n <= 604 ? { kind: 'page', page: n } : null;
  }
  const juz = text.match(/^(?:juz|j)\s*(\d{1,2})$/i);
  if (juz) {
    const n = Number(juz[1]);
    return n >= 1 && n <= 30 ? { kind: 'juz', juz: n } : null;
  }
  const verse = text.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
  if (verse) {
    const surah = Number(verse[1]);
    const ayah = Number(verse[2]);
    const info = surahs.find(item => item.number === surah);
    if (!info || ayah < 1 || ayah > info.numberOfAyahs) return null;
    return { kind: 'verse', surah, ayah };
  }
  const named = text.match(/^(.+?)\s+(\d{1,3})$/);
  if (named) {
    const info = findSurah(named[1], surahs);
    const ayah = Number(named[2]);
    if (info && ayah >= 1 && ayah <= info.numberOfAyahs) return { kind: 'verse', surah: info.number, ayah };
  }
  const info = findSurah(text, surahs);
  if (info) return { kind: 'surah', surah: info.number };
  if (/^\d{1,3}$/.test(text)) {
    const n = Number(text);
    if (n >= 115 && n <= 604) return { kind: 'page', page: n };
  }
  return null;
}

export function chapterSentence(input: { englishName: string; number: number; verses: number; place: 'Mecca' | 'Medina' | null; juz: number | null }): string {
  const count = `${input.verses} ${input.verses === 1 ? 'verse' : 'verses'}`;
  let sentence = `Surah ${input.englishName} (Chapter ${input.number}) has ${count}`;
  if (input.place && input.juz != null) sentence += ` and was revealed in ${input.place}, in Juz ${input.juz}`;
  else if (input.place) sentence += ` and was revealed in ${input.place}`;
  else if (input.juz != null) sentence += `, in Juz ${input.juz}`;
  return `${sentence}.`;
}

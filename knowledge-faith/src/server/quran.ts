import { DAY, fetchJson, UpstreamError } from './http.ts';
import { QURAN_ARABIC_EDITION, QURAN_TRANSLATIONS, type Lang } from '../shared/sources.ts';
import { isValidRef, refKey, type AyahRef } from '../shared/refs.ts';
import type { SurahInfo, Verse } from '../shared/types.ts';

const BASE = 'https://api.alquran.cloud/v1';

interface Envelope<T> {
  code: number;
  data: T;
}

interface RawAyah {
  number: number;
  numberInSurah: number;
  text: string;
  surah?: { number: number; englishName: string };
}

interface RawEdition {
  ayahs: RawAyah[];
  number: number;
  englishName: string;
}

export async function listSurahs(): Promise<SurahInfo[]> {
  const res = await fetchJson<Envelope<SurahInfo[]>>(`${BASE}/surah`, 7 * DAY);
  return res.data.map(s => ({
    number: s.number,
    name: s.name,
    englishName: s.englishName,
    englishNameTranslation: s.englishNameTranslation,
    numberOfAyahs: s.numberOfAyahs,
    revelationType: s.revelationType,
  }));
}

export async function ayahCounts(): Promise<number[]> {
  return (await listSurahs()).map(s => s.numberOfAyahs);
}

const clean = (text: string) => text.replace(/^\uFEFF/, '').trim();

function stripBismillah(text: string, surah: number, ayah: number): string {
  text = clean(text);
  // The source prefixes ayah 1 of every surah except 1 and 9 with the basmala.
  if (ayah !== 1 || surah === 1 || surah === 9) return text;
  const words = text.split(' ');
  return words.length > 4 ? words.slice(4).join(' ') : text;
}

export async function getSurah(surah: number, lang: Lang): Promise<{ info: SurahInfo; verses: Verse[] }> {
  const surahs = await listSurahs();
  const info = surahs[surah - 1];
  if (!info) throw new UpstreamError('Surah must be between 1 and 114', 400);
  const translation = QURAN_TRANSLATIONS[lang];
  const res = await fetchJson<Envelope<RawEdition[]>>(
    `${BASE}/surah/${surah}/editions/${QURAN_ARABIC_EDITION},${translation.edition}`,
    7 * DAY,
  );
  const [arabic, translated] = res.data;
  const verses = arabic.ayahs.map((a, i) => ({
    key: `${surah}:${a.numberInSurah}`,
    surah,
    ayah: a.numberInSurah,
    number: a.number,
    arabic: stripBismillah(a.text, surah, a.numberInSurah),
    translation: clean(translated.ayahs[i]?.text ?? ''),
    translator: translation.translator,
    lang,
    surahName: info.englishName,
  }));
  return { info, verses };
}

export async function getVerses(refs: AyahRef[], lang: Lang): Promise<Verse[]> {
  const counts = await ayahCounts();
  const valid = refs.filter(r => isValidRef(r, counts));
  const translation = QURAN_TRANSLATIONS[lang];
  const surahs = await listSurahs();
  return Promise.all(
    valid.map(async ref => {
      const res = await fetchJson<Envelope<RawAyah[]>>(
        `${BASE}/ayah/${refKey(ref)}/editions/${QURAN_ARABIC_EDITION},${translation.edition}`,
        7 * DAY,
      );
      const [arabic, translated] = res.data;
      return {
        key: refKey(ref),
        surah: ref.surah,
        ayah: ref.ayah,
        number: arabic.number,
        arabic: stripBismillah(arabic.text, ref.surah, ref.ayah),
        translation: clean(translated.text),
        translator: translation.translator,
        lang,
        surahName: surahs[ref.surah - 1].englishName,
      };
    }),
  );
}

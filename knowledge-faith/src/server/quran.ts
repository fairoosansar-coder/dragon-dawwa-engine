import { DAY, fetchJson, UpstreamError } from './http.ts';
import { wordingInText } from '../shared/research/counts.ts';
import { attachQuranEnc } from '../shared/quranenc.ts';
import { mushafMark, type MushafMark } from '../shared/readingNav.ts';
import { QURAN_ARABIC_EDITION, type Lang } from '../shared/sources.ts';
import { isValidRef, refKey, type AyahRef } from '../shared/refs.ts';
import type { SurahInfo, Verse } from '../shared/types.ts';
import { meaningCoverage, quranEncAya, quranEncSura, requireEdition } from './quranenc.ts';
import { cleanAyahText, pairTransliteration } from './transliteration.ts';

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
  edition?: { identifier: string };
  page?: number;
  juz?: number;
  hizbQuarter?: number;
}

interface RawEdition {
  ayahs: RawAyah[];
  number: number;
  englishName: string;
}

const PLACE_MISSING = 'That place was not returned. No verse was substituted.';

async function firstMark(url: string, expect: (mark: MushafMark) => boolean): Promise<MushafMark> {
  const res = await fetchJson<Envelope<{ ayahs?: RawAyah[] }>>(url, 7 * DAY);
  const first = res.data?.ayahs?.[0];
  const mark = mushafMark({
    surah: first?.surah?.number,
    ayah: first?.numberInSurah,
    page: first?.page,
    juz: first?.juz,
    hizbQuarter: first?.hizbQuarter,
  });
  if (!mark || !expect(mark)) throw new UpstreamError(PLACE_MISSING, 502);
  return mark;
}

export async function locatePage(page: number): Promise<MushafMark> {
  if (!Number.isInteger(page) || page < 1 || page > 604) throw new UpstreamError('Pages are 1 to 604.', 400);
  return firstMark(`${BASE}/page/${page}/${QURAN_ARABIC_EDITION}`, mark => mark.page === page);
}

export async function locateJuz(juz: number): Promise<MushafMark> {
  if (!Number.isInteger(juz) || juz < 1 || juz > 30) throw new UpstreamError('Juz are 1 to 30.', 400);
  return firstMark(`${BASE}/juz/${juz}/${QURAN_ARABIC_EDITION}`, mark => mark.juz === juz);
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

const clean = cleanAyahText;

function editionList(data: RawEdition | RawEdition[]): RawEdition[] {
  return Array.isArray(data) ? data : [data];
}

function spokenFields(text: string | undefined, edition: string | null): Pick<Verse, 'transliteration' | 'transliterationEdition'> {
  if (!edition || !text) return {};
  return { transliteration: text, transliterationEdition: edition };
}

function stripBismillah(text: string, surah: number, ayah: number): string {
  text = clean(text);
  // The source prefixes ayah 1 of every surah except 1 and 9 with the basmala.
  if (ayah !== 1 || surah === 1 || surah === 9) return text;
  const words = text.split(' ');
  return words.length > 4 ? words.slice(4).join(' ') : text;
}

export interface ArabicVerse {
  key: string;
  surah: number;
  ayah: number;
  number: number;
  arabic: string;
  surahName: string;
  page?: number;
  juz?: number;
  hizbQuarter?: number;
  transliteration?: string;
  transliterationEdition?: string;
}

/** Uthmani Arabic for one surah. This does not wait for a QuranEnc meaning or an audio list. */
export async function getSurahArabic(
  surah: number,
  pronunciationEdition: string | null = null,
): Promise<{ info: SurahInfo; verses: ArabicVerse[] }> {
  const surahs = await listSurahs();
  const info = surahs[surah - 1];
  if (!info) throw new UpstreamError('Surah must be between 1 and 114', 400);
  const [res, translitRes] = await Promise.all([
    fetchJson<Envelope<RawEdition | RawEdition[]>>(`${BASE}/surah/${surah}/editions/${QURAN_ARABIC_EDITION}`, 7 * DAY),
    pronunciationEdition
      ? fetchJson<Envelope<RawEdition | RawEdition[]>>(`${BASE}/surah/${surah}/editions/${pronunciationEdition}`, 7 * DAY).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);
  const arabic = editionList(res.data)[0];
  if (!arabic?.ayahs?.length) {
    throw new UpstreamError('The Uthmani Arabic text was not available for this surah. No other text was substituted.', 502);
  }
  const translitEdition = translitRes ? editionList(translitRes.data)[0] : undefined;
  const paired = translitEdition ? pairTransliteration(arabic.ayahs, translitEdition.ayahs) : null;
  return {
    info,
    verses: arabic.ayahs.map(a => ({
      key: `${surah}:${a.numberInSurah}`,
      surah,
      ayah: a.numberInSurah,
      number: a.number,
      arabic: stripBismillah(a.text, surah, a.numberInSurah),
      surahName: info.englishName,
      ...(typeof a.page === 'number' ? { page: a.page } : {}),
      ...(typeof a.juz === 'number' ? { juz: a.juz } : {}),
      ...(typeof a.hizbQuarter === 'number' ? { hizbQuarter: a.hizbQuarter } : {}),
      ...spokenFields(paired?.get(a.numberInSurah), paired ? pronunciationEdition : null),
    })),
  };
}

export interface SurahMeaning {
  surah: number;
  lang: Lang;
  editionKey: string;
  translationVersion: string;
  translationTitle: string;
  translationDescription: string;
  verses: { ayah: number; translation: string; footnotes: string }[];
}

/** QuranEnc meaning for one surah. The audio list is a separate request and is not waited on here. */
export async function getSurahMeaning(surah: number, lang: Lang, editionKey?: string): Promise<SurahMeaning> {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw new UpstreamError('Surah must be between 1 and 114', 400);
  const edition = await requireEdition(lang, editionKey);
  const rows = await quranEncSura(edition, surah);
  return {
    surah,
    lang,
    editionKey: edition.key,
    translationVersion: edition.version,
    translationTitle: edition.title,
    translationDescription: edition.description,
    verses: rows.map(row => ({ ayah: row.aya, translation: row.translation, footnotes: row.footnotes })),
  };
}

export async function getSurah(
  surah: number,
  lang: Lang,
  pronunciationEdition: string | null = null,
  editionKey?: string,
): Promise<{ info: SurahInfo; verses: Verse[] }> {
  const surahs = await listSurahs();
  const info = surahs[surah - 1];
  if (!info) throw new UpstreamError('Surah must be between 1 and 114', 400);
  const [edition, res, translitRes] = await Promise.all([
    requireEdition(lang, editionKey),
    fetchJson<Envelope<RawEdition | RawEdition[]>>(`${BASE}/surah/${surah}/editions/${QURAN_ARABIC_EDITION}`, 7 * DAY),
    pronunciationEdition
      ? fetchJson<Envelope<RawEdition | RawEdition[]>>(`${BASE}/surah/${surah}/editions/${pronunciationEdition}`, 7 * DAY).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);
  const arabic = editionList(res.data)[0];
  if (!arabic?.ayahs?.length) {
    throw new UpstreamError('The Uthmani Arabic text was not available for this surah. No other text was substituted.', 502);
  }
  const translitEdition = translitRes ? editionList(translitRes.data)[0] : undefined;
  const paired = translitEdition ? pairTransliteration(arabic.ayahs, translitEdition.ayahs) : null;
  const [rows, manifest] = await Promise.all([quranEncSura(edition, surah), meaningCoverage(edition.key)]);
  const verses = attachQuranEnc(
    arabic.ayahs.map(a => ({
      key: `${surah}:${a.numberInSurah}`,
      surah,
      ayah: a.numberInSurah,
      number: a.number,
      arabic: stripBismillah(a.text, surah, a.numberInSurah),
      lang,
      surahName: info.englishName,
      ...spokenFields(paired?.get(a.numberInSurah), paired ? pronunciationEdition : null),
    })),
    edition,
    rows,
    manifest,
  );
  if (!verses) throw new UpstreamError('QuranEnc text does not match this surah. No other translation was substituted.', 502);
  return { info, verses };
}

export async function getVerses(
  refs: AyahRef[],
  lang: Lang,
  pronunciationEdition: string | null = null,
  editionKey?: string,
): Promise<Verse[]> {
  const counts = await ayahCounts();
  const valid = refs.filter(r => isValidRef(r, counts));
  if (!valid.length) return [];
  const edition = await requireEdition(lang, editionKey);
  const manifest = await meaningCoverage(edition.key);
  const surahs = await listSurahs();
  const editions = [QURAN_ARABIC_EDITION, pronunciationEdition].filter(Boolean).join(',');
  return Promise.all(
    valid.map(async ref => {
      const [res, row] = await Promise.all([
        fetchJson<Envelope<RawAyah[]>>(`${BASE}/ayah/${refKey(ref)}/editions/${editions}`, 7 * DAY),
        quranEncAya(edition, ref.surah, ref.ayah),
      ]);
      const byEdition = new Map(res.data.map(item => [item.edition?.identifier, item]));
      const arabic = byEdition.get(QURAN_ARABIC_EDITION);
      if (!arabic?.text || !arabic.number) {
        throw new UpstreamError('The Uthmani Arabic text was not available for this verse. No other text was substituted.', 502);
      }
      const spoken = pronunciationEdition ? byEdition.get(pronunciationEdition) : undefined;
      const attached = attachQuranEnc(
        [
          {
            key: refKey(ref),
            surah: ref.surah,
            ayah: ref.ayah,
            number: arabic.number,
            arabic: stripBismillah(arabic.text, ref.surah, ref.ayah),
            lang,
            surahName: surahs[ref.surah - 1].englishName,
            ...spokenFields(spoken ? clean(spoken.text) : undefined, pronunciationEdition),
          },
        ],
        edition,
        [row],
        manifest,
      );
      if (!attached) throw new UpstreamError('QuranEnc text does not match this verse. No other translation was substituted.', 502);
      return attached[0];
    }),
  );
}

export interface QuranSearchHit {
  surah: number;
  ayah: number;
  text: string;
}

/**
 * Whole-word matches for one wording.
 * `total` is the filtered unique count. `hits` is capped; the remainder is `total - hits.length`.
 * Arabic is searched in the Uthmani text. A 404 means the wording was not found.
 */
export async function searchQuranAyahs(phrase: string): Promise<{ total: number; refs: AyahRef[]; hits: QuranSearchHit[] }> {
  const query = phrase.replace(/\s+/g, ' ').trim();
  const arabic = /[\u0600-\u06FF]/.test(query);
  if ((arabic ? query.length < 2 : query.length < 3) || query.length > 32) return { total: 0, refs: [], hits: [] };
  const edition = arabic ? QURAN_ARABIC_EDITION : 'en.sahih';
  try {
    const res = await fetchJson<Envelope<{ matches?: { numberInSurah?: number; text?: string; surah?: { number?: number } }[] }>>(
      `${BASE}/search/${encodeURIComponent(query)}/all/${edition}`,
      DAY,
    );
    const keys = new Map<string, QuranSearchHit>();
    for (const match of res.data?.matches ?? []) {
      const surah = match.surah?.number;
      const ayah = match.numberInSurah;
      const text = match.text ?? '';
      if (!surah || !ayah || !text || !wordingInText(query, text)) continue;
      const key = `${surah}:${ayah}`;
      if (!keys.has(key)) keys.set(key, { surah, ayah, text });
    }
    const all = [...keys.values()];
    const hits = all.slice(0, 120);
    return { total: all.length, refs: hits.map(({ surah, ayah }) => ({ surah, ayah })), hits };
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) return { total: 0, refs: [], hits: [] };
    throw err;
  }
}

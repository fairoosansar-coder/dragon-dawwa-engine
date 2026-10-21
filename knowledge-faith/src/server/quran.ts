import { DAY, fetchJson, UpstreamError } from './http.ts';
import { QURAN_ARABIC_EDITION, QURAN_TRANSLATIONS, type Lang } from '../shared/sources.ts';
import { isValidRef, refKey, type AyahRef } from '../shared/refs.ts';
import type { SurahInfo, Verse } from '../shared/types.ts';
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

export async function getSurah(
  surah: number,
  lang: Lang,
  pronunciationEdition: string | null = null,
): Promise<{ info: SurahInfo; verses: Verse[] }> {
  const surahs = await listSurahs();
  const info = surahs[surah - 1];
  if (!info) throw new UpstreamError('Surah must be between 1 and 114', 400);
  const translation = QURAN_TRANSLATIONS[lang];
  const [res, translitRes] = await Promise.all([
    fetchJson<Envelope<RawEdition[]>>(
      `${BASE}/surah/${surah}/editions/${QURAN_ARABIC_EDITION},${translation.edition}`,
      7 * DAY,
    ),
    pronunciationEdition
      ? fetchJson<Envelope<RawEdition | RawEdition[]>>(`${BASE}/surah/${surah}/editions/${pronunciationEdition}`, 7 * DAY).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);
  const [arabic, translated] = res.data;
  const translitEdition = translitRes ? editionList(translitRes.data)[0] : undefined;
  const paired = translitEdition ? pairTransliteration(arabic.ayahs, translitEdition.ayahs) : null;
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
    ...spokenFields(paired?.get(a.numberInSurah), paired ? pronunciationEdition : null),
  }));
  return { info, verses };
}

export async function getVerses(refs: AyahRef[], lang: Lang, pronunciationEdition: string | null = null): Promise<Verse[]> {
  const counts = await ayahCounts();
  const valid = refs.filter(r => isValidRef(r, counts));
  const translation = QURAN_TRANSLATIONS[lang];
  const surahs = await listSurahs();
  const editions = [QURAN_ARABIC_EDITION, translation.edition, pronunciationEdition].filter(Boolean).join(',');
  return Promise.all(
    valid.map(async ref => {
      const res = await fetchJson<Envelope<RawAyah[]>>(`${BASE}/ayah/${refKey(ref)}/editions/${editions}`, 7 * DAY);
      const byEdition = new Map(res.data.map(item => [item.edition?.identifier, item]));
      const arabic = byEdition.get(QURAN_ARABIC_EDITION) ?? res.data[0];
      const translated = byEdition.get(translation.edition) ?? res.data[1];
      const spoken = pronunciationEdition ? byEdition.get(pronunciationEdition) : undefined;
      return {
        key: refKey(ref),
        surah: ref.surah,
        ayah: ref.ayah,
        number: arabic.number,
        arabic: stripBismillah(arabic.text, ref.surah, ref.ayah),
        translation: clean(translated?.text ?? ''),
        translator: translation.translator,
        lang,
        surahName: surahs[ref.surah - 1].englishName,
        ...spokenFields(spoken ? clean(spoken.text) : undefined, pronunciationEdition),
      };
    }),
  );
}

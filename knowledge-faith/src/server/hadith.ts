import { DAY, fetchJson, UpstreamError } from './http.ts';
import { findCollection, hadithEdition, type Lang } from '../shared/sources.ts';
import type { Grade, Hadith, HadithSection } from '../shared/types.ts';
import { localizeHadith, translateStudyTexts } from './hadithTranslate.ts';

const BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';

interface RawHadith {
  hadithnumber: number;
  text: string;
  grades: Grade[];
  reference: { book: number; hadith: number };
}

interface RawFile {
  metadata: { name: string; section: Record<string, string> };
  hadiths: RawHadith[];
}

interface RawInfo {
  [collection: string]: {
    metadata: {
      sections: Record<string, string>;
      section_details: Record<string, { hadithnumber_first: number; hadithnumber_last: number }>;
      last_hadithnumber: number;
    };
  };
}

let sectionIndex: Promise<Map<string, { sections: HadithSection[]; last: number }>> | null = null;

/** The upstream index is several MB, so it is reduced once to section titles and ranges. */
function loadSectionIndex() {
  sectionIndex ??= fetchJson<RawInfo>(`${BASE}/info.min.json`, DAY, 30_000)
    .then(info => {
      const map = new Map<string, { sections: HadithSection[]; last: number }>();
      for (const [id, { metadata }] of Object.entries(info)) {
        const sections = Object.entries(metadata.sections)
          .filter(([key, title]) => key !== '0' && title)
          .map(([key, title]) => ({
            id: Number(key),
            title,
            first: metadata.section_details[key]?.hadithnumber_first ?? 0,
            last: metadata.section_details[key]?.hadithnumber_last ?? 0,
          }));
        map.set(id, { sections, last: metadata.last_hadithnumber });
      }
      return map;
    })
    .catch(err => {
      sectionIndex = null;
      throw err;
    });
  return sectionIndex;
}

function requireCollection(id: string) {
  const collection = findCollection(id);
  if (!collection) throw new UpstreamError('Unknown hadith collection', 400);
  return collection;
}

export async function listSections(
  collectionId: string,
  lang: Lang = 'en',
): Promise<{ sections: HadithSection[]; last: number; machineTranslation: boolean }> {
  requireCollection(collectionId);
  const entry = (await loadSectionIndex()).get(collectionId);
  if (!entry) throw new UpstreamError('Collection index unavailable', 502);
  if (lang === 'en') return { ...entry, machineTranslation: false };
  const rendered = await translateStudyTexts(
    entry.sections.map(section => section.title),
    lang,
  );
  const sections = entry.sections.map((section, i) => ({
    ...section,
    title: rendered[i]?.machineTranslation ? rendered[i].text : section.title,
    machineTranslation: Boolean(rendered[i]?.machineTranslation),
  }));
  return { sections, last: entry.last, machineTranslation: sections.some(section => section.machineTranslation) };
}

function merge(
  collectionId: string,
  translated: RawHadith[],
  arabic: RawHadith[],
  lang: Lang,
  sectionTitles: Record<string, string>,
): Hadith[] {
  const collection = requireCollection(collectionId);
  const arabicByNumber = new Map(arabic.map(h => [h.hadithnumber, h.text]));
  return translated
    .filter(h => h.text.trim())
    .map(h => ({
      collection: collection.id,
      collectionName: collection.name,
      number: h.hadithnumber,
      arabic: arabicByNumber.get(h.hadithnumber) ?? null,
      text: h.text,
      lang,
      grades: h.grades ?? [],
      book: h.reference?.book ?? 0,
      section: sectionTitles[String(h.reference?.book)] ?? null,
    }));
}

async function arabicFile(collectionId: string, path: string): Promise<RawFile | null> {
  try {
    return await fetchJson<RawFile>(`${BASE}/editions/ara-${collectionId}/${path}.min.json`, 7 * DAY);
  } catch {
    return null;
  }
}

export async function getSection(
  collectionId: string,
  section: number,
  lang: Lang,
  limit?: number,
): Promise<{ items: Hadith[]; total: number }> {
  const collection = requireCollection(collectionId);
  if (!Number.isInteger(section) || section < 1) throw new UpstreamError('Invalid section', 400);
  const edition = hadithEdition(collection, lang);
  const [translated, arabic] = await Promise.all([
    fetchJson<RawFile>(`${BASE}/editions/${edition.edition}/sections/${section}.min.json`, 7 * DAY),
    arabicFile(collection.id, `sections/${section}`),
  ]);
  const merged = merge(collection.id, translated.hadiths, arabic?.hadiths ?? [], edition.lang, translated.metadata.section);
  const cap = limit && Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), merged.length)) : merged.length;
  return { items: await localizeHadith(merged.slice(0, cap), lang, edition.lang), total: merged.length };
}

export async function getHadith(collectionId: string, number: number, lang: Lang): Promise<Hadith | null> {
  const collection = requireCollection(collectionId);
  if (!Number.isInteger(number) || number < 1) return null;
  const edition = hadithEdition(collection, lang);
  let translated: RawFile;
  try {
    translated = await fetchJson<RawFile>(`${BASE}/editions/${edition.edition}/${number}.min.json`, 7 * DAY);
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) return null;
    throw err;
  }
  const arabic = await arabicFile(collection.id, String(number));
  const merged = merge(collection.id, translated.hadiths, arabic?.hadiths ?? [], edition.lang, translated.metadata.section);
  if (!merged[0]) return null;
  const [localized] = await localizeHadith(merged.slice(0, 1), lang, edition.lang);
  return localized ?? null;
}

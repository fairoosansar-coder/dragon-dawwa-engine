import { DAY, fetchJson, UpstreamError } from './http.ts';
import { segmentHadithRecord } from '../shared/hadithSegmentation.ts';
import { passageSupportsTopic } from '../shared/research.ts';
import { findCollection, hadithEdition, type Lang } from '../shared/sources.ts';
import type { Grade, Hadith, HadithSection } from '../shared/types.ts';
import {editionFileNumber,exactEditionRow} from '../shared/editionNumber.ts';
import { localizeHadith, translateStudyTexts } from './hadithTranslate.ts';

const BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';
/** The CDN can refuse files from this large package. The upstream mirror serves the same edition/tag. */
export async function editionJson<T>(url:string,ttl:number,timeout=12_000,read=fetchJson<T>):Promise<T> {
  if (!url.startsWith(BASE+'/')) throw new Error('Not a versioned Hadith API URL');
  try {return await read(url,ttl,timeout);}
  catch(e) {
    if (!(e instanceof UpstreamError) || (e.status!==404 && e.status!==502 && e.status!==504)) throw e;
    return read('https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/'+url.slice(BASE.length+1),ttl,timeout);
  }
}

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
  sectionIndex ??= editionJson<RawInfo>(`${BASE}/info.min.json`, DAY, 30_000)
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

async function arabicFile(collectionId: string, path: string,required=false): Promise<RawFile | null> {
  try {
    return await editionJson<RawFile>(`${BASE}/editions/ara-${collectionId}/${path}.min.json`, 7 * DAY);
  } catch (err) {
    if (required && !(err instanceof UpstreamError && err.status===404)) throw err;
    return null;
  }
}

export async function getSection(
  collectionId: string,
  section: number,
  lang: Lang,
  limit?: number,
  readerFallback = false,
): Promise<{ items: Hadith[]; total: number }> {
  const collection = requireCollection(collectionId);
  if (!Number.isInteger(section) || section < 1) throw new UpstreamError('Invalid section', 400);
  const edition = hadithEdition(collection, lang);
  const [translated, arabic] = await Promise.all([
    editionJson<RawFile>(`${BASE}/editions/${edition.edition}/sections/${section}.min.json`, 7 * DAY).catch(err=>{
      if (readerFallback && err instanceof UpstreamError && err.status===404)
        return {hadiths:[],metadata:{name:'',section:{}}} as RawFile;
      throw err;
    }),
    arabicFile(collection.id, `sections/${section}`,readerFallback),
  ]);
  let merged = merge(collection.id, translated.hadiths, arabic?.hadiths ?? [], edition.lang, translated.metadata.section);
  if (readerFallback && collection.tamil) {
    const other=edition.lang==='ta'?'en':'ta';
    const alternate=await editionJson<RawFile>(`${BASE}/editions/${other==='en'?'eng':'tam'}-${collection.id}/sections/${section}.min.json`,7*DAY)
      .catch(err=>{if(err instanceof UpstreamError && err.status===404)return null;throw err;});
    if (alternate) merged=fillMissingEditionRows(merged,merge(collection.id,alternate.hadiths,arabic?.hadiths??[],other,alternate.metadata.section));
  }
  if (readerFallback && arabic) {
    const present=new Set(merged.map(h=>h.number));
    const originals=merge(collection.id,arabic.hadiths,arabic.hadiths,lang,{}).filter(h=>!present.has(h.number))
      .map(h=>({...h,text:'',arabic:h.text,section:null,originalOnly:true}));
    merged=[...merged,...originals].sort((a,b)=>a.number-b.number);
  }
  const cap = limit && Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), merged.length)) : merged.length;
  const sliced = merged.slice(0, cap).map(h=>readerFallback ? sinhalaReaderDraft(h,lang) : h);
  // Do not submit unseen pages or published Tamil alternatives to the English translation pipeline.
  const primary=sliced.filter(h=>!h.originalOnly && h.lang===edition.lang);
  const localized=new Map((await localizeHadith(primary,lang,edition.lang)).map(h=>[h.number,h]));
  const items = sliced.map(row=>localized.get(row.number)??row).map(item => ({
    ...item,
    segmented: segmentHadithRecord({
      arabic: item.arabic,
      text: item.text,
      lang: item.lang,
    }),
  }));
  return { items, total: merged.length };
}

export function fillMissingEditionRows(primary: Hadith[], alternate: Hadith[]): Hadith[] {
  const seen=new Set(primary.map(h=>`${h.collection}:${h.number}`));
  return [...primary,...alternate.filter(h=>(h.lang==='en'||h.lang==='ta') && h.text.trim() && !seen.has(`${h.collection}:${h.number}`))]
    .sort((a,b)=>a.number-b.number);
}

export async function readerArabicOnly(collectionId:string,n:number,lang:Lang):Promise<Hadith|null> {
  const bucket=editionFileNumber(n); if(!bucket) return null;
  const c=requireCollection(collectionId), raw=await arabicFile(c.id,String(bucket),true);
  if(!raw) return null;
  const row=exactEditionRow(merge(c.id,raw.hadiths,raw.hadiths,lang,{}),n);
  return row?{...row,text:'',arabic:row.text,section:null,originalOnly:true,machineTranslation:false}:null;
}

export async function getHadith(collectionId: string, number: number, lang: Lang): Promise<Hadith | null> {
  const collection = requireCollection(collectionId);
  const fileNumber=editionFileNumber(number);
  if (!fileNumber) return null;
  const edition = hadithEdition(collection, lang);
  let translated: RawFile;
  try {
    translated = await editionJson<RawFile>(`${BASE}/editions/${edition.edition}/${fileNumber}.min.json`, 7 * DAY);
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) return null;
    throw err;
  }
  const arabic = await arabicFile(collection.id, String(fileNumber));
  const merged = merge(collection.id, translated.hadiths, arabic?.hadiths ?? [], edition.lang, translated.metadata.section);
  const exact=exactEditionRow(merged,number);
  if (!exact) return null;
  const [localized] = await localizeHadith([exact], lang, edition.lang);
  if (!localized) return null;
  return {
    ...localized,
    segmented: segmentHadithRecord({
      arabic: localized.arabic,
      text: localized.text,
      lang: localized.lang,
    }),
  };
}

/** Public reader and share previews may show another verified edition; evidence lookups stay strict. */
export async function readClassicHadith(id:string,n:number,lang:Lang,read=getHadith,original=readerArabicOnly) {
  const collection=requireCollection(id);
  if(id==='abudawud' && n===1 && lang==='si'){
    const source=await read(id,n,'en');
    if(source){const draft=sinhalaReaderDraft(source,lang); if(draft!==source)return draft;}
  }
  const primary=await read(id,n,lang);
  if(primary)return primary;
  if(collection.tamil){
    const alternate=await read(id,n,lang==='ta'?'en':'ta');
    if(alternate)return alternate;
  }
  return original(id,n,lang);
}

function sinhalaReaderDraft(h:Hadith,requested:Lang):Hadith {
  if(requested!=='si'||h.collection!=='abudawud'||h.number!==1||h.lang!=='en'||h.originalOnly)return h;
  const text='මුගීරා ඉබ්නු ෂුඃබා (රළි) තුමා වාර්තා කළේය: “නබිතුමා ﷺ ශරීර කෘත්‍යය ඉටු කිරීමට පිටතට යන විට දුර බැහැර තැනකට ගියහ.”';
  return {...h,lang:'si',text,machineTranslation:true,
    translationProvenance:{sourceLanguage:'ta',nativeReview:'pending',sourceUrl:'https://tamililquran.com/hadith.php?book=1&collection=4'},
    segmented:segmentHadithRecord({arabic:h.arabic,text,lang:'si'})};
}

export interface StudyHadith extends Hadith {
  /** Hadith number inside the book, as printed by the edition file. */
  inBook: number;
}

function distinctivePair(question: string, phrases: readonly string[]): boolean {
  const blob = `${question}\n${phrases.join('\n')}`;
  return /\b(?:torah|tawrah|taurat|tawrat)\b/i.test(blob) && /\bhebrew\b/i.test(blob);
}

/** Rank edition rows by the question’s own wording. The hadith text is not rewritten. */
export function rankEditionHadiths(
  question: string,
  phrases: readonly string[],
  hadiths: readonly { hadithnumber: number; text: string }[],
  limit = 3,
): number[] {
  const pair = distinctivePair(question, phrases);
  const scored = hadiths
    .map(hadith => {
      const text = hadith.text ?? '';
      if (!text.trim()) return { number: hadith.hadithnumber, score: 0 };
      const pairHit = pair && /torah|tawrah|taurat|tawrat/i.test(text) && /hebrew/i.test(text);
      const supported = passageSupportsTopic(question, text) || phrases.some(phrase => phrase.length > 2 && passageSupportsTopic(phrase, text));
      const score = (pairHit ? 50 : 0) + (supported ? 10 : 0);
      return { number: hadith.hadithnumber, score };
    })
    .filter(item => item.score >= (pair ? 50 : 10));
  scored.sort((a, b) => b.score - a.score || a.number - b.number);
  const best = scored[0]?.score ?? 0;
  return scored
    .filter(item => item.score >= best)
    .slice(0, limit)
    .map(item => item.number)
    .sort((a, b) => a - b);
}

/**
 * Search the hadith-api study editions by wording.
 * A collection that returns a match stops the scan. The next collection is opened only when this one lacks the narration.
 */
export async function findStudyHadiths(
  lang: Lang,
  question: string,
  phrases: readonly string[],
  collectionIds: readonly string[],
): Promise<StudyHadith[]> {
  const ids = collectionIds.length ? collectionIds : ['bukhari'];
  for (const collectionId of ids) {
    const collection = findCollection(collectionId);
    if (!collection) continue;
    const edition = hadithEdition(collection, 'en');
    let file: RawFile;
    try {
      file = await editionJson<RawFile>(`${BASE}/editions/${edition.edition}.min.json`, 7 * DAY, 20_000);
    } catch (err) {
      if (err instanceof UpstreamError && err.status === 404) continue;
      throw err;
    }
    const numbers = rankEditionHadiths(question, phrases, file.hadiths, 3);
    const matches: StudyHadith[] = [];
    for (const number of numbers) {
      const row = file.hadiths.find(hadith => hadith.hadithnumber === number);
      const full = await getHadith(collectionId, number, lang);
      if (!full) continue;
      matches.push({ ...full, inBook: row?.reference?.hadith ?? 0 });
    }
    if (matches.length) return matches;
  }
  return [];
}

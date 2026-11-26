import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadHadeeth, searchHadeeth } from '../hadeethenc.ts';
import type { OpenPassageSource } from './reportFormat.ts';

const STOP = new Set(
  'a an the i we you to in on it us for my of or and does do did is was are can how what when where who with about something heard saying say says said according quran qur islam islamic holy hadith prophet teach teaches report verse chapter tell please this that from before after why mean meaning explain whether there shall has have would should as be by at quote me true muslim muslims'.split(
    ' ',
  ),
);

type VerseIndex = {
  verses: Record<string, string>;
  tokens: Record<string, Set<string>>;
  df: Map<string, number>;
  /** Precomputed once — avoid `Object.keys(tokens).length` inside the scoring loop. */
  size: number;
};

let cached: VerseIndex | null = null;

function tokens(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z]{3,}/g) || []).filter(token => !STOP.has(token)),
  );
}

function loadVerseIndex(): VerseIndex {
  if (cached) return cached;
  const file = path.join(process.cwd(), 'public', 'data', 'quran-en.json');
  const corpus = JSON.parse(readFileSync(file, 'utf8')) as {
    surahs: Array<{ id: number; v: Array<[string, string]> }>;
  };
  const verses: Record<string, string> = {};
  for (const surah of corpus.surahs) {
    surah.v.forEach((row, index) => {
      verses[`${surah.id}:${index + 1}`] = row[1];
    });
  }
  const tokenMap: Record<string, Set<string>> = {};
  const df = new Map<string, number>();
  for (const [ref, text] of Object.entries(verses)) {
    const set = tokens(text);
    tokenMap[ref] = set;
    for (const term of set) df.set(term, (df.get(term) || 0) + 1);
  }
  cached = { verses, tokens: tokenMap, df, size: Object.keys(tokenMap).length };
  return cached;
}

export async function openPassageEvidence(question: string,onEvent?:(event:{search:'quran'|'hadith'}|{opened:string})=>void): Promise<OpenPassageSource[]> {
  onEvent?.({search:'quran'});
  const index = loadVerseIndex();
  const terms = tokens(question);
  let refs = [...question.matchAll(/\b(\d{1,3}:\d{1,3})\b/g)].map(match => match[1]);
  if (!refs.length) {
    const corpusSize = index.size;
    const scored = Object.entries(index.tokens)
      .map(([ref, set]) => {
        let score = 0;
        for (const term of terms) {
          if (set.has(term)) {
            score += Math.log((corpusSize + 1) / ((index.df.get(term) || 0) + 1));
          }
        }
        return { score, ref };
      })
      .sort((a, b) => b.score - a.score);
    const best = scored[0]?.score ?? 0;
    refs = scored
      .filter(row => row.score > 2 && row.score >= best * 0.55)
      .slice(0, 5)
      .map(row => row.ref);
  }

  const rows: OpenPassageSource[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (!index.verses[ref] || seen.has(ref)) continue;
    seen.add(ref);
    rows.push({
      id: `quran:${ref}`,
      locator: `Qur\u2019an ${ref}`,
      text: index.verses[ref],
      provider: 'Saheeh International \u00b7 local Qur\u2019an edition',
      canonicalUrl: `https://quran.com/${ref.replace(':', '/')}`,
    });
    onEvent?.({opened:`quran:${ref}`});
    if (rows.length >= 6) break;
  }

  if (!refs.length || /hadith|prophet|sunnah/i.test(question)) {
    try {
      const term = [...terms].sort((a, b) => b.length - a.length || a.localeCompare(b)).slice(0, 3).join(' ');
      if (term) {
        onEvent?.({search:'hadith'});
        const hits = await searchHadeeth('en', term, 1);
        for (const hit of hits.items.slice(0, 2)) {
          const ident = String(hit.id);
          if (!/^\d+$/.test(ident)) continue;
          const rec = await loadHadeeth('en', ident);
          if (!rec.text) continue;
          rows.push({
            id: `hadith:${ident}`,
            locator: `HadeethEnc ${ident}`,
            text: rec.text.slice(0, 4000),
            provider: 'HadeethEnc',
            publishedGrade: rec.grade ?? null,
            canonicalUrl: `https://hadeethenc.com/en/browse/hadith/${ident}`,
          });
          onEvent?.({opened:`hadith:${ident}`});
        }
      }
    } catch {
      /* Hadith lookup is best-effort for the public desk. */
    }
  }
  return rows.slice(0, 8);
}
import {getVerses} from '../quran.ts';
import type {Lang} from '../../shared/sources.ts';
import {reportCopy} from '../../shared/openPassageLanguage.ts';
import {matchesResearchLanguage} from './localize.ts';

/** Use a published counterpart for display; never turn an AI paraphrase into a source quotation. */
export async function displaySources(rows:OpenPassageSource[],lang:Lang,onChecked?:()=>void){
  if(lang==='en')return rows;
  return Promise.all(rows.map(async s=>{
    const [kind,...parts]=s.id.split(':');
    try{
      if(kind==='quran'){
        const [surah,ayah]=parts.map(Number);
        const [v]=await getVerses([{surah,ayah}],lang);
        if(v?.key===`${surah}:${ayah}`&&v.lang===lang&&matchesResearchLanguage(v.translation,lang))
          return {...s,locator:`${lang==='ta'?'குர்ஆன்':'කුර්ආනය'} ${surah}:${ayah}`,text:v.translation,provider:v.translator};
      }else if(kind==='hadith'){
        const rec=await loadHadeeth(lang,parts[0]);
        if(rec.id===parts[0]&&rec.lang===lang&&matchesResearchLanguage(rec.text,lang))return {...s,text:rec.text,canonicalUrl:rec.sourceUrl,publishedGrade:rec.grade};
      }
    }catch{/* The exact original remains accessible through its citation link. */}
    return {...s,text:reportCopy(lang).linkOnly,linkOnly:true,provider:kind==='quran'?'Saheeh International':'HadeethEnc'};
  }).map(task=>task.then(source=>{onChecked?.();return source;})));
}

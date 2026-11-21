import type { HadeethEncRetrievedRecord as Record } from '../types/hadith.ts';

// A quoted text match, not a semantic-search score. Keep negation, word order
// and the entire distinguishing clause. A title alone can be an abridgment.
function words(s: string) {
  return s.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/gu,'')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').trim().split(/\s+/u)
    .filter(w=>w && w!=='truly').join(' ');
}
export function matchesNarration(input:string, title:string, translation:string, arabic:string|null) {
  const query=words(input);
  if(query.split(' ').length<5 || query.length<20) return false;
  const excerpts=[title,translation,arabic||''].flatMap(s=>[s,...Array.from(s.matchAll(/["“«]([^"”»]+)["”»]/gu),m=>m[1]),...s.split(/(?:said|saying)\s*:\s*/iu).slice(1)]);
  return excerpts.some(s=>!/(?:\.{3}|…)\s*$/u.test(s.trim())&&words(s)===query);
}
export interface AutomatedFinding {
  status:'matched'|'conflicting-grades'|'insufficient';
  method:'model-assisted'|'benchmark-and-source-check'|'source-check';
  sources:{id:string;grade:string|null;url:string}[];
}
export function decideFinding(q:string, rows:Record[],method:AutomatedFinding['method']):AutomatedFinding {
  const sources=rows.filter(r=>r.source_url===`https://hadeethenc.com/${r.language}/browse/hadith/${r.id}`&&matchesNarration(q,r.title,r.translation,r.arabic))
    .map(r=>({id:r.id,grade:r.published_grade,url:r.source_url}));
  const grades=new Set(sources.map(s=>s.grade?.toLowerCase().trim().replace(/\s+hadith$/,'')).filter(Boolean));
  return {status:!sources.length?'insufficient':grades.size>1?'conflicting-grades':'matched',method,sources};
}
export function findingLabel(f?:AutomatedFinding) {
  if(!f)return 'Archived result · automated source check not recorded';
  return f.status==='matched'?'Research complete · narration matched':f.status==='conflicting-grades'?'Research complete · published grades differ':'Research complete · insufficient evidence for a direct match';
}

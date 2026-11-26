import type {Lang} from '../../shared/sources.ts';
import {progressCopy,stepFor,type ResearchProgress as Snapshot} from '../../shared/openPassageProgress.ts';

export function ResearchProgress({lang,progress:p}:{lang:Lang;progress:Snapshot}){
  if(p.activity==='failed'||p.activity==='ready')return null;
  const c=progressCopy(lang),step=stepFor[p.activity];
  const phase=c[p.activity],position=`${c.step} ${step} / 4`;
  return <div className="op-progress" data-activity={p.activity} lang={lang}>
    <div className="op-progress-head"><strong role="status">{phase}</strong><small>{position}</small></div>
    <div className="op-progress-track" role="progressbar" aria-label={c.progress} aria-valuemin={0} aria-valuemax={4} aria-valuenow={step-1} aria-valuetext={`${position}: ${phase}`}>
      {[1,2,3,4].map(n=><span key={n} className={n<step?'done':n===step?'active':''}/>)}
    </div>
    {p.activity==='editions'&&p.editionsTotal>0&&<div className="op-progress-count">{c.checked}: {p.editionsChecked} / {p.editionsTotal}</div>}
    {p.opened.length>0&&<div className="op-progress-sources"><small>{c.opened} ({p.opened.length})</small>
      <ul>{p.opened.map(id=><li key={id}>{id.startsWith('quran:')?`${c.verse} ${id.slice(6)}`:`HadeethEnc ${id.replace(/^hadith:/,'')}`}</li>)}</ul>
    </div>}
  </div>;
}

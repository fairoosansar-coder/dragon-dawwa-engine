import { useApp } from '../../lib/store.tsx';
import { requestAuthenticatedNavigation } from '../../lib/seekerAuth.ts';
const desks = ['#/hub', '#/quran', '#/books', '#/hub/saved'] as const;
const copy = {en:['Home','Qur’an','Books','Saved'],ta:['முகப்பு','குர்ஆன்','நூல்கள்','சேமித்தவை'],si:['මුල් පිටුව','කුර්ආනය','පොත්','සුරැකි']};
export function ReadingNav({path,sub,signed}:{path:string;sub?:string;signed:boolean}){
  const {lang}=useApp();
  return <nav className="ms-nav" aria-label="Reading library">{desks.map((href,i)=>{
    const current=i===0?path==='hub'&&!sub:i===1?path==='quran'&&sub!=='wall':i===2?path==='books':path==='hub'&&sub==='saved';
    return <a key={href} href={href} aria-current={current?'page':undefined} onClick={e=>{if(!signed&&i){e.preventDefault();requestAuthenticatedNavigation(href,copy[lang][i])}}}>{copy[lang][i]}</a>;
  })}</nav>;
}
export function ReadingBrand(){return <a className="ms-brand" href="#/hub"><span aria-hidden="true">DD</span><b>DRAGON DAWWA<small>BY AEGIS INTELLIGENCE</small></b></a>}

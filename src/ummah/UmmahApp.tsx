import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Users, Heart, House, Plus, Search, Bell, Menu, X, ChevronLeft, ChevronRight, Headphones, ShieldCheck, Building2, Settings, Compass } from 'lucide-react';
import LegacyApp from '../App';
import { PrayerWidget } from '../ds/PrayerWidget';
import { SupportedLanguage } from '../utils/localization';
import { backend, groups, mosqueTabs, routeFromHash, screens, screenNumber, screenStatus } from './catalog';
import './prototype.css';
import './ummah.css';

const nav = (route: string) => { window.location.hash = '/' + route; };
function readLocal(key: string, fallback = '') { try { return localStorage.getItem('uc.' + key) || fallback; } catch { return fallback; } }
function saveLocal(key: string, value: string) { try { localStorage.setItem('uc.' + key, value); return true; } catch { return false; } }
const titles: Record<string,string> = { directory: 'Explore UmmahConnect', podcasts: 'Podcasts & Voice Studio' };

class ServiceBoundary extends React.Component<{children: React.ReactNode}, {failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <div className="uc-card"><h2>This service could not load</h2><p>Your navigation and other pages remain available.</p><button onClick={()=>this.setState({failed:false})}>Retry service</button></div> : this.props.children; }
}
function SocialView({ route }: {route:string}) {
  const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(1),[space,setSpace]=useState<number|null>(null);
  const serial=useRef(0);
  async function load(target:number|null=space,p=page) {
    const seq=++serial.current;setBusy(true);setError('');setData(null);
    try { const url=target?`/api/social/posts?space=${target}&page=${p}`:`/api/social/spaces?page=${p}`;
      const response=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json'}});
      const body=await response.json();
      if(!response.ok) throw new Error(response.status===401?'Sign-in and HumHub account linking are not connected in this environment.':response.status===503?'The isolated HumHub service is not configured yet.':body.error||'Community data is unavailable.');
      if(seq===serial.current)setData(body);
    }catch(e){if(seq===serial.current)setError(e instanceof Error?e.message:'Community unavailable.');}finally{if(seq===serial.current)setBusy(false);}
  }
  useEffect(()=>{setSpace(null);setPage(1);load(null,1);return()=>{serial.current++;};},[route]);
  return <section className="uc-card"><div className="uc-section-title"><h2>{space?'Community posts':'Your communities'}</h2><Users/></div><p>Real HumHub data, using the connected member’s permissions.</p>
    {space&&<button onClick={()=>{setSpace(null);setPage(1);load(null,1);}}>Back to communities</button>}
    {busy&&<p role="status">Loading community…</p>}
    {error&&<div className="uc-empty" role="status"><Users/><h3>Community connection pending</h3><p>{error}</p><button onClick={()=>load()}>Retry connection</button><button className="uc-alt" onClick={()=>nav('screen-2')}>Account setup</button></div>}
    {data?.items?.length===0&&<p>No content is visible to this account.</p>}
    {data?.items?.map((item:any)=>space?<article className="uc-social-post" key={item.id}><small>Community post #{item.id}</small><p>{item.message}</p></article>:<button className="uc-community-row" key={item.id} onClick={()=>{setSpace(item.id);setPage(1);load(item.id,1);}}><strong>{item.name}</strong><span>{item.description}</span><ChevronRight/></button>)}
    {data&&<div className="uc-pager"><button disabled={page<=1} onClick={()=>{setPage(page-1);load(space,page-1);}}>Previous</button><span>{page} / {data.pages||1}</span><button disabled={page>=data.pages} onClick={()=>{setPage(page+1);load(space,page+1);}}>Next</button></div>}
  </section>;
}
function LocalDraft({kind,notify}:{kind:string;notify:(s:string)=>void}) {
  const [text,setText]=useState(()=>readLocal('draft.'+kind));
  return <div className="uc-card"><h2>{kind==='question'?'Ask a scholar':kind==='message'?'Write a message':'Share something beneficial'}</h2><p>{kind==='question'?'Prepare your question for a qualified scholar.':'Your draft stays on this browser until a publishing service is connected.'}</p><textarea aria-label="Draft text" value={text} onChange={e=>setText(e.target.value)} placeholder="Write your thoughts…" rows={6}/><div className="uc-actions"><button onClick={()=>notify(saveLocal('draft.'+kind,text)?'Draft saved on this device only. It has not been sent or published.':'Browser storage is unavailable. Copy your draft before leaving.')}>Save draft on this device</button><button className="uc-alt" onClick={()=>notify('Sending and publication are not connected. Your text has not been submitted for review.')}>{kind==='question'?'Submit question':kind==='message'?'Send message':'Submit for human review'}</button></div><div className="uc-actions"><button className="uc-text-button" onClick={()=>nav('screen-14')}>Find an Ayah</button><button className="uc-text-button" onClick={()=>nav('screen-15')}>Research a Hadith</button></div></div>;
}
function SettingsPanel({language,setLanguage,notify}:{language:SupportedLanguage;setLanguage:(l:SupportedLanguage)=>void;notify:(s:string)=>void}) {
 return <div className="uc-card"><h2>Your preferences</h2><label>Knowledge-service language<select value={language} onChange={e=>{setLanguage(e.target.value as SupportedLanguage);saveLocal('language',e.target.value);}}><option value="en">English</option><option value="ta">தமிழ் · Tamil</option><option value="si">සිංහල · Sinhala</option></select></label><p>The existing Quran and research tools support these interface choices. The new 33-screen shell is currently English.</p><button onClick={()=>notify('Your drafts and preferences are stored only in this browser. Account privacy, export and deletion controls need the existing authentication service to be linked.')}>Privacy & local data</button></div>;
}
export default function UmmahApp() {
 const [route,setRoute]=useState(()=>routeFromHash(location.hash));
 const [menu,setMenu]=useState(false),[query,setQuery]=useState(''),[message,setMessage]=useState(''),[tab,setTab]=useState('');
 const [language,setLanguage]=useState<SupportedLanguage>(()=>{const v=readLocal('language','en');return ['en','ta','si'].includes(v)?v as SupportedLanguage:'en';});
 const [serviceVisited,setServiceVisited]=useState(false);
 const [aiReady,setAiReady]=useState<boolean|null>(null);
 useEffect(()=>{let active=true;fetch('/api/health').then(r=>r.ok?r.json():null).then(data=>{if(active)setAiReady(!!data?.hasKey);}).catch(()=>{if(active)setAiReady(false);});return()=>{active=false;};},[]);
 const [interests,setInterests]=useState<string[]>(()=>{try{return JSON.parse(readLocal('interests','[]'));}catch{return [];}});
 const body=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null);
 const index=screenNumber(route),screen=screens.find(s=>s.id===route);
 const service=route==='screen-14'?'quran':route==='screen-15'?'dossier':route==='podcasts'?'studio':null;
 const title=screen?.title||titles[route]||'UmmahConnect';
 const getStatus=(id:string)=>(id==='screen-15'||id==='podcasts')&&aiReady!==true?'Blocked · AI connection pending':screenStatus(id);
 const status=getStatus(route);
 useEffect(()=>{const changed=()=>setRoute(routeFromHash(location.hash));window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[]);
 useEffect(()=>{setMenu(false);setQuery('');setTab('');setMessage('');document.title=title+' · UmmahConnect';window.scrollTo(0,0);heading.current?.focus();if(service)setServiceVisited(true);},[route]);
 useEffect(()=>{if(message&&!dialog.current?.open)dialog.current?.showModal();if(!message&&dialog.current?.open)dialog.current.close();},[message]);
 const notify=(s:string)=>setMessage(s);
 function templateAction(event:React.MouseEvent<HTMLDivElement>|React.KeyboardEvent<HTMLDivElement>) {
   const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action],button');
   if(!target||!body.current?.contains(target))return;
   if(event.type==='keydown'&&!['Enter',' '].includes((event as React.KeyboardEvent).key))return;
   event.preventDefault();const label=target.dataset.action||target.textContent?.trim()||'This feature';
   if(target.matches('.tab')&&!/LKR|Custom/.test(label)) {setTab(label);body.current?.querySelectorAll('.tab').forEach(el=>{el.classList.toggle('sel',el===target);el.setAttribute('aria-selected',String(el===target));});return;}
   if(/LKR/.test(label)){const input=body.current?.querySelector<HTMLInputElement>('#amount');if(input){input.value=label.replace(/[^\d]/g,'');input.focus();}return;}
   if(label==='Custom'){body.current?.querySelector<HTMLInputElement>('#amount')?.focus();return;}
   if(/Save draft/i.test(label)) {
    const values=Array.from(body.current?.querySelectorAll<HTMLInputElement>('input:not([type=password]),textarea')||[]).map(el=>({label:el.getAttribute('aria-label'),value:el.value}));
    notify(saveLocal('form.'+route,JSON.stringify(values))?'Application draft saved on this device. Nothing was submitted or approved.':'Local storage unavailable. Copy your entries before leaving.');return;
   }
   if(/Quran reference/i.test(label)){nav('screen-14');return;}
   if(/Hadith citation|editorial review/i.test(label)){nav('screen-15');return;}
   if(/Edit profile/i.test(label)){notify('Persistent profile editing requires your existing account to be connected. No profile was changed.');return;}
   const detail=backend[index]||'This action needs a connected service. No data was sent or changed.';
   notify(label.replace(/preview|demo only/gi,'').trim()+': '+detail);
 }
 useEffect(()=>{if(!body.current)return;try{const saved=JSON.parse(readLocal('form.'+route,'[]'));const inputs=body.current.querySelectorAll<HTMLInputElement>('input:not([type=password]),textarea');saved.forEach((value:any,i:number)=>{if(inputs[i]&&typeof value.value==='string')inputs[i].value=value.value;});}catch{}},[route]);
 useEffect(()=>{if(!body.current)return;body.current.querySelectorAll<HTMLElement>('.item').forEach(el=>{el.hidden=!el.textContent?.toLowerCase().includes(query.toLowerCase());});},[query]);
 const showTemplate=!!screen&&!service&&![2,3,4,5,6,7,9,10,11,12,16,17,21,31].includes(index);
 return <div className="uc-root">
  <header className="uc-header"><a href="#/screen-4" className="uc-brand"><span aria-hidden="true">☪</span><span>Ummah<span className="uc-gold">Connect</span><small>FAITH · PEOPLE · PURPOSE</small></span></a><nav className="uc-top-nav" aria-label="Primary"><a href="#/screen-4">Community</a><a href="#/screen-13">Knowledge</a><a href="#/screen-18">Charity</a><a href="#/screen-22">Build a Mosque</a></nav><div className="uc-header-actions"><button aria-label="Explore and search" onClick={()=>nav('screen-7')}><Search/></button><button aria-label="Notifications" onClick={()=>nav('screen-10')}><Bell/></button><button aria-label="Open all screens" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></header>
  <div className="uc-layout"><aside className={'uc-sidebar '+(menu?'uc-sidebar-open':'')} aria-label="All screens"><a className="uc-directory-link" href="#/directory"><Compass/> All 33 screens</a>{groups.map(group=><section key={group.name}><h2>{group.name}</h2>{screens.filter(s=>{const n=screenNumber(s.id);return s.id.startsWith('screen-')&&n>=group.from&&n<=group.to;}).map(s=><a href={'#/'+s.id} key={s.id} aria-current={route===s.id?'page':undefined}><span>{s.id.replace('screen-','').padStart(2,'0')}</span>{s.title}</a>)}</section>)}<a href="#/podcasts"><Headphones/> Podcasts & Voice</a></aside>
  <main className="uc-main" id="main-content"><div className="uc-breadcrumb"><a href="#/directory">UmmahConnect</a><span>/</span><span>{title}</span></div><div className="uc-page-heading"><div><div className="uc-eyebrow">{index>=18&&index<=26?'GIVE · BUILD · BELONG':index>=13&&index<=17||route==='podcasts'?'LEARN · REFLECT · GROW':'A COMMUNITY WITH PURPOSE'}</div><h1 ref={heading} tabIndex={-1}>{title}</h1></div><span className={'uc-status '+(status.startsWith('Working')?'working':'')}>{status}</span></div>
  {backend[index]&&<div className="uc-capability" role="note">{backend[index]}</div>}
  {route==='screen-1'&&<div className="uc-welcome-art" aria-label="Decorative mosque artwork"><span>☪</span><h2>A brighter tomorrow,<br/>together.</h2><p>Faith. People. Purpose.</p><a href="#/screen-3" className="uc-gold-button">Get started</a></div>}
  {(route==='screen-4')&&<><div className="uc-hero"><div className="uc-eyebrow">WELCOME TO YOUR UMMAH</div><h2>Real connection.<br/>Shared purpose.</h2><p>Learn from authentic sources, care for one another and contribute to good.</p><div className="uc-actions"><a href="#/screen-5">Write a reflection</a><a href="#/screen-13" className="uc-alt">Explore knowledge</a></div></div><div className="uc-shortcuts"><a href="#/screen-14"><BookOpen/>Quran & Tafsir</a><a href="#/screen-15"><ShieldCheck/>Hadith Research</a><a href="#/podcasts"><Headphones/>Podcasts</a></div></>}
  {[4,11,12].includes(index)&&<SocialView key={route} route={route}/>}
  {route==='screen-2'&&<div className="uc-card"><h2>Welcome back</h2><p>Your existing Dragon Dawwa account will be preserved. This development branch has not yet been linked to that authentication service.</p><button onClick={()=>notify(backend[2])}>Sign in with existing account</button><button className="uc-alt" onClick={()=>notify('Registration is not connected. No personal information or password is collected on this screen.')}>Create account</button><a className="uc-inline-link" href="#/screen-3">Set device preferences without signing in</a></div>}
  {route==='screen-3'&&<div className="uc-card"><h2>What brings you here?</h2><p>Choose your interests. These preferences stay on this browser.</p><div className="uc-interest-grid">{['Quran','Hadith','Islamic Knowledge','Mosques','Charity','Family','Youth','Business','Events'].map(name=><button key={name} aria-pressed={interests.includes(name)} onClick={()=>setInterests(interests.includes(name)?interests.filter(x=>x!==name):[...interests,name])}>{name}</button>)}</div><button onClick={()=>{if(saveLocal('interests',JSON.stringify(interests)))nav('screen-4');else notify('Your browser could not save preferences. You can still explore all screens.');}}>Save preferences & continue</button></div>}
  {route==='screen-5'&&<LocalDraft key="post" kind="post" notify={notify}/>}
  {route==='screen-9'&&<LocalDraft key="message" kind="message" notify={notify}/>}
  {route==='screen-17'&&<><LocalDraft key="question" kind="question" notify={notify}/><a className="uc-card-link" href="#/screen-15"><ShieldCheck/> Open Hadith research and evidence dossiers <ChevronRight/></a></>}
  {[6,10,21].includes(index)&&<div className="uc-card uc-empty"><Heart/><h2>{index===21?'No donation records connected':index===10?'Your notifications will appear here':'Choose a connected community post'}</h2><p>{backend[index]}</p><button onClick={()=>nav(index===21?'screen-18':'screen-11')}>{index===21?'Explore charity interfaces':'Open communities'}</button></div>}
  {(route==='directory'||route==='screen-7')&&<><label className="uc-search"><Search/><input aria-label="Search all screens" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search people, knowledge, charity and all screens…"/></label><div className="uc-directory-grid">{screens.filter(s=>s.id.startsWith('screen-')&&s.title.toLowerCase().includes(query.toLowerCase())).map(s=><a className="uc-directory-card" href={'#/'+s.id} key={s.id}><span>{s.id.replace('screen-','').padStart(2,'0')}</span><strong>{s.title}</strong><small>{getStatus(s.id)}</small><ChevronRight/></a>)}</div><a className="uc-card-link" href="#/podcasts"><Headphones/> Podcasts & Voice Studio <ChevronRight/></a>{query&&!screens.some(s=>s.id.startsWith('screen-')&&s.title.toLowerCase().includes(query.toLowerCase()))&&<p>No screen matches this search. Try “Quran”, “Mosque” or “Profile”.</p>}</>}
  {route==='screen-13'&&<div className="uc-shortcuts"><a href="#/screen-14"><BookOpen/>Read Quran & Tafsir</a><a href="#/screen-15"><ShieldCheck/>Research a Hadith</a><a href="#/podcasts"><Headphones/>Listen to podcasts</a></div>}
  {route==='screen-16'&&<div className="uc-card uc-service"><h2>Prayer times for your location</h2><p>Choose your date, coordinates and calculation method. Times load from the existing prayer service.</p><PrayerWidget language={language}/></div>}
  {(route==='screen-31')&&<><SettingsPanel language={language} setLanguage={setLanguage} notify={notify}/><a className="uc-card-link" href="#/directory"><Menu/> Browse all 33 screens <ChevronRight/></a><a className="uc-card-link" href="#/screen-8"><Users/> Profile <ChevronRight/></a></>}
  {(route==='screen-23'||route.startsWith('mosque-'))&&<nav className="uc-mosque-tabs" aria-label="Mosque project sections">{mosqueTabs.map(([id,label])=><a key={id} href={'#/'+id} aria-current={route===id?'page':undefined}>{label}</a>)}</nav>}
  {showTemplate&&<div className="uc-template" data-project={index===23} ref={body} onClick={templateAction} onKeyDown={templateAction} onInput={event=>{const el=event.target as HTMLInputElement;if(el.placeholder?.toLowerCase().includes('search')){const term=el.value.toLowerCase();body.current?.querySelectorAll<HTMLElement>('.item').forEach(item=>{item.hidden=!item.textContent?.toLowerCase().includes(term);});}}} dangerouslySetInnerHTML={{__html:screen.html}}/>}
  {tab&&<div className="uc-card" role="tabpanel" aria-label={tab}><h2>{tab}</h2><p>{['Photos','Messages','Following','Followers','Donations'].includes(tab)?`No ${tab.toLowerCase()} records are connected to this account.`:`${tab} view selected. The records on this interface are illustrative; live ${tab.toLowerCase()} data is pending.`}</p><p>{backend[index]||'This selection is local to your current view.'}</p><button className="uc-alt" onClick={()=>setTab('')}>Close this view</button></div>}
  {(serviceVisited||service)&&<div className="uc-service" hidden={!service}><div className="uc-service-toolbar"><label>Service language<select value={language} onChange={e=>{setLanguage(e.target.value as SupportedLanguage);saveLocal('language',e.target.value);}}><option value="en">English</option><option value="ta">தமிழ்</option><option value="si">සිංහල</option></select></label><a href="#/screen-14">Quran & Tafsir</a><a href="#/screen-15">Research & Dossiers</a><a href="#/podcasts">Podcasts & Voice</a></div>{service!=='quran'&&<div className="uc-capability">Initial dossier and script content are labelled example material. New generated research is an AI-assisted draft requiring source checks and human scholarly review. Podcast personas are generated voices.</div>}<ServiceBoundary><LegacyApp embedded externalMode={service||'dossier'} language={language}/></ServiceBoundary></div>}
  <div className="uc-pager"><button onClick={()=>nav('screen-'+Math.max(1,(Number.isFinite(index)?index:2)-1))}><ChevronLeft/> Previous screen</button><a href="#/directory">All screens</a><button onClick={()=>nav('screen-'+Math.min(33,(Number.isFinite(index)?index:0)+1))}>Next screen <ChevronRight/></button></div>
  <footer className="uc-footer">UmmahConnect · Powered by Dragon Dawwa<br/><small>Development integration · Example project information is never a real donation or construction record.</small></footer>
  </main></div>
  <nav className="uc-bottom" aria-label="Mobile navigation">{[[4,'Home',House],[11,'Communities',Users],[5,'Create',Plus],[18,'Charity',Heart],[8,'Profile',Users]].map(([id,label,Icon]:any)=><a href={'#/screen-'+id} key={id} aria-current={index===id?'page':undefined}><Icon/><span>{label}</span></a>)}</nav>
  <dialog ref={dialog} className="uc-dialog" onCancel={()=>setMessage('')} onClose={()=>setMessage('')}><h2>Feature status</h2><p>{message}</p><button onClick={()=>setMessage('')}>Understood</button></dialog>
 </div>;
}

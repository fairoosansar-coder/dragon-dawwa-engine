import React from 'react';
import { BookOpen, ArrowUpRight, ShieldCheck, Radio, Plus } from 'lucide-react';
import type { AppMode } from './pages';
import type { SupportedLanguage } from '../utils/localization';
export const NAV_LABELS = {
 en: {wall:'Community',quran:'Quran',dossier:'Hadith Research',studio:'Podcasts',me:'Me'},
 ta: {wall:'சமூகம்',quran:'குர்ஆன்',dossier:'ஹதீஸ் ஆய்வு',studio:'ஒலிப்பதிவுகள்',me:'நான்'},
 si: {wall:'ප්‍රජාව',quran:'කුර්ආනය',dossier:'හදීස් අධ්‍යයනය',studio:'පොඩ්කාස්ට්',me:'මම'},
};
const COPY = {
 en: ['A community rooted in knowledge','Learn. Reflect. Grow together.','Make space for the Quran, thoughtful questions and meaningful conversations.','Share a reflection','Read & listen','Explore a narration','Listen & reflect','Community preview · sample posts and profiles'],
 ta: ['அறிவில் வேரூன்றிய சமூகம்','கற்போம். சிந்திப்போம். ஒன்றாக வளர்வோம்.','குர்ஆன், சிந்தனையுள்ள கேள்விகள், பயனுள்ள உரையாடல்கள்.','சிந்தனையைப் பகிருங்கள்','வாசிக்கவும் கேட்கவும்','ஹதீஸை ஆராயுங்கள்','கேட்டுச் சிந்தியுங்கள்','சமூக முன்னோட்டம் · மாதிரிப் பதிவுகள் மற்றும் சுயவிவரங்கள்'],
 si: ['දැනුම මත ගොඩනැඟුණු ප්‍රජාවක්','ඉගෙන ගනිමු. සිතමු. එක්ව වැඩෙමු.','කුර්ආනය, අර්ථවත් ප්‍රශ්න සහ වටිනා සංවාද සඳහා ඉඩක්.','අදහසක් බෙදාගන්න','කියවන්න සහ අසන්න','හදීසයක් අධ්‍යයනය කරන්න','අසා මෙනෙහි කරන්න','ප්‍රජා පෙරදසුන · ආදර්ශ පළ කිරීම් සහ පැතිකඩ'],
};
export function CommunityWelcome({language,onMode,onShare}:{language:SupportedLanguage;onMode:(m:AppMode)=>void;onShare:()=>void}) {
 const c=COPY[language]; const nav=NAV_LABELS[language];
 return <section className="dd-welcome" aria-label={c[0]}>
  <div className="dd-welcome-copy"><span className="dd-eyebrow">DRAGON DAWWA / {c[0]}</span><h1>{c[1]}</h1><p>{c[2]}</p><button className="dd-gold-button" onClick={onShare}><Plus size={18}/>{c[3]}</button></div>
  <div className="dd-welcome-art" aria-hidden="true"><div className="dd-arch"><BookOpen strokeWidth={1} size={68}/><span>اقْرَأْ</span></div></div>
  <div className="dd-discover">{([['quran',BookOpen,c[4]],['dossier',ShieldCheck,c[5]],['studio',Radio,c[6]]] as const).map(([id,Icon,detail])=><button key={id} onClick={()=>onMode(id)} className={`dd-discover-card dd-discover-${id}`}><Icon size={24}/><span><strong>{nav[id]}</strong><small>{detail}</small></span><ArrowUpRight size={19}/></button>)}</div>
  <p className="dd-preview-note">{c[7]}</p>
 </section>;
}

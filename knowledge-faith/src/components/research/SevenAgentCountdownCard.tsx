import { useEffect, useState } from 'react';
import type { Lang } from '../../shared/sources.ts';

const copy = {
  en: {title:'Research progress', waiting:'Waiting for the research response',queued:'Question queued',understand:'Preparing your question',search:'Searching sources',read:'Reading source passages',verify:'Verifying findings',board:'Waiting for the seven-agent report',elapsed:'Time on this screen',long:'This is taking longer than usual. No finish time is available. You don’t need to submit the question again.'},
  ta: {title:'ஆய்வின் முன்னேற்றம்',waiting:'ஆய்வின் பதிலுக்காகக் காத்திருக்கிறது',queued:'கேள்வி வரிசையில் உள்ளது',understand:'கேள்வியை ஆய்வுக்குத் தயார்படுத்துகிறது',search:'ஆதாரங்களைத் தேடுகிறது',read:'ஆதாரப் பகுதிகளைப் படிக்கிறது',verify:'ஆய்வு முடிவுகளைச் சரிபார்க்கிறது',board:'ஏழு முகவர்களின் ஆய்வறிக்கைக்காகக் காத்திருக்கிறது',elapsed:'இந்தத் திரையில் கடந்த நேரம்',long:'வழக்கத்தைவிட அதிக நேரம் ஆகிறது. எப்போது முடியும் என்று இன்னும் தெரியவில்லை. கேள்வியை மீண்டும் அனுப்ப வேண்டாம்.'},
  si: {title:'පර්යේෂණ ප්‍රගතිය',waiting:'පර්යේෂණ ප්‍රතිචාරය ලැබෙන තෙක් රැඳී සිටී',queued:'ප්‍රශ්නය පෝලිමේ ඇත',understand:'ප්‍රශ්නය සකසමින්',search:'මූලාශ්‍ර සොයමින්',read:'මූලාශ්‍ර පාඨ කියවමින්',verify:'සොයාගැනීම් පරීක්ෂා කරමින්',board:'නියෝජිතයන් හත්දෙනාගේ වාර්තාව ලැබෙන තෙක් රැඳී සිටී',elapsed:'මෙම තිරයේ ගත වූ කාලය',long:'වෙනදාට වඩා කාලය ගත වේ. අවසන් වන වේලාව තවම නොදනී. ප්‍රශ්නය නැවත යැවීමට අවශ්‍ය නැත.'},
};
export function hubProgressLabel(lang:Lang, status?:string, step?:string){
  const c=copy[lang];
  if(status==='queued')return c.queued;
  if(status==='done')return c.board;
  if(status==='running' && (step==='understand'||step==='search'||step==='read'||step==='verify'))return c[step];
  return c.waiting;
}
export function SevenAgentCountdownCard({question,lang,status,step}:{question?:string;lang:Lang;status?:string;step?:string}){
  const [opened]=useState(Date.now);
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{
    const timer=window.setInterval(()=>setElapsed(Math.floor((Date.now()-opened)/1000)),1000);
    return ()=>window.clearInterval(timer);
  },[opened]);
  const c=copy[lang];
  return <section className="rounded-3xl border border-gold bg-white p-5 shadow-sm" data-testid="seven-agent-countdown-card">
    <h2 className="text-sm font-semibold text-pine">{c.title}</h2>
    <p role="status" className="mt-2 font-display text-xl font-bold">{hubProgressLabel(lang,status,step)}</p>
    <p className="mt-1 text-sm tabular-nums">{c.elapsed}: {Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</p>
    {elapsed>=60 && <p className="mt-2 text-sm">{c.long}</p>}
    {question && <p className="mt-2 break-words text-sm text-ink/70">{question}</p>}
  </section>;
}

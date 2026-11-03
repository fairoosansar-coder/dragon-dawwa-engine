import React from 'react';
import { useQ } from './quran';
const labels = {
  en: { loading: 'Loading source text…', error: 'Source text could not be loaded.', retry: 'Try again', meanings: 'Arabic words · English meanings', detail: 'Root and grammar analysis are not supplied by this source.' },
  ta: { loading: 'மூல உரை ஏற்றப்படுகிறது…', error: 'மூல உரையை ஏற்ற முடியவில்லை.', retry: 'மீண்டும் முயற்சிக்கவும்', meanings: 'அரபுச் சொற்கள் · ஆங்கிலப் பொருள்', detail: 'இந்த மூலம் வேர்ச்சொல் மற்றும் இலக்கண ஆய்வை வழங்கவில்லை.' },
  si: { loading: 'මූලාශ්‍ර පාඨය පූරණය වෙමින්…', error: 'මූලාශ්‍ර පාඨය පූරණය කළ නොහැක.', retry: 'නැවත උත්සාහ කරන්න', meanings: 'අරාබි වචන · ඉංග්‍රීසි අර්ථ', detail: 'මෙම මූලාශ්‍රය වචන මූල සහ ව්‍යාකරණ විශ්ලේෂණ සපයන්නේ නැත.' },
};
export function LiveStudy({ verse, kind, from, to }: { verse: string; kind: string; from?: number; to?: number }) {
  const q = useQ(); const t = labels[q.lang];
  const [result, setResult] = React.useState<{ path: string; data?: any; error?: boolean }>();
  const [attempt, retry] = React.useReducer(n => n + 1, 0);
  const path = `/api/quran-study/${kind}/${verse.replace(':', '/')}`;
  React.useEffect(() => {
    const controller = new AbortController(); let active = true;
    setResult(undefined);
    fetch(path, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (active) setResult({ path, data }); })
      .catch(() => { if (active) setResult({ path, error: true }); });
    return () => { active = false; controller.abort(); };
  }, [path, attempt]);
  if (!result || result.path !== path) return <p role="status" className="p-5 text-slate-300">{t.loading}</p>;
  if (result.error) return <div role="alert" className="p-5 space-y-3"><p>{t.error}</p><button type="button" onClick={retry} className="rounded-xl border border-amber-500 px-4 py-2 text-amber-300">{t.retry}</button></div>;
  const data = result.data;
  return <div className="space-y-4">
    {kind === 'words' ? <>
      <p className="text-xs text-slate-400">{t.meanings}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" dir="rtl">
        {data.words.filter((w: any) => w.type === 'word' && (!from || w.position >= from) && (!to || w.position <= to)).map((w: any) => <div key={w.position} className="rounded-2xl border border-slate-700 bg-[var(--surface-inset)] p-3 text-center">
          <p lang="ar" className="font-arabic text-2xl leading-loose text-amber-200">{w.arabic}</p>
          <p dir="ltr" className="text-xs text-slate-400 break-words">{typeof w.transliteration === 'string' ? w.transliteration : w.transliteration?.text}</p>
          <p dir="ltr" lang="en" className="text-sm text-slate-100">{w.translation}</p>
        </div>)}
      </div>
      {from && <p className="text-xs text-slate-400">{t.detail}</p>}
    </> : <>
      <p className="text-xs text-slate-400">{data.tafsir.name} · {data.tafsir.author} · {data.tafsir.language}</p>
      <div dir={data.tafsir.language === 'arabic' ? 'rtl' : 'ltr'} lang={data.tafsir.language === 'arabic' ? 'ar' : 'en'} className="whitespace-pre-wrap break-words rounded-2xl bg-[var(--surface-inset)] p-4 text-base leading-8 text-slate-100">{data.tafsir.text}</div>
    </>}
    <p className="text-xs text-slate-400">UmmahAPI · {verse}</p>
  </div>;
}

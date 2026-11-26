import { ArrowLeft, Info, ShieldCheck } from 'lucide-react';
import { buildStamp } from '../buildStamp.ts';
import { useApp } from '../lib/store.tsx';
import { Card } from '../components/ui.tsx';
import { openPassageUiEnabled } from '../lib/productBrand.ts';
import { useRemote } from '../lib/api.ts';

function OpenPassageAbout() {
  const models=useRemote<{research:string[];speech:string[]}>('/api/open-passage/methods');
  const heading='text-xl font-semibold text-emerald-950';
  return <article data-about-view className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-stone-800">
    <a href="#/hub" className="text-sm underline">Back to Open Passage</a>
    <header className="space-y-2 border-b border-stone-200 pb-5">
      <p className="text-xs font-semibold tracking-widest text-emerald-800">ABOUT OPEN PASSAGE</p>
      <h1 className="font-serif text-4xl text-emerald-950">How the research desk works</h1>
      <p>Open Passage is a place to ask questions about Islam and read the passages behind an answer. Read the research as a document, hear a short narration, or listen to the roundtable. Aegis Intelligence supports this work.</p>
    </header>
    <section className="space-y-2"><h2 className={heading}>Who is speaking?</h2>
      <p>The host and panelists are AI-generated roles. Their names, titles and different points of view give the conversation a shape. They are not recordings of named people, academic credentials, or endorsements by scholars.</p>
      <p>The seven roles examine a question from different angles. They are not seven independent witnesses. The podcast discusses the report; another voice making the same point is not another source.</p>
    </section>
    <section className="space-y-2"><h2 className={heading}>Where the sources come from</h2>
      <p>The public desk opens Qur’an passages in the Saheeh International English translation and links to the verse on Quran.com. For hadith it can open HadeethEnc entries and include the published grade when available. Each report lists the passages it actually opened.</p>
      <p>The wider library also uses AlQuran Cloud for Arabic text, QuranEnc for translations, hadith-api for study collections, IslamHouse for books and Aladhan for prayer times. A source being in the library does not mean it was consulted for a particular answer.</p>
      <p>Read a quotation separately from the panel’s interpretation. A report is not a fatwa, and a confident voice is not evidence of scholarly consensus.</p>
    </section>
    <section className="space-y-2"><h2 className={heading}>How the voices are made</h2>
      <p>Research audio uses synthetic voices. Newly generated roundtables are designed for ElevenLabs v4: Brother Feroz hosts, and each research role has a separate voice. Delivery cues shape pacing and tone; they are not part of the transcript. Previously recorded episodes may use a different cast. The short research brief uses a separate narrator.</p>
      <p>Qur’an recitation in the reader is different: those are recordings of the selected reciter, not the roundtable’s synthetic voices.</p>
    </section>
    <section className="space-y-2"><h2 className={heading}>Models behind the desk</h2>
      <p>The research engine supports Google Gemini and Anthropic Claude. The lists below show the models configured for this public desk now, including fallbacks. They are not a record of which model produced an older report or audio track.</p>
      {models.loading ? <p role="status">Loading model list…</p> : models.error || !models.data ? <p>The current model list could not be loaded. <button className="underline" onClick={models.reload}>Try again</button></p> :
        <dl className="space-y-2 rounded-xl border border-stone-200 p-4 text-sm">
          {([['Research and dialogue',models.data.research],['Speech synthesis',models.data.speech]] as const).map(([label,ids])=><div key={label}><dt className="font-semibold">{label}</dt><dd className="break-words">{ids.length?ids.join(', '):'No cloud model configured'}</dd></div>)}
        </dl>}
    </section>
  </article>;
}

export function AboutView() {
  const { t, lang } = useApp();
  if (openPassageUiEnabled()) return <OpenPassageAbout/>;

  return (
    <section data-about-view className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <a
          href="#/hub"
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 shadow-2xs transition hover:bg-stone-50"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
          <span>Back to Knowledge Hub</span>
        </a>
      </div>

      <Card>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pine">
          <Info className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
          <span>About & Reference Notes</span>
        </div>

        <h1 className="mt-1.5 text-base font-bold text-stone-900 sm:text-lg">
          DRAGON DAWWA · {t.brandSub}
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-stone-700">
          {t.sourcesNote}
        </p>

        <p className="mt-2 rounded-xl border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-950">
          {t.uiNote}
        </p>

        {lang !== 'en' && (
          <p className="mt-1.5 text-[11px] text-stone-500">
            Active interface language: {lang.toUpperCase()}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/70 pt-3 text-[11px] text-stone-500">
          <span className="inline-flex items-center gap-1 font-medium text-stone-700">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            <span>Institutional Research & Verification Engine</span>
          </span>
          <span
            data-release={buildStamp.sha}
            data-built-at={buildStamp.builtAt}
            className="font-mono text-[11px] text-stone-500"
          >
            {buildStamp.sha.slice(0, 7)} · {buildStamp.builtAt}
          </span>
        </div>
      </Card>
    </section>
  );
}

export default AboutView;

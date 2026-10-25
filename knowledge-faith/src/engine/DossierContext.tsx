import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DragonDawwaAnalysis, SampleHadithPreset } from './types/hadith.ts';
import type { UserAccount } from './types/wall.ts';
import { SAMPLE_HADITHS } from './data/sampleHadiths.ts';
import { getLocalizedAnalysis } from './utils/localizedAnalysis.ts';
import { buildFullReportMarkdown } from './utils/agent7SourceResearch.ts';
import type { AgentStep } from './components/AgentStatusTracker.tsx';
import { ShareModal } from './components/ShareModal.tsx';
import { PrintDossierReport } from './components/PrintDossierReport.tsx';
import { useApp } from '../lib/store.tsx';
import type { Lang } from '../shared/sources.ts';

const DEFAULT_PRESET = SAMPLE_HADITHS.find(p => p.id === 'saturday-fasting') ?? SAMPLE_HADITHS[0];

const LOCALIZED_MATN: Record<string, Partial<Record<Lang, string>>> = {
  'actions-by-intentions': {
    si: 'ක්‍රියාවන් සියල්ල චේතනාවන් මත රඳා පවතී. සෑම මිනිසෙකුටම ඔහු චේතනා කළ දේ පමණක් හිමි වේ. කෙනෙකුගේ හිජ්රතය අල්ලාහ් සහ ඔහුගේ රසූල්වරයා වෙනුවෙන් වී නම්...',
    ta: 'செயல்கள் அனைத்தும் எண்ணங்களைப் பொறுத்தே அமைகின்றன; ஒவ்வொரு மனிதனுக்கும் அவன் எண்ணியதே கிடைக்கிறது...',
  },
  'saturday-fasting': {
    si: 'ඔබට අනිවාර්ය කරන ලද උපවාස හැර සෙනසුරාදා දිනවල උපවාසයේ නොයෙදෙන්න; ඔබගෙන් කෙනෙකුට මිදි ලෙල්ලක් හෝ ගසක අත්තක් හැර අන් කිසිවක් හමු නොවන්නේ නම්, ඔහු එය හෝ හපනු ලැබේවා.',
    ta: 'கடமையாக்கப்பட்ட நோன்பைத் தவிர வேறு எதற்காகவும் சனிக்கிழமை நோன்பு நோற்காதீர்கள்; ஒரு திராட்சைத் தோல் அல்லது மரத்தின் கிளையைத் தவிர வேறெதுவும் கிடைக்காவிட்டாலும் அதனை மென்று விடவும்.',
  },
  'seek-knowledge-china': {
    si: 'චීනයට ගොස් හෝ දැනුම සොයන්න, මන්ද දැනුම සෙවීම සෑම මුස්ලිම්වරයෙකුටම අනිවාර්ය වේ.',
    ta: 'சீனா சென்றேனும் கல்வி கற்க; ஏனெனில் கல்வி தேடுவது ஒவ்வொரு முஸ்லிமுக்கும் கடமையாகும்.',
  },
};

const BENCHMARK_ALIASES: Record<string, string> = {
  saturday_fast: 'saturday-fasting',
  intentions: 'actions-by-intentions',
  china_knowledge: 'seek-knowledge-china',
};

const READER: UserAccount = {
  user_id: 'kf-reader',
  email: '',
  display_name: 'DRAGON DAWWA reader',
  profile_pic: '',
  preferred_language: 'en',
  created_at: new Date(0).toISOString(),
  badge: 'DRAGON DAWWA · Aegis Intelligence',
};

async function waitForResearch(id: string, signal: AbortSignal): Promise<DragonDawwaAnalysis> {
  if (!id) throw new Error('Research did not start. Please retry.');
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        return;
      }
      const timer = setTimeout(resolve, 2000);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
    const poll = await fetch(`/api/analyze/${encodeURIComponent(id)}`, { signal, cache: 'no-store' });
    const body = (await poll.json().catch(() => ({}))) as {
      status?: string;
      error?: string;
      analysis?: DragonDawwaAnalysis;
    };
    if (poll.status === 504 || poll.status === 502) continue;
    if (!poll.ok) throw new Error(typeof body.error === 'string' ? body.error : `Research failed (${poll.status})`);
    if (body.status === 'done' && body.analysis) return body.analysis;
    if (body.status === 'error') throw new Error(body.error || 'Live research failed. Please retry.');
  }
  throw new Error('Research timed out. Please retry.');
}

function presetMatn(preset: SampleHadithPreset, lang: Lang): string {
  return LOCALIZED_MATN[preset.id]?.[lang] ?? preset.hadith_text;
}

function isPresetMatn(preset: SampleHadithPreset, text: string): boolean {
  return text === preset.hadith_text || Object.values(LOCALIZED_MATN[preset.id] ?? {}).includes(text);
}

function setUrlParams(update: (params: URLSearchParams) => void) {
  const url = new URL(window.location.href);
  update(url.searchParams);
  window.history.replaceState(null, '', url.toString());
}

function initialPreset(): { preset: SampleHadithPreset; query: string | null } {
  const params = new URLSearchParams(window.location.search);
  const byId = SAMPLE_HADITHS.find(p => p.id === params.get('preset'));
  if (byId) return { preset: byId, query: null };
  const q = params.get('q') || params.get('hadith');
  if (q) {
    const match = SAMPLE_HADITHS.find(p => p.hadith_text.toLowerCase().includes(q.slice(0, 30).toLowerCase()));
    return { preset: match ?? DEFAULT_PRESET, query: q };
  }
  return { preset: DEFAULT_PRESET, query: null };
}

interface DossierState {
  lang: Lang;
  preset: SampleHadithPreset;
  matn: string;
  isnad: string;
  analysis: DragonDawwaAnalysis;
  displayed: DragonDawwaAnalysis;
  step: AgentStep;
  setStep: (step: AgentStep) => void;
  isAnalyzing: boolean;
  error: string | null;
  run: (matn: string, isnad: string) => Promise<void>;
  selectBenchmark: (id: string) => void;
  clear: () => void;
  reportOrigin: 'idle' | 'example' | 'live';
  share: () => Promise<void>;
  copyReport: () => Promise<void>;
  copied: boolean;
  exportJson: () => void;
  downloadFullReport: () => void;
  print: () => void;
}

const DossierContext = createContext<DossierState | null>(null);

export function DossierProvider({ children }: { children: ReactNode }) {
  const { lang } = useApp();
  const [start] = useState(initialPreset);
  const [preset, setPreset] = useState(start.preset);
  const [matn, setMatn] = useState(start.query ?? presetMatn(start.preset, lang));
  const [isnad, setIsnad] = useState(start.preset.isnad_text ?? '');
  const [analysis, setAnalysis] = useState<DragonDawwaAnalysis>(start.preset.defaultData);
  const [step, setStep] = useState<AgentStep>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [reportOrigin, setReportOrigin] = useState<'idle' | 'example' | 'live'>('idle');
  const inFlight = useRef<AbortController | null>(null);

  const displayed = useMemo(() => getLocalizedAnalysis(analysis, lang), [analysis, lang]);

  useEffect(() => {
    setMatn(current => (isPresetMatn(preset, current) ? presetMatn(preset, lang) : current));
  }, [lang, preset]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('dossier');
    if (!id) return;
    let cancel = false;
    setIsAnalyzing(true);
    fetch(`/api/analyze/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async response => {
        const body = (await response.json().catch(() => ({}))) as { analysis?: DragonDawwaAnalysis; error?: string };
        if (cancel) return;
        if (!response.ok || !body.analysis) {
          setError(body.error || 'This report could not be opened.');
          setReportOrigin('idle');
          return;
        }
        setAnalysis(body.analysis);
        setMatn(body.analysis.query_hadith || '');
        setReportOrigin('live');
      })
      .catch(() => {
        if (!cancel) setError('This report could not be opened.');
      })
      .finally(() => {
        if (!cancel) setIsAnalyzing(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => () => inFlight.current?.abort(), []);

  const selectBenchmark = useCallback(
    (id: string) => {
      const found = SAMPLE_HADITHS.find(p => p.id === (BENCHMARK_ALIASES[id] ?? id));
      if (!found) return;
      inFlight.current?.abort();
      setPreset(found);
      setMatn(presetMatn(found, lang));
      setIsnad(found.isnad_text ?? '');
      setAnalysis(found.defaultData);
      setReportOrigin('example');
      setStep('overview');
      setError(null);
      setUrlParams(p => {
        p.set('preset', found.id);
        p.delete('q');
        p.delete('hadith');
      });
    },
    [lang],
  );

  const run = useCallback(
    async (nextMatn: string, nextIsnad: string) => {
      if (!nextMatn.trim()) return;
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setMatn(nextMatn);
      setIsnad(nextIsnad);
      setIsAnalyzing(true);
      setError(null);
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hadith_input: nextMatn, isnad_input: nextIsnad, preferred_language: lang }),
        });
        const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string; agent_6_synthesis?: unknown };
        if (!res.ok) {
          throw new Error(
            typeof body.error === 'string'
              ? body.error
              : res.status === 504
                ? 'Research was cut off by the connection (504). Restart the dev server and try again.'
                : `Research failed (${res.status})`,
          );
        }
        const analysis = body.agent_6_synthesis
          ? (body as DragonDawwaAnalysis)
          : await waitForResearch(String(body.id ?? ''), controller.signal);
        setAnalysis(analysis);
        setReportOrigin('live');
        setStep('overview');
        setUrlParams(p => {
          p.delete('preset');
          p.set('q', nextMatn.slice(0, 80));
          if (analysis.research_job_id) p.set('dossier', analysis.research_job_id);
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const e = err as Error;
        setError(e.name === 'TimeoutError' ? 'Research timed out. Please retry.' : e.message || 'Live research failed. Please retry.');
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setIsAnalyzing(false);
        }
      }
    },
    [lang],
  );

  const clear = useCallback(() => {
    setMatn('');
    setIsnad('');
    setError(null);
    setReportOrigin('idle');
  }, []);

  const share = useCallback(async () => {
    const url = new URL(window.location.href);
    url.hash = '#/screen-15';
    if (isPresetMatn(preset, matn)) url.searchParams.set('preset', preset.id);
    else url.searchParams.set('q', matn.slice(0, 80));
    const s = analysis.agent_6_synthesis;
    const quote = analysis.query_hadith.length > 140 ? `${analysis.query_hadith.slice(0, 140)}…` : analysis.query_hadith;
    const data = {
      title: `DRAGON DAWWA: ${s.final_status}`,
      text: `Hadith research report\nSynthesis status: ${s.final_status}\nA numerical purity percentage is not included. No documented purity calculation is attached.\n\n"${quote}"`,
      url: url.toString(),
    };
    if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }
    setShareOpen(true);
  }, [analysis, matn, preset]);

  const copyReport = useCallback(async () => {
    const text = buildFullReportMarkdown(displayed, lang);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy is blocked in this browser. Use Download Full Report instead.');
    }
  }, [displayed, lang]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(displayed, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `hadith-research-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }, [displayed]);

  const downloadFullReport = useCallback(() => {
    const fullMarkdown = buildFullReportMarkdown(displayed, lang);
    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `hadith-full-report-${Date.now()}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }, [displayed, lang]);

  const print = useCallback(() => setPrinting(true), []);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    document.body.classList.add('kf-printing');
    const timer = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('kf-printing');
    };
  }, [printing]);

  const value: DossierState = {
    lang,
    preset,
    matn,
    isnad,
    analysis,
    displayed,
    step,
    setStep,
    isAnalyzing,
    error,
    run,
    selectBenchmark,
    clear,
    share,
    copyReport,
    copied,
    exportJson,
    downloadFullReport,
    print,
    reportOrigin,
  };

  return (
    <DossierContext.Provider value={value}>
      {children}
      <div data-theme="mushaf" className="dd-engine">
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          analysis={analysis}
          presetId={isPresetMatn(preset, matn) ? preset.id : undefined}
          presetTitle={preset.title}
        />
      </div>
      {printing &&
        createPortal(
          <div className="print-only">
            <PrintDossierReport analysis={displayed} currentUser={READER} currentLanguage={lang} />
          </div>,
          document.body,
        )}
    </DossierContext.Provider>
  );
}

export function useDossier(): DossierState {
  const ctx = useContext(DossierContext);
  if (!ctx) throw new Error('useDossier must be used inside DossierProvider');
  return ctx;
}

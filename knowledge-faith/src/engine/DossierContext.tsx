import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DragonDawwaAnalysis, SampleHadithPreset } from './types/hadith.ts';
import type { UserAccount } from './types/wall.ts';
import { SAMPLE_HADITHS } from './data/sampleHadiths.ts';
import { getLocalizedAnalysis } from './utils/localizedAnalysis.ts';
import { buildFullReportMarkdown } from './utils/agent7SourceResearch.ts';
import { humanVerificationMarkdown } from './components/HumanVerification.tsx';
import { reportIdFor } from './utils/reportPresentation.ts';
import { reportIdentity } from '../shared/research/revision.ts';
import { bindReport } from './utils/reportBinding.ts';
import { languageFailureMessage, languageLabel, scriptMatchesLanguage, selectionStillCurrent, type SelectionStamp } from './utils/contentLanguage.ts';
import { episodeAudioKey, loadEpisodeClips, saveEpisodeClip } from './utils/episodeAudio.ts';
import { readSavedResearch, upsertSavedResearch, writeSavedResearch, type SavedResearchRecord } from './utils/savedResearch.ts';
import type { AgentStep } from './components/AgentStatusTracker.tsx';
import { ShareModal } from './components/ShareModal.tsx';
import { PrintDossierReport } from './components/PrintDossierReport.tsx';
import { useApp } from '../lib/store.tsx';
import type { Lang } from '../shared/sources.ts';
import { HADITH_AUTHENTICATION_CATEGORY } from './categories.ts';

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
  // Three model attempts can each use the 180s Gemini timeout before a Sinhala script returns.
  const deadline = Date.now() + 600_000;
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
  category: string;
  analysis: DragonDawwaAnalysis;
  displayed: DragonDawwaAnalysis | null;
  step: AgentStep;
  setStep: (step: AgentStep) => void;
  isAnalyzing: boolean;
  error: string | null;
  run: (matn: string, isnad: string, language?: Lang, category?: string) => Promise<void>;
  selectBenchmark: (id: string) => void;
  clear: () => void;
  reportOrigin: 'idle' | 'example' | 'live' | 'saved' | 'researching' | 'failed';
  savedClips: Record<string, string>;
  audioReady: boolean;
  openSaved: (record: SavedResearchRecord) => void;
  rememberClip: (index: number, audio: string) => void;
  share: () => Promise<void>;
  copyReport: () => Promise<void>;
  copied: boolean;
  exportJson: () => void;
  downloadFullReport: () => void;
  print: () => void;
}

const DossierContext = createContext<DossierState | null>(null);

export function DossierProvider({ children }: { children: ReactNode }) {
  const { lang, setLang } = useApp();
  const langRef = useRef(lang);
  const tokenRef = useRef(0);
  const selectionRef = useRef<SelectionStamp>({ token: 0, question: '', language: lang });
  const [start] = useState(initialPreset);
  const [preset, setPreset] = useState(start.preset);
  const [matn, setMatn] = useState(start.query ?? presetMatn(start.preset, lang));
  const [isnad, setIsnad] = useState('');
  const [category, setCategory] = useState<string>(HADITH_AUTHENTICATION_CATEGORY);
  const [analysis, setAnalysis] = useState<DragonDawwaAnalysis>(start.preset.defaultData);
  const [step, setStep] = useState<AgentStep>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [reportOrigin, setReportOrigin] = useState<'idle' | 'example' | 'live' | 'saved' | 'researching' | 'failed'>('idle');
  const [savedClips, setSavedClips] = useState<Record<string, string>>({});
  const [audioReady, setAudioReady] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const displayed = useMemo(() => {
    if (reportOrigin === 'researching' || reportOrigin === 'failed') return null;
    if (analysis.content_language && analysis.content_language !== lang) return null;
    return bindReport(getLocalizedAnalysis(analysis, analysis.content_language ?? lang));
  }, [analysis, lang, reportOrigin]);

  useEffect(() => {
    setMatn(current => (isPresetMatn(preset, current) ? presetMatn(preset, lang) : current));
  }, [lang, preset]);

  useEffect(() => {
    const previous = langRef.current;
    langRef.current = lang;
    if (previous === lang) return;
    if (!inFlight.current) return;
    tokenRef.current += 1;
    selectionRef.current = { token: tokenRef.current, question: selectionRef.current.question, language: lang };
    inFlight.current.abort();
    inFlight.current = null;
    setIsAnalyzing(false);
    setAudioReady(false);
    setSavedClips({});
    setReportOrigin('failed');
    setError(`The ${languageLabel(previous)} request was stopped because the content language changed to ${languageLabel(lang)}. It will not replace this selection. Generate again in ${languageLabel(lang)}.`);
  }, [lang]);

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
      tokenRef.current += 1;
      inFlight.current?.abort();
      inFlight.current = null;
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

  const rememberSelection = useCallback((record: Partial<SavedResearchRecord> & { question: string; language: Lang }) => {
    writeSavedResearch(upsertSavedResearch(readSavedResearch(), record));
  }, []);

  const run = useCallback(
    async (nextMatn: string, nextIsnad: string, language?: Lang, category?: string) => {
      const question = nextMatn.trim();
      if (!question) return;
      const requestCategory = category?.trim() || HADITH_AUTHENTICATION_CATEGORY;
      setCategory(requestCategory);
      const requestLang = language ?? langRef.current;
      if (requestLang !== langRef.current) {
        langRef.current = requestLang;
        setLang(requestLang);
      }
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      const token = ++tokenRef.current;
      const incoming: SelectionStamp = { token, question, language: requestLang };
      selectionRef.current = incoming;
      setMatn(question);
      setIsnad(nextIsnad);
      setIsAnalyzing(true);
      setError(null);
      setAudioReady(false);
      setSavedClips({});
      setReportOrigin('researching');
      rememberSelection({ question, isnad: nextIsnad, language: requestLang, status: 'researching' });
      const stillCurrent = () => selectionStillCurrent(selectionRef.current, incoming);
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: requestCategory,
            hadith_input: question,
            isnad_input: nextIsnad,
            preferred_language: requestLang,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string; agent_6_synthesis?: unknown };
        if (!stillCurrent()) return;
        if (!res.ok) {
          throw new Error(
            typeof body.error === 'string'
              ? body.error
              : res.status === 504
                ? 'Research was cut off by the connection (504). Restart the dev server and try again.'
                : `Research failed (${res.status})`,
          );
        }
        const result = body.agent_6_synthesis
          ? (body as DragonDawwaAnalysis)
          : await waitForResearch(String(body.id ?? ''), controller.signal);
        if (!stillCurrent()) return;
        const spoken = `${result.agent_6_synthesis?.podcast_script ?? ''}\n${result.agent_6_synthesis?.executive_report_markdown ?? ''}`;
        if ((result.content_language && result.content_language !== requestLang) || !scriptMatchesLanguage(spoken, requestLang)) {
          throw new Error(languageFailureMessage(requestLang));
        }
        const stamped: DragonDawwaAnalysis = { ...result, query_hadith: question, content_language: requestLang };
        const identity = reportIdentity(stamped, reportIdFor(question), requestLang);
        setAnalysis(stamped);
        setReportOrigin('live');
        setStep('roundtable');
        rememberSelection({
          question,
          isnad: nextIsnad,
          language: requestLang,
          status: 'ready',
          analysis: stamped,
          reportId: identity.reportId,
          revision: identity.revision,
          jobId: stamped.research_job_id,
          audioReady: false,
        });
        setUrlParams(p => {
          p.delete('preset');
          p.set('q', question.slice(0, 80));
          p.set('lang', requestLang);
          if (stamped.research_job_id) p.set('dossier', stamped.research_job_id);
        });
      } catch (err) {
        if (controller.signal.aborted || !stillCurrent()) {
          const existing = readSavedResearch().find(item => item.language === requestLang && item.question.trim() === question);
          if (existing?.status === 'researching') {
            rememberSelection({
              question,
              language: requestLang,
              isnad: nextIsnad,
              status: existing.analysis ? 'ready' : 'idle',
              analysis: existing.analysis,
              audioReady: existing.audioReady,
              reportId: existing.reportId,
              revision: existing.revision,
              jobId: existing.jobId,
            });
          }
          return;
        }
        const e = err as Error;
        const message = e.name === 'TimeoutError' ? 'Research timed out. Please retry.' : e.message || 'Live research failed. Please retry.';
        setReportOrigin('failed');
        setError(message);
        rememberSelection({ question, isnad: nextIsnad, language: requestLang, status: 'failed', error: message });
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setIsAnalyzing(false);
        }
      }
    },
    [rememberSelection, setLang],
  );

  const openSaved = useCallback((record: SavedResearchRecord) => {
    tokenRef.current += 1;
    inFlight.current?.abort();
    inFlight.current = null;
    setIsAnalyzing(false);
    if (record.language !== langRef.current) {
      langRef.current = record.language;
      setLang(record.language);
    }
    setMatn(record.question);
    setIsnad(record.isnad || '');
    setAudioReady(false);
    setSavedClips({});
    selectionRef.current = { token: tokenRef.current, question: record.question, language: record.language };
    if (record.status === 'ready' && record.analysis) {
      const stamped = { ...record.analysis, query_hadith: record.question, content_language: record.language };
      setAnalysis(stamped);
      setReportOrigin('saved');
      setError(null);
      setStep('roundtable');
      const identity = reportIdentity(stamped, record.reportId || reportIdFor(record.question), record.language);
      const key = episodeAudioKey(record.language, record.revision || identity.revision, record.question);
      void loadEpisodeClips(key).then(clips => {
        if (selectionRef.current.question !== record.question || selectionRef.current.language !== record.language) return;
        setSavedClips(clips);
        setAudioReady(Object.keys(clips).length > 0 || record.audioReady === true);
      });
      return;
    }
    setReportOrigin('failed');
    setError(record.error || 'This saved question has no report yet. Run Research Again to create one. Another language was not substituted.');
    setStep('roundtable');
  }, [setLang]);

  const rememberClip = useCallback((index: number, audio: string) => {
    const current = displayed;
    if (!current) return;
    const language = current.content_language ?? langRef.current;
    const identity = reportIdentity(current, reportIdFor(current.query_hadith), language);
    const key = episodeAudioKey(language, identity.revision, current.query_hadith);
    setSavedClips(prev => ({ ...prev, [String(index)]: audio }));
    setAudioReady(true);
    void saveEpisodeClip(key, index, audio);
    rememberSelection({
      question: current.query_hadith,
      language,
      status: 'ready',
      analysis: current,
      revision: identity.revision,
      reportId: identity.reportId,
      jobId: current.research_job_id,
      audioReady: true,
    });
  }, [displayed, rememberSelection]);

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
    if (!displayed) return;
    const text = buildFullReportMarkdown(displayed, displayed.content_language ?? lang);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy is blocked in this browser. Use Download Full Report instead.');
    }
  }, [displayed, lang]);

  const exportJson = useCallback(() => {
    if (!displayed) return;
    const blob = new Blob([JSON.stringify(displayed, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `hadith-research-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }, [displayed]);

  const downloadFullReport = useCallback(() => {
    if (!displayed) return;
    const bound = bindReport(displayed);
    const identity = reportIdentity(bound, reportIdFor(bound.query_hadith), displayed.content_language ?? lang);
    const fullMarkdown = buildFullReportMarkdown(displayed, displayed.content_language ?? lang) + humanVerificationMarkdown({
      question: bound.query_hadith,
      reportId: identity.reportId,
      revision: identity.revision,
      languageLabel: displayed.content_language ?? lang,
      generatedAt: bound.generated_at ?? '',
    });
    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `hadith-full-report-${Date.now()}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }, [displayed, lang]);

  const print = useCallback(() => {
    if (!displayed) return;
    const jobId = displayed.research_job_id;
    if (jobId) {
      void fetch(`/api/reports/${encodeURIComponent(jobId)}/review/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: displayed.content_language ?? lang }),
      }).catch(() => undefined);
    }
    setPrinting(true);
  }, [displayed, lang]);

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
    category,
    analysis,
    displayed,
    step,
    setStep,
    isAnalyzing,
    error,
    run,
    selectBenchmark,
    clear,
    savedClips,
    audioReady,
    openSaved,
    rememberClip,
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
      {printing && displayed &&
        createPortal(
          <div className="print-only">
            <PrintDossierReport analysis={displayed} currentUser={READER} currentLanguage={displayed.content_language ?? lang} />
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

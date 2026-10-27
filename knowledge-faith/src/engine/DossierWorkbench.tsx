import { Award, Check, Copy, FileDown, FileText, Library, Printer, Radio, Share2 } from 'lucide-react';
import { HadithSearchForm } from './components/HadithSearchForm.tsx';
import { AgentStatusTracker } from './components/AgentStatusTracker.tsx';
import { DashboardVisualization } from './components/DashboardVisualization.tsx';
import { TakhrijView } from './components/TakhrijView.tsx';
import { IsnadDiagram } from './components/IsnadDiagram.tsx';
import { RijalDossier } from './components/RijalDossier.tsx';
import { ShawahidMatnView } from './components/ShawahidMatnView.tsx';
import { ScholarsVerdictMatrix } from './components/ScholarsVerdictMatrix.tsx';
import { Agent7SourceResearchView, CompleteResearchReportView } from './components/Agent7SourceResearchView.tsx';
import { PodcastScriptPlayer } from './components/PodcastScriptPlayer.tsx';
import { StarDivider } from './ds/ornaments.tsx';
import { ResearchFrame, fullReportActionClass, roundtableActionClass } from './ResearchFrame.tsx';
import { useDossier } from './DossierContext.tsx';
import { useApp } from '../lib/store.tsx';
import { languageLabel } from './utils/contentLanguage.ts';

export function DossierActions() {
  const d = useDossier();
  const btn = roundtableActionClass;
  const primaryBtn = fullReportActionClass;

  const openFullReport = () => {
    d.setStep('report');
    window.setTimeout(() => {
      document.getElementById('dossier-results-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button
        type="button"
        data-testid="open-full-report-btn"
        className={primaryBtn}
        onClick={openFullReport}
      >
        <Award className="h-4 w-4 text-amber-400" aria-hidden /> Open Full Report
      </button>
      <button
        type="button"
        data-testid="open-roundtable-btn"
        className={btn}
        onClick={() => {
          d.setStep('roundtable');
          window.setTimeout(() => {
            document.getElementById('dossier-results-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 40);
        }}
      >
        <Radio className="h-4 w-4 text-emerald-400" aria-hidden /> Open Roundtable
      </button>
      <button
        type="button"
        data-testid="download-dossier-btn"
        className={btn}
        onClick={d.downloadFullReport}
      >
        <FileText className="h-4 w-4 text-emerald-400" aria-hidden /> Download Full Report
      </button>
      <button
        type="button"
        data-testid="export-json-btn"
        className={btn}
        onClick={d.exportJson}
      >
        <FileDown className="h-4 w-4 text-amber-400" aria-hidden /> Export JSON
      </button>
      <button
        type="button"
        data-testid="print-dossier-btn"
        className={btn}
        onClick={d.print}
      >
        <Printer className="h-4 w-4 text-amber-400" aria-hidden /> Print Full Report
      </button>
      <button type="button" className={btn} onClick={() => void d.copyReport()}>
        {d.copied ? <Check className="h-4 w-4 text-emerald-400" aria-hidden /> : <Copy className="h-4 w-4 text-amber-400" aria-hidden />}
        {d.copied ? 'Copied' : 'Copy Full Report'}
      </button>
      <button type="button" className={btn} onClick={() => void d.share()}>
        <Share2 className="h-4 w-4 text-amber-400" aria-hidden /> Share
      </button>
    </div>
  );
}

export default function DossierWorkbench() {
  const d = useDossier();
  const { t, config } = useApp();
  const data = d.displayed;
  const agent7 = data?.agent_7_source_research;
  const showReport = data != null && (d.reportOrigin === 'live' || d.reportOrigin === 'saved' || d.reportOrigin === 'example');

  const openFullReport = () => {
    d.setStep('report');
    window.setTimeout(() => {
      document.getElementById('dossier-results-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  return (
    <ResearchFrame
      title="Explore a hadith, understand its sources"
      arabic="طلب العلم فريضة"
      subtitle="Enter a hadith → Research across all 7 agents (including HadeethEnc Source Research) → Open Full Report."
      actions={<DossierActions />}
      after={
        <>
      {d.reportOrigin === 'example' && <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-950">{t.dossierExample}</p>}
      {d.reportOrigin === 'idle' && <p className="rounded-2xl bg-parchment px-4 py-3 text-sm text-ink/80">{t.dossierIdle}</p>}
      {d.reportOrigin === 'researching' && (
        <p role="status" data-testid="research-language-status" className="rounded-2xl border border-[#c4a46a] bg-[#f6efe2] px-4 py-3 text-sm text-[#1c1915]">
          Research is running in {languageLabel(d.lang)}. The previous episode is stopped and will not replace this one.
        </p>
      )}
      {d.reportOrigin === 'failed' && (
        <div data-testid="research-language-failed" className="rounded-2xl border border-amber-700/40 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>{d.error || `Research in ${languageLabel(d.lang)} did not finish.`}</p>
          <button
            type="button"
            className="mt-3 rounded-xl bg-[#0f6b4c] px-4 py-2 text-xs font-bold text-white"
            onClick={() => void d.run(d.matn, d.isnad, d.lang)}
          >
            Retry
          </button>
        </div>
      )}
      {d.reportOrigin === 'saved' && data && !d.audioReady && (
        <p data-testid="saved-podcast-pending" className="rounded-2xl bg-[#f6efe2] px-4 py-3 text-sm text-[#1c1915]">
          Saved {languageLabel(data.content_language ?? d.lang)} research is open. Generate Podcast when you want audio. Opening this item did not start research or narration.
        </p>
      )}
      {data && showReport && <div id="dossier-results-anchor" className="space-y-6">
        <StarDivider label="تحقيق الحديث" />

        {/* Unified 7-Agent Journey Callout Bar */}
        <div className="rounded-2xl border border-teal-500/35 bg-gradient-to-r from-slate-900/95 via-teal-950/30 to-slate-900/95 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-950/80 px-2.5 py-1 font-mono font-bold text-teal-300">
              <Library className="h-3.5 w-3.5 text-teal-400" />
              7-Agent Research Ready
            </span>
            <span className="text-slate-300">
              HadeethEnc retrieved{' '}
              <strong className="text-white">{agent7?.retrieved_records.length ?? 0}</strong> source record(s) and fed them into Agents 1–6 & the Roundtable.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="banner-source-research-btn"
              onClick={() => d.setStep('source_research')}
              className="rounded-xl border border-teal-500/40 bg-teal-950/60 px-3 py-1.5 text-xs font-semibold text-teal-200 hover:bg-teal-900/60 cursor-pointer"
            >
              Inspect Agent 7 (HadeethEnc)
            </button>
            <button
              type="button"
              data-testid="banner-open-full-report-btn"
              onClick={openFullReport}
              className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
            >
              Open Full Report
            </button>
          </div>
        </div>

        <AgentStatusTracker currentTab={d.step} onSelectTab={d.setStep} isLoading={d.isAnalyzing} currentLanguage={d.lang} />

        {d.step === 'overview' && (
          <DashboardVisualization
            currentLanguage={d.lang}
            data={data}
            onSelectNarrator={() => d.setStep('rijal')}
            onShare={() => void d.share()}
            onSelectSearchItem={(matn, isnad) => void d.run(matn, isnad)}
          />
        )}
        {d.step === 'takhrij' && <TakhrijView takhrij={data.agent_1_takhrij} queryHadith={data.query_hadith} />}
        {d.step === 'isnad' && <IsnadDiagram isnad={data.agent_2_isnad} />}
        {d.step === 'rijal' && <RijalDossier rijal={data.agent_3_rijal} />}
        {d.step === 'shawahid' && <ShawahidMatnView shawahid={data.agent_4_shawahid_matn} />}
        {d.step === 'scholars' && <ScholarsVerdictMatrix verdicts={data.agent_5_scholars_verdict} />}
        {d.step === 'source_research' && <Agent7SourceResearchView analysis={data} currentLanguage={d.lang} />}
        {d.step === 'report' && (
          <CompleteResearchReportView
            analysis={data}
            currentLanguage={d.lang}
            onPrint={d.print}
            onDownloadFullReport={d.downloadFullReport}
            onOpenRoundtableTab={() => d.setStep('roundtable')}
          />
        )}
        {d.step === 'roundtable' && (
          <PodcastScriptPlayer
            key={`${data.query_hadith}-${data.content_language ?? d.lang}-${data.research_job_id ?? 'saved'}`}
            script={data.agent_6_synthesis.podcast_script}
            executiveReport={data.agent_6_synthesis.executive_report_markdown}
            onShare={() => void d.share()}
            neuralVoice={config == null || config.ai === true}
            language={data.content_language ?? d.lang}
            audioReady={d.audioReady}
            savedClips={d.savedClips}
            onClip={d.rememberClip}
          />
        )}
      </div>}
        </>
      }
    >
      <HadithSearchForm
        initialMatn={d.matn}
        initialIsnad={d.isnad}
        isAnalyzing={d.isAnalyzing}
        analysisError={d.error}
        onRunEngine={(matn, isnad) => void d.run(matn, isnad)}
        onOpenSaved={d.openSaved}
        onResearchAgain={item => void d.run(item.question, item.isnad, item.language)}
        onOpenFullReport={openFullReport}
        onClearInputs={d.clear}
        onSelectBenchmark={d.selectBenchmark}
        currentLanguage={d.lang}
        activeQuestion={d.matn}
      />
    </ResearchFrame>
  );
}

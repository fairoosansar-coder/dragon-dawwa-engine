import { Award, Check, Copy, FileDown, Printer, Share2 } from 'lucide-react';
import { HadithSearchForm } from './components/HadithSearchForm.tsx';
import { AgentStatusTracker } from './components/AgentStatusTracker.tsx';
import { DashboardVisualization } from './components/DashboardVisualization.tsx';
import { TakhrijView } from './components/TakhrijView.tsx';
import { IsnadDiagram } from './components/IsnadDiagram.tsx';
import { RijalDossier } from './components/RijalDossier.tsx';
import { ShawahidMatnView } from './components/ShawahidMatnView.tsx';
import { ScholarsVerdictMatrix } from './components/ScholarsVerdictMatrix.tsx';
import { ArchBanner, IlluminatedFrame, StarDivider } from './ds/ornaments.tsx';
import { getPurityLevel } from './utils/gradeUtils.ts';
import type { DragonDawwaAnalysis } from './types/hadith.ts';
import { EngineFrame } from './EngineFrame.tsx';
import { useDossier } from './DossierContext.tsx';

function VerdictReport({ analysis }: { analysis: DragonDawwaAnalysis }) {
  const s = analysis.agent_6_synthesis;
  const p = getPurityLevel(s.purity_confidence_score);
  return (
    <IlluminatedFrame title="Executive Synthesis & Academic Verdict" arabicTitle="الحكم">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className={`inline-flex items-center gap-2 text-sm font-bold px-4 py-1.5 rounded-xl border ${p.badgeClass}`}>
            <Award className="w-4 h-4" />
            {s.final_status}
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-800">
            Score: {s.purity_confidence_score.toFixed(1)}%
          </span>
        </div>
        <div className="font-arabic text-center text-xl text-amber-200" dir="rtl" lang="ar">
          {p.arabicTitle}
        </div>
        <div className="space-y-4 text-left">
          {s.executive_report_markdown.split('\n\n').map((para, i) => (
            <p key={i} className="text-slate-200 leading-relaxed">
              {para.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
            </p>
          ))}
        </div>
      </div>
    </IlluminatedFrame>
  );
}

const PRINT_LABEL = { en: 'Print report', ta: 'அறிக்கையை அச்சிடுக', si: 'වාර්තාව මුද්‍රණය' } as const;

export function DossierActions() {
  const d = useDossier();
  const btn =
    'inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-500/60 cursor-pointer';
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btn} onClick={() => void d.share()}>
        <Share2 className="h-4 w-4 text-amber-400" aria-hidden /> Share
      </button>
      <button type="button" className={btn} onClick={() => void d.copyReport()}>
        {d.copied ? <Check className="h-4 w-4 text-emerald-400" aria-hidden /> : <Copy className="h-4 w-4 text-amber-400" aria-hidden />}
        {d.copied ? 'Copied' : 'Copy report'}
      </button>
      <button type="button" className={btn} onClick={d.exportJson}>
        <FileDown className="h-4 w-4 text-amber-400" aria-hidden /> Export JSON
      </button>
      <button type="button" className={btn} onClick={d.print}>
        <Printer className="h-4 w-4 text-amber-400" aria-hidden /> {PRINT_LABEL[d.lang]}
      </button>
    </div>
  );
}

export default function DossierWorkbench() {
  const d = useDossier();
  const data = d.displayed;
  return (
    <EngineFrame className="space-y-6">
      <ArchBanner
        title="Explore a hadith, understand its sources"
        arabic="طلب العلم فريضة"
        subtitle="Search a narration and explore the research report. AI-assisted findings require source checking and human review."
      >
        <div className="mt-4 flex justify-center">
          <DossierActions />
        </div>
      </ArchBanner>
      <HadithSearchForm
        initialMatn={d.matn}
        initialIsnad={d.isnad}
        isAnalyzing={d.isAnalyzing}
        analysisError={d.error}
        onRunEngine={(matn, isnad) => void d.run(matn, isnad)}
        onClearInputs={d.clear}
        onSelectBenchmark={d.selectBenchmark}
        currentLanguage={d.lang}
      />
      <div className="space-y-6">
        <StarDivider label="تحقيق الحديث" />
        <AgentStatusTracker currentTab={d.step} onSelectTab={d.setStep} isLoading={d.isAnalyzing} />
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
        {d.step === 'report' && <VerdictReport analysis={data} />}
      </div>
    </EngineFrame>
  );
}

import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileDown,
  Library,
  Printer,
  Radio,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { Agent7SourceResearch, DragonDawwaAnalysis } from '../types/hadith.ts';
import { attachAgent7ToAnalysis } from '../utils/agent7SourceResearch.ts';
import { HadithReportPaper } from './HadithReportPaper.tsx';
import type { SupportedLanguage } from '../utils/localization.ts';
import { usesHadithAuthentication } from '../categories.ts';

export const Agent7SourceResearchView: React.FC<{
  analysis: DragonDawwaAnalysis;
  currentLanguage?: SupportedLanguage;
}> = ({ analysis, currentLanguage = 'en' }) => {
  if (!usesHadithAuthentication(analysis.research_category)) {
    const sources = analysis.agent_6_synthesis.executive_report_markdown
      .split(/\n## Sources returned by Parallel\.ai\s*\n/i)[1]
      ?.split(/\n---\s*\n/)[0]
      ?.trim();
    return (
      <section className="space-y-4 rounded-2xl border border-teal-500/35 bg-slate-900/90 p-6" lang={currentLanguage}>
        <h2 className="text-xl font-bold text-white">Parallel.ai Research Sources</h2>
        <pre className="whitespace-pre-wrap break-words text-sm text-slate-200">
          {sources || 'No Parallel.ai source appendix was returned.'}
        </pre>
      </section>
    );
  }
  const enriched = analysis.agent_7_source_research
    ? analysis
    : attachAgent7ToAnalysis(analysis, currentLanguage);
  const agent7: Agent7SourceResearch = enriched.agent_7_source_research!;

  return (
    <div className="space-y-6" data-testid="agent-7-source-research-view">
      {/* Header Banner — English Headings, Selected-Language Content */}
      <div className="rounded-2xl border border-teal-500/40 bg-gradient-to-r from-slate-900/95 via-teal-950/35 to-slate-900/95 p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-950/80 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-teal-300">
                <Library className="h-3.5 w-3.5 text-teal-400" />
                Agent 7 · Source Research (HadeethEnc)
              </span>
              <span className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-amber-300">
                {agent7.persona_name} · {agent7.role_title}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">
              What Retrieved HadeethEnc Sources Establish
            </h3>
            <p className="text-sm leading-relaxed text-slate-200" lang={currentLanguage}>
              {agent7.summary_established}
            </p>
          </div>
          <div className="rounded-xl border border-teal-500/30 bg-slate-900/90 px-4 py-3 text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Retrieved HadeethEnc Records
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-teal-300">
              {agent7.retrieved_records.length}
            </div>
          </div>
        </div>
      </div>

      {/* Retrieved HadeethEnc Records */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-teal-400" />
          Retrieved HadeethEnc Records (Arabic, Translation, Explanation, Lessons & Published Grade)
        </h4>

        <div className="space-y-4">
          {agent7.retrieved_records.map(rec => {
            const isCandidate = rec.match_status.includes('Candidate');
            return (
              <article
                key={rec.id}
                data-testid={`hadeethenc-record-${rec.id}`}
                className="rounded-2xl border border-slate-800 bg-[var(--surface-panel)]/95 p-5 shadow-lg space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-teal-950 border border-teal-500/40 px-2.5 py-0.5 font-mono text-xs font-bold text-teal-300">
                        HadeethEnc #{rec.id}
                      </span>
                      <span
                        className={`rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${
                          isCandidate
                            ? 'border-amber-500/40 bg-amber-950/60 text-amber-300'
                            : 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                        }`}
                      >
                        {rec.match_status}
                      </span>
                      {rec.published_grade && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                          Published Grade: {rec.published_grade}
                        </span>
                      )}
                    </div>
                    <h5 className="text-base font-bold text-white pt-1" lang={rec.language}>
                      {rec.title}
                    </h5>
                    <p className="text-xs text-slate-400">
                      Collection Reference:{' '}
                      <span className="font-semibold text-slate-200" lang={rec.language}>
                        {rec.collection_attribution || 'HadeethEnc'}
                      </span>{' '}
                      · {rec.match_reason}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={rec.reader_route}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-950/60 px-3 py-1.5 text-xs font-semibold text-teal-200 hover:bg-teal-900/60"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Open in Library
                    </a>
                    <a
                      href={rec.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-amber-400"
                    >
                      HadeethEnc Source <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {rec.arabic && (
                  <div className="rounded-xl border border-amber-500/25 bg-slate-950/70 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 mb-1">
                      Original Arabic Text (HadeethEnc #{rec.id})
                    </div>
                    <p lang="ar" dir="rtl" className="font-arabic text-xl sm:text-2xl leading-loose text-amber-100">
                      {rec.arabic}
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-teal-400 mb-1">
                    Published Translation ({rec.language.toUpperCase()})
                  </div>
                  <p lang={rec.language} className="text-sm sm:text-base leading-relaxed text-slate-100">
                    {rec.translation}
                  </p>
                </div>

                {rec.explanation && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 mb-1">
                      Published HadeethEnc Explanation (Attributed to HadeethEnc #{rec.id})
                    </div>
                    <p lang={rec.language} className="text-xs sm:text-sm leading-relaxed text-slate-300">
                      {rec.explanation}
                    </p>
                  </div>
                )}

                {rec.lessons.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 mb-1.5">
                      Documented Lessons & Benefits (HadeethEnc #{rec.id})
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-300" lang={rec.language}>
                      {rec.lessons.map((lesson, idx) => (
                        <li key={idx}>{lesson}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* Attributed Published Opinions vs. Agent 7 Interpretation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[var(--surface-panel)]/95 p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Attributed Published Opinions (Source Authors & Imams)
          </h4>
          <div className="space-y-3">
            {agent7.attributed_opinions.map((op, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 text-xs space-y-1">
                <div className="font-bold text-amber-300">{op.author_or_source}</div>
                <p className="text-slate-200 leading-relaxed" lang={currentLanguage}>
                  {op.opinion_text}
                </p>
                <div className="font-mono text-[10px] text-slate-400">Reference: {op.reference}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[var(--surface-panel)]/95 p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Agent 7 Analytical Interpretation (Distinguished from Source Text)
          </h4>
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs sm:text-sm leading-relaxed text-slate-200" lang={currentLanguage}>
            {agent7.agent_interpretation}
          </div>

          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 pt-2">
            Unresolved Questions & Source Coverage Limits
          </h5>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300" lang={currentLanguage}>
            {agent7.unresolved_questions.map((u, idx) => (
              <li key={idx}>{u}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* How Agent 7 Feeds & Responds to Agents 1–6 */}
      <div className="rounded-2xl border border-slate-800 bg-[var(--surface-panel)]/95 p-5 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-2">
          <Radio className="h-4 w-4 text-teal-400" />
          Cross-Agent Evidence Responses (Feeding HadeethEnc Records into Agents 1–6)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {agent7.responses_to_agents.map((resp, idx) => (
            <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2 text-xs">
              <div className="font-bold text-amber-300">{resp.target_agent}</div>
              <p className="text-slate-200 leading-relaxed" lang={currentLanguage}>
                {resp.response_text}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {resp.cited_references.map(ref => (
                  <span key={ref} className="rounded bg-teal-950/90 border border-teal-500/30 px-2 py-0.5 font-mono text-[10px] text-teal-300">
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional Research Activity Section (Requirement 10: Technical Search Logs Moved Here) */}
      <details
        data-testid="optional-research-activity"
        className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-400"
      >
        <summary className="cursor-pointer font-semibold text-slate-300 flex items-center justify-between">
          <span>Research activity (Optional technical search logs & candidate passage diagnostics)</span>
          <span className="font-mono text-[11px] text-teal-400">
            {agent7.research_activity.records_opened.length} opened · {agent7.research_activity.duration_ms} ms
          </span>
        </summary>
        <div className="mt-3 space-y-2 border-t border-slate-800 pt-3 font-mono text-[11px]">
          <p>
            <strong className="text-slate-200">Queries run:</strong>{' '}
            {agent7.research_activity.queries_run.join(' · ') || 'none'}
          </p>
          <p>
            <strong className="text-slate-200">Candidates found:</strong> {agent7.research_activity.candidates_found} ·{' '}
            <strong className="text-slate-200">Records opened:</strong> #{agent7.research_activity.records_opened.join(', #')} ·{' '}
            <strong className="text-slate-200">Unopened candidates:</strong> {agent7.research_activity.unopened_count}
          </p>
          <p className="font-sans text-slate-300">{agent7.research_activity.note}</p>
        </div>
      </details>
    </div>
  );
};

/**
 * Complete 7-Agent Full Report View ("Open Full Report").
 * Displays the complete research experience prominently right at the top — never buried beneath search results.
 * Includes all 7 agents' substantive findings, supporting passages, references, comparisons, disagreements,
 * unresolved questions, and the final synthesis without repeating material.
 */
export const CompleteResearchReportView: React.FC<{
  analysis: DragonDawwaAnalysis;
  currentLanguage?: SupportedLanguage;
  onPrint?: () => void;
  onDownloadFullReport?: () => void;
  onOpenRoundtableTab?: () => void;
}> = ({
  analysis,
  currentLanguage = 'en',
  onPrint,
  onDownloadFullReport,
  onOpenRoundtableTab,
}) => {
  return (
    <div className="space-y-6" data-testid="complete-full-report-view">
      <div className="flex flex-wrap items-center justify-end gap-2">
            {onOpenRoundtableTab && (
              <button
                type="button"
                data-testid="full-report-open-roundtable-btn"
                onClick={onOpenRoundtableTab}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/60 bg-amber-500/20 px-4 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
              >
                <Radio className="h-4 w-4 text-amber-400" />
                Listen in 7-Agent Roundtable
              </button>
            )}
            {onDownloadFullReport && (
              <button
                type="button"
                data-testid="download-full-report-btn"
                onClick={onDownloadFullReport}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-950/80 px-4 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-900/80 cursor-pointer"
              >
                <FileDown className="h-4 w-4 text-emerald-400" />
                Download Full Report
              </button>
            )}
            {onPrint && (
              <button
                type="button"
                data-testid="print-full-report-btn"
                onClick={onPrint}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-white hover:border-amber-400 cursor-pointer"
              >
                <Printer className="h-4 w-4 text-amber-400" />
                Print Full Report
              </button>
            )}
      </div>
      <HadithReportPaper analysis={analysis} currentLanguage={currentLanguage} readerName="DRAGON DAWWA reader" />
    </div>
  );
};

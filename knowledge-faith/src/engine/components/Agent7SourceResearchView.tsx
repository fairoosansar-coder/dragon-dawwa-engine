import React from 'react';
import {
  Award,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileDown,
  Library,
  Link2,
  Printer,
  Radio,
  Scale,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { Agent7SourceResearch, DragonDawwaAnalysis } from '../types/hadith.ts';
import { getPurityLevel } from '../utils/gradeUtils.ts';
import { attachAgent7ToAnalysis } from '../utils/agent7SourceResearch.ts';
import type { SupportedLanguage } from '../utils/localization.ts';

export const Agent7SourceResearchView: React.FC<{
  analysis: DragonDawwaAnalysis;
  currentLanguage?: SupportedLanguage;
}> = ({ analysis, currentLanguage = 'en' }) => {
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
  const enriched = analysis.agent_7_source_research
    ? analysis
    : attachAgent7ToAnalysis(analysis, currentLanguage);
  const s = enriched.agent_6_synthesis;
  const p = getPurityLevel(s.purity_confidence_score);
  const a1 = enriched.agent_1_takhrij;
  const a2 = enriched.agent_2_isnad;
  const a3 = enriched.agent_3_rijal;
  const a4 = enriched.agent_4_shawahid_matn;
  const a5 = enriched.agent_5_scholars_verdict;

  return (
    <div className="space-y-8" data-testid="complete-full-report-view">
      {/* 1. Prominent Executive Verdict & Action Header */}
      <section className="rounded-3xl border-2 border-amber-500/50 bg-gradient-to-br from-slate-900 via-slate-900/95 to-emerald-950/40 p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/70 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
              <Award className="h-4 w-4" />
              Complete 7-Agent Research Report
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {s.final_status}
            </h2>
            <p className="text-xs font-mono text-emerald-400">
              Purity Confidence Score: {s.purity_confidence_score.toFixed(1)}% · Classification: {p.title}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
        </div>

        {/* Researched Hadith Query & Consensus / Disagreements */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400">
            Researched Hadith Narration (Matn)
          </div>
          <p className="text-sm sm:text-base font-medium text-white leading-relaxed" lang={currentLanguage}>
            “{enriched.query_hadith}”
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Agent 6 (Synthesis) · Consensus & Scholarly Disagreements
          </div>
          <p className="text-sm leading-relaxed text-slate-200" lang={currentLanguage}>
            {s.consensus_and_disagreements}
          </p>
          <div className="space-y-3 pt-2 border-t border-slate-800 text-sm text-slate-300 leading-relaxed" lang={currentLanguage}>
            {s.executive_report_markdown.split('\n\n').map((para, i) => (
              <p key={i}>{para.replace(/^#+\s*/, '').replace(/\*\*/g, '')}</p>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Agent 7 — Source Research (HadeethEnc Encyclopedia & Cross-Agent Evidence) */}
      <section className="space-y-4">
        <Agent7SourceResearchView analysis={enriched} currentLanguage={currentLanguage} />
      </section>

      {/* 3. Agent 1 — Takhrij & Textual Variants */}
      <section className="rounded-2xl border border-slate-800 bg-[var(--surface-panel)]/95 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-emerald-400" />
            Agent 1 · Takhrij & Textual Variants (Dr. Tariq al-Mansoor)
          </h3>
          <span className="font-mono text-xs text-slate-400">{a1.sources.length} Primary Citations</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed" lang={currentLanguage}>
          {a1.variants_summary}
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
              <tr>
                <th className="p-3">Collection</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Recorded Wording</th>
                <th className="p-3">Variant & Comparison Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {a1.sources.map((src, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-bold text-amber-300 whitespace-nowrap">{src.collection}</td>
                  <td className="p-3 font-mono text-emerald-300 whitespace-nowrap">{src.hadith_number}</td>
                  <td className="p-3 font-arabic text-sm text-amber-100" dir="rtl" lang="ar">
                    {src.exact_wording}
                  </td>
                  <td className="p-3 text-slate-300" lang={currentLanguage}>
                    {src.wording_differences}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Agent 2 — Isnad Continuity & Chain Topology */}
      <section className="rounded-2xl border border-slate-800 bg-[var(--surface-panel)]/95 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Link2 className="h-5 w-5 text-cyan-400" />
            Agent 2 · Isnad Continuity & Transmission Chain (Dr. Layla al-Qasimi)
          </h3>
          <span className="font-mono text-xs text-cyan-300">{a2.narrator_sequence.length} Transmission Tiers</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-200 font-medium" lang={currentLanguage}>
          {a2.overall_chain_status}
        </p>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 font-mono text-xs text-amber-200">
          {a2.narrator_sequence.join(' ➔ ')}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
              <tr>
                <th className="p-3">Teacher</th>
                <th className="p-3">Student</th>
                <th className="p-3">Transmission Mode</th>
                <th className="p-3">Status</th>
                <th className="p-3">Historical Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {a2.chain_links.map((lk, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-semibold">{lk.teacher}</td>
                  <td className="p-3 font-semibold">{lk.student}</td>
                  <td className="p-3 font-mono text-amber-300">{lk.transmission_mode}</td>
                  <td className="p-3 font-bold text-emerald-300">{lk.connection_status}</td>
                  <td className="p-3 text-slate-300">{lk.historical_reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Agent 3 — Rijal Biographical Critic Archive */}
      <section className="rounded-2xl border border-slate-800 bg-[var(--surface-panel)]/95 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-purple-400" />
            Agent 3 · Rijal Biographical Critic Archive (Sheikh Imran al-Hasani)
          </h3>
          <span className="font-mono text-xs text-purple-300">{a3.narrators.length} Transmitters Audited</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {a3.narrators.map((n, idx) => (
            <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white text-sm">{n.narrator_name}</span>
                <span className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-2.5 py-0.5 font-bold text-emerald-300">
                  {n.status}
                </span>
              </div>
              {n.critic_verdicts.map((cv, cIdx) => (
                <p key={cIdx} className="text-slate-300 italic" lang={currentLanguage}>
                  “{cv}”
                </p>
              ))}
              {n.critic_quotes_translated && (
                <p className="text-amber-200/90" lang={currentLanguage}>
                  {n.critic_quotes_translated}
                </p>
              )}
              <div className="text-[11px] font-mono text-slate-400 pt-1">
                Citations: {n.citations.join(' · ')}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Agent 4 — Shawahid, Matn Diagnostics & Defect Screening */}
      <section className="rounded-2xl border border-slate-800 bg-[var(--surface-panel)]/95 p-6 space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Eye className="h-5 w-5 text-pink-400" />
          Agent 4 · Shawahid, Matn Diagnostics & Defect Screening (Dr. Zainab al-Mubarak)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
            <div className="font-bold uppercase tracking-wider text-emerald-400">Supporting Reports (Shawahid)</div>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-200" lang={currentLanguage}>
              {a4.supporting_reports.map((sr, i) => (
                <li key={i}>{sr}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
            <div className="font-bold uppercase tracking-wider text-amber-400">Hidden Defects (‘Ilal)</div>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-200" lang={currentLanguage}>
              {a4.hidden_defects_ilal.map((hd, i) => (
                <li key={i}>{hd}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
            <div className="font-bold uppercase tracking-wider text-rose-400">Contradictions & Shudhudh Screen</div>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-200" lang={currentLanguage}>
              {a4.contradictions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
        {(a4.quranic_corroboration_arabic || a4.quranic_corroboration_english) && (
          <div className="rounded-xl border border-amber-500/30 bg-slate-900/90 p-4 space-y-1 text-xs">
            <div className="font-mono uppercase text-amber-400">Qur’anic Harmony & Corroboration</div>
            {a4.quranic_corroboration_arabic && (
              <p lang="ar" dir="rtl" className="font-arabic text-lg text-amber-100">
                {a4.quranic_corroboration_arabic}
              </p>
            )}
            <p className="text-slate-200" lang={currentLanguage}>
              {a4.quranic_corroboration_english}
            </p>
          </div>
        )}
      </section>

      {/* 7. Agent 5 — Comparative Scholars' Verdicts Matrix */}
      <section className="rounded-2xl border border-slate-800 bg-[var(--surface-panel)]/95 p-6 space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Scale className="h-5 w-5 text-indigo-400" />
          Agent 5 · Comparative Scholars’ Verdicts Matrix (Sheikh Yusuf al-Azhari)
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
              <tr>
                <th className="p-3">Scholar / Authority</th>
                <th className="p-3">Published Ruling / Grading</th>
                <th className="p-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {a5.gradings.map((g, i) => (
                <tr key={i}>
                  <td className="p-3 font-bold text-white" lang={currentLanguage}>{g.scholar}</td>
                  <td className="p-3 font-bold text-amber-300" lang={currentLanguage}>{g.grading}</td>
                  <td className="p-3 font-mono text-slate-300" lang={currentLanguage}>{g.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

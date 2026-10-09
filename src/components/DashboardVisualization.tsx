import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  Info, 
  Award, 
  BookOpen, 
  ArrowRight,
  Filter,
  Sparkles,
  GitBranch,
  Quote,
  Share2
} from 'lucide-react';
import { DragonDawwaAnalysis, NarratorBio } from '../types/hadith';
import { getNarratorBadgeStyle, getPurityLevel, getTransmissionBadge } from '../utils/gradeUtils';
import { HistoricalVariationsChart } from './HistoricalVariationsChart';

interface DashboardVisualizationProps {
  data: DragonDawwaAnalysis;
  onSelectNarrator?: (narratorName: string) => void;
  onShare?: () => void;
}

export const DashboardVisualization: React.FC<DashboardVisualizationProps> = ({
  data,
  onSelectNarrator,
  onShare
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'authentic' | 'acceptable' | 'weak' | 'rejected'>('all');
  const [selectedNarratorForModal, setSelectedNarratorForModal] = useState<NarratorBio | null>(null);

  const purityScore = data.agent_6_synthesis.purity_confidence_score;
  const purityMeta = getPurityLevel(purityScore);
  const narrators = data.agent_3_rijal.narrators;
  const chainLinks = data.agent_2_isnad.chain_links;

  // Filtered narrators
  const filteredNarrators = narrators.filter((n) => {
    if (filterCategory === 'all') return true;
    const style = getNarratorBadgeStyle(n.status);
    return style.category === filterCategory;
  });

  // Circular gauge calculations
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  // clamp score between 0 and 100
  const clampedScore = Math.min(100, Math.max(0, purityScore));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  // Pillars estimations from data
  const hasBrokenChain = chainLinks.some(l => l.connection_status.toLowerCase().includes('broken'));
  const hasShadh = data.agent_4_shawahid_matn.hidden_defects_ilal.length > 0 || data.agent_4_shawahid_matn.contradictions.length > 0;
  const hasWeakNarrator = narrators.some(n => {
    const s = n.status.toLowerCase();
    return s.includes("da'if") || s.includes('matruk') || s.includes('majhul');
  });

  const isPerfect = purityScore >= 99.5;
  const ittisalScore = isPerfect ? 100 : hasBrokenChain ? 35 : 98;
  const dabtScore = isPerfect ? 100 : hasWeakNarrator ? (purityScore < 30 ? 15 : 60) : 95;
  const shudhudhScore = isPerfect ? 100 : hasShadh ? (purityScore < 60 ? 40 : 65) : 96;
  const ilalScore = isPerfect ? 100 : data.agent_4_shawahid_matn.hidden_defects_ilal.length > 0 ? (purityScore < 60 ? 30 : 60) : 95;

  return (
    <div className="space-y-8">
      {/* Top Banner: Status Header */}
      <div className="bg-gradient-to-r from-slate-900/90 via-[#0d1520] to-slate-900/90 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/50 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Agent 6 Synthesis Verdict
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700">
                {narrators.length} Transmitters Verified
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700">
                {data.agent_1_takhrij.sources.length} Collections Cataloged
              </span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>{data.agent_6_synthesis.final_status}</span>
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed">
              {data.agent_6_synthesis.consensus_and_disagreements}
            </p>
          </div>

          {/* Quick Verdict Badge & Share Action */}
          <div className="flex flex-col items-end gap-2.5 shrink-0 w-full lg:w-auto">
            <div className={`px-4 py-3 rounded-xl border flex items-center gap-3 ${purityMeta.badgeClass} shadow-lg w-full sm:w-auto justify-between sm:justify-start`}>
              {purityScore >= 75 ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              ) : purityScore >= 45 ? (
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-400" />
              )}
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">Authenticity Classification</div>
                <div className="text-lg font-bold">{purityMeta.title}</div>
                <div className="text-xs font-arabic opacity-75">{purityMeta.arabicTitle}</div>
              </div>
            </div>

            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer hover:border-amber-500/40"
                title="Share this analysis report via Web Share API"
              >
                <Share2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Share Authentication Dossier</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Circular Progress Gauge + Narrator Reliability Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Purity Confidence Score Circular Progress Gauge (5 cols) */}
        <div className="lg:col-span-5 bg-[#0b1219]/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/70">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Purity Confidence Score
              </h3>
              <p className="text-xs text-slate-400">Algorithmic Hadith Authentication Metric</p>
            </div>
            <span className="text-xs font-mono text-emerald-400/90 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded">
              0.0% – 100.0%
            </span>
          </div>

          {/* CIRCULAR GAUGE COMPONENT */}
          <div className="py-8 flex flex-col items-center justify-center relative">
            <div className="relative w-64 h-64 flex items-center justify-center">
              
              {/* Outer decorative halo */}
              <div 
                className="absolute inset-4 rounded-full blur-2xl opacity-20 transition-all duration-700 pointer-events-none"
                style={{ backgroundColor: purityMeta.colorHex }}
              />

              <svg className="w-64 h-64 -rotate-90 transform" viewBox="0 0 200 200">
                {/* Background Track */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  stroke="#1e293b"
                  strokeWidth="14"
                  fill="transparent"
                  strokeDasharray="4 6"
                />

                {/* Sub-track ring */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius - 12}
                  stroke="#0f172a"
                  strokeWidth="2"
                  fill="transparent"
                />

                {/* Animated Value Ring */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  stroke={purityMeta.colorHex}
                  strokeWidth="14"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white font-mono drop-shadow-md">
                  {purityScore.toFixed(1)}%
                </span>
                
                <span 
                  className="mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border shadow-sm uppercase tracking-wider"
                  style={{ 
                    borderColor: `${purityMeta.colorHex}55`, 
                    backgroundColor: `${purityMeta.colorHex}22`,
                    color: purityMeta.colorHex 
                  }}
                >
                  {purityMeta.title.split('/')[0].trim()}
                </span>

                <span className="text-[11px] font-arabic text-slate-400 mt-1">
                  {purityMeta.arabicTitle}
                </span>
              </div>
            </div>

            {/* Gauge explanation caption */}
            <p className="text-xs text-center text-slate-400 mt-2 max-w-xs leading-relaxed">
              {purityMeta.description}
            </p>
          </div>

          {/* 4-Pillars Classical Hadith Sub-Gauges */}
          <div className="space-y-3 pt-4 border-t border-slate-800/70">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Usool al-Hadith Diagnostic Pillars</span>
              <span className="text-[10px] text-slate-500 font-mono">Weight Matrix</span>
            </div>

            {/* Pillar 1: Ittisal */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">1. Ittisal al-Sanad (Chain Continuity)</span>
                <span className="font-mono text-slate-400">{ittisalScore}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${ittisalScore > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${ittisalScore}%` }}
                />
              </div>
            </div>

            {/* Pillar 2: Dabt wa Adalah */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">2. Dabt wa 'Adalah (Narrator Precision)</span>
                <span className="font-mono text-slate-400">{dabtScore}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${dabtScore > 70 ? 'bg-emerald-500' : dabtScore > 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${dabtScore}%` }}
                />
              </div>
            </div>

            {/* Pillar 3: Salamah min al-Shudhudh */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">3. Salamah min al-Shudhudh (No Irregularity)</span>
                <span className="font-mono text-slate-400">{shudhudhScore}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${shudhudhScore > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${shudhudhScore}%` }}
                />
              </div>
            </div>

            {/* Pillar 4: Salamah min al-Ilal */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">4. Salamah min al-'Ilal (Freedom from Hidden Defects)</span>
                <span className="font-mono text-slate-400">{ilalScore}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${ilalScore > 70 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${ilalScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Narrator Reliability Status using Color-Coded Badges (7 cols) */}
        <div className="lg:col-span-7 bg-[#0b1219]/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xl backdrop-blur-md">
          <div>
            {/* Header with Title and Filter Badges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/70">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Narrator Reliability Status Matrix
                </h3>
                <p className="text-xs text-slate-400">Jarh wa Ta'dil Biographies & Transmission Badges</p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap bg-slate-900/80 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                    filterCategory === 'all'
                      ? 'bg-slate-700 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({narrators.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('authentic')}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                    filterCategory === 'authentic'
                      ? 'bg-emerald-900/80 text-emerald-200 font-medium border border-emerald-600/50'
                      : 'text-slate-400 hover:text-emerald-400'
                  }`}
                >
                  Thiqat
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('acceptable')}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                    filterCategory === 'acceptable'
                      ? 'bg-cyan-900/80 text-cyan-200 font-medium border border-cyan-600/50'
                      : 'text-slate-400 hover:text-cyan-400'
                  }`}
                >
                  Saduq
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('weak')}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                    filterCategory === 'weak'
                      ? 'bg-amber-900/80 text-amber-200 font-medium border border-amber-600/50'
                      : 'text-slate-400 hover:text-amber-400'
                  }`}
                >
                  Da'if
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('rejected')}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                    filterCategory === 'rejected'
                      ? 'bg-rose-900/80 text-rose-200 font-medium border border-rose-600/50'
                      : 'text-slate-400 hover:text-rose-400'
                  }`}
                >
                  Matruk
                </button>
              </div>
            </div>

            {/* Narrator Badges Legend */}
            <div className="py-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Grade Index:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 text-amber-300 border border-amber-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Thiqah Thabt
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-600/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Thiqah (Reliable)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-600/40">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> Saduq (Truthful)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-950/80 text-orange-300 border border-orange-600/40">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span> Da'if (Weak)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-600/40">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Matruk / Wadda'
              </span>
            </div>

            {/* Narrator Badges List */}
            <div className="space-y-3 mt-2 max-h-[460px] overflow-y-auto pr-2">
              {filteredNarrators.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
                  No narrators found matching the selected filter.
                </div>
              ) : (
                filteredNarrators.map((narrator, idx) => {
                  const style = getNarratorBadgeStyle(narrator.status);
                  
                  // Find link information for this narrator if available
                  const link = chainLinks.find(
                    l => l.student.toLowerCase().includes(narrator.narrator_name.toLowerCase()) ||
                         narrator.narrator_name.toLowerCase().includes(l.student.toLowerCase())
                  );

                  return (
                    <div
                      key={idx}
                      className={`group relative p-4 rounded-xl border ${style.pillBorder} bg-gradient-to-r ${style.bgGlow} transition-all duration-200 hover:border-slate-500/60 hover:shadow-lg`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        
                        {/* Narrator Name & Sequence */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-mono flex items-center justify-center font-bold border border-slate-700">
                              {idx + 1}
                            </span>
                            <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-amber-200 transition-colors">
                              {narrator.narrator_name}
                            </h4>
                          </div>

                          {/* Transmission link badge if available */}
                          {link && (
                            <div className="flex items-center gap-2 text-xs text-slate-400 pl-8">
                              <span className="text-[11px] font-mono text-slate-500">Mode:</span>
                              <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[11px] font-mono border border-slate-700/60">
                                {link.transmission_mode}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                Link: <span className="text-slate-300">{link.connection_status}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* COLOR-CODED RELIABILITY BADGE (Requested Feature) */}
                        <div className="flex items-center gap-2 shrink-0 pl-8 sm:pl-0">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium tracking-wide shadow-sm ${style.badgeClass}`}
                          >
                            {style.category === 'authentic' ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : style.category === 'acceptable' ? (
                              <Info className="w-3.5 h-3.5" />
                            ) : style.category === 'weak' ? (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            {narrator.status}
                          </span>

                          {/* Quick Inspect Details Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedNarratorForModal(narrator);
                              if (onSelectNarrator) onSelectNarrator(narrator.narrator_name);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 text-xs flex items-center gap-1"
                            title="View Jarh wa Ta'dil Dossier"
                          >
                            <Quote className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Critic Quotes</span>
                          </button>
                        </div>
                      </div>

                      {/* Snippet of primary critic statement */}
                      {narrator.critic_verdicts && narrator.critic_verdicts.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-xs text-slate-300 italic pl-8 line-clamp-1">
                          "{narrator.critic_verdicts[0]}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Card Footer info */}
          <div className="pt-4 mt-4 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              Grounded in Tahdhib al-Tahdhib, Mizan al-I'tidal & Al-Thiqat
            </span>
            <span className="text-slate-500 font-mono">
              Agent 3 Rijal Validation Complete
            </span>
          </div>
        </div>
      </div>

      {/* Historical Variations & Confidence Score Trend Line Chart using Recharts */}
      <HistoricalVariationsChart data={data} />

      {/* Narrator Quick Dossier Modal */}
      {selectedNarratorForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f1722] border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono uppercase text-emerald-400">Jarh wa Ta'dil Biographical Record</span>
                <h3 className="text-xl font-bold text-white">{selectedNarratorForModal.narrator_name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNarratorForModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Assigned Scholarly Grade:</span>
              <span className={`px-3 py-1 rounded-lg border text-xs font-bold ${getNarratorBadgeStyle(selectedNarratorForModal.status).badgeClass}`}>
                {selectedNarratorForModal.status}
              </span>
            </div>

            {/* Critic Verdicts */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Quote className="w-3.5 h-3.5 text-amber-400" />
                Critic Judgments (Aqwal al-A'immah)
              </h4>
              <div className="space-y-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                {selectedNarratorForModal.critic_verdicts.map((quote, qIdx) => (
                  <p key={qIdx} className="text-xs text-slate-300 italic pl-3 border-l-2 border-amber-500/50">
                    "{quote}"
                  </p>
                ))}
              </div>
            </div>

            {/* Reference Citations */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Volume & Page Citations:
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedNarratorForModal.citations.map((cite, cIdx) => (
                  <span key={cIdx} className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">
                    {cite}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedNarratorForModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

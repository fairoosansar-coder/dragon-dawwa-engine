import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
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
import { HadithThemeFrequencyChart } from './HadithThemeFrequencyChart';
import { SupportedLanguage } from '../utils/localization';

interface DashboardVisualizationProps {
  data: DragonDawwaAnalysis;
  onSelectNarrator?: (narratorName: string) => void;
  onShare?: () => void;
  currentLanguage?: SupportedLanguage;
  onSelectSearchItem?: (matn: string, isnad: string) => void;
}

export const DashboardVisualization: React.FC<DashboardVisualizationProps> = ({
  data,
  onSelectNarrator,
  onShare,
  currentLanguage = 'en',
  onSelectSearchItem
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'authentic' | 'acceptable' | 'weak' | 'rejected'>('all');
  const [selectedNarratorForModal, setSelectedNarratorForModal] = useState<NarratorBio | null>(null);
  const d3GaugeRef = useRef<SVGSVGElement | null>(null);

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

  // Clamp score between 0 and 100
  const clampedScore = Math.min(100, Math.max(0, purityScore));

  // D3.js Animated Circular Progress Gauge Implementation
  useEffect(() => {
    if (!d3GaugeRef.current) return;

    const svg = d3.select(d3GaugeRef.current);
    svg.selectAll('*').remove();

    const size = 250;
    const margin = 20;
    const outerRadius = size / 2 - margin;
    const innerRadius = outerRadius - 16;
    const center = size / 2;

    const g = svg
      .attr('viewBox', `0 0 ${size} ${size}`)
      .append('g')
      .attr('transform', `translate(${center}, ${center})`);

    // Gradient definitions
    const defs = svg.append('defs');
    const gradId = `d3-gauge-gradient-${Math.round(clampedScore)}`;
    const gradient = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', purityMeta.colorHex)
      .attr('stop-opacity', 0.85);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', clampedScore >= 75 ? '#34d399' : clampedScore >= 45 ? '#fbbf24' : '#fb7185')
      .attr('stop-opacity', 1);

    // Glow filter
    const filter = defs.append('filter').attr('id', 'd3-gauge-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Background track arc
    const backgroundArc = d3
      .arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(0)
      .endAngle(2 * Math.PI)
      .cornerRadius(8);

    g.append('path')
      .attr('d', backgroundArc as any)
      .attr('fill', '#1e293b')
      .attr('opacity', 0.5);

    // Sub-track thin inner circle
    const subInnerArc = d3
      .arc<any>()
      .innerRadius(innerRadius - 8)
      .outerRadius(innerRadius - 7)
      .startAngle(0)
      .endAngle(2 * Math.PI);

    g.append('path')
      .attr('d', subInnerArc as any)
      .attr('fill', '#334155')
      .attr('opacity', 0.4);

    // Radial calibration ticks
    const tickCount = 24;
    const ticks = d3.range(tickCount);
    g.selectAll('.d3-tick')
      .data(ticks)
      .enter()
      .append('line')
      .attr('class', 'd3-tick')
      .attr('x1', 0)
      .attr('y1', -(outerRadius + 3))
      .attr('x2', 0)
      .attr('y2', -(outerRadius + 7))
      .attr('stroke', (d) => {
        const tickScore = (d / tickCount) * 100;
        return tickScore <= clampedScore ? purityMeta.colorHex : '#334155';
      })
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0.6)
      .attr('transform', (d) => `rotate(${(d / tickCount) * 360})`);

    // Foreground animated arc
    const targetAngle = (clampedScore / 100) * 2 * Math.PI;
    const foregroundArc = d3
      .arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(0)
      .cornerRadius(8);

    const progressPath = g
      .append('path')
      .datum({ endAngle: 0 })
      .attr('fill', `url(#${gradId})`)
      .attr('filter', 'url(#d3-gauge-glow)');

    progressPath
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attrTween('d', function (d: any) {
        const interpolate = d3.interpolate(d.endAngle, targetAngle);
        return function (t: number) {
          d.endAngle = interpolate(t);
          return foregroundArc(d) || '';
        };
      });

    // Tip marker bead at head of arc
    if (clampedScore > 0) {
      const midRadius = (innerRadius + outerRadius) / 2;
      const marker = g
        .append('circle')
        .attr('r', 5)
        .attr('fill', '#ffffff')
        .attr('stroke', purityMeta.colorHex)
        .attr('stroke-width', 2.5)
        .attr('filter', 'url(#d3-gauge-glow)');

      marker
        .transition()
        .duration(1200)
        .ease(d3.easeCubicOut)
        .attrTween('transform', function () {
          const interpolate = d3.interpolate(0, targetAngle);
          return function (t: number) {
            const angle = interpolate(t) - Math.PI / 2;
            const x = midRadius * Math.cos(angle);
            const y = midRadius * Math.sin(angle);
            return `translate(${x}, ${y})`;
          };
        });
    }
  }, [clampedScore, purityMeta.colorHex]);

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

  const L = {
    en: {
      synthesisVerdict: 'Agent 6 Synthesis Verdict',
      transmittersVerified: 'Transmitters Verified',
      collectionsCataloged: 'Collections Cataloged',
      authClassification: 'Authenticity Classification',
      shareDossier: 'Share Authentication Dossier',
      purityConfidenceScore: 'Purity Confidence Score',
      purityMetric: 'D3.js Algorithmic Hadith Authentication Metric',
      pillarsTitle: 'Usool al-Hadith Diagnostic Pillars',
      weightMatrix: 'Weight Matrix',
      pillar1: '1. Ittisal al-Sanad (Chain Continuity)',
      pillar2: "2. Dabt wa 'Adalah (Narrator Precision)",
      pillar3: '3. Salamah min al-Shudhudh (No Irregularity)',
      pillar4: "4. Salamah min al-'Ilal (Freedom from Hidden Defects)",
      matrixTitle: 'Narrator Reliability Status Matrix',
      matrixSub: "Jarh wa Ta'dil Biographies & Transmission Badges",
      all: 'All',
      thiqat: 'Thiqat',
      saduq: 'Saduq',
      daif: "Da'if",
      matruk: 'Matruk',
      criticJudgments: "Critic Judgments (Aqwal al-A'immah)",
      volumePageCitations: 'Volume & Page Citations:',
      closeDossier: 'Close Dossier',
      assignedGrade: 'Assigned Scholarly Grade:',
    },
    ta: {
      synthesisVerdict: 'முகவர் 6 ஒருங்கிணைப்பு இறுதித் தீர்ப்பு',
      transmittersVerified: 'அறிவிப்பாளர்கள் சரிபார்க்கப்பட்டனர்',
      collectionsCataloged: 'நூல்கள் பட்டியலிடப்பட்டன',
      authClassification: 'நம்பகத்தன்மை வகைப்பாடு',
      shareDossier: 'ஆய்வு ஆவணத்தைப் பகிர்க',
      purityConfidenceScore: 'தூய்மை மற்றும் நம்பகத்தன்மை மதிப்பீடு (D3.js)',
      purityMetric: 'ஹதீஸ் நம்பகத்தன்மை கணிப்பீட்டு முறை',
      pillarsTitle: 'ஹதீஸ் கலை அடிப்படை அளவுகෝல்கள் (உசூல்)',
      weightMatrix: 'எடை அளவீடு',
      pillar1: '1. இத்திஸால் அஸ்-ஸனத் (தொடர்ச்சி)',
      pillar2: "2. தப்த் வ 'அதாலத் (துல்லியம் மற்றும் நீதி)",
      pillar3: '3. ஷுதூத் இன்மை (முரண்பாடற்ற நிலை)',
      pillar4: "4. 'இலல் இன்மை (மறைமுகக் குறைபாடுகள் அற்ற நிலை)",
      matrixTitle: 'அறிவிப்பாளர் நம்பகத்தன்மை நிலை அட்டவணை',
      matrixSub: 'ஜர்ஹ் வ தஃதீல் வாழ்க்கை வரலாறு மற்றும் குறியீடுகள்',
      all: 'அனைத்தும்',
      thiqat: 'ஸிகாத் (நம்பகமானவர்கள்)',
      saduq: 'ஸதூக் (நேர்மையானவர்கள்)',
      daif: 'ளஈஃப் (பலவீனமானவர்கள்)',
      matruk: 'மத்ரூக் (கைவிடப்பட்டவர்கள்)',
      criticJudgments: 'விமர்சகர்களின் தீர்ப்புகள் (அக்வாலுல் அஇம்மா)',
      volumePageCitations: 'நூல் மற்றும் பக்க மேற்கோள்கள்:',
      closeDossier: 'மூடுக',
      assignedGrade: 'வழங்கப்பட்ட தரம்:',
    },
    si: {
      synthesisVerdict: 'නියෝජිත 6 සංශ්ලේෂණ අවසන් තීන්දුව',
      transmittersVerified: 'සම්ප්‍රේෂකයන් සත්‍යාපිතයි',
      collectionsCataloged: 'හදීස් එකතු නාමාවලිගතයි',
      authClassification: 'සත්‍යතාව වර්ගීකරණය',
      shareDossier: 'සත්‍යාපන වාර්තාව බෙදාගන්න',
      purityConfidenceScore: 'පාරිශුද්ධතා සහ විශ්වසනීයතා ලකුණු (D3.js)',
      purityMetric: 'D3.js ඇල්ගොරිතමික හදීස් සත්‍යාපන මිණුම',
      pillarsTitle: 'උසූල් අල්-හදීස් මූලධර්ම කුළුණු',
      weightMatrix: 'භාරකාර න්‍යාසය',
      pillar1: '1. ඉත්තිසාල් අල්-සනද් (දාමයේ අඛණ්ඩතාව)',
      pillar2: "2. ළබ්ත් ව 'අදාලා (නිවේදක නිරවද්‍යතාව සහ යුක්තිය)",
      pillar3: '3. සලාමා මින් අෂ්-ෂුදූද් (පරස්පරතා රහිත බව)',
      pillar4: "4. සලාමා මින් අල්-'ඉලල් (සැඟවුණු දෝෂ රහිත බව)",
      matrixTitle: 'නිවේදක විශ්වාසනීයතා තත්ත්ව න්‍යාසය',
      matrixSub: 'ජර්හ් ව තඃදීල් චරිතාපදාන සහ සම්ප්‍රේෂණ ලාංඡන',
      all: 'සියල්ල',
      thiqat: 'සිකාත් (විශ්වාසවන්ත)',
      saduq: 'සදූක් (සත්‍යවාදී)',
      daif: 'ළඊෆ් (දුර්වල)',
      matruk: 'මත්රූක් (ප්‍රතික්ෂේපිත)',
      criticJudgments: 'විද්වත් විවේචන සහ සාක්ෂි (අක්වාල් අල්-අඉම්මා)',
      volumePageCitations: 'වෙළුම් සහ පිටු මූලාශ්‍ර:',
      closeDossier: 'ලේඛනය වසන්න',
      assignedGrade: 'නියමිත ශාස්ත්‍රීය තත්ත්වය:',
    }
  }[currentLanguage] || {
    synthesisVerdict: 'Agent 6 Synthesis Verdict',
    transmittersVerified: 'Transmitters Verified',
    collectionsCataloged: 'Collections Cataloged',
    authClassification: 'Authenticity Classification',
    shareDossier: 'Share Authentication Dossier',
    purityConfidenceScore: 'Purity Confidence Score',
    purityMetric: 'D3.js Algorithmic Hadith Authentication Metric',
    pillarsTitle: 'Usool al-Hadith Diagnostic Pillars',
    weightMatrix: 'Weight Matrix',
    pillar1: '1. Ittisal al-Sanad (Chain Continuity)',
    pillar2: "2. Dabt wa 'Adalah (Narrator Precision)",
    pillar3: '3. Salamah min al-Shudhudh (No Irregularity)',
    pillar4: "4. Salamah min al-'Ilal (Freedom from Hidden Defects)",
    matrixTitle: 'Narrator Reliability Status Matrix',
    matrixSub: "Jarh wa Ta'dil Biographies & Transmission Badges",
    all: 'All',
    thiqat: 'Thiqat',
    saduq: 'Saduq',
    daif: "Da'if",
    matruk: 'Matruk',
    criticJudgments: "Critic Judgments (Aqwal al-A'immah)",
    volumePageCitations: 'Volume & Page Citations:',
    closeDossier: 'Close Dossier',
    assignedGrade: 'Assigned Scholarly Grade:',
  };

  return (
    <div className="space-y-8">
      {/* Top Banner: Status Header */}
      <div className="bg-gradient-to-r from-slate-900/90 via-[var(--surface-raised)] to-slate-900/90 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/50 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                {L.synthesisVerdict}
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700">
                {narrators.length} {L.transmittersVerified}
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700">
                {data.agent_1_takhrij.sources.length} {L.collectionsCataloged}
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
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">{L.authClassification}</div>
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
                <span>{L.shareDossier}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: D3.js Circular Progress Gauge + Narrator Reliability Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Purity Confidence Score D3 Circular Progress Gauge (5 cols) */}
        <div className="lg:col-span-5 bg-[var(--surface-panel)]/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/70">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                {L.purityConfidenceScore}
              </h3>
              <p className="text-xs text-slate-400">{L.purityMetric}</p>
            </div>
            <span className="text-xs font-mono text-emerald-400/90 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded">
              0.0% – 100.0%
            </span>
          </div>

          {/* D3.JS CIRCULAR PROGRESS GAUGE COMPONENT */}
          <div className="py-8 flex flex-col items-center justify-center relative">
            <div className="relative w-64 h-64 flex items-center justify-center">
              
              {/* Outer decorative halo */}
              <div 
                className="absolute inset-4 rounded-full blur-2xl opacity-20 transition-all duration-700 pointer-events-none"
                style={{ backgroundColor: purityMeta.colorHex }}
              />

              {/* D3 SVG Canvas */}
              <svg 
                ref={d3GaugeRef} 
                className="w-64 h-64 -rotate-90 transform drop-shadow-xl" 
                viewBox="0 0 250 250"
              />

              {/* Center Overlay Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
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
              <span>{L.pillarsTitle}</span>
              <span className="text-[10px] text-slate-500 font-mono">{L.weightMatrix}</span>
            </div>

            {/* Pillar 1: Ittisal */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">{L.pillar1}</span>
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
                <span className="text-slate-300 font-medium">{L.pillar2}</span>
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
                <span className="text-slate-300 font-medium">{L.pillar3}</span>
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
                <span className="text-slate-300 font-medium">{L.pillar4}</span>
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
        <div className="lg:col-span-7 bg-[var(--surface-panel)]/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xl backdrop-blur-md">
          <div>
            {/* Header with Title and Filter Badges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/70">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  {L.matrixTitle}
                </h3>
                <p className="text-xs text-slate-400">{L.matrixSub}</p>
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
                  {L.all} ({narrators.length})
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
                  {L.thiqat}
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
                  {L.saduq}
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
                  {L.daif}
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
                  {L.matruk}
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

      {/* Researched Hadith Themes Frequency Over Time Bar Chart (Recharts & Local Storage Query Telemetry) */}
      <HadithThemeFrequencyChart 
        currentLanguage={currentLanguage} 
        onSelectSearchItem={onSelectSearchItem} 
      />

      {/* Narrator Quick Dossier Modal */}
      {selectedNarratorForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--surface-raised)] border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
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
              <span className="text-xs text-slate-400">{L.assignedGrade}</span>
              <span className={`px-3 py-1 rounded-lg border text-xs font-bold ${getNarratorBadgeStyle(selectedNarratorForModal.status).badgeClass}`}>
                {selectedNarratorForModal.status}
              </span>
            </div>

            {/* Critic Verdicts */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Quote className="w-3.5 h-3.5 text-amber-400" />
                {L.criticJudgments}
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
                {L.volumePageCitations}
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
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium cursor-pointer"
              >
                {L.closeDossier}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

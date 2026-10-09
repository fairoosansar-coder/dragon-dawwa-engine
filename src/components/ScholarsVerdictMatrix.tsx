import React from 'react';
import { Agent5ScholarsVerdict } from '../types/hadith';
import { Scale, BookOpen, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

interface ScholarsVerdictMatrixProps {
  verdicts: Agent5ScholarsVerdict;
}

export const ScholarsVerdictMatrix: React.FC<ScholarsVerdictMatrixProps> = ({ verdicts }) => {
  const getVerdictPill = (grading: string) => {
    const g = grading.toLowerCase();
    if (g.includes('sahih')) {
      return {
        badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50',
        icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
      };
    }
    if (g.includes('hasan')) {
      return {
        badge: 'bg-teal-950/80 text-teal-300 border-teal-600/50',
        icon: <Info className="w-3.5 h-3.5 text-teal-400" />
      };
    }
    if (g.includes('shadh') || g.includes('mu\'all') || g.includes('da\'if') || g.includes('weak')) {
      return {
        badge: 'bg-amber-950/80 text-amber-300 border-amber-600/50',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
      };
    }
    if (g.includes('mawdu\'') || g.includes('fabricat') || g.includes('batil') || g.includes('munkar')) {
      return {
        badge: 'bg-rose-950/80 text-rose-300 border-rose-600/50',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />
      };
    }
    return {
      badge: 'bg-slate-800 text-slate-300 border-slate-700',
      icon: <Info className="w-3.5 h-3.5 text-slate-400" />
    };
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0b1219] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
            Agent 5
          </span>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            Scholars' Verdict Matrix (Historical & Contemporary Gradings)
          </h3>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Comparative analysis of verdicts from classical Imams (Mutaqaddimun), medieval commentators, and contemporary Muhadditheen.
        </p>
      </div>

      {/* Comparative Table */}
      <div className="bg-[#0b1219]/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">Scholar / Authority</th>
                <th className="py-4 px-6">Assigned Grading (Hukm)</th>
                <th className="py-4 px-6">Source Reference & Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs text-slate-300">
              {verdicts.gradings.map((item, idx) => {
                const pill = getVerdictPill(item.grading);

                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 font-mono text-[11px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      {item.scholar}
                    </td>

                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${pill.badge}`}>
                        {pill.icon}
                        {item.grading}
                      </span>
                    </td>

                    <td className="py-4 px-6 font-mono text-slate-400 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {item.reference}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

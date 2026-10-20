import React from 'react';
import { Agent4ShawahidMatn } from '../types/hadith';
import { Eye, ShieldAlert, GitCompare, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';

interface ShawahidMatnViewProps {
  shawahid: Agent4ShawahidMatn;
}

export const ShawahidMatnView: React.FC<ShawahidMatnViewProps> = ({ shawahid }) => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[var(--surface-panel)] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
            Agent 4
          </span>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-400" />
            Shawahid & Matn Agent: Corroboration & Defect Detection
          </h3>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Deep scan for parallel witnesses (Shawahid/Mutaabi'at), hidden subtle defects ('Ilal Qadihah), and irregular text (Shudhudh).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Supporting Reports (Shawahid & Mutaabi'at) */}
        <div className="bg-[var(--surface-panel)]/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h4 className="text-base font-bold text-white">Supporting Reports</h4>
              <p className="text-[11px] text-slate-400">Shawahid & Mutaabi'at Chains</p>
            </div>
          </div>

          <div className="space-y-3">
            {shawahid.supporting_reports.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No corroborating reports identified.</p>
            ) : (
              shawahid.supporting_reports.map((report, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed"
                >
                  <span className="font-mono text-emerald-400 mr-1.5 font-bold">#{idx + 1}</span>
                  {report}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hidden Critical Defects ('Ilal) */}
        <div className="bg-[var(--surface-panel)]/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <h4 className="text-base font-bold text-white">Hidden Defects ('Ilal)</h4>
              <p className="text-[11px] text-slate-400">Subtle Flaws in Sanad or Matn</p>
            </div>
          </div>

          <div className="space-y-3">
            {shawahid.hidden_defects_ilal.length === 0 ? (
              <div className="bg-emerald-950/30 border border-emerald-800/40 p-4 rounded-xl text-xs text-emerald-300">
                ✓ No hidden critical defects detected. The narration is free from 'Ilal Qadihah.
              </div>
            ) : (
              shawahid.hidden_defects_ilal.map((defect, idx) => (
                <div
                  key={idx}
                  className="bg-amber-950/20 p-3.5 rounded-xl border border-amber-800/50 text-xs text-amber-200/90 leading-relaxed"
                >
                  <span className="font-mono text-amber-400 mr-1.5 font-bold">Illa #{idx + 1}:</span>
                  {defect}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contradictions & Irregularity (Shudhudh) */}
        <div className="bg-[var(--surface-panel)]/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <AlertOctagon className="w-5 h-5 text-rose-400" />
            <div>
              <h4 className="text-base font-bold text-white">Contradictions / Shudhudh</h4>
              <p className="text-[11px] text-slate-400">Clashes with Mutawatir / Sahihayn</p>
            </div>
          </div>

          <div className="space-y-3">
            {shawahid.contradictions.length === 0 ? (
              <div className="bg-emerald-950/30 border border-emerald-800/40 p-4 rounded-xl text-xs text-emerald-300">
                ✓ No contradictions found with higher-grade authentic texts.
              </div>
            ) : (
              shawahid.contradictions.map((contra, idx) => (
                <div
                  key={idx}
                  className="bg-rose-950/20 p-3.5 rounded-xl border border-rose-800/50 text-xs text-rose-200/90 leading-relaxed"
                >
                  <span className="font-mono text-rose-400 mr-1.5 font-bold">Conflict #{idx + 1}:</span>
                  {contra}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

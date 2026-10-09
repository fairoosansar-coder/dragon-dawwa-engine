import React from 'react';
import { Agent2Isnad } from '../types/hadith';
import { GitCommit, ArrowDown, ShieldCheck, AlertCircle, Clock, Link2, CheckCircle2 } from 'lucide-react';
import { getTransmissionBadge } from '../utils/gradeUtils';

interface IsnadDiagramProps {
  isnad: Agent2Isnad;
}

export const IsnadDiagram: React.FC<IsnadDiagramProps> = ({ isnad }) => {
  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#0b1219] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                Agent 2
              </span>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-cyan-400" />
                Isnad Transmission Chain & Link Continuity
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Validation of teacher-student contemporaneity (Liqa' & Mu'asarah) and transmission terminology ('An'anah vs Sama').
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">Chain Status:</span>
            <span className="text-xs font-bold text-cyan-300 font-mono">
              {isnad.overall_chain_status}
            </span>
          </div>
        </div>

        {/* Narrator Sequence Pathway */}
        <div className="mt-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Transmission Path ({isnad.narrator_sequence.length} Tiers)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isnad.narrator_sequence.map((narrator, idx) => (
              <React.Fragment key={idx}>
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-sm">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 text-[10px] font-mono flex items-center justify-center font-bold border border-cyan-700/50">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {narrator}
                  </span>
                </div>
                {idx < isnad.narrator_sequence.length - 1 && (
                  <span className="text-slate-500 font-bold">➔</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Chain Links Breakdown */}
      <div className="space-y-4">
        <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-cyan-400" />
          Link-by-Link Audit & Transmission Modalities
        </h4>

        <div className="grid grid-cols-1 gap-4">
          {isnad.chain_links.map((link, idx) => {
            const transmission = getTransmissionBadge(link.transmission_mode);
            const isConnected = link.connection_status.toLowerCase().includes('connected');

            return (
              <div
                key={idx}
                className="bg-[#0b1219]/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all shadow-md relative"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Transmission Nodes */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-slate-900 border border-slate-700/70 px-3 py-1.5 rounded-lg">
                      <div className="text-[10px] uppercase font-mono text-slate-400">Teacher (Shaykh)</div>
                      <div className="text-sm font-bold text-white">{link.teacher}</div>
                    </div>

                    <div className="flex flex-col items-center px-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${transmission.color}`}>
                        {transmission.label}
                      </span>
                      <ArrowDown className="w-4 h-4 text-slate-500 my-0.5 md:-rotate-90" />
                    </div>

                    <div className="bg-slate-900 border border-slate-700/70 px-3 py-1.5 rounded-lg">
                      <div className="text-[10px] uppercase font-mono text-slate-400">Student (Rawi)</div>
                      <div className="text-sm font-bold text-white">{link.student}</div>
                    </div>
                  </div>

                  {/* Connection Status Pill */}
                  <div className="shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold ${
                        isConnected
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                          : 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                      }`}
                    >
                      {isConnected ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      {link.connection_status}
                    </span>
                  </div>
                </div>

                {/* Historical Reasoning Box */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300 flex items-start gap-2 bg-slate-950/40 p-2.5 rounded-lg">
                  <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-400">Historical & Contemporaneity Proof: </span>
                    {link.historical_reasoning}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

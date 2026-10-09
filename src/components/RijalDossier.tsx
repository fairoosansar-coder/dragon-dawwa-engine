import React, { useState } from 'react';
import { Agent3Rijal } from '../types/hadith';
import { getNarratorBadgeStyle } from '../utils/gradeUtils';
import { UserCheck, Quote, BookOpen, Search, Shield, Award } from 'lucide-react';

interface RijalDossierProps {
  rijal: Agent3Rijal;
}

export const RijalDossier: React.FC<RijalDossierProps> = ({ rijal }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredNarrators = rijal.narrators.filter(
    (n) =>
      n.narrator_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.critic_verdicts.some((q) => q.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0b1219] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                Agent 3
              </span>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-400" />
                Rijal Agent: Jarh wa Ta'dil Biographical Archive
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Transmitter credibility, memory precision (Dabt), uprightness ('Adalah), and classical critic verdicts.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search narrator or critic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Reference Canon:</span>
          <span className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">Tahdhib al-Tahdhib (Ibn Hajar)</span>
          <span className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">Mizan al-I'tidal (Al-Dhahabi)</span>
          <span className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">Al-Jarh wa al-Ta'dil (Ibn Abi Hatim)</span>
          <span className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">Al-Thiqat (Ibn Hibban)</span>
        </div>
      </div>

      {/* Narrators Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredNarrators.map((narrator, idx) => {
          const badge = getNarratorBadgeStyle(narrator.status);

          return (
            <div
              key={idx}
              className={`bg-[#0b1219]/90 border ${badge.pillBorder} rounded-2xl p-6 shadow-lg flex flex-col justify-between space-y-4`}
            >
              <div className="space-y-4">
                {/* Header: Name & Color-coded status badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold border border-slate-700 shrink-0">
                      {idx + 1}
                    </span>
                    <h4 className="text-base font-bold text-white leading-snug">
                      {narrator.narrator_name}
                    </h4>
                  </div>

                  <span className={`px-3 py-1 rounded-xl border text-xs font-bold shrink-0 ${badge.badgeClass}`}>
                    {narrator.status}
                  </span>
                </div>

                {/* Critic Quotes */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5 text-amber-400" />
                    Critic Verdicts (Aqwal al-Nuqqad)
                  </div>
                  
                  {narrator.critic_quotes_translated && (
                    <div className="bg-purple-950/40 p-3 rounded-xl border border-purple-800/60 text-xs text-purple-200 leading-relaxed font-sans border-l-2 border-l-purple-400">
                      <span className="text-[10px] font-mono text-purple-300 block mb-0.5 uppercase font-semibold">Scholarly Quote:</span>
                      "{narrator.critic_quotes_translated}"
                    </div>
                  )}

                  <div className="space-y-2">
                    {narrator.critic_verdicts.map((verdict, vIdx) => (
                      <div
                        key={vIdx}
                        className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-xs text-slate-200 italic pl-3 border-l-2 border-l-amber-500/70"
                      >
                        "{verdict}"
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Citations Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  Citations:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {narrator.citations.map((cite, cIdx) => (
                    <span
                      key={cIdx}
                      className="text-[11px] font-mono bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-700/80"
                    >
                      {cite}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

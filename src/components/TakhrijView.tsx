import React, { useState } from 'react';
import { Agent1Takhrij } from '../types/hadith';
import { BookOpen, Copy, Check, Search, BookMarked, Layers } from 'lucide-react';

interface TakhrijViewProps {
  takhrij: Agent1Takhrij;
  queryHadith: string;
}

export const TakhrijView: React.FC<TakhrijViewProps> = ({ takhrij, queryHadith }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const filteredSources = takhrij.sources.filter(
    (s) =>
      s.collection.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.hadith_number.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.exact_wording.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-[#0b1219] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                Agent 1
              </span>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-emerald-400" />
                Takhrij al-Hadith (Source Catalog & Wording Extraction)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Cross-referencing primary collections: Sahih al-Bukhari, Sahih Muslim, Sunan al-Arba'ah, and Musnad Ahmad.
            </p>
          </div>

          {/* Search filter input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter collections..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Variants Summary Alert */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
          <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Textual Variants & Turuq Synthesis
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {takhrij.variants_summary}
            </p>
          </div>
        </div>
      </div>

      {/* Primary Sources Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSources.map((source, idx) => (
          <div
            key={idx}
            className="bg-[#0b1219]/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all shadow-md flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  {source.collection}
                </span>
                <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  #{source.hadith_number}
                </span>
              </div>

              {/* Exact Arabic/Original Text */}
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/90">
                <div className="text-right font-arabic text-lg text-emerald-100 leading-loose dir-rtl select-all">
                  {source.exact_wording}
                </div>
              </div>

              {/* Textual Differences & Notes */}
              {source.wording_differences && (
                <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                  <span className="font-semibold text-slate-300">Variant Note: </span>
                  {source.wording_differences}
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Primary Source Record</span>
              <button
                type="button"
                onClick={() => handleCopy(`${source.collection} #${source.hadith_number}: ${source.exact_wording}`, idx)}
                className="hover:text-emerald-400 flex items-center gap-1 transition-colors"
              >
                {copiedIndex === idx ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

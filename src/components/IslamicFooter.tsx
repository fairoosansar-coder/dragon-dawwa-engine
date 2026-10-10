import React from 'react';
import { ShieldCheck, Heart, ExternalLink, Sparkles, Award } from 'lucide-react';

export default function IslamicFooter() {
  return (
    <footer className="mt-16 border-t border-[#D4AF37]/30 bg-[#040D12] text-slate-400 py-10 px-6 font-serif relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
        
        {/* BRANDING & COPYRIGHT */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-center md:justify-start gap-2.5">
            <span className="text-[#D4AF37] font-bold tracking-wider text-base font-display">
              DRAGON DAWWA
            </span>
            <span className="text-[10px] bg-[#183D3D] text-emerald-300 font-sans px-2.5 py-0.5 rounded-full border border-emerald-500/30 tracking-wide font-medium">
              v2.5 Enterprise Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 font-sans">
            © 2026 Prime Dragon Technologies (Pvt) Ltd. All rights reserved.
          </p>
          <p className="text-[11px] text-slate-600 font-sans">
            AI-Assisted Multi-Agent Isnad, Rijal & Matn Authentication Platform
          </p>
        </div>

        {/* DESIGN & DEVELOPMENT CREATION CREDITS */}
        <div className="bg-[#07191D] border border-[#D4AF37]/25 rounded-2xl px-5 py-3.5 flex items-center gap-3.5 shadow-xl transition-all duration-300 hover:border-[#D4AF37]/50 hover:shadow-amber-900/10">
          <div className="p-2.5 bg-[#D4AF37]/10 rounded-xl text-[#D4AF37] border border-[#D4AF37]/30 flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div className="text-left font-sans">
            <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 block font-semibold">
              ENGINEERED & CREATED BY
            </span>
            <span className="text-sm font-bold text-[#D4AF37] tracking-wide block font-display">
              Aegis Intelligence Pvt Ltd, Sri Lanka
            </span>
            <span className="text-[10px] text-slate-400 block">
              Lead AI Architecture, System Design & Full-Stack Engineering
            </span>
          </div>
        </div>

        {/* REGIONAL & LEGAL FOOTER LINKS */}
        <div className="flex flex-col items-center md:items-end gap-2 font-sans">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <a 
              href="#about" 
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="hover:text-[#D4AF37] transition"
            >
              About Platform
            </a>
            <span className="text-slate-600">•</span>
            <a 
              href="#terms" 
              onClick={(e) => { e.preventDefault(); alert("Dragon Dawwa v2.5 Terms of Service: Academic research & transmission analysis engine operated by Prime Dragon Technologies."); }}
              className="hover:text-[#D4AF37] transition"
            >
              Terms of Service
            </a>
            <span className="text-slate-600">•</span>
            <a 
              href="mailto:ferozansarlk@gmail.com" 
              className="hover:text-[#D4AF37] transition flex items-center gap-1"
            >
              Contact Aegis <ExternalLink className="w-3 h-3 inline" />
            </a>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span>Operated by</span>
            <span className="text-slate-300 font-medium">Prime Dragon Technologies</span>
          </p>
        </div>

      </div>
    </footer>
  );
}

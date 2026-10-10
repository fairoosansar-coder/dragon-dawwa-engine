import React from 'react';
import { 
  BookMarked, 
  Link2, 
  UserCheck, 
  Eye, 
  Scale, 
  Sparkles,
  CheckCircle2,
  Loader2,
  Award
} from 'lucide-react';

import { SupportedLanguage } from '../utils/localization';

export type AgentStep = 'overview' | 'takhrij' | 'isnad' | 'rijal' | 'shawahid' | 'scholars' | 'report';

interface AgentStatusTrackerProps {
  currentTab: AgentStep;
  onSelectTab: (tab: AgentStep) => void;
  isLoading?: boolean;
  currentLanguage?: SupportedLanguage;
}

export const AgentStatusTracker: React.FC<AgentStatusTrackerProps> = ({
  currentTab,
  onSelectTab,
  isLoading,
  currentLanguage = 'en'
}) => {
  const getAgentName = (id: AgentStep, defaultName: string): string => {
    if (currentLanguage === 'si') {
      switch (id) {
        case 'overview': return 'සත්‍යාපන න්‍යාසය';
        case 'takhrij': return 'තක්රීජ් සහ පාඨ';
        case 'isnad': return 'ඉස්නාද් අඛණ්ඩතාව';
        case 'rijal': return 'රිජාල් ලේඛනාගාරය';
        case 'shawahid': return 'සැඟවුණු දෝෂ පරීක්ෂාව';
        case 'scholars': return 'විද්වත් තීන්දු';
        case 'report': return 'විධායක සංශ්ලේෂණය';
      }
    } else if (currentLanguage === 'ta') {
      switch (id) {
        case 'overview': return 'நம்பகத்தன்மை கட்டமைப்பு';
        case 'takhrij': return 'தக்ரீஜ் & மூல உரைகள்';
        case 'isnad': return 'இஸ்னாத் தொடர்ச்சி';
        case 'rijal': return 'ரிஜால் கலை ஆவணம்';
        case 'shawahid': return "மறைமுகக் குறைகள் ('இலல்)";
        case 'scholars': return 'உலாமாக்கள் தீர்ப்பு';
        case 'report': return 'இறுதி ஆய்வு அறிக்கை';
      }
    }
    return defaultName;
  };

  const agents = [
    { 
      id: 'overview' as AgentStep, 
      num: 'GAUGE', 
      name: getAgentName('overview', 'Authentication Matrix'), 
      persona: currentLanguage === 'si' ? 'ප්‍රධාන සත්‍යාපන නිලධාරී' : currentLanguage === 'ta' ? 'முதன்மை ஆய்வாளர்' : 'Chief Auth Officer',
      icon: Sparkles, 
      color: 'text-amber-400' 
    },
    { 
      id: 'takhrij' as AgentStep, 
      num: 'A1', 
      name: getAgentName('takhrij', 'Takhrij & Variants'), 
      persona: 'Dr. Tariq al-Mansoor',
      icon: BookMarked, 
      color: 'text-emerald-400' 
    },
    { 
      id: 'isnad' as AgentStep, 
      num: 'A2', 
      name: getAgentName('isnad', 'Isnad Continuity'), 
      persona: 'Dr. Layla al-Qasimi',
      icon: Link2, 
      color: 'text-cyan-400' 
    },
    { 
      id: 'rijal' as AgentStep, 
      num: 'A3', 
      name: getAgentName('rijal', 'Rijal Critic Archive'), 
      persona: 'Sheikh Imran al-Hasani',
      icon: UserCheck, 
      color: 'text-purple-400' 
    },
    { 
      id: 'shawahid' as AgentStep, 
      num: 'A4', 
      name: getAgentName('shawahid', 'Shawahid & Defects'), 
      persona: 'Dr. Zainab al-Mubarak',
      icon: Eye, 
      color: 'text-pink-400' 
    },
    { 
      id: 'scholars' as AgentStep, 
      num: 'A5', 
      name: getAgentName('scholars', 'Scholars Matrix'), 
      persona: 'Sheikh Yusuf al-Azhari',
      icon: Scale, 
      color: 'text-indigo-400' 
    },
    { 
      id: 'report' as AgentStep, 
      num: 'A6', 
      name: getAgentName('report', 'Executive Synthesis'), 
      persona: currentLanguage === 'si' ? 'විධායක නිගමනය' : currentLanguage === 'ta' ? 'இறுதி தீர்ப்பு' : 'Synthesis Dossier',
      icon: Award, 
      color: 'text-amber-400' 
    },
  ];

  return (
    <div className="bg-[var(--surface-panel)]/90 border border-slate-800 rounded-2xl p-2.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        {agents.map((ag) => {
          const Icon = ag.icon;
          const isActive = currentTab === ag.id;

          return (
            <button
              key={ag.id}
              type="button"
              onClick={() => onSelectTab(ag.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-white shadow-md border border-slate-700/80 ring-1 ring-amber-400/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                isActive ? 'bg-slate-700 text-amber-300' : 'bg-slate-900 text-slate-500'
              }`}>
                {ag.num}
              </span>

              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? ag.color : 'text-slate-500'}`} />
                  <span className="leading-none">{ag.name}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-normal leading-none mt-0.5 hidden md:block">
                  {ag.persona}
                </div>
              </div>

              {isLoading && isActive ? (
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              ) : (
                <CheckCircle2 className={`w-3 h-3 ${isActive ? 'text-emerald-400' : 'text-slate-600'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

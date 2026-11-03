import { NAV_LABELS } from "./CommunityWelcome";
// Full-page compositions for the Islamic redesign: the app shell and its three modes.
// Built from the app's real components (src/components) plus the design-system patterns
// and ornaments. Structure follows src/App.tsx (header → search → mode tray → mode content → footer).
import React from 'react';
import { Share2, Copy, FileDown, Check, Flame, Award, Users, ShieldCheck, Radio, Plus, UserRound, BookOpen } from 'lucide-react';
import { QuranApp } from './quranApp';
import { QURAN_STRINGS } from './quranI18n';
import { AgentStatusTracker, AgentStep } from '../components/AgentStatusTracker';
import { DashboardVisualization } from '../components/DashboardVisualization';
import { TakhrijView } from '../components/TakhrijView';
import { IsnadDiagram } from '../components/IsnadDiagram';
import { RijalDossier } from '../components/RijalDossier';
import { ShawahidMatnView } from '../components/ShawahidMatnView';
import { ScholarsVerdictMatrix } from '../components/ScholarsVerdictMatrix';
import { HadithSearchForm } from '../components/HadithSearchForm';
import { PodcastScriptPlayer } from '../components/PodcastScriptPlayer';
import { PublicWallFeed } from '../components/PublicWallFeed';
import { TRANSLATIONS, SupportedLanguage } from '../utils/localization';
import { getPurityLevel } from '../utils/gradeUtils';
import { BrandMark, LanguageToggle, ModeCard, Button, ThemeToggle, useTheme } from './patterns';
import { ArchBanner, IlluminatedFrame, StarDivider } from './ornaments';
import { samples } from './samples';
import { CommunityHome, ProfileHeader } from './social';

export type AppMode = 'dossier' | 'studio' | 'wall' | 'quran';

/* ---------- AppHeader ---------- */
export interface HeaderActions { onShare?: () => void; onCopy?: () => void; copied?: boolean; onExport?: () => void; exportLabel?: string; onPrint?: () => void; printLabel?: string; }
export interface AppHeaderProps { language: SupportedLanguage; onLanguage: (l: SupportedLanguage) => void; user?: any; mode?: AppMode; onMode?: (m: AppMode) => void; onMe?: () => void; actions?: HeaderActions; }
export const AppHeader: React.FC<AppHeaderProps> = ({ language, onLanguage, user = samples.user, mode = 'wall', onMode, onMe, actions }) => {
  const [theme, setTheme] = useTheme();
  const t = TRANSLATIONS[language];
  const NAV: Array<[AppMode, string, React.FC<any>]> = [['wall', NAV_LABELS[language].wall, Users], ['quran', NAV_LABELS[language].quran, BookOpen], ['dossier', NAV_LABELS[language].dossier, ShieldCheck], ['studio', NAV_LABELS[language].studio, Radio]];
  const [copied, setCopied] = React.useState(false);
  return (
    <header className="dd-header sticky top-0 z-40 bg-[var(--surface-header)]/90 border-b islamic-gold-border backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 md:h-[72px] flex flex-wrap md:flex-nowrap items-center justify-between gap-3 md:gap-4 py-2 md:py-0">
        <BrandMark tagline="" version="" />
        <nav className="hidden xl:flex items-center gap-1 bg-slate-900/70 border border-slate-700/80 rounded-2xl p-1">
          {NAV.map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => onMode?.(id)} aria-current={mode === id ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 px-3 xl:px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                mode === id ? 'bg-amber-500 text-[var(--on-gold)] shadow-md' : 'text-slate-300 hover:text-white'}`}>
              <Icon className="w-3.5 h-3.5" />{label}

            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle value={theme} onChange={setTheme} />
          <div className="hidden 2xl:block"><LanguageToggle value={language} onChange={onLanguage} /></div>
          <div className="2xl:hidden"><LanguageToggle compact value={language} onChange={onLanguage} /></div>
          <button type="button" onClick={onMe} aria-label="My profile" className="w-9 h-9 rounded-xl flex items-center justify-center border border-amber-500/40 cursor-pointer" style={{ background: 'var(--brand-green)' }}>
            <UserRound className="w-4 h-4" style={{ color: '#eedb9b' }} />
          </button>
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800">
            <img src={user.profile_pic} alt={user.display_name} className="w-8 h-8 rounded-xl object-cover border border-amber-500/40 shadow-sm" />
            <div className={`text-left hidden ${mode === 'dossier' ? '2xl:block' : 'xl:block'}`}>
              <span className="block font-bold text-white text-[11px] leading-tight whitespace-nowrap">{user.display_name}</span>
              <span className="text-[9px] font-mono text-emerald-400">{user.badge}</span>
            </div>
          </div>

        </div>
      </div>
      {mode === 'dossier' && actions && <div className="flex flex-wrap justify-end gap-2 px-3 pb-2">
        {actions.onPrint && <Button variant="secondary" onClick={actions.onPrint}>{actions.printLabel ?? 'Print Report'}</Button>}
        <Button variant="share" onClick={actions.onShare}>Share</Button>
        <Button variant="secondary" onClick={actions.onCopy}>{actions.copied ? "Copied" : "Copy report"}</Button>
        <Button variant="secondary" onClick={actions.onExport}>{actions.exportLabel ?? 'Export JSON'}</Button>
      </div>}
    </header>
  );
};

/* ---------- ModeTray ---------- */
export interface ModeTrayProps { mode: AppMode; onMode: (m: AppMode) => void; language: SupportedLanguage; }
export const ModeTray: React.FC<ModeTrayProps> = ({ mode, onMode, language }) => {
  const t = TRANSLATIONS[language];
  return (
    <nav className="bg-[var(--surface-panel)] border islamic-gold-border rounded-3xl p-3 shadow-2xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ModeCard tone="cyan" icon="wall" tag="HOME" active={mode === 'wall'} title="Community" subtitle="Share, ask and learn the deen with fellow seekers" onClick={() => onMode('wall')} />
        <ModeCard tone="emerald" icon="dossier" tag="VERIFY" active={mode === 'dossier'} title="Verify a Hadith" subtitle={t.tab1Sub} onClick={() => onMode('dossier')} />
        <ModeCard tone="amber" icon="studio" tag="ON AIR" live active={mode === 'studio'} title="Live Studio" subtitle={t.tab2Sub} onClick={() => onMode('studio')} />
      </div>
    </nav>
  );
};


/* ---------- MobileTabBar — the phone's bottom navigation (replaces the header menu below md) ---------- */
export type MobileTab = AppMode | 'share' | 'me';
export interface MobileTabBarProps { mode: AppMode; active?: MobileTab; language?: SupportedLanguage; onSelect: (t: MobileTab) => void; }
export const MobileTabBar: React.FC<MobileTabBarProps> = ({ mode, active, language = "en", onSelect }) => {
  const cur = active ?? mode;
  const items: Array<[MobileTab, string, React.FC<any>]> = [['wall', NAV_LABELS[language].wall, Users], ['quran', NAV_LABELS[language].quran, BookOpen], ['dossier', NAV_LABELS[language].dossier, ShieldCheck], ['studio', NAV_LABELS[language].studio, Radio], ['me', NAV_LABELS[language].me, UserRound]];
  return (
    <nav className="dd-mobile-nav xl:hidden fixed inset-x-0 bottom-0 z-50 border-t islamic-gold-border bg-[var(--surface-header)]/95 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid grid-cols-5 h-16 px-2">
        {items.map(([id, label, Icon]) => id === 'share' ? (
          <div key={id} className="flex items-start justify-center">
            <button type="button" onClick={() => onSelect('share')} aria-label="Share beneficial knowledge"
              className="relative -mt-6 w-16 h-16 flex items-center justify-center cursor-pointer drop-shadow-xl">
              <span className="absolute inset-[7px] rounded-xl" style={{ background: 'linear-gradient(135deg, var(--color-amber-400), var(--color-amber-600))', boxShadow: '0 0 0 3px var(--surface-header)' }} />
              <span className="absolute inset-[7px] rounded-xl rotate-45" style={{ background: 'linear-gradient(135deg, var(--color-amber-400), var(--color-amber-600))', boxShadow: '0 0 0 3px var(--surface-header)' }} />
              <span className="absolute inset-[7px] rounded-xl" style={{ background: 'linear-gradient(135deg, var(--color-amber-400), var(--color-amber-600))' }} />
              <Icon className="relative w-6 h-6 text-[var(--on-gold)]" strokeWidth={2.6} />
            </button>
          </div>
        ) : (
          <button key={id} type="button" onClick={() => onSelect(id)} aria-current={cur === id ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center gap-1 px-1 text-[10px] leading-tight font-semibold cursor-pointer ${cur === id ? 'text-amber-300' : 'text-slate-400'}`}>
            {cur === id && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-amber-400" />}
            <span className="relative">
              <Icon className="w-5 h-5" strokeWidth={cur === id ? 2.4 : 1.8} />

            </span>
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
};

/* ---------- AppFooter ---------- */
export const AppFooter: React.FC = () => (
  <footer className="mt-12 border-t islamic-gold-border bg-[var(--surface-sunken)]/90 pt-10 pb-28 xl:pb-10 text-center space-y-4">
    <div className="max-w-3xl mx-auto px-6 space-y-4">
      <StarDivider />
      <div className="font-arabic text-xl text-amber-300" dir="rtl" lang="ar">رَبِّ زِدْنِي عِلْمًا</div>
      <div className="font-serif italic text-base text-slate-400">“My Lord, increase me in knowledge.” — Ta-Ha 20:114</div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
        <Flame className="w-4 h-4 text-amber-400" />
        <span className="font-bold text-slate-300">Dragon Dawwa</span>
        <span>• Created by Aegis Intelligence Pvt Ltd, Sri Lanka</span>
      </div>
      <p className="text-xs text-slate-400">Operated by Prime Dragon Technologies (Pvt) Ltd</p>
      <p className="max-w-xl mx-auto text-xs leading-5 text-slate-500">
        AI-assisted research is a study aid. Check cited sources and seek qualified human review before relying on a religious conclusion.
      </p>
    </div>
  </footer>
);

/* ---------- VerdictReport — the 'report' step, now inside an IlluminatedFrame ---------- */
export const VerdictReport: React.FC<{ analysis: any }> = ({ analysis }) => {
  const s = analysis.agent_6_synthesis;
  const p = getPurityLevel(s.purity_confidence_score);
  return (
    <IlluminatedFrame title="Executive Synthesis & Academic Verdict" arabicTitle="الحكم">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className={`inline-flex items-center gap-2 text-sm font-bold px-4 py-1.5 rounded-xl border ${p.badgeClass}`}>
            <Award className="w-4 h-4" />{s.final_status}
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-800">
            Score: {s.purity_confidence_score.toFixed(1)}%
          </span>
        </div>
        <div className="font-arabic text-center text-xl text-amber-200" dir="rtl" lang="ar">{p.arabicTitle}</div>
        <div className="space-y-4 text-left">
          {s.executive_report_markdown.split('\n\n').map((para: string, i: number) => (
            <p key={i} className="text-slate-200 leading-relaxed">{para.replace(/^#+\s*/, '').replace(/\*\*/g, '')}</p>
          ))}
        </div>
      </div>
    </IlluminatedFrame>
  );
};

/* ---------- The three pages (content only; the shell wraps them) ---------- */
export interface DossierPageProps { analysis?: any; language?: SupportedLanguage; initialStep?: AgentStep; }
export const DossierPage: React.FC<DossierPageProps> = ({ analysis = samples.analysis, language = 'en', initialStep = 'overview' }) => {
  const [step, setStep] = React.useState<AgentStep>(initialStep);
  return (
    <div className="space-y-6">
      <StarDivider label="تحقيق الحديث" />
      <AgentStatusTracker currentTab={step} onSelectTab={setStep} />
      <div>
        {step === 'overview' && <DashboardVisualization data={analysis} onSelectNarrator={() => setStep('rijal')} />}
        {step === 'takhrij' && <TakhrijView takhrij={analysis.agent_1_takhrij} queryHadith={analysis.query_hadith} />}
        {step === 'isnad' && <IsnadDiagram isnad={analysis.agent_2_isnad} />}
        {step === 'rijal' && <RijalDossier rijal={analysis.agent_3_rijal} />}
        {step === 'shawahid' && <ShawahidMatnView shawahid={analysis.agent_4_shawahid_matn} />}
        {step === 'scholars' && <ScholarsVerdictMatrix verdicts={analysis.agent_5_scholars_verdict} />}
        {step === 'report' && <VerdictReport analysis={analysis} />}
      </div>
    </div>
  );
};

export const StudioPage: React.FC<{ analysis?: any }> = ({ analysis = samples.analysis }) => (
  <div className="space-y-6">
    <StarDivider label="مجلس العلم" />
    <PodcastScriptPlayer script={analysis.agent_6_synthesis.podcast_script} executiveReport={analysis.agent_6_synthesis.executive_report_markdown} />
  </div>
);

export const WallPage: React.FC<{ language?: SupportedLanguage }> = ({ language = 'en' }) => (
  <div className="space-y-6">
    <CommunityHome language={language} />
  </div>
);

/* ---------- DragonDawwaApp — the whole app, every mode, switchable ---------- */
export const BANNERS: Record<AppMode, { title: string; arabic: string; subtitle: string }> = {
  dossier: { title: 'Explore a hadith, understand its sources', arabic: 'طلب العلم فريضة', subtitle: 'Search a narration and explore the research report. AI-assisted findings require source checking and human review.' },
  studio: { title: 'Your listening space', arabic: 'مجلس العلم', subtitle: 'Listen to AI-generated research discussions with Gemini voices. Read the report alongside the conversation.' },
  quran: { title: 'The Noble Quran', arabic: 'القرآن الكريم', subtitle: '' },
  wall: { title: 'The Community of Seekers', arabic: 'منتدى الباحثين', subtitle: 'A gathering to share, ask and learn about the deen — every ayah and hadith cited, every hadith verified.' },
};

export interface DragonDawwaAppProps { initialMode?: AppMode; initialLanguage?: SupportedLanguage; initialStep?: AgentStep; quran?: React.ComponentProps<typeof QuranApp>; }
export const DragonDawwaApp: React.FC<DragonDawwaAppProps> = ({ initialMode = 'wall', initialLanguage = 'en', initialStep = 'overview', quran }) => {
  const [mode, setMode] = React.useState<AppMode>(initialMode);
  const [lang, setLang] = React.useState<SupportedLanguage>(initialLanguage);
  const [tabSel, setTabSel] = React.useState<MobileTab | undefined>(undefined);
  const onTab = (t: MobileTab) => {
    if (t === 'share' || t === 'me') {
      setMode('wall'); setTabSel(t);
      setTimeout(() => {
        const el = document.getElementById(t === 'share' ? 'dd-composer' : 'dd-profile');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (t === 'share') (el?.querySelector('textarea') as HTMLTextAreaElement | null)?.focus();
      }, 50);
    } else { setMode(t); setTabSel(undefined); }
  };
  const preset = samples.presets[0];
  const b = BANNERS[mode];
  return (
    <div className="min-h-screen flex flex-col text-slate-100 selection:bg-amber-500/30">
      <AppHeader language={lang} onLanguage={setLang} mode={mode} onMode={m => { setMode(m); setTabSel(undefined); }} onMe={() => onTab('me')} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 md:py-8 space-y-5 md:space-y-8">
        {mode === 'quran' ? null : mode === 'wall' ? <div id="dd-profile" className="scroll-mt-20"><ProfileHeader /></div> : <ArchBanner compact={mode === 'studio'} title={b.title} arabic={b.arabic} subtitle={b.subtitle} />}
        {mode === 'dossier' && (
          <HadithSearchForm initialMatn={preset.hadith_text} initialIsnad={preset.isnad_text} isAnalyzing={false}
            analysisError={null} onRunEngine={() => {}} currentLanguage={lang} />
        )}
        {mode === 'dossier' && <DossierPage language={lang} initialStep={initialStep} />}
        {mode === 'studio' && <StudioPage />}
        {mode === 'wall' && <WallPage language={lang} />}
        {mode === 'quran' && <QuranApp {...quran} language={lang} />}
      </main>
      <AppFooter />
      <MobileTabBar mode={mode} active={tabSel ?? mode} onSelect={onTab} />
    </div>
  );
};

/**
 * Dragon Dawwa - Enterprise-Grade AI Hadith Deep Search & Authentication Engine
 * Prime Dragon Technologies
 * Dual-Tab Interface Architecture:
 * - TAB 1: Academic Deep Research Dossier (Agents 1-6 Technical Breakdowns)
 * - TAB 2: "Dragon Dawwa Live Studio" Roundtable Audio Script
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  BookOpen, 
  FileDown, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Flame, 
  ShieldCheck, 
  HelpCircle,
  Copy,
  Check,
  Zap,
  ArrowRight,
  Radio,
  FileSpreadsheet,
  Headphones,
  Award,
  Share2
} from 'lucide-react';
import { DragonDawwaAnalysis, SampleHadithPreset } from './types/hadith';
import { SAMPLE_HADITHS } from './data/sampleHadiths';
import { DashboardVisualization } from './components/DashboardVisualization';
import { TakhrijView } from './components/TakhrijView';
import { IsnadDiagram } from './components/IsnadDiagram';
import { RijalDossier } from './components/RijalDossier';
import { ShawahidMatnView } from './components/ShawahidMatnView';
import { ScholarsVerdictMatrix } from './components/ScholarsVerdictMatrix';
import { PodcastScriptPlayer } from './components/PodcastScriptPlayer';
import { AgentStatusTracker, AgentStep } from './components/AgentStatusTracker';
import { ShareModal } from './components/ShareModal';
import { HadithSearchForm } from './components/HadithSearchForm';
import { PublicWallFeed } from './components/PublicWallFeed';
import { WallPost, UserAccount } from './types/wall';
import { INITIAL_WALL_POSTS, CURRENT_DEFAULT_USER } from './data/wallFeedData';
import { SupportedLanguage, SUPPORTED_LANGUAGES, TRANSLATIONS } from './utils/localization';
import { getLocalizedAnalysis } from './utils/localizedAnalysis';

export default function App() {
  // Trilingual system (English, Tamil, Sinhala)
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en');
  const t = TRANSLATIONS[currentLanguage];

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount>(CURRENT_DEFAULT_USER);

  // Public Community Wall Feed Posts State
  const [wallPosts, setWallPosts] = useState<WallPost[]>(INITIAL_WALL_POSTS);

  // Active Search Visibility Toggle (Private vs Public Wall)
  const [isSearchPublic, setIsSearchPublic] = useState<boolean>(true);

  // Default to benchmark #2 (Actions are by Intentions) or #1
  const [selectedPreset, setSelectedPreset] = useState<SampleHadithPreset>(SAMPLE_HADITHS[1]);
  const [hadithInput, setHadithInput] = useState<string>(SAMPLE_HADITHS[1].hadith_text);
  const [isnadInput, setIsnadInput] = useState<string>(SAMPLE_HADITHS[1].isnad_text || '');
  
  const [currentAnalysis, setCurrentAnalysis] = useState<DragonDawwaAnalysis>(SAMPLE_HADITHS[1].defaultData);

  // Dynamically computed analysis reflecting active language (Tamil script when 'ta' is active)
  const displayedAnalysis = React.useMemo(() => {
    return getLocalizedAnalysis(currentAnalysis, currentLanguage);
  }, [currentAnalysis, currentLanguage]);
  
  // Tri-Tab Master Selector: Tab 1 Dossier vs Tab 2 Live Studio vs Tab 3 Public Wall
  const [masterTab, setMasterTab] = useState<'TAB_1_DOSSIER' | 'TAB_2_STUDIO' | 'TAB_3_WALL'>('TAB_1_DOSSIER');
  const [currentDossierStep, setCurrentDossierStep] = useState<AgentStep>('overview');
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Initialize or restore state from URL query parameters (Web Share link recipient support)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const presetParam = params.get('preset');
      const qParam = params.get('q') || params.get('hadith');

      if (presetParam) {
        const found = SAMPLE_HADITHS.find(p => p.id === presetParam);
        if (found) {
          setSelectedPreset(found);
          setHadithInput(found.hadith_text);
          setIsnadInput(found.isnad_text || '');
          setCurrentAnalysis(found.defaultData);
          return;
        }
      }

      if (qParam) {
        setHadithInput(qParam);
        const matching = SAMPLE_HADITHS.find(p => 
          p.hadith_text.toLowerCase().includes(qParam.slice(0, 30).toLowerCase())
        );
        if (matching) {
          setSelectedPreset(matching);
          setIsnadInput(matching.isnad_text || '');
          setCurrentAnalysis(matching.defaultData);
        }
      }
    }
  }, []);

  const handleSelectPreset = (preset: SampleHadithPreset) => {
    setSelectedPreset(preset);
    setHadithInput(preset.hadith_text);
    setIsnadInput(preset.isnad_text || '');
    setCurrentAnalysis(preset.defaultData);
    setAnalysisError(null);

    // Sync URL query without reloading the page for instant link sharing
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('preset', preset.id);
      url.searchParams.delete('q');
      url.searchParams.delete('hadith');
      window.history.replaceState(null, '', url.toString());
    }
  };

  /**
   * Primary Share Handler: Uses Web Share API (navigator.share) on devices/browsers that support it,
   * with automatic graceful fallback to the comprehensive ShareModal.
   */
  const handleShareAction = async () => {
    if (!currentAnalysis) return;

    const url = new URL(typeof window !== 'undefined' ? window.location.href : 'https://dragon-dawwa.app');
    if (selectedPreset?.id) {
      url.searchParams.set('preset', selectedPreset.id);
    } else if (hadithInput) {
      url.searchParams.set('q', hadithInput.slice(0, 80));
    }
    const shareUrl = url.toString();

    const score = currentAnalysis.agent_6_synthesis.purity_confidence_score;
    const status = currentAnalysis.agent_6_synthesis.final_status;
    const title = `Dragon Dawwa: ${status} (${score}%) - Hadith Authentication`;
    const text = `📜 DRAGON DAWWA HADITH REPORT\nAuthenticity: ${status}\nPurity Score: ${score}%\n\n"${currentAnalysis.query_hadith.length > 140 ? currentAnalysis.query_hadith.slice(0, 140) + '...' : currentAnalysis.query_hadith}"\n\nFull 6-agent breakdown:`;

    const shareData = {
      title,
      text,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User dismissed system share sheet
          return;
        }
        console.warn('Web Share API error, opening fallback modal:', err);
      }
    }

    // Open share modal if navigator.share was unavailable or threw non-abort error
    setIsShareModalOpen(true);
  };

  const handleRunAnalysisWithInputs = async (matnToRun?: string, isnadToRun?: string) => {
    const textToRun = matnToRun !== undefined ? matnToRun : hadithInput;
    const chainToRun = isnadToRun !== undefined ? isnadToRun : isnadInput;

    if (!textToRun.trim()) return;

    setHadithInput(textToRun);
    setIsnadInput(chainToRun);
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hadith_input: textToRun,
          isnad_input: chainToRun,
          preferred_language: currentLanguage
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const rawErr = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error || '');
        if (rawErr.includes('503') || rawErr.includes('high demand') || rawErr.includes('UNAVAILABLE')) {
          throw new Error('Notice: Gemini model is currently experiencing temporary high demand on Google servers. Auto-activated resilient failover and scholarly baseline.');
        }
        throw new Error(rawErr || `Server responded with status ${response.status}`);
      }

      const result: DragonDawwaAnalysis = await response.json();
      setCurrentAnalysis(result);
      setCurrentDossierStep('overview');

      // If user selected public publication, push new post to Public Wall
      if (isSearchPublic) {
        const newPost: WallPost = {
          post_id: `post_wall_${Date.now()}`,
          search_id: `search_${Date.now()}`,
          author_id: currentUser.user_id,
          author_name: currentUser.display_name,
          author_email: currentUser.email,
          author_avatar: currentUser.profile_pic,
          author_role: currentUser.badge || 'Research Scholar',
          query_text: result.query_hadith,
          canonical_arabic: result.agent_1_takhrij.sources?.[0]?.exact_wording_arabic || result.agent_1_takhrij.sources?.[0]?.exact_wording || '',
          isnad_preview: result.agent_2_isnad.narrator_sequence.slice(0, 4).join(' -> ') + '...',
          purity_score: result.agent_6_synthesis.purity_confidence_score,
          final_status: result.agent_6_synthesis.final_status,
          consensus_summary: result.agent_6_synthesis.consensus_and_disagreements || 'Verified via Kutub al-Sittah',
          is_public: true,
          likes_count: 1,
          comments_count: 0,
          user_has_liked: true,
          tags: ["Live Investigation", "Community Feed"],
          created_at: new Date().toISOString(),
          full_analysis_payload: result,
          comments: []
        };
        setWallPosts(prev => [newPost, ...prev]);
      }
    } catch (err: any) {
      console.warn('API query encountered an issue; falling back gracefully:', err);
      const rawMsg = err.message || '';
      if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
        setAnalysisError('Notice: Gemini model is experiencing temporary high demand on Google servers. Resilient failover engaged with complete 6-agent scholarly analysis.');
      } else {
        setAnalysisError(rawMsg || 'Error executing live deep search. Showing curated scholarly baseline.');
      }
      // Check if input matches any preset
      const matchingPreset = SAMPLE_HADITHS.find((p) =>
        p.hadith_text.toLowerCase().includes(textToRun.slice(0, 30).toLowerCase())
      );
      if (matchingPreset) {
        setCurrentAnalysis(matchingPreset.defaultData);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLikePost = (postId: string) => {
    setWallPosts(prev => prev.map(post => {
      if (post.post_id === postId) {
        const hasLiked = post.user_has_liked;
        return {
          ...post,
          user_has_liked: !hasLiked,
          likes_count: hasLiked ? Math.max(0, post.likes_count - 1) : post.likes_count + 1
        };
      }
      return post;
    }));
  };

  const handleAddComment = (postId: string, commentText: string) => {
    if (!commentText.trim()) return;
    const newComment = {
      comment_id: `comm_${Date.now()}`,
      post_id: postId,
      author_id: currentUser.user_id,
      author_name: currentUser.display_name,
      author_avatar: currentUser.profile_pic,
      author_role: currentUser.badge || 'Research Scholar',
      text: commentText.trim(),
      language: currentLanguage,
      created_at: new Date().toISOString(),
      likes: 0
    };

    setWallPosts(prev => prev.map(post => {
      if (post.post_id === postId) {
        return {
          ...post,
          comments_count: post.comments_count + 1,
          comments: [...post.comments, newComment]
        };
      }
      return post;
    }));
  };

  const handleSelectPostForAnalysis = (post: WallPost) => {
    setHadithInput(post.query_text);
    setIsnadInput(post.isnad_preview || '');
    setCurrentAnalysis(post.full_analysis_payload);
    setMasterTab('TAB_1_DOSSIER');
    setCurrentDossierStep('overview');
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  const handlePublishCurrentSearch = () => {
    if (!currentAnalysis) return;
    setIsSearchPublic(true);
    // Check if already in wallPosts
    const alreadyPosted = wallPosts.some(p => p.query_text === currentAnalysis.query_hadith);
    if (!alreadyPosted) {
      const newPost: WallPost = {
        post_id: `post_wall_${Date.now()}`,
        search_id: `search_${Date.now()}`,
        author_id: currentUser.user_id,
        author_name: currentUser.display_name,
        author_email: currentUser.email,
        author_avatar: currentUser.profile_pic,
        author_role: currentUser.badge || 'Lead Authentication Officer',
        query_text: currentAnalysis.query_hadith,
        canonical_arabic: currentAnalysis.agent_1_takhrij.sources?.[0]?.exact_wording_arabic || currentAnalysis.agent_1_takhrij.sources?.[0]?.exact_wording || '',
        isnad_preview: currentAnalysis.agent_2_isnad.narrator_sequence.slice(0, 4).join(' -> ') + '...',
        purity_score: currentAnalysis.agent_6_synthesis.purity_confidence_score,
        final_status: currentAnalysis.agent_6_synthesis.final_status,
        consensus_summary: currentAnalysis.agent_6_synthesis.consensus_and_disagreements,
        is_public: true,
        likes_count: 1,
        comments_count: 0,
        user_has_liked: true,
        tags: ["Published by " + currentUser.display_name, "Verified"],
        created_at: new Date().toISOString(),
        full_analysis_payload: currentAnalysis,
        comments: []
      };
      setWallPosts(prev => [newPost, ...prev]);
    }
    setMasterTab('TAB_3_WALL');
  };

  const handleClearInputs = () => {
    setHadithInput('');
    setIsnadInput('');
    setAnalysisError(null);
  };

  const handleSelectBenchmarkById = (benchmarkId: string) => {
    // Map benchmarkId to SAMPLE_HADITHS preset if exists
    const presetMap: Record<string, string> = {
      saturday_fast: 'hadith_fast_saturday',
      intentions: 'hadith_intentions',
      china_knowledge: 'hadith_china_knowledge',
    };
    const mappedId = presetMap[benchmarkId] || benchmarkId;
    const foundPreset = SAMPLE_HADITHS.find(p => p.id === mappedId);
    if (foundPreset) {
      handleSelectPreset(foundPreset);
    }
  };

  const handleCopyReport = () => {
    if (!currentAnalysis) return;
    const text = `# DRAGON DAWWA AUTHENTICATION REPORT
Status: ${currentAnalysis.agent_6_synthesis.final_status}
Purity Confidence Score: ${currentAnalysis.agent_6_synthesis.purity_confidence_score}%

${currentAnalysis.agent_6_synthesis.executive_report_markdown}

---
PODCAST SCRIPT:
${currentAnalysis.agent_6_synthesis.podcast_script}`;

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleExportJSON = () => {
    if (!currentAnalysis) return;
    const blob = new Blob([JSON.stringify(currentAnalysis, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dragon-dawwa-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#060a0f] text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#080d14]/90 border-b border-slate-800/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-emerald-600 to-slate-900 p-0.5 shadow-lg shadow-amber-500/10 flex items-center justify-center">
              <div className="w-full h-full bg-[#080d14] rounded-[10px] flex items-center justify-center">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white font-display">
                  DRAGON DAWWA
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-600/40">
                  v2.5 Enterprise Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Prime Dragon Technologies • Hadith Deep Search & Authentication
              </p>
            </div>
          </div>

          {/* Action Header Buttons & Language Selector */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Trilingual Language Selector (English | Tamil | Sinhala) */}
            <div className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-1 text-xs">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setCurrentLanguage(lang.code)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                    currentLanguage === lang.code
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={lang.nativeLabel}
                >
                  <span className="text-[11px]">{lang.flag}</span>
                  <span className="hidden sm:inline">{lang.nativeLabel}</span>
                  <span className="sm:hidden uppercase">{lang.code}</span>
                </button>
              ))}
            </div>

            {/* User Profile Badge (Google OAuth Authenticated) */}
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-800">
              <img
                src={currentUser.profile_pic}
                alt={currentUser.display_name}
                className="w-8 h-8 rounded-xl object-cover border border-amber-500/40 shadow-sm"
              />
              <div className="text-left text-xs">
                <span className="block font-bold text-white text-[11px] leading-tight">
                  {currentUser.display_name}
                </span>
                <span className="text-[9px] font-mono text-emerald-400">
                  {currentUser.badge}
                </span>
              </div>
            </div>

            {/* Web Share API & Share Modal Button */}
            <button
              type="button"
              onClick={handleShareAction}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-amber-500/15 hover:from-amber-500/25 hover:to-emerald-500/25 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer shadow-md shadow-amber-500/10"
              title="Share report via device (Web Share API) or copy link"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Share</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied Report</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Report</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportJSON}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Unified Benchmark Dossiers and Hadith Deep Search Form with Clear Inputs & Fuzzy Normalization */}
        <HadithSearchForm
          initialMatn={hadithInput}
          initialIsnad={isnadInput}
          isAnalyzing={isAnalyzing}
          analysisError={analysisError}
          onRunEngine={(matn, isnad) => handleRunAnalysisWithInputs(matn, isnad)}
          onClearInputs={handleClearInputs}
          onSelectBenchmark={handleSelectBenchmarkById}
          currentLanguage={currentLanguage}
        />

        {/* =========================================================================
            MASTER TRI-TAB INTERFACE SELECTOR (TAB 1 VS TAB 2 VS TAB 3)
            ========================================================================= */}
        <div className="bg-[#0b1219] border border-slate-800 rounded-3xl p-3 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* TAB 1: ACADEMIC DEEP RESEARCH DOSSIER */}
            <button
              type="button"
              onClick={() => setMasterTab('TAB_1_DOSSIER')}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer ${
                masterTab === 'TAB_1_DOSSIER'
                  ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-emerald-500/70 shadow-xl ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border shrink-0 ${
                  masterTab === 'TAB_1_DOSSIER'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60 shadow-lg'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      TAB 1
                    </span>
                    <h3 className="text-xs sm:text-sm font-extrabold text-white">
                      {t.tab1Name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    {t.tab1Sub}
                  </p>
                </div>
              </div>
            </button>

            {/* TAB 2: DRAGON DAWWA LIVE STUDIO ROUNDTABLE */}
            <button
              type="button"
              onClick={() => setMasterTab('TAB_2_STUDIO')}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer ${
                masterTab === 'TAB_2_STUDIO'
                  ? 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border-amber-500/70 shadow-xl ring-1 ring-amber-500/30'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border shrink-0 ${
                  masterTab === 'TAB_2_STUDIO'
                    ? 'bg-amber-950 text-amber-300 border-amber-500/60 shadow-lg'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  <Radio className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                      TAB 2 • ON AIR
                    </span>
                    <h3 className="text-xs sm:text-sm font-extrabold text-white">
                      {t.tab2Name}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    {t.tab2Sub}
                  </p>
                </div>
              </div>
            </button>

            {/* TAB 3: PUBLIC COMMUNITY WALL FEEDS */}
            <button
              type="button"
              onClick={() => setMasterTab('TAB_3_WALL')}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer ${
                masterTab === 'TAB_3_WALL'
                  ? 'bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-900 border-cyan-500/70 shadow-xl ring-1 ring-cyan-500/30'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border shrink-0 ${
                  masterTab === 'TAB_3_WALL'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60 shadow-lg'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
                      TAB 3 • FEED ({wallPosts.length})
                    </span>
                    <h3 className="text-xs sm:text-sm font-extrabold text-white">
                      {t.tabWallName}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                    {t.tabWallSub}
                  </p>
                </div>
              </div>
            </button>

          </div>
        </div>

        {/* =========================================================================
            TAB CONTENT RENDERING
            ========================================================================= */}

        {masterTab === 'TAB_1_DOSSIER' ? (
          <div className="space-y-6">
            
            {/* Agent Navigation Tracker for Tab 1 */}
            <AgentStatusTracker
              currentTab={currentDossierStep}
              onSelectTab={setCurrentDossierStep}
              isLoading={isAnalyzing}
            />

            {/* Dossier Step View */}
            <div className="transition-all duration-300">
              {currentDossierStep === 'overview' && (
                <DashboardVisualization
                  data={displayedAnalysis}
                  onSelectNarrator={() => setCurrentDossierStep('rijal')}
                  onShare={handleShareAction}
                />
              )}

              {currentDossierStep === 'takhrij' && (
                <TakhrijView
                  takhrij={displayedAnalysis.agent_1_takhrij}
                  queryHadith={displayedAnalysis.query_hadith}
                />
              )}

              {currentDossierStep === 'isnad' && (
                <IsnadDiagram isnad={displayedAnalysis.agent_2_isnad} />
              )}

              {currentDossierStep === 'rijal' && (
                <RijalDossier rijal={displayedAnalysis.agent_3_rijal} />
              )}

              {currentDossierStep === 'shawahid' && (
                <ShawahidMatnView shawahid={displayedAnalysis.agent_4_shawahid_matn} />
              )}

              {currentDossierStep === 'scholars' && (
                <ScholarsVerdictMatrix verdicts={displayedAnalysis.agent_5_scholars_verdict} />
              )}

              {currentDossierStep === 'report' && (
                <div className="bg-[#0b1219] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                  <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-xl font-bold text-white flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-400" />
                        Executive Synthesis & Academic Verdict
                      </h4>
                      <p className="text-xs text-slate-400">Authored by Dragon Dawwa Chief Authentication Officer</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-xl border border-emerald-800">
                      Score: {displayedAnalysis.agent_6_synthesis.purity_confidence_score.toFixed(1)}%
                    </span>
                  </div>

                  <div className="prose prose-invert max-w-none space-y-4 text-slate-300 text-sm leading-relaxed">
                    {displayedAnalysis.agent_6_synthesis.executive_report_markdown.split('\n\n').map((paragraph, idx) => (
                      <p key={idx} className="text-slate-200 leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : masterTab === 'TAB_2_STUDIO' ? (
          /* TAB 2: DRAGON DAWWA LIVE STUDIO ROUNDTABLE BROADCAST */
          <div className="space-y-6">
            <PodcastScriptPlayer
              script={displayedAnalysis.agent_6_synthesis.podcast_script}
              executiveReport={displayedAnalysis.agent_6_synthesis.executive_report_markdown}
              onShare={handleShareAction}
            />
          </div>
        ) : (
          /* TAB 3: PUBLIC COMMUNITY WALL FEED & DISCUSSIONS */
          <div className="space-y-6">
            <PublicWallFeed
              posts={wallPosts}
              currentLanguage={currentLanguage}
              currentUser={currentUser}
              onLikePost={handleLikePost}
              onAddComment={handleAddComment}
              onSelectPostForAnalysis={handleSelectPostForAnalysis}
              onSharePost={(post) => {
                handleShareAction();
              }}
              currentSearchPost={wallPosts.find(p => p.query_text === displayedAnalysis.query_hadith) || null}
              onPublishCurrentSearch={handlePublishCurrentSearch}
            />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070b10] py-8 text-center text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-slate-400">Dragon Dawwa</span>
          <span>• Developed under Prime Dragon Technologies</span>
        </div>
        <p className="max-w-xl mx-auto text-slate-600 px-4">
          Rigorous Hadith deep search adheres to classical Jarh wa Ta'dil standards, verified against Tahdhib al-Kamal, Mizan al-I'tidal, and Kutub al-Sittah.
        </p>
      </footer>

      {/* Web Share API & Link Sharing Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        analysis={currentAnalysis}
        presetId={selectedPreset?.id}
        presetTitle={selectedPreset?.title}
      />
    </div>
  );
}

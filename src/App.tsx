/**
 * Dragon Dawwa - Enterprise-Grade AI Hadith Deep Search & Authentication Engine
 * Prime Dragon Technologies
 * Islamic redesign (Night Masjid / Mushaf themes) — four modes:
 * - Community: the religious social platform (home), with the live verified-hadith feed
 * - Quran: Home, the Mushaf e-book, Search, Ayah Study and My Quran (Quran.ai reader standard)
 * - Verify a Hadith: the six-agent dossier (Agents 1-6)
 * - Live Studio: the roundtable audio script
 * Design system: src/ds (see src/ds/README.md).
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
  Share2,
  Printer
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
import { PrintDossierReport } from './components/PrintDossierReport';
import { WallPost, UserAccount } from './types/wall';
import { INITIAL_WALL_POSTS, CURRENT_DEFAULT_USER } from './data/wallFeedData';
import { SupportedLanguage, SUPPORTED_LANGUAGES, TRANSLATIONS } from './utils/localization';
import { getLocalizedAnalysis } from './utils/localizedAnalysis';
import { AppHeader, AppFooter, MobileTabBar, MobileTab, AppMode, VerdictReport, BANNERS } from './ds/pages';
import { ArchBanner, StarDivider } from './ds/ornaments';
import { ProfileHeader, CommunityHome } from './ds/social';
import { QuranApp } from './ds/quranApp';

export default function App() {
  // Trilingual system (English, Tamil, Sinhala)
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('en');
  const t = TRANSLATIONS[currentLanguage];

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setCurrentLanguage(newLang);
    // Also adapt active Hadith Matn input if user is viewing or researching one of the benchmark Hadiths
    const lower = (hadithInput || '').toLowerCase();
    if (lower.includes('intention') || lower.includes('ක්‍රියා') || lower.includes('චේතනා') || lower.includes('செயல்') || lower.includes('எண்ணம்') || lower.includes("a'mal") || lower.includes('niyyat')) {
      if (newLang === 'si') {
        setHadithInput("ක්‍රියාවන් සියල්ල චේතනාවන් මත රඳා පවතී. සෑම මිනිසෙකුටම ඔහු චේතනා කළ දේ පමණක් හිමි වේ. කෙනෙකුගේ හිජ්රතය අල්ලාහ් සහ ඔහුගේ රසූල්වරයා වෙනුවෙන් වී නම්...");
      } else if (newLang === 'ta') {
        setHadithInput("செயல்கள் அனைத்தும் எண்ணங்களைப் பொறுத்தே அமைகின்றன; ஒவ்வொரு மனிதனுக்கும் அவன் எண்ணியதே கிடைக்கிறது...");
      } else {
        setHadithInput(SAMPLE_HADITHS[1].hadith_text);
      }
    } else if (lower.includes('saturday') || lower.includes('සෙනසුරාදා') || lower.includes('சனிக்கிழமை') || lower.includes('sabt') || lower.includes('fast')) {
      if (newLang === 'si') {
        setHadithInput("ඔබට අනිවාර්ය කරන ලද උපවාස හැර සෙනසුරාදා දිනවල උපවාසයේ නොයෙදෙන්න; ඔබගෙන් කෙනෙකුට මිදි ලෙල්ලක් හෝ ගසක අත්තක් හැර අන් කිසිවක් හමු නොවන්නේ නම්, ඔහු එය හෝ හපනු ලැබේවා.");
      } else if (newLang === 'ta') {
        setHadithInput("கடமையாக்கப்பட்ட நோன்பைத் தவிர வேறு எதற்காகவும் சனிக்கிழமை நோன்பு நோற்காதீர்கள்; ஒரு திராட்சைத் தோல் அல்லது மரத்தின் கிளையைத் தவிர வேறெதுவும் கிடைக்காவிட்டாலும் அதனை மென்று விடவும்.");
      } else {
        setHadithInput(SAMPLE_HADITHS[0].hadith_text);
      }
    } else if (lower.includes('china') || lower.includes('චීනය') || lower.includes('சீனா') || lower.includes('knowledge') || lower.includes('දැනුම') || lower.includes('கல்வி')) {
      if (newLang === 'si') {
        setHadithInput("චීනයට ගොස් හෝ දැනුම සොයන්න, මන්ද දැනුම සෙවීම සෑම මුස්ලිම්වරයෙකුටම අනිවාර්ය වේ.");
      } else if (newLang === 'ta') {
        setHadithInput("சீனா சென்றேனும் கல்வி கற்க; ஏனெனில் கல்வி தேடுவது ஒவ்வொரு முஸ்லிமுக்கும் கடமையாகும்.");
      } else {
        setHadithInput(SAMPLE_HADITHS[2].hadith_text);
      }
    }
  };

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
  
  // App mode: Community (home) · Quran · Verify a Hadith · Live Studio
  const [mode, setMode] = useState<AppMode>('wall');
  const [mobileTab, setMobileTab] = useState<MobileTab | undefined>(undefined);
  // re-opens Community on the verified-hadith tab after publishing a search
  const [wallView, setWallView] = useState<{ key: number; tab: 'foryou' | 'verified' }>({ key: 0, tab: 'foryou' });
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
    
    // Adapt Hadith matn to active language
    if (currentLanguage === 'si') {
      if (preset.id === 'actions-by-intentions') {
        setHadithInput("ක්‍රියාවන් සියල්ල චේතනාවන් මත රඳා පවතී. සෑම මිනිසෙකුටම ඔහු චේතනා කළ දේ පමණක් හිමි වේ. කෙනෙකුගේ හිජ්රතය අල්ලාහ් සහ ඔහුගේ රසූල්වරයා වෙනුවෙන් වී නම්...");
      } else if (preset.id === 'saturday-fasting') {
        setHadithInput("ඔබට අනිවාර්ය කරන ලද උපවාස හැර සෙනසුරාදා දිනවල උපවාසයේ නොයෙදෙන්න; ඔබගෙන් කෙනෙකුට මිදි ලෙල්ලක් හෝ ගසක අත්තක් හැර අන් කිසිවක් හමු නොවන්නේ නම්, ඔහු එය හෝ හපනු ලැබේවා.");
      } else if (preset.id === 'seek-knowledge-china') {
        setHadithInput("චීනයට ගොස් හෝ දැනුම සොයන්න, මන්ද දැනුම සෙවීම සෑම මුස්ලිම්වරයෙකුටම අනිවාර්ය වේ.");
      } else {
        setHadithInput(preset.hadith_text);
      }
    } else if (currentLanguage === 'ta') {
      if (preset.id === 'actions-by-intentions') {
        setHadithInput("செயல்கள் அனைத்தும் எண்ணங்களைப் பொறுத்தே அமைகின்றன; ஒவ்வொரு மனிதனுக்கும் அவன் எண்ணியதே கிடைக்கிறது...");
      } else if (preset.id === 'saturday-fasting') {
        setHadithInput("கடமையாக்கப்பட்ட நோன்பைத் தவிர வேறு எதற்காகவும் சனிக்கிழமை நோன்பு நோற்காதீர்கள்; ஒரு திராட்சைத் தோல் அல்லது மரத்தின் கிளையைத் தவிர வேறெதுவும் கிடைக்காவிட்டாலும் அதனை மென்று விடவும்.");
      } else if (preset.id === 'seek-knowledge-china') {
        setHadithInput("சீனா சென்றேனும் கல்வி கற்க; ஏனெனில் கல்வி தேடுவது ஒவ்வொரு முஸ்லிமுக்கும் கடமையாகும்.");
      } else {
        setHadithInput(preset.hadith_text);
      }
    } else {
      setHadithInput(preset.hadith_text);
    }

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
        signal: AbortSignal.timeout(180000),
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
          throw new Error('Gemini is temporarily unavailable. Please retry.');
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
      setAnalysisError(err.name === 'TimeoutError'
        ? 'Research timed out. Please retry.'
        : err.message || 'Live research failed. Please retry.');
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
    setMode('dossier');
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
    setMode('wall');
    setWallView(v => ({ key: v.key + 1, tab: 'verified' }));
  };

  const handleClearInputs = () => {
    setHadithInput('');
    setIsnadInput('');
    setAnalysisError(null);
  };

  const handleSelectBenchmarkById = (benchmarkId: string) => {
    // Map benchmarkId to SAMPLE_HADITHS preset if exists
    const presetMap: Record<string, string> = {
      saturday_fast: 'saturday-fasting',
      'saturday-fasting': 'saturday-fasting',
      intentions: 'actions-by-intentions',
      'actions-by-intentions': 'actions-by-intentions',
      china_knowledge: 'seek-knowledge-china',
      'seek-knowledge-china': 'seek-knowledge-china',
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
Version: ${currentAnalysis.version || "2.5 Enterprise Engine"}
Platform Owner: ${currentAnalysis.platform_owner || "Prime Dragon Technologies (Pvt) Ltd"}
Engineered & Created by: ${currentAnalysis.designed_and_created_by || "Aegis Intelligence Pvt Ltd, Sri Lanka"}
Status: ${currentAnalysis.agent_6_synthesis.final_status}
Purity Confidence Score: ${currentAnalysis.agent_6_synthesis.purity_confidence_score}%

${currentAnalysis.agent_6_synthesis.executive_report_markdown}

---
PODCAST SCRIPT:
${currentAnalysis.agent_6_synthesis.podcast_script}

---
Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies`;

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

  const handlePrintReport = () => window.print();
  const printReportLabel = { en: 'Print Report', ta: 'அறிக்கையை அச்சிடுக', si: 'වාර්තාව මුද්‍රණය' }[currentLanguage];

  const goMode = (m: AppMode) => { setMode(m); setMobileTab(undefined); };
  const onMobileTab = (tab: MobileTab) => {
    if (tab === 'share' || tab === 'me') {
      setMode('wall'); setMobileTab(tab);
      setTimeout(() => {
        const el = document.getElementById(tab === 'share' ? 'dd-composer' : 'dd-profile');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (tab === 'share') (el?.querySelector('textarea') as HTMLTextAreaElement | null)?.focus();
      }, 50);
    } else goMode(tab);
  };
  const banner = BANNERS[mode];

  return (
    <>
    <div className="screen-only min-h-screen flex flex-col bg-[var(--surface-app)] text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
      <AppHeader
        language={currentLanguage}
        onLanguage={handleLanguageChange}
        user={currentUser}
        mode={mode}
        onMode={goMode}
        onMe={() => onMobileTab('me')}
        actions={{ onShare: handleShareAction, onCopy: handleCopyReport, copied: copiedReport, onExport: handleExportJSON, exportLabel: 'Export JSON', onPrint: handlePrintReport, printLabel: printReportLabel }}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 md:py-8 space-y-5 md:space-y-8">
        {mode === 'wall' && <div id="dd-profile" className="scroll-mt-20"><ProfileHeader name={currentUser.display_name} photo={currentUser.profile_pic} /></div>}
        {(mode === 'dossier' || mode === 'studio') && (
          <ArchBanner compact={mode === 'studio'} title={banner.title} arabic={banner.arabic} subtitle={banner.subtitle} />
        )}

        {mode === 'dossier' && (
          <>
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
            <div className="space-y-6">
              <StarDivider label="تحقيق الحديث" />
              <AgentStatusTracker currentTab={currentDossierStep} onSelectTab={setCurrentDossierStep} isLoading={isAnalyzing} />
              <div className="transition-all duration-300">
                {currentDossierStep === 'overview' && (
                  <DashboardVisualization currentLanguage={currentLanguage} data={displayedAnalysis} onSelectNarrator={() => setCurrentDossierStep('rijal')} onShare={handleShareAction} />
                )}
                {currentDossierStep === 'takhrij' && <TakhrijView takhrij={displayedAnalysis.agent_1_takhrij} queryHadith={displayedAnalysis.query_hadith} />}
                {currentDossierStep === 'isnad' && <IsnadDiagram isnad={displayedAnalysis.agent_2_isnad} />}
                {currentDossierStep === 'rijal' && <RijalDossier rijal={displayedAnalysis.agent_3_rijal} />}
                {currentDossierStep === 'shawahid' && <ShawahidMatnView shawahid={displayedAnalysis.agent_4_shawahid_matn} />}
                {currentDossierStep === 'scholars' && <ScholarsVerdictMatrix verdicts={displayedAnalysis.agent_5_scholars_verdict} />}
                {currentDossierStep === 'report' && <VerdictReport analysis={displayedAnalysis} />}
              </div>
            </div>
          </>
        )}

        {mode === 'studio' && (
          <div className="space-y-6">
            <StarDivider label="مجلس العلم" />
            <PodcastScriptPlayer
              script={displayedAnalysis.agent_6_synthesis.podcast_script}
              executiveReport={displayedAnalysis.agent_6_synthesis.executive_report_markdown}
              onShare={handleShareAction}
            />
          </div>
        )}

        {mode === 'wall' && (
          <CommunityHome
            key={wallView.key}
            initialTab={wallView.tab}
            language={currentLanguage}
            verifiedFeed={
              <PublicWallFeed
                posts={wallPosts}
                currentLanguage={currentLanguage}
                currentUser={currentUser}
                onLikePost={handleLikePost}
                onAddComment={handleAddComment}
                onSelectPostForAnalysis={handleSelectPostForAnalysis}
                onSharePost={() => handleShareAction()}
                currentSearchPost={wallPosts.find(p => p.query_text === displayedAnalysis.query_hadith) || null}
                onPublishCurrentSearch={handlePublishCurrentSearch}
              />
            }
          />
        )}

        {mode === 'quran' && <QuranApp language={currentLanguage} dataUrl="/data/quran-en.json" />}
      </main>

      <AppFooter />
      <MobileTabBar mode={mode} active={mobileTab ?? mode} onSelect={onMobileTab} />

      {/* Web Share API & Link Sharing Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        analysis={currentAnalysis}
        presetId={selectedPreset?.id}
        presetTitle={selectedPreset?.title}
      />
    </div>

    {/* =========================================================================
        PDF-READY PRINTABLE DOSSIER REPORT (ONLY ACTIVE IN PRINT / PDF PREVIEW)
        ========================================================================= */}
    <div className="print-only hidden print:block">
      <PrintDossierReport
        analysis={displayedAnalysis}
        currentUser={currentUser}
        currentLanguage={currentLanguage}
      />
    </div>
  </>
  );
}

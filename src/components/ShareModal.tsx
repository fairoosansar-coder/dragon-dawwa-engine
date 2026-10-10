import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  X, 
  Copy, 
  Check, 
  Smartphone, 
  ExternalLink, 
  MessageCircle, 
  Send, 
  Mail, 
  Sparkles,
  Award,
  Globe,
  FileText,
  ShieldCheck,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { DragonDawwaAnalysis } from '../types/hadith';
import { getPurityLevel } from '../utils/gradeUtils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: DragonDawwaAnalysis;
  presetId?: string;
  presetTitle?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  analysis,
  presetId,
  presetTitle
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [shareMode, setShareMode] = useState<'summary' | 'link'>('summary');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isWebShareSupported, setIsWebShareSupported] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setIsWebShareSupported(true);
    }
  }, []);

  if (!isOpen || !analysis) return null;

  const score = analysis.agent_6_synthesis.purity_confidence_score;
  const status = analysis.agent_6_synthesis.final_status;
  const purityMeta = getPurityLevel(score);

  // Generate canonical sharable URL
  const getSharableUrl = () => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.origin + window.location.pathname);
    if (presetId) {
      url.searchParams.set('preset', presetId);
    } else if (analysis.query_hadith) {
      // Use clean snippet for query
      url.searchParams.set('q', analysis.query_hadith.slice(0, 80));
    }
    return url.toString();
  };

  const shareUrl = getSharableUrl();

  // Generate formatted Hadith summary text for sharing
  const generateShareSummary = () => {
    const sources = analysis.agent_1_takhrij.sources
      .slice(0, 3)
      .map(s => `${s.collection} (#${s.hadith_number})`)
      .join(', ');

    const narratorsCount = analysis.agent_3_rijal.narrators.length;
    const chainStatus = analysis.agent_2_isnad.overall_chain_status;

    return `📜 DRAGON DAWWA HADITH AUTHENTICATION REPORT
Version: ${analysis.version || '2.5 Enterprise Engine'}
Engineered by: ${analysis.designed_and_created_by || 'Aegis Intelligence Pvt Ltd, Sri Lanka'}
Authenticity: ${status}
Purity Confidence Score: ${score}% (${purityMeta.title})

📖 Text:
"${analysis.query_hadith.length > 150 ? analysis.query_hadith.slice(0, 150) + '...' : analysis.query_hadith}"

📚 Primary Sources:
${sources}${analysis.agent_1_takhrij.sources.length > 3 ? ` + ${analysis.agent_1_takhrij.sources.length - 3} more` : ''}

🔗 Chain Status: ${chainStatus} (${narratorsCount} transmitters verified)

⚖️ Scholars Verdict:
${analysis.agent_6_synthesis.consensus_and_disagreements.slice(0, 140)}...

Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies
Explore the full 6-agent deep research dossier & podcast roundtable:
${shareUrl}`;
  };

  const summaryText = generateShareSummary();
  const shareTitle = `Dragon Dawwa: ${status} (${score}%) - Hadith Authentication`;

  // Native Web Share API trigger
  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      handleCopyLink();
      return;
    }

    const shareData = {
      title: shareTitle,
      text: shareMode === 'summary' ? summaryText : `Dragon Dawwa Hadith Authentication Report: ${status} (${score}%)`,
      url: shareUrl,
    };

    try {
      if (navigator.canShare && !navigator.canShare(shareData)) {
        // Fall back if data format not fully supported
        await navigator.share({
          title: shareTitle,
          url: shareUrl
        });
      } else {
        await navigator.share(shareData);
      }
      setFeedbackMessage('Shared successfully via device!');
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User dismissed sheet
        return;
      }
      console.warn('Native share error, falling back to clipboard:', err);
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setFeedbackMessage('Sharable link copied to clipboard!');
    setTimeout(() => {
      setCopiedLink(false);
      setFeedbackMessage(null);
    }, 2500);
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setFeedbackMessage('Full executive summary copied to clipboard!');
    setTimeout(() => {
      setCopiedSummary(false);
      setFeedbackMessage(null);
    }, 2500);
  };

  // Social direct link handlers
  const encodedText = encodeURIComponent(
    shareMode === 'summary' 
      ? summaryText 
      : `Check out this Hadith Authentication report on Dragon Dawwa: ${status} (${score}% purity score)\n\n${shareUrl}`
  );
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Hadith Authentication: ${status} (${score}%) via Dragon Dawwa Engine`)}&url=${encodedUrl}`;
  const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(`Hadith Authentication Report: ${status} (${score}%)`)}`;
  const emailUrl = `mailto:?subject=${encodedTitle}&body=${encodedText}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative z-10 w-full max-w-xl bg-[#0b1219] border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden space-y-5 max-h-[92vh] flex flex-col">
        
        {/* Glow effect */}
        <div 
          className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl opacity-10 pointer-events-none"
          style={{ backgroundColor: purityMeta.colorHex }}
        />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                Share Authentication Dossier
              </h3>
              <p className="text-xs text-slate-400">
                Web Share API & Device Integration
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="space-y-5 overflow-y-auto pr-1">

          {/* Feedback Toast */}
          {feedbackMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
          )}

          {/* Dossier Preview Snippet */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-300">
                  {presetTitle || 'Hadith Authentication Dossier'}
                </span>
              </div>
              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${purityMeta.badgeClass}`}>
                {score >= 75 ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : score >= 45 ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>{score}% {purityMeta.title}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 line-clamp-2 italic font-serif">
              "{analysis.query_hadith}"
            </p>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {analysis.agent_1_takhrij.sources.length} Sources
              </span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {analysis.agent_3_rijal.narrators.length} Transmitters
              </span>
              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {analysis.agent_2_isnad.overall_chain_status}
              </span>
            </div>
          </div>

          {/* Mode Selector Toggle */}
          <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setShareMode('summary')}
              className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                shareMode === 'summary'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Full Summary & Link</span>
            </button>
            <button
              type="button"
              onClick={() => setShareMode('link')}
              className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                shareMode === 'link'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Direct Link Only</span>
            </button>
          </div>

          {/* PRIMARY ACTION: Web Share API Button */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 hover:from-amber-400 hover:to-emerald-300 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/20 transition-all cursor-pointer transform active:scale-[0.99]"
            >
              <Smartphone className="w-5 h-5 fill-slate-950" />
              <span>
                {isWebShareSupported ? 'Share via Device (Web Share API)' : 'Share via Device Sheet'}
              </span>
              <Sparkles className="w-4 h-4 text-slate-950" />
            </button>
            <p className="text-[11px] text-center text-slate-400 font-mono">
              {isWebShareSupported 
                ? '⚡ Supported on your device: Opens native iOS / Android / Desktop share sheet'
                : 'Click to copy sharable link or select an app below'}
            </p>
          </div>

          {/* Copy Sharable Link & Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 font-medium flex items-center justify-between transition-all cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Copy Sharable Link</span>
              </span>
              {copiedLink ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400 group-hover:text-white" />
              )}
            </button>

            <button
              type="button"
              onClick={handleCopySummary}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 font-medium flex items-center justify-between transition-all cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Copy Summary Text</span>
              </span>
              {copiedSummary ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-slate-400 group-hover:text-white" />
              )}
            </button>
          </div>

          {/* Direct 1-Click Messaging & Social Shortcuts */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Quick Share to Messaging & Apps:</span>
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* WhatsApp */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/40 hover:border-emerald-600/60 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp</span>
              </a>

              {/* X / Twitter */}
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <span className="font-bold text-sm">𝕏</span>
                <span>Post</span>
              </a>

              {/* Telegram */}
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-950/70 border border-cyan-800/40 hover:border-cyan-600/60 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Send className="w-4 h-4 text-cyan-400" />
                <span>Telegram</span>
              </a>

              {/* Email */}
              <a
                href={emailUrl}
                className="py-2.5 px-3 rounded-xl bg-purple-950/40 hover:bg-purple-950/70 border border-purple-800/40 hover:border-purple-600/60 text-purple-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Mail className="w-4 h-4 text-purple-400" />
                <span>Email</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0">
          <span>Prime Dragon Technologies</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

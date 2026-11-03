import React, { useState } from 'react';
import { 
  Users, 
  Heart, 
  MessageSquare, 
  Share2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Send, 
  Lock, 
  Globe, 
  ExternalLink, 
  Sparkles, 
  Flame, 
  Check, 
  Filter,
  BookmarkCheck,
  ShieldCheck,
  Languages
} from 'lucide-react';
import { WallPost, WallComment, UserAccount } from '../types/wall';
import { SupportedLanguage, TRANSLATIONS } from '../utils/localization';
import { DragonDawwaAnalysis } from '../types/hadith';

interface PublicWallFeedProps {
  posts: WallPost[];
  currentLanguage: SupportedLanguage;
  currentUser: UserAccount;
  onLikePost: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onSelectPostForAnalysis: (post: WallPost) => void;
  onSharePost: (post: WallPost) => void;
  currentSearchPost?: WallPost | null;
  onPublishCurrentSearch?: () => void;
}

export const PublicWallFeed: React.FC<PublicWallFeedProps> = ({
  posts,
  currentLanguage,
  currentUser,
  onLikePost,
  onAddComment,
  onSelectPostForAnalysis,
  onSharePost,
  currentSearchPost,
  onPublishCurrentSearch
}) => {
  const t = TRANSLATIONS[currentLanguage];
  const [filter, setFilter] = useState<'all' | 'sahih' | 'daif'>('all');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({
    post_wall_001: true // Open first post comments by default
  });

  const handleCommentChange = (postId: string, val: string) => {
    setCommentInputs(prev => ({ ...prev, [postId]: val }));
  };

  const handleCommentSubmit = (postId: string) => {
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;
    onAddComment(postId, text);
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    // Ensure comments section is expanded
    setExpandedComments(prev => ({ ...prev, [postId]: true }));
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const filteredPosts = posts.filter(p => {
    if (filter === 'sahih') return p.purity_score >= 80;
    if (filter === 'daif') return p.purity_score < 80;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Wall Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[var(--surface-raised)] to-[var(--surface-raised)] border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700/60 flex items-center gap-1 font-semibold">
                <Globe className="w-3 h-3 text-emerald-400" />
                PUBLIC SCHOLARLY FEED
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {posts.length} Community Dossiers
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white font-display">
              {t.publicWallTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
              {t.publicWallDesc}
            </p>
          </div>

          {/* Quick Filter Bar */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800/80 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Posts ({posts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('sahih')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filter === 'sahih'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Verified Authentic (≥80%)
            </button>
            <button
              type="button"
              onClick={() => setFilter('daif')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filter === 'daif'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Defective / Mawdu' (&lt;80%)
            </button>
          </div>
        </div>

        {/* Current Active Search Sharing Card */}
        {currentSearchPost && (
          <div className="mt-5 p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                  YOUR RECENT INVESTIGATION:
                </span>
                <p className="text-sm font-semibold text-white line-clamp-1">
                  "{currentSearchPost.query_text}"
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                  <span>Score: <b className="text-amber-300">{currentSearchPost.purity_score}%</b></span>
                  <span>•</span>
                  <span>Status: <b className="text-slate-200">{currentSearchPost.final_status}</b></span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onPublishCurrentSearch}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                currentSearchPost.is_public
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/60'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[var(--on-gold)] shadow-lg shadow-amber-500/20'
              }`}
            >
              {currentSearchPost.is_public ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{t.publishedToWall}</span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 text-[var(--on-gold)]" />
                  <span>{t.publishToWall}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Wall Posts Feed */}
      <div className="space-y-5">
        {filteredPosts.map((post) => {
          const isHighPurity = post.purity_score >= 80;
          const isMediumPurity = post.purity_score >= 40 && post.purity_score < 80;
          const isExpanded = !!expandedComments[post.post_id];

          return (
            <article
              key={post.post_id}
              className="bg-[var(--surface-raised)] border border-slate-800/90 hover:border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl transition-all"
            >
              {/* Author & Header Row */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={post.author_avatar}
                    alt={post.author_name}
                    className="w-11 h-11 rounded-2xl object-cover border border-slate-700 shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">
                        {post.author_name}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {post.author_role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                      <span>{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <ShieldCheck className="w-3 h-3" />
                        {t.verifiedBadge}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score Pill */}
                <div className="text-right">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold shadow-md ${
                    isHighPurity
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
                      : isMediumPurity
                      ? 'bg-amber-950/80 text-amber-300 border-amber-600/60'
                      : 'bg-red-950/80 text-red-300 border-red-600/60'
                  }`}>
                    {isHighPurity ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : isMediumPurity ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                    <span>{post.purity_score.toFixed(1)}% Purity</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                    {post.final_status}
                  </div>
                </div>
              </div>

              {/* Sacred Arabic Text Preservation Block */}
              {post.canonical_arabic && (
                <div className="my-3.5 p-4 rounded-2xl bg-[var(--surface-sunken)] border border-slate-800/80 text-right">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-2">
                    <span className="text-amber-500/90 font-semibold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      {t.arabicScriptSacred}
                    </span>
                    <span className="text-slate-400">النص الأصلي المُحَقَّق</span>
                  </div>
                  <p 
                    dir="rtl"
                    className="font-arabic text-xl sm:text-2xl leading-relaxed text-amber-200/95 tracking-wide font-medium"
                  >
                    {post.canonical_arabic}
                  </p>
                </div>
              )}

              {/* Vernacular Matn Text */}
              <div className="space-y-2 mb-4">
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-serif italic">
                  "{post.query_text}"
                </p>

                {post.isnad_preview && (
                  <div className="text-xs font-mono text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 uppercase tracking-wider text-[10px] block mb-0.5">ISNAD TOPOLOGY:</span>
                    <span className="text-slate-300">{post.isnad_preview}</span>
                  </div>
                )}

                <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                  <b className="text-amber-400 font-semibold">Consensus Verdict: </b>
                  <span>{post.consensus_summary}</span>
                </div>
              </div>

              {/* Action Buttons: Like, Comment Toggle, Inspect Dossier, Share */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  {/* Like Button */}
                  <button
                    type="button"
                    onClick={() => onLikePost(post.post_id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      post.user_has_liked
                        ? 'bg-rose-950/80 text-rose-300 border-rose-600/60 shadow-sm shadow-rose-950'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${post.user_has_liked ? 'text-rose-400 fill-rose-400' : ''}`} />
                    <span>{post.likes_count}</span>
                  </button>

                  {/* Comment Toggle Button */}
                  <button
                    type="button"
                    onClick={() => toggleComments(post.post_id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{post.comments.length} {t.commentAction}</span>
                  </button>

                  {/* Share Post */}
                  <button
                    type="button"
                    onClick={() => onSharePost(post)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/80 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 transition-colors cursor-pointer"
                    title="Share this public dossier"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Inspect in Full 6-Agent Dossier Engine */}
                <button
                  type="button"
                  onClick={() => onSelectPostForAnalysis(post)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 hover:border-emerald-500 transition-all cursor-pointer shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Inspect Full 6-Agent Dossier</span>
                </button>
              </div>

              {/* Nested Comments Section */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3">
                  <h5 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3 text-cyan-400" />
                    Scholarly Peer-Review Notes ({post.comments.length})
                  </h5>

                  {/* Comments List */}
                  <div className="space-y-2.5">
                    {post.comments.map((comm) => (
                      <div
                        key={comm.comment_id}
                        className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 flex items-start gap-3 text-xs"
                      >
                        <img
                          src={comm.author_avatar}
                          alt={comm.author_name}
                          className="w-8 h-8 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white">{comm.author_name}</span>
                              {comm.author_role && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                  {comm.author_role}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(comm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <p className="text-slate-300 leading-relaxed font-sans">
                            {comm.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add New Comment Input */}
                  <div className="flex items-center gap-2 mt-3 pt-2">
                    <img
                      src={currentUser.profile_pic}
                      alt={currentUser.display_name}
                      className="w-8 h-8 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={commentInputs[post.post_id] || ''}
                        onChange={(e) => handleCommentChange(post.post_id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCommentSubmit(post.post_id);
                          }
                        }}
                        placeholder={t.addCommentPlaceholder}
                        className="w-full bg-[var(--surface-sunken)] border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none transition-colors pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => handleCommentSubmit(post.post_id)}
                        disabled={!(commentInputs[post.post_id] || '').trim()}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 text-white flex items-center justify-center transition-all cursor-pointer"
                        title={t.submitComment}
                      >
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

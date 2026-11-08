import { useState, type FormEvent } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  Copy,
  Edit3,
  MessageCircle,
  Plus,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { SeekerAvatar } from '../SeekerAuthModal.tsx';
import { ThemeSwatches } from './ReflectionModal.tsx';
import {
  BRAND_FOOTER_LEFT,
  BRAND_FOOTER_RIGHT,
  CARD_BISMILLAH,
  formatQuotedTranslation,
  formatVerseCardBadge,
} from '../../lib/verseImage.ts';
import {
  CORE_DHIKR_REACTIONS,
  formatPostTimestamp,
  getContextualNamesOfAllah,
  readingLinkHash,
  sanitizeWallTheme,
  WALL_THEMES,
  type FaithWallPost,
  type WallPostTheme,
} from '../../lib/verseShare.ts';
import { LANGUAGE_NAMES } from '../../shared/sources.ts';

export function WallPostCard({
  post,
  owned,
  onReact,
  onToggleSave,
  onAddReply,
  onExportCard,
  onCopyPost,
  onSaveEdit,
  onDeletePost,
  copied,
  exporting,
}: {
  post: FaithWallPost;
  owned: boolean;
  onReact: (postId: string, reactionId: string) => void;
  onToggleSave: (postId: string) => void;
  onAddReply: (postId: string, text: string) => Promise<void> | void;
  onExportCard: (post: FaithWallPost) => void;
  onCopyPost: (post: FaithWallPost) => void;
  onSaveEdit: (postId: string, reflection: string, theme: WallPostTheme) => Promise<void> | void;
  onDeletePost: (postId: string) => void;
  copied: boolean;
  exporting: boolean;
}) {
  const [expressOpen, setExpressOpen] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(Boolean((post.replies?.length ?? 0) > 0));
  const [replyDraft, setReplyDraft] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingDraft, setEditingDraft] = useState(post.reflection);
  const [editingTheme, setEditingTheme] = useState<WallPostTheme>(sanitizeWallTheme(post.theme));

  const themeKey = sanitizeWallTheme(post.theme);
  const themeSpec = WALL_THEMES[themeKey];
  const badge = formatVerseCardBadge({
    surah: post.surah,
    ayah: post.ayah,
    surahName: post.surahName,
  });
  const quoted = formatQuotedTranslation(post.translation);
  const timestamp = formatPostTimestamp(post.createdAt);

  const contextualNames = getContextualNamesOfAllah(
    post.surah,
    post.ayah,
    `${post.arabic} ${post.translation} ${post.reflection}`,
  );

  const openHref = post.url.startsWith('#')
    ? post.url
    : readingLinkHash({
        surah: post.surah,
        ayah: post.ayah,
        lang: post.lang,
        edition: post.lang === 'ta' ? 'tamil_omar_brief' : post.lang === 'si' ? 'sinhalese_mahir' : 'english_rwwad',
        mode: 'book',
      });

  const userReactedSet = new Set(post.userReactions ?? []);
  const reactionCounts = post.reactions ?? {};

  const handleReplySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!replyDraft.trim()) return;
    await onAddReply(post.id, replyDraft);
    setReplyDraft('');
    setRepliesOpen(true);
  };

  return (
    <article
      data-faith-wall-card={post.id}
      data-post-theme={themeKey}
      className="flex flex-col overflow-hidden rounded-3xl border border-[#D4AF37]/45 bg-[#051C15] text-[#F3E8C8] shadow-xl transition hover:border-[#D4AF37]/65"
    >
      {/* 1. Social-First Post Header */}
      <header
        data-wall-post-header={post.id}
        className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D4AF37]/20 bg-[#041B14] px-4 py-3.5 sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* User Avatar with Emerald & Gold Ring */}
          <span
            data-post-avatar
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-400/75 bg-[#0A2E23] shadow-sm ring-2 ring-[#D4AF37]/35"
          >
            <SeekerAvatar
              avatarUrl={post.authorAvatarUrl}
              name={post.authorName}
              emblem={post.authorEmblem}
              size={20}
            />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span data-post-author-name className="truncate text-sm font-bold text-white">
                {post.authorName || 'Community Seeker'}
              </span>
              <span className="text-[#D4AF37]/60" aria-hidden>·</span>
              <span
                data-post-author-role
                className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/35 bg-[#0A2E23] px-2.5 py-0.5 text-[11px] font-semibold text-[#D4AF37]"
              >
                {post.verified && (
                  <ShieldCheck
                    className="h-3 w-3 shrink-0 text-emerald-400"
                    aria-label={post.authorAuthProvider === 'google' ? 'Verified Google Seeker' : 'Verified Seeker'}
                  />
                )}
                <span>{post.authorRole || 'Faith Wall Contributor'}</span>
              </span>
              {owned && (
                <span className="rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                  You
                </span>
              )}
            </div>

            <p data-post-timestamp className="mt-0.5 truncate text-xs text-[#F5EEDC]/70">
              <span>{timestamp.absolute}</span>
              <span className="mx-1.5 text-[#D4AF37]/50" aria-hidden>·</span>
              <span className="font-medium text-[#D4AF37]/85">{timestamp.relative}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Content Language Pill */}
          <span
            data-post-lang-pill
            className="shrink-0 rounded-full border border-[#D4AF37]/35 bg-[#031812] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#F9E7B9]"
          >
            {LANGUAGE_NAMES[post.lang]?.english ?? 'English'}
          </span>

          {owned && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-wall-edit={post.id}
                title="Edit your reflection & theme"
                onClick={() => {
                  setEditingDraft(post.reflection);
                  setEditingTheme(themeKey);
                  setIsEditing(open => !open);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#031812]/80 text-[#F3E8C8] transition hover:border-[#D4AF37] hover:text-white"
              >
                <Edit3 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              </button>
              <button
                type="button"
                data-wall-delete={post.id}
                title="Delete your reflection"
                onClick={() => onDeletePost(post.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#031812]/80 text-[#F3E8C8] transition hover:border-red-400/60 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Author Reflection / Tadabbur Section (Social Post Lead) */}
      <div className="bg-[#062119] px-4 pt-4 sm:px-6">
        {isEditing ? (
          <div
            data-wall-edit-box={post.id}
            className="mb-3 space-y-3 rounded-2xl border border-[#D4AF37]/45 bg-[#031812]/95 p-3.5"
          >
            <input
              type="text"
              data-wall-edit-input={post.id}
              value={editingDraft}
              onChange={event => setEditingDraft(event.target.value)}
              className="w-full rounded-xl border border-[#D4AF37]/35 bg-[#0A2E23] px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ThemeSwatches selected={editingTheme} onSelect={setEditingTheme} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-[#F5EEDC]/70 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-wall-edit-save={post.id}
                  onClick={() => {
                    void onSaveEdit(post.id, editingDraft, editingTheme);
                    setIsEditing(false);
                  }}
                  className="rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-bold text-[#031812] hover:bg-[#e3c14d]"
                >
                  Save Reflection
                </button>
              </div>
            </div>
          </div>
        ) : post.reflection ? (
          <blockquote
            lang={post.lang}
            data-wall-card-reflection
            className="mb-3 rounded-2xl border border-[#D4AF37]/25 bg-[#031812]/80 px-4 py-3 text-sm italic leading-relaxed text-[#F3E8C8]/95"
          >
            “{post.reflection}”
          </blockquote>
        ) : null}
      </div>

      {/* 2. Themed 16:9 Illuminated Manuscript Ayah Card Container */}
      <div className="bg-[#062119] px-4 pb-4 sm:px-6">
        <div
          data-wall-ayah-card={post.id}
          className={`relative flex min-h-[16rem] w-full flex-col justify-between overflow-hidden rounded-2xl border-2 p-4 shadow-inner sm:aspect-[16/9] sm:min-h-0 sm:p-6 ${themeSpec.classes}`}
        >
          {/* Inner Second Frame Line */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-2.5 rounded-xl border border-white/15"
          />

          {/* Geometric Star Rosette SVG Watermark */}
          <svg
            aria-hidden
            viewBox="0 0 200 200"
            className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 text-[#D4AF37]/[0.06] sm:h-64 sm:w-64"
          >
            <g fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="42" y="42" width="116" height="116" />
              <rect x="42" y="42" width="116" height="116" transform="rotate(45 100 100)" />
              <circle cx="100" cy="100" r="82" />
              <circle cx="100" cy="100" r="58" />
              <circle cx="100" cy="100" r="30" />
            </g>
          </svg>

          {/* Top Row: Gold Pill Badge + Gold Bismillah */}
          <div className="relative z-10 flex items-center justify-between gap-2 px-1">
            <span className="inline-flex shrink-0 items-center rounded-full border border-[#D4AF37]/55 bg-[#D4AF37]/15 px-3 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#D4AF37] sm:text-[11px]">
              {badge}
            </span>
            <span lang="ar" dir="rtl" className="quran-face truncate text-xs text-[#D4AF37]/90 sm:text-base">
              ۞ {CARD_BISMILLAH}
            </span>
          </div>

          {/* Center: Pure White Glowing Arabic + Quoted Warm Ivory Translation */}
          <div className="relative z-10 my-auto flex flex-col items-center justify-center px-3 py-2 text-center sm:px-5">
            <p
              lang="ar"
              dir="rtl"
              style={{ textShadow: '0 0 20px rgba(212,175,55,0.22)' }}
              className="quran-face max-h-28 overflow-y-auto text-xl leading-[2.05] text-[#FFFFFF] sm:max-h-36 sm:text-2xl"
            >
              {post.arabic}
            </p>

            <div aria-hidden className="my-2 flex items-center gap-2 text-[#D4AF37]/60">
              <span className="h-px w-8 bg-[#D4AF37]/35 sm:w-12" />
              <span className="text-[9px]">◆</span>
              <span className="h-px w-8 bg-[#D4AF37]/35 sm:w-12" />
            </div>

            <p
              lang={post.lang}
              className="max-h-20 max-w-xl overflow-y-auto font-display text-xs leading-relaxed text-[#F3E8C8] sm:max-h-24 sm:text-sm"
            >
              {quoted}
            </p>
          </div>

          {/* Discreet Brand Footer */}
          <div className="relative z-10 flex items-center justify-between gap-2 border-t border-white/15 px-1 pt-2 text-[10px] font-medium tracking-wide text-[#D4AF37]/75 sm:text-[11px]">
            <span className="truncate">{BRAND_FOOTER_LEFT}</span>
            <span className="shrink-0">{BRAND_FOOTER_RIGHT}</span>
          </div>
        </div>
      </div>

      {/* 3. Interactive Expressions & Contextual Asma-ul-Husna Reaction Bar */}
      <div className="space-y-3 border-t border-[#D4AF37]/15 bg-[#051C15] px-4 py-3.5 sm:px-6">
        <div data-wall-reactions-bar={post.id} className="flex flex-wrap items-center gap-1.5">
          {/* Glowing Contextual Asma-ul-Husna Reaction Pills */}
          {contextualNames.map(divineName => {
            const count = reactionCounts[divineName.id] ?? 0;
            const active = userReactedSet.has(divineName.id);
            return (
              <button
                key={divineName.id}
                type="button"
                data-wall-reaction={divineName.id}
                data-asma-pill={divineName.transliteration}
                aria-pressed={active}
                title={`${divineName.transliteration} (${divineName.arabic}) — ${divineName.meaning}`}
                onClick={() => onReact(post.id, divineName.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'border-[#D4AF37] bg-[#D4AF37]/25 text-white shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'border-[#D4AF37]/45 bg-[#0A2E23]/90 text-[#F9E7B9] shadow-[0_0_10px_rgba(212,175,55,0.12)] hover:border-[#D4AF37]'
                }`}
              >
                <Sparkles className="h-3 w-3 text-[#D4AF37]" aria-hidden />
                <span>{divineName.transliteration}</span>
                <span lang="ar" dir="rtl" className="quran-face text-xs text-[#D4AF37]">
                  ({divineName.arabic})
                </span>
                {count > 0 && (
                  <span className="ml-0.5 rounded-full bg-[#031812]/80 px-1.5 py-0.2 text-[10px] font-bold text-[#D4AF37]">
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Core Islamic Dhikr Reaction Pills */}
          {CORE_DHIKR_REACTIONS.map(dhikr => {
            const count = reactionCounts[dhikr.id] ?? 0;
            const active = userReactedSet.has(dhikr.id);
            return (
              <button
                key={dhikr.id}
                type="button"
                data-wall-like={dhikr.id === 'amin' ? post.id : undefined}
                data-wall-reaction={dhikr.id}
                aria-pressed={active}
                title={`${dhikr.transliteration} (${dhikr.arabic}) — ${dhikr.meaning}`}
                onClick={() => onReact(post.id, dhikr.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]'
                    : 'border-[#D4AF37]/25 bg-[#031812]/75 text-[#F3E8C8]/90 hover:border-[#D4AF37]/60 hover:text-white'
                }`}
              >
                <span>{dhikr.transliteration}</span>
                <span lang="ar" dir="rtl" className="quran-face text-xs text-[#D4AF37]/90">
                  {dhikr.arabic}
                </span>
                {count > 0 && (
                  <span className="text-[11px] font-bold text-[#D4AF37]">· {count}</span>
                )}
              </button>
            );
          })}

          {/* [ + Express ] Flyout Trigger */}
          <div className="relative">
            <button
              type="button"
              data-wall-express-trigger={post.id}
              aria-expanded={expressOpen}
              onClick={() => setExpressOpen(open => !open)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#D4AF37]/50 bg-[#031812] px-2.5 py-1 text-xs font-semibold text-[#D4AF37] transition hover:border-[#D4AF37] hover:bg-[#0A2E23]"
            >
              <Plus className="h-3 w-3" aria-hidden />
              <span>Express</span>
            </button>

            {expressOpen && (
              <div
                data-wall-express-popover={post.id}
                className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-2xl border border-[#D4AF37]/55 bg-[#031812] p-3 shadow-2xl"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
                  ✦ Express Dhikr & Asma-ul-Husna
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {contextualNames.map(name => (
                    <button
                      key={name.id}
                      type="button"
                      onClick={() => {
                        onReact(post.id, name.id);
                        setExpressOpen(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/50 bg-[#0A2E23] px-2.5 py-1 text-[11px] font-semibold text-[#F9E7B9] hover:border-[#D4AF37]"
                    >
                      <span>✦ {name.transliteration}</span>
                      <span lang="ar" dir="rtl" className="quran-face text-xs text-[#D4AF37]">
                        {name.arabic}
                      </span>
                    </button>
                  ))}
                  {CORE_DHIKR_REACTIONS.map(dhikr => (
                    <button
                      key={dhikr.id}
                      type="button"
                      onClick={() => {
                        onReact(post.id, dhikr.id);
                        setExpressOpen(false);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/30 bg-[#062119] px-2.5 py-1 text-[11px] font-medium text-[#F3E8C8] hover:border-[#D4AF37]"
                    >
                      <span>{dhikr.transliteration}</span>
                      <span lang="ar" dir="rtl" className="quran-face text-xs text-[#D4AF37]">
                        ({dhikr.arabic})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Bottom Social Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D4AF37]/15 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* [ 💬 Reply / Reflect ] */}
            <button
              type="button"
              data-wall-reply-trigger={post.id}
              aria-expanded={repliesOpen}
              onClick={() => setRepliesOpen(open => !open)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/30 bg-[#031812]/80 px-3 py-1.5 text-xs font-semibold text-[#F3E8C8] transition hover:border-[#D4AF37] hover:text-white"
            >
              <MessageCircle className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              <span>Reply / Reflect</span>
              {(post.replies?.length ?? 0) > 0 && (
                <span className="rounded-full bg-[#D4AF37]/20 px-1.5 py-0.2 text-[10px] font-bold text-[#D4AF37]">
                  {post.replies?.length}
                </span>
              )}
            </button>

            {/* [ 🔖 Save ] */}
            <button
              type="button"
              data-wall-save-trigger={post.id}
              aria-pressed={Boolean(post.saved)}
              onClick={() => onToggleSave(post.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                post.saved
                  ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]'
                  : 'border-[#D4AF37]/30 bg-[#031812]/80 text-[#F3E8C8] hover:border-[#D4AF37] hover:text-white'
              }`}
            >
              {post.saved ? (
                <BookmarkCheck className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              ) : (
                <Bookmark className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              )}
              <span>{post.saved ? 'Saved' : 'Save'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={openHref}
              title="Open Ayah in Qur'an Reader"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/30 bg-[#031812]/80 px-3 py-1.5 text-xs font-medium text-[#F3E8C8] transition hover:border-[#D4AF37] hover:text-white"
            >
              <BookOpen className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              <span>Open Ayah</span>
            </a>

            {/* [ 📤 Export Card ] */}
            <button
              type="button"
              data-wall-export-trigger={post.id}
              disabled={exporting}
              onClick={() => onExportCard(post)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/45 bg-[#0A2E23] px-3 py-1.5 text-xs font-semibold text-[#F9E7B9] transition hover:border-[#D4AF37] hover:bg-[#0f3d2f] disabled:opacity-50"
            >
              <Share2 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              <span>Export Card</span>
            </button>

            <button
              type="button"
              title="Copy verse and reflection"
              onClick={() => onCopyPost(post)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#031812]/80 text-[#F3E8C8] transition hover:border-[#D4AF37] hover:text-white"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Threaded Discussion / Reflections Section */}
        {repliesOpen && (
          <div
            data-wall-replies-section={post.id}
            className="mt-3 space-y-2.5 rounded-2xl border border-[#D4AF37]/25 bg-[#031812]/90 p-3.5"
          >
            {(post.replies?.length ?? 0) > 0 && (
              <ul className="space-y-2">
                {post.replies!.map(reply => {
                  const replyTime = formatPostTimestamp(reply.createdAt);
                  return (
                    <li
                      key={reply.id}
                      data-wall-reply-item={reply.id}
                      className="rounded-xl border border-[#D4AF37]/20 bg-[#0A2E23]/60 px-3 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                        <span className="font-semibold text-white">
                          {reply.authorName}{' '}
                          <span className="font-normal text-[#D4AF37]">· {reply.authorRole}</span>
                        </span>
                        <span className="text-[#F5EEDC]/60">{replyTime.relative}</span>
                      </div>
                      <p className="mt-1 leading-relaxed text-[#F3E8C8]">{reply.text}</p>
                    </li>
                  );
                })}
              </ul>
            )}

            <form onSubmit={event => void handleReplySubmit(event)} className="flex items-center gap-2">
              <input
                type="text"
                data-wall-reply-input={post.id}
                value={replyDraft}
                onChange={event => setReplyDraft(event.target.value)}
                placeholder="Write a scholarly note or heartfelt reflection..."
                className="flex-1 rounded-xl border border-[#D4AF37]/35 bg-[#0A2E23]/80 px-3 py-2 text-xs text-white placeholder:text-[#F5EEDC]/45 focus:border-[#D4AF37] focus:outline-none"
              />
              <button
                type="submit"
                data-wall-reply-submit={post.id}
                className="inline-flex items-center gap-1 rounded-xl bg-[#D4AF37] px-3.5 py-2 text-xs font-bold text-[#031812] transition hover:bg-[#e3c14d]"
              >
                <Send className="h-3 w-3" aria-hidden />
                <span>Reply</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}

import { useState, type FormEvent } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  Copy,
  Edit3,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Share2,
  ShieldCheck,
  SmilePlus,
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

const REACTION_EMOJI: Record<string, string> = {
  mashaallah: '❤️',
  allahu_akbar: '☝️',
  subhanallah: '✨',
  alhamdulillah: '🌿',
  amin: '🤲',
};

export function WallPostCard({
  post,
  owned,
  defaultExpressOpen = false,
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
  defaultExpressOpen?: boolean;
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
  const [expressOpen, setExpressOpen] = useState(defaultExpressOpen);
  const [menuOpen, setMenuOpen] = useState(false);
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

  // Build the list of active reaction chips (only count > 0 or user-reacted)
  const activeReactionChips: Array<{
    id: string;
    label: string;
    arabic: string;
    icon: string;
    count: number;
    active: boolean;
    isAsma: boolean;
  }> = [];

  for (const divineName of contextualNames) {
    const count = reactionCounts[divineName.id] ?? 0;
    const active = userReactedSet.has(divineName.id);
    if (count > 0 || active) {
      activeReactionChips.push({
        id: divineName.id,
        label: divineName.transliteration,
        arabic: divineName.arabic,
        icon: '✦',
        count: Math.max(count, active ? 1 : 0),
        active,
        isAsma: true,
      });
    }
  }

  for (const dhikr of CORE_DHIKR_REACTIONS) {
    const count = reactionCounts[dhikr.id] ?? 0;
    const active = userReactedSet.has(dhikr.id);
    if (count > 0 || active) {
      activeReactionChips.push({
        id: dhikr.id,
        label: dhikr.transliteration,
        arabic: dhikr.arabic,
        icon: REACTION_EMOJI[dhikr.id] ?? '🤲',
        count: Math.max(count, active ? 1 : 0),
        active,
        isAsma: false,
      });
    }
  }

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
      className="rounded-2xl border border-stone-200/80 bg-white p-5 text-stone-900 shadow-sm transition hover:border-stone-300/90 sm:p-6"
    >
      {/* 1. Top Social Header */}
      <header
        data-wall-post-header={post.id}
        className="flex items-start justify-between gap-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* User Avatar with Subtle Emerald Ring */}
          <span
            data-post-avatar
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#073C30] text-[#F5EEDC] ring-2 ring-emerald-600/35"
          >
            <SeekerAvatar
              avatarUrl={post.authorAvatarUrl}
              name={post.authorName}
              emblem={post.authorEmblem}
              size={18}
            />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span data-post-author-name className="truncate text-sm font-semibold text-stone-900">
                {post.authorName || 'Community Seeker'}
              </span>
              <span
                data-post-author-role
                className="inline-flex items-center gap-1 rounded-full border border-emerald-800/15 bg-emerald-50/80 px-2 py-0.5 text-[11px] font-medium text-emerald-900"
              >
                {post.verified && (
                  <ShieldCheck
                    className="h-3 w-3 shrink-0 text-emerald-600"
                    aria-label={post.authorAuthProvider === 'google' ? 'Verified Google Seeker' : 'Verified Seeker'}
                  />
                )}
                <span>{post.authorRole || 'Faith Wall Contributor'}</span>
              </span>
              {owned && (
                <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                  You
                </span>
              )}
            </div>

            <p
              data-post-timestamp
              title={timestamp.absolute}
              className="mt-0.5 truncate text-xs text-stone-500"
            >
              <span>{timestamp.relative}</span>
              <span className="mx-1 text-stone-300" aria-hidden>·</span>
              <span>{timestamp.absolute}</span>
            </p>
          </div>
        </div>

        {/* Right Header Controls: Language Chip + Minimal More Menu */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            data-post-lang-pill
            className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[11px] font-medium text-stone-600"
          >
            {LANGUAGE_NAMES[post.lang]?.english ?? 'English'}
          </span>

          {owned && (
            <>
              <button
                type="button"
                data-wall-edit={post.id}
                title="Edit reflection & theme"
                onClick={() => {
                  setEditingDraft(post.reflection);
                  setEditingTheme(themeKey);
                  setIsEditing(open => !open);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                data-wall-delete={post.id}
                title="Delete reflection"
                onClick={() => onDeletePost(post.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </>
          )}

          <div className="relative">
            <button
              type="button"
              data-post-more-menu={post.id}
              aria-label="More options"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-stone-200 bg-white p-1.5 text-xs shadow-lg">
                <a
                  href={openHref}
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-stone-700 hover:bg-stone-100"
                >
                  <BookOpen className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                  <span>Open Ayah in Reader</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    onCopyPost(post);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-stone-700 hover:bg-stone-100"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-stone-500" aria-hidden />
                  )}
                  <span>{copied ? 'Copied Text' : 'Copy Ayah & Reflection'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. User Reflection (Prominent Unboxed Text directly on white card surface) */}
      {isEditing ? (
        <div
          data-wall-edit-box={post.id}
          className="my-3.5 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-3.5"
        >
          <input
            type="text"
            data-wall-edit-input={post.id}
            value={editingDraft}
            onChange={event => setEditingDraft(event.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-700 focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ThemeSwatches selected={editingTheme} onSelect={setEditingTheme} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-medium text-stone-500 hover:text-stone-800"
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
                className="rounded-lg bg-[#073C30] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0A2E23]"
              >
                Save Reflection
              </button>
            </div>
          </div>
        </div>
      ) : post.reflection ? (
        <p
          lang={post.lang}
          data-wall-card-reflection
          className="my-3.5 font-sans text-[15px] leading-relaxed text-stone-800 sm:text-base"
        >
          {post.reflection}
        </p>
      ) : (
        <div className="my-2" />
      )}

      {/* 3. Attached 16:9 Illuminated Ayah Card (Embedded Media Asset) */}
      <div
        data-wall-ayah-card={post.id}
        className={`relative flex min-h-[15.5rem] w-full flex-col justify-between overflow-hidden rounded-xl border border-[#D4AF37]/30 p-4 text-[#F3E8C8] shadow-sm sm:aspect-[16/9] sm:min-h-0 sm:p-6 ${themeSpec.classes}`}
      >
        {/* Subtle Inner Frame Line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2.5 rounded-lg border border-white/10"
        />

        {/* Geometric Star Rosette SVG Watermark */}
        <svg
          aria-hidden
          viewBox="0 0 200 200"
          className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 text-[#D4AF37]/[0.05] sm:h-60 sm:w-60"
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
        <div className="relative z-10 flex items-center justify-between gap-2">
          <a
            href={openHref}
            className="inline-flex shrink-0 items-center rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#D4AF37] transition hover:border-[#D4AF37] sm:text-[11px]"
          >
            {badge}
          </a>
          <span lang="ar" dir="rtl" className="quran-face truncate text-xs text-[#D4AF37]/90 sm:text-base">
            ۞ {CARD_BISMILLAH}
          </span>
        </div>

        {/* Center: Pure White Glowing Arabic + Quoted Warm Ivory Translation */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center px-2 py-2 text-center sm:px-5">
          <p
            lang="ar"
            dir="rtl"
            style={{ textShadow: '0 0 20px rgba(212,175,55,0.22)' }}
            className="quran-face max-h-28 overflow-y-auto text-xl leading-[2.05] text-[#FFFFFF] sm:max-h-36 sm:text-2xl"
          >
            {post.arabic}
          </p>

          <div aria-hidden className="my-2 flex items-center gap-2 text-[#D4AF37]/55">
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
        <div className="relative z-10 flex items-center justify-between gap-2 border-t border-white/15 pt-2 text-[10px] font-medium tracking-wide text-[#D4AF37]/75 sm:text-[11px]">
          <span className="truncate">{BRAND_FOOTER_LEFT}</span>
          <span className="shrink-0">{BRAND_FOOTER_RIGHT}</span>
        </div>
      </div>

      {/* 4. Modern Single-Row Social Action Bar */}
      <div
        data-wall-reactions-bar={post.id}
        className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3"
      >
        {/* Left Side: Active Reaction Chips + [ + React ] Trigger */}
        <div className="flex flex-wrap items-center gap-1.5">
          {activeReactionChips.map(chip => (
            <button
              key={chip.id}
              type="button"
              data-wall-like={chip.id === 'amin' ? post.id : undefined}
              data-ameen-btn={chip.id === 'amin' ? post.id : undefined}
              data-wall-reaction={chip.id}
              data-asma-pill={chip.isAsma ? chip.label : undefined}
              aria-pressed={chip.active}
              onClick={() => onReact(post.id, chip.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                chip.active
                  ? 'border-emerald-600/45 bg-emerald-50 text-emerald-900 shadow-2xs'
                  : chip.isAsma
                    ? 'border-amber-300/70 bg-amber-50/70 text-amber-950 hover:border-amber-400'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-stone-100'
              }`}
            >
              <span aria-hidden className={chip.isAsma ? 'text-amber-600' : ''}>
                {chip.icon}
              </span>
              <span>{chip.label}</span>
              <span className="font-semibold text-emerald-800">{chip.count}</span>
            </button>
          ))}

          {/* Minimal [ + React ] Floating Tray Trigger */}
          <div className="relative">
            <button
              type="button"
              data-wall-express-trigger={post.id}
              aria-expanded={expressOpen}
              onClick={() => setExpressOpen(open => !open)}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:border-emerald-600/40 hover:bg-emerald-50/50 hover:text-emerald-900"
            >
              <SmilePlus className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              <span>+ React</span>
            </button>

            {expressOpen && (
              <div
                data-wall-express-popover={post.id}
                className="absolute bottom-full left-0 z-30 mb-2 w-76 rounded-2xl border border-stone-200 bg-white p-3 text-stone-800 shadow-xl ring-1 ring-black/5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                    Dhikr & Contextual Asma-ul-Husna
                  </p>
                  <button
                    type="button"
                    onClick={() => setExpressOpen(false)}
                    className="text-[11px] text-stone-400 hover:text-stone-700"
                  >
                    Close
                  </button>
                </div>

                {/* Primary Dhikr Row */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CORE_DHIKR_REACTIONS.map(dhikr => {
                    const active = userReactedSet.has(dhikr.id);
                    return (
                      <button
                        key={dhikr.id}
                        type="button"
                        data-tray-reaction={dhikr.id}
                        onClick={() => {
                          onReact(post.id, dhikr.id);
                          setExpressOpen(false);
                        }}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          active
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                            : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-emerald-500 hover:bg-emerald-50/40'
                        }`}
                      >
                        <span aria-hidden>{REACTION_EMOJI[dhikr.id] ?? '🤲'}</span>
                        <span>{dhikr.transliteration}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Contextual Asma-ul-Husna Row */}
                <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                  ✦ Divine Names in This Ayah
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {contextualNames.map(name => {
                    const active = userReactedSet.has(name.id);
                    return (
                      <button
                        key={name.id}
                        type="button"
                        data-asma-pill={name.transliteration}
                        data-tray-reaction={name.id}
                        onClick={() => {
                          onReact(post.id, name.id);
                          setExpressOpen(false);
                        }}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          active
                            ? 'border-amber-500 bg-amber-100/80 text-amber-950'
                            : 'border-amber-300/80 bg-amber-50/70 text-amber-950 hover:border-amber-500'
                        }`}
                      >
                        <Sparkles className="h-3 w-3 text-amber-600" aria-hidden />
                        <span>{name.transliteration}</span>
                        <span lang="ar" dir="rtl" className="quran-face text-xs text-amber-800">
                          ({name.arabic})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Compact Utility Actions (Reply, Bookmark, Export Card) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-wall-reply-trigger={post.id}
            aria-expanded={repliesOpen}
            onClick={() => setRepliesOpen(open => !open)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <MessageCircle className="h-4 w-4 text-stone-500" aria-hidden />
            <span>Reply</span>
            {(post.replies?.length ?? 0) > 0 && (
              <span className="rounded-full bg-stone-100 px-1.5 py-0.2 text-[11px] font-semibold text-stone-700">
                {post.replies?.length}
              </span>
            )}
          </button>

          <button
            type="button"
            data-wall-save-trigger={post.id}
            aria-pressed={Boolean(post.saved)}
            onClick={() => onToggleSave(post.id)}
            title={post.saved ? 'Saved in Bookmarks' : 'Bookmark reflection'}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              post.saved
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {post.saved ? (
              <BookmarkCheck className="h-4 w-4 text-emerald-700" aria-hidden />
            ) : (
              <Bookmark className="h-4 w-4 text-stone-500" aria-hidden />
            )}
            <span className="hidden sm:inline">{post.saved ? 'Saved' : 'Save'}</span>
          </button>

          <button
            type="button"
            data-wall-export-trigger={post.id}
            disabled={exporting}
            onClick={() => onExportCard(post)}
            title="Export 1200×675 HD Card"
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
          >
            <Share2 className="h-4 w-4 text-stone-500" aria-hidden />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Expandable Light-Surface Threaded Replies Section */}
      {repliesOpen && (
        <div
          data-wall-replies-section={post.id}
          className="mt-3 space-y-2.5 rounded-xl border border-stone-200/75 bg-stone-50/80 p-3.5"
        >
          {(post.replies?.length ?? 0) > 0 && (
            <ul className="space-y-2">
              {post.replies!.map(reply => {
                const replyTime = formatPostTimestamp(reply.createdAt);
                return (
                  <li
                    key={reply.id}
                    data-wall-reply-item={reply.id}
                    className="rounded-lg border border-stone-200/80 bg-white px-3 py-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                      <span className="font-semibold text-stone-900">
                        {reply.authorName}{' '}
                        <span className="font-normal text-emerald-800">· {reply.authorRole}</span>
                      </span>
                      <span className="text-stone-400">{replyTime.relative}</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-stone-700">{reply.text}</p>
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
              placeholder="Write a reflection or reply…"
              className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-700 focus:outline-none"
            />
            <button
              type="submit"
              data-wall-reply-submit={post.id}
              className="inline-flex items-center gap-1 rounded-lg bg-[#073C30] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0A2E23]"
            >
              <Send className="h-3 w-3" aria-hidden />
              <span>Reply</span>
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

import { useState, type FormEvent } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  Copy,
  Edit3,
  Headphones,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Pin,
  Play,
  Plus,
  Send,
  Share2,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { pauseAudio, playAudio, useAudioState } from '../../lib/audio.ts';
import { HadithVoiceBar } from '../HadithVoiceBar.tsx';
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
  onJoinSunnah,
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
  onJoinSunnah?: (postId: string) => void;
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
  const audio = useAudioState();

  const themeKey = sanitizeWallTheme(post.theme);
  const themeSpec = WALL_THEMES[themeKey];
  const badge = post.hadithCollection
    ? `✦ ${post.hadithCollection.toUpperCase()} #${post.hadithNumber ?? 1}`
    : formatVerseCardBadge({
        surah: post.surah,
        ayah: post.ayah,
        surahName: post.surahName,
      });
  const quoted = formatQuotedTranslation(post.translation);
  const timestamp = formatPostTimestamp(post.createdAt);
  const isAnon = Boolean(post.isAnonymous);
  const displayAuthorName = isAnon ? 'Anonymous Seeker' : post.authorName || 'Community Seeker';
  const displayAuthorHandle = isAnon
    ? '@anonymous'
    : post.authorHandle || `@${displayAuthorName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'seeker'}`;
  const displayAuthorRole = isAnon ? 'Sincere Sunnah Pledge' : post.authorRole || 'Faith Wall Contributor';
  const displayAvatarUrl = isAnon ? undefined : post.authorAvatarUrl ?? post.authorAvatar ?? null;
  const displayEmblem = isAnon ? 'emerald-lamp' : post.authorEmblem;
  const canManage = owned && !isAnon;
  const profileSlug = isAnon
    ? ''
    : encodeURIComponent(
        (post.userId || post.authorHandle || post.authorName || 'me').replace(/^@/, ''),
      );
  const profileHref = isAnon ? undefined : `#/profile/${profileSlug}`;
  const podcastAudioId = `wall-pod-audio-${post.id}`;
  const podcastPlaying = audio.id === podcastAudioId && (audio.status === 'playing' || audio.status === 'loading');

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
      data-post-type={post.type ?? 'reflection'}
      className={`rounded-2xl border bg-white p-4 text-stone-900 shadow-sm transition sm:p-5 ${
        post.isPinned || post.isOfficialBroadcast
          ? 'border-[#C6A15A]/70 ring-1 ring-[#C6A15A]/30'
          : 'border-stone-200/80 hover:border-stone-300/90'
      }`}
    >
      {/* Pinned / Official Broadcast Ribbon */}
      {(post.isPinned || post.isOfficialBroadcast) && (
        <div
          data-official-broadcast-badge={post.id}
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#C6A15A]/45 bg-[#073C30] px-3.5 py-1.5 text-xs font-semibold text-[#F9E7B9]"
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span>✦ Official Institutional Broadcast</span>
          </span>
          {post.isPinned && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#D4AF37]">
              <Pin className="h-3 w-3" aria-hidden />
              <span>Pinned</span>
            </span>
          )}
        </div>
      )}

      {/* 1. Top Social Header */}
      <header
        data-wall-post-header={post.id}
        className="flex items-start justify-between gap-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          {/* User Avatar with Subtle Emerald Ring (non-linking neutral emblem when anonymous) */}
          {isAnon ? (
            <span
              data-post-avatar
              title="Anonymous Seeker"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#073C30] text-[#F5EEDC] ring-2 ring-emerald-600/35"
            >
              <SeekerAvatar
                avatarUrl={undefined}
                name="Anonymous Seeker"
                emblem="emerald-lamp"
                size={18}
              />
            </span>
          ) : (
            <a
              href={profileHref}
              data-post-avatar
              title={`View ${displayAuthorName}’s profile`}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#073C30] text-[#F5EEDC] ring-2 ring-emerald-600/35 transition hover:ring-emerald-600"
            >
              <SeekerAvatar
                avatarUrl={displayAvatarUrl}
                name={displayAuthorName}
                emblem={displayEmblem}
                size={18}
              />
            </a>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {isAnon ? (
                <>
                  <span
                    data-post-author-name
                    className="truncate text-sm font-semibold text-stone-900"
                  >
                    Anonymous Seeker
                  </span>
                  <span
                    data-post-author-handle
                    className="font-mono text-xs text-stone-500"
                  >
                    {displayAuthorHandle}
                  </span>
                </>
              ) : (
                <a
                  href={profileHref}
                  data-post-author-name
                  data-post-author-link
                  className="truncate text-sm font-semibold text-stone-900 hover:text-[#073C30] hover:underline"
                >
                  {displayAuthorName}
                </a>
              )}
              <span
                data-post-author-role
                className="inline-flex items-center gap-1 rounded-full border border-emerald-800/15 bg-emerald-50/80 px-2 py-0.5 text-[11px] font-medium text-emerald-900"
              >
                {!isAnon && post.verified && (
                  <ShieldCheck
                    className="h-3 w-3 shrink-0 text-emerald-600"
                    aria-label={post.authorAuthProvider === 'google' ? 'Verified Google Seeker' : 'Verified Seeker'}
                  />
                )}
                <span>{displayAuthorRole}</span>
              </span>
              {canManage && (
                <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                  You
                </span>
              )}
              {post.status === 'pending' && (
                <span
                  data-post-pending-badge
                  className="rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
                >
                  Pending Review
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

          {canManage && (
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
          className="my-3 font-sans text-sm leading-relaxed text-stone-800"
        >
          {post.reflection}
        </p>
      ) : (
        <div className="my-1.5" />
      )}

      {/* 3. Attached Sacred Anchor: Good Deed Sunnah Pledge, Podcast Episode Player, OR 16:9 Illuminated Ayah/Hadith Card */}
      {post.type === 'good_deed' ? (
        <div
          data-wall-good-deed-card={post.id}
          style={{ backgroundColor: '#073C30', color: '#FFFFFF' }}
          className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#D4AF37]/45 bg-gradient-to-br from-[#04241C] via-[#073C30] to-[#0A2E23] p-4 text-[#FFFFFF] shadow-sm sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              style={{ backgroundColor: 'rgba(212,175,55,0.16)', color: '#F9E7B9' }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/55 px-3 py-0.5 text-[11px] font-bold tracking-wide text-[#F9E7B9]"
            >
              <Sparkles className="h-3 w-3 text-[#D4AF37]" aria-hidden />
              <span>{post.isAnonymous ? '✨ Anonymous Seeker' : `✨ ${post.authorName}`}</span>
            </span>
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E6C665]">
              {post.deedCategory === 'charity'
                ? 'Charity Pledge'
                : post.deedCategory === 'kindness'
                  ? 'Kindness Sunnah'
                  : 'Dhikr & Sunnah'}
            </span>
          </div>

          <h4
            style={{ color: '#F9E7B9' }}
            className="mt-3 font-display text-base font-bold leading-snug text-[#F9E7B9] sm:text-lg"
          >
            {post.deedTitle || 'Read Surah Al-Kahf on Friday & Morning Adhkar'}
          </h4>

          <div className="mt-2.5 rounded-xl border border-[#D4AF37]/25 bg-[#031812]/65 p-3">
            <p
              lang="ar"
              dir="rtl"
              style={{ color: '#FFFFFF' }}
              className="quran-face text-center text-base leading-[1.95] text-[#FFFFFF] sm:text-lg"
            >
              {post.arabic}
            </p>
            <p
              lang={post.lang}
              style={{ color: '#E7E5E4' }}
              className="mt-1 text-center text-xs leading-relaxed text-stone-200"
            >
              {quoted}
            </p>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3">
            <a
              href={openHref}
              style={{ color: '#E6C665' }}
              className="text-[11px] font-semibold text-[#E6C665] hover:underline"
            >
              {badge} →
            </a>

            <button
              type="button"
              data-testid="join-sunnah-btn"
              data-join-sunnah={post.id}
              aria-pressed={Boolean(post.userJoined)}
              onClick={() => onJoinSunnah?.(post.id)}
              style={{
                backgroundColor: post.userJoined ? '#D4AF37' : '#0E4D3B',
                color: post.userJoined ? '#031812' : '#FFFFFF',
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold shadow-sm transition cursor-pointer ${
                post.userJoined
                  ? 'border-[#D4AF37] bg-[#D4AF37] text-[#031812]'
                  : 'border-[#D4AF37]/75 bg-[#0E4D3B] text-[#FFFFFF] hover:bg-[#13634C]'
              }`}
            >
              {post.userJoined ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Plus className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              )}
              <span>
                {post.userJoined
                  ? `Joined Sunnah · ${post.joinedCount ?? 49} joined`
                  : `Join this Sunnah · ${post.joinedCount ?? 48} joined`}
              </span>
            </button>
          </div>
        </div>
      ) : post.type === 'podcast' ? (
        <div
          data-wall-podcast-card={post.id}
          className={`relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#D4AF37]/35 p-4 text-[#F3E8C8] shadow-sm ${themeSpec.classes}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">
            <span className="inline-flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5" aria-hidden />
              <span>Research Podcast Episode</span>
            </span>
            <span>{post.podcastDuration || '06:42'}</span>
          </div>

          <h4 className="mt-1.5 font-display text-sm font-bold text-white sm:text-base">
            {post.podcastTitle || `Roundtable on Surah ${post.surahName} ${post.surah}:${post.ayah}`}
          </h4>

          {/* Interactive Audio Waveform Bar */}
          <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-[#D4AF37]/30 bg-[#031812]/80 px-3 py-2">
            <button
              type="button"
              data-wall-podcast-play={post.id}
              aria-label={podcastPlaying ? 'Pause podcast' : 'Play podcast'}
              onClick={() => {
                if (podcastPlaying) pauseAudio();
                else {
                  void playAudio(
                    podcastAudioId,
                    post.podcastAudioUrl || 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',
                  );
                }
              }}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[#031812] shadow-sm transition hover:bg-[#e3c14d]"
            >
              {podcastPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
              )}
            </button>

            <div className="flex flex-1 items-center gap-1 overflow-hidden" aria-hidden>
              {[35, 65, 45, 80, 55, 90, 40, 70, 60, 85, 50, 75, 45, 65, 35, 60, 80, 50, 40, 72].map((h, idx) => (
                <span
                  key={idx}
                  style={{ height: `${Math.round(h * 0.22)}px` }}
                  className={`w-1.5 rounded-full transition-colors ${
                    podcastPlaying && idx % 2 === 0 ? 'bg-emerald-400' : 'bg-[#D4AF37]/75'
                  }`}
                />
              ))}
            </div>

            <span className="font-mono text-[11px] text-[#D4AF37]">
              {post.podcastDuration || '06:42'}
            </span>
          </div>

          {/* Key Citations */}
          {(post.podcastCitations?.length ?? 0) > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {post.podcastCitations!.map(cite => (
                <span
                  key={cite}
                  className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-semibold text-[#F9E7B9]"
                >
                  ✦ {cite}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/15 pt-2 text-[10px] font-medium tracking-wide text-[#D4AF37]/75">
            <span className="truncate">{BRAND_FOOTER_LEFT}</span>
            <span className="shrink-0">{BRAND_FOOTER_RIGHT}</span>
          </div>
        </div>
      ) : (
      <div
        data-wall-ayah-card={post.id}
        className={`relative flex min-h-[14rem] w-full flex-col justify-between overflow-hidden rounded-xl border border-[#D4AF37]/30 p-4 text-[#F3E8C8] shadow-sm sm:aspect-[16/9] sm:min-h-0 sm:p-5 ${themeSpec.classes}`}
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
        <div className="relative z-10 my-auto flex flex-col items-center justify-center px-2 py-1.5 text-center sm:px-5">
          <p
            lang="ar"
            dir="rtl"
            style={{ textShadow: '0 0 20px rgba(212,175,55,0.22)' }}
            className="quran-face max-h-28 overflow-y-auto text-lg leading-[2.05] text-[#FFFFFF] sm:max-h-32 sm:text-xl"
          >
            {post.arabic}
          </p>

          <div aria-hidden className="my-1.5 flex items-center gap-2 text-[#D4AF37]/55">
            <span className="h-px w-8 bg-[#D4AF37]/35 sm:w-12" />
            <span className="text-[9px]">◆</span>
            <span className="h-px w-8 bg-[#D4AF37]/35 sm:w-12" />
          </div>

          <p
            lang={post.lang}
            className="max-h-20 max-w-xl overflow-y-auto font-sans text-xs leading-relaxed text-[#F3E8C8] sm:max-h-24 sm:text-[13px]"
          >
            {quoted}
          </p>
        </div>

        {/* Discreet Brand Footer */}
        <div className="relative z-10 flex items-center justify-between gap-2 border-t border-white/15 pt-2 text-[10px] font-medium tracking-wide text-[#D4AF37]/75">
          <span className="truncate">{BRAND_FOOTER_LEFT}</span>
          <span className="shrink-0">{BRAND_FOOTER_RIGHT}</span>
        </div>

        {post.hadithCollection && (
          <div className="relative z-10 mt-2.5">
            <HadithVoiceBar
              hadithKey={`wall-${post.id}`}
              arabicText={post.arabic}
              translationText={post.translation}
              explanationText={post.reflection}
              lang={post.lang}
              variant="dark"
              compact
            />
          </div>
        )}
      </div>
      )}

      {/* 4. Modern Single-Row Social Action Bar (No orphan wrapping) */}
      <div
        data-wall-reactions-bar={post.id}
        className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-stone-100 pt-2.5 sm:flex-nowrap"
      >
        {/* Left Side: Active Reaction Chips + 1-Tap Join Sunnah + [ + React ] Trigger on a single clean row */}
        <div className="flex min-w-0 flex-wrap items-center gap-1 sm:flex-nowrap">
          {post.type !== 'good_deed' && onJoinSunnah && (
            <button
              type="button"
              data-testid="join-sunnah-btn"
              data-join-sunnah={post.id}
              aria-pressed={Boolean(post.userJoined)}
              onClick={() => onJoinSunnah(post.id)}
              style={{
                backgroundColor: post.userJoined ? '#073C30' : '#E8F2EC',
                color: post.userJoined ? '#FFFFFF' : '#073C30',
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#073C30]/30 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap transition cursor-pointer hover:border-[#073C30]"
            >
              {post.userJoined ? (
                <Check className="h-3 w-3 text-[#D4AF37]" aria-hidden />
              ) : (
                <Plus className="h-3 w-3 text-[#073C30]" aria-hidden />
              )}
              <span>Join Sunnah · {post.joinedCount ?? 8}</span>
            </button>
          )}
          {activeReactionChips.slice(0, 3).map(chip => (
            <button
              key={chip.id}
              type="button"
              data-wall-like={chip.id === 'amin' ? post.id : undefined}
              data-ameen-btn={chip.id === 'amin' ? post.id : undefined}
              data-wall-reaction={chip.id}
              data-asma-pill={chip.isAsma ? chip.label : undefined}
              aria-pressed={chip.active}
              onClick={() => onReact(post.id, chip.id)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition ${
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
          <div className="relative shrink-0">
            <button
              type="button"
              data-wall-express-trigger={post.id}
              aria-expanded={expressOpen}
              onClick={() => setExpressOpen(open => !open)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-stone-600 transition hover:border-emerald-600/40 hover:bg-emerald-50/50 hover:text-emerald-900"
            >
              <SmilePlus className="h-3 w-3 text-emerald-700" aria-hidden />
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
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            data-wall-reply-trigger={post.id}
            aria-expanded={repliesOpen}
            onClick={() => setRepliesOpen(open => !open)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          >
            <MessageCircle className="h-3.5 w-3.5 text-stone-500" aria-hidden />
            <span>Reply</span>
            {(post.replies?.length ?? 0) > 0 && (
              <span className="rounded-full bg-stone-100 px-1.5 py-0.2 text-[10px] font-semibold text-stone-700">
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
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition ${
              post.saved
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {post.saved ? (
              <BookmarkCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            ) : (
              <Bookmark className="h-3.5 w-3.5 text-stone-500" aria-hidden />
            )}
            <span className="hidden sm:inline">{post.saved ? 'Saved' : 'Save'}</span>
          </button>

          <button
            type="button"
            data-wall-export-trigger={post.id}
            disabled={exporting}
            onClick={() => onExportCard(post)}
            title="Export 1200×675 HD Card"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
          >
            <Share2 className="h-3.5 w-3.5 text-stone-500" aria-hidden />
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

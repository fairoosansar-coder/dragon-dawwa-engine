import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Edit3,
  Globe,
  LogIn,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { SeekerAvatar } from '../SeekerAuthModal.tsx';
import { ReflectionModal, type PresetVerseOption } from './ReflectionModal.tsx';
import { WallPostCard } from './WallPostCard.tsx';
import { SEEKER_AUTH_EVENT, useSeekerAuth } from '../../lib/seekerAuth.ts';
import { useApp } from '../../lib/store.tsx';
import {
  formatQuotedTranslation,
  renderVerseImage,
} from '../../lib/verseImage.ts';
import {
  addFaithWallReply,
  deleteFaithWallPost,
  FAITH_WALL_EVENT,
  listFaithWallPosts,
  publishFaithWallPost,
  readingLinkHash,
  sanitizeWallTheme,
  toggleFaithWallBookmark,
  toggleFaithWallReaction,
  updateFaithWallPost,
  type FaithWallPost,
  type WallPostTheme,
} from '../../lib/verseShare.ts';
import type { Lang } from '../../shared/sources.ts';

export function WallFeed({ compact = false }: { compact?: boolean }) {
  const { saved } = useApp();
  const { user, openModal: openAuthModal } = useSeekerAuth();
  const [posts, setPosts] = useState<FaithWallPost[]>(() => listFaithWallPosts());
  const [wallView, setWallView] = useState<'community' | 'mine' | 'saved'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash.includes('view=mine')) return 'mine';
      if (window.location.hash.includes('view=saved')) return 'saved';
    }
    return 'community';
  });
  const [langFilter, setLangFilter] = useState<'all' | Lang>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setPosts(listFaithWallPosts());
    window.addEventListener(FAITH_WALL_EVENT, sync);
    window.addEventListener(SEEKER_AUTH_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAITH_WALL_EVENT, sync);
      window.removeEventListener(SEEKER_AUTH_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const isOwnedByUser = (post: FaithWallPost): boolean => {
    if (!user) return false;
    if (post.userId && post.userId === user.id) return true;
    return false;
  };

  const myPosts = useMemo(
    () => (user ? posts.filter(post => isOwnedByUser(post)) : []),
    [posts, user],
  );
  const savedPosts = useMemo(
    () => posts.filter(post => post.saved),
    [posts],
  );
  const myTotalAmeen = useMemo(
    () => myPosts.reduce((sum, post) => sum + (post.likes ?? 1), 0),
    [myPosts],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = !compact && wallView === 'mine' ? myPosts : !compact && wallView === 'saved' ? savedPosts : posts;
    return base.filter(post => {
      if (langFilter !== 'all' && post.lang !== langFilter) return false;
      if (!q) return true;
      return (
        post.surahName.toLowerCase().includes(q) ||
        `${post.surah}:${post.ayah}`.includes(q) ||
        post.translation.toLowerCase().includes(q) ||
        post.reflection.toLowerCase().includes(q) ||
        (post.authorName ?? '').toLowerCase().includes(q)
      );
    });
  }, [posts, myPosts, savedPosts, compact, wallView, langFilter, searchQuery]);

  const displayed = compact ? filtered.slice(0, 2) : filtered;

  const handleReact = (postId: string, reactionId: string) => {
    setPosts(toggleFaithWallReaction(postId, reactionId));
  };

  const handleToggleSave = (postId: string) => {
    setPosts(toggleFaithWallBookmark(postId));
  };

  const handleAddReply = async (postId: string, text: string) => {
    await addFaithWallReply(postId, text);
    setPosts(listFaithWallPosts());
  };

  const handleCopy = async (post: FaithWallPost) => {
    const text = [
      post.arabic,
      formatQuotedTranslation(post.translation),
      post.reflection ? `Reflection: “${post.reflection}” — ${post.authorName || 'Community Seeker'}` : '',
      `Surah ${post.surahName} ${post.surah}:${post.ayah} · Dragon Dawwa Faith Wall`,
    ]
      .filter(Boolean)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(post.id);
      window.setTimeout(() => setCopiedId(current => (current === post.id ? null : current)), 2200);
    } catch {
      /* ignore */
    }
  };

  const handleExportCard = async (post: FaithWallPost) => {
    setDownloadingId(post.id);
    const drawn = await renderVerseImage(
      {
        surah: post.surah,
        ayah: post.ayah,
        surahName: post.surahName,
        arabic: post.arabic,
        translation: post.translation,
      },
      post.lang,
      sanitizeWallTheme(post.theme),
    );
    setDownloadingId(null);
    if ('error' in drawn) {
      setToast(drawn.error);
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = drawn.sheet;
    anchor.download = `verse-${post.surah}-${post.ayah}.png`;
    anchor.click();
    setToast(`Exported 1200×675 HD card (${sanitizeWallTheme(post.theme)} theme).`);
    window.setTimeout(() => setToast(null), 2600);
  };

  const handleCreatePost = async (input: {
    preset: PresetVerseOption;
    reflection: string;
    authorName: string;
    theme: WallPostTheme;
  }) => {
    const { preset, reflection, authorName, theme } = input;
    const hash = readingLinkHash({
      surah: preset.surah,
      ayah: preset.ayah,
      lang: preset.lang,
      edition: preset.lang === 'ta' ? 'tamil_omar_brief' : preset.lang === 'si' ? 'sinhalese_mahir' : 'english_rwwad',
      mode: 'book',
    });
    await publishFaithWallPost({
      verse: {
        surah: preset.surah,
        ayah: preset.ayah,
        surahName: preset.surahName,
        arabic: preset.arabic,
        translation: preset.translation,
      },
      lang: preset.lang,
      url: hash,
      reflection,
      theme,
      authorName: user ? user.name : authorName,
      authorRole: user ? user.kunyah : undefined,
    });
    setPosts(listFaithWallPosts());
    setComposerOpen(false);
    setToast(user ? 'Published to your Personal Wall & Community Faith Wall!' : 'Shared to the Public Faith Wall!');
    window.setTimeout(() => setToast(null), 3200);
  };

  const handleSaveEdit = async (postId: string, reflection: string, theme: WallPostTheme) => {
    await updateFaithWallPost(postId, reflection, theme);
    setPosts(listFaithWallPosts());
    setToast('Updated your Faith Wall reflection.');
    window.setTimeout(() => setToast(null), 2800);
  };

  const handleDeletePost = async (postId: string) => {
    await deleteFaithWallPost(postId);
    setPosts(listFaithWallPosts());
    setToast('Removed reflection from your Faith Wall.');
    window.setTimeout(() => setToast(null), 2800);
  };

  return (
    <section data-faith-wall className="space-y-6">
      {/* Hero Banner */}
      <header
        data-faith-wall-hero
        style={{
          background: 'linear-gradient(135deg, #031812 0%, #0A2E23 55%, #041812 100%)',
        }}
        className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/45 p-5 text-[#F3E8C8] shadow-lg sm:p-8"
      >
        <img
          src="/assets/geometric-emerald.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right opacity-25"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#031812]/95 via-[#07271d]/85 to-[#031812]/65" />

        <div className="relative z-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#D4AF37]">
                <Globe className="h-3.5 w-3.5" aria-hidden />
                PUBLIC FAITH WALL
              </span>
              <span className="rounded-full border border-[#D4AF37]/25 bg-white/5 px-3 py-1 text-xs font-medium text-[#F3E8C8]/85">
                {posts.length} Illuminated Reflections
              </span>
              {user && (
                <span
                  data-wall-seeker-badge
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#0A2E23] px-3 py-1 text-xs font-semibold text-[#F9E7B9]"
                >
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-emerald-400">
                    <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={13} />
                  </span>
                  <span>{user.name}</span>
                  <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                </span>
              )}
            </div>

            <h2 className="font-display text-2xl font-bold leading-tight text-white sm:text-4xl">
              {!compact && wallView === 'mine'
                ? 'My Personal Faith Wall'
                : !compact && wallView === 'saved'
                  ? 'Saved Reflections'
                  : 'Community Faith Wall'}
            </h2>
            <p className="text-sm leading-relaxed text-[#F3E8C8]/80 sm:text-base">
              {!compact && wallView === 'mine'
                ? 'Your personal sanctuary of shared 16:9 Qur’an manuscript cards, reflections, and community Dhikr.'
                : 'Illuminated 16:9 Qur’an manuscript cards, contextual Asma-ul-Husna expressions, and personal reflections shared by the Dragon Dawwa community.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!compact && (
              <>
                <button
                  type="button"
                  data-faith-wall-open-composer
                  onClick={() => setComposerOpen(open => !open)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37] bg-[#D4AF37] px-4 py-2.5 text-sm font-semibold text-[#031812] shadow-sm transition hover:bg-[#e3c14d]"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  <span>Share a Reflection</span>
                </button>
                {!user && (
                  <button
                    type="button"
                    data-wall-hero-signin
                    onClick={() => openAuthModal()}
                    className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/55 bg-[#031812]/90 px-4 py-2.5 text-sm font-semibold text-[#F9E7B9] transition hover:border-[#D4AF37]"
                  >
                    <LogIn className="h-4 w-4 text-[#D4AF37]" aria-hidden />
                    <span>Sign In · My Wall</span>
                  </button>
                )}
              </>
            )}
            <a
              href={compact ? '#/quran/wall' : '#/quran/book'}
              data-faith-wall-cta
              className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/55 bg-[#0A2E23]/90 px-4 py-2.5 text-sm font-semibold text-[#F3E8C8] transition hover:border-[#D4AF37] hover:bg-[#0f3d2f]"
            >
              <Sparkles className="h-4 w-4 text-[#D4AF37]" aria-hidden />
              <span>{compact ? 'Explore Full Faith Wall' : 'Open Qur’an Reader'}</span>
            </a>
          </div>
        </div>

        {/* Inline Faith Wall Composer */}
        {!compact && composerOpen && (
          <div className="relative z-10 mt-6">
            <ReflectionModal
              open={composerOpen}
              inline
              onClose={() => setComposerOpen(false)}
              onPublish={handleCreatePost}
            />
          </div>
        )}
      </header>

      {toast && (
        <div
          role="status"
          data-faith-wall-toast
          className="mx-auto flex max-w-2xl items-center justify-between rounded-2xl border border-[#D4AF37]/60 bg-[#0A2E23] px-4 py-3 text-sm font-semibold text-[#F3E8C8] shadow-md"
        >
          <span>✦ {toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-xs text-[#D4AF37] hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Community Wall / My Wall / Saved Switcher + Filter & Search Toolbar (Full View) */}
      {!compact && (
        <div
          data-faith-wall-toolbar
          className="flex flex-col justify-between gap-3 rounded-2xl border border-pine/15 bg-parchment px-4 py-3 lg:flex-row lg:items-center"
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* View Switcher: Community Wall vs My Wall vs Saved */}
            <div
              role="group"
              aria-label="Faith Wall view"
              className="inline-flex flex-wrap rounded-full border border-[#073C30]/20 bg-white p-1 shadow-xs"
            >
              <button
                type="button"
                data-wall-view="community"
                aria-pressed={wallView === 'community'}
                onClick={() => setWallView('community')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  wallView === 'community'
                    ? 'bg-[#073C30] text-[#F5EEDC] shadow-xs'
                    : 'text-pine hover:bg-sand'
                }`}
              >
                <Globe className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>Community Wall ({posts.length})</span>
              </button>
              <button
                type="button"
                data-wall-view="mine"
                aria-pressed={wallView === 'mine'}
                onClick={() => setWallView('mine')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  wallView === 'mine'
                    ? 'bg-[#073C30] text-[#F5EEDC] shadow-xs'
                    : 'text-pine hover:bg-sand'
                }`}
              >
                <User className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>My Wall ({myPosts.length})</span>
              </button>
              <button
                type="button"
                data-wall-view="saved"
                aria-pressed={wallView === 'saved'}
                onClick={() => setWallView('saved')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  wallView === 'saved'
                    ? 'bg-[#073C30] text-[#F5EEDC] shadow-xs'
                    : 'text-pine hover:bg-sand'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>Saved ({savedPosts.length})</span>
              </button>
            </div>

            <div role="group" aria-label="Filter Faith Wall by language" className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Languages' },
                  { id: 'en', label: 'English' },
                  { id: 'ta', label: 'Tamil (தமிழ்)' },
                  { id: 'si', label: 'Sinhala (සිංහල)' },
                ] as const
              ).map(tab => {
                const active = langFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-wall-lang-filter={tab.id}
                    aria-pressed={active}
                    onClick={() => setLangFilter(tab.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-[#0A2E23] text-[#F3E8C8] shadow-sm ring-1 ring-[#D4AF37]/50'
                        : 'bg-white/80 text-pine hover:bg-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="relative block min-w-0 lg:w-68">
            <span className="sr-only">Search Faith Wall</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Filter by Surah, Ayah, or reflection…"
              className="w-full rounded-full border border-pine/20 bg-white py-1.5 pl-9 pr-4 text-xs text-ink placeholder:text-muted"
            />
          </label>
        </div>
      )}

      {/* Personal Wall (My Wall) Profile Header or Sign-in Gate */}
      {!compact && wallView === 'mine' && (
        user ? (
          <div
            data-my-wall-profile
            style={{
              background: 'linear-gradient(135deg, #041E17 0%, #0B382B 55%, #051C15 100%)',
            }}
            className="mx-auto max-w-2xl rounded-3xl border border-[#D4AF37]/50 p-5 text-[#F5EEDC] shadow-lg sm:p-6"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-400 bg-[#031812] shadow-md ring-2 ring-[#D4AF37]/40">
                  <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={28} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-xl font-bold text-white">{user.name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#D4AF37]">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      {user.authProvider === 'google' || user.provider === 'google' ? 'Verified Google Seeker' : 'Verified Seeker'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-[#D4AF37]">{user.kunyah}</p>
                  {user.bio ? (
                    <p className="mt-1 max-w-xl text-xs italic text-[#F5EEDC]/80">“{user.bio}”</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#031812]/80 px-3.5 py-2 text-center">
                  <p className="font-display text-lg font-bold text-[#D4AF37]">{myPosts.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#F5EEDC]/70">Shared Cards</p>
                </div>
                <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#031812]/80 px-3.5 py-2 text-center">
                  <p className="font-display text-lg font-bold text-[#D4AF37]">{myTotalAmeen}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#F5EEDC]/70">Dhikr Received</p>
                </div>
                <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#031812]/80 px-3.5 py-2 text-center">
                  <p className="font-display text-lg font-bold text-[#D4AF37]">{saved.verses.length + savedPosts.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#F5EEDC]/70">Saved</p>
                </div>
                <button
                  type="button"
                  data-my-wall-edit-profile
                  onClick={() => openAuthModal()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/50 bg-[#0A2E23] px-3.5 py-2.5 text-xs font-semibold text-[#F9E7B9] transition hover:border-[#D4AF37]"
                >
                  <Edit3 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            data-my-wall-signin-gate
            className="mx-auto flex max-w-2xl flex-col items-center justify-between gap-4 rounded-3xl border border-[#D4AF37]/45 bg-[#051C15] p-6 text-center text-[#F5EEDC] shadow-lg sm:flex-row sm:text-left"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
                ✦ Personal Faith Wall Sanctuary
              </p>
              <h3 className="font-display text-xl font-bold text-white">
                Sign in to curate your Personal Faith Wall
              </h3>
              <p className="max-w-xl text-xs leading-relaxed text-[#F5EEDC]/75 sm:text-sm">
                Save your illuminated 16:9 Qur’an verse cards under your verified Seeker name and kunyah, edit reflections anytime, and keep all your shared ayahs in one place.
              </p>
            </div>
            <button
              type="button"
              data-my-wall-gate-signin
              onClick={() => openAuthModal()}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-[#031812] shadow-md transition hover:bg-[#e3c14d]"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              <span>Sign In / Create Seeker Account</span>
            </button>
          </div>
        )
      )}

      {/* Empty State for My Wall when signed in */}
      {!compact && wallView === 'mine' && user && displayed.length === 0 && (
        <div
          data-my-wall-empty
          className="mx-auto max-w-2xl rounded-3xl border border-dashed border-[#073C30]/30 bg-parchment p-8 text-center"
        >
          <p className="font-display text-xl font-bold text-pine">
            Your Personal Faith Wall is ready for your first reflection
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Share an illuminated 16:9 verse card from the Qur’an Reader or use the composer above to publish your first reflection.
          </p>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#073C30] px-5 py-2.5 text-xs font-semibold text-[#F5EEDC] hover:bg-[#0A2E23]"
          >
            <Plus className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            <span>Share Your First Reflection</span>
          </button>
        </div>
      )}

      {/* Centered Single-Column Social Reflection Stream (max-w-2xl mx-auto space-y-6) */}
      <div
        data-faith-wall-grid
        data-faith-wall-stream
        className="mx-auto max-w-2xl space-y-6"
      >
        {displayed.map(post => (
          <WallPostCard
            key={post.id}
            post={post}
            owned={isOwnedByUser(post)}
            onReact={handleReact}
            onToggleSave={handleToggleSave}
            onAddReply={handleAddReply}
            onExportCard={item => void handleExportCard(item)}
            onCopyPost={item => void handleCopy(item)}
            onSaveEdit={handleSaveEdit}
            onDeletePost={id => void handleDeletePost(id)}
            copied={copiedId === post.id}
            exporting={downloadingId === post.id}
          />
        ))}
      </div>
    </section>
  );
}

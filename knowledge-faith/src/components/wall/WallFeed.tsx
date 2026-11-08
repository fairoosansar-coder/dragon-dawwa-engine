import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Edit3,
  Globe,
  LogIn,
  Plus,
  Search,
  ShieldCheck,
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
  type CompletedPodcastOption,
  type FaithWallPost,
  type WallPostTheme,
  type WallPostType,
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
    type?: WallPostType;
    preset: PresetVerseOption;
    podcast?: CompletedPodcastOption;
    reflection: string;
    authorName: string;
    theme: WallPostTheme;
  }) => {
    const { type, preset, podcast, reflection, authorName, theme } = input;
    const hash =
      type === 'podcast'
        ? '#/podcast'
        : readingLinkHash({
            surah: preset.surah,
            ayah: preset.ayah,
            lang: preset.lang,
            edition: preset.lang === 'ta' ? 'tamil_omar_brief' : preset.lang === 'si' ? 'sinhalese_mahir' : 'english_rwwad',
            mode: 'book',
          });
    const created = await publishFaithWallPost({
      type: type ?? 'reflection',
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
      podcastId: podcast?.id,
      podcastTitle: podcast?.title,
      podcastAudioUrl: podcast?.audioUrl,
      podcastDuration: podcast?.duration,
      podcastCitations: podcast?.citations,
      hadithCollection: preset.hadithCollection,
      hadithNumber: preset.hadithNumber,
      hadithGrade: preset.hadithGrade,
      authorName: user ? user.name : authorName,
      authorRole: user ? user.kunyah : undefined,
    });
    setPosts(listFaithWallPosts());
    setComposerOpen(false);
    setToast(
      created.status === 'pending'
        ? 'Submitted for Admin Moderation Review! Track status on your Profile.'
        : user
          ? 'Published to your Personal Profile & Community Faith Wall!'
          : 'Shared to the Public Faith Wall!',
    );
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
    <section data-faith-wall className="mx-auto max-w-2xl space-y-4">
      {/* 1. Compact, Soft Light-Surface Top Header Card */}
      <header
        data-faith-wall-hero
        className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-900">
                <Globe className="h-3 w-3 text-emerald-700" aria-hidden />
                <span>Community Faith Wall</span>
              </span>
              <span className="text-[11px] text-stone-500">
                {posts.length} reflections
              </span>
            </div>

            <h2 className="font-display text-lg font-bold text-stone-900 sm:text-xl">
              {!compact && wallView === 'mine'
                ? 'My Personal Faith Wall'
                : !compact && wallView === 'saved'
                  ? 'Saved Reflections'
                  : 'Reflections & Illuminated Ayahs'}
            </h2>
            <p className="text-xs leading-relaxed text-stone-600 sm:text-[13px]">
              Share personal tadabbur, illuminated 16:9 Qur’an cards, and contextual Asma-ul-Husna dhikr.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {!compact ? (
              <>
                <a
                  href="#/profile"
                  data-wall-open-profile
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                >
                  <User className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                  <span>My Profile</span>
                </a>
                <a
                  href="#/admin"
                  data-wall-open-admin
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
                  <span>Admin Cockpit</span>
                </a>
                <button
                  type="button"
                  data-faith-wall-open-composer
                  data-open-reflection-modal
                  onClick={() => setComposerOpen(open => !open)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-3.5 py-2 text-xs font-semibold text-[#F5EEDC] shadow-xs transition hover:bg-[#0A2E23]"
                >
                  <Plus className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                  <span>Share a Reflection</span>
                </button>
              </>
            ) : (
              <a
                href="#/quran/wall"
                data-faith-wall-cta
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-3.5 py-1.5 text-xs font-semibold text-[#F5EEDC] transition hover:bg-[#0A2E23]"
              >
                <span>Open Faith Wall →</span>
              </a>
            )}
          </div>
        </div>

        {/* Modal / Inline Composer */}
        {!compact && composerOpen && (
          <div className="mt-4">
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
          className="flex items-center justify-between rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-950 shadow-xs"
        >
          <span>✦ {toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-xs text-emerald-800 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Sleek Single-Line Segmented Filter & Search Bar */}
      {!compact && (
        <div
          data-faith-wall-toolbar
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200/80 bg-white px-3 py-2 shadow-2xs"
        >
          {/* Segmented View Tabs */}
          <div
            role="group"
            aria-label="Faith Wall view"
            className="inline-flex items-center rounded-xl bg-stone-100 p-0.5"
          >
            <button
              type="button"
              data-wall-view="community"
              aria-pressed={wallView === 'community'}
              onClick={() => setWallView('community')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                wallView === 'community'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>Community ({posts.length})</span>
            </button>
            <button
              type="button"
              data-wall-view="mine"
              aria-pressed={wallView === 'mine'}
              onClick={() => setWallView('mine')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                wallView === 'mine'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <User className="h-3 w-3 text-emerald-700" aria-hidden />
              <span>My Wall ({myPosts.length})</span>
            </button>
            <button
              type="button"
              data-wall-view="saved"
              aria-pressed={wallView === 'saved'}
              onClick={() => setWallView('saved')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                wallView === 'saved'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Bookmark className="h-3 w-3 text-emerald-700" aria-hidden />
              <span>Saved ({savedPosts.length})</span>
            </button>
          </div>

          {/* Compact Language Pills + Search */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div role="group" aria-label="Filter Faith Wall by language" className="inline-flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'en', label: 'EN' },
                  { id: 'ta', label: 'தமிழ்' },
                  { id: 'si', label: 'සිංහල' },
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
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                      active
                        ? 'bg-[#073C30] text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200/75'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <label className="relative block w-36 sm:w-44">
              <span className="sr-only">Search Faith Wall</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" aria-hidden />
              <input
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search surah or note…"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 py-1 pl-7 pr-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:border-emerald-700 focus:bg-white focus:outline-none"
              />
            </label>
          </div>
        </div>
      )}

      {/* Personal Wall (My Wall) Profile Header or Sign-in Gate */}
      {!compact && wallView === 'mine' && (
        user ? (
          <div
            data-my-wall-profile
            className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#073C30] text-[#F5EEDC] ring-2 ring-emerald-600/35">
                  <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={24} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-lg font-bold text-stone-900">{user.name}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/20 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                      {user.authProvider === 'google' || user.provider === 'google' ? 'Verified Google Seeker' : 'Verified Seeker'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-emerald-800">{user.kunyah}</p>
                  {user.bio ? (
                    <p className="mt-1 max-w-xl text-xs italic text-stone-600">“{user.bio}”</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-center">
                  <p className="font-display text-base font-bold text-stone-900">{myPosts.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500">Cards</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-center">
                  <p className="font-display text-base font-bold text-stone-900">{myTotalAmeen}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500">Dhikr</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-center">
                  <p className="font-display text-base font-bold text-stone-900">{saved.verses.length + savedPosts.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500">Saved</p>
                </div>
                <button
                  type="button"
                  data-my-wall-edit-profile
                  onClick={() => openAuthModal()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
                >
                  <Edit3 className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            data-my-wall-signin-gate
            className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 text-center shadow-sm sm:flex-row sm:text-left"
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                ✦ Personal Faith Wall
              </p>
              <h3 className="font-display text-lg font-bold text-stone-900">
                Sign in to curate your Personal Faith Wall
              </h3>
              <p className="max-w-xl text-xs leading-relaxed text-stone-600">
                Save your illuminated 16:9 Qur’an verse cards under your verified Seeker name and kunyah, edit reflections anytime, and keep all your shared ayahs in one place.
              </p>
            </div>
            <button
              type="button"
              data-my-wall-gate-signin
              onClick={() => openAuthModal()}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#073C30] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0A2E23]"
            >
              <LogIn className="h-4 w-4 text-[#D4AF37]" aria-hidden />
              <span>Sign In</span>
            </button>
          </div>
        )
      )}

      {/* Empty State for My Wall when signed in */}
      {!compact && wallView === 'mine' && user && displayed.length === 0 && (
        <div
          data-my-wall-empty
          className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center"
        >
          <p className="font-display text-lg font-bold text-stone-900">
            Your Personal Faith Wall is ready for your first reflection
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-xs text-stone-500">
            Share an illuminated 16:9 verse card from the Qur’an Reader or use the button above to publish your first reflection.
          </p>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A2E23]"
          >
            <Plus className="h-4 w-4 text-[#D4AF37]" aria-hidden />
            <span>Share Your First Reflection</span>
          </button>
        </div>
      )}

      {/* Centered Single-Column Social Reflection Stream (max-w-2xl mx-auto space-y-4) */}
      <div
        data-faith-wall-grid
        data-faith-wall-stream
        className="space-y-4"
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

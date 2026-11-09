import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Edit3,
  Globe,
  Headphones,
  LogIn,
  Mic,
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
  resolveUserProfilePortfolio,
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

const SPOTLIGHT_ASMA = [
  { id: 'al_ahad', translit: 'Al-Aḥad', arabic: 'الْأَحَدُ', meaning: 'The Unique One', query: 'Al-Baqara' },
  { id: 'al_qayyum', translit: 'Al-Qayyūm', arabic: 'الْقَيُّومُ', meaning: 'The Sustainer', query: '2:255' },
  { id: 'al_fattah', translit: 'Al-Fattāḥ', arabic: 'الْفَتَّاحُ', meaning: 'The Opener of Relief', query: 'Ash-Sharh' },
  { id: 'al_alim', translit: 'Al-ʿAlīm', arabic: 'الْعَلِيمُ', meaning: 'The All-Knowing', query: '4:101' },
] as const;

const FEATURED_CONTRIBUTORS = [
  {
    id: 'drlaylaalqasimi',
    name: 'Dr. Layla al-Qasimi',
    role: 'Qur’anic Studies Fellow',
    emblem: 'rub-el-hizb' as const,
    topic: 'Surah Al-Baqara 2:255',
  },
  {
    id: 'brotherferozansar',
    name: 'Brother Feroz Ansar',
    role: 'Community Researcher',
    emblem: 'octagon-rosette' as const,
    topic: 'Surah An-Nisa 4:101 · Podcast',
  },
  {
    id: 'ustadhtariqm',
    name: 'Ustadh Tariq M.',
    role: 'Verified Teacher',
    emblem: 'crescent-star' as const,
    topic: 'Surah Ash-Sharh 94:5',
  },
  {
    id: 'sheikhfarhansiddiqui',
    name: 'Sheikh Farhan Siddiqui',
    role: 'Classical Tafsir Circle',
    emblem: 'emerald-lamp' as const,
    topic: 'Surah Al-Baqara 2:286',
  },
] as const;

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
  const [composerDoor, setComposerDoor] = useState<'reflection' | 'podcast' | null>(null);
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

  const portfolio = useMemo(() => resolveUserProfilePortfolio('me'), [posts, user]);

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
        (post.authorName ?? '').toLowerCase().includes(q) ||
        (post.podcastTitle ?? '').toLowerCase().includes(q)
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

  if (compact) {
    return (
      <section data-faith-wall className="space-y-4">
        <header
          data-faith-wall-hero
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                <Globe className="h-3 w-3 text-emerald-700" aria-hidden />
                <span>Community Faith Wall</span>
              </span>
              <span className="text-xs text-stone-500">{posts.length} reflections</span>
            </div>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-stone-900 sm:text-lg">
              Reflections & Illuminated Ayahs
            </h2>
          </div>
          <a
            href="#/quran/wall"
            data-faith-wall-cta
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-3.5 py-2 text-xs font-semibold text-[#F5EEDC] transition hover:bg-[#0A2E23]"
          >
            <span>Open Faith Wall →</span>
          </a>
        </header>

        <div data-faith-wall-grid data-faith-wall-stream className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

  return (
    <section
      data-faith-wall
      className="mx-auto w-full max-w-[1240px]"
    >
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[245px_minmax(0,1fr)_285px]">
        {/* LEFT RAIL: Seeker Identity Card & Social Navigation (Desktop XL) */}
        <aside
          data-faith-wall-left-rail
          className="hidden space-y-4 xl:block"
        >
          <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xs">
            <div className="relative h-16 w-full bg-[#073C30]">
              <img
                src={portfolio.bannerUrl || '/assets/banner-art.jpg'}
                alt=""
                className="h-full w-full object-cover opacity-80"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>

            <div className="px-4 pb-4">
              <div className="-mt-7 flex items-end justify-between">
                <a
                  href="#/profile"
                  className="inline-flex h-13 w-13 items-center justify-center overflow-hidden rounded-full bg-stone-900 text-[#F5EEDC] shadow-md ring-3 ring-white"
                >
                  <SeekerAvatar
                    avatarUrl={portfolio.avatarUrl}
                    name={portfolio.name}
                    emblem={portfolio.emblem}
                    size={24}
                  />
                </a>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800/15 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" aria-hidden />
                  <span>Verified</span>
                </span>
              </div>

              <div className="mt-2.5">
                <a
                  href="#/profile"
                  className="block truncate text-sm font-semibold text-stone-900 hover:text-[#073C30] hover:underline"
                >
                  {portfolio.name}
                </a>
                <p className="truncate font-mono text-[11px] text-stone-500">
                  {portfolio.handle}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-600">
                  {portfolio.roleBadge}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3 text-center">
                <a
                  href="#/profile"
                  className="rounded-xl border border-stone-200/80 bg-stone-50/80 px-2 py-1.5 transition hover:border-stone-300"
                >
                  <p className="text-xs font-bold text-stone-900">{portfolio.reflectionsCount}</p>
                  <p className="text-[10px] text-stone-500">Reflections</p>
                </a>
                <a
                  href="#/profile"
                  className="rounded-xl border border-stone-200/80 bg-stone-50/80 px-2 py-1.5 transition hover:border-stone-300"
                >
                  <p className="text-xs font-bold text-stone-900">{portfolio.podcastsCount}</p>
                  <p className="text-[10px] text-stone-500">Podcasts</p>
                </a>
              </div>
            </div>
          </div>

          {/* Feed & Studio Quick Navigation */}
          <nav
            aria-label="Faith Wall navigation"
            className="rounded-2xl border border-stone-200/80 bg-white p-2 shadow-2xs"
          >
            <button
              type="button"
              onClick={() => setWallView('community')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                wallView === 'community'
                  ? 'bg-emerald-50/80 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                <span>Community Feed</span>
              </span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                {posts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setWallView('mine')}
              className={`mt-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                wallView === 'mine'
                  ? 'bg-emerald-50/80 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                <span>My Personal Wall</span>
              </span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                {myPosts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setWallView('saved')}
              className={`mt-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                wallView === 'saved'
                  ? 'bg-emerald-50/80 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Bookmark className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                <span>Saved Bookmarks</span>
              </span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                {savedPosts.length}
              </span>
            </button>

            <div className="my-1.5 border-t border-stone-100" />

            <a
              href="#/profile"
              data-wall-open-profile
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50 hover:text-stone-900"
            >
              <span className="inline-flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-[#073C30]" aria-hidden />
                <span>My Profile & Settings</span>
              </span>
              <span className="text-[11px] text-stone-400">→</span>
            </a>
          </nav>
        </aside>

        {/* CENTER FEED COLUMN: Unified Social Composer & Filter Card + Post Stream */}
        <div data-faith-wall-center className="min-w-0 space-y-4">
          {/* Unified Social Composer & Filter Header Card */}
          <header
            data-faith-wall-hero
            className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs"
          >
            {/* Top Row: Avatar + Interactive Social Prompt Trigger + 2-Door Quick Actions */}
            <div className="flex items-center gap-3">
              <a
                href="#/profile"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#073C30] text-[#F5EEDC] ring-2 ring-emerald-600/30"
              >
                <SeekerAvatar
                  avatarUrl={user?.avatarUrl}
                  name={user?.name}
                  emblem={user?.emblem}
                  size={18}
                />
              </a>

              <button
                type="button"
                onClick={() => {
                  setComposerDoor('reflection');
                  setComposerOpen(true);
                }}
                className="flex min-w-0 flex-1 items-center justify-between rounded-full border border-stone-200 bg-stone-50/90 px-4 py-2 text-left text-xs text-stone-500 transition hover:border-stone-300 hover:bg-stone-100/80 sm:text-[13px]"
              >
                <span className="truncate">
                  {wallView === 'mine'
                    ? 'Share a verse reflection or podcast to your personal wall…'
                    : 'Share a Qur’an reflection or completed research podcast…'}
                </span>
                <span className="ml-2 hidden shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-800 sm:inline-flex">
                  <Sparkles className="h-3 w-3 text-[#C6A15A]" aria-hidden />
                  <span>2-Door Studio</span>
                </span>
              </button>

              <button
                type="button"
                data-faith-wall-open-composer
                data-open-reflection-modal
                onClick={() => setComposerOpen(open => !open)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#073C30] px-3.5 py-2 text-xs font-semibold text-[#F5EEDC] shadow-2xs transition hover:bg-[#0A2E23]"
              >
                <Plus className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>Share</span>
              </button>
            </div>

            {/* Inline Composer Drawer when opened */}
            {composerOpen && (
              <div className="mt-3.5">
                <ReflectionModal
                  open={composerOpen}
                  inline
                  initialDoor={composerDoor}
                  onClose={() => setComposerOpen(false)}
                  onPublish={handleCreatePost}
                />
              </div>
            )}

            {/* Bottom Row of Unified Header: Segmented Feed Tabs + Language Filter + Search */}
            <div
              data-faith-wall-toolbar
              className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3"
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
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    wallView === 'community'
                      ? 'bg-white font-semibold text-stone-900 shadow-2xs'
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
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    wallView === 'mine'
                      ? 'bg-white font-semibold text-stone-900 shadow-2xs'
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
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    wallView === 'saved'
                      ? 'bg-white font-semibold text-stone-900 shadow-2xs'
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
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                          active
                            ? 'bg-[#073C30] font-semibold text-white'
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
          </header>

          {toast && (
            <div
              role="status"
              data-faith-wall-toast
              className="flex items-center justify-between rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-950 shadow-2xs"
            >
              <span>✦ {toast}</span>
              <button type="button" onClick={() => setToast(null)} className="text-xs text-emerald-800 hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Personal Wall (My Wall) Profile Header or Sign-in Gate */}
          {wallView === 'mine' && (
            user ? (
              <div
                data-my-wall-profile
                className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#073C30] text-[#F5EEDC] ring-2 ring-emerald-600/35">
                      <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={22} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-stone-900">{user.name}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/20 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                          <ShieldCheck className="h-3 w-3 text-emerald-600" aria-hidden />
                          {user.authProvider === 'google' || user.provider === 'google' ? 'Verified Google Seeker' : 'Verified Seeker'}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-emerald-800">{user.kunyah}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1 text-center">
                      <p className="text-xs font-bold text-stone-900">{myPosts.length}</p>
                      <p className="text-[10px] text-stone-500">Cards</p>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1 text-center">
                      <p className="text-xs font-bold text-stone-900">{myTotalAmeen}</p>
                      <p className="text-[10px] text-stone-500">Dhikr</p>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1 text-center">
                      <p className="text-xs font-bold text-stone-900">{saved.verses.length + savedPosts.length}</p>
                      <p className="text-[10px] text-stone-500">Saved</p>
                    </div>
                    <button
                      type="button"
                      data-my-wall-edit-profile
                      onClick={() => openAuthModal()}
                      className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      <Edit3 className="h-3 w-3 text-emerald-700" aria-hidden />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                data-my-wall-signin-gate
                className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-4 text-center shadow-2xs sm:flex-row sm:text-left"
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    ✦ Personal Faith Wall
                  </p>
                  <h3 className="text-base font-semibold text-stone-900">
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
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#073C30] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#0A2E23]"
                >
                  <LogIn className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                  <span>Sign In</span>
                </button>
              </div>
            )
          )}

          {/* Empty State for My Wall when signed in */}
          {wallView === 'mine' && user && displayed.length === 0 && (
            <div
              data-my-wall-empty
              className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center"
            >
              <p className="text-base font-semibold text-stone-900">
                Your Personal Faith Wall is ready for your first reflection
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-stone-500">
                Share an illuminated 16:9 verse card from the Qur’an Reader or use the composer above to publish your first reflection.
              </p>
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0A2E23]"
              >
                <Plus className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>Share Your First Reflection</span>
              </button>
            </div>
          )}

          {/* Social Post Stream */}
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
        </div>

        {/* RIGHT RAIL: Asma-ul-Husna Spotlight, Active Scholars & 2-Door Studio Card (Desktop LG+) */}
        <aside
          data-faith-wall-right-rail
          className="hidden space-y-4 lg:block"
        >
          {/* 1. Contextual Asma-ul-Husna Spotlight */}
          <div
            data-wall-right-asma
            className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900">
                <Sparkles className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
                <span>Asma-ul-Husna in Feed</span>
              </span>
              <a
                href="#/spiritual/names"
                className="text-[11px] font-medium text-emerald-800 hover:underline"
              >
                All 99 →
              </a>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
              Click a Divine Name to filter reflections anchored to its verses:
            </p>

            <div className="mt-2.5 space-y-1.5">
              {SPOTLIGHT_ASMA.map(item => {
                const active = searchQuery === item.query;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSearchQuery(active ? '' : item.query)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? 'border-amber-400 bg-amber-50/90 text-amber-950'
                        : 'border-stone-200/80 bg-stone-50/60 hover:border-amber-300 hover:bg-amber-50/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-stone-900">
                        ✦ {item.translit}
                      </p>
                      <p className="truncate text-[11px] text-stone-500">{item.meaning}</p>
                    </div>
                    <span lang="ar" dir="rtl" className="quran-face text-base text-amber-900">
                      {item.arabic}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Featured Community Scholars & Contributors */}
          <div
            data-wall-right-contributors
            className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-stone-900">
                Verified Contributors
              </h3>
              <a
                href="#/profile"
                className="text-[11px] font-medium text-emerald-800 hover:underline"
              >
                My Profile →
              </a>
            </div>
            <p className="mt-0.5 text-[11px] text-stone-500">
              Explore portfolios of scholars and community researchers:
            </p>

            <ul className="mt-3 space-y-2.5">
              {FEATURED_CONTRIBUTORS.map(person => (
                <li key={person.id}>
                  <a
                    href={`#/profile/${person.id}`}
                    className="group flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-stone-50"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#073C30] text-[#F5EEDC] ring-1 ring-emerald-600/30">
                      <SeekerAvatar name={person.name} emblem={person.emblem} size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-stone-900 group-hover:text-[#073C30] group-hover:underline">
                        {person.name}
                      </p>
                      <p className="truncate text-[11px] text-stone-500">
                        {person.role} · {person.topic}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Controlled 2-Door Studio Quick Launch */}
          <div
            data-wall-right-guidelines
            className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs"
          >
            <p className="text-xs font-semibold text-stone-900">
              Controlled 2-Door Publishing
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
              Every post on the Faith Wall is anchored to a verified Qur’an/Hadith text or a completed Research Podcast episode.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setComposerDoor('reflection');
                  setComposerOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2 text-[11px] font-semibold text-stone-800 transition hover:border-emerald-700/40 hover:bg-emerald-50/50"
              >
                <BookOpen className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                <span>Ayah Card</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setComposerDoor('podcast');
                  setComposerOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2 text-[11px] font-semibold text-stone-800 transition hover:border-emerald-700/40 hover:bg-emerald-50/50"
              >
                <Headphones className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
                <span>Podcast</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

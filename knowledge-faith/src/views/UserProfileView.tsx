import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  Clock,
  Edit3,
  Headphones,
  Image as ImageIcon,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { ViewProps } from '../App.tsx';
import { SeekerAvatar } from '../components/SeekerAuthModal.tsx';
import { ReflectionModal, type PresetVerseOption } from '../components/wall/ReflectionModal.tsx';
import { WallPostCard } from '../components/wall/WallPostCard.tsx';
import { SEEKER_AUTH_EVENT, useSeekerAuth } from '../lib/seekerAuth.ts';
import { formatQuotedTranslation, renderVerseImage } from '../lib/verseImage.ts';
import {
  addFaithWallReply,
  ADMIN_SETTINGS_EVENT,
  deleteFaithWallPost,
  FAITH_WALL_EVENT,
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
} from '../lib/verseShare.ts';

const BANNER_PRESETS = [
  { id: 'banner-art', label: 'Mamluk Gold Arch', url: '/assets/banner-art.jpg' },
  { id: 'emerald-arabesque', label: 'Emerald Arabesque', url: '/assets/geometric-emerald.jpg' },
  { id: 'royal-amethyst', label: 'Royal Amethyst', url: '/assets/geometric-studio.jpg' },
  { id: 'carved-mihrab', label: 'Carved Mihrab', url: '/assets/geometric-carved-arch.jpg' },
] as const;

export function UserProfileView({ sub }: ViewProps) {
  const { user, updateProfile, openModal: openAuthModal } = useSeekerAuth();
  const [tick, setTick] = useState(0);
  const [portfolioTab, setPortfolioTab] = useState<'all' | 'reflections' | 'podcasts'>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingBannerOpen, setEditingBannerOpen] = useState(false);
  const [customBannerDraft, setCustomBannerDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setTick(n => n + 1);
    window.addEventListener(FAITH_WALL_EVENT, sync);
    window.addEventListener(SEEKER_AUTH_EVENT, sync);
    window.addEventListener(ADMIN_SETTINGS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAITH_WALL_EVENT, sync);
      window.removeEventListener(SEEKER_AUTH_EVENT, sync);
      window.removeEventListener(ADMIN_SETTINGS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const portfolio = useMemo(() => resolveUserProfilePortfolio(sub), [sub, tick, user]);

  useEffect(() => {
    setCustomBannerDraft(portfolio.bannerUrl);
    setBioDraft(portfolio.bio);
  }, [portfolio.bannerUrl, portfolio.bio]);

  const filteredPosts = useMemo(() => {
    if (portfolioTab === 'reflections') {
      return portfolio.approvedPosts.filter(p => (p.type ?? 'reflection') === 'reflection');
    }
    if (portfolioTab === 'podcasts') {
      return portfolio.approvedPosts.filter(p => p.type === 'podcast');
    }
    return portfolio.approvedPosts;
  }, [portfolio.approvedPosts, portfolioTab]);

  const joinedLabel = useMemo(() => {
    try {
      const d = new Date(portfolio.joinedAt);
      if (Number.isNaN(d.getTime())) return 'Joined Oct 2026';
      return `Joined ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    } catch {
      return 'Joined Oct 2026';
    }
  }, [portfolio.joinedAt]);

  const handleSaveBannerAndBio = async (bannerUrl: string) => {
    if (!user) return;
    await updateProfile({
      name: user.name,
      kunyah: user.kunyah,
      bio: bioDraft,
      emblem: user.emblem,
      bannerUrl,
    });
    setEditingBannerOpen(false);
    setTick(n => n + 1);
    setToast('Updated your profile banner & bio.');
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
    setComposerOpen(false);
    setTick(n => n + 1);
    setToast(
      created.status === 'pending'
        ? 'Submitted for Admin Moderation Review!'
        : 'Published to your Portfolio & Community Faith Wall!',
    );
    window.setTimeout(() => setToast(null), 3200);
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

  return (
    <section data-user-profile-view className="mx-auto max-w-2xl space-y-5">
      {/* Top Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href="#/quran/wall"
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs transition hover:bg-stone-50"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
          <span>Back to Community Faith Wall</span>
        </a>

        <div className="flex items-center gap-2">
          <a
            href="#/admin"
            data-profile-open-admin
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs transition hover:bg-stone-50"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
            <span>Admin Cockpit</span>
          </a>
          {portfolio.isSelf && (
            <button
              type="button"
              data-profile-open-composer
              onClick={() => setComposerOpen(open => !open)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-3.5 py-1.5 text-xs font-semibold text-[#F5EEDC] shadow-xs transition hover:bg-[#0A2E23]"
            >
              <Plus className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              <span>Share Contribution</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Header Card: Hero Banner + Overlapping Avatar + Identity Bar + Counter Chips */}
      <div
        data-profile-header-card
        className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm"
      >
        {/* 1. Hero Banner Area (~160px desktop, ~120px mobile) */}
        <div
          data-profile-hero-banner
          className="relative h-32 w-full overflow-hidden bg-[#073C30] sm:h-40"
        >
          <img
            src={portfolio.bannerUrl}
            alt=""
            className="h-full w-full object-cover object-center opacity-85"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

          {portfolio.isSelf && (
            <div className="absolute right-3 top-3 flex items-center gap-2">
              <button
                type="button"
                data-profile-customize-banner
                onClick={() => setEditingBannerOpen(open => !open)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-black/70"
              >
                <ImageIcon className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>Customize Banner</span>
              </button>
              <button
                type="button"
                data-profile-edit-account
                onClick={() => openAuthModal()}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-black/70"
              >
                <Edit3 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>Edit Identity</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. Avatar & Identity Bar */}
        <div className="relative px-5 pb-5 sm:px-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            {/* Overlapping Circular Avatar */}
            <span
              data-profile-avatar
              className="inline-flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-900 text-[#F5EEDC] shadow-lg ring-4 ring-emerald-600/40"
            >
              <SeekerAvatar
                avatarUrl={portfolio.avatarUrl}
                name={portfolio.name}
                emblem={portfolio.emblem}
                size={36}
              />
            </span>

            {/* Counter Chips: Reflections Shared & Podcasts Produced */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <div
                data-profile-reflections-count
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2"
              >
                <BookOpen className="h-4 w-4 text-emerald-700" aria-hidden />
                <div>
                  <span className="font-display text-sm font-bold text-stone-900">
                    {portfolio.reflectionsCount}
                  </span>
                  <span className="ml-1.5 text-xs text-stone-500">Reflections Shared</span>
                </div>
              </div>

              <div
                data-profile-podcasts-count
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2"
              >
                <Headphones className="h-4 w-4 text-[#C6A15A]" aria-hidden />
                <div>
                  <span className="font-display text-sm font-bold text-stone-900">
                    {portfolio.podcastsCount}
                  </span>
                  <span className="ml-1.5 text-xs text-stone-500">Podcasts Produced</span>
                </div>
              </div>
            </div>
          </div>

          {/* Display Name, Handle, Role Badge & Joined Date */}
          <div className="mt-3.5 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 data-profile-display-name className="font-display text-xl font-bold text-stone-900 sm:text-2xl">
                {portfolio.name}
              </h1>
              <span data-profile-handle className="font-mono text-xs text-stone-500">
                {portfolio.handle}
              </span>
              <span
                data-profile-role-badge
                className="inline-flex items-center gap-1 rounded-full border border-emerald-800/20 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                <span>{portfolio.roleBadge}</span>
              </span>
            </div>

            <p className="text-xs leading-relaxed text-stone-600 sm:text-sm">
              {portfolio.bio}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-stone-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-stone-400" aria-hidden />
                <span>{joinedLabel}</span>
              </span>
              {portfolio.isSelf && portfolio.pendingPosts.length > 0 && (
                <span
                  data-profile-pending-count
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900"
                >
                  <Clock className="h-3 w-3 text-amber-700" aria-hidden />
                  <span>{portfolio.pendingPosts.length} Pending Moderation Review</span>
                </span>
              )}
            </div>
          </div>

          {/* Inline Banner & Bio Customizer Drawer */}
          {portfolio.isSelf && editingBannerOpen && (
            <div
              data-profile-banner-drawer
              className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4"
            >
              <p className="text-xs font-semibold text-stone-800">
                Choose Profile Banner Preset or Custom URL
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BANNER_PRESETS.map(preset => {
                  const active = customBannerDraft === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCustomBannerDraft(preset.url)}
                      className={`overflow-hidden rounded-xl border-2 text-left transition ${
                        active ? 'border-[#073C30] ring-2 ring-emerald-600/30' : 'border-stone-200'
                      }`}
                    >
                      <img src={preset.url} alt="" className="h-12 w-full object-cover" />
                      <span className="block truncate bg-white px-2 py-1 text-[11px] font-semibold text-stone-800">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-medium text-stone-700">
                  Custom Banner URL
                  <input
                    type="text"
                    value={customBannerDraft}
                    onChange={event => setCustomBannerDraft(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                  />
                </label>
                <label className="block text-xs font-medium text-stone-700">
                  Profile Bio
                  <input
                    type="text"
                    value={bioDraft}
                    onChange={event => setBioDraft(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBannerOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200/60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveBannerAndBio(customBannerDraft)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#073C30] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0A2E23]"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  <span>Save Banner & Bio</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2-Door Controlled Posting Modal */}
      <ReflectionModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPublish={handleCreatePost}
      />

      {toast && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-950"
        >
          <span>✦ {toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-xs text-emerald-800 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Profile Body: User's Portfolio Filter Tabs */}
      <div
        data-profile-portfolio-tabs
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200/80 bg-white px-3 py-2 shadow-2xs"
      >
        <div role="tablist" aria-label="Portfolio filter" className="inline-flex items-center rounded-xl bg-stone-100 p-0.5">
          {(
            [
              { id: 'all', label: `All Contributions (${portfolio.approvedPosts.length})` },
              { id: 'reflections', label: `Ayah Reflections (${portfolio.reflectionsCount})` },
              { id: 'podcasts', label: `Podcasts (${portfolio.podcastsCount})` },
            ] as const
          ).map(tab => {
            const active = portfolioTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-profile-tab={tab.id}
                aria-selected={active}
                onClick={() => setPortfolioTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <span className="px-2 text-[11px] font-medium text-stone-500">
          Showing verified approved portfolio items
        </span>
      </div>

      {/* Portfolio Feed Stream */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-[#C6A15A]" aria-hidden />
          <p className="mt-2 font-display text-base font-bold text-stone-900">
            No {portfolioTab === 'podcasts' ? 'podcast episodes' : 'reflections'} in this tab yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-stone-500">
            Use the 2-Door Publishing Studio to share a Qur’an/Hadith reflection or a completed Research Podcast episode.
          </p>
          {portfolio.isSelf && (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A2E23]"
            >
              <Plus className="h-4 w-4 text-[#D4AF37]" aria-hidden />
              <span>Share Contribution</span>
            </button>
          )}
        </div>
      ) : (
        <div data-profile-portfolio-feed className="space-y-6">
          {filteredPosts.map(post => (
            <WallPostCard
              key={post.id}
              post={post}
              owned={portfolio.isSelf}
              onReact={(postId, reactionId) => {
                toggleFaithWallReaction(postId, reactionId);
                setTick(n => n + 1);
              }}
              onToggleSave={postId => {
                toggleFaithWallBookmark(postId);
                setTick(n => n + 1);
              }}
              onAddReply={async (postId, text) => {
                await addFaithWallReply(postId, text);
                setTick(n => n + 1);
              }}
              onExportCard={item => void handleExportCard(item)}
              onCopyPost={item => void handleCopy(item)}
              onSaveEdit={async (postId, reflectionText, nextTheme) => {
                await updateFaithWallPost(postId, reflectionText, nextTheme);
                setTick(n => n + 1);
              }}
              onDeletePost={async postId => {
                await deleteFaithWallPost(postId);
                setTick(n => n + 1);
              }}
              copied={copiedId === post.id}
              exporting={downloadingId === post.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default UserProfileView;

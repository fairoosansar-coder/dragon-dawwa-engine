import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  Edit3,
  Globe,
  Heart,
  LogIn,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { SeekerAvatar } from './SeekerAuthModal.tsx';
import { SEEKER_AUTH_EVENT, useSeekerAuth } from '../lib/seekerAuth.ts';
import { useApp } from '../lib/store.tsx';
import {
  BRAND_FOOTER_LEFT,
  BRAND_FOOTER_RIGHT,
  CARD_BISMILLAH,
  formatQuotedTranslation,
  formatVerseCardBadge,
  renderVerseImage,
} from '../lib/verseImage.ts';
import {
  deleteFaithWallPost,
  FAITH_WALL_EVENT,
  listFaithWallPosts,
  publishFaithWallPost,
  readingLinkHash,
  toggleFaithWallLike,
  updateFaithWallPost,
  type FaithWallPost,
} from '../lib/verseShare.ts';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';

const FEATURED_VERSES: Array<{
  key: string;
  surah: number;
  ayah: number;
  surahName: string;
  lang: Lang;
  arabic: string;
  translation: string;
}> = [
  {
    key: '2:2',
    surah: 2,
    ayah: 2,
    surahName: 'Al-Baqara',
    lang: 'en',
    arabic: 'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ',
    translation: 'This is the Book about which there is no doubt, a guidance for the righteous.',
  },
  {
    key: '2:255',
    surah: 2,
    ayah: 255,
    surahName: 'Al-Baqara',
    lang: 'en',
    arabic: 'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ۚ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ',
    translation: 'Allah — there is no deity except Him, the Ever-Living, the All-Sustaining. Neither drowsiness overtakes Him nor sleep.',
  },
  {
    key: '94:5',
    surah: 94,
    ayah: 5,
    surahName: 'Ash-Sharh',
    lang: 'en',
    arabic: 'فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا',
    translation: 'For indeed, with hardship comes ease. Indeed, with hardship comes ease.',
  },
  {
    key: '1:2-ta',
    surah: 1,
    ayah: 2,
    surahName: 'Al-Faatiha',
    lang: 'ta',
    arabic: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    translation: 'புகழ் அனைத்தும் அகிலங்களின் இறைவனாகிய அல்லாஹ்வுக்கே உரியது.',
  },
  {
    key: '2:286-si',
    surah: 2,
    ayah: 286,
    surahName: 'Al-Baqara',
    lang: 'si',
    arabic: 'لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    translation: 'අල්ලාහ් කිසිදු ආත්මයකට එහි හැකියාවට වඩා බරක් නොපවරයි.',
  },
];

function formatWallDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Recent';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export function FaithWallFeed({ compact = false }: { compact?: boolean }) {
  const { saved } = useApp();
  const { user, openModal: openAuthModal } = useSeekerAuth();
  const [posts, setPosts] = useState<FaithWallPost[]>(() => listFaithWallPosts());
  const [wallView, setWallView] = useState<'community' | 'mine'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('view=mine')) return 'mine';
    return 'community';
  });
  const [langFilter, setLangFilter] = useState<'all' | Lang>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPresetKey, setSelectedPresetKey] = useState(FEATURED_VERSES[0].key);
  const [authorName, setAuthorName] = useState('');
  const [reflection, setReflection] = useState('');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
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
  const myTotalAmeen = useMemo(
    () => myPosts.reduce((sum, post) => sum + (post.likes ?? 1), 0),
    [myPosts],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = !compact && wallView === 'mine' ? myPosts : posts;
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
  }, [posts, myPosts, compact, wallView, langFilter, searchQuery]);

  const displayed = compact ? filtered.slice(0, 2) : filtered;

  const handleLike = (postId: string) => {
    setPosts(toggleFaithWallLike(postId));
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

  const handleDownload = async (post: FaithWallPost) => {
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

  const handleCreatePost = async (event: FormEvent) => {
    event.preventDefault();
    const preset = FEATURED_VERSES.find(item => item.key === selectedPresetKey) ?? FEATURED_VERSES[0];
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
      authorName: user ? user.name : authorName,
      authorRole: user ? user.kunyah : undefined,
    });
    setPosts(listFaithWallPosts());
    setReflection('');
    setComposerOpen(false);
    setToast(user ? 'Published to your Personal Wall & Community Faith Wall!' : 'Shared to the Public Faith Wall!');
    window.setTimeout(() => setToast(null), 3200);
  };

  const handleSaveEdit = async (postId: string) => {
    await updateFaithWallPost(postId, editingDraft);
    setPosts(listFaithWallPosts());
    setEditingPostId(null);
    setEditingDraft('');
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
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full">
                    <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={13} />
                  </span>
                  <span>{user.name}</span>
                  <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                </span>
              )}
            </div>

            <h2 className="font-display text-2xl font-bold leading-tight text-white sm:text-4xl">
              {!compact && wallView === 'mine' ? 'My Personal Faith Wall' : 'Community Faith Wall'}
            </h2>
            <p className="text-sm leading-relaxed text-[#F3E8C8]/80 sm:text-base">
              {!compact && wallView === 'mine'
                ? 'Your personal sanctuary of shared 16:9 Qur’an manuscript cards, reflections, and community Ameens.'
                : 'Illuminated 16:9 Qur’an manuscript cards, verified translations, and personal reflections shared by the Dragon Dawwa community.'}
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
          <form
            data-faith-wall-composer
            onSubmit={event => void handleCreatePost(event)}
            className="relative z-10 mt-6 rounded-2xl border border-[#D4AF37]/40 bg-[#031812]/90 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
                ✦ Share an Illuminated Ayah Reflection
              </p>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="text-xs text-[#F3E8C8]/70 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#F3E8C8]/85">
                Select Ayah
                <select
                  value={selectedPresetKey}
                  onChange={event => setSelectedPresetKey(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#0A2E23] px-3 py-2 text-sm text-[#F3E8C8] focus:border-[#D4AF37] focus:outline-none"
                >
                  {FEATURED_VERSES.map(item => (
                    <option key={item.key} value={item.key}>
                      Surah {item.surahName} {item.surah}:{item.ayah} ({LANGUAGE_NAMES[item.lang].english})
                    </option>
                  ))}
                </select>
              </label>

              {user ? (
                <div className="flex flex-col justify-end">
                  <span className="text-xs font-medium text-[#F3E8C8]/85">Publishing Identity</span>
                  <div className="mt-1.5 flex items-center justify-between rounded-xl border border-[#D4AF37]/40 bg-[#0A2E23] px-3.5 py-2 text-xs text-white">
                    <span className="flex items-center gap-2 truncate font-semibold">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
                        <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={15} />
                      </span>
                      <span>{user.name}</span>
                      <span className="text-[#D4AF37]">· {user.kunyah}</span>
                    </span>
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
                  </div>
                </div>
              ) : (
                <label className="block text-xs font-medium text-[#F3E8C8]/85">
                  Your Name or Kunyah (optional)
                  <input
                    type="text"
                    value={authorName}
                    onChange={event => setAuthorName(event.target.value)}
                    placeholder="e.g. Seeker of Knowledge"
                    className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#0A2E23] px-3 py-2 text-sm text-[#F3E8C8] placeholder:text-[#F3E8C8]/40 focus:border-[#D4AF37] focus:outline-none"
                  />
                </label>
              )}
            </div>

            <label className="mt-3 block text-xs font-medium text-[#F3E8C8]/85">
              Personal Reflection or Thought
              <input
                type="text"
                data-faith-wall-composer-input
                value={reflection}
                onChange={event => setReflection(event.target.value)}
                placeholder="Add a reflection or thought on how this verse speaks to your heart..."
                className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#0A2E23] px-3.5 py-2.5 text-sm text-[#F3E8C8] placeholder:text-[#F3E8C8]/45 focus:border-[#D4AF37] focus:outline-none"
              />
            </label>

            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
              {!user ? (
                <button
                  type="button"
                  onClick={() => openAuthModal()}
                  className="text-xs font-semibold text-[#D4AF37] hover:underline"
                >
                  ✦ Sign in to save this card to your Personal Wall
                </button>
              ) : (
                <span className="text-xs text-[#D4AF37]/85">
                  ✦ Will appear on both Community Wall and My Wall
                </span>
              )}
              <button
                type="submit"
                data-faith-wall-composer-submit
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-[#031812] transition hover:bg-[#e3c14d]"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                <span>{user ? 'Publish to My Wall & Community' : 'Publish to Public Faith Wall'}</span>
              </button>
            </div>
          </form>
        )}
      </header>

      {toast && (
        <div
          role="status"
          data-faith-wall-toast
          className="flex items-center justify-between rounded-2xl border border-[#D4AF37]/60 bg-[#0A2E23] px-4 py-3 text-sm font-semibold text-[#F3E8C8] shadow-md"
        >
          <span>✦ {toast}</span>
          <button type="button" onClick={() => setToast(null)} className="text-xs text-[#D4AF37] hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Community Wall / My Wall Switcher + Filter & Search Toolbar (Full View) */}
      {!compact && (
        <div
          data-faith-wall-toolbar
          className="flex flex-col justify-between gap-3 rounded-2xl border border-pine/15 bg-parchment px-4 py-3 lg:flex-row lg:items-center"
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* View Switcher: Community Wall vs My Wall */}
            <div
              role="group"
              aria-label="Faith Wall view"
              className="inline-flex rounded-full border border-[#073C30]/20 bg-white p-1 shadow-xs"
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
            className="rounded-3xl border border-[#D4AF37]/50 p-5 text-[#F5EEDC] shadow-lg sm:p-6"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#D4AF37]/60 bg-[#031812] shadow-md">
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
                  <p className="text-[10px] uppercase tracking-wider text-[#F5EEDC]/70">Ameen Received</p>
                </div>
                <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#031812]/80 px-3.5 py-2 text-center">
                  <p className="font-display text-lg font-bold text-[#D4AF37]">{saved.verses.length}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#F5EEDC]/70">Bookmarked Ayahs</p>
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
            className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-[#D4AF37]/45 bg-[#051C15] p-6 text-center text-[#F5EEDC] shadow-lg sm:flex-row sm:text-left"
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
          className="rounded-3xl border border-dashed border-[#073C30]/30 bg-parchment p-8 text-center"
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

      {/* Illuminated Manuscript Cards Grid */}
      <div
        data-faith-wall-grid
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        {displayed.map(post => {
          const badge = formatVerseCardBadge({
            surah: post.surah,
            ayah: post.ayah,
            surahName: post.surahName,
          });
          const quoted = formatQuotedTranslation(post.translation);
          const owned = isOwnedByUser(post);
          const isEditing = editingPostId === post.id;
          const openHref = post.url.startsWith('#')
            ? post.url
            : readingLinkHash({
                surah: post.surah,
                ayah: post.ayah,
                lang: post.lang,
                edition: post.lang === 'ta' ? 'tamil_omar_brief' : post.lang === 'si' ? 'sinhalese_mahir' : 'english_rwwad',
                mode: 'book',
              });

          return (
            <article
              key={post.id}
              data-faith-wall-card={post.id}
              className="flex flex-col overflow-hidden rounded-3xl border border-[#D4AF37]/45 bg-[#051C15] text-[#F3E8C8] shadow-xl"
            >
              {/* 16:9 Illuminated Manuscript Card Surface */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #031812 0%, #0A2E23 50%, #041812 100%)',
                }}
                className="relative flex min-h-[15.5rem] w-full flex-col justify-between overflow-hidden border-b border-[#D4AF37]/30 p-4 sm:aspect-[16/9] sm:min-h-0 sm:p-6"
              >
                {/* Double-line Gold Frame */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-2.5 rounded-2xl border-2 border-[#D4AF37]/45"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-4 rounded-xl border border-[#D4AF37]/20"
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
                    style={{ textShadow: '0 0 20px rgba(212,175,55,0.2)' }}
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
                <div className="relative z-10 flex items-center justify-between gap-2 border-t border-[#D4AF37]/20 px-1 pt-2 text-[10px] font-medium tracking-wide text-[#D4AF37]/70 sm:text-[11px]">
                  <span className="truncate">{BRAND_FOOTER_LEFT}</span>
                  <span className="shrink-0">{BRAND_FOOTER_RIGHT}</span>
                </div>
              </div>

              {/* Community Reflection & Interaction Dock */}
              <div className="flex flex-1 flex-col justify-between gap-3 bg-[#062119] p-4 sm:p-5">
                <div className="space-y-3">
                  {/* Contributor Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D4AF37]/40 bg-[#0A2E23]">
                        <SeekerAvatar
                          avatarUrl={post.authorAvatarUrl}
                          name={post.authorName}
                          emblem={post.authorEmblem}
                          size={16}
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-semibold text-white">
                            {post.authorName || 'Community Seeker'}
                          </p>
                          {post.verified && (
                            <ShieldCheck
                              className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]"
                              aria-label={post.authorAuthProvider === 'google' ? 'Verified Google Seeker' : 'Verified Seeker'}
                            />
                          )}
                          {owned && (
                            <span className="rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/15 px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                              You
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-[#D4AF37]/80">
                          {post.authorRole || 'Faith Wall Contributor'} · {formatWallDate(post.createdAt)}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full border border-[#D4AF37]/30 bg-[#031812] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                      {LANGUAGE_NAMES[post.lang]?.english ?? 'English'}
                    </span>
                  </div>

                  {/* Inline Reflection Editor or Quote Box */}
                  {isEditing ? (
                    <div data-wall-edit-box={post.id} className="space-y-2 rounded-2xl border border-[#D4AF37]/45 bg-[#031812]/90 p-3">
                      <input
                        type="text"
                        data-wall-edit-input={post.id}
                        value={editingDraft}
                        onChange={event => setEditingDraft(event.target.value)}
                        className="w-full rounded-xl border border-[#D4AF37]/35 bg-[#0A2E23] px-3 py-1.5 text-xs text-white focus:border-[#D4AF37] focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingPostId(null)}
                          className="text-xs text-[#F5EEDC]/70 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          data-wall-edit-save={post.id}
                          onClick={() => void handleSaveEdit(post.id)}
                          className="rounded-lg bg-[#D4AF37] px-3 py-1 text-xs font-bold text-[#031812] hover:bg-[#e3c14d]"
                        >
                          Save Reflection
                        </button>
                      </div>
                    </div>
                  ) : post.reflection ? (
                    <blockquote
                      lang={post.lang}
                      data-wall-card-reflection
                      className="rounded-2xl border border-[#D4AF37]/25 bg-[#031812]/80 px-3.5 py-2.5 text-xs italic leading-relaxed text-[#F3E8C8]/95 sm:text-sm"
                    >
                      “{post.reflection}”
                    </blockquote>
                  ) : null}
                </div>

                {/* Card Footer Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D4AF37]/15 pt-3">
                  <button
                    type="button"
                    data-wall-like={post.id}
                    aria-pressed={Boolean(post.liked)}
                    onClick={() => handleLike(post.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      post.liked
                        ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]'
                        : 'border-[#D4AF37]/30 bg-[#031812]/70 text-[#F3E8C8] hover:border-[#D4AF37]'
                    }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${post.liked ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-[#D4AF37]'}`} aria-hidden />
                    <span>Ameen · {post.likes ?? 1}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {owned && (
                      <>
                        <button
                          type="button"
                          data-wall-edit={post.id}
                          title="Edit your reflection"
                          onClick={() => {
                            setEditingPostId(post.id);
                            setEditingDraft(post.reflection);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#031812]/70 text-[#F3E8C8] transition hover:border-[#D4AF37] hover:text-white"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          data-wall-delete={post.id}
                          title="Delete your reflection"
                          onClick={() => void handleDeletePost(post.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#031812]/70 text-[#F3E8C8] transition hover:border-red-400/60 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                        </button>
                      </>
                    )}

                    <a
                      href={openHref}
                      title="Open Ayah in Qur'an Reader"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4AF37]/30 bg-[#031812]/70 px-2.5 py-1.5 text-xs font-medium text-[#F3E8C8] transition hover:border-[#D4AF37] hover:text-white"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                      <span>Open Ayah</span>
                    </a>

                    <button
                      type="button"
                      title="Download 1200×675 HD Card"
                      disabled={downloadingId === post.id}
                      onClick={() => void handleDownload(post)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#031812]/70 text-[#F3E8C8] transition hover:border-[#D4AF37] hover:text-white disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                    </button>

                    <button
                      type="button"
                      title="Copy verse and reflection"
                      onClick={() => void handleCopy(post)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#031812]/70 text-[#F3E8C8] transition hover:border-[#D4AF37] hover:text-white"
                    >
                      {copiedId === post.id ? (
                        <Check className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

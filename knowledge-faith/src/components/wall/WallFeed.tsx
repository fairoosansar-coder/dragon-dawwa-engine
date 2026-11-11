import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  Check,
  Edit3,
  Globe,
  Headphones,
  Heart,
  LogIn,
  Pause,
  Play,
  Plus,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { pauseAudio, playAudio, useAudioState } from '../../lib/audio.ts';
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
  readCommunityCircle,
  readingLinkHash,
  sanitizeWallTheme,
  toggleCommunityCirclePart,
  toggleFaithWallBookmark,
  toggleFaithWallReaction,
  toggleSunnahJoin,
  updateFaithWallPost,
  type CompletedPodcastOption,
  type FaithWallPost,
  type GoodDeedCategory,
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

const GOOD_DEED_PRESETS: Record<
  GoodDeedCategory,
  {
    label: string;
    title: string;
    surah: number;
    ayah: number;
    surahName: string;
    arabic: string;
    translation: string;
    defaultNote: string;
  }
> = {
  charity: {
    label: 'Charity',
    title: 'Quiet Daily Sadaqah & Helping Someone in Need',
    surah: 2,
    ayah: 261,
    surahName: 'Al-Baqara',
    arabic: 'مَّثَلُ ٱلَّذِينَ يُنفِقُونَ أَمْوَٰلَهُمْ فِى سَبِيلِ ٱللَّهِ كَمَثَلِ حَبَّةٍ أَنۢبَتَتْ سَبْعَ سَنَابِلَ',
    translation: 'The example of those who spend their wealth in the way of Allah is like a seed which grows seven spikes.',
    defaultNote: 'Gave a quiet daily Sadaqah today—may Allah accept and bless every giver.',
  },
  dhikr: {
    label: 'Dhikr',
    title: 'Read Surah Al-Kahf on Friday & Morning Adhkar',
    surah: 18,
    ayah: 10,
    surahName: 'Al-Kahf',
    arabic: 'رَبَّنَآ ءَاتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا',
    translation: 'Our Lord, grant us from Yourself mercy and prepare for us from our affair right guidance.',
    defaultNote: 'Completed my morning Adhkar and Surah Al-Kahf recitation—join this Sunnah today!',
  },
  kindness: {
    label: 'Kindness',
    title: 'Good Word, Forgiveness & Kindness to Family and Neighbors',
    surah: 16,
    ayah: 90,
    surahName: 'An-Nahl',
    arabic: 'إِنَّ ٱللَّهَ يَأْمُرُ بِٱلْعَدْلِ وَٱلْإِحْسَٰنِ وَإِيتَآئِ ذِى ٱلْقُرْبَىٰ',
    translation: 'Indeed, Allah orders justice and good conduct and giving to relatives.',
    defaultNote: 'Reached out to family and shared a kind word today for the sake of Allah.',
  },
};

export function WallFeed({ compact = false }: { compact?: boolean }) {
  const { saved, lang } = useApp();
  const { user, openModal: openAuthModal } = useSeekerAuth();
  const audio = useAudioState();
  const [posts, setPosts] = useState<FaithWallPost[]>(() => listFaithWallPosts());
  const [circle, setCircle] = useState(() => readCommunityCircle());
  const [wallView, setWallView] = useState<'community' | 'mine' | 'saved'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash.includes('view=mine') || window.location.hash.includes('tab=mine')) return 'mine';
      if (window.location.hash.includes('view=saved') || window.location.hash.includes('tab=saved')) return 'saved';
    }
    return 'community';
  });
  const [langFilter, setLangFilter] = useState<'all' | Lang>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDoor, setComposerDoor] = useState<'reflection' | 'podcast' | null>(null);
  const [goodDeedOpen, setGoodDeedOpen] = useState(false);
  const [goodDeedAnonymous, setGoodDeedAnonymous] = useState(true);
  const [goodDeedCategory, setGoodDeedCategory] = useState<GoodDeedCategory>('dhikr');
  const [goodDeedNote, setGoodDeedNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const oneMinAudioId = 'daily-benefit-60s-audio';
  const oneMinPlaying = audio.id === oneMinAudioId && (audio.status === 'playing' || audio.status === 'loading');

  useEffect(() => {
    const sync = () => {
      setPosts(listFaithWallPosts());
      setCircle(readCommunityCircle());
    };
    const syncHashView = () => {
      if (typeof window === 'undefined') return;
      const h = window.location.hash;
      if (h.includes('view=mine') || h.includes('tab=mine')) setWallView('mine');
      else if (h.includes('view=saved') || h.includes('tab=saved')) setWallView('saved');
      else if (h.startsWith('#/quran/wall') || h.startsWith('#/hub/wall')) setWallView('community');
    };
    window.addEventListener(FAITH_WALL_EVENT, sync);
    window.addEventListener(SEEKER_AUTH_EVENT, sync);
    window.addEventListener('hashchange', syncHashView);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAITH_WALL_EVENT, sync);
      window.removeEventListener(SEEKER_AUTH_EVENT, sync);
      window.removeEventListener('hashchange', syncHashView);
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
        (post.authorName ?? '').toLowerCase().includes(q) ||
        (post.podcastTitle ?? '').toLowerCase().includes(q) ||
        (post.deedTitle ?? '').toLowerCase().includes(q)
      );
    });
  }, [posts, myPosts, savedPosts, compact, wallView, langFilter, searchQuery]);

  const displayed = compact ? filtered.slice(0, 2) : filtered;

  const handleReact = (postId: string, reactionId: string) => {
    setPosts(toggleFaithWallReaction(postId, reactionId));
  };

  const handleJoinSunnah = (postId: string) => {
    setPosts(toggleSunnahJoin(postId));
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

  const handlePublishGoodDeed = async () => {
    const spec = GOOD_DEED_PRESETS[goodDeedCategory];
    const hash = readingLinkHash({
      surah: spec.surah,
      ayah: spec.ayah,
      lang: 'en',
      edition: 'english_rwwad',
      mode: 'book',
    });
    await publishFaithWallPost({
      type: 'good_deed',
      isAnonymous: goodDeedAnonymous,
      deedCategory: goodDeedCategory,
      deedTitle: spec.title,
      verse: {
        surah: spec.surah,
        ayah: spec.ayah,
        surahName: spec.surahName,
        arabic: spec.arabic,
        translation: spec.translation,
      },
      lang: 'en',
      url: hash,
      reflection: goodDeedNote.trim() || spec.defaultNote,
      theme: 'emerald',
    });
    setPosts(listFaithWallPosts());
    setGoodDeedOpen(false);
    setGoodDeedNote('');
    setToast(
      goodDeedAnonymous
        ? 'Shared your Sunnah pledge anonymously! May Allah accept.'
        : 'Shared your Good Deed pledge to the Community Faith Wall!',
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
              onJoinSunnah={handleJoinSunnah}
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
      className="mx-auto w-full max-w-[1120px]"
    >
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_285px] xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* TABLE 2 (Center Feed Column): 1-Tap Daily Benefit Stories Row + 3-Pill Share Bar + Post Stream */}
        <div data-faith-wall-center className="min-w-0 space-y-4">
          {/* 1. Top of Center Feed: 4 Simple Daily Benefit Cards (Stories Row) */}
          <div
            data-testid="daily-benefit-stories"
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
          >
            {/* Card 1: Daily Ayah */}
            <a
              href={`#/quran/book?surah=94&ayah=5&lang=${lang}`}
              data-testid="daily-story-ayah"
              className="group flex flex-col justify-between rounded-2xl border border-[#D4AF37]/45 bg-white p-3 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-[#073C30]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4EFE4] text-[#073C30]">
                <BookOpen className="h-4 w-4" aria-hidden />
              </span>
              <div className="mt-2">
                <p className="text-xs font-bold text-stone-900 group-hover:text-[#073C30]">
                  Daily Ayah
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-stone-600">
                  Surah Ash-Sharh 94:5 · With hardship comes ease
                </p>
              </div>
            </a>

            {/* Card 2: Hadith of the Day */}
            <a
              href="#/hadith"
              data-testid="daily-story-hadith"
              className="group flex flex-col justify-between rounded-2xl border border-[#D4AF37]/45 bg-white p-3 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-[#073C30]"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4EFE4] text-[#073C30]">
                <ScrollText className="h-4 w-4" aria-hidden />
              </span>
              <div className="mt-2">
                <p className="text-xs font-bold text-stone-900 group-hover:text-[#073C30]">
                  Hadith of the Day
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-stone-600">
                  Consistent deeds are most beloved to Allah
                </p>
              </div>
            </a>

            {/* Card 3: 1-Min Audio */}
            <button
              type="button"
              data-testid="daily-story-audio"
              onClick={() => {
                if (oneMinPlaying) pauseAudio();
                else {
                  void playAudio(
                    oneMinAudioId,
                    'https://cdn.islamic.network/quran/audio/128/ar.alafasy/594.mp3',
                  );
                }
              }}
              className="group flex flex-col justify-between rounded-2xl border border-[#D4AF37]/45 bg-white p-3 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-[#073C30] cursor-pointer"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#073C30] text-[#D4AF37]">
                {oneMinPlaying ? (
                  <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                )}
              </span>
              <div className="mt-2">
                <p className="text-xs font-bold text-stone-900 group-hover:text-[#073C30]">
                  1-Min Audio
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-stone-600">
                  {oneMinPlaying ? 'Playing 60s reflection…' : '60s Studio Reflection'}
                </p>
              </div>
            </button>

            {/* Card 4: Sunnah Today */}
            <button
              type="button"
              data-testid="daily-story-sunnah"
              onClick={() => {
                setGoodDeedCategory('dhikr');
                setGoodDeedOpen(true);
              }}
              className="group flex flex-col justify-between rounded-2xl border border-[#D4AF37]/45 bg-white p-3 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-[#073C30] cursor-pointer"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#E8F2EC] text-[#073C30]">
                <Sparkles className="h-4 w-4 text-[#073C30]" aria-hidden />
              </span>
              <div className="mt-2">
                <p className="text-xs font-bold text-stone-900 group-hover:text-[#073C30]">
                  Sunnah Today
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-stone-600">
                  Read Surah Al-Kahf & Morning Adhkar
                </p>
              </div>
            </button>
          </div>

          {/* 2. Unified Social Composer & 3-Pill Share Bar (Ayah Card · Good Deed · Podcast) */}
          <header
            data-faith-wall-hero
            className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs"
          >
            {/* Top Row: Avatar + Interactive Social Prompt Trigger + Share CTA */}
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
                  setGoodDeedOpen(false);
                }}
                className="flex min-w-0 flex-1 items-center justify-between rounded-full border border-stone-200 bg-stone-50/90 px-4 py-2 text-left text-xs text-stone-600 transition hover:border-stone-300 hover:bg-stone-100/80 sm:text-[13px]"
              >
                <span className="truncate">
                  {wallView === 'mine'
                    ? 'Share a verse reflection, good deed, or podcast…'
                    : 'Share a Qur’an reflection, Sunnah good deed, or podcast…'}
                </span>
              </button>

              <button
                type="button"
                data-faith-wall-open-composer
                data-open-reflection-modal
                onClick={() => {
                  setGoodDeedOpen(false);
                  setComposerOpen(open => !open);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#073C30] px-3.5 py-2 text-xs font-semibold text-[#F5EEDC] shadow-2xs transition hover:bg-[#0A2E23]"
              >
                <Plus className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>Share</span>
              </button>
            </div>

            {/* Simple 3-Pill Share Bar: Ayah Card · Good Deed · Podcast */}
            <div
              data-testid="composer-three-pill-bar"
              className="mt-3 grid grid-cols-3 gap-2"
            >
              <button
                type="button"
                data-testid="composer-ayah-card-btn"
                onClick={() => {
                  setGoodDeedOpen(false);
                  setComposerDoor('reflection');
                  setComposerOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#D4AF37]/55 bg-[#FAF7F0] px-3 py-1.5 text-xs font-semibold text-stone-900 transition hover:border-[#073C30] hover:bg-emerald-50/50 cursor-pointer"
              >
                <BookOpen className="h-3.5 w-3.5 text-[#073C30]" aria-hidden />
                <span>Ayah Card</span>
              </button>

              <button
                type="button"
                data-testid="composer-good-deed-btn"
                aria-expanded={goodDeedOpen}
                onClick={() => {
                  setComposerOpen(false);
                  setGoodDeedOpen(open => !open);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  goodDeedOpen
                    ? 'border-[#073C30] bg-[#073C30] text-[#FFFFFF]'
                    : 'border-[#D4AF37]/55 bg-[#FAF7F0] text-stone-900 hover:border-[#073C30] hover:bg-emerald-50/50'
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${goodDeedOpen ? 'text-[#D4AF37]' : 'text-[#073C30]'}`} aria-hidden />
                <span>Good Deed</span>
              </button>

              <button
                type="button"
                data-testid="composer-podcast-btn"
                onClick={() => {
                  setGoodDeedOpen(false);
                  setComposerDoor('podcast');
                  setComposerOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#D4AF37]/55 bg-[#FAF7F0] px-3 py-1.5 text-xs font-semibold text-stone-900 transition hover:border-[#073C30] hover:bg-emerald-50/50 cursor-pointer"
              >
                <Headphones className="h-3.5 w-3.5 text-[#073C30]" aria-hidden />
                <span>Podcast</span>
              </button>
            </div>

            {/* Ultra-Simple 1-Tap Good Deed Composer Drawer (Anonymous Toggle + 3 Category Chips) */}
            {goodDeedOpen && (
              <div
                data-testid="good-deed-composer-drawer"
                className="mt-3 space-y-3 rounded-2xl border border-[#073C30]/20 bg-[#FAF7F0] p-3.5 text-stone-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-stone-900">
                      Share a Good Deed or Sunnah Pledge
                    </p>
                    <p className="text-[11px] text-stone-600">
                      Inspire others to join a Sunnah without showing off.
                    </p>
                  </div>

                  {/* Single Anonymous Seeker Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={goodDeedAnonymous}
                    data-testid="good-deed-anonymous-toggle"
                    onClick={() => setGoodDeedAnonymous(v => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 shadow-2xs cursor-pointer"
                  >
                    <span>Anonymous</span>
                    <span
                      className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                        goodDeedAnonymous ? 'bg-[#073C30] justify-end' : 'bg-stone-300 justify-start'
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full bg-white shadow-2xs" />
                    </span>
                  </button>
                </div>

                {/* 3 Quick Category Chips: Charity · Dhikr · Kindness */}
                <div className="grid grid-cols-3 gap-2">
                  {(['charity', 'dhikr', 'kindness'] as const).map(cat => {
                    const spec = GOOD_DEED_PRESETS[cat];
                    const active = goodDeedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        data-testid={`good-deed-cat-${cat}`}
                        aria-pressed={active}
                        onClick={() => setGoodDeedCategory(cat)}
                        style={
                          active
                            ? { backgroundColor: '#073C30', color: '#FFFFFF' }
                            : undefined
                        }
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                          active
                            ? 'border-[#073C30] bg-[#073C30] text-[#FFFFFF] shadow-2xs'
                            : 'border-stone-200 bg-white text-stone-800 hover:border-[#073C30]/40'
                        }`}
                      >
                        {spec.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    maxLength={240}
                    value={goodDeedNote}
                    onChange={event => setGoodDeedNote(event.target.value)}
                    placeholder={GOOD_DEED_PRESETS[goodDeedCategory].defaultNote}
                    className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-[#073C30] focus:outline-none"
                  />
                  <button
                    type="button"
                    data-testid="publish-good-deed-btn"
                    onClick={() => void handlePublishGoodDeed()}
                    style={{ backgroundColor: '#073C30', color: '#FFFFFF' }}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#073C30] px-4 py-2 text-xs font-bold text-[#FFFFFF] shadow-sm transition hover:bg-[#0A2E23] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                    <span>Post Good Deed</span>
                  </button>
                </div>
              </div>
            )}

            {/* Inline 2-Door Composer Drawer when opened */}
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
                onJoinSunnah={handleJoinSunnah}
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

        {/* TABLE 3 (Right Rail on Desktop LG+): Weekly Community Reading Circle + Asma-ul-Husna + Verified Contributors */}
        <aside
          data-faith-wall-right-rail
          className="hidden space-y-4 lg:block"
        >
          {/* 1. Weekly Community Reading Circle Card */}
          <div
            data-testid="weekly-community-circle"
            className="rounded-2xl border border-[#D4AF37]/50 bg-white p-4 text-center shadow-2xs"
          >
            <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4EFE4] text-[#073C30]">
              <Sparkles className="h-4 w-4 text-[#073C30]" aria-hidden />
            </span>

            <h3 className="mt-2 text-xs font-bold uppercase tracking-wider text-stone-900">
              Community Reading Circle
            </h3>
            <p className="mt-0.5 text-sm font-bold text-[#073C30]">
              Jumu’ah Kahf & Salawat Circle
            </p>

            {/* Circular Donut Progress Ring */}
            <div className="relative mx-auto my-3 flex h-28 w-28 items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#EFE7D6"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#C6A15A"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.round(2.51 * circle.percent)} 251`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-extrabold text-stone-900">
                  {circle.percent}%
                </span>
                <span className="text-[10px] font-semibold text-stone-500">
                  complete
                </span>
              </div>
            </div>

            <p className="text-[11px] font-medium text-stone-600">
              <strong className="text-stone-900">{circle.completedCount}</strong> of{' '}
              <strong className="text-stone-900">{circle.targetCount}</strong> Seekers completed today
            </p>

            <button
              type="button"
              data-testid="complete-circle-part-btn"
              aria-pressed={circle.userCompleted}
              onClick={() => setCircle(toggleCommunityCirclePart())}
              style={{
                backgroundColor: circle.userCompleted ? '#E8F2EC' : '#073C30',
                color: circle.userCompleted ? '#073C30' : '#FFFFFF',
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#073C30]/30 px-3 py-2 text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              {circle.userCompleted ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#073C30]" aria-hidden />
                  <span>Completed My Part · Alḥamdulillāh</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                  <span>I Completed My Part</span>
                </>
              )}
            </button>
          </div>

          {/* 2. Contextual Asma-ul-Husna Spotlight */}
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

          {/* 3. Featured Community Scholars & Contributors */}
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
        </aside>
      </div>
    </section>
  );
}

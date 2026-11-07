import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpen, Check, Copy, Download, Globe, Heart, Plus, Search, Send, Sparkles } from 'lucide-react';
import { RubElHizb } from '../engine/ds/ornaments.tsx';
import {
  BRAND_FOOTER_LEFT,
  BRAND_FOOTER_RIGHT,
  CARD_BISMILLAH,
  formatQuotedTranslation,
  formatVerseCardBadge,
  renderVerseImage,
} from '../lib/verseImage.ts';
import {
  FAITH_WALL_EVENT,
  listFaithWallPosts,
  publishFaithWallPost,
  readingLinkHash,
  toggleFaithWallLike,
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
  const [posts, setPosts] = useState<FaithWallPost[]>(() => listFaithWallPosts());
  const [langFilter, setLangFilter] = useState<'all' | Lang>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPresetKey, setSelectedPresetKey] = useState(FEATURED_VERSES[0].key);
  const [authorName, setAuthorName] = useState('');
  const [reflection, setReflection] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setPosts(listFaithWallPosts());
    window.addEventListener(FAITH_WALL_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAITH_WALL_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter(post => {
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
  }, [posts, langFilter, searchQuery]);

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
      authorName,
    });
    setPosts(listFaithWallPosts());
    setReflection('');
    setComposerOpen(false);
    setToast('Shared to the Public Faith Wall!');
    window.setTimeout(() => setToast(null), 3200);
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
            </div>

            <h2 className="font-display text-2xl font-bold leading-tight text-white sm:text-4xl">
              Community Faith Wall
            </h2>
            <p className="text-sm leading-relaxed text-[#F3E8C8]/80 sm:text-base">
              Illuminated 16:9 Qur’an manuscript cards, verified translations, and personal reflections shared by the Dragon Dawwa community.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!compact && (
              <button
                type="button"
                data-faith-wall-open-composer
                onClick={() => setComposerOpen(open => !open)}
                className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37] bg-[#D4AF37] px-4 py-2.5 text-sm font-semibold text-[#031812] shadow-sm transition hover:bg-[#e3c14d]"
              >
                <Plus className="h-4 w-4" aria-hidden />
                <span>Share a Reflection</span>
              </button>
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
            <div className="flex items-center justify-between gap-2">
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

            <div className="mt-3.5 flex items-center justify-end gap-2">
              <button
                type="submit"
                data-faith-wall-composer-submit
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-[#031812] transition hover:bg-[#e3c14d]"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                <span>Publish to Public Faith Wall</span>
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

      {/* Filter & Search Toolbar (Full View) */}
      {!compact && (
        <div
          data-faith-wall-toolbar
          className="flex flex-col justify-between gap-3 rounded-2xl border border-pine/15 bg-parchment px-4 py-3 sm:flex-row sm:items-center"
        >
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
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
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

          <label className="relative block min-w-0 sm:w-72">
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
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#0A2E23]">
                        <RubElHizb size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {post.authorName || 'Community Seeker'}
                        </p>
                        <p className="truncate text-[11px] text-[#D4AF37]/80">
                          {post.authorRole || 'Faith Wall Contributor'} · {formatWallDate(post.createdAt)}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full border border-[#D4AF37]/30 bg-[#031812] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                      {LANGUAGE_NAMES[post.lang]?.english ?? 'English'}
                    </span>
                  </div>

                  {/* Reflection Quote Box */}
                  {post.reflection ? (
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

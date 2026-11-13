import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Headphones,
  LogIn,
  Mic,
  Palette,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { LivingWavePlayer } from '../audio/LivingWavePlayer.tsx';
import { SeekerAvatar } from '../SeekerAuthModal.tsx';
import { useSeekerAuth } from '../../lib/seekerAuth.ts';
import {
  BRAND_FOOTER_LEFT,
  BRAND_FOOTER_RIGHT,
  CARD_BISMILLAH,
  formatQuotedTranslation,
  formatVerseCardBadge,
} from '../../lib/verseImage.ts';
import {
  getContextualNamesOfAllah,
  SEEDED_COMPLETED_PODCASTS,
  WALL_THEME_LIST,
  WALL_THEMES,
  type CompletedPodcastOption,
  type WallPostTheme,
  type WallPostType,
} from '../../lib/verseShare.ts';
import { LANGUAGE_NAMES, type Lang } from '../../shared/sources.ts';

export interface PresetVerseOption {
  key: string;
  surah: number;
  ayah: number;
  surahName: string;
  lang: Lang;
  arabic: string;
  translation: string;
  hadithCollection?: string;
  hadithNumber?: number;
  hadithGrade?: string;
}

export const FEATURED_WALL_VERSES: PresetVerseOption[] = [
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
    key: '20:114',
    surah: 20,
    ayah: 114,
    surahName: 'Ta-Ha',
    lang: 'en',
    arabic: 'وَقُل رَّبِّ زِدْنِى عِلْمًا',
    translation: 'And say: My Lord, increase me in knowledge.',
  },
  {
    key: 'hadith-bukhari-1',
    surah: 1,
    ayah: 1,
    surahName: 'Sahih al-Bukhari · Hadith 1',
    lang: 'en',
    arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    translation: 'Actions are judged only by intentions, and every person shall have only what they intended.',
    hadithCollection: 'Sahih al-Bukhari',
    hadithNumber: 1,
    hadithGrade: 'Sahih (Agreed Upon)',
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

function loadAvailablePodcasts(): CompletedPodcastOption[] {
  const result = [...SEEDED_COMPLETED_PODCASTS];
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('kf-research-episodes');
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{
          id?: string;
          question?: string;
          language?: Lang;
          lines?: Array<{ text?: string }>;
          sources?: string[];
          createdAt?: string;
        }>;
        if (Array.isArray(parsed)) {
          for (const ep of parsed) {
            if (ep?.id && ep?.question && !result.some(item => item.id === ep.id)) {
              result.unshift({
                id: ep.id,
                title: ep.question,
                summary: ep.lines?.[0]?.text || 'Completed 4-persona scholarly roundtable episode.',
                duration: '06:15',
                audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',
                lang: ep.language ?? 'en',
                citations: ep.sources?.slice(0, 4) ?? ['Qur’an & Sunnah Dossier'],
                surah: 1,
                ayah: 1,
                surahName: 'Al-Faatiha',
                arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
                translation: ep.lines?.[0]?.text || ep.question,
                createdAt: ep.createdAt || new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  return result;
}

export function ThemeSwatches({
  selected,
  onSelect,
}: {
  selected: WallPostTheme;
  onSelect: (theme: WallPostTheme) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Select card color theme" data-wall-theme-picker className="flex flex-wrap items-center gap-2">
      {WALL_THEME_LIST.map(item => {
        const active = selected === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-wall-theme-option={item.id}
            onClick={() => onSelect(item.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              active
                ? 'border-[#D4AF37] bg-[#0A2E23] text-white shadow-sm ring-1 ring-[#D4AF37]/60'
                : 'border-stone-300 bg-white text-stone-700 hover:border-[#073C30]/50 hover:text-stone-900'
            }`}
          >
            <span
              aria-hidden
              style={{ background: item.cssGradient }}
              className="inline-block h-3.5 w-3.5 rounded-full border border-black/20"
            />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ReflectionModal({
  open,
  onClose,
  onPublish,
  inline = false,
  initialDoor = null,
}: {
  open: boolean;
  onClose: () => void;
  onPublish: (input: {
    type?: WallPostType;
    preset: PresetVerseOption;
    podcast?: CompletedPodcastOption;
    reflection: string;
    authorName: string;
    theme: WallPostTheme;
    isAnonymous?: boolean;
  }) => Promise<void> | void;
  inline?: boolean;
  initialDoor?: 'reflection' | 'podcast' | null;
}) {
  const { user, openModal: openAuthModal } = useSeekerAuth();
  const [selectedDoor, setSelectedDoor] = useState<'reflection' | 'podcast' | null>(initialDoor);
  const [selectedPresetKey, setSelectedPresetKey] = useState(FEATURED_WALL_VERSES[0].key);
  const [podcasts] = useState<CompletedPodcastOption[]>(() => loadAvailablePodcasts());
  const [selectedPodcastId, setSelectedPodcastId] = useState(SEEDED_COMPLETED_PODCASTS[0].id);
  const [authorName, setAuthorName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [reflection, setReflection] = useState('');
  const [theme, setTheme] = useState<WallPostTheme>('emerald');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && initialDoor !== undefined) {
      setSelectedDoor(initialDoor);
    }
  }, [open, initialDoor]);

  if (!open) return null;

  const preset = FEATURED_WALL_VERSES.find(item => item.key === selectedPresetKey) ?? FEATURED_WALL_VERSES[0];
  const selectedPodcast = podcasts.find(item => item.id === selectedPodcastId) ?? podcasts[0];
  const activeDoor = selectedDoor ?? 'reflection';
  const themeSpec = WALL_THEMES[theme];
  const badge = preset.hadithCollection
    ? `✦ ${preset.hadithCollection.toUpperCase()} #${preset.hadithNumber}`
    : formatVerseCardBadge(preset);
  const quoted = formatQuotedTranslation(preset.translation);
  const contextualNames = getContextualNamesOfAllah(
    preset.surah,
    preset.ayah,
    `${preset.arabic} ${preset.translation} ${reflection}`,
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (activeDoor === 'podcast') {
        await onPublish({
          type: 'podcast',
          preset: {
            key: `${selectedPodcast.surah}:${selectedPodcast.ayah}`,
            surah: selectedPodcast.surah,
            ayah: selectedPodcast.ayah,
            surahName: selectedPodcast.surahName,
            lang: selectedPodcast.lang,
            arabic: selectedPodcast.arabic,
            translation: selectedPodcast.translation,
          },
          podcast: selectedPodcast,
          reflection: reflection.slice(0, 500),
          authorName: isAnonymous ? 'Anonymous Seeker' : authorName,
          theme,
          isAnonymous,
        });
      } else {
        await onPublish({
          type: 'reflection',
          preset,
          reflection: reflection.slice(0, 500),
          authorName: isAnonymous ? 'Anonymous Seeker' : authorName,
          theme,
          isAnonymous,
        });
      }
      setReflection('');
    } finally {
      setBusy(false);
    }
  };

  const formContent = (
    <form
      data-faith-wall-composer
      data-two-door-modal
      onSubmit={event => void handleSubmit(event)}
      className="relative z-10 rounded-2xl border border-stone-200 bg-white p-4 text-stone-900 shadow-xl sm:p-5"
    >
      {/* Modal Header */}
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-900">
            <Sparkles className="h-3 w-3 text-emerald-700" aria-hidden />
            Controlled 2-Door Publishing Studio
          </span>
          <h3 className="mt-1 font-display text-base font-bold text-stone-900 sm:text-lg">
            Share to the Faith Wall
          </h3>
          <p className="text-xs text-stone-500">
            Every post must be anchored to a verified Qur’an/Hadith citation or a completed Research Podcast episode.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {/* 2-Door Selector Cards (Always visible at top so user can pick or switch between Door 1 and Door 2) */}
      <div data-two-door-selector className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          data-door-option="reflection"
          aria-pressed={activeDoor === 'reflection'}
          onClick={() => setSelectedDoor('reflection')}
          className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition ${
            activeDoor === 'reflection'
              ? 'border-[#073C30] bg-emerald-50/60 shadow-xs'
              : 'border-stone-200 bg-stone-50/60 hover:border-stone-300 hover:bg-white'
          }`}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#073C30] text-[#D4AF37]">
            <BookOpen className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Door 1 · Sacred Text
            </span>
            <span className="mt-0.5 block font-display text-xs font-bold text-stone-900 sm:text-sm">
              Share a Qur’an or Hadith Reflection
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-stone-600">
              Anchor your tadabbur to a verified Ayah or Prophetic narration with a 16:9 illuminated card.
            </span>
          </div>
        </button>

        <button
          type="button"
          data-door-option="podcast"
          aria-pressed={activeDoor === 'podcast'}
          onClick={() => setSelectedDoor('podcast')}
          className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition ${
            activeDoor === 'podcast'
              ? 'border-[#073C30] bg-emerald-50/60 shadow-xs'
              : 'border-stone-200 bg-stone-50/60 hover:border-stone-300 hover:bg-white'
          }`}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#073C30] text-[#D4AF37]">
            <Mic className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Door 2 · Broadcast Audio
            </span>
            <span className="mt-0.5 block font-display text-xs font-bold text-stone-900 sm:text-sm">
              Share a Research Podcast Episode
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-stone-600">
              Embed a completed 4-scholar roundtable audio episode with its primary citations.
            </span>
          </div>
        </button>
      </div>

      {activeDoor === 'reflection' ? (
        <div data-door-panel="reflection" className="mt-4 space-y-4">
          {/* Step 1: Select Sacred Anchor */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-stone-700">
              Step 1 · Select Qur’an Ayah or Hadith Reference
              <select
                data-door1-reference-select
                value={selectedPresetKey}
                onChange={event => setSelectedPresetKey(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900 focus:border-[#073C30] focus:outline-none"
              >
                {FEATURED_WALL_VERSES.map(item => (
                  <option key={item.key} value={item.key}>
                    {item.hadithCollection
                      ? `${item.hadithCollection} #${item.hadithNumber} (${item.hadithGrade})`
                      : `Surah ${item.surahName} ${item.surah}:${item.ayah} (${LANGUAGE_NAMES[item.lang].english})`}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col justify-end gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700">
                  {isAnonymous ? 'Anonymous Identity' : user ? 'Verified Author Identity' : 'Your Name or Kunyah'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAnonymous}
                  data-testid="reflection-anonymous-toggle"
                  onClick={() => setIsAnonymous(v => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-stone-700"
                >
                  <span>Post Anonymously</span>
                  <span
                    className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 transition ${
                      isAnonymous ? 'bg-[#073C30] justify-end' : 'bg-stone-300 justify-start'
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full bg-white shadow-2xs" />
                  </span>
                </button>
              </div>
              {isAnonymous ? (
                <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900">
                  <span className="flex items-center gap-2 truncate font-semibold">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#073C30] text-[#F5EEDC]">
                      <SeekerAvatar avatarUrl={undefined} name="Anonymous Seeker" emblem="emerald-lamp" size={14} />
                    </span>
                    <span>Anonymous Seeker</span>
                    <span className="font-mono text-stone-500">@anonymous</span>
                  </span>
                </div>
              ) : user ? (
                <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900">
                  <span className="flex items-center gap-2 truncate font-semibold">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#073C30] text-[#F5EEDC]">
                      <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={14} />
                    </span>
                    <span>{user.name}</span>
                    <span className="text-emerald-800">· {user.kunyah}</span>
                  </span>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                </div>
              ) : (
                <input
                  type="text"
                  value={authorName}
                  onChange={event => setAuthorName(event.target.value)}
                  placeholder="e.g. Seeker of Knowledge"
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-[#073C30] focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Step 2: Choose Visual Card Theme + Live 16:9 Preview */}
          <div className="space-y-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
              <Palette className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              <span>Step 2 · Choose Illuminated Card Theme</span>
            </span>
            <ThemeSwatches selected={theme} onSelect={setTheme} />

            <div
              data-composer-theme-preview={theme}
              className={`relative mt-2 flex flex-col justify-between overflow-hidden rounded-xl border p-4 text-[#F3E8C8] shadow-sm sm:p-5 ${themeSpec.classes}`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-0.5 font-semibold tracking-wider text-[#D4AF37]">
                  {badge}
                </span>
                <span lang="ar" dir="rtl" className="quran-face text-xs text-[#D4AF37]/90 sm:text-sm">
                  ۞ {CARD_BISMILLAH}
                </span>
              </div>

              <div className="my-3 text-center">
                <p
                  lang="ar"
                  dir="rtl"
                  style={{ textShadow: '0 0 18px rgba(212,175,55,0.2)' }}
                  className="quran-face text-xl leading-[2] text-white sm:text-2xl"
                >
                  {preset.arabic}
                </p>
                <p lang={preset.lang} className="mt-2 font-display text-xs italic text-[#F3E8C8] sm:text-sm">
                  {quoted}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-white/15 pt-2 text-[10px] text-[#D4AF37]/75">
                <span>{BRAND_FOOTER_LEFT}</span>
                <span>{BRAND_FOOTER_RIGHT}</span>
              </div>
            </div>
          </div>

          {/* Step 3: Add Reflection Text (Max 500 chars) */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
              <label htmlFor="door1-reflection-input">
                Step 3 · Share how this verse guides your heart or daily practice
              </label>
              <span data-reflection-char-count className="font-mono text-[11px] text-stone-500">
                {reflection.length} / 500
              </span>
            </div>
            <input
              id="door1-reflection-input"
              type="text"
              maxLength={500}
              data-faith-wall-composer-input
              value={reflection}
              onChange={event => setReflection(event.target.value.slice(0, 500))}
              placeholder="Write a concise reflection anchored to this passage (up to 500 characters)…"
              className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#073C30] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Contextual Asma-ul-Husna Preview Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-medium text-stone-500">✦ Contextual Asma-ul-Husna:</span>
            {contextualNames.map(name => (
              <span
                key={name.id}
                className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-950"
              >
                <span>{name.transliteration}</span>
                <span lang="ar" dir="rtl" className="quran-face text-xs text-amber-800">
                  ({name.arabic})
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div data-door-panel="podcast" className="mt-4 space-y-4">
          {/* Door 2 Step 1: Select Completed Podcast Episode */}
          <label className="block text-xs font-semibold text-stone-700">
            Step 1 · Select Completed Research Podcast Episode
            <select
              data-door2-podcast-select
              value={selectedPodcastId}
              onChange={event => setSelectedPodcastId(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900 focus:border-[#073C30] focus:outline-none"
            >
              {podcasts.map(ep => (
                <option key={ep.id} value={ep.id}>
                  {ep.title} ({ep.duration})
                </option>
              ))}
            </select>
          </label>

          {/* Door 2 Step 2: Auto-Embedded Audio Wave Player & Citations Preview */}
          <div
            data-door2-podcast-preview
            className={`rounded-xl border p-4 text-[#F3E8C8] shadow-sm ${themeSpec.classes}`}
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]">
              <span className="inline-flex items-center gap-1.5">
                <Headphones className="h-3.5 w-3.5" aria-hidden />
                <span>4-Scholar Roundtable Episode</span>
              </span>
              <span>{selectedPodcast.duration}</span>
            </div>
            <h4 className="mt-1.5 font-display text-base font-bold text-white">
              {selectedPodcast.title}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-[#F5EEDC]/80">
              {selectedPodcast.summary}
            </p>

            {/* Living Acoustic Wave Preview Player */}
            <LivingWavePlayer
              audioId={`modal-pod-preview-${selectedPodcast.id}`}
              audioUrl={selectedPodcast.audioUrl}
              durationLabel={selectedPodcast.duration}
              lang={selectedPodcast.lang}
              compact
            />

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {selectedPodcast.citations.map(cite => (
                <span
                  key={cite}
                  className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#F9E7B9]"
                >
                  ✦ {cite}
                </span>
              ))}
            </div>
          </div>

          {/* Door 2 Step 3: Add Listener Note (Max 500 chars) */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
              <label htmlFor="door2-reflection-input">
                Step 3 · Share what listeners will discover in this episode
              </label>
              <span className="font-mono text-[11px] text-stone-500">
                {reflection.length} / 500
              </span>
            </div>
            <input
              id="door2-reflection-input"
              type="text"
              maxLength={500}
              data-faith-wall-composer-input
              value={reflection}
              onChange={event => setReflection(event.target.value.slice(0, 500))}
              placeholder="Add a brief note introducing this episode’s scholarly findings (up to 500 characters)…"
              className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50/70 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#073C30] focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Footer Submit Bar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-4">
        {!user ? (
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden />
            <span>Sign in to publish under your verified profile</span>
          </button>
        ) : (
          <span className="text-xs text-stone-500">
            ✦ Publishes to your Personal Portfolio (`#/profile`) and the Community Faith Wall
          </span>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-faith-wall-composer-submit
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-5 py-2.5 text-xs font-semibold text-[#F5EEDC] shadow-sm transition hover:bg-[#0A2E23] disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span>
              {activeDoor === 'podcast' ? 'Share Podcast to Faith Wall' : 'Publish Reflection'}
            </span>
          </button>
        </div>
      </div>
    </form>
  );

  if (inline) return formContent;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share to Faith Wall"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs sm:p-6"
      onClick={onClose}
    >
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto" onClick={event => event.stopPropagation()}>
        {formContent}
      </div>
    </div>
  );
}

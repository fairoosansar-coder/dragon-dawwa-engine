import { useState, type FormEvent } from 'react';
import { LogIn, Palette, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
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
  WALL_THEME_LIST,
  WALL_THEMES,
  type WallPostTheme,
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
                : 'border-[#D4AF37]/25 bg-[#031812]/80 text-[#F5EEDC]/75 hover:border-[#D4AF37]/60 hover:text-white'
            }`}
          >
            <span
              aria-hidden
              style={{ background: item.cssGradient }}
              className="inline-block h-3.5 w-3.5 rounded-full border border-white/40"
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
}: {
  open: boolean;
  onClose: () => void;
  onPublish: (input: {
    preset: PresetVerseOption;
    reflection: string;
    authorName: string;
    theme: WallPostTheme;
  }) => Promise<void> | void;
  inline?: boolean;
}) {
  const { user, openModal: openAuthModal } = useSeekerAuth();
  const [selectedPresetKey, setSelectedPresetKey] = useState(FEATURED_WALL_VERSES[0].key);
  const [authorName, setAuthorName] = useState('');
  const [reflection, setReflection] = useState('');
  const [theme, setTheme] = useState<WallPostTheme>('emerald');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const preset = FEATURED_WALL_VERSES.find(item => item.key === selectedPresetKey) ?? FEATURED_WALL_VERSES[0];
  const themeSpec = WALL_THEMES[theme];
  const badge = formatVerseCardBadge(preset);
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
      await onPublish({
        preset,
        reflection,
        authorName,
        theme,
      });
      setReflection('');
    } finally {
      setBusy(false);
    }
  };

  const formContent = (
    <form
      data-faith-wall-composer
      onSubmit={event => void handleSubmit(event)}
      className="relative z-10 rounded-3xl border border-[#D4AF37]/45 bg-[#031812]/95 p-5 text-[#F5EEDC] shadow-2xl sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#D4AF37]" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            Share an Illuminated Ayah Reflection
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-white/5 text-[#F5EEDC]/80 hover:border-[#D4AF37] hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Live Illuminated Theme Preview */}
      <div
        data-composer-theme-preview={theme}
        className={`relative mt-4 flex flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-inner sm:p-5 ${themeSpec.classes}`}
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

      {/* Theme Picker */}
      <div className="mt-4 space-y-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[#F5EEDC]/85">
          <Palette className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
          <span>Choose Card Atmosphere Theme</span>
        </span>
        <ThemeSwatches selected={theme} onSelect={setTheme} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-[#F5EEDC]/85">
          Select Ayah
          <select
            value={selectedPresetKey}
            onChange={event => setSelectedPresetKey(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#0A2E23] px-3 py-2 text-sm text-[#F3E8C8] focus:border-[#D4AF37] focus:outline-none"
          >
            {FEATURED_WALL_VERSES.map(item => (
              <option key={item.key} value={item.key}>
                Surah {item.surahName} {item.surah}:{item.ayah} ({LANGUAGE_NAMES[item.lang].english})
              </option>
            ))}
          </select>
        </label>

        {user ? (
          <div className="flex flex-col justify-end">
            <span className="text-xs font-medium text-[#F5EEDC]/85">Publishing Identity</span>
            <div className="mt-1.5 flex items-center justify-between rounded-xl border border-[#D4AF37]/40 bg-[#0A2E23] px-3.5 py-2 text-xs text-white">
              <span className="flex items-center gap-2 truncate font-semibold">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-emerald-400">
                  <SeekerAvatar avatarUrl={user.avatarUrl} name={user.name} emblem={user.emblem} size={15} />
                </span>
                <span>{user.name}</span>
                <span className="text-[#D4AF37]">· {user.kunyah}</span>
              </span>
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
            </div>
          </div>
        ) : (
          <label className="block text-xs font-medium text-[#F5EEDC]/85">
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

      <label className="mt-3 block text-xs font-medium text-[#F5EEDC]/85">
        Personal Reflection or Tadabbur
        <input
          type="text"
          data-faith-wall-composer-input
          value={reflection}
          onChange={event => setReflection(event.target.value)}
          placeholder="Add a reflection or thought on how this verse speaks to your heart..."
          className="mt-1.5 w-full rounded-xl border border-[#D4AF37]/35 bg-[#0A2E23] px-3.5 py-2.5 text-sm text-[#F3E8C8] placeholder:text-[#F3E8C8]/45 focus:border-[#D4AF37] focus:outline-none"
        />
      </label>

      {/* Contextual Asma-ul-Husna Preview Pills */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-[#D4AF37]/80">✦ Contextual Asma-ul-Husna:</span>
        {contextualNames.map(name => (
          <span
            key={name.id}
            className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/15 px-2.5 py-0.5 font-semibold text-[#F9E7B9]"
          >
            <span>{name.transliteration}</span>
            <span lang="ar" dir="rtl" className="quran-face text-xs text-[#D4AF37]">
              ({name.arabic})
            </span>
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#D4AF37]/20 pt-3.5">
        {!user ? (
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D4AF37] hover:underline"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden />
            <span>Sign in to save this card to your Personal Wall</span>
          </button>
        ) : (
          <span className="text-xs text-[#D4AF37]/85">
            ✦ Publishes to Community Stream & My Personal Wall ({themeSpec.label} theme)
          </span>
        )}
        <button
          type="submit"
          data-faith-wall-composer-submit
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4AF37] px-5 py-2.5 text-xs font-bold text-[#031812] shadow-md transition hover:bg-[#e3c14d] disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          <span>{user ? 'Publish to My Wall & Community' : 'Publish to Public Faith Wall'}</span>
        </button>
      </div>
    </form>
  );

  if (inline) return formContent;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share a Reflection"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto" onClick={event => event.stopPropagation()}>
        {formContent}
      </div>
    </div>
  );
}

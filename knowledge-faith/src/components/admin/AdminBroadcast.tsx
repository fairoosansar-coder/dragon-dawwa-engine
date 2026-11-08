import { useState, type FormEvent } from 'react';
import { Megaphone, Pin, Send, Sparkles } from 'lucide-react';
import { FEATURED_WALL_VERSES, ThemeSwatches } from '../wall/ReflectionModal.tsx';
import {
  publishFaithWallPost,
  readingLinkHash,
  type WallPostTheme,
} from '../../lib/verseShare.ts';
import { LANGUAGE_NAMES } from '../../shared/sources.ts';

export function AdminBroadcast({ onPublished }: { onPublished?: () => void }) {
  const [selectedPresetKey, setSelectedPresetKey] = useState(FEATURED_WALL_VERSES[1].key);
  const [theme, setTheme] = useState<WallPostTheme>('emerald');
  const [broadcastTitle, setBroadcastTitle] = useState('Dragon Dawwa Editorial Board');
  const [reflection, setReflection] = useState(
    'Friday Institutional Reminder: Let us anchor our hearts in Ayat al-Kursi and verify every narration from its primary sources.',
  );
  const [toast, setToast] = useState<string | null>(null);

  const preset = FEATURED_WALL_VERSES.find(item => item.key === selectedPresetKey) ?? FEATURED_WALL_VERSES[0];

  const handleBroadcastSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reflection.trim()) return;
    const hash = readingLinkHash({
      surah: preset.surah,
      ayah: preset.ayah,
      lang: preset.lang,
      edition: preset.lang === 'ta' ? 'tamil_omar_brief' : preset.lang === 'si' ? 'sinhalese_mahir' : 'english_rwwad',
      mode: 'book',
    });

    await publishFaithWallPost({
      type: 'reflection',
      status: 'approved',
      isPinned: true,
      isOfficialBroadcast: true,
      verse: {
        surah: preset.surah,
        ayah: preset.ayah,
        surahName: preset.surahName,
        arabic: preset.arabic,
        translation: preset.translation,
      },
      lang: preset.lang,
      url: hash,
      reflection: reflection.slice(0, 500),
      theme,
      authorName: broadcastTitle.trim() || 'Dragon Dawwa Editorial Board',
      authorRole: '✦ Official Institutional Broadcast',
    });

    setToast('Pinned Official Institutional Broadcast to the top of the Community Faith Wall!');
    onPublished?.();
  };

  return (
    <form
      data-admin-broadcast
      onSubmit={event => void handleBroadcastSubmit(event)}
      className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs sm:p-5"
    >
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#073C30] px-2.5 py-0.5 text-[10px] font-semibold text-[#F9E7B9]">
            <Sparkles className="h-3 w-3 text-[#D4AF37]" aria-hidden />
            ✦ Official Institutional Broadcast Studio
          </span>
          <h3 className="mt-1 font-display text-base font-bold text-stone-900 sm:text-lg">
            Publish & Pin Official Wall Broadcast
          </h3>
          <p className="text-xs text-stone-600">
            Broadcasts bypass moderation, receive the prestigious Institutional badge, and pin directly to the top of the Community Faith Wall.
          </p>
        </div>
        <Megaphone className="h-5 w-5 shrink-0 text-[#C6A15A]" aria-hidden />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-stone-700">
          Issuing Department / Title
          <input
            type="text"
            value={broadcastTitle}
            onChange={event => setBroadcastTitle(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900"
          />
        </label>

        <label className="block text-xs font-semibold text-stone-700">
          Sacred Anchor Reference
          <select
            value={selectedPresetKey}
            onChange={event => setSelectedPresetKey(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900"
          >
            {FEATURED_WALL_VERSES.map(item => (
              <option key={item.key} value={item.key}>
                Surah {item.surahName} {item.surah}:{item.ayah} ({LANGUAGE_NAMES[item.lang].english})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-stone-700">Broadcast Card Theme</span>
        <ThemeSwatches selected={theme} onSelect={setTheme} />
      </div>

      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
          <label htmlFor="admin-broadcast-text">Official Announcement / Friday Reminder</label>
          <span className="font-mono text-[11px] text-stone-500">{reflection.length} / 500</span>
        </div>
        <textarea
          id="admin-broadcast-text"
          rows={3}
          maxLength={500}
          data-admin-broadcast-input
          value={reflection}
          onChange={event => setReflection(event.target.value.slice(0, 500))}
          className="mt-1.5 w-full rounded-xl border border-stone-300 bg-stone-50/70 p-3 text-sm text-stone-900 focus:border-[#073C30] focus:bg-white focus:outline-none"
        />
      </div>

      {toast && (
        <div
          role="status"
          data-admin-broadcast-toast
          className="rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-950"
        >
          ✦ {toast}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-stone-100 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
          <Pin className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
          <span>Automatically sets is_pinned = true and status = approved</span>
        </span>
        <button
          type="submit"
          data-admin-broadcast-submit
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-5 py-2.5 text-xs font-semibold text-[#F5EEDC] shadow-sm transition hover:bg-[#0A2E23]"
        >
          <Send className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
          <span>Publish Pinned Broadcast</span>
        </button>
      </div>
    </form>
  );
}

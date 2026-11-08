import { useState, type FormEvent } from 'react';
import { Check, Image as ImageIcon, Palette } from 'lucide-react';
import {
  readAdminSettings,
  saveAdminSettings,
  type DeskPaletteId,
} from '../../lib/verseShare.ts';

const BANNER_OPTIONS = [
  { id: 'banner-art', label: 'Mamluk Gold Arch (/assets/banner-art.jpg)', url: '/assets/banner-art.jpg' },
  { id: 'emerald-arabesque', label: 'Emerald Arabesque (/assets/geometric-emerald.jpg)', url: '/assets/geometric-emerald.jpg' },
  { id: 'royal-amethyst', label: 'Royal Amethyst (/assets/geometric-studio.jpg)', url: '/assets/geometric-studio.jpg' },
] as const;

const PALETTE_OPTIONS: Array<{ id: DeskPaletteId; label: string; desc: string; swatch: string }> = [
  {
    id: 'emerald-gold',
    label: 'Emerald / Gold',
    desc: 'Classic Night Masjid emerald (#073C30) with Mamluk gold leaf (#C6A15A)',
    swatch: 'linear-gradient(135deg, #073C30 0%, #C6A15A 100%)',
  },
  {
    id: 'amethyst-obsidian',
    label: 'Amethyst / Obsidian',
    desc: 'Deep royal amethyst (#1A0B2E) paired with obsidian & warm ivory',
    swatch: 'linear-gradient(135deg, #1A0B2E 0%, #E0B0FF 100%)',
  },
  {
    id: 'parchment-slate',
    label: 'Parchment / Slate',
    desc: 'Manuscript parchment (#F8F5EC) with lapis slate (#16233B) accents',
    swatch: 'linear-gradient(135deg, #16233B 0%, #F8F5EC 100%)',
  },
];

export function AdminThemeStudio() {
  const initial = readAdminSettings();
  const [heroBannerUrl, setHeroBannerUrl] = useState(initial.heroBannerUrl);
  const [deskPalette, setDeskPalette] = useState<DeskPaletteId>(initial.deskPalette);
  const [toast, setToast] = useState<string | null>(null);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    await saveAdminSettings({ heroBannerUrl, deskPalette });
    setToast('Saved platform Hero Banner and Desk Color Palette to admin_settings!');
  };

  return (
    <form
      data-admin-theme-studio
      onSubmit={event => void handleSave(event)}
      className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="border-b border-stone-100 pb-4">
        <h3 className="font-display text-lg font-bold text-stone-900">
          Banner & Theme Studio
        </h3>
        <p className="text-xs text-stone-600">
          Configure the active Hero Banner artwork and default desk color palette across Dragon Dawwa.
        </p>
      </div>

      {/* Live Banner Preview */}
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
          <ImageIcon className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
          <span>Active Hero Banner Artwork</span>
        </span>
        <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-stone-200 bg-[#073C30]">
          <img src={heroBannerUrl} alt="" className="h-full w-full object-cover object-center opacity-85" />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/65 via-black/20 to-transparent p-4 text-white">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#D4AF37]">
              ✦ Live Banner Preview · {deskPalette}
            </span>
            <p className="font-display text-base font-bold">
              Dragon Dawwa Institutional Research Studio
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3">
          {BANNER_OPTIONS.map(option => {
            const active = heroBannerUrl === option.url;
            return (
              <button
                key={option.id}
                type="button"
                data-admin-banner-option={option.id}
                aria-pressed={active}
                onClick={() => setHeroBannerUrl(option.url)}
                className={`overflow-hidden rounded-xl border-2 text-left transition ${
                  active ? 'border-[#073C30] ring-2 ring-emerald-600/30' : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <img src={option.url} alt="" className="h-14 w-full object-cover" />
                <span className="block truncate bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>

        <label className="block pt-2 text-xs font-semibold text-stone-700">
          Or Custom Hero Banner Image URL
          <input
            type="text"
            data-admin-custom-banner-input
            value={heroBannerUrl}
            onChange={event => setHeroBannerUrl(event.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900"
          />
        </label>
      </div>

      {/* Default Desk Palette Selector */}
      <div className="space-y-2 pt-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
          <Palette className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
          <span>Default Desk Color Palette</span>
        </span>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {PALETTE_OPTIONS.map(option => {
            const active = deskPalette === option.id;
            return (
              <button
                key={option.id}
                type="button"
                data-admin-palette-option={option.id}
                aria-pressed={active}
                onClick={() => setDeskPalette(option.id)}
                className={`flex flex-col justify-between rounded-xl border-2 p-3 text-left transition ${
                  active ? 'border-[#073C30] bg-emerald-50/50' : 'border-stone-200 bg-stone-50/50 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    style={{ background: option.swatch }}
                    className="inline-block h-5 w-5 rounded-full border border-black/15"
                  />
                  <span className="text-xs font-bold text-stone-900">{option.label}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-stone-600">{option.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          data-admin-theme-toast
          className="rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-950"
        >
          ✦ {toast}
        </div>
      )}

      <div className="flex justify-end border-t border-stone-100 pt-4">
        <button
          type="submit"
          data-admin-theme-save
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#073C30] px-5 py-2.5 text-xs font-semibold text-[#F5EEDC] shadow-sm transition hover:bg-[#0A2E23]"
        >
          <Check className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
          <span>Save Studio Theme Settings</span>
        </button>
      </div>
    </form>
  );
}

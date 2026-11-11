import { Check, Globe, Palette, Type } from 'lucide-react';
import {
  UI_FONT_SCALES,
  UI_THEMES,
  useApp,
  type UiFontScaleId,
  type UiThemeId,
} from '../lib/store.tsx';
import { LANGS, LANGUAGE_NAMES, toLang } from '../shared/sources.ts';

export function ProfileSettingsPanel({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, uiTheme, setUiTheme, fontScale, setFontScale, t } = useApp();

  return (
    <div
      data-profile-settings-panel
      className={compact ? 'space-y-3' : 'space-y-4 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-2xs'}
    >
      {!compact && (
        <div className="border-b border-stone-100 pb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
            Platform Customization · Language, Colour & Typography
          </h3>
          <p className="mt-0.5 text-[11px] text-stone-500">
            Customize your content & reading language, colour theme, and interface font scale.
          </p>
        </div>
      )}

      {/* 1. Content & Interface Language */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor={compact ? 'profile-menu-lang-select' : 'profile-page-lang-select'}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-700"
          >
            <Globe className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            <span>{t.language}</span>
          </label>
          <select
            id={compact ? 'profile-menu-lang-select' : 'profile-page-lang-select'}
            aria-label={t.language}
            value={lang}
            onChange={event => setLang(toLang(event.target.value))}
            className="sr-only"
          >
            {LANGS.map(code => (
              <option key={code} value={code}>
                {LANGUAGE_NAMES[code].english}
              </option>
            ))}
          </select>
          <span className="font-mono text-[10px] font-semibold uppercase text-emerald-800">
            {LANGUAGE_NAMES[lang].english}
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Select content language"
          data-settings-language-picker
          className="grid grid-cols-3 gap-1.5"
        >
          {LANGS.map(code => {
            const active = lang === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                data-settings-lang={code}
                onClick={() => setLang(code)}
                className={`flex flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition ${
                  active
                    ? 'border-[#073C30] bg-[#073C30] text-[#F5EEDC] shadow-2xs'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-white'
                }`}
              >
                <span className="text-xs font-semibold leading-tight">
                  {LANGUAGE_NAMES[code].native}
                </span>
                <span
                  className={`mt-0.5 text-[10px] ${
                    active ? 'text-[#D4AF37]' : 'text-stone-500'
                  }`}
                >
                  {LANGUAGE_NAMES[code].english}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Surface & Reading Theme */}
      <div className="space-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-700">
          <Palette className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
          <span>Colour & Appearance Theme</span>
        </span>
        <div
          role="radiogroup"
          aria-label="Select reading surface theme"
          data-settings-theme-picker
          className="grid grid-cols-1 gap-1.5"
        >
          {(Object.keys(UI_THEMES) as UiThemeId[]).map(id => {
            const item = UI_THEMES[id];
            const active = uiTheme === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                data-settings-theme={id}
                onClick={() => setUiTheme(id)}
                className={`flex items-center justify-between rounded-xl border px-2.5 py-1.5 text-left transition ${
                  active
                    ? 'border-[#073C30] bg-emerald-50/70 text-stone-900 ring-1 ring-[#073C30]/20'
                    : 'border-stone-200 bg-stone-50/70 text-stone-700 hover:border-stone-300 hover:bg-white'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    style={{ background: item.swatch }}
                    className="inline-block h-4 w-4 shrink-0 rounded-full border border-black/15"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{item.label}</p>
                    <p className="truncate text-[10px] text-stone-500">{item.subtitle}</p>
                  </div>
                </div>
                {active && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Font Size Scale */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-700">
            <Type className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            <span>Font Size Scale</span>
          </span>
          <span className="font-mono text-[10px] text-stone-500">
            {UI_FONT_SCALES[fontScale].label} ({UI_FONT_SCALES[fontScale].badge})
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Select font size scale"
          data-settings-fontsize-picker
          className="grid grid-cols-4 gap-1"
        >
          {(Object.keys(UI_FONT_SCALES) as UiFontScaleId[]).map(id => {
            const spec = UI_FONT_SCALES[id];
            const active = fontScale === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                data-settings-fontsize={id}
                onClick={() => setFontScale(id)}
                className={`flex flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-center transition ${
                  active
                    ? 'border-[#073C30] bg-[#073C30] text-[#F5EEDC] shadow-2xs'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-white'
                }`}
              >
                <span className="text-[11px] font-semibold leading-tight">{spec.label}</span>
                <span
                  className={`mt-0.5 font-mono text-[9px] ${
                    active ? 'text-[#D4AF37]' : 'text-stone-500'
                  }`}
                >
                  {spec.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

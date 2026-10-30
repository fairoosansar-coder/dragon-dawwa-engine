import type { ReactNode } from 'react';
import { LANGS, LANGUAGE_NAMES, toLang } from '../../shared/sources.ts';
import type { RouteRoot } from '../../lib/route.ts';
import { useShell } from '../../lib/shell.tsx';
import { useApp } from '../../lib/store.tsx';
import type { Strings } from '../../lib/i18n.ts';
import { useAudioState } from '../../lib/audio.ts';
import { buildStamp } from '../../buildStamp.ts';
import { BrandLockup } from './Brand.tsx';
import { StudioMark, type StudioMarkName } from './studioMarks.tsx';
import { AudioMiniPlayer, DeskHeaderTabs } from './widgets.tsx';

interface NavItem {
  path: RouteRoot;
  href: string;
  short: keyof Strings;
  side?: keyof Strings;
  mark: StudioMarkName;
}

function ReleaseMark({ className }: { className: string }) {
  const short = buildStamp.sha.slice(0, 7);
  const label = `${short} · ${buildStamp.builtAt}`;
  return (
    <p className={className} data-release={buildStamp.sha} data-built-at={buildStamp.builtAt} title={`Release ${buildStamp.sha} built ${buildStamp.builtAt}`}>
      {label}
    </p>
  );
}

const NAV: NavItem[] = [
  { path: 'hub', href: '#/hub', short: 'navKnowledge', mark: 'knowledge' },
  { path: 'quran', href: '#/quran', short: 'navQuranShort', mark: 'quran' },
  { path: 'hadith', href: '#/hadith', short: 'navHadithShort', mark: 'hadith' },
  { path: 'books', href: '#/books', short: 'navBooks', mark: 'books' },
  { path: 'spiritual', href: '#/spiritual', short: 'navWorship', side: 'navWorship', mark: 'worship' },
  { path: 'podcast', href: '#/podcast', short: 'navPodcast', mark: 'podcast' },
];

export function AppFrame({ path, section, segments = [], children }: { path: RouteRoot; section: string; segments?: string[]; children: ReactNode }) {
  const { t, lang, setLang } = useApp();
  const { focus, setFocus } = useShell();
  const audio = useAudioState();
  const player = Boolean(audio.id) && audio.status !== 'idle';
  const quranSettings = path === 'quran';
  const quranBook = path === 'quran' && segments[0] === 'book';

  return (
    <div className="flex h-dvh overflow-hidden bg-sand text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-parchment focus:px-3 focus:py-2">
        Skip to content
      </a>
      {!focus && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gold/50 bg-pine text-sand lg:flex">
          <div className="px-4 pt-5">
            <BrandLockup tone="emerald" />
            <div className="mt-5 h-px bg-gold/70" />
          </div>
          <nav aria-label="Main" className="mt-4 flex-1 space-y-1 px-3">
            {NAV.map(item => {
              const active = item.path === path;
              return (
                <a
                  key={item.path}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl border-l-2 px-3 py-2.5 text-sm font-medium ${active ? 'border-gold bg-moss text-sand' : 'border-transparent text-sand/80 hover:bg-white/5'}`}
                >
                  <StudioMark name={item.mark} className="h-6 w-6 shrink-0 rounded-md" />
                  {t[item.side ?? item.short]}
                </a>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-gold/40 px-3 py-4">
            <a href="#/hub/saved" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-sand/80 hover:bg-white/5">
              <StudioMark name="saved" className="h-6 w-6 shrink-0 rounded-md" /> {t.sidebarSaved}
            </a>
            <a href="#/hub/scholar" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-sand/80 hover:bg-white/5">
              {t.sidebarQuestion}
            </a>
            <ReleaseMark className="px-3 pt-3 text-[10px] leading-snug text-sand/60" />
          </div>
        </aside>
      )}

      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${focus ? '' : 'lg:pl-64'}`}>
        {focus && (
          <div className="shrink-0 border-b border-pine/10 bg-sand px-4 py-3">
            <button type="button" onClick={() => setFocus(false)} className="rounded-full bg-pine px-4 py-2 text-sm font-medium text-sand">
              {t.exitFocus}
            </button>
          </div>
        )}
        {!focus && (
          <header className="shrink-0 overflow-x-clip border-b border-pine/10 bg-sand">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:flex-nowrap sm:gap-3 sm:px-6">
              <p className={`min-w-0 truncate font-display text-base font-bold text-pine sm:shrink-0 sm:text-lg ${path === 'quran' ? 'max-w-[calc(100%-13.5rem)] sm:max-w-[14rem] lg:max-w-none' : path === 'hadith' ? 'max-w-[calc(100%-7.75rem)] sm:max-w-[14rem] lg:max-w-none' : ''}`}>{section}</p>
              <div className="ml-auto flex shrink-0 items-center gap-2 sm:order-3">
                {quranSettings && <div id="kf-library-settings" className="hidden lg:block" />}
                {quranSettings && <div id="kf-library-settings-mobile" className="lg:hidden" />}
                <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  <span className="hidden sm:inline">{t.language}</span>
                  <select aria-label={t.language} value={lang} onChange={event => setLang(toLang(event.target.value))} className="max-w-[7.5rem] truncate rounded-full border border-pine/20 bg-parchment px-3 py-1.5 text-sm text-ink sm:max-w-none">
                    {LANGS.map(code => (
                      <option key={code} value={code}>
                        {LANGUAGE_NAMES[code].english}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <DeskHeaderTabs path={path} segments={segments} className="order-last basis-full sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto" />
            </div>
          </header>
        )}
        <main
          id="main"
          className={
            quranBook
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6'
              : 'min-h-0 flex-1 overflow-x-clip overflow-y-auto scroll-pb-28 px-4 pt-4 pb-5 sm:px-6 sm:pt-6 sm:pb-6'
          }
        >
          <div className={quranBook ? 'mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col' : 'mx-auto max-w-6xl pb-10'}>{children}</div>
        </main>
        {player && !(path === 'quran' && (segments[0] === 'book' || segments[0] === 'study')) && <AudioMiniPlayer safe={focus} />}
        {!focus && !(path === 'quran' && segments[0] === 'book') && (
          <nav aria-label="Sections" className="shrink-0 border-t border-gold/40 bg-pine pb-[env(safe-area-inset-bottom)] lg:hidden">
          <ul className="grid grid-cols-6">
            {NAV.map(item => {
              const active = item.path === path;
              return (
                <li key={item.path} className="min-w-0">
                  <a
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-12 w-full flex-col items-center justify-center gap-0.5 border-t-2 px-px py-1.5 text-center text-[10px] leading-none tracking-tight ${active ? 'border-gold text-sand' : 'border-transparent text-sand/80'}`}
                  >
                    <StudioMark name={item.mark} className="h-5 w-5 shrink-0 rounded-md" />
                    <span className="max-w-full truncate">{t[item.short]}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        )}
      </div>
    </div>
  );
}

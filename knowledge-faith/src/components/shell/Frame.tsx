import type { ReactNode } from 'react';
import { BookOpen, Bookmark, Library, Lightbulb, Mic, MoonStar, LibraryBig, type LucideIcon } from 'lucide-react';
import { LANGS, LANGUAGE_NAMES, toLang } from '../../shared/sources.ts';
import type { RouteRoot } from '../../lib/route.ts';
import { useShell } from '../../lib/shell.tsx';
import { useApp } from '../../lib/store.tsx';
import type { Strings } from '../../lib/i18n.ts';
import { useAudioState } from '../../lib/audio.ts';
import { buildStamp } from '../../buildStamp.ts';
import { BrandLockup } from './Brand.tsx';
import { AudioMiniPlayer, QuranSections, SearchField, quranSectionId } from './widgets.tsx';

interface NavItem {
  path: RouteRoot;
  href: string;
  short: keyof Strings;
  side?: keyof Strings;
  icon: LucideIcon;
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
  { path: 'hub', href: '#/hub', short: 'navKnowledge', icon: Lightbulb },
  { path: 'quran', href: '#/quran', short: 'navQuranShort', icon: BookOpen },
  { path: 'hadith', href: '#/hadith', short: 'navHadithShort', icon: Library },
  { path: 'books', href: '#/books', short: 'navBooks', icon: LibraryBig },
  { path: 'spiritual', href: '#/spiritual', short: 'navWorship', side: 'navWorship', icon: MoonStar },
  { path: 'podcast', href: '#/podcast', short: 'navPodcast', icon: Mic },
];

export function AppFrame({ path, section, segments = [], showSearch, children }: { path: RouteRoot; section: string; segments?: string[]; showSearch: boolean; children: ReactNode }) {
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
                  <item.icon className="h-4 w-4" aria-hidden />
                  {t[item.side ?? item.short]}
                </a>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-gold/40 px-3 py-4">
            <a href="#/hub/saved" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-sand/80 hover:bg-white/5">
              <Bookmark className="h-4 w-4" aria-hidden /> {t.sidebarSaved}
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
          <header className="shrink-0 border-b border-pine/10 bg-sand lg:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <BrandLockup />
              <div className="flex shrink-0 items-center gap-2">
                {quranSettings && <div id="kf-library-settings-mobile" />}
                <label className="shrink-0 text-xs text-muted">
                  <span className="sr-only">{t.language}</span>
                  <select value={lang} onChange={event => setLang(toLang(event.target.value))} className="rounded-full border border-pine/20 bg-parchment px-3 py-1.5 text-sm text-ink">
                    {LANGS.map(code => (
                      <option key={code} value={code}>
                        {LANGUAGE_NAMES[code].english}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <ReleaseMark className="px-4 pb-2 text-[10px] text-muted" />
            {showSearch && (
              <div className="px-4 pb-3">
                <SearchField />
              </div>
            )}
          </header>
        )}
        {!focus && (
          <div className="hidden shrink-0 items-center gap-4 border-b border-pine/10 bg-sand px-6 py-3 lg:flex">
            <p className="shrink-0 font-display text-lg font-bold text-pine">{section}</p>
            {showSearch && (
              <>
                <div className="h-6 w-px bg-gold/70" aria-hidden />
                <SearchField className="max-w-md flex-1" />
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              {quranSettings && <div id="kf-library-settings" />}
              <label className="flex items-center gap-2 text-xs text-muted">
                <span>{t.language}</span>
                <select value={lang} onChange={event => setLang(toLang(event.target.value))} className="rounded-full border border-pine/20 bg-parchment px-3 py-1.5 text-sm text-ink">
                  {LANGS.map(code => (
                    <option key={code} value={code}>
                      {LANGUAGE_NAMES[code].english}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
        {path === 'quran' && !focus && <QuranSections current={quranSectionId(segments[0])} />}
        <main
          id="main"
          className={
            quranBook
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6'
              : 'min-h-0 flex-1 overflow-x-clip overflow-y-auto scroll-pb-28 px-4 py-5 sm:px-6 sm:py-6'
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
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden />
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

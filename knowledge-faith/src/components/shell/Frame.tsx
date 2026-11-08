import type { ReactNode } from 'react';
import { LANGS, LANGUAGE_NAMES, toLang } from '../../shared/sources.ts';
import type { RouteRoot } from '../../lib/route.ts';
import { useShell } from '../../lib/shell.tsx';
import { useApp } from '../../lib/store.tsx';
import type { Strings } from '../../lib/i18n.ts';
import { useAudioState } from '../../lib/audio.ts';
import { buildStamp } from '../../buildStamp.ts';
import { BrandLockup } from './Brand.tsx';
import { NavGlyph, type NavIconName } from './navIcons.tsx';
import { AudioMiniPlayer, DeskHeaderTabs } from './widgets.tsx';
import { SeekerAccountPill, SeekerAuthModal } from '../SeekerAuthModal.tsx';
import { isPublicHomeHash, requestAuthenticatedNavigation, useSeekerAuth } from '../../lib/seekerAuth.ts';

interface NavItem {
  path: RouteRoot;
  href: string;
  short: keyof Strings;
  side?: keyof Strings;
  mark: NavIconName;
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

function navLinkClass(place: 'side' | 'dock') {
  return place === 'side'
    ? 'kf-nav-side flex min-h-10 items-center gap-2.5 rounded-xl border-l-2 px-2.5 py-1.5 text-[13px] font-medium'
    : 'kf-nav-dock flex min-h-11 w-full flex-col items-center justify-center gap-0.5 border-t-2 px-px py-1 text-center text-[10px] leading-none tracking-tight';
}

export function AppFrame({ path, section, segments = [], children }: { path: RouteRoot; section: string; segments?: string[]; children: ReactNode }) {
  const { t, lang, setLang } = useApp();
  const { focus, setFocus } = useShell();
  const { isAuthenticated } = useSeekerAuth();
  const audio = useAudioState();
  const player = Boolean(audio.id) && audio.status !== 'idle';
  const quranSettings = path === 'quran' && segments[0] !== 'wall';
  const quranBook = path === 'quran' && segments[0] === 'book';

  const handleNavClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string, label: string) => {
    if (!isAuthenticated && !isPublicHomeHash(href)) {
      event.preventDefault();
      requestAuthenticatedNavigation(href, label);
    }
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-sand text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-parchment focus:px-3 focus:py-2">
        Skip to content
      </a>
      {!focus && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#073C30] text-[#F5EEDC] lg:flex">
          <div className="px-4 pb-1 pt-6">
            <BrandLockup tone="emerald" />
          </div>
          <nav aria-label="Main" className="mt-4 flex-1 space-y-1 px-3">
            {NAV.map(item => {
              const active = item.path === path;
              const label = t[item.side ?? item.short];
              return (
                <a
                  key={item.path}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={event => handleNavClick(event, item.href, label)}
                  className={navLinkClass('side')}
                >
                  <NavGlyph name={item.mark} />
                  {label}
                </a>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-[#C6A15A]/35 px-3 py-4">
            <SeekerAccountPill variant="sidebar" />
            <a
              href="#/hub/saved"
              onClick={event => handleNavClick(event, '#/hub/saved', t.sidebarSaved)}
              className={`${navLinkClass('side')} text-[#F5EEDC]`}
            >
              <NavGlyph name="saved" />
              {t.sidebarSaved}
            </a>
            <a
              href="#/hub/scholar"
              onClick={event => handleNavClick(event, '#/hub/scholar', t.sidebarQuestion)}
              className={`${navLinkClass('side')} mt-1 text-[#F5EEDC]`}
            >
              <NavGlyph name="question" />
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
          <header className="shrink-0 overflow-x-clip border-b border-stone-200/80 bg-sand/95 backdrop-blur-xs">
            <div className="mx-auto flex max-w-[1280px] min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:flex-nowrap sm:px-6">
              <p className="min-w-0 truncate text-sm font-semibold tracking-tight text-[#073C30] sm:shrink-0 sm:text-[15px]">
                {section}
              </p>
              <DeskHeaderTabs path={path} segments={segments} className="order-last basis-full sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto" />
              <div className="ml-auto flex shrink-0 items-center gap-2 sm:order-3">
                {quranSettings && <div id="kf-library-settings" className="hidden lg:block" />}
                {quranSettings && <div id="kf-library-settings-mobile" className="lg:hidden" />}
                <SeekerAccountPill variant="header" />
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                  <span className="sr-only">{t.language}</span>
                  <select
                    aria-label={t.language}
                    value={lang}
                    onChange={event => setLang(toLang(event.target.value))}
                    className="rounded-full border border-stone-300/90 bg-white px-2.5 py-1 text-xs font-medium text-stone-800 shadow-2xs transition hover:border-[#073C30]/40"
                  >
                    {LANGS.map(code => (
                      <option key={code} value={code}>
                        {LANGUAGE_NAMES[code].english}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </header>
        )}
        <main
          id="main"
          className={
            quranBook
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6'
              : 'min-h-0 flex-1 overflow-x-clip overflow-y-auto scroll-pb-24 px-4 pt-4 pb-6 sm:px-6 sm:pt-5'
          }
        >
          <div className={quranBook ? 'mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col' : 'mx-auto max-w-[1240px] pb-10'}>{children}</div>
        </main>
        {player && !(path === 'quran' && (segments[0] === 'book' || segments[0] === 'study')) && <AudioMiniPlayer safe={focus} />}
        {!focus && !(path === 'quran' && segments[0] === 'book') && (
          <nav aria-label="Sections" className="shrink-0 border-t border-gold/40 bg-pine pb-[env(safe-area-inset-bottom)] lg:hidden">
          <ul className="grid grid-cols-6">
            {NAV.map(item => {
              const active = item.path === path;
              const label = t[item.short];
              return (
                <li key={item.path} className="min-w-0">
                  <a
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={event => handleNavClick(event, item.href, label)}
                    className={navLinkClass('dock')}
                  >
                    <NavGlyph name={item.mark} />
                    <span className="max-w-full truncate">{label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        )}
      </div>
      <SeekerAuthModal />
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bookmark,
  BookOpen,
  Compass,
  Globe,
  HelpCircle,
  Info,
  Library,
  LogIn,
  ScrollText,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import type { RouteRoot } from '../../lib/route.ts';
import { useShell } from '../../lib/shell.tsx';
import { useApp } from '../../lib/store.tsx';
import { useAudioState } from '../../lib/audio.ts';
import { BrandLockup } from './Brand.tsx';
import { NavGlyph, type NavIconName } from './navIcons.tsx';
import { AudioMiniPlayer, DeskHeaderTabs, isKnowledgeDomainPath } from './widgets.tsx';
import { SeekerAccountPill, SeekerAuthModal, SeekerAvatar } from '../SeekerAuthModal.tsx';
import {
  isPublicHomeHash,
  requestAuthenticatedNavigation,
  SEEKER_AUTH_EVENT,
  useSeekerAuth,
} from '../../lib/seekerAuth.ts';
import {
  ADMIN_SETTINGS_EVENT,
  FAITH_WALL_EVENT,
  listFaithWallPosts,
  resolveUserProfilePortfolio,
} from '../../lib/verseShare.ts';

interface NavItem {
  id: 'knowledge' | 'wall' | 'podcast' | 'saved' | 'profile';
  href: string;
  label: string;
  mark: NavIconName;
  isActive: (path: RouteRoot, segments: string[]) => boolean;
}

const NAV: NavItem[] = [
  {
    id: 'knowledge',
    href: '#/hub',
    label: 'Knowledge',
    mark: 'knowledge',
    isActive: (path, segments) => isKnowledgeDomainPath(path, segments),
  },
  {
    id: 'wall',
    href: '#/quran/wall',
    label: 'Faith Wall',
    mark: 'wall',
    isActive: (path, segments) =>
      (path === 'quran' && segments[0] === 'wall') || (path === 'hub' && segments[0] === 'wall'),
  },
  {
    id: 'podcast',
    href: '#/podcast',
    label: 'Podcast',
    mark: 'podcast',
    isActive: path => path === 'podcast' || path === 'studio',
  },
  {
    id: 'saved',
    href: '#/hub/saved',
    label: 'Saved',
    mark: 'saved',
    isActive: (path, segments) => path === 'hub' && segments[0] === 'saved',
  },
  {
    id: 'profile',
    href: '#/profile',
    label: 'Profile',
    mark: 'profile',
    isActive: path => path === 'profile',
  },
];

function navLinkClass(place: 'side' | 'dock') {
  return place === 'side'
    ? 'kf-nav-side flex min-h-9 items-center gap-2.5 rounded-xl border-l-2 px-2.5 py-1.5 text-xs font-medium'
    : 'kf-nav-dock flex h-12 w-full flex-col items-center justify-center gap-0.5 border-t-2 px-1 py-1 text-center text-[10px] font-medium leading-none tracking-tight sm:h-12.5 sm:flex-row sm:gap-2 sm:text-xs';
}

export function AppFrame({
  path,
  section,
  segments = [],
  children,
}: {
  path: RouteRoot;
  section: string;
  segments?: string[];
  children: ReactNode;
}) {
  const { t } = useApp();
  const { focus, setFocus } = useShell();
  const { user, isAuthenticated, openModal } = useSeekerAuth();
  const audio = useAudioState();
  const player = Boolean(audio.id) && audio.status !== 'idle';
  const quranSettings = path === 'quran' && segments[0] !== 'wall';
  const quranBook = path === 'quran' && segments[0] === 'book';

  const [wallTick, setWallTick] = useState(0);
  const [hashStr, setHashStr] = useState(() =>
    typeof window === 'undefined' ? '#/quran/wall' : window.location.hash || '#/quran/wall',
  );

  useEffect(() => {
    const sync = () => {
      setWallTick(n => n + 1);
      if (typeof window !== 'undefined') {
        setHashStr(window.location.hash || '#/quran/wall');
      }
    };
    window.addEventListener(FAITH_WALL_EVENT, sync);
    window.addEventListener(SEEKER_AUTH_EVENT, sync);
    window.addEventListener(ADMIN_SETTINGS_EVENT, sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(FAITH_WALL_EVENT, sync);
      window.removeEventListener(SEEKER_AUTH_EVENT, sync);
      window.removeEventListener(ADMIN_SETTINGS_EVENT, sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const posts = useMemo(() => listFaithWallPosts(), [wallTick, user]);
  const portfolio = useMemo(() => resolveUserProfilePortfolio('me'), [wallTick, user]);
  const myPostsCount = useMemo(
    () => (user ? posts.filter(p => p.userId && p.userId === user.id).length : 0),
    [posts, user],
  );
  const savedPostsCount = useMemo(() => posts.filter(p => p.saved).length, [posts]);

  const onFaithWall =
    (path === 'quran' && segments[0] === 'wall') || (path === 'hub' && segments[0] === 'wall');
  const activeWallTab = onFaithWall
    ? hashStr.includes('view=mine') || hashStr.includes('tab=mine')
      ? 'mine'
      : hashStr.includes('view=saved') || hashStr.includes('tab=saved')
        ? 'saved'
        : 'community'
    : null;

  const handleNavClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string, label: string) => {
    if (!isAuthenticated && !isPublicHomeHash(href)) {
      event.preventDefault();
      requestAuthenticatedNavigation(href, label);
    }
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-sand text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-parchment focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* TABLE 1 (Left Column on Desktop LG+): Brand + User Profile Summary Card (1, 2) + Faith Wall & Shortcuts Navigation (3) */}
      {!focus && (
        <aside
          data-left-social-rail
          className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col overflow-y-auto no-scrollbar border-r border-stone-200/80 bg-sand/95 px-3.5 pb-16 pt-4 text-stone-900 lg:flex"
        >
          <div className="px-1 pb-3">
            <BrandLockup tone="ivory" />
          </div>

          {/* 1 & 2: User Profile Summary Card */}
          <div
            data-sidebar-profile-card
            className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xs"
          >
            <div className="relative h-16 w-full bg-[#073C30]">
              <img
                src={portfolio.bannerUrl || '/assets/banner-art.jpg'}
                alt=""
                className="h-full w-full object-cover opacity-85"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>

            <div className="px-4 pb-3.5">
              {/* Avatar row with relative z-10 so the circular avatar sits cleanly above the banner */}
              <div className="relative z-10 -mt-7 flex items-end justify-between">
                <a
                  href="#/profile"
                  onClick={event => handleNavClick(event, '#/profile', 'Seeker Profile')}
                  className="relative z-10 inline-flex h-13 w-13 items-center justify-center overflow-hidden rounded-full bg-stone-900 text-[#F5EEDC] shadow-md ring-3 ring-white"
                >
                  <SeekerAvatar
                    avatarUrl={portfolio.avatarUrl}
                    name={portfolio.name}
                    emblem={portfolio.emblem}
                    size={24}
                  />
                </a>
                {isAuthenticated ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800/15 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" aria-hidden />
                    <span>Verified</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openModal({ targetRoute: '#/quran/wall', deskLabel: 'Community Faith Wall' })}
                    className="inline-flex items-center gap-1 rounded-full bg-[#073C30] px-2.5 py-1 text-[10px] font-semibold text-[#F5EEDC] shadow-2xs hover:bg-[#0A2E23]"
                  >
                    <LogIn className="h-2.5 w-2.5 text-[#D4AF37]" aria-hidden />
                    <span>Sign In</span>
                  </button>
                )}
              </div>

              <div className="mt-2">
                <a
                  href="#/profile"
                  onClick={event => handleNavClick(event, '#/profile', 'Seeker Profile')}
                  className="block truncate text-sm font-semibold text-stone-900 hover:text-[#073C30] hover:underline"
                >
                  {portfolio.name}
                </a>
                <p className="truncate font-mono text-[11px] text-stone-500">
                  {portfolio.handle}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-stone-600">
                  {portfolio.roleBadge}
                </p>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-stone-100 pt-2.5 text-center">
                <a
                  href="#/profile"
                  onClick={event => handleNavClick(event, '#/profile', 'Seeker Profile')}
                  className="rounded-xl border border-stone-200/80 bg-stone-50/80 px-2 py-1.5 transition hover:border-stone-300"
                >
                  <p className="text-xs font-bold text-stone-900">{portfolio.reflectionsCount}</p>
                  <p className="text-[10px] text-stone-500">Reflections</p>
                </a>
                <a
                  href="#/profile"
                  onClick={event => handleNavClick(event, '#/profile', 'Seeker Profile')}
                  className="rounded-xl border border-stone-200/80 bg-stone-50/80 px-2 py-1.5 transition hover:border-stone-300"
                >
                  <p className="text-xs font-bold text-stone-900">{portfolio.podcastsCount}</p>
                  <p className="text-[10px] text-stone-500">Podcasts</p>
                </a>
              </div>
            </div>
          </div>

          {/* 3: Faith Wall & Personal Navigation Card */}
          <nav
            aria-label="Faith Wall navigation"
            data-sidebar-wall-nav
            className="mt-3 rounded-2xl border border-stone-200/80 bg-white p-2 shadow-2xs"
          >
            <a
              href="#/quran/wall"
              data-sidebar-wall-tab="community"
              onClick={event => handleNavClick(event, '#/quran/wall', 'Community Faith Wall')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                activeWallTab === 'community'
                  ? 'bg-emerald-50/90 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                <span>Community Feed</span>
              </span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                {posts.length}
              </span>
            </a>

            <a
              href="#/quran/wall?view=mine"
              data-sidebar-wall-tab="mine"
              onClick={event => handleNavClick(event, '#/quran/wall?view=mine', 'My Personal Wall')}
              className={`mt-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                activeWallTab === 'mine'
                  ? 'bg-emerald-50/90 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                <span>My Personal Wall</span>
              </span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                {myPostsCount}
              </span>
            </a>

            <a
              href="#/quran/wall?view=saved"
              data-sidebar-wall-tab="saved"
              onClick={event => handleNavClick(event, '#/quran/wall?view=saved', 'Saved Bookmarks')}
              className={`mt-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                activeWallTab === 'saved'
                  ? 'bg-emerald-50/90 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Bookmark className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                <span>Saved Bookmarks</span>
              </span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                {savedPostsCount}
              </span>
            </a>

            <div className="my-1.5 border-t border-stone-100" />

            <a
              href="#/profile"
              data-wall-open-profile
              onClick={event => handleNavClick(event, '#/profile', 'My Profile & Settings')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition ${
                path === 'profile'
                  ? 'bg-emerald-50/90 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50 hover:text-stone-900'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-[#073C30]" aria-hidden />
                <span>My Profile & Settings</span>
              </span>
              <span className="text-[11px] text-stone-400">→</span>
            </a>
          </nav>

          {/* Study & Research Shortcuts Card */}
          <nav
            aria-label="Study shortcuts"
            className="mt-3 rounded-2xl border border-stone-200/80 bg-white p-2 shadow-2xs"
          >
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
              Study & Research Desks
            </p>
            <a
              href="#/hub"
              onClick={event => handleNavClick(event, '#/hub', 'Knowledge Hub')}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                path === 'hub' && segments.length === 0
                  ? 'bg-emerald-50/90 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Compass className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              <span>Knowledge Hub</span>
            </a>
            <a
              href="#/quran"
              onClick={event => handleNavClick(event, '#/quran', 'The Holy Qur’an')}
              className={`mt-0.5 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                path === 'quran' && segments[0] !== 'wall'
                  ? 'bg-emerald-50/90 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              <span>The Holy Qur’an</span>
            </a>
            <a
              href="#/hadith"
              onClick={event => handleNavClick(event, '#/hadith', 'Hadith Library')}
              className={`mt-0.5 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                path === 'hadith'
                  ? 'bg-emerald-50/90 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <ScrollText className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              <span>Hadith Library</span>
            </a>
            <a
              href="#/books"
              onClick={event => handleNavClick(event, '#/books', 'Islamic Books')}
              className={`mt-0.5 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                path === 'books'
                  ? 'bg-emerald-50/90 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Library className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              <span>Islamic Books</span>
            </a>
            <a
              href="#/spiritual"
              onClick={event => handleNavClick(event, '#/spiritual', 'Worship & Five Pillars')}
              className={`mt-0.5 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                path === 'spiritual'
                  ? 'bg-emerald-50/90 font-semibold text-emerald-950'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-[#C6A15A]" aria-hidden />
              <span>Worship & Prayer</span>
            </a>
            <a
              href="#/hub/scholar"
              onClick={event => handleNavClick(event, '#/hub/scholar', t.sidebarQuestion)}
              className="mt-0.5 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
            >
              <HelpCircle className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              <span>{t.sidebarQuestion}</span>
            </a>
            <a
              href="#/about"
              data-sidebar-about-link
              className="mt-0.5 flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-medium text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"
            >
              <Info className="h-3.5 w-3.5 text-stone-400" aria-hidden />
              <span>About & Reference Notes</span>
            </a>
          </nav>
        </aside>
      )}

      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${focus ? '' : 'lg:pl-72'}`}>
        {focus && (
          <div className="shrink-0 border-b border-pine/10 bg-sand px-4 py-3">
            <button type="button" onClick={() => setFocus(false)} className="rounded-full bg-pine px-4 py-2 text-sm font-medium text-sand">
              {t.exitFocus}
            </button>
          </div>
        )}
        {!focus && (
          <header className="relative z-40 shrink-0 border-b border-stone-200/80 bg-sand/95 backdrop-blur-xs">
            <div className="mx-auto max-w-[1280px] px-3 sm:px-5">
              {/* Row 1: Single strictly horizontal bar on both mobile (390px) and desktop (1440px) */}
              <div className="flex h-11 min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <p className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-[#073C30] sm:shrink-0 sm:text-sm">
                    {onFaithWall ? 'Community Faith Wall' : section}
                  </p>
                  <DeskHeaderTabs path={path} segments={segments} className="hidden min-w-0 flex-1 md:flex" />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {quranSettings && <div id="kf-library-settings" className="hidden lg:block" />}
                  {quranSettings && <div id="kf-library-settings-mobile" className="lg:hidden" />}
                  <SeekerAccountPill variant="header" />
                </div>
              </div>
              {/* Row 2 on Mobile/Small screens: Knowledge desk switcher & sub-tabs */}
              {isKnowledgeDomainPath(path, segments) && (
                <DeskHeaderTabs path={path} segments={segments} className="border-t border-stone-200/60 py-1 md:hidden" />
              )}
            </div>
          </header>
        )}
        <main
          id="main"
          className={
            quranBook
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6'
              : 'min-h-0 flex-1 overflow-x-clip overflow-y-auto scroll-pb-24 px-4 pt-4 pb-16 sm:px-6 sm:pt-5'
          }
        >
          <div className={quranBook ? 'mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col' : 'mx-auto max-w-[1160px] pb-10'}>{children}</div>
        </main>
        {player && !(path === 'quran' && (segments[0] === 'book' || segments[0] === 'study')) && <AudioMiniPlayer safe={focus} />}

        {/* 5 Primary Navigation Links (Knowledge · Faith Wall · Podcast · Saved · Profile) pinned at the bottom */}
        {!focus && !(path === 'quran' && segments[0] === 'book') && (
          <nav
            aria-label="Sections"
            data-bottom-primary-nav
            className="shrink-0 border-t border-gold/40 bg-[#073C30] pb-[env(safe-area-inset-bottom)] text-[#F5EEDC] shadow-[0_-4px_20px_rgba(3,24,18,0.12)]"
          >
            <ul className="mx-auto grid max-w-3xl grid-cols-5">
              {NAV.map(item => {
                const active = item.isActive(path, segments);
                return (
                  <li key={item.id} className="min-w-0">
                    <a
                      href={item.href}
                      data-primary-nav={item.id}
                      data-dock-nav={item.id}
                      aria-current={active ? 'page' : undefined}
                      onClick={event => handleNavClick(event, item.href, item.label)}
                      className={navLinkClass('dock')}
                    >
                      <NavGlyph name={item.mark} />
                      <span className="max-w-full truncate">{item.label}</span>
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

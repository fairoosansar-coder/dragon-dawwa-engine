import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bell,
  Bookmark,
  BookOpen,
  Check,
  ChevronUp,
  Compass,
  Globe,
  HelpCircle,
  Info,
  Library,
  LogIn,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { LANGUAGE_NAMES } from '../../shared/sources.ts';
import type { RouteRoot } from '../../lib/route.ts';
import { useShell } from '../../lib/shell.tsx';
import { UI_FONT_SCALES, UI_THEMES, useApp } from '../../lib/store.tsx';
import { profileFontClass } from '../../lib/typography.ts';
import { useAudioState } from '../../lib/audio.ts';
import { BrandLockup } from './Brand.tsx';
import { NavGlyph, type NavIconName } from './navIcons.tsx';
import { AudioMiniPlayer, DeskHeaderTabs, isKnowledgeDomainPath } from './widgets.tsx';
import { ProfileSettingsPanel } from '../ProfileSettingsPanel.tsx';
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
  listWallNotifications,
  markAllWallNotificationsRead,
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
  const { t, lang, uiTheme, fontScale, saved } = useApp();
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
  const [footerSettingsOpen, setFooterSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!footerSettingsOpen && !notifOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFooterSettingsOpen(false);
        setNotifOpen(false);
      }
    };
    const handlePointerDown = (event: MouseEvent) => {
      if (notifOpen && !notifRef.current?.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [footerSettingsOpen, notifOpen]);

  const notifications = useMemo(() => listWallNotifications(), [wallTick]);
  const unreadNotifCount = useMemo(
    () => notifications.filter(item => item.unread).length,
    [notifications],
  );

  const posts = useMemo(() => listFaithWallPosts(), [wallTick, user]);
  const portfolio = useMemo(() => resolveUserProfilePortfolio('me'), [wallTick, user]);
  const myPostsCount = useMemo(
    () => (user ? posts.filter(p => p.userId && p.userId === user.id).length : 0),
    [posts, user],
  );
  const savedPostsCount = useMemo(
    () =>
      posts.filter(p => p.saved).length +
      saved.verses.length +
      saved.hadith.length +
      (saved.dossiers?.length ?? 0),
    [posts, saved],
  );

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

  // When unauthenticated on the login screen, render a clean minimal warm ivory layout without sidebar or bottom dock clutter
  if (!isAuthenticated && path !== 'about') {
    return (
      <div
        style={{ backgroundColor: '#FAF7F0', color: '#18221D' }}
        className="flex min-h-dvh w-full flex-col bg-[#FAF7F0] text-[#18221D]"
      >
        <header
          style={{ backgroundColor: '#FAF7F0', borderColor: '#E6DEC8' }}
          className="flex h-12 shrink-0 items-center justify-between border-b border-[#E6DEC8] px-4 sm:px-6"
        >
          <span className="font-display text-sm font-bold tracking-tight text-[#0F5132]">
            DRAGON DAWWA
          </span>
          <a
            href="#/about"
            className="text-xs font-medium text-stone-600 transition hover:text-[#0F5132]"
          >
            About
          </a>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-4 py-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className={`${profileFontClass(lang)} flex h-dvh overflow-hidden bg-sand text-ink`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-parchment focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* TABLE 1 (Left Column on Desktop LG+): Brand + User Profile Summary Card (1, 2) + Faith Wall & Shortcuts Navigation (3) + Sticky Bottom Settings Footer */}
      {!focus && (
        <aside
          data-left-social-rail
          className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-stone-200/80 bg-sand/95 text-stone-900 lg:flex"
        >
          {/* Scrollable Top & Middle Area */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-3.5 pb-3 pt-4">
            <div className="px-1 pb-3">
              <BrandLockup tone="ivory" />
            </div>

            {/* 1 & 2: User Profile Summary Card */}
            <div
              data-sidebar-profile-card
              className={`${profileFontClass(lang)} overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xs`}
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
                href="#/saved"
                data-sidebar-wall-tab="saved"
                onClick={event => handleNavClick(event, '#/saved', 'Saved Bookmarks')}
                className={`mt-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                  activeWallTab === 'saved' || (path === 'hub' && segments[0] === 'saved')
                    ? 'bg-emerald-50/90 font-semibold text-emerald-950'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Bookmark className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
                  <span>Saved Bookmarks</span>
                </span>
                <span
                  data-testid="sidebar-saved-bookmarks-count"
                  className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600"
                >
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
          </div>

          {/* 1ST TABLE BOTTOM FOOTER: Dedicated Settings & Platform Customization Button + Anchored Drawer */}
          <div
            ref={footerRef}
            data-left-rail-footer
            className="relative mt-auto shrink-0 border-t border-stone-200/90 bg-white/95 p-3 backdrop-blur-xs"
          >
            {footerSettingsOpen && (
              <div
                role="dialog"
                aria-label="Platform Customization Settings"
                data-left-footer-settings-drawer
                className="absolute bottom-full left-2.5 right-2.5 z-50 mb-2 rounded-2xl border border-stone-200 bg-white p-3.5 text-stone-900 shadow-2xl ring-1 ring-black/10"
              >
                <div className="mb-2.5 flex items-center justify-between border-b border-stone-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Settings className="h-3.5 w-3.5 text-[#073C30]" aria-hidden />
                    <span className="text-xs font-bold text-stone-900">
                      Platform Customization
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFooterSettingsOpen(false)}
                    aria-label="Close customization settings"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>

                <ProfileSettingsPanel compact />

                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2.5 text-[11px]">
                  <a
                    href="#/profile"
                    onClick={() => setFooterSettingsOpen(false)}
                    className="font-semibold text-emerald-800 hover:underline"
                  >
                    My Profile & Account →
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setFooterSettingsOpen(false);
                      openModal();
                    }}
                    className="font-medium text-stone-600 hover:text-stone-900"
                  >
                    {isAuthenticated ? 'Edit Identity' : 'Sign In'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              data-testid="left-footer-settings-btn"
              aria-expanded={footerSettingsOpen}
              onClick={() => setFooterSettingsOpen(open => !open)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50/90 px-3 py-2 text-left shadow-2xs transition hover:border-[#073C30]/40 hover:bg-emerald-50/40"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#073C30] text-[#D4AF37] shadow-2xs">
                  <Settings className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-stone-900">
                    Settings & Customize
                  </p>
                  <p className="truncate text-[10px] text-stone-500">
                    Language · Colour · Font Size
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-md border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-900">
                  {LANGUAGE_NAMES[lang].native}
                </span>
                <span
                  aria-hidden
                  title={UI_THEMES[uiTheme].label}
                  style={{ background: UI_THEMES[uiTheme].swatch }}
                  className="inline-block h-3.5 w-3.5 rounded-full border border-black/20"
                />
                <ChevronUp
                  className={`h-3.5 w-3.5 text-stone-400 transition-transform ${
                    footerSettingsOpen ? 'rotate-180 text-stone-700' : ''
                  }`}
                  aria-hidden
                />
              </div>
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Customization Bottom Sheet when opened on <1024px viewports */}
      {footerSettingsOpen && (
        <div
          role="dialog"
          aria-label="Mobile Platform Customization"
          data-mobile-footer-settings-sheet
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-xs lg:hidden"
          onClick={() => setFooterSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-4 text-stone-900 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#073C30] text-[#D4AF37]">
                  <Settings className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-bold text-stone-900">Platform Customization</p>
                  <p className="text-[10px] text-stone-500">
                    {LANGUAGE_NAMES[lang].english} · {UI_THEMES[uiTheme].label}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFooterSettingsOpen(false)}
                aria-label="Close settings"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <ProfileSettingsPanel compact />
          </div>
        </div>
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
                  <p
                    data-header-section-title
                    className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-pine sm:shrink-0 sm:text-sm"
                  >
                    {onFaithWall ? 'Community Faith Wall' : section}
                  </p>
                  <DeskHeaderTabs path={path} segments={segments} className="hidden min-w-0 flex-1 md:flex" />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {quranSettings && <div id="kf-library-settings" className="hidden lg:block" />}
                  {quranSettings && <div id="kf-library-settings-mobile" className="lg:hidden" />}
                  <button
                    type="button"
                    data-mobile-customize-btn
                    onClick={() => setFooterSettingsOpen(open => !open)}
                    title="Settings · Language, Colour & Font Size"
                    className="inline-flex h-7.5 items-center gap-1 rounded-full border border-stone-300 bg-white px-2 text-[11px] font-semibold text-stone-800 shadow-2xs transition hover:border-[#073C30]/40 lg:hidden"
                  >
                    <Settings className="h-3 w-3 text-[#073C30]" aria-hidden />
                    <span>{LANGUAGE_NAMES[lang].native}</span>
                    <span
                      aria-hidden
                      style={{ background: UI_THEMES[uiTheme].swatch }}
                      className="inline-block h-2.5 w-2.5 rounded-full border border-black/20"
                    />
                  </button>

                  {/* Simple Header Notification Bell */}
                  <div ref={notifRef} className="relative shrink-0">
                    <button
                      type="button"
                      data-testid="header-notification-bell"
                      aria-label="Community notifications"
                      aria-expanded={notifOpen}
                      onClick={() => setNotifOpen(open => !open)}
                      className="relative inline-flex h-7.5 w-7.5 items-center justify-center rounded-full border border-stone-300/90 bg-white text-[#073C30] shadow-2xs transition hover:border-[#073C30]/50 hover:bg-emerald-50/40"
                    >
                      <Bell className="h-3.5 w-3.5" aria-hidden />
                      {unreadNotifCount > 0 && (
                        <span
                          data-testid="header-notification-badge"
                          style={{ backgroundColor: '#B91C1C', color: '#FFFFFF' }}
                          className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 font-mono text-[9px] font-bold text-[#FFFFFF] shadow-2xs"
                        >
                          {unreadNotifCount}
                        </span>
                      )}
                    </button>

                    {notifOpen && (
                      <div
                        role="dialog"
                        aria-label="Community Notifications"
                        data-testid="header-notifications-popover"
                        className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-stone-200 bg-white p-3 text-stone-900 shadow-2xl ring-1 ring-black/5"
                      >
                        <div className="mb-2 flex items-center justify-between border-b border-stone-100 pb-2">
                          <span className="text-xs font-bold text-stone-900">
                            Community Updates
                          </span>
                          <button
                            type="button"
                            data-testid="mark-notifications-read-btn"
                            onClick={() => {
                              markAllWallNotificationsRead();
                              setWallTick(n => n + 1);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline"
                          >
                            <Check className="h-3 w-3" aria-hidden />
                            <span>Mark all read</span>
                          </button>
                        </div>

                        <ul className="space-y-1.5">
                          {notifications.map(item => (
                            <li key={item.id}>
                              <a
                                href={item.href}
                                onClick={() => {
                                  markAllWallNotificationsRead();
                                  setWallTick(n => n + 1);
                                  setNotifOpen(false);
                                }}
                                className={`block rounded-xl border px-3 py-2 text-xs transition ${
                                  item.unread
                                    ? 'border-emerald-700/25 bg-emerald-50/60 text-stone-900'
                                    : 'border-stone-100 bg-stone-50/60 text-stone-700 hover:bg-stone-100/70'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-[#073C30]">{item.actor}</span>
                                  <span className="shrink-0 text-[10px] text-stone-500">{item.timeAgo}</span>
                                </div>
                                <p className="mt-0.5 text-[11px] leading-snug text-stone-700">
                                  {item.action} <strong className="text-stone-900">“{item.target}”</strong>
                                </p>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

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
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-3 pb-16 sm:px-6'
              : 'min-h-0 flex-1 overflow-x-clip overflow-y-auto scroll-pb-32 px-4 pt-4 pb-28 sm:px-6 sm:pt-5'
          }
        >
          <div className={quranBook ? 'mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col' : 'mx-auto max-w-[1160px] pb-12'}>{children}</div>
        </main>
        {player && !(path === 'quran' && (segments[0] === 'book' || segments[0] === 'study')) && <AudioMiniPlayer safe={focus} />}

        {/* 5 Primary Navigation Links (Knowledge · Faith Wall · Podcast · Saved · Profile) fixed at the bottom of the viewport */}
        {!focus && (
          <nav
            aria-label="Sections"
            data-bottom-primary-nav
            className="fixed bottom-0 left-0 right-0 z-40 shrink-0 border-t border-gold/40 bg-[#073C30] pb-[env(safe-area-inset-bottom)] text-[#F5EEDC] shadow-[0_-4px_20px_rgba(3,24,18,0.18)] lg:left-72"
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

import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { openedResearchDesk, parseHash, type RouteRoot } from './lib/route.ts';
import { ShellProvider, useShell } from './lib/shell.tsx';
import { AppProvider, useApp } from './lib/store.tsx';
import type { Strings } from './lib/i18n.ts';
import { Loading } from './components/ui.tsx';
import { AppFrame } from './components/shell/Frame.tsx';
import { buildStamp } from './buildStamp.ts';
import { DossierProvider } from './engine/DossierContext.tsx';
import {
  deskLabelForHash,
  isPublicHomeHash,
  openSeekerAuthModal,
  useSeekerAuth,
} from './lib/seekerAuth.ts';
import { PublicHomeOverview } from './views/PublicHomeOverview.tsx';

const KnowledgeHub = lazy(() => import('./views/KnowledgeHub.tsx'));
const QuranReader = lazy(() => import('./views/QuranReader.tsx'));
const HadithLibrary = lazy(() => import('./views/HadithLibrary.tsx'));
const SpiritualSection = lazy(() => import('./spiritual/SpiritualSection.tsx'));
const PodcastStudio = lazy(() => import('./views/PodcastStudio.tsx'));
const BooksLibrary = lazy(() => import('./views/BooksLibrary.tsx'));
const ResearchPodcasts = lazy(() => import('./views/ResearchPodcasts.tsx'));
const UserProfileView = lazy(() => import('./views/UserProfileView.tsx'));
const AdminDashboard = lazy(() => import('./views/AdminDashboard.tsx'));
const AboutView = lazy(() => import('./views/AboutView.tsx'));
const ResearchDesk = lazy(() => import('./views/ResearchDesk.tsx').then(module => ({ default: module.ResearchDesk })));

export interface ViewProps {
  sub?: string;
  segments?: string[];
  params?: URLSearchParams;
}

interface Route {
  path: RouteRoot;
  label: keyof Strings;
  view: ComponentType<ViewProps>;
}

const ROUTES: Route[] = [
  { path: 'hub', label: 'navHub', view: KnowledgeHub },
  { path: 'quran', label: 'navQuran', view: QuranReader },
  { path: 'hadith', label: 'navHadith', view: HadithLibrary },
  { path: 'books', label: 'navBooks', view: BooksLibrary },
  { path: 'spiritual', label: 'navSpiritual', view: SpiritualSection },
  { path: 'studio', label: 'navStudio', view: PodcastStudio },
  { path: 'podcast', label: 'navPodcast', view: ResearchPodcasts },
  { path: 'profile', label: 'navProfile', view: UserProfileView },
  { path: 'admin', label: 'navAdmin', view: AdminDashboard },
  { path: 'about', label: 'navAbout', view: AboutView },
];

interface Location {
  path: RouteRoot;
  segments: string[];
  params: URLSearchParams;
}

function currentLocation(): Location {
  return parseHash(window.location.hash);
}

/** `#/studio` and `#/studio/...` become `#/podcast` in the address bar. */
function redirectStudioHash(): boolean {
  const hash = window.location.hash;
  const raw = hash.replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '');
  if (raw !== 'studio' && !raw.startsWith('studio/')) return false;
  const queryAt = hash.indexOf('?');
  const query = queryAt === -1 ? '' : hash.slice(queryAt);
  const next = `#/podcast${raw.slice('studio'.length)}${query}`;
  if (next !== hash) window.history.replaceState(null, '', next);
  return true;
}

function useHashRoute(): Location {
  const [location, setLocation] = useState(() => {
    redirectStudioHash();
    return currentLocation();
  });
  useEffect(() => {
    const onChange = () => {
      redirectStudioHash();
      const next = currentLocation();
      setLocation(prev => {
        if (prev.path !== next.path || prev.segments.join('/') !== next.segments.join('/') || prev.params.toString() !== next.params.toString()) {
          document.getElementById('main')?.scrollTo({ top: 0 });
        }
        return next;
      });
    };
    if (redirectStudioHash()) onChange();
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return location;
}

function Shell() {
  const { t, lang } = useApp();
  const { setQuery, setFocus, focus } = useShell();
  const { isAuthenticated } = useSeekerAuth();
  const location = useHashRoute();
  const route = ROUTES.find(item => item.path === location.path) ?? ROUTES[0];
  const View = route.view;
  const opened = openedResearchDesk(location.path, location.segments);
  const sectionTitle = opened?.desk === 'fiqh' ? 'Fiqh' : opened?.desk === 'seerah' ? 'Seerah' : location.path === 'quran' ? t.quranTitle : t[route.label];
  const routeKey = `${location.path}/${location.segments.join('/')}?${location.params.toString()}`;
  const rawHash = typeof window === 'undefined' ? '#/hub' : window.location.hash || '';
  const onPublicHome = isPublicHomeHash(rawHash);

  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined') {
      const h = window.location.hash.trim();
      if (h === '' || h === '#' || h === '#/') {
        window.history.replaceState(null, '', '#/quran/wall');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        return;
      }
    }
    if (!isAuthenticated && !isPublicHomeHash(rawHash || '#/hub')) {
      const target = rawHash;
      const label = deskLabelForHash(target);
      openSeekerAuthModal({ targetRoute: target, deskLabel: label });
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '#/hub');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    }
  }, [isAuthenticated, rawHash, routeKey]);

  useEffect(() => {
    const booksLibrary = location.path === 'books' && location.segments.length === 0;
    if (!booksLibrary) setQuery('');
    if (location.path !== 'quran' || !isAuthenticated) setFocus(false);
  }, [routeKey, location.path, location.segments.length, setQuery, setFocus, isAuthenticated]);

  useEffect(() => {
    if (location.path === 'spiritual' && isAuthenticated) return;
    document.title = `${isAuthenticated ? sectionTitle : t.navHub} · DRAGON DAWWA`;
  }, [sectionTitle, location.path, isAuthenticated, t.navHub]);

  return (
    <AppFrame
      path={isAuthenticated ? location.path : 'hub'}
      section={isAuthenticated ? sectionTitle : t.navHub}
      segments={isAuthenticated ? location.segments : []}
    >
      <Suspense fallback={<Loading />}>
        {location.path === 'about' ? (
          <AboutView />
        ) : !isAuthenticated ? (
          <PublicHomeOverview />
        ) : opened && location.path !== 'hadith' ? (
          <ResearchDesk entry={opened.entry} desk={opened.desk} params={location.params} />
        ) : (
          <View sub={location.segments[0]} segments={location.segments} params={location.params} />
        )}
      </Suspense>
    </AppFrame>
  );
}

export default function App() {
  return (
    <AppProvider>
      <DossierProvider>
        <ShellProvider>
          <Shell />
        </ShellProvider>
      </DossierProvider>
    </AppProvider>
  );
}

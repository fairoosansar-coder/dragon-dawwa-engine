import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { parseHash, type RouteRoot } from './lib/route.ts';
import { ShellProvider, useShell } from './lib/shell.tsx';
import { AppProvider, useApp } from './lib/store.tsx';
import type { Strings } from './lib/i18n.ts';
import { Loading } from './components/ui.tsx';
import { AppFrame } from './components/shell/Frame.tsx';
import { DossierProvider } from './engine/DossierContext.tsx';

const KnowledgeHub = lazy(() => import('./views/KnowledgeHub.tsx'));
const QuranReader = lazy(() => import('./views/QuranReader.tsx'));
const HadithLibrary = lazy(() => import('./views/HadithLibrary.tsx'));
const SpiritualSection = lazy(() => import('./spiritual/SpiritualSection.tsx'));
const PodcastStudio = lazy(() => import('./views/PodcastStudio.tsx'));

export interface ViewProps {
  sub?: string;
  segments?: string[];
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
  { path: 'spiritual', label: 'navSpiritual', view: SpiritualSection },
  { path: 'studio', label: 'navStudio', view: PodcastStudio },
];

interface Location {
  path: RouteRoot;
  segments: string[];
}

function currentLocation(): Location {
  return parseHash(window.location.hash);
}

function useHashRoute(): Location {
  const [location, setLocation] = useState(currentLocation);
  useEffect(() => {
    const onChange = () => {
      const next = currentLocation();
      setLocation(prev => {
        if (prev.path !== next.path || prev.segments.join('/') !== next.segments.join('/')) {
          document.getElementById('main')?.scrollTo({ top: 0 });
        }
        return next;
      });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return location;
}

function Shell() {
  const { t, lang } = useApp();
  const { setQuery, setFocus, focus } = useShell();
  const location = useHashRoute();
  const route = ROUTES.find(item => item.path === location.path) ?? ROUTES[0];
  const View = route.view;
  const routeKey = `${location.path}/${location.segments.join('/')}`;

  useEffect(() => {
    setQuery('');
    if (location.path !== 'quran') setFocus(false);
  }, [routeKey, location.path, setQuery, setFocus]);

  useEffect(() => {
    if (location.path === 'spiritual') return;
    document.title = `${t[route.label]} · DRAGON DAWWA`;
  }, [route, t, location.path]);

  return (
    <AppFrame path={location.path} section={t[route.label]}>
      <Suspense fallback={<Loading />}>
        <View sub={location.segments[0]} segments={location.segments} />
      </Suspense>
      {!focus && (
        <footer className="mt-10 space-y-1 text-center text-xs text-muted">
          <p>{t.sourcesNote}</p>
          {lang !== 'en' && <p>{t.uiNote}</p>}
          <p className="font-display font-bold tracking-wide text-pine">DRAGON DAWWA</p>
          <p className="italic">{t.brandSub}</p>
        </footer>
      )}
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

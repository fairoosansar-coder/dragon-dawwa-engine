import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { BookOpen, Library, Lightbulb, Mic, MoonStar } from 'lucide-react';
import { LANGS, LANGUAGE_NAMES, toLang } from './shared/sources.ts';
import { parseHash, resolveHashPath, type RouteRoot } from './lib/route.ts';
import { AppProvider, useApp } from './lib/store.tsx';
import type { Strings } from './lib/i18n.ts';
import { Loading } from './components/ui.tsx';
import { DossierProvider } from './engine/DossierContext.tsx';

const KnowledgeHub = lazy(() => import('./views/KnowledgeHub.tsx'));
const QuranReader = lazy(() => import('./views/QuranReader.tsx'));
const HadithLibrary = lazy(() => import('./views/HadithLibrary.tsx'));
const SpiritualSection = lazy(() => import('./views/spiritual/SpiritualSection.tsx'));
const ReminderRunner = lazy(() => import('./components/spiritual/ReminderRunner.tsx').then(m => ({ default: m.ReminderRunner })));
const PodcastStudio = lazy(() => import('./views/PodcastStudio.tsx'));

export interface ViewProps {
  sub?: string;
  segments?: string[];
}

interface Route {
  path: string;
  label: keyof Strings;
  icon: ComponentType<{ className?: string }>;
  view: ComponentType<ViewProps>;
}

const ROUTES: Route[] = [
  { path: 'hub', label: 'navHub', icon: Lightbulb, view: KnowledgeHub },
  { path: 'quran', label: 'navQuran', icon: BookOpen, view: QuranReader },
  { path: 'hadith', label: 'navHadith', icon: Library, view: HadithLibrary },
  { path: 'spiritual', label: 'navSpiritual', icon: MoonStar, view: SpiritualSection },
  { path: 'studio', label: 'navStudio', icon: Mic, view: PodcastStudio },
];

interface Location {
  path: RouteRoot;
  segments: string[];
}

/** Links to the former Prayer & Spiritual page are rewritten in place so the address bar shows the current route. */
function currentLocation(): Location {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (/^(prayer|screen-16)(\/|$)/.test(raw)) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${resolveHashPath(raw)}`);
  }
  return parseHash(window.location.hash);
}

function useHashRoute(): Location {
  const [location, setLocation] = useState(currentLocation);
  useEffect(() => {
    const onChange = () => {
      const next = currentLocation();
      setLocation(prev => {
        if (prev.path !== next.path || prev.segments.join('/') !== next.segments.join('/')) window.scrollTo({ top: 0 });
        return next;
      });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return location;
}

function Shell() {
  const { t, lang, setLang } = useApp();
  const location = useHashRoute();
  const route = ROUTES.find(r => r.path === location.path) ?? ROUTES[0];
  const View = route.view;

  useEffect(() => {
    if (location.path === 'spiritual') return;
    document.title = `${t[route.label]} · DRAGON DAWWA`;
  }, [route, t, location.path]);

  return (
    <div className="min-h-dvh pb-24 lg:pb-10">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-pine/10 bg-sand/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <a href="#/hub" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pine font-display text-sm font-bold tracking-wide text-gold" aria-hidden>
              DD
            </span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-bold tracking-wide text-pine">DRAGON DAWWA</span>
              <span className="block text-xs italic text-ink/60">{t.brandSub}</span>
            </span>
          </a>
          <nav aria-label="Main" className="ml-6 hidden flex-1 gap-1 lg:flex">
            {ROUTES.map(r => (
              <a
                key={r.path}
                href={`#/${r.path}`}
                aria-current={r.path === route.path ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${r.path === route.path ? 'bg-pine text-white' : 'text-pine hover:bg-mint'}`}
              >
                <r.icon className="h-4 w-4" />
                {t[r.label]}
              </a>
            ))}
          </nav>
          <label className="ml-auto flex items-center gap-2 text-xs text-ink/70">
            <span className="sr-only sm:not-sr-only">{t.language}</span>
            <select
              value={lang}
              onChange={e => setLang(toLang(e.target.value))}
              className="rounded-full border border-pine/20 bg-white px-3 py-1.5 text-sm text-ink"
            >
              {LANGS.map(l => (
                <option key={l} value={l}>
                  {LANGUAGE_NAMES[l].native}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Suspense fallback={<Loading />}>
          <View sub={location.segments[0]} segments={location.segments} />
        </Suspense>
        <Suspense fallback={null}>
          <ReminderRunner />
        </Suspense>
        <footer className="mt-10 space-y-1 text-center text-xs text-ink/50">
          <p>{t.sourcesNote}</p>
          {lang !== 'en' && <p>{t.uiNote}</p>}
          <p className="font-display font-bold tracking-wide text-pine">DRAGON DAWWA</p>
          <p className="italic">{t.brandSub}</p>
        </footer>
      </main>

      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-pine/10 bg-parchment/95 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {ROUTES.map(r => (
            <li key={r.path}>
              <a
                href={`#/${r.path}`}
                aria-current={r.path === route.path ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 px-1 py-2 text-center text-[11px] leading-tight ${r.path === route.path ? 'text-pine' : 'text-ink/50'}`}
              >
                <r.icon className={`h-5 w-5 ${r.path === route.path ? 'text-gold' : ''}`} />
                <span className="line-clamp-2">{t[r.label]}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <DossierProvider>
        <Shell />
      </DossierProvider>
    </AppProvider>
  );
}

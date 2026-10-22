import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRemote } from '../lib/api.ts';
import { useShell } from '../lib/shell.tsx';
import { useApp } from '../lib/store.tsx';
import { knowledgePath } from '../shared/sourceRegistry.ts';
import type { LibraryCategory, LibraryItem } from '../shared/islamhouse.ts';
import type { Lang } from '../shared/sources.ts';
import { Card, ErrorNote, Loading, SectionTitle } from '../components/ui.tsx';
import { EmptyState } from '../components/shell/widgets.tsx';

interface Shelf {
  id: string;
  title: string;
  sourceTitle: string;
  categoryId: number;
  lang: Lang;
  page: number;
  pages: number;
  total: number;
  items: LibraryItem[];
  categories: LibraryCategory[];
}

function useHash(): string {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash));
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function KnowledgeShelf({ pathId }: { pathId: string }) {
  const { t, lang } = useApp();
  const { query } = useShell();
  const path = knowledgePath(pathId);
  const hash = useHash();
  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  const page = Math.max(1, Number(params.get('page') || 1));
  const category = /^\d{1,12}$/.test(params.get('category') ?? '') ? params.get('category')! : '';
  const remote = useRemote<Shelf>(path ? `/api/knowledge/${path.id}?lang=${lang}&page=${page}${category ? `&category=${category}` : ''}` : null);
  const selected = category ? Number(category) : path?.categoryId;
  const data =
    remote.data && remote.data.id === pathId && remote.data.lang === lang && remote.data.page === page && remote.data.categoryId === selected
      ? remote.data
      : null;
  const q = query.trim().toLowerCase();
  const items = (data?.items ?? []).filter(
    item => (!item.language || item.language === lang) && (!q || item.title.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-6">
      <a href="#/hub" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-pine">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t.back}
      </a>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{t.pathsTitle}</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-pine">{path?.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{t.pathNote}</p>
        {path && (
          <p className="mt-2 text-sm text-ink/70">
            {t.pathSource} {path.categoryId}. {path.sourceTitle}
          </p>
        )}
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.pathCatalogue}</p>
        {category && (
          <p className="mt-3">
            <a className="text-sm font-medium text-pine underline" href={`#/hub/${pathId}`}>
              {path?.title}
            </a>
          </p>
        )}
      </header>
      {remote.loading && !data && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {data && data.categories.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.categories.map(category => (
            <li key={category.id}>
              <a
                href={`#/hub/${pathId}?category=${category.id}`}
                aria-current={category.id === data.categoryId ? 'page' : undefined}
                className={`block min-h-11 rounded-2xl border px-4 py-3 text-sm font-medium ${category.id === data.categoryId ? 'border-pine bg-pine text-white' : 'border-pine/10 bg-white text-pine'}`}
              >
                {category.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      {data && items.length === 0 && (
        <EmptyState>
          {t.pathEmpty}
        </EmptyState>
      )}
      {data && items.length > 0 && (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.id}>
              <Card>
                <p className="text-xs font-semibold text-pine">IslamHouse {item.id}</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-pine" lang={item.language ?? lang}>
                  <a href={`#/hub/${pathId}/item/${item.id}`}>{item.title}</a>
                </h2>
                <a className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-pine underline" href={`#/hub/${pathId}/item/${item.id}`}>
                  Read
                </a>
                {item.sourceUrl && (
                  <a className="ml-4 inline-block text-sm text-ink/70 underline" href={item.sourceUrl} target="_blank" rel="noreferrer">
                    Original source
                  </a>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {data && data.pages > 1 && (
        <div className="flex gap-4 text-sm">
          {page > 1 && (
            <a className="inline-flex min-h-11 items-center font-semibold text-pine underline" href={`#/hub/${pathId}?page=${page - 1}${category ? `&category=${category}` : ''}`}>
              {t.previous}
            </a>
          )}
          {page < data.pages && (
            <a className="inline-flex min-h-11 items-center font-semibold text-pine underline" href={`#/hub/${pathId}?page=${page + 1}${category ? `&category=${category}` : ''}`}>
              {t.next}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

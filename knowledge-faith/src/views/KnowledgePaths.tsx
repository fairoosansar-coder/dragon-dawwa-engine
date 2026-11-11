import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Clock, Sparkles, Volume2 } from 'lucide-react';
import { useRemote } from '../lib/api.ts';
import { useShell } from '../lib/shell.tsx';
import { useApp } from '../lib/store.tsx';
import { knowledgePath } from '../shared/sourceRegistry.ts';
import type { LibraryCategory, LibraryItem } from '../shared/islamhouse.ts';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';
import { ErrorNote, Loading, SelectionWash } from '../components/ui.tsx';
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
  const remote = useRemote<Shelf>(
    path
      ? `/api/knowledge/${path.id}?lang=${lang}&page=${page}${
          category ? `&category=${category}` : ''
        }`
      : null,
  );
  const selected = category ? Number(category) : path?.categoryId;
  const data =
    remote.data &&
    remote.data.id === pathId &&
    remote.data.lang === lang &&
    remote.data.page === page &&
    remote.data.categoryId === selected
      ? remote.data
      : null;
  const q = query.trim().toLowerCase();
  const items = (data?.items ?? []).filter(
    item =>
      (!item.language || item.language === lang) &&
      (!q || item.title.toLowerCase().includes(q)),
  );
  const langLabel = LANGUAGE_NAMES[lang]?.native ?? 'English';

  return (
    <div className="space-y-6" data-testid={`knowledge-shelf-${pathId}`}>
      <a
        href="#/hub"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-pine hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t.back}
      </a>

      <header className="rounded-3xl border border-[#D4AF37]/35 bg-gradient-to-r from-[#041B14] via-[#0A2E23] to-[#041B14] p-6 text-[#FFFFFF] shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/15 px-3 py-0.5 text-xs font-bold tracking-wider text-[#F9E7B9]">
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
            <span>DRAGON DAWWA · {path?.sourceTitle.toUpperCase()}</span>
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-stone-200">
            {langLabel}
          </span>
        </div>

        <h1 className="mt-3 font-display text-2xl font-bold text-[#FFFFFF] sm:text-3xl">
          {path?.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-300">
          Curated, verified chapters and study guides with ElevenLabs v4 line-by-line voice narration in {langLabel}.
        </p>

        {category && (
          <p className="mt-3">
            <a
              className="text-xs font-semibold text-[#E6C665] underline"
              href={`#/hub/${pathId}`}
            >
              ← All chapters in {path?.title}
            </a>
          </p>
        )}
      </header>

      {remote.loading && !data && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}

      {data && data.categories.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.categories.map(cat => (
            <li key={cat.id}>
              <a
                href={`#/hub/${pathId}?category=${cat.id}`}
                aria-current={cat.id === data.categoryId ? 'page' : undefined}
                className={`relative block min-h-11 overflow-hidden rounded-2xl border px-4 py-3 text-sm font-medium ${
                  cat.id === data.categoryId
                    ? 'border-pine bg-pine text-white'
                    : 'border-pine/10 bg-white pr-14 text-pine'
                }`}
              >
                {cat.id !== data.categoryId && <SelectionWash />}
                <span className="relative">{cat.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {data && items.length === 0 && <EmptyState>{t.pathEmpty}</EmptyState>}

      {data && items.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2" data-testid="knowledge-shelf-items">
          {items.map((item, idx) => (
            <li key={item.id}>
              <article className="flex h-full flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5 shadow-2xs transition hover:-translate-y-0.5 hover:border-[#073C30]/50 hover:shadow-md">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-[#073C30]">
                      <BookOpen className="h-3.5 w-3.5" aria-hidden />
                      <span>Chapter {String(idx + 1).padStart(2, '0')} · Study Guide</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-stone-500">
                      <Clock className="h-3 w-3" aria-hidden />
                      <span>5 min read</span>
                    </span>
                  </div>

                  <h2
                    className="mt-3 font-display text-lg font-bold leading-snug text-stone-900 sm:text-xl"
                    lang={item.language ?? lang}
                  >
                    <a
                      href={`#/hub/${pathId}/item/${item.id}`}
                      className="hover:text-[#073C30] hover:underline"
                    >
                      {item.title}
                    </a>
                  </h2>

                  {item.description && (
                    <p
                      lang={item.language ?? lang}
                      className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-600"
                    >
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                  <a
                    href={`#/hub/${pathId}/item/${item.id}`}
                    data-testid={`open-chapter-${item.id}`}
                    style={{ backgroundColor: '#073C30', color: '#FFFFFF' }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#073C30] px-4 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#0A2E23]"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                    <span>Read & Listen</span>
                  </a>
                  <span className="text-[11px] font-medium text-stone-500">
                    {langLabel} · ElevenLabs v4
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {data && data.pages > 1 && (
        <div className="flex gap-4 text-sm">
          {page > 1 && (
            <a
              className="inline-flex min-h-11 items-center font-semibold text-pine underline"
              href={`#/hub/${pathId}?page=${page - 1}${
                category ? `&category=${category}` : ''
              }`}
            >
              {t.previous}
            </a>
          )}
          {page < data.pages && (
            <a
              className="inline-flex min-h-11 items-center font-semibold text-pine underline"
              href={`#/hub/${pathId}?page=${page + 1}${
                category ? `&category=${category}` : ''
              }`}
            >
              {t.next}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

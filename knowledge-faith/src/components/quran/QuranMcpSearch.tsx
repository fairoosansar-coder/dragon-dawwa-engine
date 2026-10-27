import { useEffect, useState } from 'react';
import { useRemote } from '../../lib/api.ts';
import { useApp, useStored } from '../../lib/store.tsx';
import type { Lang } from '../../shared/sources.ts';
import type { McpEdition, McpSearchResult } from '../../shared/quranMcp.ts';
import { ErrorNote, Loading } from '../ui.tsx';

function storedEdition(value: unknown, editions: McpEdition[]): string {
  if (typeof value !== 'string' || !editions.length) return '';
  return editions.some(item => item.editionId === value) ? value : '';
}

export function QuranMcpSearch({
  query,
  lang,
  onOpen,
}: {
  query: string;
  lang: Lang;
  onOpen: (surah: number, ayah: number) => void;
}) {
  const { t } = useApp();
  const [stored, setStored] = useStored<unknown>('kf-mcp-search-edition', '');
  const editions = useRemote<McpEdition[]>('/api/quran/mcp/editions?type=translation');
  const catalogue = (editions.data ?? []).slice().sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  const editionId = storedEdition(stored, catalogue);
  const [debounced, setDebounced] = useState(query.trim());
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 450);
    return () => window.clearTimeout(timer);
  }, [query]);
  const url =
    debounced.length >= 2
      ? `/api/quran/mcp/search?q=${encodeURIComponent(debounced)}${editionId ? `&edition=${encodeURIComponent(editionId)}` : ''}`
      : null;
  const remote = useRemote<McpSearchResult>(url);
  const selected = catalogue.find(item => item.editionId === editionId) ?? null;
  const hits = remote.data && remote.data.query === debounced && remote.data.translationEditionId === (editionId || null) ? remote.data : null;

  return (
    <section className="space-y-4" data-mcp-search>
      <label className="flex max-w-xl flex-col gap-1 text-xs font-medium text-muted">
        {t.searchTranslation}
        {editions.error ? (
          <span className="font-normal text-ink">{t.searchFailed}</span>
        ) : (
          <select
            id="kf-search-translation"
            value={editionId}
            onChange={event => setStored(event.target.value)}
            className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm font-normal text-ink"
          >
            <option value="">{t.searchArabicChoice}</option>
            {catalogue.map(item => (
              <option key={item.editionId} value={item.editionId}>
                {item.author ? `${item.name} — ${item.author}` : item.name}
              </option>
            ))}
          </select>
        )}
      </label>
      {(lang === 'ta' || lang === 'si') && <p className="text-sm leading-relaxed text-pine">{t.searchCatalogueGap}</p>}
      {!editionId && debounced.length >= 2 && <p className="text-sm text-muted">{t.searchArabicOnly}</p>}
      {remote.loading && !hits && <Loading />}
      {remote.error && <ErrorNote message={t.searchFailed} onRetry={remote.reload} />}
      {hits && hits.hits.length === 0 && !remote.loading && <p className="text-sm text-muted">{t.searchEmpty}</p>}
      {hits && hits.hits.length > 0 && (
        <ol className="space-y-4">
          {hits.hits.map(hit => (
            <li key={`${hit.ayah}:${hit.citationUrl}`}>
              <button type="button" onClick={() => onOpen(hit.surah, hit.verse)} className="w-full rounded-2xl bg-white px-4 py-3 text-left">
                <p className="text-xs font-medium text-[#1c3d66]">{hit.ayah}</p>
                <p lang="ar" dir="rtl" className="quran-face mt-2 text-2xl text-ink">
                  {hit.arabic}
                </p>
                {hit.translation && (
                  <p className="quran-prose mt-2 text-base">
                    {hit.translation}
                    {hit.translationName || selected?.name ? (
                      <span className="mt-1 block text-sm text-[#5c6b7a]">{hit.translationName || selected?.name}</span>
                    ) : null}
                  </p>
                )}
              </button>
              <p className="mt-1 text-sm">
                <a href={hit.citationUrl} className="text-pine underline">
                  {t.quranCom}
                </a>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

import { useState, type FormEvent } from 'react';
import type { ViewProps } from '../App.tsx';
import { useRemote } from '../lib/api.ts';
import { useApp } from '../lib/store.tsx';
import { LibraryReader } from './LibraryReader.tsx';
import { Button, Card, ErrorNote, Loading, SectionTitle } from '../components/ui.tsx';

interface ShelfItem {
  id: number;
  title: string;
  type: string;
  description: string | null;
}

interface Shelf {
  items: ShelfItem[];
}

export default function BooksLibrary({ sub, segments = [] }: ViewProps) {
  const { t, lang } = useApp();
  const itemId = sub === 'item' ? Number(segments[1]) : 0;
  const fasting = useRemote<Shelf>(`/api/library/items?topic=fasting&lang=${lang}&page=1`);
  const discover = useRemote<Shelf>(`/api/knowledge/discover?lang=${lang}&page=1`);
  const [manual, setManual] = useState('');

  if (sub === 'item' && Number.isInteger(itemId) && itemId > 0) {
    return <LibraryReader itemId={itemId} backHref="#/books" />;
  }

  function openManual(event: FormEvent) {
    event.preventDefault();
    const id = Number(manual);
    if (Number.isInteger(id) && id > 0) window.location.hash = `#/books/item/${id}`;
  }

  const items = [...(fasting.data?.items ?? []), ...(discover.data?.items ?? [])].filter(
    (item, index, all) => all.findIndex(other => other.id === item.id) === index,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl font-bold text-pine">{t.navBooks}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/75">{t.askIslamBody}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="#/books/research" className="inline-flex items-center rounded-full bg-moss px-4 py-2 text-sm font-medium text-white">
            {t.researchLibrary}
          </a>
        </div>
      </header>

      <Card>
        <form onSubmit={openManual} className="flex flex-wrap gap-2">
          <label className="text-sm">
            <span className="font-medium text-pine">{t.bookIdLabel}</span>
            <input
              value={manual}
              inputMode="numeric"
              onChange={event => setManual(event.target.value.replace(/\D/g, ''))}
              className="mt-1 block w-48 rounded-full border border-pine/20 bg-white px-4 py-2"
            />
          </label>
          <Button type="submit" variant="soft" className="self-end">{t.go}</Button>
        </form>
      </Card>

      {(fasting.loading || discover.loading) && <Loading />}
      {fasting.error && <ErrorNote message={fasting.error} onRetry={fasting.reload} />}
      {discover.error && <ErrorNote message={discover.error} onRetry={discover.reload} />}

      <section className="space-y-3">
        <SectionTitle>{t.navBooks}</SectionTitle>
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.id} className="rounded-3xl border border-pine/10 bg-parchment p-4">
              <a href={`#/books/item/${item.id}`} className="font-display text-xl font-bold text-pine hover:underline">
                {item.title || `IslamHouse ${item.id}`}
              </a>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted">{item.type} · {item.id}</p>
              {item.description && <p className="mt-2 line-clamp-3 text-sm text-ink/75">{item.description}</p>}
              <div className="mt-3">
                <a href={`#/books/research?book=${item.id}`} className="text-sm font-medium text-pine">{t.researchThisBook}</a>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { RecordShare } from '../components/RecordShare.tsx';
import { Card, ErrorNote, Loading, SectionTitle } from '../components/ui.tsx';
import { claimPlayback, pauseAudio, playAudio, useAudioState } from '../lib/audio.ts';
import { useRemote } from '../lib/api.ts';
import { useApp } from '../lib/store.tsx';
import type { ShareVerse } from '../lib/verseShare.ts';
import { libraryShareText, WORSHIP_TOPICS, worshipTopic, type LibraryFile, type LibraryItem, type LibraryPage } from '../shared/islamhouse.ts';
import { PRAYER_ARTICLE, PRAYER_CREDITS } from '../shared/sourceRegistry.ts';
import type { Lang } from '../shared/sources.ts';
import { PageBack } from './chrome.tsx';

function useLocationHash(): string {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash));
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function creditLabel(kind: string, labels: { author: string; translator: string; reviewer: string }): string {
  if (kind === 'author') return labels.author;
  if (kind === 'translator') return labels.translator;
  if (kind === 'reviewer') return labels.reviewer;
  return kind;
}

function FilePlayer({ file, itemId, index }: { file: LibraryFile; itemId: number; index: number }) {
  const { t } = useApp();
  const audio = useAudioState();
  const id = `lecture-${itemId}-${index}`;
  if (file.play === 'video') {
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-pine">
          {t.originalRecording} · {t.librarySource}
        </p>
        <video
          controls
          preload="none"
          src={file.url}
          className="w-full rounded-2xl bg-black"
          onPlay={event => claimPlayback(event.currentTarget)}
        />
      </div>
    );
  }
  if (file.play === 'audio') {
    const active = audio.id === id && (audio.status === 'playing' || audio.status === 'paused' || audio.status === 'loading');
    return (
      <button
        type="button"
        className="min-h-11 rounded-full bg-pine px-4 text-sm font-medium text-white"
        onClick={() => (active && audio.status === 'playing' ? pauseAudio() : void playAudio(id, file.url))}
      >
        {active && audio.status === 'playing' ? t.pause : t.listen}
        <span className="sr-only">
          {' '}
          {t.originalRecording}
        </span>
      </button>
    );
  }
  return (
    <a className="text-sm text-pine underline" href={file.url} target="_blank" rel="noreferrer">
      {t.sourceFile}
      {file.extension ? ` (${file.extension})` : ''}
    </a>
  );
}

function ItemBody({ item, topicId, topicTitle, lang }: { item: LibraryItem; topicId: string; topicTitle: string; lang: Lang }) {
  const { t } = useApp();
  const verse: ShareVerse = {
    surah: 0,
    ayah: 0,
    arabic: '',
    translation: [item.title, item.description].filter(Boolean).join('\n\n'),
    surahName: item.title,
    reference: `IslamHouse ${item.id}`,
    translationTitle: topicTitle,
    translationKey: item.language ?? lang,
    translationDescription: item.credits.map(credit => `${credit.kind}: ${credit.name ?? t.nameMissing}`).join(' · ') || undefined,
    sourceLabel: 'IslamHouse',
  };
  return (
    <article className="space-y-3 rounded-2xl border border-pine/10 bg-white p-4" id={`library-${item.id}`}>
      <h3 className="font-display text-xl font-bold text-pine" lang={item.language ?? lang}>
        {item.title}
      </h3>
      <p className="text-xs text-muted">
        {item.type} · {t.librarySource}
        {item.language ? ` · ${item.language}` : ''}
      </p>
      {item.credits.length > 0 && (
        <ul className="text-sm text-ink">
          {item.credits.map(credit => (
            <li key={`${credit.kind}-${credit.name ?? 'none'}`}>
              {creditLabel(credit.kind, t)}: {credit.name ?? t.nameMissing}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        {item.added ? `${t.added} ${item.added}` : ''}
        {item.updated ? ` · ${t.updated} ${item.updated}` : ''}
      </p>
      {item.description && (
        <details className="rounded-2xl border border-pine/10 px-3 py-2">
          <summary className="min-h-11 cursor-pointer list-none text-sm font-semibold text-pine [&::-webkit-details-marker]:hidden">{t.explanation}</summary>
          <p lang={item.language ?? lang} className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {item.description}
          </p>
        </details>
      )}
      <div className="space-y-3">
        {item.files.map((file, index) => (
          <div key={file.url} className="space-y-1">
            <FilePlayer file={file} itemId={item.id} index={index} />
            {file.play && (
              <p className="text-xs text-muted">
                {t.originalRecording}
                {item.credits[0]?.name ? ` · ${item.credits[0].name}` : ''} · {t.librarySource}
              </p>
            )}
          </div>
        ))}
      </div>
      {item.sourceUrl && (
        <p>
          <a className="text-sm text-pine underline" href={item.sourceUrl} target="_blank" rel="noreferrer">
            {t.sourcePage}
          </a>
        </p>
      )}
      <RecordShare
        text={libraryShareText(item, topicTitle, lang)}
        hash={`#/spiritual/library/${topicId}?lang=${lang}&item=${item.id}`}
        verse={verse}
        lang={lang}
        filename={`islamhouse-${item.id}.png`}
        title={item.title}
      />
    </article>
  );
}

export function WorshipLibrary({ topicId }: { topicId?: string }) {
  const { t, lang, setLang } = useApp();
  const hash = useLocationHash();
  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  const requested = params.get('lang');
  const itemId = params.get('item');
  const page = Number(params.get('page')) || 1;
  const topic = topicId ? worshipTopic(topicId) : null;
  useEffect(() => {
    if (requested === 'en' || requested === 'ta' || requested === 'si') setLang(requested);
  }, [topicId, itemId, requested, setLang]);

  if (!topic) {
    return (
      <div className="space-y-4">
        <SectionTitle>{t.worshipLibrary}</SectionTitle>
        <ul className="grid gap-3 sm:grid-cols-2">
          {WORSHIP_TOPICS.map(item => (
            <li key={item.id}>
              <a href={`#/spiritual/library/${item.id}?lang=${lang}`} className="block rounded-3xl border border-pine/10 bg-white px-4 py-5 font-display text-xl font-bold text-pine hover:border-gold">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageBack segments={['library', topic.id]} />
      <SectionTitle sub={t.librarySource}>{topic.title}</SectionTitle>
      {itemId ? (
        <OneItem topicId={topic.id} topicTitle={topic.title} itemId={itemId} lang={lang} />
      ) : (
        <TopicList topicId={topic.id} topicTitle={topic.title} categoryId={topic.categoryId} lang={lang} page={page} category={params.get('category') ?? ''} />
      )}
    </div>
  );
}

function OneItem({ topicId, topicTitle, itemId, lang }: { topicId: string; topicTitle: string; itemId: string; lang: Lang }) {
  const { t } = useApp();
  const remote = useRemote<{ lang: Lang; topic: string; item: LibraryItem }>(`/api/library/item?topic=${topicId}&id=${itemId}&lang=${lang}`);
  const data = remote.data && remote.data.lang === lang && remote.data.topic === topicId && String(remote.data.item.id) === itemId ? remote.data : null;
  return (
    <Card>
      {remote.loading && !data && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {data && <ItemBody item={data.item} topicId={topicId} topicTitle={topicTitle} lang={lang} />}
      <p className="mt-4 text-sm">
        <a className="text-pine underline" href={`#/spiritual/library/${topicId}?lang=${lang}`}>
          {t.back}
        </a>
      </p>
    </Card>
  );
}

function TopicList({
  topicId,
  topicTitle,
  categoryId,
  lang,
  page,
  category,
}: {
  topicId: string;
  topicTitle: string;
  categoryId: number;
  lang: Lang;
  page: number;
  category: string;
}) {
  const { t } = useApp();
  const remote = useRemote<LibraryPage>(`/api/library/items?topic=${topicId}&lang=${lang}&page=${page}${category ? `&category=${category}` : ''}`);
  const selected = category ? Number(category) : categoryId;
  const data =
    remote.data && remote.data.lang === lang && remote.data.topic === topicId && remote.data.page === page && remote.data.categoryId === selected
      ? remote.data
      : null;
  const current = data?.categories?.find(item => item.id === data.categoryId);
  const query = data?.categoryId && data.categoryId !== categoryId ? `&category=${data.categoryId}` : '';
  return (
    <div className="space-y-3">
      {remote.loading && !data && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {data && data.categoryId !== categoryId && (
        <p className="text-sm">
          <a className="font-semibold text-pine underline" href={`#/spiritual/library/${topicId}?lang=${lang}`}>
            {topicTitle}
          </a>
        </p>
      )}
      {current && data?.categoryId !== categoryId && (
        <h3 className="font-display text-xl font-bold text-pine" lang="en">
          {current.title}
        </h3>
      )}
      {data && (data.categories?.length ?? 0) > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.categories?.map(item => (
            <li key={item.id}>
              <a
                href={`#/spiritual/library/${topicId}?lang=${lang}&category=${item.id}`}
                aria-current={item.id === data.categoryId ? 'page' : undefined}
                className={`block min-h-11 rounded-2xl border px-4 py-3 text-sm font-medium ${item.id === data.categoryId ? 'border-pine bg-pine text-white' : 'border-pine/10 bg-white text-pine hover:border-gold'}`}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      {data && data.items.length === 0 && <p className="text-sm text-muted">{t.libraryEmpty}</p>}
      {topicId === 'prayer' && lang === 'ta' && (
        <article className="rounded-3xl border border-pine/10 bg-white p-4">
          <p className="text-xs font-semibold text-pine">IslamHouse {PRAYER_ARTICLE.id}</p>
          <h3 lang="ta" className="mt-2 font-display text-2xl font-bold text-pine">
            {PRAYER_ARTICLE.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t.readerPrayerNote}</p>
          <p lang="ta" className="mt-2 text-sm text-ink">
            {PRAYER_CREDITS.author}
          </p>
          <a className="mt-3 inline-block text-sm text-pine underline" href={PRAYER_ARTICLE.readerUrl} target="_blank" rel="noreferrer">
            {t.sourcePage}
          </a>
        </article>
      )}
      {data?.items.map(item => (
        <ItemBody key={item.id} item={item} topicId={topicId} topicTitle={current?.title ?? topicTitle} lang={lang} />
      ))}
      {data && data.pages > 1 && (
        <div className="flex gap-4 text-sm">
          {page > 1 && (
            <a className="inline-flex min-h-11 items-center font-semibold text-pine underline" href={`#/spiritual/library/${topicId}?lang=${lang}${query}&page=${page - 1}`}>
              {t.previous}
            </a>
          )}
          {page < data.pages && (
            <a className="inline-flex min-h-11 items-center font-semibold text-pine underline" href={`#/spiritual/library/${topicId}?lang=${lang}${query}&page=${page + 1}`}>
              {t.next}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import type { ViewProps } from '../App.tsx';
import { playAudio, stopAudio } from '../lib/audio.ts';
import { useRemote } from '../lib/api.ts';
import { ayahForLoadedSurah, clampSurah, readTextSize, useReadingPlace, type TextSize } from '../lib/readingPlace.ts';
import { scrollBehavior, scrollMain } from '../lib/scroll.ts';
import { useShell } from '../lib/shell.tsx';
import { useApp, useStored } from '../lib/store.tsx';
import { recitationUrl } from '../shared/sources.ts';
import type { SurahInfo, Verse } from '../shared/types.ts';
import { useReciter } from '../components/cards.tsx';
import { VerseCard } from '../components/cards.tsx';
import { BookPage, EmptyState, ReadingSettings, SourceAttribution, VerseActions } from '../components/shell/widgets.tsx';
import { Button, Card, ErrorNote, IconButton, Loading, TabLinks } from '../components/ui.tsx';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

type ReadMode = 'study' | 'book';

const ARABIC_SIZE: Record<TextSize, string> = { sm: 'text-2xl', md: 'text-3xl', lg: 'text-4xl' };
const BODY_SIZE: Record<TextSize, string> = { sm: 'text-base', md: 'text-lg', lg: 'text-xl' };

export default function QuranReader({ sub }: ViewProps) {
  const [place, setPlace] = useReadingPlace();
  const surah = place.surah;
  const [ayah, setAyah] = useState(place.ayah);
  const [storedSize, setStoredSize] = useStored<unknown>('kf-text-size', 'md');
  const textSize = readTextSize(storedSize);
  const setTextSize = (size: TextSize) => setStoredSize(size);
  const [reciter, setReciter] = useReciter();
  const { setFocus } = useShell();
  const mode: 'library' | ReadMode = sub === 'book' ? 'book' : sub === 'study' ? 'study' : 'library';

  const setSurah = useCallback((number: number) => {
    const next = clampSurah(number);
    setPlace(prev => (prev.surah === next ? prev : { ...prev, surah: next }));
  }, [setPlace]);

  useEffect(() => {
    if (ayah < 1) return;
    setPlace(prev => (prev.surah === surah && prev.ayah === ayah ? prev : { ...prev, ayah }));
  }, [ayah, surah, setPlace]);

  useEffect(() => {
    if (mode === 'library') setFocus(false);
  }, [mode, setFocus]);

  const open = (number: number, verse = 1, next: ReadMode = 'study') => {
    stopAudio();
    setSurah(number);
    setAyah(Math.max(verse, 1));
    window.location.hash = `#/quran/${next}`;
  };

  const onMode = (next: ReadMode) => {
    if (mode === 'library') return;
    window.location.hash = `#/quran/${next}`;
  };

  if (mode === 'library') {
    return (
      <Library
        surah={surah}
        tab={sub === 'bookmarks' ? 'bookmarks' : 'surahs'}
        textSize={textSize}
        onTextSize={setTextSize}
        reciter={reciter}
        ayah={ayah}
        onReciter={id => {
          stopAudio();
          setReciter(id);
        }}
        onOpen={open}
      />
    );
  }

  return (
    <Edition
      mode={mode}
      surah={surah}
      ayah={ayah}
      setSurah={setSurah}
      setAyah={setAyah}
      textSize={textSize}
      onTextSize={setTextSize}
      reciter={reciter}
      onReciter={id => {
        stopAudio();
        setReciter(id);
      }}
      onMode={onMode}
    />
  );
}

function Library({
  surah,
  ayah,
  tab,
  textSize,
  onTextSize,
  reciter,
  onReciter,
  onOpen,
}: {
  surah: number;
  ayah: number;
  tab: 'surahs' | 'bookmarks';
  textSize: TextSize;
  onTextSize: (size: TextSize) => void;
  reciter: string;
  onReciter: (id: string) => void;
  onOpen: (number: number, verse?: number, mode?: ReadMode) => void;
}) {
  const { t, config, saved } = useApp();
  const { query } = useShell();
  const [prefer, setPrefer] = useState<ReadMode>('study');
  const surahs = useRemote<SurahInfo[]>('/api/quran/surahs');
  const current = surahs.data?.find(item => item.number === surah);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      (surahs.data ?? []).filter(
        item =>
          !q ||
          String(item.number) === q ||
          item.englishName.toLowerCase().includes(q) ||
          item.englishNameTranslation.toLowerCase().includes(q) ||
          item.name.includes(query.trim()),
      ),
    [surahs.data, q, query],
  );
  const bookmarks = saved.verses.filter(key => !q || key.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl font-bold text-pine">{t.quranTitle}</h1>
        <p className="mt-2 text-lg text-muted">{t.quranSubtitle}</p>
      </header>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.continueReading}</p>
        <h3 className="mt-2 font-display text-2xl font-bold text-pine">{current ? current.englishName : `${t.surahs} ${surah}`}</h3>
        {current && (
          <p className="mt-1 text-sm text-muted">
            {current.number}:{ayah} · {current.englishNameTranslation} · {current.numberOfAyahs}
          </p>
        )}
        <Button className="mt-4" onClick={() => onOpen(surah, ayah, prefer)}>
          {t.continueReading}
        </Button>
      </Card>
      <Card>
        <ReadingSettings
          textSize={textSize}
          onTextSize={onTextSize}
          reciter={reciter}
          onReciter={onReciter}
          reciters={config?.reciters ?? [{ id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' }]}
          mode={prefer}
          onMode={setPrefer}
        />
      </Card>
      <TabLinks
        label={t.quranTitle}
        tabs={[
          { href: '#/quran', label: t.surahs, active: tab === 'surahs' },
          { href: '#/quran/bookmarks', label: t.bookmarks, active: tab === 'bookmarks' },
        ]}
      />
      {tab === 'bookmarks' ? (
        bookmarks.length === 0 ? (
          <EmptyState>{q ? t.noResults : t.bookmarksEmpty}</EmptyState>
        ) : (
          <ul className="space-y-2">
            {bookmarks.map(key => {
              const [s, a] = key.split(':').map(Number);
              return (
                <li key={key}>
                  <button type="button" onClick={() => onOpen(s, a, prefer)} className="w-full rounded-2xl border border-pine/10 bg-parchment px-4 py-3 text-left text-sm font-medium text-pine">
                    {key}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <Card className="p-3 sm:p-4">
          {surahs.loading && <Loading />}
          {surahs.error && <ErrorNote message={surahs.error} onRetry={surahs.reload} />}
          {!surahs.loading && !surahs.error && filtered.length === 0 && <EmptyState>{t.noResults}</EmptyState>}
          <ul className="divide-y divide-pine/10">
            {filtered.map(item => (
              <li key={item.number}>
                <button
                  type="button"
                  onClick={() => onOpen(item.number, 1, prefer)}
                  aria-current={item.number === surah ? 'true' : undefined}
                  className={`flex w-full items-center gap-3 px-2 py-3 text-left ${item.number === surah ? 'bg-mint' : ''}`}
                >
                  <span className="w-8 text-sm font-semibold text-pine">{item.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{item.englishName}</span>
                    <span className="block text-xs text-muted">{item.englishNameTranslation}</span>
                  </span>
                  <span lang="ar" className="font-[family-name:var(--font-arabic)] text-lg text-ink">
                    {item.name.replace('سُورَةُ ', '')}
                  </span>
                  <span className="w-10 text-right text-xs text-muted">{item.numberOfAyahs}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Edition({
  mode,
  surah,
  ayah,
  setSurah,
  setAyah,
  textSize,
  onTextSize,
  reciter,
  onReciter,
  onMode,
}: {
  mode: ReadMode;
  surah: number;
  ayah: number;
  setSurah: (value: number) => void;
  setAyah: (value: number) => void;
  textSize: TextSize;
  onTextSize: (size: TextSize) => void;
  reciter: string;
  onReciter: (id: string) => void;
  onMode: (mode: ReadMode) => void;
}) {
  const { t, lang, config, toggleVerse, isVerseSaved } = useApp();
  const { query, setFocus } = useShell();
  const [contents, setContents] = useState(false);
  const reader = useRemote<{ info: SurahInfo; verses: Verse[] }>(`/api/quran/surah/${surah}?lang=${lang}`);
  const surahs = useRemote<SurahInfo[]>('/api/quran/surahs');
  const loaded = reader.data?.info.number === surah ? reader.data : null;
  const verses = loaded?.verses ?? [];
  const versesRef = useRef(verses);
  versesRef.current = verses;
  const touch = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const next = ayahForLoadedSurah(surah, reader.data?.info.number, reader.data?.info.numberOfAyahs, ayah);
    if (next != null && next !== ayah) setAyah(next);
  }, [reader.data, ayah, surah, setAyah]);

  const goSurah = useCallback(
    (number: number, verse = 1) => {
      stopAudio();
      setSurah(number);
      setAyah(verse);
      setContents(false);
      scrollMain();
    },
    [setAyah, setSurah],
  );

  const step = useCallback(
    (delta: number) => {
      const count = reader.data?.info.number === surah ? reader.data.info.numberOfAyahs : 0;
      if (!count) return;
      stopAudio();
      const next = ayah + delta;
      if (next >= 1 && next <= count) {
        setAyah(next);
        return;
      }
      if (next < 1 && surah > 1) goSurah(surah - 1, 0);
      if (next > count && surah < 114) goSurah(surah + 1, 1);
    },
    [ayah, goSurah, reader.data, setAyah, surah],
  );

  const playRef = useRef<(n: number) => void>(() => undefined);
  playRef.current = (ayahNumber: number) => {
    if (reader.data?.info.number !== surah) return;
    const list = versesRef.current;
    const verse = list.find(item => item.ayah === ayahNumber);
    if (!verse) return;
    setAyah(verse.ayah);
    const index = list.findIndex(item => item.ayah === verse.ayah);
    void playAudio(`ayah-${verse.number}`, recitationUrl(reciter, verse.number), () => {
      const next = versesRef.current[index + 1];
      if (next) playRef.current(next.ayah);
    });
  };

  useEffect(() => {
    if (mode !== 'book') return;
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'Escape') setFocus(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, setFocus, step]);

  useEffect(() => {
    if (ayah < 1 || reader.data?.info.number !== surah) return;
    const mark = document.getElementById(mode === 'book' ? `ayah-mark-${ayah}` : `v-${surah}-${ayah}`);
    if (!mark) return;
    mark.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  }, [ayah, mode, surah, lang, reader.data]);

  const current = verses.find(item => item.ayah === ayah) ?? verses[0];
  const savedKey = current?.key ?? '';
  const q = query.trim().toLowerCase();
  const list = (surahs.data ?? []).filter(
    item => !q || String(item.number) === q || item.englishName.toLowerCase().includes(q) || item.name.includes(query.trim()),
  );

  const surahList = (
    <Card className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:p-4">
      <h2 className="font-display text-xl font-bold text-pine">{t.contents}</h2>
      {surahs.loading && <Loading />}
      {surahs.error && <ErrorNote message={surahs.error} onRetry={surahs.reload} />}
      <ul className="mt-3 space-y-1">
        {list.map(item => (
          <li key={item.number}>
            <button
              type="button"
              onClick={() => goSurah(item.number, 1)}
              aria-current={item.number === surah ? 'true' : undefined}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${item.number === surah ? 'bg-pine text-sand' : 'hover:bg-mint'}`}
            >
              <span className="w-7 text-xs opacity-70">{item.number}</span>
              <span className="flex-1">{item.englishName}</span>
              <span className="text-xs opacity-70">{item.numberOfAyahs}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );

  return (
    <div className={mode === 'book' ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]' : 'grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]'}>
      {mode === 'study' && <div className="hidden lg:block">{surahList}</div>}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <IconButton label={t.contents} onClick={() => setContents(open => !open)}>
            <List className="h-5 w-5" />
          </IconButton>
          <IconButton label={t.previousAyah} onClick={() => step(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <IconButton label={t.nextAyah} onClick={() => step(1)}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
          <Button variant="ghost" onClick={() => setFocus(true)}>
            {t.focusReading}
          </Button>
          <span className="text-sm text-muted">
            {surah}:{ayah >= 1 ? ayah : '…'}
          </span>
        </div>
        {(contents || q.length > 0) && <div className="mb-4 lg:hidden">{surahList}</div>}
        <div className="mb-4">
          <ReadingSettings
            mode={mode}
            textSize={textSize}
            onTextSize={onTextSize}
            reciter={reciter}
            onReciter={onReciter}
            reciters={config?.reciters ?? [{ id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' }]}
            onMode={onMode}
          />
        </div>
        {!loaded && reader.loading && <Loading />}
        {reader.error && <ErrorNote message={reader.error} onRetry={reader.reload} />}
        {loaded && mode === 'study' && (
          <Card>
            <p className="text-xs uppercase tracking-widest text-muted">
              {loaded.info.number} · {loaded.info.revelationType} · {loaded.info.numberOfAyahs}
            </p>
            <h2 className="font-display text-3xl font-bold text-pine">{loaded.info.englishName}</h2>
            <p className="text-sm text-muted">{loaded.info.englishNameTranslation}</p>
            <div className="mt-3">
              <SourceAttribution />
            </div>
            {surah !== 1 && surah !== 9 && (
              <p lang="ar" className="arabic mt-6 text-center text-3xl text-pine">
                {BISMILLAH}
              </p>
            )}
            <div className={ARABIC_SIZE[textSize]}>
              {verses.map(verse => (
                <div key={verse.key} className={BODY_SIZE[textSize]}>
                  <VerseCard
                    verse={verse}
                    scale={textSize}
                    selected={verse.ayah === ayah}
                    onEnded={() => playRef.current(verse.ayah + 1)}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}
        {loaded && mode === 'book' && (
          <div
            onTouchStart={event => {
              touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
            }}
            onTouchEnd={event => {
              const dx = event.changedTouches[0].clientX - touch.current.x;
              const dy = event.changedTouches[0].clientY - touch.current.y;
              if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
              step(dx < 0 ? 1 : -1);
            }}
          >
            <BookPage>
              <header className="mb-6 text-center">
                <p className="text-xs uppercase tracking-widest text-muted">{loaded.info.revelationType}</p>
                <h2 className="mt-2 font-display text-3xl font-bold text-pine">{loaded.info.englishName}</h2>
                <p lang="ar" className="arabic mt-2 text-2xl text-ink">
                  {loaded.info.name}
                </p>
                {surah !== 1 && surah !== 9 && (
                  <p lang="ar" className="arabic mt-4 text-2xl text-pine">
                    {BISMILLAH}
                  </p>
                )}
              </header>
              {lang === 'en' && (
                <p lang="ar" dir="rtl" className={`arabic text-ink ${ARABIC_SIZE[textSize]}`}>
                  {verses.map(verse => (
                    <span
                      key={verse.key}
                      id={`ayah-mark-${verse.ayah}`}
                      onClick={() => setAyah(verse.ayah)}
                      className={verse.ayah === ayah ? 'rounded bg-gold/15' : undefined}
                    >
                      <span className="mx-1 inline-block min-w-6 rounded-full border border-gold px-1 text-center font-sans text-xs font-semibold text-pine">
                        {verse.ayah}
                      </span>
                      {verse.arabic}{' '}
                    </span>
                  ))}
                </p>
              )}
              <p lang={lang} className={`mt-6 leading-loose text-ink ${BODY_SIZE[textSize]} ${lang === 'en' ? '' : ''}`}>
                {verses.map(verse => (
                  <span
                    key={`${verse.key}-tr`}
                    id={lang === 'en' ? undefined : `ayah-mark-${verse.ayah}`}
                    onClick={() => setAyah(verse.ayah)}
                    className={verse.ayah === ayah ? 'rounded bg-gold/15' : undefined}
                  >
                    <span className="mx-1 inline-block min-w-6 rounded-full border border-gold px-1 text-center align-middle font-sans text-xs font-semibold text-pine">
                      {verse.ayah}
                    </span>
                    {verse.translation}{' '}
                  </span>
                ))}
              </p>
              <div className="mt-8 space-y-3">
                <SourceAttribution />
                <VerseActions
                  saved={savedKey ? isVerseSaved(savedKey) : false}
                  onListen={() => current && playRef.current(current.ayah)}
                  onBookmark={() => savedKey && toggleVerse(savedKey)}
                />
                <p className="text-sm text-muted">{t.reflowNote}</p>
              </div>
            </BookPage>
          </div>
        )}
        <p className="mt-4 text-center text-sm text-muted">{surah} / 114</p>
      </div>
      {mode === 'book' && <div className="hidden lg:block">{surahList}</div>}
    </div>
  );
}

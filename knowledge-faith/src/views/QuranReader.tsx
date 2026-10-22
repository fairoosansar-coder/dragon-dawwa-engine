import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, List } from 'lucide-react';
import type { ViewProps } from '../App.tsx';
import { Mukhtasar } from '../components/Mukhtasar.tsx';
import { VerseShare } from '../components/VerseShare.tsx';
import { playAudio, stopAudio, useAudioState } from '../lib/audio.ts';
import { useRemote } from '../lib/api.ts';
import { useQuranEdition } from '../lib/quranEdition.ts';
import { ayahForLoadedSurah, clampSurah, displaySurah, readTextSize, readingPlaceLabel, useReadingPlace, type TextSize } from '../lib/readingPlace.ts';
import { scrollBehavior, scrollMain } from '../lib/scroll.ts';
import { useShell } from '../lib/shell.tsx';
import { usePronunciation, withPronunciation } from '../lib/pronunciation.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { usePendingReadingLink } from '../lib/verseShare.ts';
import {
  acceptsMeaning,
  coverageFromPayload,
  listedMeaningUrl,
  meaningPlaybackId,
  nextListedMeaning,
  type AudioCoverage,
} from '../shared/quranenc.ts';
import { recitationUrl, type Lang } from '../shared/sources.ts';
import type { SurahInfo, Verse } from '../shared/types.ts';
import { useReciter } from '../components/cards.tsx';
import { VerseCard } from '../components/cards.tsx';
import { audioStatusLabel, BookPage, EmptyState, PronunciationStatus, ReadingSettings, SourceAttribution, VerseActions } from '../components/shell/widgets.tsx';
import { Button, Card, ErrorNote, IconButton, Loading, TabLinks } from '../components/ui.tsx';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

interface ArabicPayload {
  info: SurahInfo;
  verses: Array<{
    key: string;
    surah: number;
    ayah: number;
    number: number;
    arabic: string;
    surahName: string;
    transliteration?: string;
    transliterationEdition?: string;
  }>;
}

interface MeaningPayload {
  surah: number;
  lang: Lang;
  editionKey: string;
  translationVersion: string;
  translationTitle: string;
  translationDescription: string;
  verses: { ayah: number; translation: string; footnotes: string }[];
}

function mergeReading(arabic: ArabicPayload, meaning: MeaningPayload | null, lang: Lang): Verse[] {
  const byAyah = new Map(meaning?.verses.map(verse => [verse.ayah, verse]) ?? []);
  return arabic.verses.map(verse => {
    const row = byAyah.get(verse.ayah);
    return {
      ...verse,
      lang,
      translation: row?.translation ?? '',
      translator: meaning?.translationTitle ?? '',
      footnotes: row?.footnotes || undefined,
      translationKey: meaning?.editionKey,
      translationVersion: meaning?.translationVersion,
      translationTitle: meaning?.translationTitle,
      translationDescription: meaning?.translationDescription,
    };
  });
}

type ReadMode = 'study' | 'book';

const ARABIC_SIZE: Record<TextSize, string> = { sm: 'text-2xl', md: 'text-3xl', lg: 'text-4xl' };
const BODY_SIZE: Record<TextSize, string> = { sm: 'text-base', md: 'text-lg', lg: 'text-xl' };

export default function QuranReader({ sub }: ViewProps) {
  const [place, setPlace] = useReadingPlace();
  const surah = place.surah;
  const [ayah, setAyah] = useState(place.ayah);
  const pendingLink = usePendingReadingLink();
  const { t, lang, setLang } = useApp();
  const quranEdition = useQuranEdition();
  const viewSurah = pendingLink.link?.surah ?? surah;
  const viewAyah = pendingLink.link?.ayah ?? ayah;
  const viewLang = pendingLink.link?.lang ?? lang;
  const viewEdition = pendingLink.link?.edition ?? quranEdition.editionKey;
  const [storedSize, setStoredSize] = useStored<unknown>('kf-text-size', 'md');
  const textSize = readTextSize(storedSize);
  const setTextSize = (size: TextSize) => setStoredSize(size);
  const [reciter, setReciter] = useReciter();
  const editionsError = quranEdition.error ?? (!quranEdition.loading && quranEdition.editions.length === 0 ? t.quranEncMissing : null);
  const { setFocus } = useShell();
  const mode: 'library' | ReadMode = sub === 'book' ? 'book' : sub === 'study' ? 'study' : 'library';

  const setSurah = useCallback((number: number) => {
    const next = clampSurah(number);
    setPlace(prev => (prev.surah === next ? prev : { ...prev, surah: next }));
  }, [setPlace]);

  useEffect(() => {
    const link = pendingLink.link;
    if (!link) return;
    if (link.lang) setLang(link.lang);
    if (link.edition) quranEdition.accept(link.lang ?? lang, link.edition);
    if (link.surah) setSurah(link.surah);
    if (link.ayah) setAyah(link.ayah);
    pendingLink.consume();
  }, [lang, pendingLink, quranEdition.accept, setAyah, setLang, setSurah]);

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
        editions={quranEdition.editions}
        editionKey={viewEdition}
        onEdition={quranEdition.choose}
        editionsError={editionsError}
      />
    );
  }

  return (
    <Edition
      mode={mode}
      surah={viewSurah}
      ayah={viewAyah}
      contentLang={viewLang}
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
      editions={quranEdition.editions}
      editionKey={viewEdition}
      onEdition={quranEdition.choose}
      editionsError={editionsError}
      onEditionsRetry={quranEdition.error ? quranEdition.reload : undefined}
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
  editions,
  editionKey,
  onEdition,
  editionsError,
}: {
  surah: number;
  ayah: number;
  tab: 'surahs' | 'bookmarks';
  textSize: TextSize;
  onTextSize: (size: TextSize) => void;
  reciter: string;
  onReciter: (id: string) => void;
  onOpen: (number: number, verse?: number, mode?: ReadMode) => void;
  editions: ReturnType<typeof useQuranEdition>['editions'];
  editionKey: string;
  onEdition: (key: string) => void;
  editionsError: string | null;
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
        <h3 className="mt-2 font-display text-2xl font-bold text-pine">{current ? current.englishName : `${t.surahs} ${displaySurah(surah)}`}</h3>
        {current && (
          <p className="mt-1 text-sm text-muted">
            {readingPlaceLabel(surah, ayah)} · {current.englishNameTranslation} · {current.numberOfAyahs}
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
          editions={editions}
          editionKey={editionKey}
          onEdition={onEdition}
          editionsError={editionsError}
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
          <ul className="grid grid-cols-1 gap-px bg-pine/10 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(item => (
              <li key={item.number} className={item.number === surah ? 'bg-mint' : 'bg-sand'}>
                <button
                  type="button"
                  onClick={() => onOpen(item.number, 1, prefer)}
                  aria-current={item.number === surah ? 'true' : undefined}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold bg-sand text-sm font-semibold text-pine">
                    {item.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span lang="ar" dir="rtl" className="block w-fit font-[family-name:var(--font-arabic)] text-xl leading-tight text-ink">
                      {item.name.replace(/^سُورَةُ\s+/, '')}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <BookOpen className="h-3.5 w-3.5" aria-hidden />
                      {item.numberOfAyahs} {item.numberOfAyahs === 1 ? t.verseOne : t.verseMany}
                    </span>
                  </span>
                  <span className="max-w-[9rem] shrink-0 text-right text-sm font-medium text-ink">{item.englishName}</span>
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
  contentLang,
  setSurah,
  setAyah,
  textSize,
  onTextSize,
  reciter,
  onReciter,
  onMode,
  editions,
  editionKey,
  onEdition,
  editionsError,
  onEditionsRetry,
}: {
  mode: ReadMode;
  surah: number;
  ayah: number;
  contentLang: Lang;
  setSurah: (value: number) => void;
  setAyah: (value: number) => void;
  textSize: TextSize;
  onTextSize: (size: TextSize) => void;
  reciter: string;
  onReciter: (id: string) => void;
  onMode: (mode: ReadMode) => void;
  editions: ReturnType<typeof useQuranEdition>['editions'];
  editionKey: string;
  onEdition: (key: string) => void;
  editionsError: string | null;
  onEditionsRetry?: () => void;
}) {
  const { t, config, toggleVerse, isVerseSaved } = useApp();
  const lang = contentLang;
  const [pronunciation] = usePronunciation();
  const { query, setFocus } = useShell();
  const [contents, setContents] = useState(false);
  const arabicUrl = withPronunciation(`/api/quran/surah/${surah}/arabic`, pronunciation);
  const meaningUrl = editionKey ? `/api/quran/surah/${surah}/meaning?lang=${lang}&edition=${encodeURIComponent(editionKey)}` : null;
  const arabicRemote = useRemote<ArabicPayload>(arabicUrl);
  const meaningRemote = useRemote<MeaningPayload>(meaningUrl);
  const manifestRemote = useRemote<unknown>(editionKey ? `/api/quran/audio-manifest?edition=${encodeURIComponent(editionKey)}` : null);
  const coverage = useMemo<AudioCoverage | null>(() => {
    if (!editionKey || manifestRemote.error || !manifestRemote.data) return null;
    const parsed = coverageFromPayload(manifestRemote.data);
    return parsed && parsed.translation === editionKey ? parsed : null;
  }, [editionKey, manifestRemote.data, manifestRemote.error]);
  const surahs = useRemote<SurahInfo[]>('/api/quran/surahs');
  const arabic = arabicRemote.data?.info.number === surah ? arabicRemote.data : null;
  const meaning = acceptsMeaning(meaningRemote.data, surah, lang, editionKey) ? meaningRemote.data : null;
  const loaded = arabic;
  const verses = arabic ? mergeReading(arabic, meaning, lang) : [];
  const versesRef = useRef(verses);
  versesRef.current = verses;
  const touch = useRef({ x: 0, y: 0 });
  const pendingMeaning = useRef<{ key: string; surah: number; ayah: number } | null>(null);
  const [meaningNote, setMeaningNote] = useState<string | null>(null);
  const audio = useAudioState();
  const coverageRef = useRef(coverage);
  coverageRef.current = coverage;

  useEffect(() => {
    const next = ayahForLoadedSurah(surah, loaded?.info.number, loaded?.info.numberOfAyahs, ayah);
    if (next != null && next !== ayah) setAyah(next);
  }, [loaded, ayah, surah, setAyah]);

  useEffect(() => {
    pendingMeaning.current = null;
    setMeaningNote(null);
  }, [editionKey, lang, reciter]);

  const goSurah = useCallback(
    (number: number, verse = 1, keepMeaning = false) => {
      if (!keepMeaning) {
        pendingMeaning.current = null;
        setMeaningNote(null);
        stopAudio();
      }
      setSurah(number);
      setAyah(verse);
      setContents(false);
      scrollMain();
    },
    [setAyah, setSurah],
  );

  const step = useCallback(
    (delta: number) => {
      const count = loaded?.info.number === surah ? loaded.info.numberOfAyahs : 0;
      if (!count) return;
      pendingMeaning.current = null;
      setMeaningNote(null);
      stopAudio();
      const next = ayah + delta;
      if (next >= 1 && next <= count) {
        setAyah(next);
        return;
      }
      if (next < 1 && surah > 1) goSurah(surah - 1, 0);
      if (next > count && surah < 114) goSurah(surah + 1, 1);
    },
    [ayah, goSurah, loaded, setAyah, surah],
  );

  const playMeaningRef = useRef<(surahNumber: number, ayahNumber: number) => void>(() => undefined);
  playMeaningRef.current = (surahNumber: number, ayahNumber: number) => {
    const key = editionKey;
    const src = coverageRef.current && key ? listedMeaningUrl(coverageRef.current, key, surahNumber, ayahNumber) : null;
    if (!key || !src) {
      setMeaningNote(t.meaningAudioNotListedVerse);
      return;
    }
    setMeaningNote(null);
    setAyah(ayahNumber);
    const info = loaded?.info.number === surahNumber ? loaded.info : null;
    const count = info?.numberOfAyahs ?? 0;
    void playAudio(meaningPlaybackId(key, surahNumber, ayahNumber), src, () => {
      const next = nextListedMeaning(coverageRef.current, key, surahNumber, ayahNumber, count);
      if (next.kind === 'play' && next.surah === surahNumber) {
        playMeaningRef.current(next.surah, next.ayah);
        return;
      }
      if (next.kind === 'play') {
        pendingMeaning.current = { key, surah: next.surah, ayah: next.ayah };
        goSurah(next.surah, next.ayah, true);
        return;
      }
      stopAudio();
      if (next.kind === 'missing') setMeaningNote(t.meaningAudioNextMissing);
    });
  };

  useEffect(() => {
    const pending = pendingMeaning.current;
    if (!pending || !loaded || !coverage) return;
    if (pending.key !== editionKey || loaded.info.number !== pending.surah) return;
    pendingMeaning.current = null;
    playMeaningRef.current(pending.surah, pending.ayah);
  }, [coverage, editionKey, loaded]);

  const playRef = useRef<(n: number) => void>(() => undefined);
  playRef.current = (ayahNumber: number) => {
    if (!loaded || loaded.info.number !== surah) return;
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
    if (ayah < 1 || loaded?.info.number !== surah) return;
    const mark = document.getElementById(mode === 'book' ? `ayah-mark-${ayah}` : `v-${surah}-${ayah}`);
    if (!mark) return;
    mark.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  }, [ayah, mode, surah, lang, loaded]);

  const current = verses.find(item => item.ayah === ayah) ?? verses[0];
  const savedKey = current?.key ?? '';
  const manifestUnreadable = Boolean(editionKey && manifestRemote.data && !manifestRemote.loading && !manifestRemote.error && !coverage);
  const editionNotice = !editionKey
    ? null
    : manifestRemote.loading && !coverage
      ? null
      : manifestRemote.error
        ? manifestRemote.error
        : manifestUnreadable
          ? t.meaningAudioListFailed
          : coverage && coverage.count === 0
            ? t.meaningAudioNotListed
            : null;
  const meaningFor = (verse: Verse | undefined): { action: (() => void) | null; note: string | null } => {
    if (!verse || !coverage || editionNotice) return { action: null, note: null };
    if (!listedMeaningUrl(coverage, editionKey, verse.surah, verse.ayah)) return { action: null, note: t.meaningAudioNotListedVerse };
    return { action: () => playMeaningRef.current(verse.surah, verse.ayah), note: null };
  };
  const bookMeaning = meaningFor(current);
  const meaningStatus = audio.id?.startsWith('meaning-') && audio.status !== 'idle' ? audioStatusLabel(t, audio.status, audio.id) : null;
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
            {typeof ayah === 'number' && ayah >= 1 ? readingPlaceLabel(surah, ayah) : `${displaySurah(surah)}:…`}
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
            editions={editions}
            editionKey={editionKey}
            onEdition={onEdition}
            editionsError={editionsError}
          />
        </div>
        {!arabic && arabicRemote.loading && <Loading />}
        {!arabic && !arabicRemote.loading && arabicRemote.error && <ErrorNote message={arabicRemote.error} onRetry={arabicRemote.reload} />}
        {editionsError && <ErrorNote message={editionsError} onRetry={onEditionsRetry} />}
        {meaningRemote.error && <ErrorNote message={meaningRemote.error} onRetry={meaningRemote.reload} />}
        {loaded && mode === 'study' && (
          <Card>
            <p className="text-xs uppercase tracking-widest text-muted">
              {loaded.info.number} · {loaded.info.revelationType} · {loaded.info.numberOfAyahs}
            </p>
            <h2 className="font-display text-3xl font-bold text-pine">{loaded.info.englishName}</h2>
            <p className="text-sm text-muted">{loaded.info.englishNameTranslation}</p>
            <div className="mt-3 space-y-2">
              {meaning && <SourceAttribution verse={verses[0]} />}
              {editionNotice && (
                <p className="text-sm text-muted" role="status">
                  {editionNotice}
                </p>
              )}
              {meaningNote && (
                <p className="text-sm text-muted" role="status">
                  {meaningNote}
                </p>
              )}
              {meaningStatus && <p className="text-sm text-muted">{meaningStatus}</p>}
              <PronunciationStatus pronunciation={pronunciation} />
              {pronunciation === 'en' && verses.some(verse => verse.transliteration) && <p className="text-sm text-muted">{t.pronunciationSource}</p>}
              {pronunciation === 'en' && verses.length > 0 && !verses.some(verse => verse.transliteration) && (
                <p className="text-sm text-muted">{t.pronunciationMissing}</p>
              )}
              {!meaning && meaningRemote.loading && (
                <p className="text-sm text-muted" role="status">
                  {t.loadingMeaning}
                </p>
              )}
            </div>
            {surah !== 1 && surah !== 9 && (
              <p lang="ar" className="arabic mt-6 text-center text-3xl text-pine">
                {BISMILLAH}
              </p>
            )}
            <div className={ARABIC_SIZE[textSize]}>
              {verses.map(verse => {
                const meaning = meaningFor(verse);
                return (
                  <div key={verse.key} className={BODY_SIZE[textSize]}>
                    <VerseCard
                      verse={verse}
                      scale={textSize}
                      selected={verse.ayah === ayah}
                      onEnded={() => playRef.current(verse.ayah + 1)}
                      cite={false}
                      onMeaning={meaning.action}
                      meaningNote={meaning.note}
                    />
                  </div>
                );
              })}
            </div>
            {current && (
              <div className="mt-6">
                <VerseShare
                  lang={lang}
                  mode="study"
                  verse={{
                    surah: current.surah,
                    ayah: current.ayah,
                    arabic: current.arabic,
                    translation: current.translation,
                    footnotes: current.footnotes,
                    surahName: current.surahName,
                    translationTitle: current.translationTitle,
                    translationKey: current.translationKey,
                    translationVersion: current.translationVersion,
                    translationDescription: current.translationDescription,
                  }}
                />
              </div>
            )}
            <Mukhtasar surah={surah} ayah={ayah >= 1 ? ayah : 1} lang={lang} />
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
              {pronunciation === 'en' && verses.some(verse => verse.transliteration) && (
                <p lang="en" className={`mt-6 leading-loose text-ink/80 ${BODY_SIZE[textSize]}`}>
                  {verses.map(verse => (
                    <span key={`${verse.key}-pr`} onClick={() => setAyah(verse.ayah)} className={verse.ayah === ayah ? 'rounded bg-gold/15' : undefined}>
                      <span className="mx-1 inline-block min-w-6 rounded-full border border-gold px-1 text-center align-middle font-sans text-xs font-semibold text-pine">
                        {verse.ayah}
                      </span>
                      {verse.transliteration}{' '}
                    </span>
                  ))}
                </p>
              )}
              {meaning && (
                <p lang={lang} className={`mt-6 leading-loose text-ink ${BODY_SIZE[textSize]}`}>
                  {verses.map(verse => (
                    <span key={`${verse.key}-tr`} onClick={() => setAyah(verse.ayah)} className={verse.ayah === ayah ? 'rounded bg-gold/15' : undefined}>
                      <span className="mx-1 inline-block min-w-6 rounded-full border border-gold px-1 text-center align-middle font-sans text-xs font-semibold text-pine">
                        {verse.ayah}
                      </span>
                      {verse.translation}{' '}
                    </span>
                  ))}
                </p>
              )}
              {meaning && verses.some(verse => verse.footnotes) && (
                <details className={`mt-6 rounded-2xl border border-pine/10 px-4 py-3 text-ink/80 ${BODY_SIZE[textSize]}`}>
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-muted">{t.footnotes}</summary>
                  <div className="mt-3 space-y-3">
                    {verses
                      .filter(verse => verse.footnotes)
                      .map(verse => (
                        <p key={`${verse.key}-fn`} lang={lang} className="whitespace-pre-wrap leading-relaxed">
                          <span className="font-semibold text-pine">{verse.ayah}. </span>
                          {verse.footnotes}
                        </p>
                      ))}
                  </div>
                </details>
              )}
              {arabic && !meaning && meaningRemote.loading && (
                <p className="mt-6 text-sm text-muted" role="status">
                  {t.loadingMeaning}
                </p>
              )}
              <div className="mt-8 space-y-3">
                {meaning && <SourceAttribution verse={verses[0]} />}
                <PronunciationStatus pronunciation={pronunciation} />
                {pronunciation === 'en' && verses.some(verse => verse.transliteration) && <p className="text-sm text-muted">{t.pronunciationSource}</p>}
                {pronunciation === 'en' && verses.length > 0 && !verses.some(verse => verse.transliteration) && (
                  <p className="text-sm text-muted">{t.pronunciationMissing}</p>
                )}
                <VerseActions
                  saved={savedKey ? isVerseSaved(savedKey) : false}
                  onListen={() => current && playRef.current(current.ayah)}
                  onMeaning={bookMeaning.action ?? undefined}
                  onBookmark={() => savedKey && toggleVerse(savedKey)}
                />
                {current && (
                  <VerseShare
                    lang={lang}
                    mode="book"
                    verse={{
                      surah: current.surah,
                      ayah: current.ayah,
                      arabic: current.arabic,
                      translation: current.translation,
                      footnotes: current.footnotes,
                      surahName: current.surahName,
                      translationTitle: current.translationTitle,
                      translationKey: current.translationKey,
                      translationVersion: current.translationVersion,
                      translationDescription: current.translationDescription,
                    }}
                  />
                )}
                <Mukhtasar surah={surah} ayah={ayah >= 1 ? ayah : 1} lang={lang} />
                {editionNotice && (
                  <p className="text-sm text-muted" role="status">
                    {editionNotice}
                  </p>
                )}
                {!editionNotice && bookMeaning.note && (
                  <p className="text-sm text-muted" role="status">
                    {bookMeaning.note}
                  </p>
                )}
                {meaningNote && (
                  <p className="text-sm text-muted" role="status">
                    {meaningNote}
                  </p>
                )}
                <p className="text-sm text-muted">{t.reflowNote}</p>
              </div>
            </BookPage>
          </div>
        )}
        <p className="mt-4 text-center text-sm text-muted">{displaySurah(surah)} / 114</p>
      </div>
      {mode === 'book' && <div className="hidden lg:block">{surahList}</div>}
    </div>
  );
}

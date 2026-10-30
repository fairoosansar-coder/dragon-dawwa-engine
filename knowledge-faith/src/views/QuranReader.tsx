import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { ViewProps } from '../App.tsx';
import { Mukhtasar } from '../components/Mukhtasar.tsx';
import { VerseShare } from '../components/VerseShare.tsx';
import { pauseAudio, playAudio, resumeAudio, stopAudio, useAudioState } from '../lib/audio.ts';
import { useRemote } from '../lib/api.ts';
import { useQuranEdition } from '../lib/quranEdition.ts';
import { ayahForLoadedSurah, clampSurah, displaySurah, readTextSize, readTranslationSize, readingPlaceLabel, useReadingPlace, type TextSize } from '../lib/readingPlace.ts';
import { quranListQuery } from '../lib/route.ts';
import { scrollMain, scrollMarkIntoMain } from '../lib/scroll.ts';
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
import { AyahStudyPanel } from '../components/quran/AyahStudyPanel.tsx';
import { QuranMcpSearch } from '../components/quran/QuranMcpSearch.tsx';
import { ReadingBar } from '../components/quran/ReadingBar.tsx';
import { pagePlace, ReadingSheet } from '../components/quran/ReadingSheet.tsx';
import { audioStatusLabel, EmptyState, HeaderSettingsMenu, PronunciationStatus, quranSectionId, SearchField, type QuranSectionId } from '../components/shell/widgets.tsx';
import { Button, Card, ErrorNote, Loading } from '../components/ui.tsx';

interface ArabicPayload {
  info: SurahInfo;
  verses: Array<{
    key: string;
    surah: number;
    ayah: number;
    number: number;
    arabic: string;
    surahName: string;
    page?: number;
    juz?: number;
    hizbQuarter?: number;
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
  const [storedTranslation, setStoredTranslation] = useStored<unknown>('kf-translation-size', null);
  const translationSize = readTranslationSize(storedTranslation, textSize);
  const setTranslationSize = (size: TextSize) => setStoredTranslation(size);
  const [reciter, setReciter] = useReciter();
  const editionsError = quranEdition.error ?? (!quranEdition.loading && quranEdition.editions.length === 0 ? t.quranEncMissing : null);
  const { setFocus } = useShell();
  const section: QuranSectionId = quranSectionId(sub);
  const mode: 'library' | ReadMode = section === 'read' ? 'book' : section === 'study' ? 'study' : 'library';

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

  const open = (number: number, verse = 1, next: ReadMode = 'book') => {
    stopAudio();
    setSurah(number);
    setAyah(Math.max(verse, 1));
    window.location.hash = next === 'study' ? '#/quran/study' : '#/quran/book';
  };

  if (mode === 'library') {
    return (
      <Library
        surah={surah}
        section={section === 'search' || section === 'mine' ? section : 'home'}
        textSize={textSize}
        onTextSize={setTextSize}
        translationSize={translationSize}
        onTranslationSize={setTranslationSize}
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
      translationSize={translationSize}
      onTranslationSize={setTranslationSize}
      reciter={reciter}
      onReciter={id => {
        stopAudio();
        setReciter(id);
      }}
      editions={quranEdition.editions}
      editionKey={viewEdition}
      onEdition={quranEdition.choose}
      onChooseEdition={(language, key) => {
        quranEdition.accept(language, key);
        setLang(language);
      }}
      editionsError={editionsError}
      onEditionsRetry={quranEdition.error ? quranEdition.reload : undefined}
    />
  );
}

function Library({
  surah,
  ayah,
  section,
  textSize,
  onTextSize,
  translationSize,
  onTranslationSize,
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
  section: 'home' | 'search' | 'mine';
  textSize: TextSize;
  onTextSize: (size: TextSize) => void;
  translationSize: TextSize;
  onTranslationSize: (size: TextSize) => void;
  reciter: string;
  onReciter: (id: string) => void;
  onOpen: (number: number, verse?: number, mode?: ReadMode) => void;
  editions: ReturnType<typeof useQuranEdition>['editions'];
  editionKey: string;
  onEdition: (key: string) => void;
  editionsError: string | null;
}) {
  const { t, config, saved, lang } = useApp();
  const { query, setFocus } = useShell();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listTab, setListTab] = useState<'surahs' | 'bookmarks'>(section === 'mine' ? 'bookmarks' : 'surahs');
  const [prefer, setPrefer] = useState<ReadMode>('book');
  const surahs = useRemote<SurahInfo[]>('/api/quran/surahs');
  const current = surahs.data?.find(item => item.number === surah);
  const raw = quranListQuery(query, typeof window === 'undefined' ? '' : window.location.search);
  const q = raw.toLowerCase();
  const filtered = useMemo(
    () =>
      (surahs.data ?? []).filter(
        item =>
          !q ||
          String(item.number) === q ||
          item.englishName.toLowerCase().includes(q) ||
          item.englishNameTranslation.toLowerCase().includes(q) ||
          item.name.includes(raw),
      ),
    [surahs.data, q, raw],
  );
  const bookmarks = saved.verses.filter(key => !q || key.toLowerCase().includes(q));

  const heading = section === 'search' ? t.quranSearch : section === 'mine' ? t.quranMine : t.quranTitle;

  const reciters = config?.reciters ?? [{ id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' }];

  return (
    <div className="space-y-6">
      <HeaderSettingsMenu
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        mode={prefer}
        textSize={textSize}
        onTextSize={onTextSize}
        translationSize={translationSize}
        onTranslationSize={onTranslationSize}
        reciter={reciter}
        onReciter={onReciter}
        reciters={reciters}
        onMode={setPrefer}
        editions={editions}
        editionKey={editionKey}
        onEdition={onEdition}
        editionsError={editionsError}
        onQuiet={() => {
          setSettingsOpen(false);
          setFocus(true);
        }}
      />
      {section === 'home' ? (
        <header data-quran-hero className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-[#0A3D2E]">
          <img
            src="/assets/geometric-edge.jpg"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[100%_72%]"
          />
          <div className="relative max-w-[70%] px-5 py-7 sm:max-w-xl sm:px-8 sm:py-8">
            <p className="text-[10px] font-semibold tracking-[0.28em] text-[#E6C665]">QUR’AN</p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-[#F9E7B9] sm:text-4xl">{t.quranTitle}</h1>
            <p className="mt-2 text-sm text-stone-300">{t.quranSubtitle}</p>
          </div>
        </header>
      ) : (
        <header>
          <h1 className="font-display text-4xl font-bold text-pine">{heading}</h1>
        </header>
      )}
      {section === 'home' && <Card>
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
      </Card>}
      {section === 'search' && <SearchField className="max-w-xl" placeholder={t.quranSearch} />}
      {section === 'search' && <QuranMcpSearch query={raw} lang={lang} onOpen={(number, verse) => onOpen(number, verse, 'book')} />}
      {section === 'home' && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t.quranTitle}>
          <Button variant={listTab === 'surahs' ? 'primary' : 'soft'} aria-pressed={listTab === 'surahs'} onClick={() => setListTab('surahs')}>
            {t.surahs}
          </Button>
          <Button variant={listTab === 'bookmarks' ? 'primary' : 'soft'} aria-pressed={listTab === 'bookmarks'} onClick={() => setListTab('bookmarks')}>
            {t.bookmarks}
          </Button>
          <a href="#/quran/research" className="inline-flex items-center rounded-full border border-pine/20 px-4 py-2 text-sm font-medium text-pine">
            {t.researchQuran}
          </a>
        </div>
      )}
      {section === 'mine' || (section === 'home' && listTab === 'bookmarks') ? (
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
  translationSize,
  onTranslationSize,
  reciter,
  onReciter,
  editions,
  editionKey,
  onEdition,
  onChooseEdition,
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
  translationSize: TextSize;
  onTranslationSize: (size: TextSize) => void;
  reciter: string;
  onReciter: (id: string) => void;
  editions: ReturnType<typeof useQuranEdition>['editions'];
  editionKey: string;
  onEdition: (key: string) => void;
  onChooseEdition: (lang: Lang, key: string) => void;
  editionsError: string | null;
  onEditionsRetry?: () => void;
}) {
  const { t, config, toggleVerse, isVerseSaved } = useApp();
  const lang = contentLang;
  const [pronunciation] = usePronunciation();
  const { setFocus } = useShell();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storedArabic, setStoredArabic] = useStored<unknown>('kf-show-arabic', true);
  const [storedTranslation, setStoredTranslation] = useStored<unknown>('kf-show-translation', true);
  const showArabic = storedArabic !== false;
  const showTranslation = storedTranslation !== false;
  const [verseStored, setVerseStored] = useStored<unknown>('kf-verse-by-verse', false);
  const verseByVerse = verseStored === true;
  const [settingsTick, setSettingsTick] = useState(0);
  const [translationTick, setTranslationTick] = useState(0);
  const audio = useAudioState();
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
  const arabic = arabicRemote.data?.info.number === surah ? arabicRemote.data : null;
  const meaning = acceptsMeaning(meaningRemote.data, surah, lang, editionKey) ? meaningRemote.data : null;
  const loaded = arabic;
  const verses = arabic ? mergeReading(arabic, meaning, lang) : [];
  const versesRef = useRef(verses);
  versesRef.current = verses;
  const touch = useRef({ x: 0, y: 0 });
  const pendingMeaning = useRef<{ key: string; surah: number; ayah: number } | null>(null);
  const [meaningNote, setMeaningNote] = useState<string | null>(null);
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
  const repeatRef = useRef<(n: number) => void>(() => undefined);
  repeatRef.current = (ayahNumber: number) => {
    if (!loaded || loaded.info.number !== surah) return;
    const verse = versesRef.current.find(item => item.ayah === ayahNumber);
    if (!verse) return;
    setAyah(verse.ayah);
    void playAudio(`ayah-${verse.number}`, recitationUrl(reciter, verse.number), () => repeatRef.current(ayahNumber));
  };
  const moveRef = useRef<(delta: number) => void>(() => undefined);
  moveRef.current = (delta: number) => {
    const list = versesRef.current;
    const index = list.findIndex(item => item.ayah === ayah);
    const next = list[index + delta];
    const playing = audio.status === 'playing' || audio.status === 'loading';
    if (next) {
      setAyah(next.ayah);
      if (playing) playRef.current(next.ayah);
      return;
    }
    if (delta < 0 && surah > 1) goSurah(surah - 1, 0);
    if (delta > 0 && surah < 114) goSurah(surah + 1, 1);
  };

  useEffect(() => {
    if (mode !== 'book') return;
    const onKey = (event: KeyboardEvent) => {
      if (settingsOpen) return;
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
  }, [mode, setFocus, settingsOpen, step]);

  useEffect(() => {
    if (ayah < 1 || loaded?.info.number !== surah) return;
    const opening = ayah === 1 ? document.querySelector('[data-bismillah]') : null;
    const mark = opening instanceof HTMLElement ? opening : document.getElementById(`v-${surah}-${ayah}`);
    if (!mark) return;
    scrollMarkIntoMain(mark);
  }, [ayah, mode, surah, lang, loaded]);

  const current = verses.find(item => item.ayah === ayah) ?? verses[0];
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
  const playbackStatus = audio.status === 'error' || audio.status === 'unavailable' ? audioStatusLabel(t, audio.status, audio.id) : null;
  const reciters = config?.reciters ?? [{ id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' }];
  const shareVerse = current
    ? {
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
      }
    : null;

  const bookLayout = mode === 'book';
  const readingTrail = loaded ? (
    <>
      <div className="flex items-center justify-between gap-3 text-sm text-pine">
        <button type="button" className="font-medium disabled:opacity-40" disabled={surah <= 1} onClick={() => goSurah(surah - 1, 1)}>
          {t.sheetPrevious}
        </button>
        <span className="text-muted">
          {displaySurah(surah)} / 114
        </span>
        <button type="button" className="font-medium disabled:opacity-40" disabled={surah >= 114} onClick={() => goSurah(surah + 1, 1)}>
          {t.sheetNext}
        </button>
      </div>
      <div className="mt-4 space-y-3">
        <PronunciationStatus pronunciation={pronunciation} />
        {pronunciation === 'en' && verses.some(verse => verse.transliteration) && <p className="text-sm text-muted">{t.pronunciationSource}</p>}
        {pronunciation === 'en' && verses.length > 0 && !verses.some(verse => verse.transliteration) && (
          <p className="text-sm text-muted">{t.pronunciationMissing}</p>
        )}
        {shareVerse && <VerseShare lang={lang} mode={mode} verse={shareVerse} />}
        <Mukhtasar surah={surah} ayah={ayah >= 1 ? ayah : 1} lang={lang} />
      </div>
    </>
  ) : null;

  return (
    <div data-reader className={bookLayout ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'min-w-0'}>
      {mode !== 'book' && (
        <HeaderSettingsMenu
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          mode={mode}
          textSize={textSize}
          onTextSize={onTextSize}
          translationSize={translationSize}
          onTranslationSize={onTranslationSize}
          reciter={reciter}
          onReciter={onReciter}
          reciters={reciters}
          onMode={next => {
            window.location.hash = next === 'study' ? '#/quran/study' : '#/quran/book';
          }}
          editions={editions}
          editionKey={editionKey}
          onEdition={onEdition}
          editionsError={editionsError}
          onQuiet={() => {
            setSettingsOpen(false);
            setFocus(true);
          }}
        />
      )}
      <div className={bookLayout ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'mx-auto min-w-0 max-w-[46rem] space-y-4'}>
        {playbackStatus && (
          <p className="text-sm text-muted" role="status">
            {playbackStatus}
          </p>
        )}
        {!arabic && arabicRemote.loading && <Loading />}
        {!arabic && !arabicRemote.loading && arabicRemote.error && <ErrorNote message={arabicRemote.error} onRetry={arabicRemote.reload} />}
        {editionsError && <ErrorNote message={editionsError} onRetry={onEditionsRetry} />}
        {meaningRemote.error && <ErrorNote message={meaningRemote.error} onRetry={meaningRemote.reload} />}
        {loaded && arabic && !meaning && meaningRemote.loading && (
          <p className="text-sm text-muted" role="status">
            {t.loadingMeaning}
          </p>
        )}
        {loaded && mode === 'study' && (
          <AyahStudyPanel info={loaded.info} verse={current ?? null} ayah={ayah >= 1 ? ayah : 1} lang={lang} onAyah={next => setAyah(next)} />
        )}
        {loaded && mode === 'book' && (
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col"
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
            <ReadingBar
              surah={loaded.info.number}
              englishName={loaded.info.englishName}
              page={pagePlace(current)?.page ?? null}
              juz={pagePlace(current)?.juz ?? null}
              hizb={pagePlace(current)?.hizb ?? null}
              verseByVerse={verseByVerse}
              onVerseByVerse={value => setVerseStored(value)}
              openSettings={settingsTick}
              textSize={textSize}
              onTextSize={onTextSize}
              translationSize={translationSize}
              onTranslationSize={onTranslationSize}
              reciter={reciter}
              onReciter={onReciter}
              reciters={reciters}
              onPlace={(number, verse) => goSurah(number, verse)}
              translator={current?.translationTitle || current?.translator || ''}
              showTranslation={showTranslation}
              onTranslation={value => setStoredTranslation(value)}
              onOpenTranslations={() => setTranslationTick(value => value + 1)}
            />
            <ReadingSheet
              info={loaded.info}
              verses={verses}
              showArabic={showArabic}
              onArabic={value => setStoredArabic(value)}
              showTranslation={showTranslation}
              onTranslation={value => setStoredTranslation(value)}
              verseByVerse={verseByVerse}
              textSize={textSize}
              translationSize={translationSize}
              lang={lang}
              selectedAyah={ayah}
              onPlayAyah={next => playRef.current(next)}
              onRepeatAyah={next => repeatRef.current(next)}
              onListen={() => {
                if (audio.id?.startsWith('ayah-') && (audio.status === 'playing' || audio.status === 'loading')) pauseAudio();
                else if (audio.id?.startsWith('ayah-') && audio.status === 'paused') resumeAudio();
                else playRef.current(ayah >= 1 ? ayah : 1);
              }}
              onPrevious={() => moveRef.current(-1)}
              onNext={() => moveRef.current(1)}
              onOpenSettings={() => setSettingsTick(value => value + 1)}
              onChooseEdition={onChooseEdition}
              openTranslations={translationTick}
              reciters={reciters}
            >
              {readingTrail}
            </ReadingSheet>
          </div>
        )}
        {loaded && mode !== 'book' && readingTrail}
      </div>
    </div>
  );
}

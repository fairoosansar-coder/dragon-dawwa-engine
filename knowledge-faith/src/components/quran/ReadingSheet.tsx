import { useEffect, useState, type ReactNode } from 'react';
import { Bookmark, Info, MoreHorizontal, Pause, Play, Repeat, SkipBack, SkipForward } from 'lucide-react';
import { useRemote } from '../../lib/api.ts';
import { pauseAudio, useAudioState } from '../../lib/audio.ts';
import { useApp } from '../../lib/store.tsx';
import type { TextSize } from '../../lib/readingPlace.ts';
import { chapterSentence, hizbFromQuarter } from '../../shared/readingNav.ts';
import { revelationPlace, surahArabicTitle, type McpMorphology } from '../../shared/quranMcp.ts';
import { LANGUAGE_NAMES, type Lang } from '../../shared/sources.ts';
import type { QuranEncEdition } from '../../shared/quranenc.ts';
import type { SurahInfo, Verse } from '../../shared/types.ts';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const ARABIC_SIZE: Record<TextSize, string> = {
  sm: 'text-[1.65rem]',
  md: 'text-[1.9rem] sm:text-[2.15rem]',
  lg: 'text-[2.2rem] sm:text-[2.5rem]',
};
const PROSE_SIZE: Record<TextSize, string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-[1.45rem]',
};

interface MeaningPayload {
  verses: { ayah: number; translation: string }[];
}

interface WordChoice {
  ayah: number;
  index: number;
  token: string;
  key: string;
}

function bare(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\u0621-\u064A]/g, '');
}

function tokens(arabic: string): string[] {
  return arabic.split(/\s+/).filter(token => token && !/^[\u0660-\u0669\u06F0-\u06F90-9]+$/.test(token));
}

function glossFor(token: string, occurrence: number, words: McpMorphology['words'] | undefined): string {
  if (!words?.length) return '';
  const key = bare(token);
  if (!key) return '';
  const matches = words.filter(word => bare(word.text) === key);
  const text = (matches[occurrence] ?? matches[0])?.translation?.trim() ?? '';
  if (!text || /^none$/i.test(text)) return '';
  return text;
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function ReadingSheet({
  info,
  verses,
  showArabic,
  onArabic,
  showTranslation,
  onTranslation,
  verseByVerse,
  textSize,
  translationSize,
  lang,
  selectedAyah,
  onPlayAyah,
  onRepeatAyah,
  onListen,
  onPrevious,
  onNext,
  onOpenSettings,
  onChooseEdition,
  openTranslations = 0,
  reciters,
  children,
}: {
  info: SurahInfo;
  verses: Verse[];
  showArabic: boolean;
  onArabic: (show: boolean) => void;
  showTranslation: boolean;
  onTranslation: (show: boolean) => void;
  verseByVerse: boolean;
  textSize: TextSize;
  translationSize: TextSize;
  lang: Lang;
  selectedAyah: number;
  onPlayAyah: (ayah: number) => void;
  onRepeatAyah: (ayah: number) => void;
  onListen: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenSettings: () => void;
  onChooseEdition: (lang: Lang, key: string) => void;
  openTranslations?: number;
  reciters: { id: string; name: string; style?: string }[];
  children?: ReactNode;
}) {
  const { t, notes, setVerseNote, toggleVerse, isVerseSaved } = useApp();
  const audio = useAudioState();
  const [infoOpen, setInfoOpen] = useState(false);
  const [choice, setChoice] = useState<WordChoice | null>(null);
  const [draft, setDraft] = useState('');
  const [moreAyah, setMoreAyah] = useState<number | null>(null);
  const [wordsFor, setWordsFor] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const placeName = revelationPlace(info.revelationType);
  const selected = verses.find(verse => verse.ayah === selectedAyah) ?? verses[0];
  const headerJuz = selected && typeof selected.juz === 'number' ? selected.juz : (verses.find(verse => typeof verse.juz === 'number')?.juz ?? null);
  const page = selected && typeof selected.page === 'number' ? selected.page : null;
  const pageVerses = page == null ? verses : verses.filter(verse => verse.page === page);
  const listening = Boolean(audio.id?.startsWith('ayah-')) && (audio.status === 'playing' || audio.status === 'loading');
  // Al-Fatiha’s first ayah is the basmala. At-Tawbah is not opened with one.
  const showBismillah = showArabic && info.number !== 1 && info.number !== 9 && pageVerses.some(verse => verse.ayah === 1);
  const bismillahPlate = info.number % 2 === 0 ? 'blue' : 'cream';
  const editionKey = selected?.translationKey ?? '';
  const bismillah = useRemote<MeaningPayload>(showBismillah && editionKey ? `/api/quran/surah/1/meaning?lang=${lang}&edition=${encodeURIComponent(editionKey)}` : null);
  const bismillahLine = bismillah.data?.verses?.find(verse => verse.ayah === 1)?.translation?.trim() ?? '';
  const words = useRemote<McpMorphology>(choice ? `/api/quran/mcp/morphology?ayah=${info.number}:${choice.ayah}` : null);
  const listedWords = useRemote<McpMorphology>(wordsFor ? `/api/quran/mcp/morphology?ayah=${info.number}:${wordsFor}` : null);
  const gloss = choice ? glossFor(choice.token, choice.index, words.data?.ayah === `${info.number}:${choice.ayah}` ? words.data.words : undefined) : '';
  const translator = selected?.translationTitle || selected?.translator || '';
  const sentence = chapterSentence({
    englishName: info.englishName,
    number: info.number,
    verses: info.numberOfAyahs,
    place: placeName,
    juz: headerJuz,
  });
  const footnotes = pageVerses.filter(verse => verse.footnotes?.trim());
  const playingAyah = pageVerses.find(verse => audio.id === `ayah-${verse.number}`);

  useEffect(() => {
    setDraft(choice ? (notes[choice.key] ?? '') : '');
  }, [choice, notes]);

  useEffect(() => {
    setChoice(null);
    setMoreAyah(null);
  }, [verseByVerse]);

  useEffect(() => {
    if (openTranslations > 0) setPicker(true);
  }, [openTranslations]);

  useEffect(() => {
    if (!choice && moreAyah == null && !picker) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setChoice(null);
      setMoreAyah(null);
      setPicker(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [choice, moreAyah, picker]);

  const openWord = (verse: Verse, token: string, index: number) => {
    const same = tokens(verse.arabic).slice(0, index).filter(item => bare(item) === bare(token)).length;
    setMoreAyah(null);
    setChoice({ ayah: verse.ayah, index: same, token, key: verse.key });
  };

  const copyVerse = async (verse: Verse) => {
    const text = [verse.arabic, verse.translation.trim(), verse.footnotes?.trim() ?? ''].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(t.menuCopied);
    } catch {
      setCopied(t.menuCopyFailed);
    }
  };

  const arabicLine = (verse: Verse) => (
    <span lang="ar" dir="rtl" data-ayah-arabic={verse.ayah} className={verse.ayah === selectedAyah ? 'quran-band' : undefined}>
      {tokens(verse.arabic).map((token, index) => (
        <button
          key={`${verse.key}-${index}`}
          type="button"
          data-arabic-word
          data-ayah={verse.ayah}
          className="mx-[0.12em] rounded px-[0.04em] hover:bg-white/70"
          onClick={() => openWord(verse, token, index)}
        >
          {token}
        </button>
      ))}
      <span className="quran-ayah-mark" aria-hidden>
        {verse.ayah}
      </span>
    </span>
  );

  const verseMenu = (verse: Verse) =>
    moreAyah === verse.ayah ? (
      <div data-verse-menu role="menu" className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-[#d5deea] bg-white p-1 text-sm shadow-lg">
        <MenuButton onClick={() => { setWordsFor(verse.ayah); setMoreAyah(null); }}>{t.menuWordByWord}</MenuButton>
        <MenuButton onClick={() => { onRepeatAyah(verse.ayah); setMoreAyah(null); }}>{t.wordRepeat}</MenuButton>
        <MenuButton onClick={() => { setPicker(true); setMoreAyah(null); }}>{t.menuTranslations}</MenuButton>
        <MenuButton onClick={() => { onOpenSettings(); setMoreAyah(null); }}>{t.settings}</MenuButton>
        <MenuButton onClick={() => { void copyVerse(verse); setMoreAyah(null); }}>{t.menuCopy}</MenuButton>
      </div>
    ) : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <article data-reading-sheet data-reader-scroll className="quran-page min-h-0 w-full flex-1 overflow-y-auto px-3 py-4 sm:px-6">
      <header id="kf-surah-title" data-surah-header className="quran-header-card scroll-mt-4 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
        <div className="flex items-center gap-4">
          <p lang="ar" dir="rtl" data-surah-arabic className="quran-face text-4xl text-[#1a2744] sm:text-5xl">
            {surahArabicTitle(info.name)}
          </p>
          <div>
            <h2 className="font-[family-name:Fraunces,Georgia,serif] text-2xl font-semibold text-[#1a2744] sm:text-3xl">
              {info.number}. Surah {info.englishName}
            </h2>
            <p className="text-lg text-[#314865]">{info.englishNameTranslation}</p>
          </div>
        </div>
        <p data-surah-sentence className="mt-3 max-w-3xl text-sm leading-relaxed text-[#314865]">
          {sentence}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button id="kf-listen" type="button" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#1a2744] shadow-sm" onClick={onListen} disabled={pageVerses.length === 0}>
            {listening ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            {listening ? t.sheetPause : t.sheetListen}
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#1a2744] shadow-sm" aria-expanded={infoOpen} onClick={() => setInfoOpen(open => !open)}>
            <Info className="h-3.5 w-3.5" aria-hidden />
            {t.sheetInfo}
          </button>
        </div>
        {infoOpen && (
          <div data-surah-info className="mt-3 max-w-3xl space-y-1 text-sm leading-relaxed text-[#314865]">
            {translator ? <p>{translator}</p> : null}
            {reciters.length > 0 && (
              <p>
                {t.sheetReciters}: {reciters.map(item => item.name).join(', ')}
              </p>
            )}
          </div>
        )}
        <div className="mt-4">
          <button type="button" data-arabic-pill aria-pressed={showArabic} onClick={() => onArabic(!showArabic)} className={pill(showArabic)}>
            {t.sheetArabic}
          </button>
        </div>
        {showBismillah && (
          <div data-bismillah-block data-bismillah-plate={bismillahPlate} className="quran-bismillah-block scroll-mt-28">
            <img
              data-bismillah
              src={`/assets/bismillah-${bismillahPlate}.jpg`}
              alt={BISMILLAH}
              lang="ar"
              width={1600}
              height={488}
              decoding="async"
              draggable={false}
              className="quran-bismillah-plate"
            />
            {bismillahLine ? (
              <p data-bismillah-meaning lang={lang} className="quran-bismillah-meaning">
                {bismillahLine}
              </p>
            ) : null}
          </div>
        )}
      </header>

      {showArabic && verseByVerse && (
        <div data-verse-mode className="mt-6 space-y-6">
          {pageVerses.map(verse => (
            <section key={verse.key} id={`v-${verse.surah}-${verse.ayah}`} data-ayah={verse.ayah} className={`rounded-2xl px-3 py-4 ${verse.ayah === selectedAyah ? 'quran-band' : ''}`}>
              <p dir="rtl" className={`quran-face text-center text-[#1e3a5f] ${ARABIC_SIZE[textSize]}`}>
                {arabicLine(verse)}
              </p>
              {showTranslation && (
                <p lang={lang} className={`quran-prose mx-auto mt-4 ${PROSE_SIZE[translationSize]}`}>
                  {verse.translation.trim() ? verse.translation : t.verseTranslationUnavailable}
                  <span className="quran-ayah-mark align-middle">{verse.ayah}</span>
                </p>
              )}
              <div className="mt-2 flex items-center justify-end gap-1">
                <button type="button" aria-label={`${t.sheetPlayVerse} ${verse.ayah}`} className="rounded-full p-2 text-[#1c3d66]" onClick={() => (audio.id === `ayah-${verse.number}` && listening ? pauseAudio() : onPlayAyah(verse.ayah))}>
                  {audio.id === `ayah-${verse.number}` && listening ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button type="button" aria-pressed={isVerseSaved(verse.key)} aria-label={t.wordSave} className="rounded-full p-2 text-[#1c3d66]" onClick={() => toggleVerse(verse.key)}>
                  <Bookmark className="h-4 w-4" />
                </button>
                <div className="relative">
                  <button type="button" data-verse-more aria-label={t.settings} className="rounded-full p-2 text-[#1c3d66]" onClick={() => setMoreAyah(current => (current === verse.ayah ? null : verse.ayah))}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {verseMenu(verse)}
                </div>
              </div>
              {wordsFor === verse.ayah && (
                <WordList
                  remote={{
                    data: listedWords.data?.ayah === `${info.number}:${wordsFor}` ? listedWords.data : null,
                    error: listedWords.error,
                    loading: listedWords.loading,
                  }}
                />
              )}
            </section>
          ))}
        </div>
      )}

      {showArabic && !verseByVerse && (
        <div data-mushaf className={`quran-face mt-6 scroll-mt-28 px-3 pt-6 text-center leading-[2.7] text-[#1e3a5f] ${ARABIC_SIZE[textSize]}`}>
          <p dir="rtl">
            {pageVerses.map(verse => (
              <span key={verse.key} id={`v-${verse.surah}-${verse.ayah}`} data-ayah={verse.ayah}>
                {arabicLine(verse)}{' '}
              </span>
            ))}
          </p>
          {page != null && (
            <p data-page-number className="mt-4 text-center font-sans text-sm text-[#5c6b7a]">
              {page}
            </p>
          )}
        </div>
      )}

      {showTranslation && !verseByVerse && (
        <div data-translation className={`quran-prose mx-auto mt-8 ${PROSE_SIZE[translationSize]}`} lang={lang}>
          {pageVerses.map(verse => (
            <span key={verse.key} id={showArabic ? undefined : `v-${verse.surah}-${verse.ayah}`} className={verse.ayah === selectedAyah ? 'quran-band' : undefined}>
              {verse.translation.trim() ? verse.translation : t.verseTranslationUnavailable}{' '}
              <span className="quran-ayah-mark align-middle">{verse.ayah}</span>{' '}
            </span>
          ))}
        </div>
      )}

      {showTranslation && footnotes.length > 0 && (
        <div className="mt-8 w-full border-t border-[#d5deea] pt-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-[#6d7885]">{t.footnotes}</h3>
          <ul className="mt-3 space-y-3">
            {footnotes.map(verse => (
              <li key={verse.key} lang={lang} className="whitespace-pre-wrap text-sm leading-relaxed text-[#3d4c5c]">
                <span className="font-medium text-[#1c3d66]">{verse.ayah}. </span>
                {verse.footnotes}
              </li>
            ))}
          </ul>
        </div>
      )}
      {copied && <p className="mt-3 text-sm text-[#1c3d66]">{copied}</p>}
      {children ? <div className="mt-8">{children}</div> : null}

      {choice && (
        <div data-word-menu role="menu" className="fixed left-1/2 top-1/3 z-40 w-56 -translate-x-1/2 rounded-xl border border-[#d5deea] bg-white p-2 text-sm text-[#1a2744] shadow-xl">
          <p lang="ar" dir="rtl" className="quran-face px-2 text-2xl">
            {choice.token}
          </p>
          {gloss ? <p data-word-gloss className="px-2 pb-2 text-sm text-[#1c3d66]">{gloss}</p> : null}
          {words.error ? <p className="px-2 pb-2 text-xs text-muted">{t.wordsFailed}</p> : null}
          <MenuButton onClick={() => { onPlayAyah(choice.ayah); setChoice(null); }}>
            <Play className="h-4 w-4" aria-hidden /> {t.wordPlay}
          </MenuButton>
          <MenuButton pressed={isVerseSaved(choice.key)} onClick={() => toggleVerse(choice.key)}>
            <Bookmark className="h-4 w-4" aria-hidden /> {t.wordSave}
          </MenuButton>
          <div className="px-2 py-1">
            <p className="text-xs font-medium text-muted">{t.wordNote}</p>
            <textarea value={draft} onChange={event => setDraft(event.target.value)} rows={3} placeholder={t.wordNotePlaceholder} className="mt-1 w-full rounded-lg border border-[#d5deea] px-2 py-1 text-sm" />
            <button type="button" className="mt-1 text-xs font-medium text-[#1c3d66]" onClick={() => setVerseNote(choice.key, draft)}>
              {t.wordNoteSave}
            </button>
          </div>
          <MenuButton onClick={() => { onRepeatAyah(choice.ayah); setChoice(null); }}>
            <Repeat className="h-4 w-4" aria-hidden /> {t.wordRepeat}
          </MenuButton>
        </div>
      )}

      {picker && <TranslationPicker current={editionKey} onClose={() => setPicker(false)} onChoose={onChooseEdition} />}

    </article>
      <div data-reading-player className="shrink-0 rounded-b-2xl border-t border-[#d5deea] bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex w-full items-center gap-3">
          <button type="button" aria-label={t.playerPrevious} className="rounded-full p-2 text-[#1c3d66]" onClick={onPrevious}>
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            type="button"
            data-player-play
            aria-label={listening ? t.sheetPause : t.sheetListen}
            className="rounded-full bg-[#10233f] p-3 text-white"
            onClick={onListen}
          >
            {listening ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button type="button" aria-label={t.playerNext} className="rounded-full p-2 text-[#1c3d66]" onClick={onNext}>
            <SkipForward className="h-5 w-5" />
          </button>
          <p className="min-w-0 flex-1 text-sm text-[#1c3d66]">
            {playingAyah ? `${playingAyah.surah}:${playingAyah.ayah}` : selected ? `${selected.surah}:${selected.ayah}` : ''}
          </p>
          <p data-player-time className="font-mono text-sm text-[#5c6b7a]">
            {clock(audio.currentTime)} / {clock(audio.duration)}
          </p>
        </div>
      </div>
    </div>
  );
}

function WordList({ remote }: { remote: { data: McpMorphology | null; error: string | null; loading: boolean } }) {
  const { t } = useApp();
  if (remote.loading && !remote.data) return null;
  if (remote.error) return <p className="mt-3 text-sm text-muted">{t.wordsFailed}</p>;
  if (!remote.data || remote.data.words.length === 0) return <p className="mt-3 text-sm text-muted">{t.wordsEmpty}</p>;
  return (
    <ol data-verse-words className="mt-4 space-y-2 text-left">
      {remote.data.words.map(word => {
        const gloss = word.translation?.trim() && !/^none$/i.test(word.translation.trim()) ? word.translation.trim() : '';
        return (
          <li key={word.position} className="flex items-baseline justify-between gap-3 border-b border-[#d5deea] py-1">
            <span lang="ar" dir="rtl" className="quran-face text-xl text-[#1a2744]">{word.text}</span>
            {gloss ? <span className="text-sm text-[#1c3d66]">{gloss}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function TranslationPicker({ current, onClose, onChoose }: { current: string; onClose: () => void; onChoose: (lang: Lang, key: string) => void }) {
  const { t } = useApp();
  const [query, setQuery] = useState('');
  const english = useRemote<QuranEncEdition[]>('/api/quran/editions?lang=en');
  const tamil = useRemote<QuranEncEdition[]>('/api/quran/editions?lang=ta');
  const sinhala = useRemote<QuranEncEdition[]>('/api/quran/editions?lang=si');
  const groups = [
    { lang: 'en' as const, remote: english },
    { lang: 'ta' as const, remote: tamil },
    { lang: 'si' as const, remote: sinhala },
  ];
  const needle = query.trim().toLowerCase();
  return (
    <div data-translation-picker className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-16" onClick={onClose}>
      <div className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl" onClick={event => event.stopPropagation()}>
        <label className="block text-xs font-medium text-muted">
          {t.menuTranslations}
          <input value={query} onChange={event => setQuery(event.target.value)} className="mt-1 w-full rounded-lg border border-[#d5deea] px-3 py-2 text-sm text-ink" />
        </label>
        {groups.map(group => {
          const rows = (group.remote.data ?? []).filter(item => item.languageIso === group.lang && (!needle || item.title.toLowerCase().includes(needle)));
          return (
            <section key={group.lang} className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5c6b7a]">{LANGUAGE_NAMES[group.lang].english}</h3>
              {group.remote.error ? <p className="mt-2 text-sm text-muted">{group.remote.error}</p> : null}
              <ul className="mt-2">
                {rows.map(item => (
                  <li key={item.key}>
                    <button
                      type="button"
                      data-edition={item.key}
                      className={`block w-full rounded-lg px-2 py-2 text-left text-sm ${item.key === current ? 'bg-[#e7eef6] font-medium text-[#1c3d66]' : 'text-ink'}`}
                      onClick={() => {
                        onChoose(group.lang, item.key);
                        onClose();
                      }}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function pill(on: boolean): string {
  return `rounded-full px-4 py-3 text-sm font-medium ${on ? 'bg-[#10233f] text-white' : 'bg-white text-[#1a2744]'}`;
}

function MenuButton({ children, onClick, pressed }: { children: ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <button type="button" role="menuitem" aria-pressed={pressed} onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#eef3f8]">
      {children}
    </button>
  );
}

export function pagePlace(verse: Verse | undefined): { page: number; juz: number; hizb: number } | null {
  if (!verse || typeof verse.page !== 'number' || typeof verse.juz !== 'number') return null;
  const hizb = hizbFromQuarter(verse.hizbQuarter);
  if (hizb == null) return null;
  return { page: verse.page, juz: verse.juz, hizb };
}

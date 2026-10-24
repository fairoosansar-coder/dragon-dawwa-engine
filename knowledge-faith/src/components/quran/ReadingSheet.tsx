import { Bookmark, BookmarkCheck, ChevronDown, Pause, Play } from 'lucide-react';
import { pauseAudio, useAudioState } from '../../lib/audio.ts';
import { useApp } from '../../lib/store.tsx';
import type { TextSize } from '../../lib/readingPlace.ts';
import { revelationPlace, surahArabicTitle } from '../../shared/quranMcp.ts';
import type { Lang } from '../../shared/sources.ts';
import type { SurahInfo, Verse } from '../../shared/types.ts';
import type { QuranEncEdition } from '../../shared/quranenc.ts';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

const ARABIC_SIZE: Record<TextSize, string> = {
  sm: 'text-[1.65rem] sm:text-3xl',
  md: 'text-3xl sm:text-[2.4rem]',
  lg: 'text-4xl sm:text-5xl',
};
const PROSE_SIZE: Record<TextSize, string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-[1.65rem]',
};

export function ReadingSheet({
  info,
  verses,
  showArabic,
  onArabic,
  editions,
  editionKey,
  onEdition,
  textSize,
  translationSize,
  lang,
  selectedAyah,
  onPlayAyah,
  onListen,
  onBookmark,
  saved,
}: {
  info: SurahInfo;
  verses: Verse[];
  showArabic: boolean;
  onArabic: (show: boolean) => void;
  editions: QuranEncEdition[];
  editionKey: string;
  onEdition: (key: string) => void;
  textSize: TextSize;
  translationSize: TextSize;
  lang: Lang;
  selectedAyah: number;
  onPlayAyah: (ayah: number) => void;
  onListen: () => void;
  onBookmark: (key: string) => void;
  saved: (key: string) => boolean;
}) {
  const { t } = useApp();
  const audio = useAudioState();
  const placeName = revelationPlace(info.revelationType);
  const headerJuz = verses.find(verse => typeof verse.juz === 'number')?.juz;
  const current = verses.find(verse => verse.ayah === selectedAyah) ?? verses[0];
  const place =
    current && typeof current.page === 'number' && typeof current.juz === 'number' && typeof current.hizbQuarter === 'number'
      ? { page: current.page, juz: current.juz, hizb: Math.ceil(current.hizbQuarter / 4) }
      : null;
  const listening = Boolean(audio.id?.startsWith('ayah-')) && (audio.status === 'playing' || audio.status === 'loading');
  const edition = editions.find(item => item.key === editionKey);
  const translator = edition?.title || current?.translationTitle || current?.translator || '';
  const notes = verses.filter(verse => verse.footnotes?.trim());

  const mark = (verse: Verse) => {
    const active = audio.id === `ayah-${verse.number}` && (audio.status === 'playing' || audio.status === 'loading');
    const bookmarked = saved(verse.key);
    return (
      <span dir="ltr" className="mx-1 inline-flex items-center gap-1 align-middle">
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#1c3d66]/80 hover:bg-[#eef3f8]"
          aria-label={`${t.sheetPlayVerse} ${verse.ayah}`}
          onClick={() => (active ? pauseAudio() : onPlayAyah(verse.ayah))}
        >
          {active ? <Pause className="h-3 w-3" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
        </button>
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[#1c3d66]/25 px-1 text-[11px] font-medium text-[#1c3d66]">
          {verse.ayah}
        </span>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#1c3d66]/70 hover:bg-[#eef3f8]"
          aria-label={bookmarked ? t.sheetRemove : t.sheetSave}
          aria-pressed={bookmarked}
          onClick={() => onBookmark(verse.key)}
        >
          {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" aria-hidden /> : <Bookmark className="h-3.5 w-3.5" aria-hidden />}
        </button>
      </span>
    );
  };

  return (
    <article data-reading-sheet className="quran-sheet mx-auto w-full max-w-[42rem] px-4 py-8 shadow-[0_10px_28px_rgba(23,39,32,0.05)] sm:px-10 sm:py-12">
      <header id="kf-surah-title" data-surah-header className="scroll-mt-4">
        <div className="flex flex-col-reverse gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <h2 className="font-[family-name:Fraunces,Georgia,serif] text-3xl font-medium text-[#1c3d66] sm:pb-1 sm:text-4xl">{info.englishName}</h2>
          <p lang="ar" dir="rtl" data-surah-arabic className={`quran-face text-[#1a1a1a] ${ARABIC_SIZE.lg}`}>
            {surahArabicTitle(info.name)}
          </p>
        </div>
        <p className="mt-3 text-sm text-[#6d7885]">
          {info.numberOfAyahs} {info.numberOfAyahs === 1 ? t.sheetVerse : t.sheetVerses}
          {placeName ? ` · ${placeName === 'Mecca' ? t.sheetMecca : t.sheetMedina}` : ''}
          {typeof headerJuz === 'number' ? ` · ${t.sheetJuz} ${headerJuz}` : ''}
        </p>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-[#e6e8eb] py-2 text-sm text-[#1c3d66]">
        <button id="kf-listen" type="button" className="inline-flex items-center gap-1.5 font-medium" onClick={onListen} disabled={verses.length === 0}>
          {listening ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {listening ? t.sheetPause : t.sheetListen}
        </button>
        <button
          id="kf-arabic-toggle"
          type="button"
          className={`font-medium underline-offset-4 ${showArabic ? 'underline' : 'text-[#1c3d66]/45'}`}
          aria-pressed={showArabic}
          onClick={() => onArabic(!showArabic)}
        >
          {t.sheetArabic}
        </button>
        <label className="relative block w-full min-w-0 sm:w-auto sm:max-w-[28rem]">
          <span className="sr-only">{t.sheetTranslation}</span>
          <span className="pointer-events-none flex items-start gap-1 text-sm font-medium leading-snug text-[#1c3d66]">
            <span>{translator || t.sheetTranslation}</span>
            <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          </span>
          <select
            id="kf-reading-translation"
            value={editions.some(item => item.key === editionKey) ? editionKey : ''}
            onChange={event => onEdition(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {editions.map(item => (
              <option key={item.key} value={item.key}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        {place && (
          <p className="w-full text-xs text-[#7b8794] sm:ml-auto sm:w-auto">
            {t.sheetPage} {place.page}
            <span className="mx-1.5" aria-hidden>
              ·
            </span>
            {t.sheetJuz} {place.juz}
            <span className="mx-1.5" aria-hidden>
              ·
            </span>
            {t.sheetHizb} {place.hizb}
          </p>
        )}
      </div>

      {showArabic && info.number !== 1 && info.number !== 9 && (
        <p data-bismillah lang="ar" dir="rtl" className="quran-bismillah mt-8">
          {BISMILLAH}
        </p>
      )}

      {showArabic && (
        <div className={`mt-8 space-y-6 ${ARABIC_SIZE[textSize]}`}>
          {verses.map(verse => {
            return (
              <p key={verse.key} lang="ar" dir="rtl" data-ayah={verse.ayah} className="quran-face text-[#1a1a1a]">
                {verse.arabic} {mark(verse)}
                {verse.transliteration ? (
                  <span lang="en" dir="ltr" className="mt-2 block text-left font-sans text-sm font-normal leading-relaxed text-[#5c6b7a]">
                    {verse.transliteration}
                  </span>
                ) : null}
              </p>
            );
          })}
        </div>
      )}

      <div data-translation className={`quran-prose mt-10 ${PROSE_SIZE[translationSize]}`} lang={lang} dir="ltr">
        {verses.map(verse => (
          <span key={verse.key} id={`v-${verse.surah}-${verse.ayah}`} data-ayah={verse.ayah}>
            {verse.translation.trim() ? verse.translation : t.verseTranslationUnavailable} {mark(verse)}{' '}
          </span>
        ))}
      </div>
      {translator ? <p className="sr-only">{translator}</p> : null}

      {notes.length > 0 && (
        <div className="mt-10 max-w-[38rem] border-t border-[#e6e8eb] pt-4">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-[#6d7885]">{t.footnotes}</h3>
          <ul className="mt-3 space-y-3">
            {notes.map(verse => (
              <li key={verse.key} lang={lang} className="whitespace-pre-wrap text-sm leading-relaxed text-[#3d4c5c]">
                <span className="font-medium text-[#1c3d66]">{verse.ayah}. </span>
                {verse.footnotes}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

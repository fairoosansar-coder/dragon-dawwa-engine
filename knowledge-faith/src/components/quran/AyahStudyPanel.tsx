import { useState } from 'react';
import { BookOpen, Pause, SkipBack, SkipForward, Sparkles, Square, Volume2 } from 'lucide-react';
import { useRemote } from '../../lib/api.ts';
import { splitTextIntoSpeechLines, useLineByLineTts } from '../../lib/lineByLineTts.ts';
import { useApp, useStored } from '../../lib/store.tsx';
import { AudioLoadingSpinner, loadingAudioLabel } from '../AudioLoadingSpinner.tsx';
import type { LocalizedAyahStudyPayload } from '../../server/ayahStudyService.ts';
import { LANGUAGE_NAMES, type Lang } from '../../shared/sources.ts';
import type { McpEdition } from '../../shared/quranMcp.ts';
import type { SurahInfo, Verse } from '../../shared/types.ts';
import { ErrorNote, Loading } from '../ui.tsx';

function storedEdition(value: unknown, editions: McpEdition[]): string {
  if (typeof value !== 'string' || !editions.length) return '';
  return editions.some(item => item.editionId === value) ? value : '';
}

function editionLabel(edition: McpEdition): string {
  return edition.author ? `${edition.name} — ${edition.author}` : edition.name;
}

export function AyahStudyPanel({
  info,
  verse,
  ayah,
  lang,
  onAyah,
}: {
  info: SurahInfo;
  verse: Verse | null;
  ayah: number;
  lang: Lang;
  onAyah: (ayah: number) => void;
}) {
  const { t } = useApp();
  const [storedTafsir, setStoredTafsir] = useStored<unknown>('kf-mcp-tafsir', '');
  const [showArabicReference, setShowArabicReference] = useState(false);

  const editions = useRemote<McpEdition[]>('/api/quran/mcp/editions?type=tafsir');
  const catalogue = editions.data ?? [];
  const editionId = storedEdition(storedTafsir, catalogue);

  const studyUrl =
    info.number >= 1 && ayah >= 1
      ? `/api/ummah/quran/study/${info.number}/${ayah}?lang=${lang}${
          editionId ? `&edition=${encodeURIComponent(editionId)}` : ''
        }`
      : null;

  const study = useRemote<LocalizedAyahStudyPayload>(studyUrl);
  const data =
    study.data &&
    study.data.surah === info.number &&
    study.data.ayahNumber === ayah &&
    study.data.lang === lang
      ? study.data
      : null;

  const ordered = [...catalogue].sort((a, b) => {
    const rank = (code: string) => (code === 'en' ? 0 : code === 'ar' ? 1 : 2);
    return rank(a.lang) - rank(b.lang) || a.name.localeCompare(b.name);
  });

  const tafsirLines = data?.tafsirText ? splitTextIntoSpeechLines(data.tafsirText) : [];
  const tafsirSessionId = `tafsir-study:${info.number}:${ayah}:${lang}`;
  const lineTts = useLineByLineTts(tafsirSessionId);
  const isTafsirPlaying = lineTts.isPlayingSession(tafsirSessionId);
  const isTafsirLoading = lineTts.isLoadingSession(tafsirSessionId);
  const langNative = LANGUAGE_NAMES[lang]?.native ?? 'English';
  const loadingText = loadingAudioLabel(lang);

  const handleToggleTafsirAudio = () => {
    if (!tafsirLines.length) return;
    if (isTafsirPlaying) {
      lineTts.pause();
      return;
    }
    if (lineTts.sessionId === tafsirSessionId && lineTts.status === 'paused') {
      void lineTts.jumpToLine(Math.max(0, lineTts.currentIndex));
      return;
    }
    void lineTts.start({
      sessionId: tafsirSessionId,
      lines: tafsirLines,
      lang,
    });
  };

  return (
    <section className="mx-auto w-full max-w-[44rem] space-y-8" data-ayah-study>
      <header className="space-y-2">
        <p className="text-sm font-semibold text-pine">
          {info.englishName} · {ayah}
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            className="font-medium text-pine disabled:opacity-40"
            disabled={ayah <= 1}
            onClick={() => onAyah(ayah - 1)}
          >
            {t.previousAyah}
          </button>
          <button
            type="button"
            className="font-medium text-pine disabled:opacity-40"
            disabled={ayah >= info.numberOfAyahs}
            onClick={() => onAyah(ayah + 1)}
          >
            {t.nextAyah}
          </button>
        </div>
      </header>

      {verse && (
        <div className="space-y-5">
          <p lang="ar" dir="rtl" className="quran-face text-3xl text-ink sm:text-4xl">
            {verse.arabic}
          </p>
          <p data-study-translation lang={lang} className="quran-prose text-xl">
            {verse.translation.trim() ? verse.translation : t.verseTranslationUnavailable}
            <span className="mx-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[#1c3d66]/25 px-1 align-middle text-[11px] text-[#1c3d66]">
              {verse.ayah}
            </span>
          </p>
          {verse.footnotes?.trim() ? (
            <p lang={lang} className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {verse.footnotes}
            </p>
          ) : null}
        </div>
      )}

      {/* Dragon Dawwa Tafsir & Commentary in Selected Language */}
      <div className="space-y-4" data-testid="dragon-dawwa-tafsir-section">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs font-semibold text-pine">
            <span>
              {lang === 'ta'
                ? 'Dragon Dawwa தஃப்ஸீர் (Tafsir) மூலம்'
                : lang === 'si'
                  ? 'Dragon Dawwa තෆ්සීර් (Tafsir) මූලාශ්‍රය'
                  : 'Dragon Dawwa Tafsir Reference'}
            </span>
            <select
              id="kf-tafsir-edition"
              value={editionId}
              onChange={event => setStoredTafsir(event.target.value)}
              className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm font-normal text-ink"
            >
              <option value="">
                {lang === 'ta'
                  ? 'Dragon Dawwa தமிழ் தஃப்ஸீர் (தானியங்கி மொழிபெயர்ப்பு)'
                  : lang === 'si'
                    ? 'Dragon Dawwa සිංහල තෆ්සීර් (ස්වයංක්‍රීය පරිවර්තනය)'
                    : 'Dragon Dawwa Integrated Scholarly Tafsir'}
              </option>
              {ordered.map(item => (
                <option key={item.editionId} value={item.editionId}>
                  {editionLabel(item)} ({LANGUAGE_NAMES[lang]?.native ?? 'Translated'})
                </option>
              ))}
            </select>
          </label>

          {tafsirLines.length > 0 && (
            <button
              type="button"
              data-testid="tafsir-listen-btn"
              onClick={handleToggleTafsirAudio}
              style={{
                backgroundColor: isTafsirPlaying || isTafsirLoading ? '#D4AF37' : '#073C30',
                color: isTafsirPlaying || isTafsirLoading ? '#041B14' : '#FFFFFF',
              }}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
            >
              {isTafsirLoading ? (
                <AudioLoadingSpinner size={14} />
              ) : isTafsirPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
              ) : (
                <Volume2 className="h-3.5 w-3.5" aria-hidden />
              )}
              <span>
                {isTafsirLoading
                  ? loadingText
                  : isTafsirPlaying
                    ? `Pause Tafsir (${langNative})`
                    : `Listen to Tafsir (${langNative})`}
              </span>
            </button>
          )}
        </div>

        {/* Active Line-by-Line Progress Bar for Tafsir */}
        {lineTts.active && (
          <div
            data-testid="tafsir-tts-progress"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D4AF37]/45 bg-[#073C30] px-3.5 py-2 text-xs text-[#F9E7B9]"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
              <span className="font-mono text-[11px] font-bold">
                ElevenLabs v4 · Reading Line {lineTts.currentIndex + 1} of {lineTts.lines.length}
              </span>
              {lineTts.nextLineReady && (
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                  Next line ready
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous line"
                disabled={lineTts.currentIndex <= 0}
                onClick={() => void lineTts.jumpToLine(lineTts.currentIndex - 1)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/25 disabled:opacity-40 cursor-pointer"
              >
                <SkipBack className="h-3 w-3" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next line"
                disabled={lineTts.currentIndex + 1 >= lineTts.lines.length}
                onClick={() => void lineTts.jumpToLine(lineTts.currentIndex + 1)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/25 disabled:opacity-40 cursor-pointer"
              >
                <SkipForward className="h-3 w-3" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Stop"
                onClick={() => lineTts.stop()}
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-300/50 text-red-300 cursor-pointer"
              >
                <Square className="h-3 w-3 fill-current" aria-hidden />
              </button>
            </div>
          </div>
        )}

        {study.loading && !data && <Loading />}
        {study.error && !data && <ErrorNote message={t.tafsirFailed} onRetry={study.reload} />}

        {data && (
          <article
            data-tafsir-passage
            data-tafsir-ayah={data.ayah}
            className="quran-sheet rounded-2xl border border-pine/15 bg-[#FCF9F2] px-5 py-6 shadow-xs sm:px-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pine/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#073C30] text-[#D4AF37]">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div>
                  <p data-tafsir-edition className="text-sm font-bold text-[#073C30]">
                    {data.tafsirTitle}
                  </p>
                  <p className="text-[11px] text-stone-600">
                    {data.editionLabel} · {langNative}
                  </p>
                </div>
              </div>

              {data.arabicTafsirText && (
                <button
                  type="button"
                  onClick={() => setShowArabicReference(open => !open)}
                  className="rounded-full border border-pine/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-pine hover:bg-emerald-50/50"
                >
                  {showArabicReference ? 'Hide Arabic Source' : 'Show Arabic Source (عربي)'}
                </button>
              )}
            </div>

            <div
              data-tafsir-text
              lang={lang}
              dir="ltr"
              className="mt-4 space-y-2.5 text-base leading-relaxed text-stone-900"
            >
              {tafsirLines.map((line, idx) => {
                const active =
                  lineTts.sessionId === tafsirSessionId &&
                  lineTts.status !== 'idle' &&
                  lineTts.currentIndex === idx;
                return (
                  <p
                    key={idx}
                    data-tts-line-index={idx}
                    data-tts-line-active={active ? 'true' : undefined}
                    onClick={() => {
                      void lineTts.start({
                        sessionId: tafsirSessionId,
                        lines: tafsirLines,
                        startIndex: idx,
                        lang,
                      });
                    }}
                    className={`cursor-pointer rounded-xl px-3 py-1.5 transition ${
                      active
                        ? 'border-l-4 border-[#D4AF37] bg-amber-50/90 font-medium text-stone-950 shadow-2xs'
                        : 'hover:bg-white/80'
                    }`}
                  >
                    {line}
                  </p>
                );
              })}
            </div>

            {showArabicReference && data.arabicTafsirText && (
              <div
                lang="ar"
                dir="rtl"
                className="arabic mt-4 rounded-xl border border-stone-200 bg-white p-4 text-xl leading-loose text-stone-900"
              >
                {data.arabicTafsirText}
              </div>
            )}
          </article>
        )}
      </div>

      {/* Word-by-Word in Selected Language */}
      <div className="space-y-3" data-testid="ayah-word-by-word-section">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-pine">{t.wordsTitle}</h3>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
            {langNative}
          </span>
        </div>

        {study.loading && !data && <Loading />}
        {data && data.words.length === 0 && !study.loading && (
          <p className="text-sm text-muted">{t.wordsEmpty}</p>
        )}

        {data && data.words.length > 0 && (
          <ol className="space-y-3" data-words-ayah={data.ayah}>
            {data.words.map(word => (
              <li
                key={word.position}
                className="rounded-2xl border border-pine/10 bg-white/85 px-4 py-3 shadow-2xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p lang="ar" dir="rtl" className="quran-face text-2xl text-ink">
                    {word.arabic}
                  </p>
                  {word.root && (
                    <span className="rounded-full border border-amber-300/70 bg-amber-50/70 px-2.5 py-0.5 text-xs font-semibold text-amber-950">
                      {t.rootLabel}: <span lang="ar" dir="rtl" className="quran-face">{word.root}</span>
                    </span>
                  )}
                </div>

                <p lang={lang} className="mt-1.5 text-sm font-medium leading-relaxed text-ink">
                  {word.transliteration ? (
                    <span className="font-mono text-xs text-stone-500">{word.transliteration}</span>
                  ) : null}
                  {word.translation ? (
                    <span className="font-semibold text-[#073C30]">
                      {word.transliteration ? ' · ' : ''}
                      {word.translation}
                    </span>
                  ) : null}
                </p>

                {word.description && (
                  <p lang={lang} className="mt-1 text-xs leading-relaxed text-stone-600">
                    {word.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

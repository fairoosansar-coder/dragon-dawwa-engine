import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { claimPlayback, pauseAudio, playAudio, setAudioPlaybackRate, useAudioState } from '../lib/audio.ts';
import { useRemote } from '../lib/api.ts';
import { useLineByLineTts } from '../lib/lineByLineTts.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { profileFontClass, wallFontClass } from '../lib/typography.ts';
import { AudioLoadingSpinner, loadingAudioLabel } from '../components/AudioLoadingSpinner.tsx';
import {
  HADITH_PLAYBACK_SPEEDS,
  HADITH_VOICE_PROFILES,
  resolveHadithVoiceProfile,
  type HadithPlaybackSpeed,
  type HadithVoiceProfileId,
} from '../shared/hadithVoices.ts';
import type { LibraryDocument } from '../shared/libraryDocument.ts';
import { LANGUAGE_NAMES, type Lang } from '../shared/sources.ts';
import { Card, ErrorNote, Loading, Notice } from '../components/ui.tsx';

const PLACE_KEY = 'kf-library-place';

function savedPlace(): { id: number; blockId: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PLACE_KEY) || 'null') as { id?: unknown; blockId?: unknown } | null;
    if (!raw || typeof raw.id !== 'number' || typeof raw.blockId !== 'string') return null;
    return { id: raw.id, blockId: raw.blockId };
  } catch {
    return null;
  }
}

function stripLeadingNumberPrefix(text: string): string {
  return text.replace(/^\s*(?:\(\d{1,3}\)|\d{1,3}\s*[-.)])\s*/u, '').trim();
}

export function LibraryReader({ itemId, backHref }: { itemId: number; backHref: string }) {
  const { lang } = useApp();
  const [page, setPage] = useState(1);
  const [voiceProfile, setVoiceProfile] = useStored<HadithVoiceProfileId>(
    'kf-hadith-voice-profile',
    'tariq',
  );
  const [speed, setSpeed] = useStored<HadithPlaybackSpeed>('kf-hadith-voice-speed', 1);

  useEffect(() => {
    setPage(1);
  }, [itemId, lang]);

  const remote = useRemote<LibraryDocument>(
    Number.isInteger(itemId) && itemId > 0
      ? `/api/library/read/${itemId}?lang=${lang}&section=${page}`
      : null,
  );
  const data =
    remote.data &&
    remote.data.id === itemId &&
    remote.data.requestedLanguage === lang &&
    (remote.data.page ?? 1) === page
      ? remote.data
      : null;

  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const needle = query.trim().toLocaleLowerCase('en');

  const blocks = useMemo(() => {
    if (!data) return [];
    if (!needle) return data.blocks;
    return data.blocks.filter(
      block =>
        block.kind === 'heading' || block.text.toLocaleLowerCase('en').includes(needle),
    );
  }, [data, needle]);

  const readableParagraphs = useMemo(
    () => blocks.filter(b => b.kind !== 'heading'),
    [blocks],
  );
  const speechLines = useMemo(
    () => readableParagraphs.map(b => b.text.trim()).filter(Boolean),
    [readableParagraphs],
  );

  const sessionId = `hub-reader:${itemId}:${lang}:${page}`;
  const lineTts = useLineByLineTts(sessionId);
  const isPlaying = lineTts.isPlayingSession(sessionId);
  const isLoading = lineTts.isLoadingSession(sessionId);
  const profile = resolveHadithVoiceProfile(voiceProfile);
  const effectiveLang: Lang = lang;
  const langLabel = LANGUAGE_NAMES[effectiveLang]?.native ?? 'English';
  const loadingText = loadingAudioLabel(effectiveLang);
  const totalPages = data?.totalPages ?? 1;
  const pageOffset = ((data?.page ?? page) - 1) * (data?.pageSize ?? 15);

  useEffect(() => {
    const place = savedPlace();
    if (!data || !place || place.id !== data.id) return;
    document.getElementById(`block-${place.blockId}`)?.scrollIntoView({ block: 'center' });
  }, [data]);

  const handleTogglePlayAll = () => {
    if (!speechLines.length) return;
    if (isPlaying) {
      lineTts.pause();
      return;
    }
    if (lineTts.sessionId === sessionId && lineTts.status === 'paused') {
      void lineTts.jumpToLine(Math.max(0, lineTts.currentIndex));
      return;
    }
    setAudioPlaybackRate(speed);
    void lineTts.start({
      sessionId,
      lines: speechLines,
      lang: effectiveLang,
      voiceProfile: profile.id,
      speed,
    });
  };

  const handlePlayFromBlockIndex = (paraIndex: number) => {
    if (!speechLines.length) return;
    setAudioPlaybackRate(speed);
    void lineTts.start({
      sessionId,
      lines: speechLines,
      startIndex: paraIndex,
      lang: effectiveLang,
      voiceProfile: profile.id,
      speed,
    });
  };

  let runningParaIdx = -1;

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="hub-article-reader">
      <a
        href={backHref}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-pine hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        <span>Back to Study Collection</span>
      </a>

      {remote.loading && !data && <Loading label="Opening study guide…" />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}

      {data && (
        <article className="space-y-6">
          {/* Editorial Article Header */}
          <header className="rounded-3xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#041B14] via-[#0A2E23] to-[#041B14] p-6 text-[#FFFFFF] shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                data-testid="reader-studio-badge"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/15 px-3 py-0.5 text-xs font-bold tracking-wider text-[#F9E7B9]"
              >
                <BookOpen className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                <span>DRAGON DAWWA · KNOWLEDGE READER</span>
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-stone-200">
                {langLabel}
              </span>
            </div>

            <h1
              className={`${wallFontClass(effectiveLang, data.title)} mt-3 text-2xl font-bold leading-snug text-[#FFFFFF] sm:text-3xl`}
              lang={effectiveLang}
            >
              {data.title || 'Dragon Dawwa Study Guide'}
            </h1>

            {data.description && (
              <p
                lang={effectiveLang}
                className="mt-2.5 max-w-3xl text-sm leading-relaxed text-stone-200"
              >
                {data.description}
              </p>
            )}

            {/* ElevenLabs v4 Voice Player Bar inside Article Header */}
            {speechLines.length > 0 && (
              <div
                data-testid="article-voice-bar"
                className="mt-5 rounded-2xl border border-[#D4AF37]/40 bg-[#031812]/80 p-3.5 text-[#FBF9F5]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#F9E7B9]">
                      <Sparkles className="h-3 w-3 text-[#D4AF37]" aria-hidden />
                      <span>ElevenLabs v4 Voice · Line-by-Line</span>
                    </span>

                    <select
                      aria-label="Article voice profile"
                      value={profile.id}
                      onChange={e => setVoiceProfile(e.target.value as HadithVoiceProfileId)}
                      style={{ backgroundColor: '#0A3528', color: '#FBF9F5' }}
                      className="rounded-xl border border-[#D4AF37]/40 bg-[#0A3528] px-2.5 py-1 text-xs font-semibold text-[#FBF9F5] outline-none"
                    >
                      {HADITH_VOICE_PROFILES.map(v => (
                        <option
                          key={v.id}
                          value={v.id}
                          style={{ backgroundColor: '#FFFFFF', color: '#1C1917' }}
                        >
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speed Pills */}
                  <div className="inline-flex items-center gap-1 rounded-xl border border-[#D4AF37]/30 bg-black/20 p-0.5">
                    {HADITH_PLAYBACK_SPEEDS.map(rate => {
                      const active = speed === rate;
                      return (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => {
                            setSpeed(rate);
                            setAudioPlaybackRate(rate);
                          }}
                          style={{
                            backgroundColor: active ? '#D4AF37' : 'transparent',
                            color: active ? '#041B14' : '#FBF9F5',
                          }}
                          className="rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold cursor-pointer"
                        >
                          {rate}x
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    data-testid="article-play-tts-btn"
                    onClick={handleTogglePlayAll}
                    style={{
                      backgroundColor: isPlaying || isLoading ? '#D4AF37' : '#FBF9F5',
                      color: '#041B14',
                    }}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    {isLoading ? (
                      <AudioLoadingSpinner size={14} />
                    ) : isPlaying ? (
                      <Pause className="h-3.5 w-3.5 fill-current" aria-hidden />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                    )}
                    <span>
                      {isLoading
                        ? loadingText
                        : isPlaying
                          ? `Pause Article (${langLabel})`
                          : `Listen to Article (${langLabel} · ${speechLines.length} sections)`}
                    </span>
                  </button>

                  {lineTts.active && (
                    <div
                      data-testid="article-tts-progress"
                      className="flex flex-wrap items-center gap-2 text-xs text-[#F9E7B9]"
                    >
                      <span className="font-mono text-[11px] font-bold">
                        Reading Line {lineTts.currentIndex + 1} of {lineTts.lines.length}
                      </span>
                      {lineTts.nextLineReady && (
                        <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          Next line ready
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="Previous section"
                        disabled={lineTts.currentIndex <= 0}
                        onClick={() => void lineTts.jumpToLine(lineTts.currentIndex - 1)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-white/25 disabled:opacity-40 cursor-pointer"
                      >
                        <SkipBack className="h-3 w-3" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="Next section"
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
                  )}
                </div>
              </div>
            )}
          </header>

          {data.limitation && <Notice>{data.limitation}</Notice>}

          {/* Search & Chapter Jump Bar */}
          {data.blocks.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white px-4 py-3 shadow-2xs">
              <label className="relative flex min-w-[15rem] flex-1 items-center">
                <Search className="pointer-events-none absolute left-3 h-4 w-4 text-stone-400" aria-hidden />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search within this study guide…"
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-1.5 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#073C30] focus:bg-white focus:outline-none"
                />
              </label>
              <span className="text-xs font-medium text-stone-500">
                Tap any section below to start voice narration from that point
              </span>
            </div>
          )}

          {/* Editorial Reading Sheet (Clean Aligned Cards — Never Pill Chips) */}
          {blocks.some(block => block.kind !== 'heading') && (
            <div
              data-testid="editorial-article-blocks"
              className="space-y-4 rounded-3xl border border-stone-200/90 bg-[#FCF9F2] p-5 shadow-xs sm:p-8"
            >
              {blocks.map(block => {
                if (block.kind === 'heading') {
                  return (
                    <h2
                      id={`block-${block.id}`}
                      key={block.id}
                      className="pt-3 font-display text-xl font-bold text-[#073C30] first:pt-0 sm:text-2xl"
                      lang={effectiveLang}
                    >
                      {block.text}
                    </h2>
                  );
                }

                runningParaIdx += 1;
                const currentParaIdx = runningParaIdx;
                const isLineActive =
                  lineTts.sessionId === sessionId &&
                  lineTts.status !== 'idle' &&
                  lineTts.currentIndex === currentParaIdx;

                const cleanBody = stripLeadingNumberPrefix(block.text);
                const badgeNum = String(pageOffset + currentParaIdx + 1).padStart(2, '0');

                if (block.kind === 'footnote') {
                  return (
                    <details
                      key={block.id}
                      id={`block-${block.id}`}
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
                    >
                      <summary className="cursor-pointer text-xs font-semibold text-pine">
                        Note
                      </summary>
                      <p className="mt-2 text-sm leading-relaxed text-stone-800" lang={effectiveLang}>
                        {block.text}
                      </p>
                    </details>
                  );
                }

                return (
                  <div
                    id={`block-${block.id}`}
                    key={block.id}
                    data-tts-line-index={currentParaIdx}
                    data-tts-line-active={isLineActive ? 'true' : undefined}
                    onClick={() => handlePlayFromBlockIndex(currentParaIdx)}
                    style={{
                      backgroundColor: isLineActive ? '#FFFBEB' : '#FFFFFF',
                      color: '#1C1917',
                      borderColor: isLineActive ? '#D4AF37' : '#E5E0D5',
                    }}
                    className={`group flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition sm:p-5 ${
                      isLineActive
                        ? 'border-l-4 shadow-sm'
                        : 'hover:border-[#073C30]/40 hover:shadow-2xs'
                    }`}
                  >
                    <span
                      data-testid={`editorial-badge-${badgeNum}`}
                      style={{
                        backgroundColor: isLineActive ? '#D4AF37' : '#073C30',
                        color: isLineActive ? '#041B14' : '#F9E7B9',
                      }}
                      className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold shadow-2xs"
                    >
                      {badgeNum}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        lang={effectiveLang}
                        style={{ color: '#0B1612', lineHeight: 1.85 }}
                        className={`${profileFontClass(effectiveLang, cleanBody)} max-w-[72ch] text-base font-medium text-[#0B1612] sm:text-[17px]`}
                      >
                        {cleanBody}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
                          {isLineActive && isLoading ? (
                            <>
                              <AudioLoadingSpinner size={13} className="text-amber-700" />
                              <span className="text-amber-900 font-bold">{loadingText}</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3.5 w-3.5" aria-hidden />
                              <span>{isLineActive ? 'Reading this section…' : 'Tap to listen from here'}</span>
                            </>
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            localStorage.setItem(
                              PLACE_KEY,
                              JSON.stringify({ id: data.id, blockId: block.id }),
                            );
                            setSaved(block.id);
                          }}
                          className="inline-flex items-center gap-1 font-medium text-stone-500 hover:text-[#073C30] hover:underline"
                        >
                          <Bookmark className="h-3 w-3" aria-hidden />
                          <span>{saved === block.id ? 'Place saved' : 'Bookmark section'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Chapter / Page Pagination Controls for Full-Length Books */}
              {totalPages > 1 && (
                <div
                  data-testid="library-reader-pagination"
                  className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200/80 pt-4"
                >
                  <button
                    type="button"
                    data-testid="library-prev-page-btn"
                    disabled={page <= 1}
                    onClick={() => {
                      lineTts.stop();
                      setPage(p => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-800 shadow-2xs transition hover:border-[#073C30] disabled:opacity-40 cursor-pointer"
                  >
                    <span>← Previous Section</span>
                  </button>

                  <span className="font-mono text-xs font-bold text-stone-700">
                    Section {page} of {totalPages} ({data.totalBlocks ?? blocks.length} passages)
                  </span>

                  <button
                    type="button"
                    data-testid="library-next-page-btn"
                    disabled={page >= totalPages}
                    onClick={() => {
                      lineTts.stop();
                      setPage(p => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{ backgroundColor: '#073C30', color: '#FFFFFF' }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#073C30] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#0A2E23] disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next Section →</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {data.media.map(file => (
            <section key={file.sourceUrl} className="space-y-2">
              <h2 className="font-display text-xl font-bold text-pine">
                {file.kind === 'pdf' ? 'Publication file' : 'Original recording'}
              </h2>
              {file.kind === 'pdf' ? (
                <iframe
                  title={data.title || 'Publication file'}
                  src={file.viewUrl}
                  className="h-[70vh] w-full rounded-2xl border border-pine/10 bg-white"
                />
              ) : file.kind === 'audio' ? (
                <AudioControl id={`library-${data.id}`} url={file.sourceUrl} />
              ) : file.kind === 'video' ? (
                <video
                  controls
                  preload="none"
                  src={file.sourceUrl}
                  className="w-full rounded-2xl bg-black"
                  onPlay={event => claimPlayback(event.currentTarget)}
                />
              ) : (
                <p className="text-sm text-ink/70">
                  This attachment is {file.extension}. It is not shown inline.
                </p>
              )}
            </section>
          ))}
        </article>
      )}

      {!remote.loading && !remote.error && !data && (
        <Card>
          <p className="text-sm">This item is not open yet.</p>
        </Card>
      )}
    </div>
  );
}

function AudioControl({ id, url }: { id: string; url: string }) {
  const audio = useAudioState();
  const active =
    audio.id === id &&
    (audio.status === 'playing' || audio.status === 'paused' || audio.status === 'loading');
  return (
    <button
      type="button"
      className="min-h-11 rounded-full bg-pine px-4 text-sm font-medium text-white"
      onClick={() =>
        active && audio.status === 'playing' ? pauseAudio() : void playAudio(id, url)
      }
    >
      {active && audio.status === 'playing' ? 'Pause' : 'Play original recording'}
    </button>
  );
}

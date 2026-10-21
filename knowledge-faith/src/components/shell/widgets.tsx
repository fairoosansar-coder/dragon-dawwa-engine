import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bookmark, BookmarkCheck, Search } from 'lucide-react';
import { RubElHizb } from '../../engine/ds/ornaments.tsx';
import { useRemote } from '../../lib/api.ts';
import { prayerQueryDate } from '../../lib/prayerClock.ts';
import { pauseAudio, resumeAudio, useAudioState, type AudioStatus } from '../../lib/audio.ts';
import { useShell } from '../../lib/shell.tsx';
import { usePronunciation, type Pronunciation } from '../../lib/pronunciation.ts';
import { useApp, useStored } from '../../lib/store.tsx';
import type { Strings } from '../../lib/i18n.ts';
import { QURAN_TRANSLATIONS } from '../../shared/sources.ts';
import { minutesInZone, nextPrayer } from '../../shared/spiritual.ts';
import type { PrayerDay } from '../../shared/types.ts';
import { applyPrayerOffsets, latitudeAdjustmentId, type PrayerOffsets } from '../../spiritual/prayerAdjust.ts';
import { usePlace } from '../../spiritual/place.ts';
import { Button, Loading } from '../ui.tsx';

export function audioStatusLabel(t: Strings, status: AudioStatus): string {
  if (status === 'loading') return t.audioLoading;
  if (status === 'playing') return t.audioPlaying;
  if (status === 'paused') return t.audioPaused;
  if (status === 'error') return t.audioError;
  if (status === 'unavailable') return t.audioUnavailable;
  return t.audioIdle;
}

export function SearchField({ className = '' }: { className?: string }) {
  const { t } = useApp();
  const { query, setQuery } = useShell();
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{t.searchSection}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder={t.searchSection}
        className="w-full rounded-full border border-pine/20 bg-parchment py-2 pl-10 pr-4 text-sm text-ink placeholder:text-muted"
      />
    </label>
  );
}

/** Next prayer from the saved place only. Without a place, this is a link to set one. */
export function PrayerStrip() {
  const { t } = useApp();
  const [place] = usePlace();
  const [method] = useStored<number>('kf-method', 3);
  const [school] = useStored<number>('kf-school', 0);
  const [latAdj] = useStored<number>('kf-lat-adj', 0);
  const [offsets] = useStored<PrayerOffsets>('kf-prayer-offsets', {});
  const [now, setNow] = useState(() => new Date());
  const [timeZone, setTimeZone] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  const date = prayerQueryDate(now, timeZone);
  const url = place
    ? `/api/prayer?lat=${place.lat}&lng=${place.lng}&method=${method}&school=${school}${date ? `&date=${date}` : ''}&latAdj=${latitudeAdjustmentId(latAdj)}`
    : null;
  const remote = useRemote<PrayerDay>(url);
  useEffect(() => {
    const nextZone = remote.data?.timezone;
    if (nextZone && nextZone !== timeZone) setTimeZone(nextZone);
  }, [remote.data, timeZone]);
  const upcoming = useMemo(() => {
    if (!remote.data) return null;
    const timings = applyPrayerOffsets(remote.data.timings, offsets);
    const next = nextPrayer(
      { Fajr: timings.Fajr, Dhuhr: timings.Dhuhr, Asr: timings.Asr, Maghrib: timings.Maghrib, Isha: timings.Isha },
      minutesInZone(now, remote.data.timezone),
    );
    return { name: next.name, time: timings[next.name] };
  }, [remote.data, offsets, now]);

  if (!place) {
    return (
      <a href="#/spiritual/salah/times" className="block rounded-2xl border border-pine/15 bg-parchment px-4 py-3 text-sm font-medium text-pine">
        {t.setLocation}
      </a>
    );
  }

  return (
    <a href="#/spiritual/salah/times" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/60 bg-parchment px-4 py-3">
      <span className="text-sm text-muted">{place.name}</span>
      {remote.loading && <Loading />}
      {remote.error && <span className="text-sm text-ink">{remote.error}</span>}
      {upcoming && (
        <span className="font-display text-lg font-bold text-pine">
          {t.nextPrayer}: {upcoming.name} · {upcoming.time}
        </span>
      )}
    </a>
  );
}

export function FeatureCard({ href, title, body, icon }: { href: string; title: string; body: string; icon: ReactNode }) {
  return (
    <a href={href} className="flex h-full flex-col rounded-3xl border border-pine/10 bg-parchment p-5 shadow-sm transition hover:border-gold">
      <span className="text-pine">{icon}</span>
      <span className="mt-3 font-display text-xl font-bold text-pine">{title}</span>
      <span className="mt-2 text-sm leading-relaxed text-muted">{body}</span>
    </a>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-pine/20 bg-sand px-4 py-8 text-center text-sm leading-relaxed text-muted">{children}</p>;
}

export function BookPage({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-2xl border-2 border-lapis bg-parchment p-3 sm:p-6">
      <span className="pointer-events-none absolute left-2 top-2 hidden sm:block">
        <RubElHizb size={22} />
      </span>
      <span className="pointer-events-none absolute right-2 top-2 hidden sm:block">
        <RubElHizb size={22} />
      </span>
      <span className="pointer-events-none absolute bottom-2 left-2 hidden sm:block">
        <RubElHizb size={22} />
      </span>
      <span className="pointer-events-none absolute bottom-2 right-2 hidden sm:block">
        <RubElHizb size={22} />
      </span>
      <div className="relative rounded-xl border border-gold/70 px-3 py-6 sm:px-8 sm:py-10">{children}</div>
    </div>
  );
}

export function VerseActions({
  saved,
  onListen,
  onBookmark,
}: {
  saved: boolean;
  onListen: () => void;
  onBookmark: () => void;
}) {
  const { t } = useApp();
  const audio = useAudioState();
  return (
    <div role="group" aria-label={t.verseActions} className="flex flex-wrap items-center gap-2">
      <Button variant="soft" onClick={onListen}>
        {t.listen}
      </Button>
      <Button variant="ghost" onClick={onBookmark} aria-pressed={saved}>
        {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
        {saved ? t.unsave : t.save}
      </Button>
      {audio.status !== 'idle' && <span className="text-sm text-muted">{audioStatusLabel(t, audio.status)}</span>}
    </div>
  );
}

export function SourceAttribution() {
  const { t, lang } = useApp();
  const edition = QURAN_TRANSLATIONS[lang];
  return (
    <p className="text-sm text-muted">
      {t.meaningNote} · {edition.translator}
      <span className="sr-only">
        {' '}
        {t.editionLabel} {edition.edition}
      </span>
    </p>
  );
}

export function PronunciationControl() {
  const { t } = useApp();
  const [pronunciation, setPronunciation] = usePronunciation();
  const select = (value: string) => {
    if (value === 'off' || value === 'en') setPronunciation(value);
  };
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-muted">
      <label className="flex flex-col gap-1">
        {t.pronunciation}
        <select id="kf-pronunciation" value={pronunciation} onChange={event => select(event.target.value)} className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm font-normal text-ink">
          <option value="off">{t.pronunciationOff}</option>
          <option value="en">English</option>
          <option value="ta" disabled>
            Tamil — unavailable
          </option>
          <option value="si" disabled>
            Sinhala — unavailable
          </option>
        </select>
      </label>
      <p className="font-normal leading-relaxed">{t.pronunciationUnavailable}</p>
    </div>
  );
}

export function PronunciationStatus({ pronunciation }: { pronunciation: Pronunciation }) {
  const { t } = useApp();
  if (pronunciation === 'en') return <p className="text-sm leading-relaxed text-muted">{t.pronunciationNote}</p>;
  if (pronunciation === 'ta' || pronunciation === 'si') return <p className="text-sm leading-relaxed text-muted">{t.pronunciationUnavailable}</p>;
  return null;
}

export function ReadingSettings({
  mode,
  textSize,
  onTextSize,
  reciter,
  onReciter,
  reciters,
  onMode,
}: {
  mode: 'library' | 'study' | 'book';
  textSize: 'sm' | 'md' | 'lg';
  onTextSize: (size: 'sm' | 'md' | 'lg') => void;
  reciter: string;
  onReciter: (id: string) => void;
  reciters: { id: string; name: string }[];
  onMode: (mode: 'study' | 'book') => void;
}) {
  const { t, lang } = useApp();
  const edition = QURAN_TRANSLATIONS[lang];
  return (
    <details className="rounded-2xl border border-pine/10 bg-parchment px-4 py-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-pine [&::-webkit-details-marker]:hidden">
        {t.readingSettings}
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <p className="flex flex-col gap-1 text-xs font-medium text-muted">
        {t.editionLabel}
        <span className="rounded-xl border border-pine/10 bg-sand px-3 py-2 text-sm font-normal text-ink">
          {edition.translator}
        </span>
      </p>
      <div className="flex flex-col gap-1 text-xs font-medium text-muted">
        {t.readingMode}
        <div className="flex gap-2">
          <Button variant={mode === 'study' ? 'primary' : 'soft'} onClick={() => onMode('study')} aria-pressed={mode === 'study'}>
            {t.studyMode}
          </Button>
          <Button variant={mode === 'book' ? 'primary' : 'soft'} onClick={() => onMode('book')} aria-pressed={mode === 'book'}>
            {t.bookMode}
          </Button>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        {t.reciter}
        <select value={reciter} onChange={event => onReciter(event.target.value)} className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm text-ink">
          {reciters.map(item => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        {t.textSize}
        <select value={textSize} onChange={event => onTextSize(event.target.value as 'sm' | 'md' | 'lg')} className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm text-ink">
          <option value="sm">A</option>
          <option value="md">A+</option>
          <option value="lg">A++</option>
        </select>
      </label>
      <PronunciationControl />
      </div>
    </details>
  );
}

export function AudioMiniPlayer({ safe }: { safe: boolean }) {
  const { t } = useApp();
  const audio = useAudioState();
  if (!audio.id || audio.status === 'idle') return null;
  return (
    <div data-mini-player className={`shrink-0 border-t border-gold/50 bg-pine px-4 py-3 text-sand ${safe ? 'pb-[max(0.75rem,env(safe-area-inset-bottom))]' : ''}`}>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="text-sm">{audioStatusLabel(t, audio.status)}</p>
        {audio.status === 'playing' || audio.status === 'loading' ? (
          <Button variant="soft" onClick={pauseAudio}>
            {t.pause}
          </Button>
        ) : audio.status === 'paused' || audio.status === 'error' ? (
          <Button variant="soft" onClick={resumeAudio}>
            {t.play}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

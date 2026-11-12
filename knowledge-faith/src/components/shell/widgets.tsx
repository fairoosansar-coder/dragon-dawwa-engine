import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkCheck, Search } from 'lucide-react';
import { RubElHizb } from '../../engine/ds/ornaments.tsx';
import type { RouteRoot } from '../../lib/route.ts';
import { useRemote } from '../../lib/api.ts';
import { prayerQueryDate } from '../../lib/prayerClock.ts';
import { pauseAudio, resumeAudio, useAudioState, type AudioStatus } from '../../lib/audio.ts';
import { useShell } from '../../lib/shell.tsx';
import { usePronunciation, type Pronunciation } from '../../lib/pronunciation.ts';
import { useApp, useStored } from '../../lib/store.tsx';
import type { Strings } from '../../lib/i18n.ts';
import type { QuranEncEdition } from '../../shared/quranenc.ts';
import type { Verse } from '../../shared/types.ts';
import { minutesInZone, nextPrayer } from '../../shared/spiritual.ts';
import type { PrayerDay } from '../../shared/types.ts';
import { applyPrayerOffsets, latitudeAdjustmentId, type PrayerOffsets } from '../../spiritual/prayerAdjust.ts';
import { usePlace } from '../../spiritual/place.ts';
import { AudioLoadingSpinner, loadingAudioLabel } from '../AudioLoadingSpinner.tsx';
import { Button, Loading } from '../ui.tsx';

export function audioStatusLabel(t: Strings, status: AudioStatus, id?: string | null): string {
  const meaning = Boolean(id?.startsWith('meaning-'));
  if (status === 'loading') return meaning ? t.meaningAudioLoading : t.audioLoading;
  if (status === 'playing') return meaning ? t.meaningAudioPlaying : t.audioPlaying;
  if (status === 'paused') return meaning ? t.meaningAudioPaused : t.audioPaused;
  if (status === 'error') return meaning ? t.meaningAudioError : t.audioError;
  if (status === 'unavailable') return meaning ? t.meaningAudioUnavailable : t.audioUnavailable;
  return meaning ? t.listenMeaning : t.audioIdle;
}

export type QuranSectionId = 'home' | 'read' | 'search' | 'study' | 'mine' | 'wall';

export function quranSectionId(segment?: string): QuranSectionId {
  if (segment === 'book') return 'read';
  if (segment === 'study') return 'study';
  if (segment === 'search') return 'search';
  if (segment === 'bookmarks') return 'mine';
  if (segment === 'wall') return 'wall';
  return 'home';
}

const HADITH_TAB_ACTIVE = 'bg-[#0E382B] text-white';
const HADITH_TAB_IDLE = 'bg-[#fffdf8] text-[#0E382B] hover:border-emerald-700';

function hadithTabId(segment?: string): 'encyclopedia' | 'collections' | 'research' {
  if (segment === 'research') return 'research';
  if (segment === 'collections') return 'collections';
  return 'encyclopedia';
}

const KNOWLEDGE_DESKS: Array<{ path: RouteRoot; href: string; label: string }> = [
  { path: 'hub', href: '#/hub', label: 'Hub' },
  { path: 'quran', href: '#/quran', label: 'Qur’an' },
  { path: 'hadith', href: '#/hadith', label: 'Hadith' },
  { path: 'books', href: '#/books', label: 'Books' },
  { path: 'spiritual', href: '#/spiritual', label: 'Worship' },
];

export function isKnowledgeDomainPath(path: RouteRoot, segments: string[] = []): boolean {
  if (path === 'quran' && segments[0] === 'wall') return false;
  if (path === 'hub' && (segments[0] === 'saved' || segments[0] === 'wall')) return false;
  return path === 'hub' || path === 'quran' || path === 'hadith' || path === 'books' || path === 'spiritual';
}

/** Sub-view tabs that belong in the desk header, beside the title. */
export function DeskHeaderTabs({ path, segments, className = '' }: { path: RouteRoot; segments: string[]; className?: string }) {
  const { t, uiTheme } = useApp();
  const isObsidian = uiTheme === 'obsidian';
  const shell = 'flex min-w-0 items-center gap-1.5 ' + className;
  const scroller = 'flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap py-0.5';

  if (!isKnowledgeDomainPath(path, segments)) {
    return null;
  }

  const quranCurrent = path === 'quran' ? quranSectionId(segments[0]) : null;
  const quranSubTabs: { id: QuranSectionId; href: string; label: string }[] = [
    { id: 'home', href: '#/quran', label: t.quranHome },
    { id: 'read', href: '#/quran/book', label: t.quranRead },
    { id: 'search', href: '#/quran/search', label: t.quranSearch },
    { id: 'study', href: '#/quran/study', label: t.quranAyahStudy },
    { id: 'mine', href: '#/quran/bookmarks', label: t.quranMine },
  ];

  const hadithActive = path === 'hadith' ? hadithTabId(segments[0]) : null;
  const hadithSubTabs = [
    { id: 'encyclopedia' as const, href: '#/hadith', en: 'Encyclopedia', ta: 'களஞ்சியம்' },
    { id: 'collections' as const, href: '#/hadith/collections', en: 'Canonical Collections', ta: 'நூல்கள்' },
    { id: 'research' as const, href: '#/hadith/research', en: 'Research a Hadith', ta: 'ஆய்வுக்கூடம்' },
  ];

  return (
    <div className={shell}>
      <div className="hidden h-3.5 w-px shrink-0 bg-stone-300/60 md:block" aria-hidden />
      <div className={scroller}>
        {/* Consolidated Knowledge Desk Switcher (Hub · Qur'an · Hadith · Books · Worship) */}
        <nav
          aria-label="Knowledge Desks"
          data-testid="knowledge-desk-switcher"
          style={
            isObsidian
              ? { backgroundColor: '#0A2E23', borderColor: 'rgba(212,175,55,0.4)' }
              : { backgroundColor: '#FFFFFF', borderColor: '#E5E0D5' }
          }
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5 shadow-2xs"
        >
          {KNOWLEDGE_DESKS.map(desk => {
            const active = desk.path === path;
            return (
              <a
                key={desk.path}
                href={desk.href}
                data-knowledge-desk-tab={desk.path}
                aria-current={active ? 'page' : undefined}
                style={
                  active
                    ? isObsidian
                      ? { backgroundColor: '#D4AF37', color: '#031812' }
                      : { backgroundColor: '#073C30', color: '#F5EEDC' }
                    : isObsidian
                      ? { color: '#F5EEDC' }
                      : { color: '#292524' }
                }
                className="inline-flex shrink-0 whitespace-nowrap items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold transition"
              >
                {desk.label}
              </a>
            );
          })}
        </nav>

        {/* Contextual Sub-Tabs when inside Qur'an or Hadith */}
        {path === 'quran' && (
          <>
            <span className="mx-1 h-3.5 w-px shrink-0 bg-stone-300/60" aria-hidden />
            <nav
              aria-label={t.quranTitle}
              data-testid="quran-tabs"
              style={
                isObsidian
                  ? { backgroundColor: '#0A2E23', borderColor: 'rgba(212,175,55,0.4)' }
                  : { backgroundColor: '#FFFFFF', borderColor: '#E5E0D5' }
              }
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5 shadow-2xs"
            >
              {quranSubTabs.map(tab => {
                const active = quranCurrent === tab.id;
                return (
                  <a
                    key={tab.id}
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    style={
                      active
                        ? isObsidian
                          ? { backgroundColor: '#D4AF37', color: '#031812' }
                          : { backgroundColor: '#073C30', color: '#F5EEDC' }
                        : isObsidian
                          ? { color: '#F5EEDC' }
                          : { color: '#292524' }
                    }
                    className="inline-flex shrink-0 whitespace-nowrap items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold transition"
                  >
                    {tab.label}
                  </a>
                );
              })}
            </nav>
          </>
        )}

        {path === 'hadith' && (
          <>
            <span className="mx-1 h-3.5 w-px shrink-0 bg-stone-300" aria-hidden />
            <nav aria-label="Hadith" data-testid="hadith-tabs" className="inline-flex shrink-0 items-center gap-1">
              {hadithSubTabs.map(tab => (
                <a
                  key={tab.id}
                  href={tab.href}
                  aria-current={tab.id === hadithActive ? 'page' : undefined}
                  className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-[#0E382B]/10 px-2 py-0.5 text-[11px] font-medium ${
                    tab.id === hadithActive ? HADITH_TAB_ACTIVE : HADITH_TAB_IDLE
                  }`}
                >
                  <span>{tab.en}</span>
                  <span lang="ta" className={tab.id === hadithActive ? 'text-white/80' : 'text-[#0E382B]/70'}>
                    ({tab.ta})
                  </span>
                </a>
              ))}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}

export function SearchField({ className = '', placeholder }: { className?: string; placeholder?: string }) {
  const { t } = useApp();
  const { query, setQuery } = useShell();
  const label = placeholder ?? t.searchSection;
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder={label}
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
      <div className="relative rounded-xl border border-gold/70 px-3 py-4 sm:px-8 sm:py-5">{children}</div>
    </div>
  );
}

export function VerseActions({
  saved,
  onListen,
  onMeaning,
  onBookmark,
}: {
  saved: boolean;
  onListen: () => void;
  onMeaning?: () => void;
  onBookmark: () => void;
}) {
  const { t } = useApp();
  return (
    <div role="group" aria-label={t.verseActions} className="flex flex-wrap items-center gap-2">
      <Button variant="soft" onClick={onListen}>
        {t.play}
      </Button>
      {onMeaning && (
        <Button variant="soft" onClick={onMeaning}>
          {t.playMeaning}
        </Button>
      )}
      <Button variant="ghost" onClick={onBookmark} aria-pressed={saved}>
        {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
        {saved ? t.unsave : t.save}
      </Button>
    </div>
  );
}

export function SourceAttribution({ verse }: { verse?: Verse | null }) {
  const { t } = useApp();
  if (!verse?.translationKey || !verse.translationVersion) {
    return <p className="text-sm text-muted">{t.quranEncUnread}</p>;
  }
  return (
    <details className="rounded-2xl border border-pine/10 px-4 py-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-pine [&::-webkit-details-marker]:hidden">
        {t.sourcesSection}
      </summary>
      <div className="mt-3 space-y-1 text-sm leading-relaxed text-muted">
        <p>
          {t.meaningNote} · {verse.translationTitle || verse.translator}
        </p>
        <p>
          {verse.translationKey} · {verse.translationVersion}
        </p>
        {verse.translationDescription ? <p>{verse.translationDescription}</p> : null}
      </div>
    </details>
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

function useOverlay(open: boolean, onClose: () => void, panelId: string, focusSelector?: string) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const main = document.getElementById('main');
    const scroll = main?.scrollTop ?? 0;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => {
      const panel = document.getElementById(panelId);
      if (!panel) return [];
      return [...panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        element => !element.hasAttribute('disabled') && element.tabIndex !== -1,
      );
    };
    const timer = window.setTimeout(() => {
      const panel = document.getElementById(panelId);
      const preferred = focusSelector ? panel?.querySelector<HTMLElement>(focusSelector) : null;
      const target = preferred && !preferred.hasAttribute('disabled') ? preferred : focusables()[0];
      target?.focus();
    }, 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = document.getElementById(panelId);
      const items = focusables();
      if (!panel || items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey, true);
      if (main) main.scrollTop = scroll;
      previous?.focus();
    };
  }, [open, panelId, focusSelector]);
}

/** Desktop side drawer and phone sheet. It overlays the book, so the page underneath does not reflow. */
export function OverlaySheet({
  open,
  onClose,
  id,
  title,
  focusSelector,
  children,
}: {
  open: boolean;
  onClose: () => void;
  id: string;
  title: string;
  focusSelector?: string;
  children: ReactNode;
}) {
  const { t } = useApp();
  const titleId = `${id}-title`;
  useOverlay(open, onClose, id, focusSelector);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label={t.shareClose} onClick={onClose} />
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-3xl border border-gold/60 bg-parchment shadow-xl lg:inset-y-0 lg:right-0 lg:bottom-auto lg:left-auto lg:h-full lg:max-h-none lg:w-[22rem] lg:rounded-none lg:rounded-l-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-pine/10 px-4 py-3">
          <h2 id={titleId} className="font-display text-xl font-bold text-pine">
            {title}
          </h2>
          <Button variant="ghost" onClick={onClose}>
            {t.shareClose}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Settings for every Qur'an page. The control lives in the top bar and the options open under it. */
export function HeaderSettingsMenu({
  open,
  onOpenChange,
  mode,
  textSize,
  onTextSize,
  translationSize,
  onTranslationSize,
  reciter,
  onReciter,
  reciters,
  onMode,
  editions,
  editionKey,
  onEdition,
  editionsError,
  onQuiet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'library' | 'study' | 'book';
  textSize: 'sm' | 'md' | 'lg';
  onTextSize: (size: 'sm' | 'md' | 'lg') => void;
  translationSize: 'sm' | 'md' | 'lg';
  onTranslationSize: (size: 'sm' | 'md' | 'lg') => void;
  reciter: string;
  onReciter: (id: string) => void;
  reciters: { id: string; name: string }[];
  onMode?: (mode: 'study' | 'book') => void;
  editions: QuranEncEdition[];
  editionKey: string;
  onEdition: (key: string) => void;
  editionsError: string | null;
  onQuiet?: () => void;
}) {
  const { t } = useApp();
  const { focus } = useShell();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const buttonWrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number; width: number } | null>(null);
  const edition = editions.find(item => item.key === editionKey);
  const editionReady = Boolean(edition && editions.some(item => item.key === editionKey));
  const sizeSelect = (value: 'sm' | 'md' | 'lg', onChange: (size: 'sm' | 'md' | 'lg') => void, id: string) => (
    <select id={id} value={value} onChange={event => onChange(event.target.value as 'sm' | 'md' | 'lg')} className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm font-normal text-ink">
      <option value="sm">A</option>
      <option value="md">A+</option>
      <option value="lg">A++</option>
    </select>
  );

  useLayoutEffect(() => {
    const pick = () => {
      const nodes = ['kf-library-settings', 'kf-library-settings-mobile']
        .map(id => document.getElementById(id))
        .filter((node): node is HTMLElement => node instanceof HTMLElement);
      setSlot(nodes.find(node => node.getClientRects().length > 0) ?? null);
    };
    pick();
    window.addEventListener('resize', pick);
    return () => window.removeEventListener('resize', pick);
  }, [focus]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonWrapRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const margin = 12;
      const width = Math.min(352, window.innerWidth - margin * 2);
      const preferredRight = window.innerWidth - rect.right;
      const right = Math.min(Math.max(preferredRight, margin), window.innerWidth - margin - width);
      setAnchor({ top: rect.bottom + 8, right, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, slot]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonWrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
      buttonWrapRef.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => {
      const field = document.getElementById('kf-quran-edition');
      if (field instanceof HTMLElement) field.focus();
    }, 0);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [open, onOpenChange]);

  const button = (
    <div ref={buttonWrapRef} className="w-fit">
      <Button
        id="kf-settings-button"
        variant="soft"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? 'kf-reading-settings' : undefined}
        onClick={() => onOpenChange(!open)}
      >
        {t.settings}
      </Button>
    </div>
  );
  const panel =
    open && anchor
      ? createPortal(
          <div
            ref={panelRef}
            id="kf-reading-settings"
            role="dialog"
            aria-modal="false"
            aria-labelledby="kf-reading-settings-title"
            style={{ top: anchor.top, right: anchor.right, width: anchor.width }}
            className="fixed z-50 max-h-[min(32rem,70dvh)] overflow-y-auto rounded-2xl border border-pine/10 bg-parchment p-4 shadow-xl"
          >
            <h2 id="kf-reading-settings-title" className="font-display text-lg font-bold text-pine">
              {t.readingSettings}
            </h2>
            <div className="mt-3 grid gap-3">
              <div className="flex flex-col gap-1 text-xs font-medium text-muted">
                <label className="flex flex-col gap-1">
                  {t.editionLabel}
                  {editionReady ? (
                    <select id="kf-quran-edition" value={editionKey} onChange={event => onEdition(event.target.value)} className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm font-normal text-ink">
                      {editions.map(item => (
                        <option key={item.key} value={item.key}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span id="kf-quran-edition" className="rounded-xl border border-pine/10 bg-sand px-3 py-2 text-sm font-normal text-ink">
                      {editionsError || t.quranEncLoading}
                    </span>
                  )}
                </label>
                {edition && (
                  <p className="font-normal leading-relaxed">
                    {edition.key} · {edition.version}
                  </p>
                )}
              </div>
              {onMode && (
                <div className="flex flex-col gap-1 text-xs font-medium text-muted">
                  {t.readingMode}
                  <div className="flex flex-wrap gap-2">
                    <Button variant={mode === 'study' ? 'primary' : 'soft'} onClick={() => onMode('study')} aria-pressed={mode === 'study'}>
                      {t.quranAyahStudy}
                    </Button>
                    <Button variant={mode === 'book' ? 'primary' : 'soft'} onClick={() => onMode('book')} aria-pressed={mode === 'book'}>
                      {t.quranRead}
                    </Button>
                  </div>
                </div>
              )}
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                {t.reciter}
                <select id="kf-reciter" value={reciter} onChange={event => onReciter(event.target.value)} className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm text-ink">
                  {reciters.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                {t.arabicSize}
                {sizeSelect(textSize, onTextSize, 'kf-text-size')}
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                {t.translationSize}
                {sizeSelect(translationSize, onTranslationSize, 'kf-translation-size')}
              </label>
              <PronunciationControl />
              {onQuiet && (
                <Button variant="soft" onClick={onQuiet}>
                  {t.focusReading}
                </Button>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  if (!slot) return panel;
  return (
    <>
      {createPortal(button, slot)}
      {panel}
    </>
  );
}

export function SettingsDrawer({
  open,
  onClose,
  textSize,
  onTextSize,
  translationSize,
  onTranslationSize,
  reciter,
  onReciter,
  reciters,
  editions,
  editionKey,
  onEdition,
  editionsError,
  onQuiet,
}: {
  open: boolean;
  onClose: () => void;
  textSize: 'sm' | 'md' | 'lg';
  onTextSize: (size: 'sm' | 'md' | 'lg') => void;
  translationSize: 'sm' | 'md' | 'lg';
  onTranslationSize: (size: 'sm' | 'md' | 'lg') => void;
  reciter: string;
  onReciter: (id: string) => void;
  reciters: { id: string; name: string }[];
  editions: QuranEncEdition[];
  editionKey: string;
  onEdition: (key: string) => void;
  editionsError: string | null;
  onQuiet?: () => void;
}) {
  const { t } = useApp();
  const edition = editions.find(item => item.key === editionKey);
  const editionReady = Boolean(edition && editions.some(item => item.key === editionKey));
  const sizeSelect = (value: 'sm' | 'md' | 'lg', onChange: (size: 'sm' | 'md' | 'lg') => void, id: string) => (
    <select id={id} value={value} onChange={event => onChange(event.target.value as 'sm' | 'md' | 'lg')} className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm font-normal text-ink">
      <option value="sm">A</option>
      <option value="md">A+</option>
      <option value="lg">A++</option>
    </select>
  );
  return (
    <OverlaySheet open={open} onClose={onClose} id="kf-reading-settings" title={t.readingSettings} focusSelector="#kf-quran-edition">
      <div className="grid gap-4">
        <div className="flex flex-col gap-1 text-xs font-medium text-muted">
          <label className="flex flex-col gap-1">
            {t.editionLabel}
            {editionReady ? (
              <select id="kf-quran-edition" value={editionKey} onChange={event => onEdition(event.target.value)} className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm font-normal text-ink">
                {editions.map(item => (
                  <option key={item.key} value={item.key}>
                    {item.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-xl border border-pine/10 bg-sand px-3 py-2 text-sm font-normal text-ink">{editionsError || t.quranEncLoading}</span>
            )}
          </label>
          {edition && (
            <p className="font-normal leading-relaxed">
              {edition.key} · {edition.version}
            </p>
          )}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          {t.reciter}
          <select id="kf-reciter" value={reciter} onChange={event => onReciter(event.target.value)} className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm text-ink">
            {reciters.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          {t.arabicSize}
          {sizeSelect(textSize, onTextSize, 'kf-text-size')}
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          {t.translationSize}
          {sizeSelect(translationSize, onTranslationSize, 'kf-translation-size')}
        </label>
        <PronunciationControl />
        {onQuiet && (
          <Button variant="soft" onClick={onQuiet}>
            {t.focusReading}
          </Button>
        )}
      </div>
    </OverlaySheet>
  );
}

export function AudioMiniPlayer({ safe }: { safe: boolean }) {
  const { t, lang } = useApp();
  const audio = useAudioState();
  if (!audio.id || audio.status === 'idle') return null;
  const meaning = Boolean(audio.id.startsWith('meaning-'));
  const active = audio.status === 'playing' || audio.status === 'loading';
  const isLoading = audio.status === 'loading';
  return (
    <div
      data-mini-player
      className={`fixed right-0 left-0 z-30 shrink-0 border-t border-gold/40 bg-[#04241C] px-4 py-2.5 text-[#F5EEDC] shadow-lg lg:left-72 ${
        safe ? 'bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'bottom-[56px]'
      }`}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="min-w-0 flex items-center gap-2 text-sm leading-snug">
          {isLoading && <AudioLoadingSpinner size={15} className="text-[#D4AF37]" />}
          <span>{audioStatusLabel(t, audio.status, audio.id)}</span>
        </p>
        <Button variant="soft" onClick={active ? pauseAudio : resumeAudio}>
          {isLoading ? (
            <>
              <AudioLoadingSpinner size={14} />
              <span>{loadingAudioLabel(lang)}</span>
            </>
          ) : active ? (
            t.pause
          ) : meaning ? (
            t.playMeaning
          ) : (
            t.play
          )}
        </Button>
      </div>
    </div>
  );
}

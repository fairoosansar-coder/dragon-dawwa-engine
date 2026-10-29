import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Check, ChevronDown, Globe, Search, Settings } from 'lucide-react';
import { getJson, useRemote } from '../../lib/api.ts';
import { useApp } from '../../lib/store.tsx';
import type { TextSize } from '../../lib/readingPlace.ts';
import { parseReadingJump } from '../../shared/readingNav.ts';
import { LANGS, LANGUAGE_NAMES, toLang, type Lang } from '../../shared/sources.ts';
import type { SurahInfo } from '../../shared/types.ts';

type Panel = 'surah' | 'page' | 'search' | 'language' | 'settings';

export function ReadingBar({
  surah,
  englishName,
  page,
  juz,
  hizb,
  verseByVerse,
  onVerseByVerse,
  openSettings = 0,
  textSize,
  onTextSize,
  translationSize,
  onTranslationSize,
  reciter,
  onReciter,
  reciters,
  onPlace,
  translator,
  showTranslation,
  onTranslation,
  onOpenTranslations,
}: {
  surah: number;
  englishName: string;
  page: number | null;
  juz: number | null;
  hizb: number | null;
  verseByVerse: boolean;
  onVerseByVerse: (show: boolean) => void;
  openSettings?: number;
  textSize: TextSize;
  onTextSize: (size: TextSize) => void;
  translationSize: TextSize;
  onTranslationSize: (size: TextSize) => void;
  reciter: string;
  onReciter: (id: string) => void;
  reciters: { id: string; name: string; style?: string }[];
  onPlace: (surah: number, ayah: number) => void;
  translator: string;
  showTranslation: boolean;
  onTranslation: (show: boolean) => void;
  onOpenTranslations: () => void;
}) {
  const { t, lang, setLang } = useApp();
  const surahs = useRemote<SurahInfo[]>('/api/quran/surahs');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [pageDraft, setPageDraft] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const barRef = useRef<HTMLDivElement>(null);
  const catalogue = surahs.data ?? [];

  useEffect(() => {
    if (openSettings > 0) setPanel('settings');
  }, [openSettings]);

  useEffect(() => {
    if (!panel) return;
    const onPointer = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setPanel(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [panel]);

  const toggle = (next: Panel) => {
    setNotice('');
    setPanel(current => (current === next ? null : next));
  };

  const goMark = async (kind: 'page' | 'juz', value: number) => {
    setNotice('');
    try {
      const mark = await getJson<{ surah: number; ayah: number }>(`/api/quran/${kind}/${value}`);
      if (!Number.isInteger(mark.surah) || !Number.isInteger(mark.ayah)) {
        setNotice(t.barSearchMiss);
        return;
      }
      onPlace(mark.surah, mark.ayah);
      setPanel(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.barSearchMiss);
    }
  };

  const runSearch = async () => {
    const jump = parseReadingJump(query, catalogue);
    if (!jump) {
      setNotice(t.barSearchMiss);
      return;
    }
    if (jump.kind === 'page') return goMark('page', jump.page);
    if (jump.kind === 'juz') return goMark('juz', jump.juz);
    onPlace(jump.surah, jump.kind === 'verse' ? jump.ayah : 1);
    setPanel(null);
  };

  const placeLabel =
    page != null && juz != null && hizb != null ? `${t.sheetPage} ${page} · ${t.sheetJuz} ${juz} / ${t.sheetHizb} ${hizb}` : '';

  const sizeSelect = (value: TextSize, onChange: (size: TextSize) => void, id: string) => (
    <select id={id} value={value} onChange={event => onChange(event.target.value as TextSize)} className="rounded-xl border border-pine/20 bg-parchment px-3 py-2 text-sm text-ink">
      <option value="sm">A</option>
      <option value="md">A+</option>
      <option value="lg">A++</option>
    </select>
  );

  return (
    <div ref={barRef} data-reading-bar className="reading-bar sticky top-0 z-30 -mx-1 shrink-0 border-b border-[#d5deea] bg-sand px-1 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-surah-control
          aria-expanded={panel === 'surah'}
          className="inline-flex items-center gap-2 rounded-lg border border-[#c5d0de] bg-white px-3 py-1.5 text-sm font-medium text-[#1c3d66]"
          onClick={() => toggle('surah')}
        >
          {surah}. {englishName}
          <span aria-hidden className="text-xs">
            ▾
          </span>
        </button>
        <button
          type="button"
          data-page-chip
          aria-expanded={panel === 'page'}
          disabled={!placeLabel}
          className="inline-flex items-center gap-2 rounded-lg border border-[#c5d4e4] bg-[#eef3f8] px-3 py-1.5 text-sm text-[#1c3d66] disabled:opacity-50"
          onClick={() => toggle('page')}
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden />
          {placeLabel}
        </button>
        <div className="flex rounded-full border border-[#c5d0de] bg-white p-0.5" role="group" aria-label={t.readingMode}>
          <button
            type="button"
            data-reading-mode="verse"
            aria-pressed={verseByVerse}
            className={`rounded-full px-3 py-1 text-sm ${verseByVerse ? 'bg-[#10233f] text-white' : 'text-[#1c3d66]'}`}
            onClick={() => onVerseByVerse(true)}
          >
            {t.sheetVerseByVerse}
          </button>
          <button
            type="button"
            data-reading-mode="reading"
            aria-pressed={!verseByVerse}
            className={`rounded-full px-3 py-1 text-sm ${!verseByVerse ? 'bg-[#10233f] text-white' : 'text-[#1c3d66]'}`}
            onClick={() => onVerseByVerse(false)}
          >
            {t.sheetReading}
          </button>
        </div>
        <div className={`inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-sm ${showTranslation ? 'bg-[#10233f] text-white' : 'border border-[#c5d0de] bg-white text-[#1c3d66]'}`}>
          <button type="button" data-translation-pill aria-pressed={showTranslation} onClick={() => onTranslation(!showTranslation)} className="min-w-0 text-left leading-tight">
            {translator || t.sheetTranslation}
          </button>
          <button type="button" data-translation-open aria-label={t.menuTranslations} onClick={onOpenTranslations} className="shrink-0">
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1" data-reading-cluster>
          <IconButton label={t.barSearch} pressed={panel === 'search'} onClick={() => toggle('search')} id="kf-reading-search">
            <Search className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton label={t.barLanguage} pressed={panel === 'language'} onClick={() => toggle('language')} id="kf-reading-language">
            <Globe className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton label={t.settings} pressed={panel === 'settings'} onClick={() => toggle('settings')} id="kf-reading-settings-button">
            <Settings className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      {panel === 'surah' && (
        <ul data-surah-list className="absolute z-30 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl border border-[#d5deea] bg-white py-1 shadow-lg">
          {catalogue.map(item => (
            <li key={item.number}>
              <button
                type="button"
                className={`block w-full px-3 py-1.5 text-left text-sm ${item.number === surah ? 'bg-[#e7eef6] font-medium text-[#1c3d66]' : 'text-ink'}`}
                onClick={() => {
                  onPlace(item.number, 1);
                  setPanel(null);
                }}
              >
                {item.number}. {item.englishName}
              </button>
            </li>
          ))}
        </ul>
      )}

      {panel === 'page' && (
        <form
          data-page-jump
          className="absolute z-30 mt-2 w-56 rounded-xl border border-[#d5deea] bg-white p-3 shadow-lg"
          onSubmit={event => {
            event.preventDefault();
            const value = Number(pageDraft);
            if (!Number.isInteger(value)) {
              setNotice(t.barSearchMiss);
              return;
            }
            void goMark('page', value);
          }}
        >
          <label className="block text-xs font-medium text-muted">
            {t.barJumpPage}
            <input
              value={pageDraft}
              onChange={event => setPageDraft(event.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-pine/20 px-2 py-1.5 text-sm"
            />
          </label>
          {notice && <p className="mt-2 text-xs text-pine">{notice}</p>}
        </form>
      )}

      {panel === 'search' && (
        <form
          data-reading-search
          className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-[#d5deea] bg-white p-3 shadow-lg"
          onSubmit={event => {
            event.preventDefault();
            void runSearch();
          }}
        >
          <label className="block text-xs font-medium text-muted">
            {t.barSearch}
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t.barSearchHint}
              className="mt-1 w-full rounded-lg border border-pine/20 px-2 py-1.5 text-sm"
            />
          </label>
          <p className="mt-2 text-xs text-muted">{t.barSearchHint}</p>
          {notice && <p className="mt-2 text-xs text-pine">{notice}</p>}
        </form>
      )}

      {panel === 'language' && (
        <div data-reading-language-panel className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-[#d5deea] bg-white p-3 shadow-lg">
          <label className="block text-xs font-medium text-muted">
            {t.language}
            <select
              value={lang}
              onChange={event => setLang(toLang(event.target.value) as Lang)}
              className="mt-1 w-full rounded-lg border border-pine/20 px-2 py-1.5 text-sm text-ink"
            >
              {LANGS.map(code => (
                <option key={code} value={code}>
                  {LANGUAGE_NAMES[code].english}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {panel === 'settings' && (
        <div data-reading-settings data-reciter-list className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-[#d5deea] bg-white p-3 shadow-lg">
          <h2 className="text-sm font-semibold text-[#1a2744]">{t.selectReciter}</h2>
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {reciters.map(item => {
              const selected = item.id === reciter;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-reciter={item.id}
                    aria-pressed={selected}
                    onClick={() => onReciter(item.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-[#eef3f8]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">{item.name}</span>
                      {item.style ? <span className="block text-xs text-muted">{item.style}</span> : null}
                    </span>
                    {selected ? <Check className="h-4 w-4 shrink-0 text-[#1c3d66]" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 grid gap-2 border-t border-[#e6e8eb] pt-3">
            <label className="text-xs font-medium text-muted">
              {t.arabicSize}
              {sizeSelect(textSize, onTextSize, 'kf-text-size')}
            </label>
            <label className="text-xs font-medium text-muted">
              {t.translationSize}
              {sizeSelect(translationSize, onTranslationSize, 'kf-translation-size')}
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  pressed,
  onClick,
  id,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  id: string;
  children: ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${pressed ? 'bg-[#e7eef6] text-[#1c3d66]' : 'text-[#1c3d66] hover:bg-[#eef3f8]'}`}
    >
      {children}
    </button>
  );
}

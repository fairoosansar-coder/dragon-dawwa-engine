import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import type { ViewProps } from '../App.tsx';
import { ChevronLeft, ChevronRight, ListMusic, Pause } from 'lucide-react';
import { recitationUrl, QURAN_TRANSLATIONS } from '../shared/sources.ts';
import type { SurahInfo, Verse } from '../shared/types.ts';
import { useRemote } from '../lib/api.ts';
import { pauseAudio, playAudio, useAudioState } from '../lib/audio.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { useReciter, VerseCard } from '../components/cards.tsx';
import { Button, Card, ErrorNote, IconButton, Loading, Select, TabLinks } from '../components/ui.tsx';

const QuranStudyEdition = lazy(() => import('../engine/QuranStudyEdition.tsx'));

export default function QuranReader({ sub }: ViewProps) {
  const { t } = useApp();
  const study = sub === 'study';
  return (
    <>
      <TabLinks
        label={t.navQuran}
        tabs={[
          { href: '#/quran', label: t.quranSimple, active: !study },
          { href: '#/quran/study', label: t.quranStudy, active: study },
        ]}
      />
      {study ? (
        <Suspense fallback={<Loading />}>
          <QuranStudyEdition />
        </Suspense>
      ) : (
        <SimpleReader />
      )}
    </>
  );
}

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

function SimpleReader() {
  const { t, lang, config } = useApp();
  const [surah, setSurah] = useStored<number>('kf-last-surah', 1);
  const [query, setQuery] = useState('');
  const [reciter, setReciter] = useReciter();
  const audio = useAudioState();
  const surahs = useRemote<SurahInfo[]>('/api/quran/surahs');
  const reader = useRemote<{ info: SurahInfo; verses: Verse[] }>(`/api/quran/surah/${surah}?lang=${lang}`);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (surahs.data ?? []).filter(
      s => !q || String(s.number) === q || s.englishName.toLowerCase().includes(q) || s.englishNameTranslation.toLowerCase().includes(q) || s.name.includes(q),
    );
  }, [surahs.data, query]);

  const verses = reader.data?.verses ?? [];
  const playingInSurah = audio.playing && verses.some(v => `ayah-${v.number}` === audio.id);

  const playFrom = useCallback(
    (index: number) => {
      const verse = verses[index];
      if (!verse) return;
      document.getElementById(`v-${verse.key.replace(':', '-')}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      void playAudio(`ayah-${verse.number}`, recitationUrl(reciter, verse.number), () => playFrom(index + 1));
    },
    [verses, reciter],
  );

  const go = (n: number) => {
    pauseAudio();
    setSurah(Math.min(Math.max(n, 1), 114));
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:overflow-hidden lg:p-4">
        <h2 className="font-display text-xl font-bold text-pine">{t.surahs}</h2>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t.searchSurah}
          aria-label={t.searchSurah}
          className="mt-3 w-full rounded-full border border-pine/20 bg-white px-4 py-2 text-sm"
        />
        {surahs.loading && <Loading />}
        {surahs.error && <ErrorNote message={surahs.error} onRetry={surahs.reload} />}
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-16rem)]">
          {filtered.map(s => (
            <li key={s.number}>
              <button
                type="button"
                onClick={() => go(s.number)}
                aria-current={s.number === surah ? 'true' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${s.number === surah ? 'bg-pine text-white' : 'hover:bg-mint'}`}
              >
                <span className="w-7 text-xs opacity-70">{s.number}</span>
                <span className="flex-1">
                  <span className="block font-medium">{s.englishName}</span>
                  <span className="block text-xs opacity-70">{s.englishNameTranslation}</span>
                </span>
                <span lang="ar" className="font-[family-name:var(--font-arabic)] text-base">
                  {s.name.replace('سُورَةُ ', '')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-pine/10 pb-4">
          <div>
            {reader.data && (
              <>
                <p className="text-xs uppercase tracking-widest text-ink/50">
                  {reader.data.info.number} · {reader.data.info.revelationType} · {reader.data.info.numberOfAyahs}
                </p>
                <h1 className="font-display text-3xl font-bold text-pine">{reader.data.info.englishName}</h1>
                <p className="text-sm text-ink/60">{reader.data.info.englishNameTranslation}</p>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label={t.reciter}
              value={reciter}
              onChange={v => {
                pauseAudio();
                setReciter(v);
              }}
              options={(config?.reciters ?? [{ id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' }]).map(r => ({ value: r.id, label: r.name }))}
            />
            <Button onClick={() => (playingInSurah ? pauseAudio() : playFrom(0))} disabled={!verses.length}>
              {playingInSurah ? <Pause className="h-4 w-4" aria-hidden /> : <ListMusic className="h-4 w-4" aria-hidden />}
              {playingInSurah ? t.pause : t.play}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink/50">
          {t.translation}: {QURAN_TRANSLATIONS[lang].translator}
        </p>

        {reader.loading && <Loading />}
        {reader.error && (
          <div className="mt-4">
            <ErrorNote message={reader.error} onRetry={reader.reload} />
          </div>
        )}
        {reader.data && surah !== 1 && surah !== 9 && (
          <p lang="ar" className="arabic mt-6 text-center text-3xl text-pine" style={{ textAlign: 'center' }}>
            {BISMILLAH}
          </p>
        )}
        <div>
          {verses.map((v, i) => (
            <VerseCard key={v.key} verse={v} onEnded={() => playFrom(i + 1)} />
          ))}
        </div>

        <nav className="mt-6 flex items-center justify-between" aria-label="Surah navigation">
          <IconButton label="Previous surah" onClick={() => go(surah - 1)} disabled={surah <= 1}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <span className="text-sm text-ink/60">{surah} / 114</span>
          <IconButton label="Next surah" onClick={() => go(surah + 1)} disabled={surah >= 114}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </nav>
      </Card>
    </div>
  );
}

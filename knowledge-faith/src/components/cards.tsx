import { Bookmark, BookmarkCheck, Pause, Play } from 'lucide-react';
import { recitationUrl } from '../shared/sources.ts';
import type { Evidence, Hadith, Verse } from '../shared/types.ts';
import { pauseAudio, playAudio, useAudioState } from '../lib/audio.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { confirmedMeaningSrc, meaningPlaybackId } from '../shared/quranenc.ts';
import { Button, IconButton } from './ui.tsx';

export function useReciter() {
  return useStored<string>('kf-reciter', 'ar.alafasy');
}

export function VerseCard({
  verse,
  onEnded,
  compact,
  scale = 'md',
  selected = false,
  cite = true,
  onMeaning,
  meaningNote,
  playback = true,
}: {
  verse: Verse;
  onEnded?: () => void;
  compact?: boolean;
  scale?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  cite?: boolean;
  /** Study keeps one shared player. Bookmark stays on the verse. */
  playback?: boolean;
  /** A function plays this edition's listed file. Null hides the control. Omit to use the verse payload. */
  onMeaning?: (() => void) | null;
  meaningNote?: string | null;
}) {
  const { t, toggleVerse, isVerseSaved } = useApp();
  const [reciter] = useReciter();
  const audio = useAudioState();
  const id = `ayah-${verse.number}`;
  const active = audio.id === id && audio.playing;
  const saved = isVerseSaved(verse.key);
  const meaningSrc = confirmedMeaningSrc(verse);
  const meaningKey = verse.translationKey;
  const meaningAction = onMeaning === undefined ? (meaningSrc && meaningKey ? () => playAudio(meaningPlaybackId(meaningKey, verse.surah, verse.ayah), meaningSrc) : null) : onMeaning;

  return (
    <article
      id={`v-${verse.key.replace(':', '-')}`}
      className={`border-b border-pine/10 last:border-0 ${compact ? 'py-3' : 'py-7 sm:py-8'} ${selected ? 'rounded-2xl bg-gold/15 px-3' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-pine">
          {verse.surahName} · {verse.key}
        </span>
        <div className="flex">
          {playback && (
            <IconButton
              label={active ? t.pause : t.play}
              onClick={() => (active ? pauseAudio() : playAudio(id, recitationUrl(reciter, verse.number), onEnded))}
            >
              {active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </IconButton>
          )}
          <IconButton label={saved ? t.unsave : t.save} aria-pressed={saved} onClick={() => toggleVerse(verse.key)}>
            {saved ? <BookmarkCheck className="h-4 w-4 text-gold" /> : <Bookmark className="h-4 w-4" />}
          </IconButton>
        </div>
      </div>
      <p lang="ar" className={`arabic text-ink ${compact ? 'text-2xl' : scale === 'lg' ? 'text-4xl' : scale === 'sm' ? 'text-2xl' : 'text-3xl'}`}>
        {verse.arabic}
      </p>
      {verse.transliteration && (
        <p lang="en" className="mt-2 text-sm leading-relaxed text-ink/80">
          <span className="font-semibold text-pine">{t.pronunciation}. </span>
          {verse.transliteration}
        </p>
      )}
      {verse.translation.trim() ? (
        <p lang={verse.lang} className={`mt-4 max-w-prose leading-8 text-ink/90 ${scale === 'lg' ? 'text-xl' : scale === 'sm' ? 'text-base' : 'text-lg'}`}>
          {verse.translation}
        </p>
      ) : verse.translationKey ? (
        <p className="mt-2 text-sm text-muted" role="status">
          {t.verseTranslationUnavailable}
        </p>
      ) : null}
      {verse.footnotes ? (
        <details className="mt-2 rounded-xl border border-pine/10 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-muted">{t.footnotes}</summary>
          <p lang={verse.lang} className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/70">
            {verse.footnotes}
          </p>
        </details>
      ) : null}
      {cite && (
        <div className="mt-1 space-y-1 text-xs text-ink/50">
          <p>
            {verse.translationTitle || verse.translator}
            {verse.translationKey ? ` · ${verse.translationKey}` : ''}
            {verse.translationVersion ? ` · ${verse.translationVersion}` : ''}
          </p>
          {verse.translationDescription ? <p className="leading-relaxed">{verse.translationDescription}</p> : null}
        </div>
      )}
      {meaningAction && (
        <Button variant="ghost" className="mt-2" onClick={meaningAction}>
          {t.listenMeaning}
        </Button>
      )}
      {meaningNote ? (
        <p className="mt-2 text-sm text-muted" role="status">
          {meaningNote}
        </p>
      ) : null}
    </article>
  );
}

export function GradeList({ grades }: { grades: { name: string; grade: string }[] }) {
  const { t } = useApp();
  if (!grades.length) return <p className="text-xs text-ink/50">{t.noGrades}</p>;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t.grades}>
      {grades.map(g => (
        <li key={g.name} className="rounded-full border border-pine/15 px-3 py-1 text-xs">
          <span className="font-semibold text-pine">{g.grade}</span> <span className="text-ink/60">— {g.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function HadithCard({ hadith }: { hadith: Hadith }) {
  const { t, lang, toggleHadith, isHadithSaved } = useApp();
  const ref = { collection: hadith.collection, number: hadith.number };
  const saved = isHadithSaved(ref);
  return (
    <article className="border-b border-pine/10 py-5 last:border-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-pine">
          {hadith.collectionName} · {hadith.number}
        </span>
        <IconButton label={saved ? t.unsave : t.save} aria-pressed={saved} onClick={() => toggleHadith(ref)}>
          {saved ? <BookmarkCheck className="h-4 w-4 text-gold" /> : <Bookmark className="h-4 w-4" />}
        </IconButton>
      </div>
      {hadith.arabic && (
        <details className="mb-2">
          <summary className="cursor-pointer text-xs font-medium text-pine">العربية</summary>
          <p lang="ar" className="arabic mt-1 text-xl text-ink">
            {hadith.arabic}
          </p>
        </details>
      )}
      <p lang={hadith.lang} className="leading-relaxed text-ink/90">
        {hadith.text}
      </p>
      {hadith.machineTranslation && <p className="mt-1 text-xs text-pine">{t.machineHadithShort}</p>}
      {!hadith.machineTranslation && hadith.lang !== lang && <p className="mt-1 text-xs text-pine">{t.fallbackEnglish}</p>}
      <div className="mt-3">
        <GradeList grades={hadith.grades} />
      </div>
    </article>
  );
}

export function EvidenceList({ evidence, cited, focusIds }: { evidence: Evidence[]; cited?: Set<string>; focusIds?: Set<string> }) {
  return (
    <ol className="space-y-3">
      {evidence.map(e => (
        <li
          key={e.id}
          id={`ev-${e.id}`}
          data-focus={focusIds?.has(e.id) ? 'true' : undefined}
          className={`rounded-2xl border p-4 ${focusIds?.has(e.id) ? 'border-pine bg-white ring-2 ring-pine/30' : cited && !cited.has(e.id) ? 'border-pine/10 opacity-70' : 'border-pine/20 bg-white'}`}
        >
          <p className="text-xs font-semibold text-pine">
            [{e.id}] {e.label}
          </p>
          {e.locator && <p className="mt-1 text-xs text-muted">{e.locator}</p>}
          {e.arabic && (
            <p lang="ar" className="arabic mt-1 line-clamp-4 text-xl">
              {e.arabic}
            </p>
          )}
          <p className="mt-1 text-sm leading-relaxed" lang={e.passageLanguage ?? undefined}>
            {e.text}
          </p>
          <p className="mt-1 text-xs text-ink/50">{e.attribution}</p>
          {e.sourceUrl && (
            <a className="mt-2 inline-block text-xs text-pine underline" href={e.sourceUrl} target="_blank" rel="noreferrer">
              {e.sourceUrl}
            </a>
          )}
          {e.kind === 'hadith' && (
            <div className="mt-2">
              <GradeList grades={e.grades} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

export function CitationChips({ ids }: { ids: string[] }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {ids.map(id => (
        <button
          key={id}
          type="button"
          onClick={() => document.getElementById(`ev-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          className="rounded-md bg-mint px-1.5 text-xs font-semibold text-pine hover:underline"
        >
          {id}
        </button>
      ))}
    </span>
  );
}

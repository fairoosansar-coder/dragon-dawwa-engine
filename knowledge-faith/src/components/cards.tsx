import { Bookmark, BookmarkCheck, Pause, Play } from 'lucide-react';
import { recitationUrl } from '../shared/sources.ts';
import type { Evidence, Hadith, Verse } from '../shared/types.ts';
import { pauseAudio, playAudio, useAudioState } from '../lib/audio.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { IconButton } from './ui.tsx';

export function useReciter() {
  return useStored<string>('kf-reciter', 'ar.alafasy');
}

export function VerseCard({
  verse,
  onEnded,
  compact,
  scale = 'md',
}: {
  verse: Verse;
  onEnded?: () => void;
  compact?: boolean;
  scale?: 'sm' | 'md' | 'lg';
}) {
  const { t, toggleVerse, isVerseSaved } = useApp();
  const [reciter] = useReciter();
  const audio = useAudioState();
  const id = `ayah-${verse.number}`;
  const active = audio.id === id && audio.playing;
  const saved = isVerseSaved(verse.key);

  return (
    <article id={`v-${verse.key.replace(':', '-')}`} className={`border-b border-pine/10 last:border-0 ${compact ? 'py-3' : 'py-5'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-pine">
          {verse.surahName} · {verse.key}
        </span>
        <div className="flex">
          <IconButton
            label={active ? t.pause : t.play}
            onClick={() => (active ? pauseAudio() : playAudio(id, recitationUrl(reciter, verse.number), onEnded))}
          >
            {active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </IconButton>
          <IconButton label={saved ? t.unsave : t.save} aria-pressed={saved} onClick={() => toggleVerse(verse.key)}>
            {saved ? <BookmarkCheck className="h-4 w-4 text-gold" /> : <Bookmark className="h-4 w-4" />}
          </IconButton>
        </div>
      </div>
      <p lang="ar" className={`arabic text-ink ${compact ? 'text-2xl' : scale === 'lg' ? 'text-4xl' : scale === 'sm' ? 'text-2xl' : 'text-3xl'}`}>
        {verse.arabic}
      </p>
      <p lang={verse.lang} className={`mt-2 leading-relaxed text-ink/90 ${scale === 'lg' ? 'text-lg' : scale === 'sm' ? 'text-sm' : ''}`}>
        {verse.translation}
      </p>
      <p className="mt-1 text-xs text-ink/50">{verse.translator}</p>
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

export function EvidenceList({ evidence, cited }: { evidence: Evidence[]; cited?: Set<string> }) {
  return (
    <ol className="space-y-3">
      {evidence.map(e => (
        <li
          key={e.id}
          id={`ev-${e.id}`}
          className={`rounded-2xl border p-4 ${cited && !cited.has(e.id) ? 'border-pine/10 opacity-70' : 'border-pine/20 bg-white'}`}
        >
          <p className="text-xs font-semibold text-pine">
            [{e.id}] {e.label}
          </p>
          {e.arabic && (
            <p lang="ar" className="arabic mt-1 line-clamp-4 text-xl">
              {e.arabic}
            </p>
          )}
          <p className="mt-1 text-sm leading-relaxed">{e.text}</p>
          <p className="mt-1 text-xs text-ink/50">{e.attribution}</p>
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

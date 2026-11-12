import { useState } from 'react';
import { Bookmark, BookmarkCheck, Check, Pause, Play, Send, Share2, Sparkles } from 'lucide-react';
import { segmentHadithRecord } from '../shared/hadithSegmentation.ts';
import { recitationUrl } from '../shared/sources.ts';
import type { Evidence, Hadith, Verse } from '../shared/types.ts';
import { pauseAudio, playAudio, resumeAudio, useAudioState } from '../lib/audio.ts';
import { useApp, useStored } from '../lib/store.tsx';
import { publishFaithWallPost, WALL_THEMES, type WallPostTheme } from '../lib/verseShare.ts';
import { confirmedMeaningSrc, meaningPlaybackId } from '../shared/quranenc.ts';
import { HadithVoiceBar } from './HadithVoiceBar.tsx';
import { ThemeSwatches } from './wall/ReflectionModal.tsx';
import { IconButton } from './ui.tsx';

export function useReciter() {
  return useStored<string>('kf-reciter', 'ar.alafasy');
}

export function VerseCard({
  verse,
  onEnded,
  compact,
  scale = 'md',
  translationScale,
  selected = false,
  cite = true,
  onMeaning,
  meaningNote,
  playback = true,
  showArabic = true,
  showTranslation = true,
}: {
  verse: Verse;
  onEnded?: () => void;
  compact?: boolean;
  scale?: 'sm' | 'md' | 'lg';
  /** Translation size. Falls back to the Arabic scale when omitted. */
  translationScale?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  cite?: boolean;
  /** Study keeps one shared player. Bookmark stays on the verse. */
  playback?: boolean;
  /** A function plays this edition's listed file. Null hides the control. Omit to use the verse payload. */
  onMeaning?: (() => void) | null;
  meaningNote?: string | null;
  showArabic?: boolean;
  showTranslation?: boolean;
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
  const meaningId = meaningKey ? meaningPlaybackId(meaningKey, verse.surah, verse.ayah) : '';
  const meaningBusy = Boolean(meaningId) && audio.id === meaningId && (audio.status === 'playing' || audio.status === 'loading');
  const meaningPaused = Boolean(meaningId) && audio.id === meaningId && audio.status === 'paused';
  const body = translationScale ?? scale;

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
      {showArabic && (
        <p lang="ar" className={`arabic text-ink ${compact ? 'text-2xl' : scale === 'lg' ? 'text-4xl' : scale === 'sm' ? 'text-2xl' : 'text-3xl'}`}>
          {verse.arabic}
        </p>
      )}
      {showArabic && verse.transliteration && (
        <p lang="en" className="mt-2 text-sm leading-relaxed text-ink/80">
          <span className="font-semibold text-pine">{t.pronunciation}. </span>
          {verse.transliteration}
        </p>
      )}
      {showTranslation && verse.translation.trim() ? (
        <div className="mt-4 flex items-start gap-1">
          {meaningAction && (
            <IconButton
              className="mt-1 shrink-0"
              label={meaningBusy ? t.pause : t.playMeaning}
              onClick={() => {
                if (meaningBusy) pauseAudio();
                else if (meaningPaused) resumeAudio();
                else meaningAction();
              }}
            >
              {meaningBusy ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </IconButton>
          )}
          <p lang={verse.lang} dir="ltr" className={`max-w-prose leading-8 text-ink/90 ${body === 'lg' ? 'text-xl' : body === 'sm' ? 'text-base' : 'text-lg'}`}>
            {verse.translation}
          </p>
        </div>
      ) : showTranslation && verse.translationKey ? (
        <p className="mt-2 text-sm text-muted" role="status">
          {t.verseTranslationUnavailable}
        </p>
      ) : null}
      {showTranslation && verse.footnotes ? (
        <details className="mt-2 rounded-xl border border-pine/10 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-muted">{t.footnotes}</summary>
          <p lang={verse.lang} className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/70">
            {verse.footnotes}
          </p>
        </details>
      ) : null}
      {cite && !compact && (
        <div className="mt-1 space-y-1 text-xs text-ink/50">
          <p>
            {verse.translationTitle || verse.translator}
            {verse.translationKey ? ` · ${verse.translationKey}` : ''}
            {verse.translationVersion ? ` · ${verse.translationVersion}` : ''}
          </p>
          {verse.translationDescription ? <p className="leading-relaxed">{verse.translationDescription}</p> : null}
        </div>
      )}
      {showTranslation && meaningNote ? (
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
  const [shareOpen, setShareOpen] = useState(false);
  const [reflection, setReflection] = useState('');
  const [theme, setTheme] = useState<WallPostTheme>('emerald');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [postedToast, setPostedToast] = useState<string | null>(null);

  const seg =
    hadith.segmented ??
    segmentHadithRecord({
      arabic: hadith.arabic,
      text: hadith.text,
      lang: hadith.lang,
    });

  const handlePublishToWall = async () => {
    const primaryGrade = hadith.grades?.[0]?.grade || 'Verified';
    await publishFaithWallPost({
      type: 'reflection',
      isAnonymous,
      theme,
      hadithCollection: hadith.collectionName,
      hadithNumber: hadith.number,
      hadithGrade: primaryGrade,
      verse: {
        surah: hadith.book || 1,
        ayah: hadith.number,
        surahName: hadith.collectionName,
        arabic: seg.arabic.matn || hadith.arabic || '',
        translation: seg.translation.matn || hadith.text,
        reference: `${hadith.collectionName} #${hadith.number}`,
      },
      lang: hadith.lang,
      url: `#/hadith/collections?book=${encodeURIComponent(hadith.collection)}`,
      reflection: reflection.trim(),
    });
    setShareOpen(false);
    setReflection('');
    setPostedToast('Published Hadith Card to the Community Faith Wall!');
    window.setTimeout(() => setPostedToast(null), 3500);
  };

  const shareLandingUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/s/h/${encodeURIComponent(hadith.collection)}/${hadith.number}?lang=${hadith.lang}`
      : `#/hadith/collections?book=${encodeURIComponent(hadith.collection)}`;
  const shortWhatsAppText = `${hadith.collectionName} #${hadith.number} · Dragon Dawwa\n${shareLandingUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shortWhatsAppText)}`;

  return (
    <article
      data-hadith-card={`${hadith.collection}-${hadith.number}`}
      className="border-b border-pine/10 py-5 last:border-0"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-pine">
          {hadith.collectionName} · {hadith.number}
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="share-hadith-to-wall-btn"
            onClick={() => setShareOpen(open => !open)}
            style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/45 bg-[#073C30] px-3 py-1 text-xs font-bold text-[#F9E7B9] shadow-2xs transition hover:bg-[#0A2E23] cursor-pointer"
          >
            <Sparkles className="h-3 w-3 text-[#D4AF37]" aria-hidden />
            <span>Share to Faith Wall</span>
          </button>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            data-testid="hadith-whatsapp-share-link"
            onClick={() => {
              const fullCopy = [
                hadith.arabic,
                hadith.text,
                `— ${hadith.collectionName} #${hadith.number}`,
                shareLandingUrl,
              ]
                .filter(Boolean)
                .join('\n\n');
              void navigator.clipboard?.writeText(fullCopy).catch(() => {});
              setPostedToast('Full Hadith copied to clipboard — ready for WhatsApp!');
              window.setTimeout(() => setPostedToast(null), 3000);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-pine/20 bg-white px-2.5 py-1 text-xs font-semibold text-pine hover:bg-emerald-50/60"
          >
            <Share2 className="h-3 w-3" aria-hidden />
            <span>WhatsApp</span>
          </a>

          <IconButton label={saved ? t.unsave : t.save} aria-pressed={saved} onClick={() => toggleHadith(ref)}>
            {saved ? <BookmarkCheck className="h-4 w-4 text-gold" /> : <Bookmark className="h-4 w-4" />}
          </IconButton>
        </div>
      </div>

      {/* Two-Tier Arabic Display: Secondary Isnad Chain + Prominent Prophetic Matn */}
      {hadith.arabic && (
        <div
          lang="ar"
          dir="rtl"
          data-testid="hadith-arabic-segmented"
          className="mb-3 rounded-2xl border border-[#0E382B]/15 bg-[#FCF9F2] p-4 space-y-2.5"
        >
          {seg.arabic.isnad && (
            <div data-testid="hadith-arabic-isnad" className="border-b border-stone-200/80 pb-2">
              <span className="mb-1 inline-block rounded-full bg-stone-200/80 px-2.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-stone-700">
                Isnad · السند (Narrator Chain)
              </span>
              <p className="arabic text-base leading-relaxed text-stone-600">
                {seg.arabic.isnad}
              </p>
            </div>
          )}
          <div data-testid="hadith-arabic-matn">
            {seg.arabic.isnad && (
              <span className="mb-1 inline-block rounded-full bg-emerald-900/10 px-2.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-[#073C30]">
                Matn · المتن (Prophetic Statement)
              </span>
            )}
            <p className="arabic text-xl font-bold leading-loose text-stone-950 sm:text-2xl">
              {seg.arabic.matn || hadith.arabic}
            </p>
          </div>
        </div>
      )}

      {/* Two-Tier Translation Display: Companion Attribution + Prominent Matn */}
      <div
        lang={hadith.lang}
        data-testid="hadith-translation-segmented"
        className="rounded-2xl border border-stone-200/80 bg-white p-4 space-y-2"
      >
        {seg.translation.companion_attribution && (
          <p
            data-testid="hadith-translation-attribution"
            className="text-xs font-medium italic leading-relaxed text-stone-600 sm:text-sm"
          >
            {seg.translation.companion_attribution}:
          </p>
        )}
        <p
          data-testid="hadith-translation-matn"
          className="text-base font-semibold leading-relaxed text-stone-900 sm:text-[17px]"
        >
          {seg.translation.companion_attribution
            ? `“${seg.translation.matn}”`
            : seg.translation.matn || hadith.text}
        </p>
      </div>

      {/* Inline Share to Faith Wall Drawer */}
      {shareOpen && (
        <div
          data-testid="hadith-share-wall-drawer"
          className="mt-3 space-y-3 rounded-2xl border border-[#D4AF37]/50 bg-[#051C15] p-4 text-[#F3E8C8]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
              ✦ Share {hadith.collectionName} #{hadith.number} to Community Faith Wall
            </span>
            <ThemeSwatches selected={theme} onSelect={setTheme} />
          </div>

          <input
            type="text"
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder="Add your reflection or takeaway on this Hadith (optional)…"
            className="w-full rounded-xl border border-[#D4AF37]/35 bg-[#0A2E23]/80 px-3.5 py-2 text-xs text-white placeholder:text-stone-400 focus:border-[#D4AF37] focus:outline-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#F9E7B9] cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={e => setIsAnonymous(e.target.checked)}
                className="rounded border-[#D4AF37]"
              />
              <span>Post as Anonymous Seeker</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="rounded-xl px-3 py-1.5 text-xs text-stone-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-share-hadith-wall-btn"
                onClick={() => void handlePublishToWall()}
                style={{ backgroundColor: '#D4AF37', color: '#031812' }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4AF37] px-4 py-1.5 text-xs font-bold text-[#031812] cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                <span>Publish to Faith Wall</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {postedToast && (
        <div
          role="status"
          className="mt-2.5 flex items-center justify-between rounded-xl border border-emerald-700/30 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-950"
        >
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            <span>{postedToast}</span>
          </span>
          <a href="#/quran/wall" className="font-bold text-[#073C30] underline">
            Open Faith Wall →
          </a>
        </div>
      )}

      <div className="mt-3">
        <HadithVoiceBar
          hadithKey={`card-${hadith.collection}-${hadith.number}-${hadith.lang}`}
          arabicText={hadith.arabic}
          translationText={hadith.text}
          lang={hadith.lang}
          variant="light"
          compact
        />
      </div>
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

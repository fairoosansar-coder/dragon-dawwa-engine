import { useState } from 'react';
import { useApp } from '../lib/store.tsx';
import { renderVerseImage } from '../lib/verseImage.ts';
import { absoluteReadingUrl, readingLinkHash, verseShareText, type ShareVerse } from '../lib/verseShare.ts';
import type { Lang } from '../shared/sources.ts';
import { Button } from './ui.tsx';

async function writeClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** One Share menu: attributed text, a restoring link, and a verse image. */
export function VerseShare({ verse, lang, mode }: { verse: ShareVerse; lang: Lang; mode: 'book' | 'study' }) {
  const { t } = useApp();
  const [note, setNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ cards: string[]; sheet: string } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const ready = Boolean(verse.arabic && verse.translation && verse.translationKey);
  const hash = readingLinkHash({
    surah: verse.surah,
    ayah: verse.ayah,
    lang,
    edition: verse.translationKey || '',
    mode,
  });
  const url = absoluteReadingUrl(hash);

  const copyText = async () => {
    if (!ready) {
      setNote(t.shareWaiting);
      return;
    }
    const ok = await writeClipboard(verseShareText(verse));
    setNote(ok ? t.shareCopied : t.shareFailed);
  };

  const copyLink = async () => {
    const ok = await writeClipboard(url);
    setNote(ok ? t.shareLinkCopied : t.shareFailed);
  };

  const shareLink = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${verse.surahName} ${verse.surah}:${verse.ayah}`, url });
        setNote(null);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    const ok = await writeClipboard(url);
    setNote(ok ? t.shareFailed : t.shareFailed);
  };

  const openPreview = async () => {
    if (!ready) {
      setNote(t.shareWaiting);
      return;
    }
    setDrawing(true);
    setNote(null);
    const drawn = await renderVerseImage(verse, lang);
    setDrawing(false);
    if ('error' in drawn) {
      setPreview(null);
      setNote(t.shareImageFailed);
      return;
    }
    setPreview(drawn);
  };

  const download = () => {
    if (!preview) return;
    const anchor = document.createElement('a');
    anchor.href = preview.sheet;
    anchor.download = `verse-${verse.surah}-${verse.ayah}.png`;
    anchor.click();
  };

  return (
    <div className="text-sm">
      <details className="rounded-2xl border border-pine/10 bg-parchment px-4 py-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold text-pine [&::-webkit-details-marker]:hidden">{t.share}</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="soft" onClick={() => void copyText()}>
            {t.shareCopyText}
          </Button>
          <Button variant="soft" onClick={() => void copyLink()}>
            {t.shareCopyLink}
          </Button>
          <Button variant="soft" onClick={() => void shareLink()}>
            {t.shareLink}
          </Button>
          <Button variant="ghost" onClick={() => void openPreview()}>
            {t.sharePreview}
          </Button>
        </div>
        {drawing && <p className="mt-2 text-muted">{t.sharePreview}</p>}
        {note && (
          <p className="mt-2 text-muted" role="status">
            {note}
          </p>
        )}
      </details>
      {preview && (
        <div role="dialog" aria-label={t.sharePreview} className="fixed inset-0 z-50 flex items-end justify-center bg-pine/40 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-sand p-4 shadow-xl">
            <div className="space-y-3">
              {preview.cards.map((src, index) => (
                <img key={src.slice(0, 48) + index} src={src} alt={`${verse.surahName} ${verse.surah}:${verse.ayah}`} className="w-full rounded-xl border border-gold/40" />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={download}>{t.shareDownload}</Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                {t.shareClose}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

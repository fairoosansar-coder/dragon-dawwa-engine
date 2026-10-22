import { useState } from 'react';
import { useApp } from '../lib/store.tsx';
import { renderVerseImage } from '../lib/verseImage.ts';
import { absoluteReadingUrl, type ShareVerse } from '../lib/verseShare.ts';
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

/** One Share menu for a sourced record: full text, a deep link, and a drawn image. */
export function RecordShare({
  text,
  hash,
  verse,
  lang,
  filename,
  title,
}: {
  text: string;
  hash: string;
  verse: ShareVerse;
  lang: Lang;
  filename: string;
  title: string;
}) {
  const { t } = useApp();
  const [note, setNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ cards: string[]; sheet: string } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const url = absoluteReadingUrl(hash);

  const copyText = async () => {
    const ok = await writeClipboard(text);
    setNote(ok ? t.shareCopied : t.shareFailed);
  };

  const copyLink = async () => {
    const ok = await writeClipboard(url);
    setNote(ok ? t.shareLinkCopied : t.shareFailed);
  };

  const shareLink = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
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
    setDrawing(true);
    setNote(null);
    const drawn = await renderVerseImage(verse, lang);
    setDrawing(false);
    if ('error' in drawn) {
      setPreview(null);
      setNote(drawn.error);
      return;
    }
    setPreview(drawn);
  };

  const download = () => {
    if (!preview) return;
    const anchor = document.createElement('a');
    anchor.href = preview.sheet;
    anchor.download = filename;
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
                <img key={`${filename}-${index}`} src={src} alt={title} className="w-full rounded-xl border border-gold/40" />
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

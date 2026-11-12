import { useState } from 'react';
import { Check, Send, Share2, Sparkles } from 'lucide-react';
import { useApp } from '../lib/store.tsx';
import { renderVerseImage } from '../lib/verseImage.ts';
import {
  absoluteReadingUrl,
  publishFaithWallPost,
   type ShareVerse,
  type WallPostTheme,
} from '../lib/verseShare.ts';
import type { Lang } from '../shared/sources.ts';
import { ThemeSwatches } from './wall/ReflectionModal.tsx';
import { Button } from './ui.tsx';

async function writeClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** One Share menu for a sourced record: full text, a deep link, a drawn image, WhatsApp share, and direct Faith Wall publishing. */
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
  const [wallOpen, setWallOpen] = useState(false);
  const [reflection, setReflection] = useState('');
  const [theme, setTheme] = useState<WallPostTheme>('emerald');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const url = absoluteReadingUrl(hash);
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://dragon-dawwa-production.up.railway.app';

  const hadithIdMatch = /^#\/hadith\/(\d+)/.exec(hash);
  const shortShareUrl = hadithIdMatch
    ? `${origin}/s/h/${hadithIdMatch[1]}?lang=${lang}`
    : verse.surah > 0 && verse.ayah > 0
      ? `${origin}/s/v/${verse.surah}/${verse.ayah}?lang=${lang}`
      : url;

  const asciiBadge = hadithIdMatch
    ? `Prophetic Hadith #${hadithIdMatch[1]} (${lang.toUpperCase()})`
    : verse.surah > 0 && verse.ayah > 0
      ? `Surah ${verse.surahName || verse.surah} (${verse.surah}:${verse.ayah})`
      : 'Dragon Dawwa Study Record';
  const shortWhatsAppText = `${asciiBadge} · Dragon Dawwa\n${shortShareUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shortWhatsAppText)}`;

  const copyText = async () => {
    const ok = await writeClipboard(text);
    setNote(ok ? t.shareCopied : t.shareFailed);
  };

  const copyLink = async () => {
    const ok = await writeClipboard(shortShareUrl);
    setNote(ok ? t.shareLinkCopied : t.shareFailed);
  };

  const shareLink = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url: shortShareUrl });
        setNote(null);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    const ok = await writeClipboard(shortShareUrl);
    setNote(ok ? t.shareLinkCopied : t.shareFailed);
  };

  const openPreview = async () => {
    setDrawing(true);
    setNote(null);
    const drawn = await renderVerseImage(verse, lang, theme);
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

  const handlePublishToWall = async () => {
    await publishFaithWallPost({
      type: 'reflection',
      isAnonymous,
      theme,
      hadithCollection: verse.reference || 'HadeethEnc',
      hadithNumber: hadithIdMatch ? Number(hadithIdMatch[1]) : 1,
      hadithGrade: verse.translationTitle?.replace(/^Grade:\s*/i, '') || 'Verified',
      verse: {
        ...verse,
        surah: verse.surah || 1,
        ayah: verse.ayah || 1,
        surahName: verse.surahName || title,
      },
      lang,
      url: hash,
      reflection: reflection.trim(),
    });
    setWallOpen(false);
    setReflection('');
    setNote('Published directly to the Community Faith Wall!');
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="share-hadith-to-wall-btn"
          onClick={() => setWallOpen(open => !open)}
          style={{ backgroundColor: '#073C30', color: '#F9E7B9' }}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/45 bg-[#073C30] px-4 py-2 text-xs font-bold text-[#F9E7B9] shadow-sm transition hover:bg-[#0A2E23] cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
          <span>Share to Community Faith Wall</span>
        </button>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          data-testid="record-whatsapp-share-link"
          onClick={() => {
            void writeClipboard(`${text}\n\n${shortShareUrl}`).then(() =>
              setNote('Full text also copied to clipboard — ready for WhatsApp!'),
            );
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-pine/20 bg-white px-3.5 py-2 text-xs font-semibold text-pine hover:bg-emerald-50/60"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          <span>Share to WhatsApp</span>
        </a>
      </div>

      {wallOpen && (
        <div
          data-testid="record-share-wall-drawer"
          className="space-y-3 rounded-2xl border border-[#D4AF37]/50 bg-[#051C15] p-4 text-[#F3E8C8]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
              ✦ Publish to Community Faith Wall
            </span>
            <ThemeSwatches selected={theme} onSelect={setTheme} />
          </div>

          <input
            type="text"
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder="Add your reflection or takeaway (optional)…"
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
                onClick={() => setWallOpen(false)}
                className="rounded-xl px-3 py-1.5 text-xs text-stone-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-record-wall-publish-btn"
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

      <details className="rounded-2xl border border-pine/10 bg-parchment px-4 py-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold text-pine [&::-webkit-details-marker]:hidden">
          {t.share}
        </summary>
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
      </details>

      {note && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-emerald-700/30 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-950"
        >
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            <span>{note}</span>
          </span>
          <a href="#/quran/wall" className="font-bold text-[#073C30] underline">
            Open Faith Wall →
          </a>
        </div>
      )}

      {preview && (
        <div
          role="dialog"
          aria-label={t.sharePreview}
          className="fixed inset-0 z-50 flex items-end justify-center bg-pine/40 p-4 sm:items-center"
        >
          <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-sand p-4 shadow-xl">
            <div className="space-y-3">
              {preview.cards.map((src, index) => (
                <img
                  key={`${filename}-${index}`}
                  src={src}
                  alt={title}
                  className="w-full rounded-xl border border-gold/40"
                />
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

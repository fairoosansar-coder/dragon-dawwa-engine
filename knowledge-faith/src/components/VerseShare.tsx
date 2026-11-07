import { useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, Download, Link2, LogIn, Send, Share2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useSeekerAuth } from '../lib/seekerAuth.ts';
import { useApp } from '../lib/store.tsx';
import { SeekerEmblemGlyph } from './SeekerAuthModal.tsx';
import {
  BRAND_FOOTER_LEFT,
  BRAND_FOOTER_RIGHT,
  CARD_BISMILLAH,
  formatQuotedTranslation,
  formatVerseCardBadge,
  renderVerseImage,
} from '../lib/verseImage.ts';
import {
  absoluteReadingUrl,
  listFaithWallPosts,
  publishFaithWallPost,
  readingLinkHash,
  verseShareText,
  type FaithWallPost,
  type ShareVerse,
} from '../lib/verseShare.ts';
import type { Lang } from '../shared/sources.ts';

async function writeClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function DockIconButton({
  label,
  tooltip,
  onClick,
  active = false,
  actionId,
  children,
}: {
  label: string;
  tooltip: string;
  onClick: () => void;
  active?: boolean;
  actionId: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-verse-action={actionId}
      aria-label={label}
      title={tooltip}
      onClick={onClick}
      className={`group relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-150 ${
        active
          ? 'border-[#D4AF37] bg-[#0A2E23] text-[#F3E8C8] shadow-sm'
          : 'border-pine/15 bg-white/85 text-pine hover:border-[#D4AF37]/70 hover:bg-[#0A2E23] hover:text-[#F3E8C8]'
      }`}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#031812] px-2.5 py-1 text-[11px] font-medium text-[#F3E8C8] opacity-0 shadow-md ring-1 ring-[#D4AF37]/35 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {tooltip}
      </span>
    </button>
  );
}

/** Compact Verse Icon Action Dock + Verse Card Studio Modal + Public Faith Wall sharing. */
export function VerseShare({ verse, lang, mode }: { verse: ShareVerse; lang: Lang; mode: 'book' | 'study' }) {
  const { t } = useApp();
  const { user, openModal: openAuthModal } = useSeekerAuth();
  const [note, setNote] = useState<string | null>(null);
  const [copiedKind, setCopiedKind] = useState<'copy' | 'link' | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [preview, setPreview] = useState<{ cards: string[]; sheet: string } | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [socialDrawerOpen, setSocialDrawerOpen] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  const [reflection, setReflection] = useState('');
  const [wallToast, setWallToast] = useState<string | null>(null);
  const [wallPosts, setWallPosts] = useState<FaithWallPost[]>(() => listFaithWallPosts());

  const ready = Boolean(verse.arabic && verse.translation);
  const hash = readingLinkHash({
    surah: verse.surah,
    ayah: verse.ayah,
    lang,
    edition: verse.translationKey || '',
    mode,
  });
  const url = absoluteReadingUrl(hash);
  const badgeText = formatVerseCardBadge(verse);
  const quotedTranslation = formatQuotedTranslation(verse.translation);

  useEffect(() => {
    setPreview(null);
    setSocialDrawerOpen(false);
    setWallOpen(false);
    setWallToast(null);
  }, [verse.surah, verse.ayah, lang, verse.translationKey]);

  useEffect(() => {
    if (!studioOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStudioOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studioOpen]);

  const flashNote = (message: string, kind?: 'copy' | 'link') => {
    setNote(message);
    if (kind) setCopiedKind(kind);
    window.setTimeout(() => {
      setNote(current => (current === message ? null : current));
      if (kind) setCopiedKind(current => (current === kind ? null : current));
    }, 2600);
  };

  const copyText = async () => {
    if (!ready) {
      flashNote(t.shareWaiting);
      return;
    }
    const ok = await writeClipboard(verseShareText(verse));
    flashNote(ok ? t.shareCopied : t.shareFailed, ok ? 'copy' : undefined);
  };

  const copyLink = async () => {
    const ok = await writeClipboard(url);
    flashNote(ok ? t.shareLinkCopied : t.shareFailed, ok ? 'link' : undefined);
  };

  const quickShare = async () => {
    const shareTitle = `${verse.surahName} ${verse.surah}:${verse.ayah}`;
    const shareBody = `${verse.arabic}\n\n${quotedTranslation}\n— ${shareTitle}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareBody, url });
        setNote(null);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    const ok = await writeClipboard(`${shareBody}\n${url}`);
    flashNote(ok ? t.shareLinkCopied : t.shareFailed);
  };

  const openStudio = async () => {
    if (!ready) {
      flashNote(t.shareWaiting);
      return;
    }
    setStudioOpen(true);
    setNote(null);
    setWallToast(null);
    setDrawing(true);
    const drawn = await renderVerseImage(verse, lang);
    setDrawing(false);
    if ('error' in drawn) {
      setPreview(null);
      return;
    }
    setPreview(drawn);
  };

  const downloadCard = async () => {
    let target = preview;
    if (!target) {
      setDrawing(true);
      const drawn = await renderVerseImage(verse, lang);
      setDrawing(false);
      if (!('error' in drawn)) {
        target = drawn;
        setPreview(drawn);
      }
    }
    if (!target) {
      setWallToast(t.shareImageFailed);
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = target.sheet;
    anchor.download = `verse-${verse.surah}-${verse.ayah}.png`;
    anchor.click();
  };

  const shareToSocials = async () => {
    const shareTitle = `Surah ${verse.surahName} ${verse.surah}:${verse.ayah}`;
    const shareBody = `${verse.arabic}\n\n${quotedTranslation}\n— ${shareTitle} · Dragon Dawwa`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareBody, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    setSocialDrawerOpen(open => !open);
  };

  const handleCommunityWallClick = async () => {
    if (!wallOpen) {
      setWallOpen(true);
      setSocialDrawerOpen(false);
      return;
    }
    await submitToCommunityWall();
  };

  const submitToCommunityWall = async () => {
    const posted = await publishFaithWallPost({
      verse,
      lang,
      url,
      reflection,
      cardDataUrl: preview?.cards[0],
    });
    setWallPosts(listFaithWallPosts().length ? listFaithWallPosts() : [posted]);
    setReflection('');
    setWallToast('Shared to the Public Faith Wall!');
  };

  const socialShareText = `${verse.arabic}\n\n${quotedTranslation}\n— Surah ${verse.surahName} ${verse.surah}:${verse.ayah}\n${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(socialShareText)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${quotedTranslation} — Surah ${verse.surahName} ${verse.surah}:${verse.ayah}`)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="text-sm" data-verse-share-dock>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pine/15 bg-parchment/90 px-4 py-2.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/45 bg-[#0A2E23] px-3 py-1 text-xs font-semibold tracking-wide text-[#F3E8C8]">
            <span aria-hidden className="text-[#D4AF37]">✦</span>
            <span>
              {verse.surahName} {verse.surah}:{verse.ayah}
            </span>
          </span>
          {note && (
            <span role="status" data-share-status className="truncate text-xs font-medium text-pine">
              {note}
            </span>
          )}
        </div>

        <div role="toolbar" aria-label={t.share} className="flex items-center gap-2">
          <DockIconButton
            actionId="copy"
            label="Copy verse"
            tooltip="Copy verse"
            active={copiedKind === 'copy'}
            onClick={() => void copyText()}
          >
            {copiedKind === 'copy' ? <Check className="h-4 w-4 text-[#D4AF37]" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          </DockIconButton>

          <DockIconButton
            actionId="link"
            label="Copy link"
            tooltip="Copy link"
            active={copiedKind === 'link'}
            onClick={() => void copyLink()}
          >
            {copiedKind === 'link' ? <Check className="h-4 w-4 text-[#D4AF37]" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
          </DockIconButton>

          <DockIconButton
            actionId="card"
            label="Verse Card Studio"
            tooltip="Card Studio"
            active={studioOpen}
            onClick={() => void openStudio()}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
          </DockIconButton>

          <DockIconButton
            actionId="share"
            label="Quick share"
            tooltip="Quick Share"
            onClick={() => void quickShare()}
          >
            <Share2 className="h-4 w-4" aria-hidden />
          </DockIconButton>
        </div>
      </div>

      {studioOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Verse Card Studio"
          data-verse-studio-modal
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-md sm:p-6"
          onClick={() => setStudioOpen(false)}
        >
          <div
            className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#D4AF37]/40 bg-[#051C15] p-4 text-[#F3E8C8] shadow-2xl sm:p-6"
            onClick={event => event.stopPropagation()}
          >
            {/* Studio Modal Header */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
                  Illuminated Manuscript Card · 1200×675 HD
                </p>
                <h3 className="mt-0.5 font-display text-lg font-bold text-white sm:text-xl">
                  Verse Card Studio
                </h3>
              </div>
              <button
                type="button"
                aria-label={t.shareClose}
                onClick={() => setStudioOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-white/5 text-[#F3E8C8] transition hover:border-[#D4AF37] hover:bg-white/10"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* 16:9 Illuminated Manuscript Card Live Preview */}
            <div
              data-verse-studio-card
              style={{
                background: 'linear-gradient(135deg, #031812 0%, #0A2E23 50%, #041812 100%)',
              }}
              className="relative flex min-h-[14.5rem] w-full flex-col justify-between overflow-hidden rounded-2xl border-2 border-[#D4AF37]/50 p-3.5 shadow-inner sm:aspect-[16/9] sm:min-h-0 sm:p-8"
            >
              {/* Inner Second Gold Frame Line */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-2 rounded-xl border border-[#D4AF37]/25 sm:inset-2.5"
              />

              {/* Subtle Geometric Rosette SVG Watermark */}
              <svg
                aria-hidden
                viewBox="0 0 200 200"
                className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 text-[#D4AF37]/[0.06] sm:h-80 sm:w-80"
              >
                <g fill="none" stroke="currentColor" strokeWidth="1.2">
                  <rect x="42" y="42" width="116" height="116" />
                  <rect x="42" y="42" width="116" height="116" transform="rotate(45 100 100)" />
                  <circle cx="100" cy="100" r="82" />
                  <circle cx="100" cy="100" r="58" />
                  <circle cx="100" cy="100" r="30" />
                </g>
              </svg>

              {/* Top Row: Gold Pill Badge (left) + Decorative Gold Bismillah / Rosette (right) */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span
                  data-card-badge
                  className="inline-flex shrink-0 items-center rounded-full border border-[#D4AF37]/55 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-[#D4AF37] sm:px-3.5 sm:py-1 sm:text-xs sm:tracking-[0.12em]"
                >
                  {badgeText}
                </span>
                <span
                  lang="ar"
                  dir="rtl"
                  data-card-bismillah
                  className="quran-face truncate text-xs text-[#D4AF37]/90 sm:text-lg"
                >
                  ۞ {CARD_BISMILLAH}
                </span>
              </div>

              {/* Center Arabic + Quoted Warm Ivory Translation */}
              <div className="relative z-10 my-auto flex flex-col items-center justify-center px-2 py-2 text-center sm:px-6 sm:py-3">
                <p
                  lang="ar"
                  dir="rtl"
                  data-card-arabic
                  style={{ textShadow: '0 0 20px rgba(212,175,55,0.2)' }}
                  className="quran-face max-h-28 overflow-y-auto text-lg leading-[2] text-[#FFFFFF] sm:max-h-44 sm:text-3xl sm:leading-[2.1]"
                >
                  {verse.arabic}
                </p>

                <div aria-hidden className="my-1.5 flex items-center gap-2 text-[#D4AF37]/60 sm:my-3">
                  <span className="h-px w-8 bg-[#D4AF37]/35 sm:w-14" />
                  <span className="text-[9px] sm:text-[10px]">◆</span>
                  <span className="h-px w-8 bg-[#D4AF37]/35 sm:w-14" />
                </div>

                <p
                  lang={lang}
                  data-card-translation
                  className="max-h-20 max-w-2xl overflow-y-auto font-display text-xs leading-relaxed text-[#F3E8C8] sm:max-h-32 sm:text-base"
                >
                  {quotedTranslation}
                </p>

                {reflection.trim() && (
                  <p
                    data-card-reflection
                    className="mt-1.5 max-w-xl truncate text-[11px] italic text-[#D4AF37]/90 sm:mt-2 sm:text-xs"
                  >
                    — {reflection.trim()}
                  </p>
                )}
              </div>

              {/* Discreet Brand Footer */}
              <div
                data-card-footer
                className="relative z-10 flex items-center justify-between gap-2 border-t border-[#D4AF37]/20 pt-2 text-[10px] font-medium tracking-wide text-[#D4AF37]/70 sm:pt-2.5 sm:text-[11px]"
              >
                <span className="truncate">{BRAND_FOOTER_LEFT}</span>
                <span className="shrink-0">{BRAND_FOOTER_RIGHT}</span>
              </div>
            </div>

            {drawing && (
              <p className="mt-2 text-xs text-[#D4AF37]/80">Rendering 1200×675 HD canvas…</p>
            )}

            {/* Primary Studio Action Buttons */}
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                data-studio-action="download"
                onClick={() => void downloadCard()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37] bg-[#D4AF37] px-4 py-2.5 text-sm font-semibold text-[#031812] shadow-sm transition hover:bg-[#e3c14d]"
              >
                <Download className="h-4 w-4" aria-hidden />
                <span>Download HD Card</span>
              </button>

              <button
                type="button"
                data-studio-action="socials"
                onClick={() => void shareToSocials()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/45 bg-[#0A2E23] px-4 py-2.5 text-sm font-semibold text-[#F3E8C8] transition hover:border-[#D4AF37] hover:bg-[#0f3d2f]"
              >
                <Share2 className="h-4 w-4 text-[#D4AF37]" aria-hidden />
                <span>Share to Socials</span>
              </button>

              <button
                type="button"
                data-studio-action="wall"
                onClick={() => void handleCommunityWallClick()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/45 bg-[#0A2E23] px-4 py-2.5 text-sm font-semibold text-[#F3E8C8] transition hover:border-[#D4AF37] hover:bg-[#0f3d2f]"
              >
                <Sparkles className="h-4 w-4 text-[#D4AF37]" aria-hidden />
                <span>Share to Community Wall</span>
              </button>
            </div>

            {/* Social Share Sheet Drawer (for desktop / browsers without native share) */}
            {socialDrawerOpen && (
              <div
                data-social-drawer
                className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4AF37]/30 bg-[#031812]/90 px-4 py-3 text-xs"
              >
                <span className="font-medium text-[#F3E8C8]/85">Share this Ayah card:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[#D4AF37]/40 bg-[#0A2E23] px-3 py-1.5 font-semibold text-[#F3E8C8] hover:border-[#D4AF37]"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[#D4AF37]/40 bg-[#0A2E23] px-3 py-1.5 font-semibold text-[#F3E8C8] hover:border-[#D4AF37]"
                  >
                    X / Twitter
                  </a>
                  <button
                    type="button"
                    onClick={() => void writeClipboard(socialShareText).then(() => setWallToast('Copied share text and link!'))}
                    className="rounded-lg border border-[#D4AF37]/40 bg-[#0A2E23] px-3 py-1.5 font-semibold text-[#F3E8C8] hover:border-[#D4AF37]"
                  >
                    Copy Text & Link
                  </button>
                </div>
              </div>
            )}

            {/* Inline Reflection Input for Community Wall */}
            {wallOpen && (
              <div
                data-wall-composer
                className="mt-4 rounded-2xl border border-[#D4AF37]/35 bg-[#031812]/90 p-3.5"
              >
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  {user ? (
                    <div
                      data-studio-seeker-chip
                      className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/45 bg-[#0A2E23] px-3 py-1 text-xs text-[#F3E8C8]"
                    >
                      <SeekerEmblemGlyph emblem={user.emblem} size={14} />
                      <span className="font-semibold text-white">{user.name}</span>
                      <span className="text-[#D4AF37]">· {user.kunyah}</span>
                      <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-studio-signin-prompt
                      onClick={() => openAuthModal()}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/55 bg-[#0A2E23] px-3 py-1 text-xs font-semibold text-[#F9E7B9] transition hover:border-[#D4AF37]"
                    >
                      <LogIn className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden />
                      <span>Sign in to publish to your Personal Wall</span>
                    </button>
                  )}
                </div>
                <label className="block text-xs font-medium text-[#D4AF37]">
                  Public Faith Wall Reflection
                  <input
                    type="text"
                    data-wall-reflection-input
                    value={reflection}
                    onChange={event => setReflection(event.target.value)}
                    placeholder="Add a reflection or thought (optional)..."
                    className="mt-2 w-full rounded-xl border border-[#D4AF37]/35 bg-[#0A2E23]/70 px-3.5 py-2 text-sm text-[#F3E8C8] placeholder:text-[#F3E8C8]/45 focus:border-[#D4AF37] focus:outline-none"
                  />
                </label>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setWallOpen(false)}
                    className="rounded-xl px-3 py-1.5 text-xs font-medium text-[#F3E8C8]/70 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-wall-submit
                    onClick={() => void submitToCommunityWall()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-[#031812] transition hover:bg-[#e3c14d]"
                  >
                    <Send className="h-3.5 w-3.5" aria-hidden />
                    <span>{user ? 'Post to My Wall & Community' : 'Post to Public Faith Wall'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Toast Notification */}
            {wallToast && (
              <div
                role="status"
                data-wall-toast
                className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D4AF37]/60 bg-[#0A2E23] px-4 py-2.5 text-xs font-semibold text-[#F3E8C8]"
              >
                <span>✦ {wallToast}</span>
                <div className="flex items-center gap-3">
                  <a
                    href="#/quran/wall"
                    data-open-full-faith-wall
                    onClick={() => setStudioOpen(false)}
                    className="rounded-lg bg-[#D4AF37] px-2.5 py-1 text-[11px] font-bold text-[#031812] hover:bg-[#e3c14d]"
                  >
                    Open Public Faith Wall →
                  </a>
                  <button
                    type="button"
                    onClick={() => setWallToast(null)}
                    className="text-[#D4AF37] hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Recent Public Faith Wall Feed Preview */}
            {wallPosts.length > 0 && (
              <div data-wall-feed className="mt-4 border-t border-[#D4AF37]/20 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]/80">
                    Public Faith Wall ({wallPosts.length})
                  </p>
                  <a
                    href="#/quran/wall"
                    onClick={() => setStudioOpen(false)}
                    className="text-xs font-semibold text-[#D4AF37] hover:underline"
                  >
                    View Full Faith Wall →
                  </a>
                </div>
                <ul className="mt-2 max-h-36 space-y-2 overflow-y-auto pr-1">
                  {wallPosts.slice(0, 3).map(post => (
                    <li
                      key={post.id}
                      className="rounded-xl border border-[#D4AF37]/25 bg-[#031812]/80 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#D4AF37]">
                        <span>
                          ✦ Surah {post.surahName} {post.surah}:{post.ayah}
                        </span>
                        <span className="text-[#F3E8C8]/60">{post.authorName || 'Public Faith Wall'}</span>
                      </div>
                      {post.reflection && (
                        <p className="mt-1 italic text-[#F3E8C8]">“{post.reflection}”</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

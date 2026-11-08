import { useState } from 'react';
import { CheckCircle2, Clock, Headphones, Shield, Sparkles, XCircle } from 'lucide-react';
import {
  listAllFaithWallPosts,
  moderateFaithWallPost,
  readAdminSettings,
  saveAdminSettings,
  type FaithWallPost,
  type ModerationMode,
} from '../../lib/verseShare.ts';

export function AdminModeration({ onChanged }: { onChanged?: () => void }) {
  const [posts, setPosts] = useState<FaithWallPost[]>(() => listAllFaithWallPosts(true));
  const [mode, setMode] = useState<ModerationMode>(() => readAdminSettings().moderationMode);
  const [toast, setToast] = useState<string | null>(null);

  const pending = posts.filter(p => p.status === 'pending');
  const approved = posts.filter(p => p.status === 'approved');

  const handleModeChange = async (nextMode: ModerationMode) => {
    setMode(nextMode);
    await saveAdminSettings({ moderationMode: nextMode });
    setToast(
      nextMode === 'instant'
        ? 'Moderation Policy: Auto-approve posts (Instant) active.'
        : 'Moderation Policy: Require Admin Review (Safe) active.',
    );
    onChanged?.();
  };

  const handleDecision = async (postId: string, status: 'approved' | 'rejected') => {
    const next = await moderateFaithWallPost(postId, { status });
    setPosts(next);
    setToast(
      status === 'approved'
        ? 'Approved reflection! Now live on Community Faith Wall & Author Profile.'
        : 'Dismissed submission from the Moderation Queue.',
    );
    onChanged?.();
  };

  return (
    <div data-admin-moderation className="space-y-4">
      {/* Moderation Policy Toggle Card */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-900">
            <Shield className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
            <span>Publishing Governance Policy</span>
          </div>
          <p className="text-xs text-stone-600">
            Control whether 2-Door anchored seeker reflections go live immediately or wait in the Moderation Queue.
          </p>
        </div>

        <div
          role="group"
          aria-label="Moderation mode"
          className="inline-flex shrink-0 rounded-xl border border-stone-200 bg-stone-100 p-0.5"
        >
          <button
            type="button"
            data-moderation-mode="instant"
            aria-pressed={mode === 'instant'}
            onClick={() => void handleModeChange('instant')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              mode === 'instant'
                ? 'bg-[#073C30] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Auto-approve posts (Instant)
          </button>
          <button
            type="button"
            data-moderation-mode="review"
            aria-pressed={mode === 'review'}
            onClick={() => void handleModeChange('review')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              mode === 'review'
                ? 'bg-[#073C30] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Require Admin Review (Safe)
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          data-admin-moderation-toast
          className="rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-950"
        >
          ✦ {toast}
        </div>
      )}

      {/* Pending Queue List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-stone-900">
            Pending Review Queue ({pending.length})
          </h3>
          <span className="text-xs text-stone-500">
            {approved.length} approved posts live on Wall
          </span>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" aria-hidden />
            <p className="mt-2 font-display text-sm font-bold text-stone-900">
              All pending submissions have been reviewed
            </p>
            <p className="mt-1 text-xs text-stone-500">
              New submissions when “Require Admin Review” is active will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(post => (
              <article
                key={post.id}
                data-moderation-item={post.id}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                        <Clock className="h-3 w-3" aria-hidden />
                        <span>Pending Review</span>
                      </span>
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[11px] font-semibold text-stone-700">
                        {post.type === 'podcast' ? '🎙️ Research Podcast' : `📖 Surah ${post.surahName} ${post.surah}:${post.ayah}`}
                      </span>
                      <span className="text-xs font-semibold text-stone-900">
                        {post.authorName} <span className="font-normal text-stone-500">({post.authorRole})</span>
                      </span>
                    </div>

                    <p className="mt-2.5 text-sm leading-relaxed text-stone-800">
                      “{post.reflection}”
                    </p>

                    {post.type === 'podcast' ? (
                      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                        <Headphones className="h-4 w-4 text-emerald-700" aria-hidden />
                        <span className="font-semibold">{post.podcastTitle}</span>
                        <span className="text-stone-400">· {post.podcastDuration}</span>
                      </div>
                    ) : (
                      <div className="mt-2.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs">
                        <p lang="ar" dir="rtl" className="quran-face text-base text-stone-900">
                          {post.arabic}
                        </p>
                        <p className="mt-1 italic text-stone-600">{post.translation}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      data-admin-approve={post.id}
                      onClick={() => void handleDecision(post.id, 'approved')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-800"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      <span>Approve to Wall</span>
                    </button>
                    <button
                      type="button"
                      data-admin-reject={post.id}
                      onClick={() => void handleDecision(post.id, 'rejected')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden />
                      <span>Dismiss / Reject</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Recently Approved Live Wall Items */}
      <div className="space-y-2.5 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Approved & Live on Community Faith Wall ({approved.length})
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {approved.slice(0, 4).map(post => (
            <div
              key={post.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-stone-900">
                  {post.isOfficialBroadcast ? '✦ ' : ''}
                  {post.authorName} · Surah {post.surahName} {post.surah}:{post.ayah}
                </p>
                <p className="truncate text-stone-500">{post.reflection}</p>
              </div>
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { Bookmark, RotateCcw, Shield } from 'lucide-react';
import { LANGS, LANGUAGE_NAMES, toLang, type Lang } from '../shared/sources.ts';
import {
  ALLOWED_LEARNING_GOALS,
  type LastListeningPosition,
  type SavedListeningPoint,
  type StudioListenerPreferences,
} from '../shared/studio/presenter.ts';

export function ListenerPreferencesDrawer({
  prefs,
  savedPosition,
  savedPoints,
  savedEpisodes,
  onUpdatePrefs,
  onResetPrefs,
  onJumpToPoint,
  onSelectEpisode,
}: {
  prefs: StudioListenerPreferences;
  savedPosition: LastListeningPosition | null;
  savedPoints: SavedListeningPoint[];
  savedEpisodes: string[];
  onUpdatePrefs: (patch: Partial<StudioListenerPreferences>) => void;
  onResetPrefs: () => void;
  onJumpToPoint: (episodeId: string, segmentIndex: number, offsetSeconds: number) => void;
  onSelectEpisode: (episodeId: string) => void;
}) {
  const toggleGoal = (goal: string) => {
    const current = prefs.learningGoals;
    const next = current.includes(goal) ? current.filter(g => g !== goal) : [...current, goal];
    onUpdatePrefs({ optIn: true, learningGoals: next });
  };

  return (
    <section
      aria-label="Listener preferences and saved memory"
      data-testid="listener-preferences-drawer"
      className="rounded-3xl border border-pine/20 bg-white p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-pine/10 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pine">
            Listener Memory & Saved Position
          </p>
          <h3 className="mt-1 font-display text-xl font-bold text-pine">
            Personal Study Preferences (Explicit Opt-In)
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            With your explicit opt-in, Dragon Dawwa Studio remembers your preferred language, typical listening length, saved points, last listening position, and chosen learning goals on this device.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-pine/25 bg-sand px-4 py-1.5 text-xs font-semibold text-pine">
            <input
              type="checkbox"
              checked={prefs.optIn}
              onChange={e => onUpdatePrefs({ optIn: e.target.checked })}
              data-testid="prefs-opt-in-toggle"
              className="h-4 w-4 accent-[#064936]"
            />
            Remember my preferences
          </label>
          <button
            type="button"
            onClick={onResetPrefs}
            data-testid="prefs-reset-button"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-red-900/25 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset all
          </button>
        </div>
      </div>

      {/* Privacy guarantee */}
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-mint/60 px-3.5 py-2.5 text-xs text-pine">
        <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Privacy boundary: Dragon Dawwa never infers or stores religious devotion, sect, spiritual worth, or personal judgments from your listening behavior.
        </span>
      </div>

      {/* Saved Position & Saved Points */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-pine/15 bg-sand/60 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-pine">
            Last Saved Listening Position
          </h4>
          {savedPosition ? (
            <div className="mt-2 space-y-2 text-sm">
              <p className="font-medium text-ink">{savedPosition.episodeTitle}</p>
              <p className="text-xs text-muted">
                Segment #{savedPosition.segmentIndex + 1} · {savedPosition.offsetSeconds.toFixed(1)}s · {savedPosition.lang.toUpperCase()}
              </p>
              <button
                type="button"
                data-testid="return-to-saved-position-btn"
                onClick={() => onJumpToPoint(savedPosition.episodeId, savedPosition.segmentIndex, savedPosition.offsetSeconds)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-pine px-4 py-1.5 text-xs font-semibold text-sand hover:bg-moss"
              >
                Return to saved position
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">
              No saved position yet. Start or pause any programme or click “Save this point” while listening.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-pine/15 bg-sand/60 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-pine">
            Saved Listening Points ({savedPoints.length}) & Episodes ({savedEpisodes.length})
          </h4>
          {savedPoints.length === 0 && savedEpisodes.length === 0 ? (
            <p className="mt-2 text-xs text-muted">
              Use “Save this point” or “Save episode” during playback to bookmark moments and citations.
            </p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs">
              {savedPoints.map(pt => (
                <li key={pt.id} className="flex items-start justify-between gap-2 rounded-xl bg-white p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-pine">
                      Seg #{pt.segmentIndex + 1} · {pt.episodeTitle}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-ink/80">{pt.excerpt}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJumpToPoint(pt.episodeId, pt.segmentIndex, pt.offsetSeconds)}
                    className="shrink-0 rounded-full bg-mint px-2.5 py-1 font-semibold text-pine hover:bg-pine hover:text-sand"
                  >
                    Jump
                  </button>
                </li>
              ))}
              {savedEpisodes.map(epId => (
                <li key={epId} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2.5">
                  <span className="inline-flex items-center gap-1.5 font-medium text-pine">
                    <Bookmark className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    Episode: {epId}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectEpisode(epId)}
                    className="rounded-full bg-mint px-2.5 py-1 font-semibold text-pine"
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Opt-in Settings Controls */}
      {prefs.optIn && (
        <div className="mt-4 grid gap-4 border-t border-pine/10 pt-4 sm:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-pine">
              Preferred Content Language
              <select
                value={prefs.preferredLanguage}
                onChange={e => onUpdatePrefs({ preferredLanguage: toLang(e.target.value) as Lang })}
                className="mt-1 block min-h-10 w-full rounded-xl border border-pine/20 bg-sand px-3 py-2 text-sm text-ink"
              >
                {LANGS.map(code => (
                  <option key={code} value={code}>
                    {LANGUAGE_NAMES[code].english} ({LANGUAGE_NAMES[code].native})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold text-pine">
              Typical Listening Length
              <select
                value={String(prefs.typicalListeningMinutes)}
                onChange={e => onUpdatePrefs({ typicalListeningMinutes: Number(e.target.value) as 2 | 3 | 5 | 10 })}
                className="mt-1 block min-h-10 w-full rounded-xl border border-pine/20 bg-sand px-3 py-2 text-sm text-ink"
              >
                {[2, 3, 5, 10].map(m => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold text-pine">User-Selected Learning Goals</p>
            <div className="mt-1.5 space-y-1.5">
              {ALLOWED_LEARNING_GOALS.map(goal => (
                <label key={goal} className="flex cursor-pointer items-center gap-2 text-xs text-ink">
                  <input
                    type="checkbox"
                    checked={prefs.learningGoals.includes(goal)}
                    onChange={() => toggleGoal(goal)}
                    className="h-4 w-4 accent-[#064936]"
                  />
                  <span>{goal}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

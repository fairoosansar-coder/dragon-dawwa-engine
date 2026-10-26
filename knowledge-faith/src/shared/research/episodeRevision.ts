/** The episode id whose audio element is actually playing, or null. */
export function readPlayingEpisodeId(
  doc: { querySelector(selector: string): { paused: boolean; ended: boolean } | null },
  episodeId: string,
): string | null {
  const node = doc.querySelector(`audio[data-episode="${episodeId}"]`);
  if (!node || node.paused || node.ended) return null;
  return episodeId;
}

/**
 * A later research result is a new revision.
 * The episode that is currently playing keeps its audio.
 */
export function episodeIdForRevision(input: {
  currentEpisodeId: string;
  playingEpisodeId: string | null;
  revision: number;
}): { episodeId: string; replacedPlaying: false } {
  const playing = input.playingEpisodeId && input.playingEpisodeId === input.currentEpisodeId;
  const episodeId = playing ? `${input.currentEpisodeId}-r${input.revision}` : input.currentEpisodeId;
  return { episodeId, replacedPlaying: false };
}

/**
 * Prepend a later revision.
 * The playing episode stays in the list with its audio. Storage may strip a copy; this list does not.
 */
export function prependEpisodeRevision<T extends { id: string; revision?: number }>(input: {
  episodes: readonly T[];
  created: T;
  playingEpisodeId: string | null;
  revision: number;
}): { episodes: T[]; changed: boolean } {
  const decision = episodeIdForRevision({
    currentEpisodeId: input.created.id,
    playingEpisodeId: input.playingEpisodeId,
    revision: input.revision,
  });
  if (decision.episodeId !== input.created.id && input.episodes.some(item => item.id === decision.episodeId)) {
    return { episodes: [...input.episodes], changed: false };
  }
  if (decision.episodeId === input.created.id) {
    const existing = input.episodes.find(item => item.id === input.created.id);
    if (existing?.revision === input.revision) return { episodes: [...input.episodes], changed: false };
    if (!existing) return { episodes: [{ ...input.created, revision: input.revision }, ...input.episodes], changed: true };
    return {
      episodes: input.episodes.map(item => (item.id === input.created.id ? { ...input.created, id: input.created.id, revision: input.revision } : item)),
      changed: true,
    };
  }
  return {
    episodes: [{ ...input.created, id: decision.episodeId, revision: input.revision }, ...input.episodes],
    changed: true,
  };
}

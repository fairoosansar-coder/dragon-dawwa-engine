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

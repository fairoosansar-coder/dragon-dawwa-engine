export interface CommunityPodcast {
  id: string;
  question: string;
  language: string;
  participants: { id: string; role: string; team: string }[];
  lines: { speaker: string; role: string; text: string }[];
  reportHtml: string;
  createdAt: string;
}

const shared: CommunityPodcast[] = [];

export function listCommunityPodcasts(): CommunityPodcast[] {
  return shared.map(item => ({ ...item, participants: [...item.participants], lines: [...item.lines] }));
}

export function publishCommunityPodcast(episode: CommunityPodcast): CommunityPodcast {
  const existing = shared.find(item => item.id === episode.id);
  if (existing) return existing;
  shared.unshift(episode);
  if (shared.length > 40) shared.pop();
  return episode;
}

export function clearCommunityPodcasts() {
  shared.length = 0;
}

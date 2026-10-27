import fs from 'node:fs';
import path from 'node:path';
import { persistRoot } from '../persist.ts';

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
let loaded = false;

function communityFile(): string | null {
  if (!process.env.DD_PERSIST_DIR) return null;
  return path.join(persistRoot(), 'podcasts', 'community.json');
}

function loadShared() {
  if (loaded) return;
  loaded = true;
  const file = communityFile();
  if (!file || !fs.existsSync(file)) return;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as CommunityPodcast[];
    if (Array.isArray(parsed)) shared.push(...parsed.slice(0, 40));
  } catch {
    shared.length = 0;
  }
}

function writeShared() {
  const file = communityFile();
  if (!file) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(shared));
}

export function listCommunityPodcasts(): CommunityPodcast[] {
  loadShared();
  return shared.map(item => ({ ...item, participants: [...item.participants], lines: [...item.lines] }));
}

export function publishCommunityPodcast(episode: CommunityPodcast): CommunityPodcast {
  loadShared();
  const existing = shared.find(item => item.id === episode.id);
  if (existing) return existing;
  shared.unshift(episode);
  if (shared.length > 40) shared.pop();
  writeShared();
  return episode;
}

export function clearCommunityPodcasts() {
  shared.length = 0;
  loaded = true;
}

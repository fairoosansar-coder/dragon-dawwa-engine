import fs from 'node:fs';
import path from 'node:path';
import type { ResearchJobResponse } from '../../shared/contracts/v1.ts';
import { persistRoot } from '../persist.ts';

interface ArchiveFile {
  fingerprint: string;
  savedAt: string;
  response: ResearchJobResponse;
}

function enabled(): boolean {
  return Boolean(process.env.DD_PERSIST_DIR);
}

function jobDir(): string {
  return path.join(persistRoot(), 'research', 'jobs');
}

function safe(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140);
}

export function archiveResearchJob(fingerprint: string, response: ResearchJobResponse): void {
  if (!enabled() || !response.job?.id) return;
  if (response.job.status !== 'done' && response.job.status !== 'error' && response.job.status !== 'cancelled') return;
  fs.mkdirSync(jobDir(), { recursive: true });
  const file: ArchiveFile = { fingerprint, savedAt: new Date().toISOString(), response };
  fs.writeFileSync(path.join(jobDir(), `${safe(response.job.id)}.json`), JSON.stringify(file));
}

export function readArchivedResearchJob(id: string): ResearchJobResponse | undefined {
  if (!enabled()) return undefined;
  try {
    const file = JSON.parse(fs.readFileSync(path.join(jobDir(), `${safe(id)}.json`), 'utf8')) as ArchiveFile;
    return file.response;
  } catch {
    return undefined;
  }
}

export interface SavedEpisodeAudio {
  id: string;
  jobId: string;
  question: string;
  language: string;
  participants: { id: string; role: string; team: string }[];
  lines: { speaker: string; role: string; text: string }[];
  sources: string[];
  reportHtml: string;
  mimeType: string;
  savedAt: string;
  hasAudio: boolean;
}

function episodeDir(): string {
  return path.join(persistRoot(), 'podcasts');
}

export function saveEpisodeAudio(episode: SavedEpisodeAudio, audioBase64?: string): SavedEpisodeAudio {
  if (!enabled()) return episode;
  fs.mkdirSync(episodeDir(), { recursive: true });
  const base = path.join(episodeDir(), safe(episode.id));
  const saved = { ...episode, savedAt: episode.savedAt || new Date().toISOString(), hasAudio: Boolean(audioBase64) };
  fs.writeFileSync(`${base}.json`, JSON.stringify(saved));
  if (audioBase64) fs.writeFileSync(`${base}.wav.b64`, audioBase64);
  return saved;
}

export function listSavedEpisodes(): SavedEpisodeAudio[] {
  if (!enabled() || !fs.existsSync(episodeDir())) return [];
  return fs
    .readdirSync(episodeDir())
    .filter(name => name.endsWith('.json'))
    .map(name => JSON.parse(fs.readFileSync(path.join(episodeDir(), name), 'utf8')) as SavedEpisodeAudio);
}

export function readSavedEpisode(id: string): (SavedEpisodeAudio & { audioBase64?: string }) | undefined {
  if (!enabled()) return undefined;
  const base = path.join(episodeDir(), safe(id));
  try {
    const meta = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8')) as SavedEpisodeAudio;
    const audioFile = `${base}.wav.b64`;
    const audioBase64 = fs.existsSync(audioFile) ? fs.readFileSync(audioFile, 'utf8') : undefined;
    return { ...meta, audioBase64 };
  } catch {
    return undefined;
  }
}

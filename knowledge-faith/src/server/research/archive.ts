import fs from 'node:fs';
import path from 'node:path';
import type { ResearchJobResponse } from '../../shared/contracts/v1.ts';

export interface SavedEpisodeRecord {
  id: string;
  jobId: string;
  revision: number;
  question: string;
  language: string;
  lines: { speaker: string; role: string; text: string }[];
  sources: string[];
  participants: { id: string; role: string; team: string }[];
  reportHtml: string;
  mimeType?: string;
  state: string;
  savedAt: string;
  audioBase64?: string;
}

interface ArchiveFile {
  fingerprint: string;
  savedAt: string;
  response: ResearchJobResponse;
  revisions: { revision: number; savedAt: string; response: ResearchJobResponse }[];
}

/** An explicit directory wins. Otherwise use the Railway volume at DD_PERSIST_DIR or /data. */
export function researchArchiveDir(): string {
  if (process.env.RESEARCH_ARCHIVE_DIR) return path.resolve(process.env.RESEARCH_ARCHIVE_DIR);
  const persist = process.env.DD_PERSIST_DIR;
  if (persist) return path.join(path.resolve(persist), 'research', 'archive');
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  if (onRailway && fs.existsSync('/data')) return '/data/research/archive';
  return path.join(process.cwd(), '.data', 'research-archive');
}

function archiveDir(): string {
  return researchArchiveDir();
}

function safe(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140);
}

function jobFile(id: string): string {
  return path.join(archiveDir(), `${safe(id)}.json`);
}

function episodeDir(jobId: string): string {
  return path.join(archiveDir(), safe(jobId));
}

/** Keep a finished job, including later revisions, after the memory cache drops it. */
export function archiveResearch(fingerprint: string, response: ResearchJobResponse): void {
  if (!response.job?.id || !response.dossier) return;
  if (response.job.status !== 'done' && response.job.status !== 'error' && response.job.status !== 'cancelled') return;
  fs.mkdirSync(archiveDir(), { recursive: true });
  const revision = response.job.parallel?.revision ?? 1;
  let current: ArchiveFile | null = null;
  try {
    current = JSON.parse(fs.readFileSync(jobFile(response.job.id), 'utf8')) as ArchiveFile;
  } catch {
    current = null;
  }
  const savedAt = new Date().toISOString();
  const prior = (current?.revisions ?? []).filter(item => item.revision !== revision);
  const next: ArchiveFile = {
    fingerprint,
    savedAt,
    response,
    revisions: [...prior, { revision, savedAt, response }].sort((a, b) => a.revision - b.revision),
  };
  fs.writeFileSync(jobFile(response.job.id), JSON.stringify(next));
}

export function readArchivedJob(id: string): ResearchJobResponse | undefined {
  try {
    const file = JSON.parse(fs.readFileSync(jobFile(id), 'utf8')) as ArchiveFile;
    return file.response;
  } catch {
    return undefined;
  }
}

export function readArchivedRevisions(id: string): { revision: number; savedAt: string }[] {
  try {
    const file = JSON.parse(fs.readFileSync(jobFile(id), 'utf8')) as ArchiveFile;
    return file.revisions.map(item => ({ revision: item.revision, savedAt: item.savedAt }));
  } catch {
    return [];
  }
}

export function saveArchivedEpisode(episode: SavedEpisodeRecord): void {
  fs.mkdirSync(episodeDir(episode.jobId), { recursive: true });
  const { audioBase64, ...meta } = episode;
  const metaPath = path.join(episodeDir(episode.jobId), `${safe(episode.id)}.json`);
  fs.writeFileSync(metaPath, JSON.stringify({ ...meta, savedAt: episode.savedAt || new Date().toISOString(), hasAudio: Boolean(audioBase64) }));
  if (audioBase64) {
    fs.writeFileSync(path.join(episodeDir(episode.jobId), `${safe(episode.id)}.b64`), audioBase64);
  }
}

export function readArchivedEpisodes(jobId: string): SavedEpisodeRecord[] {
  const folder = episodeDir(jobId);
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const meta = JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8')) as SavedEpisodeRecord & { hasAudio?: boolean };
      const audioFile = path.join(folder, name.replace(/\.json$/, '.b64'));
      const audioBase64 = fs.existsSync(audioFile) ? fs.readFileSync(audioFile, 'utf8') : undefined;
      return { ...meta, audioBase64 };
    });
}

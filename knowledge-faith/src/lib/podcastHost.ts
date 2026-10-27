import { DEFAULT_PODCAST_USER_NAME, podcastHostLabel, type PodcastHonorific } from '../shared/podcastHost.ts';

const KEY = 'kf-podcast-host';

export const PODCAST_HOST_EVENT = 'kf-podcast-host';

export interface PodcastHostProfile {
  userName: string;
  honorific: PodcastHonorific;
}

const EMPTY: PodcastHostProfile = { userName: DEFAULT_PODCAST_USER_NAME, honorific: 'None' };

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function honorificOf(value: unknown): PodcastHonorific {
  if (value === 'Brother' || value === 'Sister' || value === 'None') return value;
  return 'None';
}

export function readPodcastHost(): PodcastHostProfile {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as { userName?: unknown; honorific?: unknown };
    const userName = typeof parsed.userName === 'string' ? parsed.userName.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    return { userName: userName || DEFAULT_PODCAST_USER_NAME, honorific: honorificOf(parsed.honorific) };
  } catch {
    return EMPTY;
  }
}

export function writePodcastHost(next: PodcastHostProfile) {
  const userName = next.userName.replace(/\s+/g, ' ').trim().slice(0, 40) || DEFAULT_PODCAST_USER_NAME;
  const profile = { userName, honorific: honorificOf(next.honorific) };
  storage()?.setItem(KEY, JSON.stringify(profile));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PODCAST_HOST_EVENT));
}

/** Label sent as hostName. Default, before a saved name, is "Seeker". */
export function getPodcastHostLabel(): string {
  const profile = readPodcastHost();
  return podcastHostLabel(profile.userName, profile.honorific);
}

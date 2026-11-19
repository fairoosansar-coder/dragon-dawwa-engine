/** Spoken host label. No account is required. An empty name is "Seeker". */

export const DEFAULT_PODCAST_USER_NAME = 'Seeker';

export type PodcastHonorific = 'Brother' | 'Sister' | 'None';

export function sanitizePodcastHostName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_PODCAST_USER_NAME;
  const text = value.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return text || DEFAULT_PODCAST_USER_NAME;
}

/** "Brother Name", "Sister Name", or the name alone when the honorific is None. */
export function podcastHostLabel(userName: unknown, honorific: unknown): string {
  const name = sanitizePodcastHostName(typeof userName === 'string' && userName.trim() ? userName : DEFAULT_PODCAST_USER_NAME);
  if (honorific !== 'Brother' && honorific !== 'Sister') return name;
  const prefix = `${honorific} `;
  if (name.toLowerCase().startsWith(prefix.toLowerCase())) return name;
  return `${prefix}${name}`;
}

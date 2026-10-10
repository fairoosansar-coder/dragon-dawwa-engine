import { SAMPLE_HADITHS } from '../data/sampleHadiths';
import { INITIAL_WALL_POSTS, CURRENT_DEFAULT_USER } from '../data/wallFeedData';

// Preview fixtures: the repo's own sample data. Remote avatar URLs are swapped for an
// aniconic placeholder (an 8-point star on brand green), since previews may not load
// third-party images and figurative avatars don't suit the Islamic design direction.
const AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#14503f"/><g fill="none" stroke="#c39a34" stroke-width="1.6"><rect x="12" y="12" width="16" height="16"/><rect x="12" y="12" width="16" height="16" transform="rotate(45 20 20)"/></g><circle cx="20" cy="20" r="3" fill="#c39a34"/></svg>');
const swap = (o: any): any => Array.isArray(o) ? o.map(swap) : o && typeof o === 'object'
  ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' && /^https?:\/\/images\./.test(v) ? AVATAR : swap(v)]))
  : o;
export const samples = {
  presets: SAMPLE_HADITHS,
  analysis: SAMPLE_HADITHS[0].defaultData,
  wallPosts: swap(INITIAL_WALL_POSTS),
  user: swap(CURRENT_DEFAULT_USER),
};

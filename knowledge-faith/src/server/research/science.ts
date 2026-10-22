import { UpstreamError } from '../http.ts';

export interface ScienceWork {
  id: string;
  title: string;
  year: number | null;
  doi: string | null;
  url: string;
  studyType: string | null;
  authors: string[];
  abstract: string | null;
}

const HOST = 'api.openalex.org';

function abstractFrom(index: unknown): string | null {
  if (!index || typeof index !== 'object') return null;
  const pairs: { at: number; word: string }[] = [];
  for (const [word, positions] of Object.entries(index as Record<string, unknown>)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (typeof position === 'number') pairs.push({ at: position, word });
    }
  }
  if (!pairs.length) return null;
  pairs.sort((a, b) => a.at - b.at);
  const text = pairs.map(pair => pair.word).join(' ');
  return text.length > 700 ? `${text.slice(0, 700).trim()}…` : text;
}

export function scienceConfigured(): boolean {
  const value = process.env.SCIENCE_SOURCE?.trim().toLowerCase();
  return value !== 'off' && value !== '0' && value !== 'false';
}

/** Bibliographic search. Returns not_configured when SCIENCE_SOURCE is off. */
export async function searchOpenAlex(query: string, signal: AbortSignal): Promise<ScienceWork[] | 'not_configured'> {
  if (!scienceConfigured()) return 'not_configured';
  const phrase = query.trim();
  if (phrase.length < 3) return [];
  if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', phrase.slice(0, 180));
  url.searchParams.set('per-page', '2');
  url.searchParams.set('select', 'id,display_name,publication_year,doi,type,authorships,abstract_inverted_index');
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
      headers: { Accept: 'application/json', 'User-Agent': 'DragonDawwa/1.0' },
    });
  } catch (err) {
    if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }
    throw new UpstreamError('OpenAlex took too long to respond.', 504);
  }
  if (new URL(response.url).hostname !== HOST) throw new UpstreamError('OpenAlex redirected away from its API host.', 502);
  if (response.status === 429) throw new UpstreamError('OpenAlex asked us to wait.', 429);
  if (!response.ok) throw new UpstreamError(`OpenAlex returned ${response.status}.`, 502);
  const body = (await response.json()) as { results?: unknown };
  if (!Array.isArray(body.results)) return [];
  const works: ScienceWork[] = [];
  for (const row of body.results) {
    if (!row || typeof row !== 'object') continue;
    const work = row as Record<string, unknown>;
    const title = typeof work.display_name === 'string' ? work.display_name.trim() : '';
    const id = typeof work.id === 'string' ? work.id : '';
    if (!title || !id) continue;
    const doi = typeof work.doi === 'string' ? work.doi : null;
    const authors: string[] = [];
    if (Array.isArray(work.authorships)) {
      for (const authorship of work.authorships) {
        if (!authorship || typeof authorship !== 'object') continue;
        const name = (authorship as { author?: { display_name?: unknown } }).author?.display_name;
        if (typeof name === 'string' && name.trim()) authors.push(name.trim());
      }
    }
    works.push({
      id,
      title,
      year: typeof work.publication_year === 'number' ? work.publication_year : null,
      doi,
      url: doi || id,
      studyType: typeof work.type === 'string' ? work.type : null,
      authors: authors.slice(0, 8),
      abstract: abstractFrom(work.abstract_inverted_index),
    });
  }
  return works;
}

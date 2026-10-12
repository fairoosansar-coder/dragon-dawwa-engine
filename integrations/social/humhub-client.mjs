// Server-only adapter. Each instance belongs to one verified actor, never a global admin.
export class SocialError extends Error {
  constructor(code, status = 502) { super(code); this.code = code; this.status = status; }
}
const fail = (code = 'invalid_provider_response', status = 502) => { throw new SocialError(code, status); };
const id = value => Number.isSafeInteger(value) && value > 0 ? value : fail();
const text = (value, max) => typeof value === 'string' && value.length <= max ? value : fail();
function pageNumber(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10000) fail('invalid_page', 400);
  return value;
}
export function validateOrigin(value) {
  let url;
  try { url = new URL(value); } catch { fail('invalid_social_origin', 503); }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) fail('invalid_social_origin', 503);
  return url.origin;
}
async function boundedJson(response) {
  if (!response.headers.get('content-type')?.includes('application/json')) fail();
  const reader = response.body?.getReader();
  if (!reader) fail();
  const parts = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1_048_576) { await reader.cancel(); fail('provider_response_too_large'); }
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch (error) {
    if (error instanceof SocialError) throw error;
    fail();
  }
}
function collection(data, project) {
  if (!Array.isArray(data?.results) || data.results.length > 50 || !Number.isSafeInteger(data.total) || data.total < 0 ||
      !Number.isSafeInteger(data.page) || data.page < 1 || !Number.isSafeInteger(data.pages) || data.pages < 0) fail();
  return { items: data.results.map(project), total: data.total, page: data.page, pages: data.pages };
}
export function createHumHubClient({ origin, token, expectedUserId, fetcher = fetch, timeoutMs = 10000 }) {
  const base = validateOrigin(origin);
  if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token) || !Number.isSafeInteger(expectedUserId) || expectedUserId < 1) fail('social_identity_not_linked', 401);
  async function get(path) {
    try {
      const response = await fetcher(`${base}/api/v1/${path}`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        const codes = { 401: 'social_session_expired', 403: 'social_access_denied', 404: 'social_not_found', 429: 'social_rate_limited' };
        fail(codes[response.status] || 'social_provider_unavailable', codes[response.status] ? response.status : 502);
      }
      return await boundedJson(response);
    } catch (error) {
      if (error instanceof SocialError) throw error;
      fail('social_provider_unavailable');
    }
  }
  async function me() {
    const user = await get('auth/current');
    if (id(user?.id) !== expectedUserId) fail('social_identity_mismatch', 403);
    return { id: user.id, name: text(user.display_name, 250) };
  }
  const space = value => ({ id: id(value?.id), name: text(value.name, 250), description: text(value.description ?? '', 20000) });
  return Object.freeze({
    me,
    async spaces(page = 1) {
      pageNumber(page); await me();
      return collection(await get(`space?page=${page}&limit=20`), space);
    },
    async posts(spaceId, page = 1) {
      if (!Number.isSafeInteger(spaceId) || spaceId < 1) fail('invalid_space', 400);
      pageNumber(page); await me();
      // A space ID is NOT its content container ID. Resolve it under this user's token.
      const current = await get(`space/${spaceId}`);
      if (id(current?.id) !== spaceId) fail();
      const container = id(current.contentcontainer_id);
      const posts = collection(await get(`post/container/${container}?page=${page}&limit=20`), value => ({
        id: id(value?.id), message: text(value.message, 100000),
      }));
      return { space: space(current), ...posts };
    },
  });
}

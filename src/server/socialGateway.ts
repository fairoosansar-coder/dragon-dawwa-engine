import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHumHubClient, SocialError } from '../../integrations/social/humhub-client.mjs';

export interface SocialActor { humhubUserId: number; token: string; appUserId?: string; role?: string }
interface Options {
  resolveActor?: (req: IncomingMessage) => Promise<SocialActor | null>;
  origin?: () => string | undefined; fetcher?: typeof fetch;
  reviewEnabled?: boolean; publicOrigin?: string;
}
const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
async function body(req: IncomingMessage) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.from(chunk); size += bytes.length;
    if (size > 32000) throw new SocialError('social_request_too_large', 413);
    chunks.push(bytes);
  }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new SocialError('invalid_social_json', 400); }
}
// Defaults remain fail-closed. Only an isolated staging host may opt into reviewed writes.
export function createSocialMiddleware({ resolveActor = async () => null, origin = () => process.env.HUMHUB_ORIGIN,
  fetcher = fetch, reviewEnabled = false, publicOrigin }: Options = {}) {
  return async function socialMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = new URL(req.url || '/', 'http://local');
    if (!url.pathname.startsWith('/api/social/')) return next();
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Vary', 'Cookie');
    const send = (status: number, data: unknown) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    const write = req.method === 'POST';
    if (req.method === 'GET' && url.pathname === '/api/social/config') return send(200, { reviewEnabled, loginPath: reviewEnabled ? '/auth/login' : null });
    if (req.method !== 'GET' && (!write || !reviewEnabled)) return send(405, { error: 'social_writes_not_enabled' });
    const readRoutes = ['/api/social/me', '/api/social/spaces', '/api/social/posts', ...(reviewEnabled ? ['/api/social/post','/api/social/reviews','/api/social/submissions'] : [])];
    if (write ? !['/api/social/submissions','/api/social/reviews'].includes(url.pathname) : !readRoutes.includes(url.pathname))
      return send(404, { error: 'social_route_not_found' });
    if (write) {
      if (!publicOrigin || req.headers?.origin !== publicOrigin || req.headers?.host !== new URL(publicOrigin).host ||
          req.headers?.['sec-fetch-site'] === 'cross-site' || req.headers?.['content-type']?.split(';')[0] !== 'application/json')
        return send(403, { error: 'same_origin_json_required' });
      const length = Number(req.headers?.['content-length'] || 0);
      if (!Number.isSafeInteger(length) || length < 0 || length > 32000) return send(413, { error: 'social_request_too_large' });
    }
    try {
      const actor = await resolveActor(req);
      if (!actor) return send(401, { error: 'social_account_link_required' });
      const reviewer = ['reviewer', 'owner'].includes(actor.role || '');
      const submitter = ['author', 'reviewer', 'publisher', 'owner'].includes(actor.role || '');
      if (url.pathname === '/api/social/reviews' && !reviewer) return send(403, { error: 'social_review_forbidden' });
      if (url.pathname === '/api/social/submissions' && !submitter)
        return send(403, { error: 'social_submit_forbidden' });
      const target = origin();
      if (!target) return send(503, { error: 'humhub_not_configured' });
      const client = createHumHubClient({ origin: target, token: actor.token, expectedUserId: actor.humhubUserId, fetcher });
      const page = Number(url.searchParams.get('page') || 1);
      const space = Number(url.searchParams.get('space'));
      if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return send(400, { error: 'invalid_page' });
      if (write) {
        const input = await body(req);
        if (url.pathname.endsWith('/submissions')) {
          if (!positive(input.spaceId) || typeof input.message !== 'string' || !input.message.trim() || Buffer.byteLength(input.message) > 12000 ||
              typeof input.requestKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(input.requestKey) ||
              !Array.isArray(input.sources) || input.sources.length > 8) return send(400, { error: 'invalid_submission' });
          for (const source of input.sources) {
            if (typeof source !== 'string' || source.length > 2000) return send(400, { error: 'invalid_sources' });
            let ref: URL; try { ref = new URL(source); } catch { return send(400, { error: 'invalid_sources' }); }
            if (ref.protocol !== 'https:' || ref.username || ref.password || /[\x00-\x20\x7f]/.test(source)) return send(400, { error: 'invalid_sources' });
          }
          // Project only allowed fields; browser roles/user IDs never reach HumHub.
          return send(200, await client.submit({ spaceId: input.spaceId, message: input.message, sources: input.sources, requestKey: input.requestKey }));
        }
        if (!positive(input.reviewId) || !['approved','rejected'].includes(input.decision) || typeof input.note !== 'string' ||
            !input.note.trim() || Buffer.byteLength(input.note) > 4000) return send(400, { error: 'invalid_review_decision' });
        return send(200, await client.decide(input.reviewId, input.decision, input.note));
      }
      if (url.pathname.endsWith('/me')) return send(200, { ...await client.me(), canReview: reviewEnabled && reviewer,
        canSubmit: reviewEnabled && ['author','reviewer','publisher','owner'].includes(actor.role || ''), reviewEnabled });
      if (url.pathname.endsWith('/spaces')) return send(200, await client.spaces(page));
      if (url.pathname.endsWith('/post')) {
        const postId = Number(url.searchParams.get('id'));
        if (!positive(postId)) return send(400, { error: 'invalid_post' });
        return send(200, await client.approvedPost(postId));
      }
      if (url.pathname.endsWith('/submissions')) {
        if (!positive(space)) return send(400, { error: 'invalid_space' });
        if (['userId','user','authorId','author_id','author','status'].some(key => url.searchParams.has(key)) ||
            url.searchParams.getAll('includeApproved').length > 1) return send(400, { error: 'invalid_submission_filter' });
        const includeApproved = url.searchParams.get('includeApproved');
        if (includeApproved !== null && includeApproved !== '1') return send(400, { error: 'invalid_submission_filter' });
        return send(200, await client.ownSubmissions(space, page, includeApproved === '1'));
      }
      if (!positive(space)) return send(400, { error: 'invalid_space' });
      const result = url.pathname.endsWith('/reviews') ? await client.reviewQueue(space, page)
        : reviewEnabled ? await client.approvedPosts(space, page) : await client.posts(space, page);
      send(200, result);
    } catch (error) { send(error instanceof SocialError ? error.status : 502,
      { error: error instanceof SocialError ? error.code : 'social_provider_unavailable' }); }
  };
}
export const socialMiddleware = createSocialMiddleware();

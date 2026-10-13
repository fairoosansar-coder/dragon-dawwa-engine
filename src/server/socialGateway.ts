import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHumHubClient, SocialError } from '../../integrations/social/humhub-client.mjs';

export interface SocialActor { humhubUserId: number; token: string }
// The resolver must use the existing verified session and protected account mapping.
// No browser-supplied user ID, shared admin token or development bypass is accepted.
export function createSocialMiddleware({ resolveActor = async () => null, origin = () => process.env.HUMHUB_ORIGIN, fetcher = fetch }: {
  resolveActor?: (req: IncomingMessage) => Promise<SocialActor | null>;
  origin?: () => string | undefined;
  fetcher?: typeof fetch;
} = {}) {
  return async function socialMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = new URL(req.url || '/', 'http://local');
    if (!url.pathname.startsWith('/api/social/')) return next();
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Vary', 'Cookie');
    const send = (status: number, data: unknown) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    if (req.method !== 'GET') return send(405, { error: 'social_writes_not_enabled' });
    if (!['/api/social/me','/api/social/spaces','/api/social/posts'].includes(url.pathname)) return send(404, { error: 'social_route_not_found' });
    try {
      const actor = await resolveActor(req);
      if (!actor) return send(401, { error: 'social_account_link_required' });
      const target = origin();
      if (!target) return send(503, { error: 'humhub_not_configured' });
      const client = createHumHubClient({ origin: target, token: actor.token, expectedUserId: actor.humhubUserId, fetcher });
      const page = Number(url.searchParams.get('page') || 1);
      const result = url.pathname.endsWith('/me') ? await client.me() : url.pathname.endsWith('/spaces') ? await client.spaces(page) : await client.posts(Number(url.searchParams.get('space')), page);
      send(200, result);
    } catch (error) { send(error instanceof SocialError ? error.status : 502, { error: error instanceof SocialError ? error.code : 'social_provider_unavailable' }); }
  };
}
export const socialMiddleware = createSocialMiddleware();

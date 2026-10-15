import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { SocialError, validateOrigin } from '../../integrations/social/humhub-client.mjs';
import { createSocialMiddleware, type SocialActor } from './socialGateway.ts';

const ROLES = new Set(['owner','reader','author','reviewer','publisher']);
export interface VerifiedSession { id: string; role: string }
interface LinkedAccount { humhubUserId: number; token: string; disabled?: boolean }
// VerifiedSession must include signature, expiry, database revocation and current DB role checks.
export function createTrustedSocialResolver({ verifySession, lookupAccount }: {
  verifySession: (req: IncomingMessage) => Promise<VerifiedSession | null>;
  lookupAccount: (id: string) => Promise<LinkedAccount | null>;
}) {
  return async (req: IncomingMessage): Promise<SocialActor | null> => {
    const session = await verifySession(req);
    if (!session || typeof session.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,191}$/.test(session.id) || !ROLES.has(session.role)) return null;
    const linked = await lookupAccount(session.id);
    if (!linked || linked.disabled || !Number.isSafeInteger(linked.humhubUserId) || linked.humhubUserId < 1 ||
        typeof linked.token !== 'string' || !linked.token.trim() || linked.token.length > 4096 || /[\r\n]/.test(linked.token)) return null;
    return { appUserId: session.id, role: session.role, humhubUserId: linked.humhubUserId, token: linked.token };
  };
}
function isolatedOrigin(value: string | undefined) {
  const origin = validateOrigin(value);
  const host = new URL(origin).hostname;
  if (host === 'dragondawwa.org' || host.endsWith('.dragondawwa.org')) throw new SocialError('production_origin_forbidden', 503);
  return origin;
}
export function configuredStagingSocialMiddleware(env = process.env, fetcher = fetch) {
  if (env.UMMAH_SOCIAL_ENVIRONMENT !== 'isolated-staging') return createSocialMiddleware();
  let publicOrigin: string, identityOrigin: string, humhubOrigin: string;
  try {
    publicOrigin = isolatedOrigin(env.UMMAH_PUBLIC_ORIGIN);
    identityOrigin = isolatedOrigin(env.UMMAH_IDENTITY_ORIGIN);
    humhubOrigin = isolatedOrigin(env.HUMHUB_ORIGIN);
    if (!env.UMMAH_ACCOUNT_MAP_FILE || env.UMMAH_IDENTITY_ENVIRONMENT !== 'isolated-staging') throw new Error();
  } catch {
    return createSocialMiddleware({ resolveActor: async () => { throw new SocialError('isolated_social_configuration_required', 503); } });
  }
  const resolveActor = createTrustedSocialResolver({
    async verifySession(req) {
      if (req.headers?.host !== new URL(publicOrigin).host) return null;
      // Forward only this application's cookie, never other browser cookies or browser claims.
      const matches = (req.headers.cookie || '').split(';').map(s => s.trim()).filter(s => s.startsWith('webdev_app_session='));
      if (matches.length !== 1 || matches[0].length > 8100 || /[\r\n]/.test(matches[0])) return null;
      let response: Response;
      try { response = await fetcher(identityOrigin + '/api/review/session', { method: 'GET', redirect: 'error',
        signal: AbortSignal.timeout(10000), headers: { Host: new URL(publicOrigin).host, Cookie: matches[0], Accept: 'application/json' } }); }
      catch { throw new SocialError('identity_authority_unavailable', 503); }
      if ([401,403].includes(response.status)) { await response.body?.cancel(); return null; }
      if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')) {
        await response.body?.cancel(); throw new SocialError('identity_authority_unavailable', 503);
      }
      const reader = response.body?.getReader(); if (!reader) throw new SocialError('identity_authority_unavailable', 503);
      let size = 0; const chunks: Uint8Array[] = [];
      for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.length;
        if (size > 16000) { await reader.cancel(); throw new SocialError('identity_authority_unavailable', 503); } chunks.push(value); }
      try { const data = JSON.parse(Buffer.concat(chunks).toString('utf8')); return data.user || null; }
      catch { throw new SocialError('identity_authority_unavailable', 503); }
    },
    async lookupAccount(id) {
      // Operator-controlled secret file: re-read on every request so removal/revocation is immediate.
      try {
        const path = env.UMMAH_ACCOUNT_MAP_FILE!; const metadata = await stat(path);
        if (!metadata.isFile() || metadata.size > 1048576 || (metadata.mode & 0o077) !== 0) throw new Error();
        const data = JSON.parse(await readFile(path, 'utf8'));
        if (data.schemaVersion !== 1 || !data.accounts || typeof data.accounts !== 'object') throw new Error();
        return Object.hasOwn(data.accounts, id) ? data.accounts[id] : null;
      } catch { throw new SocialError('protected_account_mapping_unavailable', 503); }
    },
  });
  return createSocialMiddleware({ resolveActor, origin: () => humhubOrigin, fetcher, reviewEnabled: true, publicOrigin });
}

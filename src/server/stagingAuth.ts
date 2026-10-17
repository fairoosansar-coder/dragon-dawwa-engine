import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateOrigin } from '../../integrations/social/humhub-client.mjs';
import { fetchPrivateIdentity } from './privateIdentityTransport.ts';
const paths = new Set(['/auth/login','/auth/callback','/auth/logout','/auth/logout-all','/api/review/session']);
const cookies = (value: string) => value.split(';').map(s => s.trim()).filter(s => /^(webdev_app_session|__Host-dd_oidc_flow)=/.test(s)).join('; ');
export function configuredStagingAuthMiddleware(env = process.env, fetcher = fetchPrivateIdentity) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url || '/', 'http://local');
    if (!paths.has(url.pathname) || env.UMMAH_SOCIAL_ENVIRONMENT !== 'isolated-staging') return next();
    const send = (status:number, text:string) => {res.statusCode=status;res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(text);};
    let publicOrigin:string, upstream:string;
    try {
      publicOrigin = validateOrigin(env.UMMAH_PUBLIC_ORIGIN); upstream = validateOrigin(env.UMMAH_IDENTITY_ORIGIN);
      for (const origin of [publicOrigin,upstream]) {
        const host = new URL(origin).hostname;
        if (host === 'dragondawwa.org' || host.endsWith('.dragondawwa.org')) throw new Error();
      }
      if (env.UMMAH_IDENTITY_ENVIRONMENT !== 'isolated-staging' || req.headers.host !== new URL(publicOrigin).host || url.search.length > 5000) throw new Error();
    } catch {return send(503,'Isolated staging authentication is not configured.');}
    const write = req.method === 'POST';
    if (!['GET','POST'].includes(req.method || '') || (write && !['/auth/logout','/auth/logout-all'].includes(url.pathname))) return send(405,'Method not allowed.');
    if (write && (req.headers.origin !== publicOrigin || req.headers['sec-fetch-site'] === 'cross-site')) return send(403,'Same-origin request required.');
    try {
      const parts:Buffer[]=[];let length=0;
      if (write) for await (const chunk of req) {const part=Buffer.from(chunk);length+=part.length;if(length>2048)return send(413,'Request too large.');parts.push(part);}
      const response = await fetcher(upstream+url.pathname+url.search, {method:req.method,redirect:'manual',signal:AbortSignal.timeout(10000),
        headers:{Host:new URL(publicOrigin).host,Accept:req.headers.accept || 'text/html,application/json',Cookie:cookies(req.headers.cookie || ''),
          ...(write ? {Origin:publicOrigin,'Content-Type':req.headers['content-type'] || 'application/x-www-form-urlencoded'} : {})},
        ...(write ? {body:Buffer.concat(parts)} : {})});
      const location = response.headers.get('location');
      if (location) {
        const dest = new URL(location,publicOrigin);
        if (dest.origin !== publicOrigin && !(dest.protocol === 'https:' && dest.hostname === 'accounts.google.com' && url.pathname === '/auth/login')) {
          await response.body?.cancel();return send(502,'Authentication redirect unavailable.');
        }
        res.setHeader('Location',location);
      }
      res.statusCode=response.status;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',response.headers.get('content-type') || 'text/plain');
      const setCookies = response.headers.getSetCookie();
      if (setCookies.some(c => (!/^(webdev_app_session|__Host-dd_oidc_flow)=/.test(c)
          && !(/^dd_oauth_nonce=;/.test(c) && /;\s*Max-Age=0(?:;|$)/i.test(c))) || /;\s*Domain=/i.test(c))) {
        await response.body?.cancel();return send(502,'Authentication cookie unavailable.');
      }
      if(setCookies.length)res.setHeader('Set-Cookie',setCookies);
      const reader=response.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
      if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>64000){await reader.cancel();return send(502,'Authentication response unavailable.');}chunks.push(value);}
      res.end(Buffer.concat(chunks));
    } catch {return send(503,'Staging identity authority unavailable.');}
  };
}

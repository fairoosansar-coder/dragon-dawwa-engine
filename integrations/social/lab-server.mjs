// Isolated loopback lab. Not the production identity bridge or a public server.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHumHubClient, SocialError, validateOrigin } from './humhub-client.mjs';

export function createLabServer({ env = process.env, fetcher = fetch } = {}) {
  const assets = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']]]);
  const server = createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    // Host protection prevents DNS rebinding; Origin/fetch metadata block cross-site reads.
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin) ||
        (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) return send(403, { error: 'local_lab_only' });
    if (req.method !== 'GET') return send(405, { error: 'read_only_lab' });
    try {
      const url = new URL(req.url, origin);
      const asset = assets.get(url.pathname);
      if (asset) {
        const content = await readFile(new URL(`./lab/${asset[0]}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` }); res.end(content); return;
      }
      if (url.pathname === '/api/status') return send(200, { mode: 'isolated-read-only', configured: env.SOCIAL_TEST_ISOLATED === 'true' && !!env.SOCIAL_TEST_ORIGIN && !!env.SOCIAL_MEMBER_TOKEN && !!env.SOCIAL_MEMBER_ID });
      if (!['/api/me', '/api/spaces', '/api/posts'].includes(url.pathname)) return send(404, { error: 'not_found' });
      if (env.SOCIAL_TEST_ISOLATED !== 'true') return send(503, { error: 'isolated_social_instance_required' });
      if (!env.SOCIAL_TEST_ORIGIN || !env.SOCIAL_MEMBER_TOKEN || !env.SOCIAL_MEMBER_ID) return send(503, { error: 'social_not_configured' });
      // Do not permit accidental recursion through the lab itself.
      if (validateOrigin(env.SOCIAL_TEST_ORIGIN) === origin) return send(503, { error: 'invalid_social_origin' });
      const client = createHumHubClient({ origin: env.SOCIAL_TEST_ORIGIN, token: env.SOCIAL_MEMBER_TOKEN, expectedUserId: Number(env.SOCIAL_MEMBER_ID), fetcher });
      const page = Number(url.searchParams.get('page') || 1);
      const data = url.pathname === '/api/me' ? await client.me() : url.pathname === '/api/spaces' ? await client.spaces(page) : await client.posts(Number(url.searchParams.get('space')), page);
      send(200, data);
    } catch (error) {
      send(error instanceof SocialError ? error.status : 500, { error: error instanceof SocialError ? error.code : 'social_lab_error' });
    }
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.SOCIAL_LAB_PORT || 3100);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid SOCIAL_LAB_PORT');
  const server = createLabServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Lab port already in use; select another SOCIAL_LAB_PORT.' : 'Lab could not start.'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Community integration lab: http://127.0.0.1:${port}`));
}

import type { Server } from 'node:http';

/** Public origin for logs and Vite HMR when the process is inside GitHub Codespaces. */

export function codespaceForwardedHost(port: number): string | undefined {
  const name = process.env.CODESPACE_NAME?.trim();
  if (!name) return undefined;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN?.trim() || 'app.github.dev';
  return `${name}-${port}.${domain}`;
}

export function publicAppUrl(port = Number(process.env.PORT ?? 3000)): string {
  const host = codespaceForwardedHost(port);
  return host ? `https://${host}` : `http://localhost:${port}`;
}

export function viteDevServerOptions(port = Number(process.env.PORT ?? 3000), httpServer?: Server) {
  const inCodespace = Boolean(codespaceForwardedHost(port));
  const disableHmr = process.env.DISABLE_HMR === 'true';
  // Do not set ws.host to the *.app.github.dev name. Vite binds its socket to
  // that value, and the name resolves to a public IP this machine cannot listen on.
  const ws = disableHmr
    ? (false as const)
    : {
        ...(httpServer ? { server: httpServer } : {}),
        ...(inCodespace ? { protocol: 'wss' as const, clientPort: 443 } : {}),
      };
  return {
    host: true,
    allowedHosts: true as const,
    ...(disableHmr ? { hmr: false as const } : {}),
    ...(ws === false || Object.keys(ws).length > 0 ? { ws } : {}),
    watch: disableHmr ? null : {},
  };
}

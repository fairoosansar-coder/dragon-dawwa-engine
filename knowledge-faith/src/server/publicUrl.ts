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

export function viteDevServerOptions(port = Number(process.env.PORT ?? 3000)) {
  const codespaceHost = codespaceForwardedHost(port);
  const disableHmr = process.env.DISABLE_HMR === 'true';
  return {
    host: true,
    allowedHosts: true as const,
    hmr: disableHmr
      ? false
      : codespaceHost
        ? { protocol: 'wss' as const, host: codespaceHost, clientPort: 443 }
        : true,
    watch: disableHmr ? null : {},
  };
}

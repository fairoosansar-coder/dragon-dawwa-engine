import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteDevServerOptions } from './src/server/publicUrl.ts';

function loadBuildInfo(): { sha: string; builtAt: string } {
  try {
    const parsed = JSON.parse(readFileSync(new URL('./build-info.json', import.meta.url), 'utf8')) as {
      sha?: unknown;
      builtAt?: unknown;
    };
    if (typeof parsed.sha === 'string' && typeof parsed.builtAt === 'string') {
      return { sha: parsed.sha, builtAt: parsed.builtAt };
    }
  } catch {
    // Dev server before `npm run build` has no stamp file.
  }
  return { sha: 'dev', builtAt: 'not-built' };
}

const buildInfo = loadBuildInfo();

export default defineConfig({
  define: {
    __DD_BUILD_SHA__: JSON.stringify(buildInfo.sha),
    __DD_BUILD_TIME__: JSON.stringify(buildInfo.builtAt),
  },
  plugins: [react(), tailwindcss()],
  server: viteDevServerOptions(),
});

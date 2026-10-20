import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteDevServerOptions } from './src/server/publicUrl.ts';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: viteDevServerOptions(),
});

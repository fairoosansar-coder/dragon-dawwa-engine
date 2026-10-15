import { ummahStudyMiddleware } from './src/server/ummahStudy.ts';
import { ummahQuranMiddleware } from './src/server/ummahQuran.ts';
import tailwindcss from '@tailwindcss/vite';
import { mediaMiddleware } from './src/server/mediaMiddleware.ts';
import { configuredStagingSocialMiddleware } from './src/server/socialIdentity.ts';
import { configuredStagingAuthMiddleware } from './src/server/stagingAuth.ts';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';
import { executeDragonDawwaAnalysis } from './src/server/hadithEngine.ts';
import { synthesizeGeminiVoice } from './src/server/geminiTtsService.ts';

dotenv.config();

function dragonDawwaApiPlugin(): Plugin {
  return {
    name: 'dragon-dawwa-api-plugin',
    configureServer(server) {
      server.middlewares.use(configuredStagingAuthMiddleware());
      server.middlewares.use(configuredStagingSocialMiddleware());
      server.middlewares.use(mediaMiddleware);
      server.middlewares.use(ummahQuranMiddleware);
      server.middlewares.use(ummahStudyMiddleware);
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/analyze' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const { hadith_input, isnad_input, preferred_language } = parsed;
              if (!hadith_input || typeof hadith_input !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'hadith_input is required' }));
                return;
              }
              const result = await executeDragonDawwaAnalysis(hadith_input, isnad_input, ['ta', 'si'].includes(preferred_language) ? preferred_language : 'en');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              console.error('Dragon Dawwa Vite API Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Analysis failed' }));
            }
          });
          return;
        }

        if (req.url === '/api/tts' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const { text, speaker, voiceName } = parsed;
              if (!text || typeof text !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'text is required' }));
                return;
              }
              const result = await synthesizeGeminiVoice(text, speaker || 'Host', voiceName);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              console.error('Gemini TTS Vite API Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'TTS generation failed' }));
            }
          });
          return;
        }

        if (req.url === '/api/health' && req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'online',
            engine: 'Dragon Dawwa v2.5 with Gemini TTS',
            hasKey: !!process.env.GEMINI_API_KEY,
          }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), dragonDawwaApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

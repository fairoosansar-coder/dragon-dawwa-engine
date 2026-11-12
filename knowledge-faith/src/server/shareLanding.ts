import type { Request, Response } from 'express';
import { toLang, type Lang } from '../shared/sources.ts';
import { getHadith } from './hadith.ts';
import { loadHadeeth } from './hadeethenc.ts';
import { getVerses } from './quran.ts';

function requestPublicOrigin(req: Request): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  const proto =
    typeof protoHeader === 'string' && protoHeader.trim()
      ? protoHeader.split(',')[0].trim()
      : 'https';
  const host =
    typeof hostHeader === 'string' && hostHeader.trim()
      ? hostHeader.split(',')[0].trim()
      : process.env.RAILWAY_PUBLIC_DOMAIN || 'dragon-dawwa-production.up.railway.app';
  return `${proto}://${host}`;
}

function escapeHtml(raw: string): string {
  return (raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildVerseOgSvg(input: {
  badge: string;
  arabic: string;
  translation: string;
}): string {
  const safeBadge = escapeHtml(input.badge.slice(0, 64));
  const safeAr = escapeHtml(input.arabic.slice(0, 220));
  const safeTr = escapeHtml(input.translation.slice(0, 260));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#031812"/>
      <stop offset="50%" stop-color="#073C30"/>
      <stop offset="100%" stop-color="#041B14"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="28" y="28" width="1144" height="574" rx="22" fill="none" stroke="#D4AF37" stroke-width="2" stroke-opacity="0.55"/>
  <rect x="42" y="42" width="1116" height="546" rx="16" fill="none" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.28"/>
  <text x="80" y="96" fill="#D4AF37" font-family="Cinzel, Cormorant Garamond, Inter, sans-serif" font-size="22" font-weight="700" letter-spacing="2">✦ ${safeBadge}</text>
  <text x="600" y="265" fill="#FFFFFF" font-family="Amiri Quran, serif" font-size="42" text-anchor="middle" direction="rtl">${safeAr}</text>
  <line x1="480" y1="330" x2="720" y2="330" stroke="#D4AF37" stroke-opacity="0.45" stroke-width="1.5"/>
  <text x="600" y="410" fill="#F3E8C8" font-family="Cinzel, Cormorant Garamond, Arima, Kavivanar, Gemunu Libre, Abhaya Libre, serif" font-size="24" text-anchor="middle">“${safeTr}”</text>
  <text x="80" y="560" fill="#D4AF37" fill-opacity="0.8" font-family="Plus Jakarta Sans, Inter, sans-serif" font-size="18" font-weight="600">DRAGON DAWWA · Institutional Research Studio</text>
  <text x="1120" y="560" fill="#D4AF37" fill-opacity="0.8" font-family="Plus Jakarta Sans, Inter, sans-serif" font-size="18" text-anchor="end">dragondawwa.com</text>
</svg>`;
}

function buildShareHtmlPage(input: {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImageUrl: string;
  redirectHash: string;
}): string {
  const t = escapeHtml(input.title);
  const d = escapeHtml(input.description);
  const c = escapeHtml(input.canonicalUrl);
  const img = escapeHtml(input.ogImageUrl);
  const hashJson = JSON.stringify(input.redirectHash);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="DRAGON DAWWA" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${c}" />
  <meta property="og:image" content="${img}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
</head>
<body style="margin:0;background:#041B14;color:#F3E8C8;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center;">
  <div style="max-width:560px;border:1px solid rgba(212,175,55,0.45);border-radius:20px;padding:28px;background:#073C30;">
    <p style="color:#D4AF37;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;margin:0 0 8px;">✦ DRAGON DAWWA</p>
    <h1 style="font-size:20px;margin:0 0 12px;color:#FFFFFF;">${t}</h1>
    <p style="font-size:15px;line-height:1.7;margin:0 0 18px;color:#F3E8C8;white-space:pre-wrap;">${d}</p>
    <a href="/${escapeHtml(input.redirectHash)}" style="display:inline-block;background:#D4AF37;color:#031812;font-weight:700;font-size:13px;padding:10px 20px;border-radius:999px;text-decoration:none;">Open in Dragon Dawwa →</a>
  </div>
  <script>
    window.location.replace("/" + ${hashJson});
  </script>
</body>
</html>`;
}

export async function serveVerseShareLanding(req: Request, res: Response): Promise<void> {
  const surah = Math.max(1, Math.min(114, Number(req.params.surah) || 1));
  const ayah = Math.max(1, Math.min(286, Number(req.params.ayah) || 1));
  const lang: Lang = toLang(req.params.lang ?? req.query.lang);
  const origin = requestPublicOrigin(req);

  const verses = await getVerses([{ surah, ayah }], lang).catch(() => []);
  const verse = verses[0];
  const surahName = verse?.surahName || `Surah ${surah}`;
  const arabic = verse?.arabic || '';
  const translation = (verse?.translation || '').replace(/\[\d+\]/g, '').trim();

  const title = `Surah ${surahName} (${surah}:${ayah}) · DRAGON DAWWA`;
  const description = [arabic, translation ? `“${translation}”` : '', `— Surah ${surahName} ${surah}:${ayah}`]
    .filter(Boolean)
    .join('\n\n');
  const edition =
    lang === 'ta' ? 'tamil_omar_brief' : lang === 'si' ? 'sinhalese_mahir' : 'english_rwwad';
  const redirectHash = `#/quran/book?surah=${surah}&ayah=${ayah}&lang=${lang}&edition=${edition}`;
  const canonicalUrl = `${origin}/s/v/${surah}/${ayah}?lang=${lang}`;
  const ogImageUrl = `${origin}/api/og/verse/${surah}/${ayah}?lang=${lang}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(
    buildShareHtmlPage({
      title,
      description,
      canonicalUrl,
      ogImageUrl,
      redirectHash,
    }),
  );
}

export async function serveVerseOgImage(req: Request, res: Response): Promise<void> {
  const surah = Math.max(1, Math.min(114, Number(req.params.surah) || 1));
  const ayah = Math.max(1, Math.min(286, Number(req.params.ayah) || 1));
  const lang: Lang = toLang(req.query.lang);
  const verses = await getVerses([{ surah, ayah }], lang).catch(() => []);
  const verse = verses[0];
  const svg = buildVerseOgSvg({
    badge: `SURAH ${(verse?.surahName || String(surah)).toUpperCase()} ${surah}:${ayah}`,
    arabic: verse?.arabic || '',
    translation: (verse?.translation || '').replace(/\[\d+\]/g, '').trim(),
  });
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(svg);
}

export async function serveHadithShareLanding(req: Request, res: Response): Promise<void> {
  const idOrCollection = String(req.params.id ?? '');
  const numberParam = req.params.number ? Number(req.params.number) : null;
  const lang: Lang = toLang(req.query.lang);
  const origin = requestPublicOrigin(req);

  let title = 'Prophetic Hadith · DRAGON DAWWA';
  let description = 'Verified Prophetic Hadith · Dragon Dawwa Research Studio';
  let redirectHash = `#/hadith?lang=${lang}`;

  if (numberParam && Number.isInteger(numberParam)) {
    const hadith = await getHadith(idOrCollection, numberParam, lang).catch(() => null);
    if (hadith) {
      title = `${hadith.collectionName} #${hadith.number} · DRAGON DAWWA`;
      description = [hadith.arabic || '', hadith.text || ''].filter(Boolean).join('\n\n');
      redirectHash = `#/hadith/collections?book=${encodeURIComponent(hadith.collection)}`;
    }
  } else if (/^\d+$/.test(idOrCollection)) {
    const enc = await loadHadeeth(lang, idOrCollection).catch(() => null);
    if (enc) {
      title = `${enc.title} (HadeethEnc #${enc.id}) · DRAGON DAWWA`;
      description = [enc.arabic || '', enc.text || ''].filter(Boolean).join('\n\n');
      redirectHash = `#/hadith/${enc.id}?lang=${lang}`;
    }
  }

  const canonicalUrl = `${origin}${req.originalUrl}`;
  const ogImageUrl = `${origin}/assets/icon-hadith.jpg`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(
    buildShareHtmlPage({
      title,
      description,
      canonicalUrl,
      ogImageUrl,
      redirectHash,
    }),
  );
}

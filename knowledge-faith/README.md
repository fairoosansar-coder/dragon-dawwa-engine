# Knowledge & Faith · UmmaConnect

A standalone UmmaConnect app for learning from primary Islamic sources in **English, Tamil and Sinhala**. It is self-contained in this folder (own `package.json`, server and build) so it can be moved into its own repository without changes.

## Sections

| Section | What it does | Source |
|---|---|---|
| **Knowledge Hub** | Verse of the day, eight study themes, saved verses/hadith, and *Ask*: a question is answered only from verses and hadith the server retrieves and displays, with per-paragraph citations | AlQuran Cloud, hadith-api, Gemini |
| **Quran Reader** | 114 surahs, Uthmani Arabic + named translation (Saheeh International / Jan Trust Foundation / Naseem Ismail), per-ayah and continuous recitation (Alafasy, Husary, Minshawi), bookmarks, last surah remembered | AlQuran Cloud, islamic.network CDN |
| **Hadith Library** | Nine collections, browse by book or jump to a number, Arabic text, grades exactly as supplied by the source (named grader), Tamil for Bukhari and Muslim, otherwise an explicit English fallback notice | hadith-api (fawazahmed0) |
| **Prayer & Spiritual** | Daily prayer times by city or device location, method and Asr school, next-prayer countdown in the location's timezone, Hijri date, Qibla bearing, tasbih counter | Aladhan |
| **Podcasts & Voice Studio** | Two-voice learning episodes scripted from retrieved sources (or your saved items) with citations, Gemini multi-speaker audio, local episode library, and single-voice narration of any text | Gemini text + TTS |

### Source integrity

- The AI never supplies verse or hadith text. For *Ask* and podcasts the model only nominates references; the server fetches those references from the sources above, discards anything invalid, and passes the fetched text back as a numbered evidence packet.
- Citations that do not resolve to retrieved evidence are removed, and uncited paragraphs are dropped (`src/server/grounding.ts`, covered by `tests/grounding.test.ts`).
- Prompts instruct the model not to give fatwas, not to invent gradings, and to treat user text as untrusted data. AI output is labelled as AI-generated.
- Tamil and Sinhala **interface labels** have not been professionally reviewed; the app says so in the footer. Scripture translations are the named published translations.

## Run

Requires Node 20.19+.

```bash
npm install
cp .env.example .env     # add GEMINI_API_KEY to enable Ask and the studio
npm run dev              # http://localhost:3000 on your machine
```

On **your computer**, open `http://localhost:3000`.

In **GitHub Codespaces**, the app is not on your Mac's localhost. Codespaces forwards port 3000 to a URL like `https://<codespace-name>-3000.app.github.dev` (for example `https://ubiquitous-system-g49wp7r645rwcw5rx-3000.app.github.dev/#/hub`). Use that forwarded URL, or Ports → 3000 in the Codespace. If the page does not load, set port 3000 visibility to **Public**.

Production:

```bash
npm run build
npm start                # serves dist/ and the API on $PORT
```

Without a real `GEMINI_API_KEY` the reader, hadith library and prayer tools work fully; AI sections show a clear "not configured" notice. The roundtable and Voice studio do **not** fall back to the robotic browser system voice — they require Gemini TTS. After saving the key, restart `npm run dev` from this folder and confirm `GET /api/health` returns `"ai": true`.

## Checks

```bash
npm run lint   # TypeScript
npm test       # node:test unit tests
npm run build
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | — | Enables Ask, podcast scripts and Gemini neural voices |
| `PORT` | `3000` | HTTP port |
| `GEMINI_TEXT_MODELS` | `gemini-3.8-flash,gemini-flash-latest,gemini-2.5-flash` | Fallback order for text |
| `GEMINI_TTS_MODELS` | `gemini-3.8-flash-tts,gemini-2.5-flash-preview-tts` | Fallback order for speech |
| `AI_REQUESTS_PER_15_MIN` | `30` | Per-IP limit on AI endpoints |

## Privacy

There are no accounts. Bookmarks, episodes, tasbih count, language and location live in the browser's `localStorage`. Coordinates are rounded to two decimals (about 1 km) before prayer times are requested. Upstream calls go only to a fixed allowlist of hosts and are cached in memory.

## API

`GET /api/health`, `/api/config`, `/api/quran/surahs`, `/api/quran/surah/:n?lang=`, `/api/quran/verses?refs=2:153,96:1-5&lang=`, `/api/hadith/:collection/sections`, `/api/hadith/:collection/section/:n?lang=`, `/api/hadith/:collection/:number?lang=`, `/api/prayer?lat=&lng=&method=&school=`; `POST /api/ask`, `/api/podcast/script`, `/api/voice/narrate`, `/api/voice/dialogue`, `/api/tts`.

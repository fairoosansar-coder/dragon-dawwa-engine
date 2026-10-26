# DRAGON DAWWA

*By Aegis Intelligence*

A standalone learning platform for primary Islamic sources in **English, Tamil and Sinhala**. It has its own `package.json`, server and build, separate from the rest of this repository.

## Sections

| Section | What it does | Source |
|---|---|---|
| **Knowledge Hub** | Verse of the day, eight study themes, saved verses/hadith, and *Ask*: a question is answered only from verses and hadith the server retrieves and displays, with per-paragraph citations | AlQuran Cloud, hadith-api, Gemini |
| **Quran Reader** | 114 surahs, Uthmani Arabic + named translation (Saheeh International / Jan Trust Foundation / Naseem Ismail), per-ayah and continuous recitation (Alafasy, Husary, Minshawi), bookmarks, last surah remembered | AlQuran Cloud, islamic.network CDN |
| **Hadith Library** | Nine collections, browse by book or jump to a number, Arabic text, grades exactly as supplied by the source (named grader). Published Tamil for Bukhari and Muslim. Other collections, and every collection in Sinhala, show a labeled study rendering of the English edition when Gemini is configured; otherwise the English text and a fallback notice | hadith-api (fawazahmed0), Gemini |
| **Five Pillars & Spiritual Life** | Dragon Dawwa hub for Shahadah, Salah, Zakah, fasting, Hajj, and Umrah. Book and plain reading, bookmarks, prayer times, a bearing-based Qibla (live compass only when the device reports true north), a versioned educational zakah preview, and a provisional Hijri calendar with a private fasting planner. `#/prayer` still opens this section. Detailed rulings stay unpublished until a recorded review exists. | AlQuran Cloud for cited verses; Aladhan for calculated times and a calculated Hijri month; on-device tabular Hijri. No metals or FX feed. |
| **Podcasts & Voice Studio** | Two-voice learning episodes scripted from retrieved sources (or your saved items) with citations. Play speaks the first few lines immediately and loads the next speaker while those play. Local episode library, and single-voice narration of any text | Gemini text + TTS |

### Source integrity

- The AI never supplies verse text, and it does not invent hadith for *Ask* or podcasts. The model only nominates references; the server fetches those references from the sources above, discards anything invalid, and passes the fetched text back as a numbered evidence packet.
- Where no published Tamil or Sinhala hadith edition exists, the library can render the fetched English into that language. That rendering is labeled as a study aid. Arabic and grades stay exactly as the source supplied them. Bukhari and Muslim keep their published Tamil editions. If Gemini is not configured, the English text and the fallback notice stay.
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
| `GEMINI_TEXT_MODELS` | `gemini-3.8-flash,gemini-flash-latest,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite` | Fallback order for text |
| `GEMINI_TTS_MODELS` | `gemini-3.8-flash-tts,gemini-2.5-flash-preview-tts` | Fallback order for speech |
| `AI_REQUESTS_PER_15_MIN` | `30` | Per-IP limit on AI endpoints |

## Privacy

There are no accounts. Bookmarks, episodes, tasbih count, language, location, reading progress, fasting notes, and zakah calculations live in the browser's `localStorage`. Coordinates are rounded to two decimals (about 1 km) before prayer times are requested. Upstream calls go only to a fixed allowlist of hosts and are cached in memory. Financial amounts are not written to server logs; the zakah draft endpoint keeps only category names and follow-up questions.

## API

`GET /api/health`, `/api/config`, `/api/quran/surahs`, `/api/quran/surah/:n?lang=`, `/api/quran/verses?refs=2:153,96:1-5&lang=`, `/api/hadith/:collection/sections`, `/api/hadith/:collection/section/:n?lang=`, `/api/hadith/:collection/:number?lang=`, `/api/prayer?lat=&lng=&method=&school=&date=&latAdj=`, `/api/hijri-month?year=&month=`, `/api/analyze/:id`; `POST /api/ask`, `/api/analyze` (returns a job id immediately; poll the GET), `/api/spiritual/zakah-draft`, `/api/podcast/script`, `/api/voice/narrate`, `/api/voice/dialogue`, `/api/tts`.

Hadith research is a long Gemini call. `POST /api/analyze` returns `202` with `{ id, status: "running" }` so a Codespaces or proxy `504` cannot cut the dossier off. The app polls `GET /api/analyze/:id` until `status` is `done` or `error`.

`/api/spiritual/zakah-draft` only suggests calculator fields. It strips amounts and does not return a zakah figure. Saved calculations stay in `localStorage` and are not posted to the server. The wealth profile shipped with the app is an unreviewed educational draft (`dd-wealth-educational` 1.0.0).

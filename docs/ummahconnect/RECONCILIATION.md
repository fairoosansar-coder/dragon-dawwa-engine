# Source reconciliation and integration plan — 2026-10-13

## Reconciled inputs

| Source | Observed revision / evidence | Decision |
|---|---|---|
| dragon-dawwa-engine main | 8267963749c793813cea45da143a05c0bfc06446 | Keep production branch unchanged |
| integration/design-engine | fc2a428d391a573bc37a5893e4b802d35ef7aeb6 | Included in social integration ancestry |
| integration/social-qualification | fe6822ae72950a3639e9acb79380391c582b093f | Development baseline; retains newer feed title/description fix |
| dragon-dawwa-railway-deploy | 5fe2b37ed7e7ca49fe97db8375addd59b4292a89 | Separate Next/vinext, OIDC, Drizzle/MySQL application; do not overwrite or wholesale merge |
| Railway live deployment | Exact running commit and environment not verified | Production release remains blocked until deployment revision and integration contracts are reconciled |
| Approved design | design/UmmahConnect_33_Screen_Offline_Fixed.html; SHA-256 in source-reference.json | 33 screens plus 5 mosque sections imported from supplied source |
| Approved imagery | User's UmmahConnect Islamic App UI Showcase.png | Decorative mosque artwork, never project evidence |

Worktree: dragon-dawwa-ummah. Development branch: integration/ummahconnect-33.
Original working trees and production branches remain unchanged. No database migration, production credential copy, Railway deployment, or production traffic cutover was performed.

## Staged implementation

1. Preserve current source and service behavior. Reconcile references and identify runtime differences before any production merge.
2. Replace the main React entry point with the integrated UmmahConnect navigation and route views. Scope imported styles. Keep the existing Quran, Tafsir, research/dossier, prayer and podcast implementations mounted inside the main app.
3. Mount the existing HumHub adapter through server-only routes. Resolve member identity from a verified existing session when that contract is provided. No shared admin token, browser-supplied identity, fabricated feed, or second social engine.
4. Add charity and mosque interfaces with explicit example/pending labels, local drafts and all five project sections. No live financial or construction claims.
5. Build the same application for an isolated private staging runtime. Reuse existing service functions with request-specific optional keys; Node defaults remain unchanged. No production backend proxy or secret copying.
6. Run existing service tests, navigation contracts, mobile browser audits, staging runtime checks and screenshots. Report hardware Safari and live-provider verification separately.
7. Deliver source branch, private staging, completion matrix, evidence and exact backend dependencies. Production deployment requires a later approval after pending gates are resolved.

## Integration boundaries

- src/main.tsx loads src/ummah/UmmahApp.tsx: this is the main app, not integrations/social/lab.
- App.tsx keeps original knowledge/research/podcast behavior; embedded mode removes duplicate navigation. Existing standalone component remains available to code consumers.
- Existing Express server, database-facing deployment repository, strict RAG pipeline, authentication and deployed services are preserved.
- Optional API key parameters allow staging to reuse service functions without changing their research prompts, schemas, defaults or output logic.
- Vite now exposes existing OCR/transcription functions as well as research, TTS, Quran and Tafsir.
- staging/worker.ts is only a staging hosting adapter. It imports the same service functions. It is not a replacement production architecture.
- An initial sample dossier can still be present in the retained engine. The shell explicitly labels it example content; generated output remains an AI-assisted draft requiring source checks and scholarly review.

## Reproduce locally

Use Node 24 and npm ci. Run npm run dev for the integrated app. Set server-only provider variables using the existing environment mechanism when authorized. Do not put keys in VITE_* variables.

Checks: node node_modules/typescript/bin/tsc --noEmit; node --import tsx --test tests/*.test.ts integrations/social/social.test.mjs; npm run build.

Design regeneration: python scripts/import-ummah-prototype.py design/UmmahConnect_33_Screen_Offline_Fixed.html (requires installed Node dependencies). Generated templates are static trusted source; inline scripts and event attributes are removed. Rich CSS is scoped to the UmmahConnect template area.

## 2026-10-15 continuation reconciliation

- Baseline preserved and bundle-verified: `b09becb513c2701113f28c1bbc5a9151e45ebeff` on `integration/ummahconnect-33`.
- New isolated branch: `development/ummahconnect-moderation-20261015`. This is a fresh continuation, **not recovery of the original 13 Mac-M5 edits**. The original workspace was unavailable and was not altered.
- Railway source inspected at `5fe2b37ed7e7ca49fe97db8375addd59b4292a89`. The retained Next/vinext tree is not by itself the live runtime authority. The declared HTTPS deployment Dockerfile is `deploy/railway/Dockerfile.https`, whose server entrypoint is `server/index.mjs`.
- Account authority: `server/google-auth.mjs` checks Google OIDC issuer and verified subject, derives the stable account reference, requires an enabled current `review_roles` row and issues `webdev_app_session`. `server/auth.mjs` + `server/session.mjs` verify signature, expiry, persistent active session and revocation. No email-created account, browser-supplied role or HumHub token can replace those checks.
- DB authority: `server/db.mjs` enforces `REVIEW_DB_TRANSPORT=railway-internal-wireguard`, the exact project/environment, private host, role-specific credentials and schema `dragon_dawwa_private_railway`. The identity, roles, review records and revocations remain there; HumHub content and new social review rows belong only to the separate HumHub DB.
- Guarded source constants: project `786918bd-4ce1-4075-b763-93c7c6f729a1`, environment `91d899e3-0a5e-4a7f-9bcb-c840f7a22f66`, roles `dd_app`/`dd_migrator`/`dd_backup`. These constants are **observed source configuration**, not proof of the running release or current secrets.
- The staging identity service needs a separately reviewed isolation contract. Simply copying Railway code into a new environment will fail its hard-coded guards; disabling those guards is not an acceptable integration strategy. No Railway auth or DB source was edited here.
- Running Railway service SHA, environment bindings, DB readiness and deployment settings remain unverified in an authenticated dashboard. No production deployment, database operation, account permission change or Aishu runtime operation was made.

New source mounts the same approved main UmmahConnect interface and introduces an opt-in staging-only auth transport + trusted social resolver. Production domains are rejected. The Worker remains fail-closed and is not a proxy to production. HumHub is the sole social engine; it owns the native post, draft state and human-review audit. Later Qdrant/BGE → Docling → PeerTube → charity/mosque tasks remain uninstalled/unqualified and retain the documented order.

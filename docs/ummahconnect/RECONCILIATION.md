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

## Authenticated deployment reconciliation and isolated staging — 2026-10-15

The earlier dashboard-access and running-revision uncertainty is superseded. Read-only authenticated Railway inspection found:

- Production workspace **Dragon Dawwa Private**, project `786918bd-4ce1-4075-b763-93c7c6f729a1`, environment `91d899e3-0a5e-4a7f-9bcb-c840f7a22f66`.
- Active app service `f4e05a23-0190-40c8-bc23-b6cabce6663b`, deployment `0e8b6bfc-aa6f-40c4-ac23-3c6cc10cf8c8`, production domain `dragondawwa.org`.
- Its GitHub metadata links [Railway source commit 5fe2b37ed7e7ca49fe97db8375addd59b4292a89](https://github.com/fairoosansar-coder/dragon-dawwa-railway-deploy/commit/5fe2b37ed7e7ca49fe97db8375addd59b4292a89), branch `main`, message `docs: add phase two execution runbook`.
- Actual builder **Dockerfile**, path `/deploy/railway/Dockerfile.https`; region `asia-southeast1-eqsg3a`; one replica; healthcheck `/healthz`; on-failure restart policy with 10 retries. This confirms the separate `server/index.mjs` HTTPS deployment is the runtime authority, not the retained Next/vinext tree.
- Production MySQL and backup services are present and online/last-run-succeeded in the dashboard. No secret values, production database records or new production permissions were read/copied/changed.

Existing-account identity authority remains the pinned Google subject/issuer mapping plus signature/expiry/DB revocation/current role checks documented above. Production's dedicated schema and role configuration remain authoritative to production, and are **not** reused by staging.

A new separate private empty staging project was prepared: `48d7a4cf-07dc-489b-8a3d-d6d10142b14e`, environment `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`. Its identity package preserves `auth.mjs` and `session.mjs` byte-for-byte, and changes only the three deployment-scope constants in copied `google-auth.mjs`. Provenance hashes and isolation tests are included. Additional startup gates require the new project/environment, audience, private host, non-root identity role, separate schema and database instance marker. The private authority uses same-container loopback; it does not proxy to production.

Staging's new identity schema is `ummah_identity_staging`, role `ummah_identity_app`; HumHub uses `ummah_humhub_staging`, role `ummah_humhub_app`, on a different new MySQL service. App account linkage remains server-only and per-member. No staging credentials, source deployment, volumes or data copying were activated. No production redeploy or Aishu operation occurred.

## Current qualified private bootstrap — 17 October 2026, 04:53 UTC

- **Qualified/deployed native commit:** `66a1adb0052b56a0c094eb43ce0b1259bfc37a4f`, [native CI 39003367427](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/39003367427). **36 HTTP + 16 model** pass with synthetic actors in disposable MySQL/container CI; both images, workers, private paths, first boot, persistent restart, ordinary-guest denial and refusal to initialize over fixture accounts pass. The deliberately duplicated-MPM fault is recovered by exactly-prefork normalization before database startup. No hosted fixture seeder was used.
- **Hosted native deployment:** `5aed714c-4f36-4651-9eb3-6b9e58f647d1` in only project `48d7a4cf-07dc-489b-8a3d-d6d10142b14e` / environment `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`. Protected console confirms the exact source above, `UMMAH_INITIALIZE_HUMHUB=no`, `UMMAH_REVIEW_SPACE_IDS=1`, Apache/queue/cron RUNNING and only `mpm_prefork`. Native private marker mode **0600**, same actual space/container **1/1** after redeployment; **zero users, memberships, posts, grants, reviews, passwords and review events**.
- **Actual scoped SQL:** non-root `ummah_humhub_app@%`, separate `ummah_humhub_staging`, MySQL **8.4.11**, **50 native tables**, **2 append-only audit triggers**, `@@log_bin=0`. No global/SUPER role or PITR/backup guarantee is claimed. Existing three volumes and four service caps are unchanged.
- **Backend HTTPS:** https://ummah-humhub-staging.up.railway.app — a reachable private native backend, **not a working main-app Google flow**. **7/7 actual anonymous-boundary checks** pass: feed, own-submissions, real queue `/api/v1/ummahreview/reviews` and current identity = **401**; protected config/runtime/upload paths = **403**. An initial audit used an invalid `/queue` path (404); that attempt is retained separately and corrected from committed route authority, not represented as an access-control defect. These checks do not test member/excluded identities or human approval.
- **Main application:** https://ummah-app-staging.up.railway.app is still **reserved/offline: HTTP 404, verified TLS**, checked 04:53 UTC. No app deployed commit or working login is claimed. Exact callback remains `https://ummah-app-staging.up.railway.app/auth/callback`.
- **Source/UI:** **47 app + 19 identity**, PHP/shell/lint/build pass. Actual local Chromium **154.0.8037.57** audits all **33 routes**, zero overflow/page errors, six source-interface screenshots including the author-owned pending panel. These are credential-free loopback screenshots with desktop mobile-viewport emulation, **NOT hosted human or physical iPhone Safari evidence**.
- **Not complete:** owner Google sign-in to create the already-authorized separate staging project/Web client; three actual distinct account emails; genuine verified-subject enrollment, scoped native mappings/grants and app deployment; a different human's real approve/reject flow, member/excluded/revocation acceptance; physical iPhone Safari. Placeholder emails are not enrolled. Reviewer remains review-only (`can_submit=0`, `can_review=1`); author cannot review; excluded account receives no membership/grant.
- **Preservation:** production, Aishu, existing auth algorithms, approved design and original 13-file recovery remain unchanged/separate. An accidental **unapplied** function draft from a mistargeted generic text-input attempt was individually discarded before deploy; exactly the four approved services/no extra pending resource remain. The first old image's real duplicate-MPM/502 failure and the settings-triggered old-source redeployment remain documented, not hidden.

Evidence: `evidence/2026-10-17-private-bootstrap/`, particularly `qualified-apache-correction-ci.json`, `hosted-corrected-runtime-verification.json`, `hosted-anonymous-boundary-audit.json`, `hosted-runtime-console.webp` and `screenshots/`. No financial, scholarly or construction fact is certified; Qdrant/BGE → Docling → PeerTube → charity/mosque follow only after the documented social milestone.

Production authentication/deployment authority remains `dragon-dawwa-railway-deploy` at the previously authenticated reconciled revision. No production/main merge, deployment, account or session data operation occurred. The separate staging identity package retains its provenance/isolation/subject/session/role semantics; only native social bootstrap and startup normalization advanced. HumHub owns all social content/reviews/grants/events.

## OAuth configuration update — 17 October 2026, 06:23 UTC

The owner-approved Google consent and single Web client are created in **`ummahconnect-staging-261017`**, **External/Testing**, with basic identity scopes only and exact callback `https://ummah-app-staging.up.railway.app/auth/callback`. The final credentials are privately saved in only the isolated **ummah-app** protected settings: **26 service variables, zero pending changes, Service is offline**. No app deployment, real account enrollment, native grant or human decision was performed.

Two unused temporary secrets surfaced in diagnostic output; both were disabled and deleted before application use/deployment. The final fresh replacement is the only enabled secret, was not returned in output and is not exported. Temporary browser memory/clipboard were cleared. See [Google staging setup](GOOGLE-STAGING.md) for the exact handling record and remaining gates.

**Authorization blind spot addressed:** Google's basic-name/email/profile login exception means its Testing user list is not an application/community allowlist. The existing verified issuer/subject + enabled current database role + session/revocation authority remains mandatory, followed by native membership/grants; no email auto-invites or browser-trusted identities. No additional broad scopes were added to force a Google allowlist.

Fresh source regressions: **47/47 app and 19/19 identity**, zero failures. Native CI remains the prior qualified **36 HTTP + 16 model** at `66a1adb0052b56a0c094eb43ce0b1259bfc37a4f`, run **39003367427**, with synthetic actors. Fresh anonymous HTTPS probes: **main-app /api/health 404**, **native /api/v1/auth/current 401**, verified TLS. These are not genuine Google login/member/reviewer/excluded or physical-device results.

Next: three actual distinct account designations; qualified invitation-required app deployment to observe genuine subjects; deliberate identity/native mappings and scoped grants; different-human approve/reject and negative-access acceptance; physical iPhone Safari. The author cannot review, the reviewer is review-only, the excluded tester gets no community membership/grant. All **33 screen status counts stay 6 locally Working / 20 UI Only / 7 Blocked**. Original 13-file recovery, production, Aishu, approved colors and later-service order remain unchanged/separate.

Evidence: `evidence/2026-10-17-google-staging/`. Earlier dated setup/unready records are history; this update supersedes only their resolved Google creation/credential blocker.

Authentication/deployment authority is unchanged: `dragon-dawwa-railway-deploy` semantics, separate staging identity DB/session secrets and HumHub as the sole social engine. This milestone changes only staging provider configuration and documentation/evidence, not executable auth or native code.

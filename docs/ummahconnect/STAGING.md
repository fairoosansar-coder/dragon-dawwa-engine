# Private staging handoff

Preview: https://ummahconnect-integration-staging.feroz1890.chatgpt.site

Source branch: https://github.com/fairoosansar-coder/dragon-dawwa-engine/tree/integration/ummahconnect-33

This preview is a separate, owner-private Site. It hosts the integrated main application and imports the existing Dragon Dawwa service functions through an isolated staging adapter. It is not the Community Lab, an iframe of the prototype, or a production traffic change. Sign in with the owning ChatGPT account to access the private preview.

No production credentials, database, accounts or HumHub tokens were copied. The deployment has no AI service key and no linked social member, so the UI displays those limits and the server refuses to fabricate results. The existing Node/Express production path is preserved.

Review COMPLETION-MATRIX.md for all 33 screens, BACKEND-GAPS.md for missing contracts, RECONCILIATION.md for source revisions and implementation decisions, and TEST-RESULTS.md for evidence and remaining device gates.

The approved rich emerald/ivory/gold/turquoise theme and supplied prototype were retained. All 33 screens are part of the main route/navigation system. Quran, Tafsir, prayer, research/dossiers and podcasts reuse existing components. The five mosque sections are Current Site, Proposed Design, Construction, Finances and Donations. Local preferences and drafts remain browser-local. Every financial/project example is labelled illustrative.

Status at handoff: 6 Working, 20 UI Only, 7 Blocked. UI integration is available for review; this is not an assertion that all business capabilities are production complete. Real iPhone Safari and live authenticated service acceptance remain release gates.

## 2026-10-15 continuation preview

The preceding URL and branch describe the historical handoff. That hosted deployment **has not been updated** by this continuation.

Current built application preview: http://127.0.0.1:3307/#/screen-4, running on the selected Mac mini only. This is a loopback-only Express service with no production credentials. It is not a public HTTPS staging deployment or a working authenticated HumHub instance. It persists only while the local service and computer remain running. It returns `reviewEnabled=false`, `401 social_account_link_required` for social reads and `405 social_writes_not_enabled` for writes in the unconfigured default mode.

Branch: `development/ummahconnect-moderation-20261015`. Reproduce with Node 24.21.0: `npm ci`, `npm run lint`, `npm run build`, then `PORT=3307 UMMAH_LOCAL_STAGING=true node --import tsx server.ts`. Real staging requires the exact variables, isolated services and account grant contract in `integrations/social/humhub-ummahreview/README.md`. Run `node scripts/test-live-social.mjs` only with protected staging test configuration; it records BLOCKED when prerequisites are missing. Do not supply cookies/tokens in Git or chat.

The Worker can be bundled and regression-tested locally without the absent `.openai/hosting.json`. The script explicitly labels such a bundle test-only and does not generate a replacement hosting manifest. Its write-disabled defaults are unchanged. A separately configured HTTPS host, identity authority and qualified HumHub install are needed before there is a working live-flow URL. Physical iPhone Safari remains untested.

## 2026-10-15 live-staging preparation — current status

The earlier Mac-mini localhost preview is historical and is not treated as running or live. No new HTTPS app URL is currently available.

A separate **private, empty** Railway project was created in the authenticated **Dragon Dawwa Private** workspace:

- Project: **UmmahConnect - Isolated Staging**, `48d7a4cf-07dc-489b-8a3d-d6d10142b14e`.
- Environment: **staging**, `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`.
- [Management console — not an application URL](https://railway.com/project/48d7a4cf-07dc-489b-8a3d-d6d10142b14e?environmentId=1f7d98bf-1d49-4d9f-a5cc-13b57abcc095).

No service, database, volume, source deployment or application domain was activated; paid infrastructure activation awaits an explicit budget decision. Complete isolated build, configuration, database/schema, OIDC provenance and acceptance instructions are in `deployment/staging/README.md`, `railway-plan.json`, `.env.staging.example` and `upstream-lock.json`. Prepared Docker definitions have not yet been build-qualified.

Actual native HumHub tests ran in a separate task sandbox using real PHP/MariaDB and native REST member tokens. They are not a durable HTTPS deployment, real existing-account Google flow or physical-device acceptance. Source branch: `development/ummahconnect-live-staging-20261015`, descended from preserved commit `9fa7f7a8dbc2687250e75f4514ebc1641994e519`. Original 13-file recovery remains separate and has not been discarded or overwritten.

## 2026-10-16 current hosting boundary

New live branch: `development/ummahconnect-native-hardening-20261016`, descended from preserved `226e388` and `9fa7f7a`. The separate Railway project/environment above remains the proposed target, not a running application. **No new HTTPS staging application URL is claimed.**

Read-only policy checks excluded `MEGATON DX` (protected Aishu adapter/control plane; retirement permits only separately approved offline RUNFORGE preparation) and `aegistube-upstream` (exclusively AegisOS/Invidious metadata service). No UmmahConnect source, packages, service or database was added to either. Cloud Computer 2 and Aishu-labelled hosts remain excluded.

Native Docker startup now applies exact core hooks, uses `UMMAH_INITIALIZE_HUMHUB=yes` only for a new empty database and `no` on subsequent starts, applies module migrations and supervises Apache/queue/cron. Standard Linux CI checks the actual pinned MySQL/HumHub containers and persistent restart. Test containers are private/ephemeral and cannot stand in for durable hosting.

Live activation still needs: (1) approval of the four isolated Railway services/two database volumes and metered resource envelope, without shared-workspace production stop limits; (2) a separate protected Google staging Web-client configuration and exact callback after hostname assignment; (3) three designated real author/reviewer/excluded accounts, private community grants and protected subject mapping; (4) hosted end-to-end and physical iPhone Safari evidence. Original 13-file recovery is separate.

## Final native container gate — PASS (16 October 2026)

Qualified runtime source: `558cf5c53775d2412ef3d9f8e1fddcdf9e298d22`. [Actual standard Linux CI run](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/38825959081). The pinned app/HumHub images build, MySQL 8.4 initializes with schema-local role/trigger grants, and **32/32 actual native HTTP + 15/15 native model/file/cache tests pass**. Apache/native queue/cron are running; private configuration/runtime/upload URL checks pass; stop/recreate preserves users, reviews, append-only events and the protected fixture on the same named volumes.

Corrections verified: actual authenticated final-server MySQL readiness; GD codecs needed by native avatars; private supervisor Unix control socket; writable native runtime/asset ownership; base-image sticky-webroot/protected-symlink traversal; resolved-path and URL-level private storage denial. Linux symlink protections and host firewall safeguards were not disabled. Local Docker kernel restriction remains a local limitation, superseded by actual standard-runner container qualification.

**Hosted HTTPS Google login / independent human review / physical iPhone Safari are NOT tested.** CI actors are synthetic; no scholarly review, financial or construction facts are certified. Separate Railway activation/OIDC/account choices and hardware acceptance remain blockers; no app staging URL is claimed. All other selected services remain pending in the documented order.

## Activation update — 16 October 2026, 12:14 UTC

The owner approved the four-service Railway resource envelope, with owner-handled payment steps. In the separate staging environment, `ummah-app` (`f3756510-4e87-445b-9cfb-9dad042d6758`) is now persisted as an **empty offline service**, with **1 vCPU / 1 GB** caps. No source/image, running workload, volume, public app domain or payment action was activated. Three other planned services remain pending.

Railway's existing GitHub connection lists other repositories but its completed exact search reports **No repositories found** for `dragon-dawwa-engine`. The production repository was not substituted. No repository access grant was changed; the correct installation must be inspected/authorized narrowly, retaining all existing grants. Google Cloud project/staging OAuth client and designated author/different human reviewer/excluded account choices remain pending. No HTTPS application URL or hosted login result exists yet. Existing app/native code remains unchanged from the 47-test passing MySQL container qualification; production and Aishu unchanged.

## 2026-10-17 UTC — four saved service slots; HTTPS reserved, not live

This entry supersedes the older current-state statements above. All four planned services are now saved as empty/offline slots in the separate staging project, each with one replica and 1 vCPU / 1 GB caps. Exact IDs and non-secret settings are in `deployment/staging/railway-plan.json` and `RAILWAY-RESOURCE-PREPARATION-20261017.md`. No image/source deployment, database runtime or persistent volume is activated.

**Reserved host:** https://ummah-app-staging.up.railway.app, target port 3000. **Separate Google callback:** `https://ummah-app-staging.up.railway.app/auth/callback`. The hostname's HTTPS certificate verifies, but the readiness request returns **404 / Application not found**. This is not a working staging application or login URL.

The requested repository now appears in Railway's picker, but selecting it redirected to GitHub **Confirm access**. Source attachment and the approved narrow installation grant are not verified. The owner must complete that current security step in the active task browser; do not substitute production source or grant all repositories. Separate staging Google project/client, real author/different human reviewer/excluded account and protected native mappings remain pending. Production, Aishu and the existing 33-screen design are unchanged.

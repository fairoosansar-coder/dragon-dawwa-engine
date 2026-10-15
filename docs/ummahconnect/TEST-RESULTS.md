# Integration test results — 2026-10-13

Staging preview: https://ummahconnect-integration-staging.feroz1890.chatgpt.site

This is an isolated owner-private staging deployment. The existing production site, Railway runtime and database were not changed.

| Check | Result | Scope / limit |
|---|---|---|
| TypeScript | Pass | Existing app plus integrated routes, service mounting and server adapters |
| Service and integration tests | 28 passed | Existing HumHub qualification, Quran audio, Tafsir schema/cache, prayer validation, Gemini failure behavior; new route contracts and fail-closed social gateway |
| Vite production build | Pass | Same main React entry point; existing large-chunk warning remains |
| Staging runtime tests | 3 passed | Integrated app and Quran corpus served; missing AI key = 503; missing social session = 401; writes rejected; unknown API/asset routes fail correctly |
| Mobile Chromium 375 × 812 | Pass | 39 routes (33 screens + 5 mosque tabs + podcasts), 87 imported controls, five mosque tab links; no final page overflow or uncaught JS errors |
| Mobile Chromium 414 × 896 | Pass | Same 39 routes and 87 controls; no page overflow or uncaught JS errors |
| Search and mobile drawer | Pass | “mosque” returns six main-screen matches; drawer expands; project tabs change route |
| 390 × 844 initial audit | Issue found, corrected | Quran Surah card minimum width overflow. Fixed grid child minimum widths; retested at 375 and 414 |
| Real iPhone Safari | NOT RUN / release gate | No real iPhone/Safari session available; Chromium mobile emulation is not Safari |
| Live authenticated end-to-end operations | BLOCKED | Staging account/role mapping, HumHub instance and provider keys not connected |
| Genuine payments/donations/construction records | NOT CLAIMED | No payment attempt, donation receipt, or real construction status was created |

## Browser method

The actual Vite-built JavaScript and CSS were supplied to connected Cloudflare Browser Rendering with mobile/touch viewports. The audit routes through the real React app, clicks every visible imported button/status control, checks nonempty route content, page width, errors, mosque tabs, search and drawer behavior. No fabricated API success responses or payment records were supplied.

The browser was Chrome 119. Its user-agent includes the compatibility word Safari; this is explicitly NOT a Safari test. These tests run an in-memory copy of the built frontend, not an authenticated visit through the private staging access gate. Browser-local persistence across reloads, provider playback, actual geolocation, microphone capture, file upload, real accounts and permissioned transactions require a separate device/provider acceptance pass. Existing adapter/provider unit tests use controlled responses and do not prove live provider availability.

A passing control check means a route, selected tab, amount input focus, or explicit status dialog responds. It does not imply a backend-pending business action completed. Completion status is recorded separately in COMPLETION-MATRIX.md.

## Evidence

- unit-tests.txt: complete 28-test output.
- ummah-test-375-final.json and ummah-test-414.json: route/control results, viewport, browser identity and errors.
- screenshots/: actual browser screenshots, including Home at 375 and Mosque Project at 414.
- scripts/browser-audit.js and scripts/prepare-browser-audit.mjs: repeatable browser audit payload.
- scripts/test-staging.mjs: three runtime checks against the bundled Worker.

## Remaining release gates

1. Reconcile the exact live Railway commit and auth/database API contract.
2. Connect isolated staging authentication and HumHub per-member accounts.
3. Connect approved sandbox service credentials and exercise live research, voice, Tafsir and prayer behavior.
4. Implement the documented missing project, charity and other business capabilities; verify signed payment callbacks in a sandbox.
5. Run real iPhone Safari checks, including touch navigation, session redirects, audio unlock, microphone/camera/location permissions, Arabic rendering, native sharing and safe-area keyboard behavior.
6. Obtain production approval only after these gates pass. No production cutover is included in this change.

## 2026-10-15 moderation continuation — final verified results

| Check | Result | Exact scope |
|---|---|---|
| Clean `npm ci` | PASS | Corrected esbuild `^0.28.2`; lockfile resolves Vite 8.3.4 + esbuild 0.28.2; no force/legacy-peer-deps bypass |
| `npm run lint` | PASS | Full TypeScript including the new resolver, auth transport, UI panels and test fixtures |
| Main Vite build | PASS | Same main UmmahConnect app; existing large-bundle and native-config-loader warnings remain |
| Node service/integration suite | 44/44 PASS | Existing regressions plus controlled two-identity moderation, draft exclusion, rejection, access denial, revocation, retries, CSRF/source/body checks and staging auth transport |
| Worker staging regressions | 3/3 PASS | Actual bundled same-app Worker serves app/corpus and refuses unconfigured auth, writes, AI, payments and invalid routes; test-only bundle because hosting manifest is absent |
| Native PHP syntax parser | 5/5 PASS | PHP 8.3 grammar parsing only; **not** PHP execution, migration or HumHub/MySQL compatibility qualification |
| Actual built browser audit | 33/33 routes PASS | Chrome 155.0.8059.41, 390×844 mobile/touch emulation, zero uncaught page errors and no horizontal overflow; six real screenshots; no mocked API successes |
| Local preview HTTP | PASS | `http://127.0.0.1:3307`: app/health 200, config reports `reviewEnabled=false`, social reads 401 and submissions 405 with no linked services |
| Live staging runner | BLOCKED / exit 2 | Missing live URL, actual author/reviewer sessions, permitted community ID and forbidden community ID; no real post was submitted or approved |
| Real existing-account OIDC callback | NOT RUN | Separate staging authority and callback registration not connected |
| Real HumHub/MySQL human-review flow | NOT RUN | No installed runtime, live member tokens/map or scoped grants; native bypass/concurrency/rollback remain release gates |
| Physical iPhone Safari | NOT RUN | Desktop Chrome mobile emulation is not Safari hardware acceptance |
| Production and Aishu | UNCHANGED | No production deploy, data migration, role change, credential copy or runtime operation |

### What the controlled two-account test actually proves

A real local HTTP gateway is exercised with **controlled** author/reviewer identity callbacks and a simulated HumHub REST provider. It verifies linked identity → community list → draft submission → absence from both approved feeds/direct app detail → author review denial → independent reviewer approval → permitted feed/detail, plus rejection and revocation. It is useful source-contract coverage but **does not prove real OIDC login, HumHub draft-event execution, MySQL transactions or genuine scholarly review**.

### Reproduction and evidence

`npm ci && npm run lint`; `node --import tsx --test tests/*.test.ts integrations/social/social.test.mjs`; `npm run build`. Worker: `node scripts/build-staging.mjs && node --test scripts/test-staging.mjs`; then rerun `npm run build` to restore frontend assets for Express. UI: `node scripts/audit-moderation-ui.mjs` with task-local Playwright and installed Chrome. PHP syntax: `node scripts/check-native-review-syntax.mjs` with task-local php-parser. Live: `node scripts/test-live-social.mjs` with protected real staging configuration.

Final evidence is in `evidence/2026-10-15/`: clean-install, resolved dependencies, typecheck, build, 44-test output, Worker build/tests, PHP grammar checks, browser route audit/screenshots and `live-staging.json` with explicit blocked prerequisites. Earlier failures exposed an outdated provider fixture, required local-network permissions, test/listener TypeScript types and a missing hosting manifest; the final outputs above supersede those failed attempts. The 33-screen completion matrix deliberately does not promote pending social screens to live Working.

## 2026-10-15 native-runtime continuation — supersedes earlier native NOT RUN status

| Test category | Result | Actual boundary |
|---|---|---|
| Existing app source suite | 44/44 PASS | Clean npm ci, TypeScript and Vite production build pass. These are source/controlled tests, not Google login evidence. |
| Isolated identity source suite | 19/19 PASS | New project/environment/schema/role/origin guards, preserved vendor hashes, current role lookup, revocation, audience and duplicate-cookie denial. Database fixtures are controlled in this suite. |
| Actual HumHub HTTP provider | 20/20 PASS | Real HumHub 1.19.0 + checksum-verified REST 0.12.4 + installed review module on PHP 8.3.6 and socket-only MariaDB 10.11.14. Three synthetic native accounts; no simulated provider. Real bearer auth, private-community directory, draft submission, approved-feed/detail, independent reviewer role, rejection, self-review, excluded users and query-token denial exercised. |
| Actual native HumHub model guards | 5/5 PASS | Observed the first persisted Content insert as draft; native publishing/scheduling bypasses fail; approved message edit fails; rejected content cannot publish. Actual Yii models and database, not syntax-only tests. |
| Container/hosted MySQL 8.4 qualification | NOT RUN | Immutable Docker/container definitions prepared, not built/deployed. Native MariaDB qualification does not establish hosted MySQL 8.4 readiness. |
| Hosted HTTPS existing-account Google login + human decision | BLOCKED | New private Railway project is empty. Activation budget, separate Google client, assigned hostnames and owner-designated staging identities/grants are missing. Automated fixture decisions are not human scholarly approval. |
| Physical iPhone Safari | NOT RUN | No actual iPhone session tested. Neither desktop browser nor viewport emulation is a substitute. |
| Production / Aishu | UNCHANGED | Production deployment read-only; no production settings, roles, database, credentials, DNS or Aishu runtime changed. |

Actual runtime testing uncovered and corrected two failures missed by syntax/source tests: REST class-constant resolution during module discovery, and a null sender on the REST class-level route event. The installed module now resolves these using the pinned event name and real REST module instance.

Evidence: `evidence/2026-10-15-native/native-provider-tests.json`, `native-model-guards.json` and source logs in the same directory. Test fixture passwords/tokens, database files and raw Yii environment logs are private and are not committed or delivered. The current UI source is unchanged from preserved commit 9fa7f7a; old Chrome screenshots remain historical UI evidence only. No newly hosted workflow screenshots or real human scholarly approvals are claimed.

## 2026-10-16 native hardening — current results

| Category | Result | Exact boundary |
|---|---|---|
| App source suite | 44/44 PASS | Gateway/provider contracts include simulations; native PHP invariants were updated for guarded draft saving and audited transactions. |
| Identity source suite | 19/19 PASS | Controlled authority/session/database tests, not Google login. |
| TypeScript / main Vite build | PASS | Main 33-screen design unchanged; existing bundle-size warning remains. |
| Actual native HTTP | 32/32 PASS | Real HumHub 1.19.0 / REST 0.12.4 / PHP 8.3.6 / MariaDB 10.11.14, three synthetic identities, four PHP workers. |
| Actual native models/cache/files | 15/15 PASS | First-insert draft; tracked creation; raw publish/schedule/move/visibility/message denial; excluded/pending/rejected reads; File linkage/public-view/delete/replace denials; actual cached-search reauthorization after membership removal. |
| Local pinned Docker qualification | BLOCKED | Real base-image pulls succeeded; first RUN hit missing sandbox kernel iptables raw table. No insecure workaround applied; MySQL was not tested by this local run. |
| Standard Linux CI container qualification | Pending separately recorded run | Exact app/HumHub builds, MySQL 8.4, required workers and persistent restart. A CI pass is not hosted acceptance. |
| Hosted HTTPS Google + another human | BLOCKED | Activation decision, separate OIDC client, hostname and owner-designated subjects/grants missing. |
| Physical iPhone Safari | NOT RUN | No hardware session. Existing Chrome screenshots/emulation remain historical only. |
| Production / Aishu | UNCHANGED | Connected non-Aishu host governance was read only; no workload, firewall, data, DNS or credentials changed there. |

Native HTTP covers actual concurrent duplicate submission, same-key payload conflict, exact decision replay, deleted/content-version conflict, two competing decisions, forced publication rollback, durable failure audit, audit mutation denial, member/token revocation, multipart/attachment denial and no pending/rejected content notifications. The 32/15 results are real runtime operations with explicitly synthetic fixture identities: no generated scholarship, money or construction records.

Evidence: `evidence/2026-10-16-hardening/`. Source/core patches and migrations are checked in; passwords, tokens, raw error pages, private Docker command logs and native database files are excluded. The owned native test services were cleanly stopped after preserving their data.

Current 2026-10-16 UI audit: 154.0.8037.57 desktop Chromium, 390×844 mobile/touch emulation; 33/33 routes, zero page errors/overflow and six actual screenshots of the credential-free main app. Native APIs were not mocked; missing identity/services remained blocked. These are **not hosted flow or physical Safari screenshots**. Evidence: `evidence/2026-10-16-hardening/screenshots/`.

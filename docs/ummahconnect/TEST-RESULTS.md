# Integration test results — 2026-10-13

**Current state (18 October 2026, first real Author draft verified):** user-supplied main-interface submission screenshot is independently corroborated by protected native GETs: post/review #1 exists as pending **HumHub DRAFT (state 10)**, visible in Author own submissions and the independent Reviewer queue; both approved feeds return zero results. The cited test-looking URL is not verified scholarship. No human decision has been observed and no decision was made by the agent. App remains `dae5c666b6b54575ddf2879f2d253f5ec52d121a` / deployment `5a1820b2-36f1-405f-9ef8-3e9a1d98bb34`; native remains `44ee3bb5f39b275de84832e15fa02ae82c7b14f7`. Read-only verification changed no runtime, account, grant, database privilege or resource; production/Aishu and original recovery are preserved. Actual independent human approve/reject, permitted approved visibility, live self-review and excluded-account denial and physical iPhone Safari remain pending. All 33 statuses stay **6 locally Working / 20 UI Only / 7 Blocked**, with screen 5 partial Author submission acceptance now documented. See FIRST-REAL-SUBMISSION.md and evidence/2026-10-18-first-real-submission/. Previous deadline qualification remains in LOGIN-DEADLINE.md.

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

## Final native container gate — PASS (16 October 2026)

Qualified runtime source: `558cf5c53775d2412ef3d9f8e1fddcdf9e298d22`. [Actual standard Linux CI run](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/38825959081). The pinned app/HumHub images build, MySQL 8.4 initializes with schema-local role/trigger grants, and **32/32 actual native HTTP + 15/15 native model/file/cache tests pass**. Apache/native queue/cron are running; private configuration/runtime/upload URL checks pass; stop/recreate preserves users, reviews, append-only events and the protected fixture on the same named volumes.

Corrections verified: actual authenticated final-server MySQL readiness; GD codecs needed by native avatars; private supervisor Unix control socket; writable native runtime/asset ownership; base-image sticky-webroot/protected-symlink traversal; resolved-path and URL-level private storage denial. Linux symlink protections and host firewall safeguards were not disabled. Local Docker kernel restriction remains a local limitation, superseded by actual standard-runner container qualification.

**Hosted HTTPS Google login / independent human review / physical iPhone Safari are NOT tested.** CI actors are synthetic; no scholarly review, financial or construction facts are certified. Separate Railway activation/OIDC/account choices and hardware acceptance remain blockers; no app staging URL is claimed. All other selected services remain pending in the documented order.

## 2026-10-17 UTC — activation preparation validation

- Fresh `npm run lint`: pass.
- Fresh `node --import tsx --test tests/*.test.ts integrations/social/social.test.mjs`: **44/44 pass**; controlled provider/source fixtures only.
- Fresh `npm test --prefix deployment/staging/identity`: **19/19 pass**; no Google login performed.
- Fresh `npm run build`: pass; existing bundle-size warning remains.
- Reserved actual Railway hostname `https://ummah-app-staging.up.railway.app`: HTTPS certificate verifies (`curl` verification result 0); **HTTP 404 / Application not found**. This is a negative readiness result, not a hosted flow pass.
- Four empty service slots were saved with one replica and 1 vCPU / 1 GB caps. No source or database workloads/volumes are active. Repository picker visibility did not prove access: selecting the requested repo redirected to GitHub **Confirm access**.
- Prior actual HumHub/REST/MySQL evidence (**32 HTTP + 15 native model/file/cache**, workers/private paths/persistent restart) remains separately attributed to [CI 38826633944](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/38826633944). It was not rerun on Railway.
- Hosted existing-account login, independent human approval, rejection, self-review denial, excluded users and physical iPhone Safari: **not run / blocked**.

Evidence directory: `evidence/2026-10-17-activation/`. Runtime/UI code remains unchanged from the qualified ancestry; original 13-file recovery is separate. No production/Aishu change or payment action was performed.

## 2026-10-17 UTC — after verified GitHub access and protected source preparation

- Fresh app source/controlled-provider suite: **44/44 pass**.
- Fresh isolated identity source suite: **19/19 pass**; this is not Google login.
- Fresh TypeScript and Vite production build: **pass**, with the existing bundle warning.
- Runtime/UI equivalence: the diff against qualified runtime `558cf5c53775d2412ef3d9f8e1fddcdf9e298d22` contains only staging plan metadata, documentation and evidence. No executable deployment/application/native code changed in this preparation.
- Existing selected-repository grant: `dragon-dawwa-engine` verified; existing Aishu relay/production repository grants unchanged. Correct engine/development branch selections are visible in both service drafts; two private MySQL drafts use the exact qualified image digest. A fresh architecture reload confirms **46 unapplied configuration changes** and all four existing 1 vCPU / 1 GB caps.
- App HTTPS `/api/health`: **404**, TLS verification **0**, checked at `2026-10-17T01:12:08Z`.
- Reserved HumHub HTTPS origin: **404**, TLS verification **0**, checked at `2026-10-17T01:16:11Z`.
- No volume, source deployment, database/bootstrap, real account enrollment or independent human approval was activated. The new Pro-volume capacity mismatch and separate staging identity choices block activation; see `RAILWAY-VOLUME-DECISION-20261017.md`.
- Actual HumHub/REST/MySQL native qualification remains the earlier **32 HTTP + 15 model/file/cache** passes in [CI 38826633944](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/38826633944), including workers, private paths and persistent restart. These were **not** newly rerun on Railway and their actors are explicitly synthetic.
- Hosted HTTPS author login → community → submission → a different human's approval → permitted visibility, rejection, self-review denial and excluded-user acceptance: **not run / blocked**.
- Physical iPhone Safari: **not run**. No new main-interface hardware or live-flow screenshots are claimed; the current screenshot records only Railway's unapplied configuration state.

Evidence: `evidence/2026-10-17-source-preparation/`. New unused app keys inadvertently appeared in a setup diagnostic and were replaced before any deployment or user enrollment; the owned transient diagnostic was removed. Replacement credentials and database/cookie secrets are not exported in this evidence. No production or existing account secret was changed.

Production, Aishu, the 33-screen design and original 13-file recovery remain unchanged/separate. Pending configuration is not a milestone pass.

## 2026-10-17 UTC — approved storage and actual Railway MySQL activation

| Category | Result | Exact boundary |
|---|---|---|
| Persisted volumes | PASS, 3/3 | Three default 50 GB volumes; saved IDs, correct service attachments and mount paths checked in provider settings. Not a whole-application milestone pass. |
| Apply-only configuration | PASS | 55 changes committed by documented Alt-click Deploy; all four services remained offline immediately afterward. Databases were subsequently started individually. |
| Actual identity SQL | PASS | Native Railway console authenticated as non-root `ummah_identity_app@%`; MySQL 8.4.11, `ummah_identity_staging`, initially zero tables. |
| Actual identity schema | PASS | Exact project/environment/schema/user and empty-state guards; four tables and correct instance marker verified; **zero enrolled user roles**. No production data copied. |
| Actual HumHub SQL | PASS | Native Railway console authenticated as non-root `ummah_humhub_app@%`; MySQL 8.4.11, separate `ummah_humhub_staging`; schema-local grants verified. Native table count **0**: this is database readiness, not installed live HumHub. |
| App source/controlled suite | PASS, 44/44 | Fresh run; controlled provider/session cases are not Google login. |
| Identity source suite | PASS, 19/19 | Fresh run; simulated database/session fixtures are separate from the SQL probes above. |
| TypeScript / Vite build | PASS | Fresh checks; existing large-chunk warning remains. No runtime/UI changes. |
| Prior actual native CI | PASS, 32 HTTP + 15 model/file/cache | Earlier actual HumHub/REST/MySQL tests in CI 38826633944, synthetic actors; **not newly rerun on Railway**. |
| Reserved HTTPS readiness | NOT READY | App `/api/health` and HumHub `/api/v1/auth/current`: **HTTP 404**, valid TLS (verification 0), checked `2026-10-17T02:25:58Z`. |
| Hosted Google → post → another human → permitted visibility | NOT RUN / BLOCKED | Separate Google client, designated real accounts, native community/grants/tokens and app/HumHub bootstrap/deployment remain pending. Rejection, self-review and excluded-user tests are not claimed as live passes. |
| Hosted app/HumHub restart/queue/cron acceptance | NOT RUN | Earlier container restart/worker tests are CI evidence, not evidence for the two still-offline hosted services. |
| Physical iPhone Safari | NOT RUN | No physical-device/session evidence; no emulation is represented as Safari. |
| Production / Aishu / interrupted source | UNCHANGED | Only approved new staging resources operated; original 13-file recovery remains separate. |

Evidence: `evidence/2026-10-17-volume-activation/`. `observed-activation.json` contains only non-secret provider IDs, SQL metadata, guard results and exact scopes. `https-readiness.json` records the negative checks. The source/evidence push uses a new development branch, not the branch connected to the still-unconfigured Railway app/HumHub, avoiding automatic premature deployments. No genuine donation, transaction, scholarship or construction claim was generated.

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

## OAuth configuration update — 17 October 2026, 06:23 UTC

The owner-approved Google consent and single Web client are created in **`ummahconnect-staging-261017`**, **External/Testing**, with basic identity scopes only and exact callback `https://ummah-app-staging.up.railway.app/auth/callback`. The final credentials are privately saved in only the isolated **ummah-app** protected settings: **26 service variables, zero pending changes, Service is offline**. No app deployment, real account enrollment, native grant or human decision was performed.

Two unused temporary secrets surfaced in diagnostic output; both were disabled and deleted before application use/deployment. The final fresh replacement is the only enabled secret, was not returned in output and is not exported. Temporary browser memory/clipboard were cleared. See [Google staging setup](GOOGLE-STAGING.md) for the exact handling record and remaining gates.

**Authorization blind spot addressed:** Google's basic-name/email/profile login exception means its Testing user list is not an application/community allowlist. The existing verified issuer/subject + enabled current database role + session/revocation authority remains mandatory, followed by native membership/grants; no email auto-invites or browser-trusted identities. No additional broad scopes were added to force a Google allowlist.

Fresh source regressions: **47/47 app and 19/19 identity**, zero failures. Native CI remains the prior qualified **36 HTTP + 16 model** at `66a1adb0052b56a0c094eb43ce0b1259bfc37a4f`, run **39003367427**, with synthetic actors. Fresh anonymous HTTPS probes: **main-app /api/health 404**, **native /api/v1/auth/current 401**, verified TLS. These are not genuine Google login/member/reviewer/excluded or physical-device results.

Next: three actual distinct account designations; qualified invitation-required app deployment to observe genuine subjects; deliberate identity/native mappings and scoped grants; different-human approve/reject and negative-access acceptance; physical iPhone Safari. The author cannot review, the reviewer is review-only, the excluded tester gets no community membership/grant. All **33 screen status counts stay 6 locally Working / 20 UI Only / 7 Blocked**. Original 13-file recovery, production, Aishu, approved colors and later-service order remain unchanged/separate.

Evidence: `evidence/2026-10-17-google-staging/`. Earlier dated setup/unready records are history; this update supersedes only their resolved Google creation/credential blocker.

## Native login/runtime repair — verified 17 October 2026, 07:47 UTC

The reported native browser-page error had a missing pinned `yii/bootstrap5` message source; scoped metadata also showed root-owned cache branches in a materialized docroot runtime. The exact directory-materializing process remains unproven. Source binds Yii runtime/cache to the private volume, explicitly registers the pinned translation directory and denies native password/registration/external browser auth rather than introducing a second Google/password authority.

- **Qualified/deployed code:** `44ee3bb5f39b275de84832e15fa02ae82c7b14f7`, [native CI 39013729511](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/39013729511). **36 native HTTP + 16 model** tests, both images, duplicate-MPM/forced-runtime-materialization recovery, private first boot/restart/refusal and **11 runtime/cache/translation/Alert checks at each of three phases** pass in disposable containers. CI actors are synthetic, not human review. Fresh source: **47 app + 19 identity**, PHP/shell/TypeScript/build and 8 database-free route cases pass.
- **Actual hosted scope:** replacement `934b51d6-7c64-4d51-94a4-cbc4504ff0f7`, native service only; exact three source hashes match. **17 anonymous/native route checks** pass: auth/query/POST =403 with no-store/message, malformed selector=400, native bearer/review APIs=401, private paths=403. Workers RUNNING; actual www-data owned transient cache write/read/delete passes in `/var/lib/ummah-humhub/runtime`.
- **Preservation:** guarded SELECT-only PDO with the scoped application DB role, without Yii, confirms same private space/container 1/1, zero users/passwords/posts/memberships/reviews/grants/events, 50 tables/2 triggers, log_bin=0 and the unchanged root-only 0600 marker. No fixture/account/content/grant or permission mutation occurred on Railway.
- **Operator caveat:** native bootstrap `--verify` as www-data was refused by that deliberately operator-only marker; it was not rerun as root and the marker was not chmod/chowned. That helper may refresh REST settings for zero users, so it is not a read-only active-service diagnostic. Use root `--space-id` (marker-only, before Yii) or guarded SELECT-only metadata, and separate www-data application/cache probes. Never use root Yii diagnostics after startup to recreate root-owned caches.
- **Screenshot:** `evidence/2026-10-17-native-login-boundary/corrected-native-denial-chromium.png` is an actual credential-free hosted **desktop Chromium 154.0.8037.57** capture, 1280×900, no page errors or mocked API success. Task browser reset to blank; the documented fresh isolated Chromium captured the real response. This is **not main Google login, independent human or physical Safari evidence**. Main UI/colors are unchanged.
- **Remaining:** actual distinct author/different-human reviewer/excluded emails, genuine subject invitation/enrollment and native scoped account maps/grants, qualified invitation-required app deployment, different-human approve/reject/member/excluded/revocation acceptance, physical iPhone Safari. Main `/api/health` remains **404 / verified TLS**; no working login URL is claimed. Google project `ummahconnect-staging-261017` and protected OAuth settings remain configured. Counts stay **6 local Working / 20 UI Only / 7 Blocked**; later-service order/citations/no-genuine-example claims and production/Aishu/original recovery boundaries remain unchanged.

## Login-state UI deployment — verified 17 October 2026, 16:42 UTC

Exact app source `ac8fee3f3e12c535d9eb6e61f31229282018257a`, deployment `51ae04c3-2f99-4d26-ba47-3c66295d6371`. [Pinned CI 39049525723](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/39049525723) passes Node-24 app/identity tests, lint/build, both images and isolated native **36 HTTP + 16 model** tests; private bootstrap/restart/denial regressions remain synthetic. Local **76 app + 35 identity/privacy** tests pass with lint/build. Source hashes and deployed Node **v24.21.0** verified in protected console. No auth vendor/native executable or role mutation is part of this UI change.

Actual anonymous HTTPS: health **200**, session **401**, configured review **200**, Google start **302** to HTTPS Google. Actual hosted `/login` Chromium mobile/desktop screenshots show **Sign Up / Login**, **Acceptance pending**, and **sign-in is available; no session is present**. Explicit hash routes remain honored; anonymous submit control count is zero. Local **33 routes**, zero overflow/page errors; hosted entry checks have zero page errors/overflow. These are **desktop Chromium 154.0.8037.57**, mobile viewport emulation where stated, **not authenticated human acceptance or physical Safari**. No APIs mocked. The first screenshot attempt timed out on network-idle; the corrected audit checks the rendered panel instead. An operational verifier initially used nonexistent `/ummahreview/spaces`; its guarded failure is retained and corrected from the committed `/space/1` endpoint, not hidden or treated as a runtime source defect.

Fresh protected map/SQL/native GET checks preserve active distinct Author/Reviewer: private space/feed both 200; Author own submissions 200/queue 403; Reviewer queue 200/own submissions 403. Approved/feed/pending collections have zero records. **No post, session or decision was created by these operator checks.** Real Author submission and different-human approve/reject, excluded-account denial, sign-out/revocation acceptance and physical iPhone Safari remain release gates. The UI never turns public configuration into trusted identity. Qdrant/BGE → Docling → PeerTube → charity/mosque stay after the documented social milestone. All 33 status rows/design colors and original recovery/production/Aishu boundaries remain unchanged.

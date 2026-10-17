# Missing capabilities and integration gates

**Current state (17 October 2026 UTC):** three approved persistent volumes are applied; both private MySQL services passed actual non-root SQL probes; the isolated identity schema has four tables and zero user roles. App/HumHub remain offline. Hosted Google/human flow and physical iPhone Safari are not complete. Historical entries below are retained; see the final volume/database activation section and `RAILWAY-VOLUME-ACTIVATION-20261017.md`.

These are actual dependencies for the integrated screens, not features claimed as completed. No payment, approval or production account action is simulated as successful.

| Area | Missing contract / capability | Affected screens |
|---|---|---|
| Runtime reconciliation | Running Railway commit, staging deployment configuration, authoritative API origin and regression baseline for the separate OIDC/database app | Release gate for all |
| Authentication | Existing verified-session validation in this React/Express app, login callback/logout, registration, server-side account mapping | 2, 4–12, 21, 25–26, 31–33 |
| HumHub | Isolated instance URL, per-member token provision/revocation, protected app-to-HumHub user mapping and verified-session resolver | 4, 6, 8, 10–12 |
| Social writes | Permissioned adapter operations for publishing, comments, reactions, membership/follow and profile updates; CSRF validation and moderation policy | 5–6, 8, 11–12 |
| Messaging | Confirm supported HumHub messaging module/API, conversation permissions, delivery/read events, report/block controls | 9 |
| Notifications | Authenticated events, unread state, subscription preferences and delivery | 10 |
| Scholarly library | Authoritative article/video/course catalog, source attribution, publication permissions and existing editorial API contract | 13, 17, 33 |
| Research | Staging GEMINI_API_KEY entitlement; live generation/access checks; strict RAG retrieval/verification integration and durable versioned dossiers | 15 |
| Voice / podcasts / OCR | Staging AI key/model entitlement; live synthesis/transcription/OCR checks; persisted scholarly audio catalog and verified recordings separate from generated personas | Podcast route, 15, 17 |
| Quran / Tafsir | Optional UMMAH_API_KEY, provider reachability and quota; real audio playback and all tafsir edition checks on iPhone Safari | 14 |
| Prayer | Live location permission and provider response/device timezone verification | 16 |
| Scholars | Verified identity/qualifications, question queue, assignment, reviewed answers, notifications | 17 |
| Charity | Campaign registry, organization/beneficiary verification, approval records, campaign budgets and permissioned update API | 18–19 |
| Donations | Payment provider sandbox, server-created payment intents, signed webhook verification, idempotent reconciliation, refunds, receipt and donor ledger | 20–21, mosque Donations |
| Mosque registry | Project ownership, verified site/title/permit/location evidence, committee approval and authoritative directory API | 22–23, 25, 28 |
| Mosque documents | Private object storage, authenticated uploads, document metadata, access policy, redaction and version history | Current Site, Proposed Design, 25–26 |
| Construction | Dated authenticated progress photos, engineer/committee approvals, milestone transitions and publication workflow | 24, Construction |
| Finances | Authorized budget/expense ledger, invoices, approvals, reconciliation and independent audit documents | 26, Finances, Donations |
| Project application | Server persistence and submissions, document uploads, review workflow and committee permissions | 25–26 |
| Events | Real event catalog, organizer permissions, capacity, registration/cancellation and attendance | 27 |
| Volunteers | Approved opportunities, coordinator permissions, application lifecycle and safeguarding requirements | 29 |
| Marketplace | Merchant approval, certification evidence, listings, moderation, contact/order and payment contracts | 30 |
| Organization/admin | Existing role claims and permission checks, scoped dashboards, audit log, editorial moderation endpoints | 32–33 |
| Device acceptance | Real iPhone Safari hardware/session, login redirects, microphone, audio unlock, downloads/share, camera and location permissions | Release gate |

The browser can save preferences and drafts locally. Those are not server records, submitted applications, donations, messages or verified content. Default social routes fail closed with 401 until a trusted session resolver is connected; a configured actor with no isolated instance receives 503. Writes are not enabled. AI requests on staging return a clear 503 when no staging key exists.

## 2026-10-15 source correction and remaining live gates

The table above records the original handoff gaps. Draft submission, approved-only detail/feed, a human-review queue, same-origin write checks, per-member trusted mapping and transactional native HumHub decisions are now implemented in source. They are now installed/qualified in the isolated native test runtime, **not hosted-live qualified**. Comments, reactions, messaging, memberships/profile writes, scholarly qualification, charity/mosque records and all later service work remain pending.

| Requirement | Exact missing item / current limit |
|---|---|
| HTTPS staging host | Authorized isolated application host and deployment route; the earlier loopback preview is historical; no current hosted flow is claimed |
| Identity authority | `UMMAH_IDENTITY_ORIGIN`, separately reviewed staging auth/DB configuration, staging Google OIDC client and exact callback registration, separate session secrets/store and copied-or-approved test role identities; do not reuse production secrets |
| App isolation config | `UMMAH_SOCIAL_ENVIRONMENT=isolated-staging`, `UMMAH_PUBLIC_ORIGIN`, `UMMAH_IDENTITY_ENVIRONMENT=isolated-staging` |
| HumHub runtime | Real isolated PHP/MySQL/storage instance, `HUMHUB_ORIGIN`, HumHub 1.19 + checksum-verified REST 0.12.4 and installed enabled `ummahreview` module |
| Provider isolation config | `UMMAH_REVIEW_ENVIRONMENT=isolated-staging`, actual `UMMAH_REVIEW_SPACE_IDS` |
| Trusted account mapping | `UMMAH_ACCOUNT_MAP_FILE` containing actual verified app references → separate HumHub IDs/per-member tokens, mode 0600; immediate disable/revocation must be tested |
| Two different permissions | Actual staging author and reviewer accounts, community memberships and scoped HumHub grants; second excluded community; never a shared admin token |
| Live runner | `UMMAH_LIVE_STAGING_URL`, `UMMAH_TEST_AUTHOR_COOKIE`, `UMMAH_TEST_REVIEWER_COOKIE`, `UMMAH_TEST_SPACE_ID`, `UMMAH_TEST_FORBIDDEN_SPACE_ID`; all absent at this milestone, runner exit 2 / BLOCKED |
| Native runtime qualification | PHP source syntax was parsed, not executed. Real migration, content-event behavior, native-route publish/schedule/edit/move bypass, transactional rollback/concurrency and exact REST response compatibility need real HumHub/MySQL testing |
| Device gate | Physical iPhone Safari account login/redirects, keyboard/safe area, touch controls and permissions; current screenshots use Chrome viewport emulation only |
| Exact interrupted recovery | Original Mac-M5 workspace remains unavailable; this is new source from preserved handoff, not the unrecovered 13 files |

The configured staging path opts into writes only after its isolation guards pass. The unconfigured Worker and ordinary app path still deny writes. Test data and AI-assisted content are not genuine scholarly credentials, financial transactions, donations or construction progress. Production and Aishu remain unchanged.

## Current live-staging blockers after native qualification

Earlier statements that the native module was never installed/executed are superseded: actual HumHub/REST migrations and 20 HTTP + 5 native-model tests now pass in the isolated task sandbox. The hosted milestone is still **not complete**.

1. **Hosting activation:** approve the separate new Railway project's metered infrastructure activation and maximum additional monthly budget. No paid services were activated. Production and Aishu are excluded; the sole connected Hetzner server is Aishu-labelled and network-blocked, and Cloud Computer 2's governance reserves it for a different workload.
2. **Live build/deployment:** build and qualify the prepared app/HumHub Docker definitions, create the separate MySQL 8.4 services/volumes and assign HTTPS domains. Current native tests use MariaDB, not the target hosted MySQL image. No working app URL is assigned.
3. **Existing-account login:** provision a separate staging Google OIDC client using protected settings, register `<new-app-origin>/auth/callback`, and designate the author, independent reviewer and excluded test identities. Stage session secrets, role table, revocation store and subject mappings are separate. Do not copy production credentials or auto-invite by email.
4. **Membership and scoped review permissions:** link the designated real account subject references to separate native HumHub users, individual expiring bearer tokens, actual moderated private spaces and `ummah_review_grant` rows. Existing-account login → UI submission → another human's approval is not established by automated fixture roles.
5. **Hosted native negative/robustness acceptance:** repeat rejection, self-review and excluded-user tests through real HTTPS login; additionally verify session/token revocation, native route bypass, edits/moves, transaction rollback/concurrency and no pending-post notifications on the hosted runtime. Current loopback tests cover draft-first insert, publish/schedule/edit denial and permission boundaries, not all concurrency or notification behavior.
6. **Physical iPhone Safari:** use real hardware and record model/iOS/Safari/browser identity, callback/cookie behavior, keyboard/safe areas, author/reviewer/excluded accounts and logout. Not yet performed.
7. **Separate recovery:** compare the original 13 Mac-M5 files when original workspace access returns. Preserve their files, stashes and reflogs. They are not a prerequisite to staging work from the preserved pushed source.

Qdrant/BGE retrieval → Docling ingestion → PeerTube → charity/mosque workflows remain pending in that documented order. No selected model/service is promoted to installed or qualified merely by being registered. No simulated transaction, donation, scholarship or construction progress is presented as genuine.

## 2026-10-16 current correction

The earlier 20/5 native results are expanded to **32 actual HTTP + 15 actual model/file/cache cases**. Robust retries, concurrency, rollback, exact-version/tombstone conflicts, append-only audit and pending notification exclusions now pass locally against actual HumHub/PHP/MariaDB. They must still be repeated through hosted HTTPS identities. Container/MySQL qualification is an independent CI gate; local Docker hit a kernel restriction and is not reported as passing.

Two newly connected candidates were read-only inspected and excluded: MEGATON DX protects the Aishu adapter/control plane, and aegistube-upstream is exclusively an AegisOS/Invidious host—not a PeerTube installation. No source/runtime/firewall change was made. The empty isolated Railway project is the identified activation path. Account login, live human/device acceptance, later services and exact original-file recovery remain blocked as above. Post attachments are deliberately unsupported and denied, not quietly accepted without review.

## Final native container gate — PASS (16 October 2026)

Qualified runtime source: `558cf5c53775d2412ef3d9f8e1fddcdf9e298d22`. [Actual standard Linux CI run](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/38825959081). The pinned app/HumHub images build, MySQL 8.4 initializes with schema-local role/trigger grants, and **32/32 actual native HTTP + 15/15 native model/file/cache tests pass**. Apache/native queue/cron are running; private configuration/runtime/upload URL checks pass; stop/recreate preserves users, reviews, append-only events and the protected fixture on the same named volumes.

Corrections verified: actual authenticated final-server MySQL readiness; GD codecs needed by native avatars; private supervisor Unix control socket; writable native runtime/asset ownership; base-image sticky-webroot/protected-symlink traversal; resolved-path and URL-level private storage denial. Linux symlink protections and host firewall safeguards were not disabled. Local Docker kernel restriction remains a local limitation, superseded by actual standard-runner container qualification.

**Hosted HTTPS Google login / independent human review / physical iPhone Safari are NOT tested.** CI actors are synthetic; no scholarly review, financial or construction facts are certified. Separate Railway activation/OIDC/account choices and hardware acceptance remain blockers; no app staging URL is claimed. All other selected services remain pending in the documented order.

## Activation update — 16 October 2026, 12:14 UTC

The owner approved the four-service Railway resource envelope, with owner-handled payment steps. In the separate staging environment, `ummah-app` (`f3756510-4e87-445b-9cfb-9dad042d6758`) is now persisted as an **empty offline service**, with **1 vCPU / 1 GB** caps. No source/image, running workload, volume, public app domain or payment action was activated. Three other planned services remain pending.

Railway's existing GitHub connection lists other repositories but its completed exact search reports **No repositories found** for `dragon-dawwa-engine`. The production repository was not substituted. No repository access grant was changed; the correct installation must be inspected/authorized narrowly, retaining all existing grants. Google Cloud project/staging OAuth client and designated author/different human reviewer/excluded account choices remain pending. No HTTPS application URL or hosted login result exists yet. Existing app/native code remains unchanged from the 47-test passing MySQL container qualification; production and Aishu unchanged.

## 2026-10-17 UTC — current live activation blockers after source preparation

The old GitHub login/installation blocker is cleared: the narrow selected-repository grant is verified and the engine repository attaches in both staging drafts. Both correct development sources/Dockerfiles, isolated app/identity settings, HumHub database/cookie configuration and two private pinned MySQL image/credential configurations are prepared. There are 46 **unapplied** changes; none are live operations.

1. **Volume capacity decision:** the approved target was approximately 5 GB aggregate storage. Railway Pro creates 50 GB per volume, does not support smaller initial capacity or downsizing, and charges used storage including metadata. Three volumes would allocate 150 GB. No volume has been created; explicit acceptance of that deviation or a different isolated storage/hosting arrangement is needed. See `RAILWAY-VOLUME-DECISION-20261017.md`.
2. **Separate Google Cloud project/Web client:** choose the staging project, configure its protected client credentials and register `https://ummah-app-staging.up.railway.app/auth/callback`. Never edit the production client or copy its secrets.
3. **Real accounts/community/grants:** designate an existing author Google account, a different human reviewer and an excluded account, plus the private community and intended rights. The staged account map is empty; no real users, scholarly credentials or role grants were invented.
4. **Hosted bootstrap and deployment:** create approved persistent volumes; start both private MySQL instances and apply the isolated identity schema and native HumHub installation/migrations. Establish actual moderated space IDs, scoped review grants and per-member token/subject mappings. `UMMAH_INITIALIZE_HUMHUB=no` remains staged; enable first-boot initialization only once on the new empty database. Apply the prepared app/HumHub configuration only after its missing guards are satisfied.
5. **Hosted acceptance:** reserved app/HumHub HTTPS origins currently return 404 with valid TLS. No real login, post, human approval, rejection, self-review-denial or excluded-user test has run on Railway. Repeat the existing native robustness/security and operational persistence tests against the actual hosted runtime, then perform the main 33-screen interface acceptance.
6. **Physical iPhone Safari:** not run. A device/browser session or owner-executed evidence of model, iOS/Safari version, callback/session, touch/keyboard/safe areas and author/reviewer/excluded flows is required. Browser emulation is not hardware proof.
7. **Original-file recovery:** preserve and compare the original 13 Mac-M5 edits/stashes/reflogs when access returns. This remains separate and does not justify resetting or overwriting the qualified continuation.

Current source validation: 44 app tests and 19 identity tests pass; TypeScript/Vite pass. The prior 32 native HTTP and 15 model/file/cache passes remain actual isolated HumHub/REST/MySQL CI evidence with synthetic actors, not hosted human review. Production and Aishu remain unchanged. Qdrant/BGE → Docling → PeerTube → charity/mosque remains the subsequent rollout order; selected services/models are not reported as connected.

## 2026-10-17 UTC — current blockers after approved volume/database activation

The previous volume-capacity decision is **cleared**. Three approved 50 GB volumes are created, attached and applied. Both private MySQL 8.4.11 services are running and passed actual non-root SQL probes. The separate identity schema and exact instance marker are initialized and verified, with **zero enrolled roles**. GitHub access and saved qualified source configuration are also cleared. No additional volume-capacity or resource-envelope approval is being requested.

Remaining work:

1. **Separate staging Google Web client:** identify the Google Cloud project; configure `GOOGLE_OIDC_CLIENT_ID` and `GOOGLE_OIDC_CLIENT_SECRET` through protected deployment settings and register `https://ummah-app-staging.up.railway.app/auth/callback`. Production OAuth configuration/secrets remain excluded.
2. **Actual human identity/permission choices:** designate the author, a reviewer belonging to a different human, and an account that can log in but cannot access the private community. Specify the community and intended rights. Email can designate an intended account; it is not accepted as authenticated identity. Bind only verified issuer/subject references, never browser-provided IDs or automatic email enrollment.
3. **Live HumHub bootstrap:** the database is ready but still contains zero native tables. Initialize HumHub/REST/native review migrations; establish actual private community IDs, membership, scoped review grants and individual expiring bearer tokens. Do not invent IDs or use the synthetic fixture seeder for hosted real accounts. No native hosted content, review or scholarly approval is yet claimed.
4. **Deploy app/HumHub after configuration:** both remain offline; saved source uses the qualified development ancestry, not `main`. Enable first boot only for the new database and disable it afterward. Finish account mapping and session/role/revocation checks. Hosted queue/cron/private-path and persistence checks remain unrun, distinct from passing CI.
5. **HTTPS human-flow acceptance:** the two reserved endpoints return 404 with valid TLS. Run actual existing-account login → community → draft → different human approval → permitted visibility, then rejection, reviewer self-review denial, excluded-user access, revocation and native bypass/rollback tests against that hosted HumHub. Earlier synthetic native CI is not this pass.
6. **Physical iPhone Safari:** record actual hardware/iOS/browser, callback/cookies, navigation, keyboard/safe areas and permission-different users. No browser emulation is substituted.
7. **Separate original-file recovery:** keep the original 13 Mac-M5 edits/stashes/reflogs intact and compare them when access returns. Current staging work does not reset or overwrite those files.

The activation record is pushed on a new development branch not connected to Railway's auto-deploying source, preventing a documentation push from launching the incomplete app. Fresh source checks remain 44/44 app + 19/19 identity, TypeScript/Vite passing. The approved 33-screen design and runtime code are unchanged. Production and Aishu were not modified. Later work remains Qdrant/BGE → Docling → PeerTube → charity/mosque, with citations, human review and explicit separation of examples from genuine records.

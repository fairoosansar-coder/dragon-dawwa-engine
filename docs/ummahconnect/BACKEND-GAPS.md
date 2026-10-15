# Missing capabilities and integration gates

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

The table above records the original handoff gaps. Draft submission, approved-only detail/feed, a human-review queue, same-origin write checks, per-member trusted mapping and transactional native HumHub decisions are now implemented in source. They are **not installed or live-qualified**. Comments, reactions, messaging, memberships/profile writes, scholarly qualification, charity/mosque records and all later service work remain pending.

| Requirement | Exact missing item / current limit |
|---|---|
| HTTPS staging host | Authorized isolated application host and deployment route; only loopback `127.0.0.1:3307` is currently running |
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

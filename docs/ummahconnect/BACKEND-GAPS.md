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

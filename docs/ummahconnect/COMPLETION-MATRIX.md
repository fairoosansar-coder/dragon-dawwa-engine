# 33-screen completion matrix

Updated 2026-10-15 after actual native HumHub qualification. Route labels below identify the existing main app, not a working hosted URL. The earlier Mac-mini localhost preview is historical. No social screen is promoted to live Working: HTTPS Google/human/device acceptance is still blocked. Working describes previously verified local interactions, not hosted acceptance.

| # | Screen | Status | Implemented scope / missing capability |
|---|---|---|---|
| 1 | Splash & Welcome (`#/screen-1`) | Working | Welcome links and main-app navigation. |
| 2 | Sign Up / Login (`#/screen-2`) | Blocked | Separate staging OIDC/session/DB package prepared and 19 source tests pass; actual Google client, callback host and designated accounts pending. |
| 3 | Onboarding & Preferences (`#/screen-3`) | Working | Interest selection and browser-local persistence. |
| 4 | Home Feed (`#/screen-4`) | UI Only | Approved-only feed passes actual HumHub/MariaDB tests; no linked hosted Google sessions yet. |
| 5 | Create Post (`#/screen-5`) | UI Only | Real native draft submission and first-INSERT state=10 verified; main UI retained. Hosted existing-account submission/human acceptance pending. |
| 6 | Post Detail & Comments (`#/screen-6`) | Blocked | Approved detail and denied pending/rejected detail verified against actual native provider. Hosted UI acceptance, comments and reactions remain pending. |
| 7 | Explore & Search (`#/screen-7`) | Working | Search/filter all 33 routes and open results. |
| 8 | User Profile (`#/screen-8`) | UI Only | Approved profile UI; persistent account/profile operations pending. |
| 9 | Messages & Chat (`#/screen-9`) | Blocked | Local message draft works; delivery/backend missing. |
| 10 | Notifications (`#/screen-10`) | Blocked | Authenticated notification service unavailable. |
| 11 | Community Directory (`#/screen-11`) | UI Only | Actual per-member private community directory and excluded-user filtering pass native tests; hosted account linkage remains blocked. |
| 12 | Community Detail (`#/screen-12`) | UI Only | Actual approved-only member feed and excluded visibility pass native tests; real hosted login/membership qualification pending. |
| 13 | Knowledge Hub (`#/screen-13`) | UI Only | Knowledge-service links work; editorial articles/videos/courses not connected. |
| 14 | Quran Reader (`#/screen-14`) | Working | Existing Quran reader, local corpus and study navigation; live tafsir/audio provider acceptance pending. |
| 15 | Hadith Library (`#/screen-15`) | Blocked | Existing research/dossier engine mounted; staging AI key and durable verified dossiers pending. |
| 16 | Prayer & Spiritual (`#/screen-16`) | Working | Existing prayer form and validated provider integration; live location/device check pending. |
| 17 | Scholars & Questions (`#/screen-17`) | UI Only | Local question drafts and research link work; scholar assignment pending. |
| 18 | Charity Hub (`#/screen-18`) | UI Only | Example campaign UI and category tabs; campaign service pending. |
| 19 | Charity Campaign Detail (`#/screen-19`) | UI Only | Example campaign detail; verified budget/beneficiary evidence pending. |
| 20 | Donation Checkout (`#/screen-20`) | Blocked | Amount controls respond; payment processing unavailable. |
| 21 | My Donations (`#/screen-21`) | Blocked | No genuine ledger/receipts connected. |
| 22 | Build a Mosque Directory (`#/screen-22`) | UI Only | Example mosque directory and tabs; approved registry pending. |
| 23 | Mosque Project Detail (`#/screen-23`) | UI Only | All five project sections navigate; evidence/records not connected. |
| 24 | Mosque Construction Updates (`#/screen-24`) | UI Only | Illustrative construction timeline; dated approved updates pending. |
| 25 | Create Mosque Project (`#/screen-25`) | UI Only | Local application draft/save/restore; uploads/submission/review pending. |
| 26 | Mosque Project Management (`#/screen-26`) | UI Only | Management interface; committee permissions and ledgers pending. |
| 27 | Events & Registration (`#/screen-27`) | UI Only | Event tabs and explicit status dialogs; real catalog/registration pending. |
| 28 | Mosque Directory (`#/screen-28`) | UI Only | Directory/search interface; authoritative mosque records/map pending. |
| 29 | Volunteer Opportunities (`#/screen-29`) | UI Only | Opportunity UI; applications and coordinator workflow pending. |
| 30 | Halal Marketplace (`#/screen-30`) | UI Only | Marketplace categories/search UI; merchant/listing/order services pending. |
| 31 | More & Settings (`#/screen-31`) | Working | Browser-local language preference and navigation; account privacy controls pending. |
| 32 | Organization Dashboard (`#/screen-32`) | UI Only | Organization interface; verified organization/roles/reports pending. |
| 33 | Admin & Moderation (`#/screen-33`) | UI Only | Actual native review queue, reviewer-with-grant self-review denial, independent reviewer-role decision and rejection pass. Automated fixtures are not a human scholarly approval. Hosted human review, robust concurrency and device gates remain. |

Counts: 6 Working, 20 UI Only, 7 Blocked.

Additional routes: Podcasts & Voice Studio is mounted from the existing engine but generation is Blocked without a staging key. Current Site, Proposed Design, Construction, Finances and Donations are five functional route tabs; all five are UI Only pending authenticated project data.

Screenshots and automated browser evidence validate rendering/navigation. They do not validate genuine payments, construction progress, identity, scholarly approvals or live provider availability. See BACKEND-GAPS.md and TEST-RESULTS.md.

## 2026-10-15 moderation milestone

The source capability has advanced, but no pending social screen is promoted to live Working status. The local preview exposes honest disconnected states. Controlled two-identity tests use a simulated provider and are not live OIDC/HumHub or scholarly-review acceptance. All 33 mobile-emulated Chrome route checks passed; physical iPhone Safari has not been tested. The original 13 interrupted Mac-M5 files were not recovered or discarded: this branch is a new implementation based on the preserved exact handoff commit. See MODERATION-MILESTONE-20261015.md.

## Native runtime milestone boundary

Actual provider: 20/20 HTTP cases and 5/5 native-model guards pass in isolated PHP 8.3.6/HumHub 1.19.0/REST 0.12.4/MariaDB 10.11.14. Source: 44/44 app cases and 19/19 staging identity cases. New Railway staging project is private and empty; no HTTPS app URL exists. Hosted Google login plus another human’s decision, target MySQL/container qualification and physical iPhone Safari are not complete. The 33-screen design source is unchanged from 9fa7f7a. Original 13-file recovery remains a separate preserved workstream. See LIVE-STAGING-READINESS-20261015.md.

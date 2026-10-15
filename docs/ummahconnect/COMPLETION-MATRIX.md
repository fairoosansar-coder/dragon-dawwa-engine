# 33-screen completion matrix

Updated 2026-10-15. Links below target the local continuation preview on the selected Mac mini, not a new hosted deployment. The old owner-private hosted preview has not been updated. All 33 screens are reachable in the main application. Status describes staging capability, not merely whether a page renders. Working does not imply every external provider or hardware behavior has been validated. UI Only includes useful local interactions but no live business records. Blocked identifies a missing essential service.

| # | Screen | Status | Implemented scope / missing capability |
|---|---|---|---|
| 1 | [Splash & Welcome](http://127.0.0.1:3307/#/screen-1) | Working | Welcome links and main-app navigation. |
| 2 | [Sign Up / Login](http://127.0.0.1:3307/#/screen-2) | Blocked | Staging login/callback transport and revocation-aware linked-identity resolver implemented; isolated authority config, OIDC callback and live accounts still unavailable. |
| 3 | [Onboarding & Preferences](http://127.0.0.1:3307/#/screen-3) | Working | Interest selection and browser-local persistence. |
| 4 | [Home Feed](http://127.0.0.1:3307/#/screen-4) | UI Only | Approved-only review adapter implemented; actual HumHub/identity installation remains pending. |
| 5 | [Create Post](http://127.0.0.1:3307/#/screen-5) | UI Only | Integrated real-submission controls and native draft-before-first-save module implemented; provider installation and live review acceptance blocked. Device drafts remain local. |
| 6 | [Post Detail & Comments](http://127.0.0.1:3307/#/screen-6) | Blocked | Approved-only detail contract implemented; live provider acceptance, comments and reactions still pending. |
| 7 | [Explore & Search](http://127.0.0.1:3307/#/screen-7) | Working | Search/filter all 33 routes and open results. |
| 8 | [User Profile](http://127.0.0.1:3307/#/screen-8) | UI Only | Approved profile UI; persistent account/profile operations pending. |
| 9 | [Messages & Chat](http://127.0.0.1:3307/#/screen-9) | Blocked | Local message draft works; delivery/backend missing. |
| 10 | [Notifications](http://127.0.0.1:3307/#/screen-10) | Blocked | Authenticated notification service unavailable. |
| 11 | [Community Directory](http://127.0.0.1:3307/#/screen-11) | UI Only | Verified-session resolver and per-member mapping implemented in code; real staging identity and secret mappings missing. |
| 12 | [Community Detail](http://127.0.0.1:3307/#/screen-12) | UI Only | Approved-only member feed and per-space provider access checks implemented; live membership/identity qualification pending. |
| 13 | [Knowledge Hub](http://127.0.0.1:3307/#/screen-13) | UI Only | Knowledge-service links work; editorial articles/videos/courses not connected. |
| 14 | [Quran Reader](http://127.0.0.1:3307/#/screen-14) | Working | Existing Quran reader, local corpus and study navigation; live tafsir/audio provider acceptance pending. |
| 15 | [Hadith Library](http://127.0.0.1:3307/#/screen-15) | Blocked | Existing research/dossier engine mounted; staging AI key and durable verified dossiers pending. |
| 16 | [Prayer & Spiritual](http://127.0.0.1:3307/#/screen-16) | Working | Existing prayer form and validated provider integration; live location/device check pending. |
| 17 | [Scholars & Questions](http://127.0.0.1:3307/#/screen-17) | UI Only | Local question drafts and research link work; scholar assignment pending. |
| 18 | [Charity Hub](http://127.0.0.1:3307/#/screen-18) | UI Only | Example campaign UI and category tabs; campaign service pending. |
| 19 | [Charity Campaign Detail](http://127.0.0.1:3307/#/screen-19) | UI Only | Example campaign detail; verified budget/beneficiary evidence pending. |
| 20 | [Donation Checkout](http://127.0.0.1:3307/#/screen-20) | Blocked | Amount controls respond; payment processing unavailable. |
| 21 | [My Donations](http://127.0.0.1:3307/#/screen-21) | Blocked | No genuine ledger/receipts connected. |
| 22 | [Build a Mosque Directory](http://127.0.0.1:3307/#/screen-22) | UI Only | Example mosque directory and tabs; approved registry pending. |
| 23 | [Mosque Project Detail](http://127.0.0.1:3307/#/screen-23) | UI Only | All five project sections navigate; evidence/records not connected. |
| 24 | [Mosque Construction Updates](http://127.0.0.1:3307/#/screen-24) | UI Only | Illustrative construction timeline; dated approved updates pending. |
| 25 | [Create Mosque Project](http://127.0.0.1:3307/#/screen-25) | UI Only | Local application draft/save/restore; uploads/submission/review pending. |
| 26 | [Mosque Project Management](http://127.0.0.1:3307/#/screen-26) | UI Only | Management interface; committee permissions and ledgers pending. |
| 27 | [Events & Registration](http://127.0.0.1:3307/#/screen-27) | UI Only | Event tabs and explicit status dialogs; real catalog/registration pending. |
| 28 | [Mosque Directory](http://127.0.0.1:3307/#/screen-28) | UI Only | Directory/search interface; authoritative mosque records/map pending. |
| 29 | [Volunteer Opportunities](http://127.0.0.1:3307/#/screen-29) | UI Only | Opportunity UI; applications and coordinator workflow pending. |
| 30 | [Halal Marketplace](http://127.0.0.1:3307/#/screen-30) | UI Only | Marketplace categories/search UI; merchant/listing/order services pending. |
| 31 | [More & Settings](http://127.0.0.1:3307/#/screen-31) | Working | Browser-local language preference and navigation; account privacy controls pending. |
| 32 | [Organization Dashboard](http://127.0.0.1:3307/#/screen-32) | UI Only | Organization interface; verified organization/roles/reports pending. |
| 33 | [Admin & Moderation](http://127.0.0.1:3307/#/screen-33) | UI Only | Integrated human-review queue, independent reviewer guard, immutable submitted text and transactional decisions implemented in source; native PHP/MySQL acceptance and live reviewer grants missing. |

Counts: 6 Working, 20 UI Only, 7 Blocked.

Additional routes: Podcasts & Voice Studio is mounted from the existing engine but generation is Blocked without a staging key. Current Site, Proposed Design, Construction, Finances and Donations are five functional route tabs; all five are UI Only pending authenticated project data.

Screenshots and automated browser evidence validate rendering/navigation. They do not validate genuine payments, construction progress, identity, scholarly approvals or live provider availability. See BACKEND-GAPS.md and TEST-RESULTS.md.

## 2026-10-15 moderation milestone

The source capability has advanced, but no pending social screen is promoted to live Working status. The local preview exposes honest disconnected states. Controlled two-identity tests use a simulated provider and are not live OIDC/HumHub or scholarly-review acceptance. All 33 mobile-emulated Chrome route checks passed; physical iPhone Safari has not been tested. The original 13 interrupted Mac-M5 files were not recovered or discarded: this branch is a new implementation based on the preserved exact handoff commit. See MODERATION-MILESTONE-20261015.md.

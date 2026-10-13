# 33-screen completion matrix

All 33 screens are reachable in the main application. Status describes staging capability, not merely whether a page renders. Working does not imply every external provider or hardware behavior has been validated. UI Only includes useful local interactions but no live business records. Blocked identifies a missing essential service.

| # | Screen | Status | Implemented scope / missing capability |
|---|---|---|---|
| 1 | [Splash & Welcome](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-1) | Working | Welcome links and main-app navigation. |
| 2 | [Sign Up / Login](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-2) | Blocked | Existing OIDC/session link unavailable. |
| 3 | [Onboarding & Preferences](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-3) | Working | Interest selection and browser-local persistence. |
| 4 | [Home Feed](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-4) | UI Only | Existing HumHub adapter mounted; linked account/instance pending. |
| 5 | [Create Post](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-5) | UI Only | Local post drafts persist; publishing/review not connected. |
| 6 | [Post Detail & Comments](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-6) | Blocked | HumHub post detail/comments contract pending. |
| 7 | [Explore & Search](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-7) | Working | Search/filter all 33 routes and open results. |
| 8 | [User Profile](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-8) | UI Only | Approved profile UI; persistent account/profile operations pending. |
| 9 | [Messages & Chat](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-9) | Blocked | Local message draft works; delivery/backend missing. |
| 10 | [Notifications](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-10) | Blocked | Authenticated notification service unavailable. |
| 11 | [Community Directory](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-11) | UI Only | HumHub community reader connected in code; trusted actor mapping pending. |
| 12 | [Community Detail](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-12) | UI Only | HumHub posts connected in code; membership and identity pending. |
| 13 | [Knowledge Hub](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-13) | UI Only | Knowledge-service links work; editorial articles/videos/courses not connected. |
| 14 | [Quran Reader](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-14) | Working | Existing Quran reader, local corpus and study navigation; live tafsir/audio provider acceptance pending. |
| 15 | [Hadith Library](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-15) | Blocked | Existing research/dossier engine mounted; staging AI key and durable verified dossiers pending. |
| 16 | [Prayer & Spiritual](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-16) | Working | Existing prayer form and validated provider integration; live location/device check pending. |
| 17 | [Scholars & Questions](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-17) | UI Only | Local question drafts and research link work; scholar assignment pending. |
| 18 | [Charity Hub](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-18) | UI Only | Example campaign UI and category tabs; campaign service pending. |
| 19 | [Charity Campaign Detail](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-19) | UI Only | Example campaign detail; verified budget/beneficiary evidence pending. |
| 20 | [Donation Checkout](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-20) | Blocked | Amount controls respond; payment processing unavailable. |
| 21 | [My Donations](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-21) | Blocked | No genuine ledger/receipts connected. |
| 22 | [Build a Mosque Directory](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-22) | UI Only | Example mosque directory and tabs; approved registry pending. |
| 23 | [Mosque Project Detail](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-23) | UI Only | All five project sections navigate; evidence/records not connected. |
| 24 | [Mosque Construction Updates](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-24) | UI Only | Illustrative construction timeline; dated approved updates pending. |
| 25 | [Create Mosque Project](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-25) | UI Only | Local application draft/save/restore; uploads/submission/review pending. |
| 26 | [Mosque Project Management](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-26) | UI Only | Management interface; committee permissions and ledgers pending. |
| 27 | [Events & Registration](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-27) | UI Only | Event tabs and explicit status dialogs; real catalog/registration pending. |
| 28 | [Mosque Directory](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-28) | UI Only | Directory/search interface; authoritative mosque records/map pending. |
| 29 | [Volunteer Opportunities](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-29) | UI Only | Opportunity UI; applications and coordinator workflow pending. |
| 30 | [Halal Marketplace](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-30) | UI Only | Marketplace categories/search UI; merchant/listing/order services pending. |
| 31 | [More & Settings](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-31) | Working | Browser-local language preference and navigation; account privacy controls pending. |
| 32 | [Organization Dashboard](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-32) | UI Only | Organization interface; verified organization/roles/reports pending. |
| 33 | [Admin & Moderation](https://ummahconnect-integration-staging.feroz1890.chatgpt.site/#/screen-33) | UI Only | Admin interface and research link; server-enforced editorial/admin actions pending. |

Counts: 6 Working, 20 UI Only, 7 Blocked.

Additional routes: Podcasts & Voice Studio is mounted from the existing engine but generation is Blocked without a staging key. Current Site, Proposed Design, Construction, Finances and Donations are five functional route tabs; all five are UI Only pending authenticated project data.

Screenshots and automated browser evidence validate rendering/navigation. They do not validate genuine payments, construction progress, identity, scholarly approvals or live provider availability. See BACKEND-GAPS.md and TEST-RESULTS.md.

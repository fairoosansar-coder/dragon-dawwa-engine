# Isolated Railway staging

## Current boundary — 17 October 2026 UTC

Native runtime source **`3435c8356fa2b208c840393f8f5b89ccddc22420`** passed [non-deploying MySQL/container CI 39001338720](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/39001338720): **36 HTTP + 16 native model tests**, both pinned images, queue/cron, persistent restart, account-free private bootstrap and refusal to initialize over existing accounts. These are actual native runtime tests with synthetic fixture identities, **not hosted Google/human/Safari acceptance**.

The approved four service slots and three 50 GB volumes already exist. Both separate private MySQL services are online; identity has four tables and **zero enrolled roles**. Native deployment **`864c29ea-f4b8-4a10-8d79-61bab638c384`** at the exact source above completed the actual account-free private bootstrap: the scoped native helper verified **space ID 1 / container ID 1; zero users, memberships, posts, grants and reviews**, private/no-guest/no-registration/bearer-only settings and persistent marker. Queue and cron are running. However, **Apache is FATAL / HTTPS 502**: the hosted image has both event and prefork MPMs enabled. Provider Online is not readiness. A minimal build/startup single-prefork correction and an exact CI fault-injection regression are pending qualification.

After hosted marker verification, `UMMAH_INITIALIZE_HUMHUB=no` and actual `UMMAH_REVIEW_SPACE_IDS=1` were saved. The attempted Alt-click on the modal's Deploy Changes action also started an old-source redeployment; do not describe that modal action as apply-only. Do not reset or initialize again. `ummah-app` remains offline; no account or human approval has been invented. An unintended, **unapplied** function draft from a mistargeted generic terminal input was reviewed/discarded; exactly the four approved services and no extra staged resource remain.

See `PRIVATE-BOOTSTRAP.md`, `docs/ummahconnect/STAGING.md` and `TEST-RESULTS.md` for later verified updates. A reserved hostname or provider build is not a working application flow.

## Exact destination and exclusions

- Workspace: **Dragon Dawwa Private**, `35d451e8-8abf-417a-8bdf-61c03102ce61`.
- Project: **UmmahConnect - Isolated Staging**, `48d7a4cf-07dc-489b-8a3d-d6d10142b14e`.
- Environment: **staging**, `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`.
- [Management console — not an application URL](https://railway.com/project/48d7a4cf-07dc-489b-8a3d-d6d10142b14e?environmentId=1f7d98bf-1d49-4d9f-a5cc-13b57abcc095).
- **Exclude production project `786918bd-4ce1-4075-b763-93c7c6f729a1`, production/main source and all Aishu runtimes, credentials, volumes and accounts.** Original 13-file recovery remains separate.

| Service | Qualified image/build | Isolation |
|---|---|---|
| `ummah-app` | Root context; `deployment/staging/app.Dockerfile` | Main existing 33-screen UI on port 3000. Preserved identity implementation only on `127.0.0.1:3001`; never expose that port. App remains unready pending Google/client/accounts. |
| `ummah-humhub` | Root context; `deployment/staging/humhub.Dockerfile` | Pinned HumHub 1.19-era core, REST 0.12.4, native review module; port 80; own `/var/lib/ummah-humhub` volume. HumHub is the sole social engine. |
| `ummah-humhub-mysql` | Immutable MySQL digest in `upstream-lock.json` | `ummah_humhub_staging`, non-root `ummah_humhub_app`; private `ummah-humhub-mysql.railway.internal`; own `/var/lib/mysql` volume. |
| `ummah-identity-mysql` | Same pinned MySQL image | `ummah_identity_staging`, non-root `ummah_identity_app`; different credentials; private host and volume. Identity/session tables only, not a second social engine. |

All services retain one replica and **1 vCPU / 1 GB** caps. No additional volume approval or infrastructure substitution is required. Do not alter production storage or workspace-wide spending/access controls.

## Safe bootstrap and identity order

1. Qualify the exact intended runtime commit with `scripts/qualify-native-container.sh` only in disposable CI/local containers. Never run fixture seeders or synthetic approvals on hosted staging.
2. Use protected service variables; never secrets in build arguments, Git, evidence or browser-trusted identity. The HumHub database service uses its approved start command with `--skip-log-bin`; the application role has only schema-local privileges. No global/SUPER privilege or PITR guarantee is implied.
3. For the **new account-free first boot only**, use `UMMAH_BOOTSTRAP_PRIVATE_EMPTY=yes`, `UMMAH_INITIALIZE_HUMHUB=yes`, and absent/empty `UMMAH_REVIEW_SPACE_IDS`. The helper asserts emptiness, runs native migrations, creates **only UmmahConnect Staging Review**, resolves the actual ID to a protected persistent marker, then verifies private settings. No fake administrator or unchecked native save is used.
4. Confirm hosted private space/marker and **zero users, posts, memberships, bearer tokens and grants** through protected native console and read-only SQL. Then permanently set `UMMAH_INITIALIZE_HUMHUB=no` and the **actual resolved** `UMMAH_REVIEW_SPACE_IDS`. Keep private-mode marker verification for normal restart. Verify persistence again. Never reset a nonempty dataset.
5. In a **separate owner-authorized Google staging project**, create an External/Testing Web OAuth client with `openid email profile`; exact redirect **`https://ummah-app-staging.up.railway.app/auth/callback`**. Store client ID/secret directly in protected `ummah-app` settings. Owner sign-in and three actual participant emails are still required; bracketed placeholders are not identities.
6. Deploy the app only after its Google configuration is complete and native HTTPS/identity dependencies are verified. The unchanged authority first shows an uninvited but Google-verified account a non-secret subject-derived `google:` reference with **403 and no app session**. Observe the genuine callback/reference through a private channel before explicitly enrolling the owner's designated staging role. Never auto-invite by email, mint test sessions or trust a browser user ID.
7. Create/link only the designated verified native accounts and protected per-member bearer mapping. **Author:** private member, `can_submit=1`, `can_review=0`. **Independent human reviewer:** a different person, private member, `can_submit=0`, `can_review=1`. **Excluded tester:** identity-login permitted, native link but no community membership or grant. No public/guest access, self-join, automatic membership or open invitation.
8. Store `UMMAH_ACCOUNT_MAP_JSON` only in protected app settings (`schemaVersion:1`); its runner writes a mode-0600 server-only file. No global admin token; never send native bearer values to browsers or Git. REST is bearer-only; Basic/JWT/query authentication stays disabled. Revocations must affect current identity, token, membership and grants.

The authority is copied from `dragon-dawwa-railway-deploy` commit `5fe2b37ed7e7ca49fe97db8375addd59b4292a89`. `identity/vendor-provenance.json` verifies the original algorithms with only three isolated deployment constants changed. Preserve stable verified Google subject mapping, role/revocation/session enforcement and canonical-host forwarding to the loopback authority.

## Acceptance and evidence

- **Source:** root tests, `npm run lint`, `npm run build`, `npm test --prefix deployment/staging/identity`; PHP/shell/diff checks. Current source totals **47 + 19**, not Google login evidence.
- **Native:** pinned container/MySQL tests with explicitly synthetic independent identities; **36 HTTP + 16 model tests** at the exact qualified commit above. Bootstrap initially records **one private space / zero actors and content**; fixture identities are introduced only afterward inside disposable CI.
- **Hosted human:** genuine author Google login → private community → actual draft-first submission and own pending list → another human's reviewer login/action → approved-only member visibility. Repeat actual rejection, author review/queue denial, excluded access, revocation, direct routes and logout. Automated fixture decisions cannot count as human or scholarly review.
- **Self-review distinction:** native CI separately exercises a synthetic reviewer with submit permission and denies their own decision. Do not broaden the real review-only participant's grants just to duplicate that fixture.
- **Physical iPhone Safari:** record real model/iOS/Safari, exact URL/commit, login/callback, pending reload, different human's decision, approved/excluded views and logout. Desktop viewport emulation is separate and **NOT Safari hardware evidence**.

Do not mark the milestone or whole application complete before actual hosted/human/device acceptance. Preserve emerald/ivory/gold/turquoise, source citations and human scholarly review; no generated example becomes a genuine donation, transaction, ruling or construction record. Qdrant/BGE → Docling → PeerTube → charity/mosque follow the documented social milestone order.

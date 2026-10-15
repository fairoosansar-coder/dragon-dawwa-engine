# Isolated Railway staging — prepared, not activated

## Exact connected destination

- Workspace: **Dragon Dawwa Private**, `35d451e8-8abf-417a-8bdf-61c03102ce61`.
- New private project: **UmmahConnect - Isolated Staging**, `48d7a4cf-07dc-489b-8a3d-d6d10142b14e`.
- Its newly renamed empty environment: **staging**, `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`.
- [Project console](https://railway.com/project/48d7a4cf-07dc-489b-8a3d-d6d10142b14e?environmentId=1f7d98bf-1d49-4d9f-a5cc-13b57abcc095).

The console URL is **not an application staging URL**. No services, volumes, source attachments, deployments or public application domains were activated. The user's infrastructure spending decision and identity configuration are pending. Do not deploy merely because this configuration exists.

## Four isolated services after activation approval

| Service | Build / image | Database, persistent data and network |
|---|---|---|
| `ummah-app` | Root context; `deployment/staging/app.Dockerfile` | Main existing 33-screen UI. Public HTTPS domain and port 3000. A second process runs the preserved identity implementation only on `127.0.0.1:3001`; that port must never be public. |
| `ummah-humhub` | Root context; `deployment/staging/humhub.Dockerfile` | HumHub 1.19.0, REST 0.12.4 and native review module. Own volume at `/var/lib/ummah-humhub`. Separate HTTPS domain, target port 80. No public database port. |
| `ummah-humhub-mysql` | Immutable `mysql` image in `upstream-lock.json` | New database `ummah_humhub_staging`; user `ummah_humhub_app`; new root/app secrets and database volume. Private host `ummah-humhub-mysql.railway.internal`. |
| `ummah-identity-mysql` | Same immutable MySQL image | New database `ummah_identity_staging`; user `ummah_identity_app`; different root/app secrets and volume. Private host `ummah-identity-mysql.railway.internal`. Apply `identity/schema.sql` only on this new database's first boot. |

The schema's instance marker and identity startup checks must match the **new** project/environment. The staging source refuses the production project ID, production environment ID, root DB role, wrong schema and production public origin. Do not reuse the production `mysql` service, volume, credentials or session secrets. No production account data is cloned.

Container definitions are pinned and PHP/JS syntax-checked, but **the Docker builds and hosted MySQL 8.4 runtime have not been executed**. Qualify them before recording hosted acceptance. Native testing so far uses actual HumHub on PHP 8.3.6/MariaDB 10.11.14 in the isolated task sandbox.

## Build and credential setup

1. Obtain explicit activation approval and maximum additional monthly infrastructure budget. Establish resource/spend controls before deploying; service-count preparation is not a spending cap.
2. Build the two Dockerfiles without credentials in build arguments. Every upstream artifact/image is pinned. HumHub downloads are checksum verified. Do not attach automatic production deployments.
3. Create the new databases and volumes. MySQL user credentials belong only to the corresponding service and its client. The identity application's credentials must not be MySQL root credentials.
4. Assign the **new app** and **new HumHub** HTTPS hostnames. These are not yet allocated. Set `.env.staging.example` fields through protected Railway settings; it contains placeholders, not secrets.
5. Register a **separate Google Web OAuth/OIDC client**. Its exact callback is `<assigned-app-HTTPS-origin>/auth/callback`. The authorized JavaScript origin is the same app HTTPS origin. Do not edit the existing production client. The reused implementation verifies issuer/signature, PKCE/state/nonce, verified email, existing subject-derived invitation and current revocation/role state. Email addresses never act as identity keys.
6. Generate independent staging session, cookie and ancillary secrets (at least 32 random bytes). Set app ID `ummahconnect-isolated-staging`; never reuse a production JWT/session key. No AI-provider secret is included in the staging runner.
7. Initialize the **new HumHub schema** with `UMMAH_INITIALIZE_HUMHUB=yes` once, then set it false before normal restart. `UMMAH_REVIEW_SPACE_IDS` must contain the actual new moderated space IDs. The existing installation-state metadata is preserved in the staging volume.
8. Create or identify the explicitly designated native HumHub test accounts and private community. Give the author membership plus `can_submit`; give the independent reviewer membership plus `can_submit` and `can_review`; ensure the excluded account lacks community membership. These scoped grants exist only in `ummah_review_grant` in HumHub's own database.
9. After Google has verified each chosen existing account, use its non-secret `google:` subject hash to create only its designated **staging** `review_roles` row. Never auto-invite by email or accept browser user IDs. Allowlist changes require the owner's exact account/role choice.
10. Store `UMMAH_ACCOUNT_MAP_JSON` in protected app settings with `schemaVersion:1` and the designated subject hashes linked to their individual HumHub user ID/token. The startup runner writes a mode-0600, server-only file. Never use a global admin token; never send these bearer tokens to the browser or Git. Remove/disable mappings and revoke native tokens when accounts are excluded.
11. Enable HumHub REST bearer auth only, disable Basic/JWT/query-token auth and activate the `ummahreview` API module. Configure per-member tokens with expiry. Human review endpoints additionally reject Basic, query-token and impersonation auth.

The reused identity code is copied from Railway commit `5fe2b37ed7e7ca49fe97db8375addd59b4292a89`. `identity/vendor-provenance.json` records original hashes. Only three Google-mode deployment constants are changed for this new project; the authentication/session algorithms remain byte-identical. The main app's existing staging proxy forwards its canonical Host to the private loopback authority, not to another public Railway hostname.

## Acceptance and evidence boundaries

- Source: `npm ci`, `npm run lint`, root tests, build, and `npm test --prefix deployment/staging/identity`.
- Actual native provider: `scripts/test-native-humhub.mjs` and `scripts/test-native-model-guards.php`, with a mode-0600 sandbox fixture file. The seeder is **sandbox-only synthetic qualification**, not existing-account enrollment or genuine scholarly review.
- Hosted: real Google login in the main 33-screen app → permitted community → actual submission → another human logs into the reviewer account → decision → approved-only member visibility. Repeat rejection, self-review by a reviewer who authored their own post, excluded users, revocation, direct native-route bypass, logout and cookie/CSRF checks. Do not replace real login with a minted test session.
- Physical iPhone Safari: record actual iPhone model/iOS/Safari version, HTTPS URL, login/callback/cookie persistence, submission, reviewer decision, excluded account and logout. Chrome/WebKit desktop emulation is a separate result, never physical-device evidence.

Only after the hosted and physical tests actually pass can this milestone be marked complete. Maintain source citations, separate human scholarly review, and explicit fixture/example labels. HumHub remains the sole social engine.

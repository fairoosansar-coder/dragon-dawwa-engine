# Dragon Dawwa social integration — first implementation increment

12 October 2026. Status: source reconnaissance and read-only qualification tooling prepared. No social engine has been installed or qualified. No production changes.

## Scope and preserved baseline

The owner's instruction “Let's do this” starts the attached HumHub-first integration proposal. Work begins in a separate branch based on `integration/design-engine` at `fc2a428d391a573bc37a5893e4b802d35ef7aeb6`. The existing working checkout and branches are preserved. No runtime files, dependency manifests, API keys or databases are changed by this increment.

The local redesign commit `5af2fc7` and remote `fc2a428` have identical trees (empty `git diff`), despite different commit IDs. The remote `main` reference observed was `8267963749c793813cea45da143a05c0bfc06446`; its full divergence has not been reconciled.

## Source reconciliation

| Capability | Evidence inspected | Disposition |
| --- | --- | --- |
| Quran, Ummah study and Gemini podcast | Engine source and `docs/PROJECT_PROGRESS_2026-10-12.md` | Preserve working implementation; prior user-confirmed preview, not a new live test |
| Emerald/ivory/gold UI | Engine design branch at baseline above | Preserve; social integration must use the same shell |
| Social feed and current user | `src/App.tsx` initializes `INITIAL_WALL_POSTS` and `CURRENT_DEFAULT_USER` | Prototype; do not migrate these fixtures as real members or posts |
| Hadith research | `/api/analyze` and prior implementation report | Gemini research exists; strict Python evidence pipeline is still disconnected |
| Religious authenticity | `src/App.tsx` maps synthesis confidence into `purity_score` | Remove confidence-as-authenticity before a real public publishing path |
| Authentication and sessions | Separate Railway repository `server/auth.mjs` | Preserve/reuse design after complete audit; source includes session verification and persistent revocation |
| Members and community governance | Railway `server/member.mjs`, `server/community.mjs`, schema/migration tree | Preserve member and editorial functions; source exists, live state not certified |
| Deployment | Railway historical state notes | Notes describe deployment linkage and older runtime observations; current service commit, domains, data and backups remain unverified |

The Railway repository was read at tree/commit reference `5fe2b37ed7e7ca49fe97db8375addd59b4292a89`. It uses a different application stack (Next/vinext, custom Node server, Drizzle/MySQL and OIDC dependencies). It is not a duplicate of this React/Vite engine. No private source or data has been copied into the engine.

Do not merge the two applications wholesale. Source ownership is now clearer, but authoritative live source reconciliation is incomplete until the actual deployment commit and database are observed. A Git source reference is not a database backup. No restore-ready data snapshot was created.

## Integration decisions

1. HumHub is a candidate, not the selected production platform. Elgg remains the comparison candidate.
2. Preserve current authentication while qualifying account linking. Map identity issuer + subject to a stable member ID and HumHub user ID. Do not merge accounts by email or trust browser-provided roles.
3. HumHub would own social posts, comments, relationships, spaces and notifications. Dragon Dawwa retains canonical dossiers, evidence, reviews and publication versions. Existing member records must be reconciled, not overwritten.
4. Reuse existing editorial governance where suitable. All public wall submissions require human review; scholar review is a separate authority. Registration approval is not post approval.
5. Publication is `draft → pending review → approved → published`; rejection, revised content and withdrawal have explicit states. Edits after approval must be re-reviewed. Review decisions bind to a content version/hash.
6. A server-only adapter calls supported HumHub APIs in a verified user's context. Do not expose a shared administrative token to the browser or use it to render private feeds.
7. Approved publication events use durable outbox records and idempotency keys derived from dossier ID + version + destination. Retries cannot duplicate posts. Withdrawal must update downstream copies and caches.
8. No cross-service SQL writes. Donations, receipts and financial reconciliation stay outside the social post store.

## HumHub evidence and unresolved requirements

Official sources inspected:

- https://github.com/humhub/rest/blob/master/module.json
- https://github.com/humhub/rest/blob/master/docs/MANUAL.md
- https://github.com/humhub/rest/blob/master/docs/swagger/auth.yaml
- https://github.com/humhub/rest/blob/master/docs/swagger/space.yaml
- https://marketplace.humhub.com/module/rest/changelog

The inspected module declares version `0.12.5` and HumHub minimum/maximum `1.19`. The manual gives `/api/v1/` as its base. Its auth schema documents per-user bearer tokens and `GET /auth/current`; its space schema documents space access. These are upstream source observations, not tested deployment compatibility. Do not combine unpinned “latest” core and module releases. Do not assume the 1.20 migration notes mean a tested release pair is available here.

Before installation, select a stable core/module pair, record exact release commit IDs and download checksums, verify runtime requirements and dependencies, and inspect applicable licenses/module costs. No license clearance or specific stable version pair is claimed by this increment.

Custom mobile UI capability, following semantics, private feed filtering, pre-publication moderation, notifications, media permissions, Tamil/Sinhala coverage, OIDC mapping, backup/restore and upgrade behavior remain qualification questions. A successful read-only probe does not answer them.

## Read-only probe

Requires Node 22+. It does not depend on npm packages or load `.env` automatically.

Create two synthetic non-administrator test accounts on an isolated instance. A belongs to a private space; B does not. Generate a separate per-user bearer token for each. Configure these environment variables through a protected terminal/session secret mechanism:

| Variable | Value |
| --- | --- |
| `SOCIAL_TEST_ORIGIN` | Isolated instance origin only, e.g. `http://127.0.0.1:8080` |
| `SOCIAL_TEST_ISOLATED` | `true`, after verifying it is not production |
| `SOCIAL_MEMBER_A_TOKEN` | A's per-user token |
| `SOCIAL_MEMBER_B_TOKEN` | B's per-user token |
| `SOCIAL_PRIVATE_SPACE_ID` | Positive numeric ID of A's private space |

Run `node qualification/social/probe.mjs`. Only GET requests are made. Redirects are rejected, requests have timeouts, credentials are in headers, and the report omits response bodies and tokens. The isolation flag is an operator assertion, not independent proof of environment isolation.

Exit codes: 0 = these read-only checks passed; 1 = a check failed; 2 = configuration blocked. Missing credentials cannot count as passing. Tests use mocked HTTP responses: `node --test qualification/social/probe.test.mjs`.

## Required live acceptance matrix

All rows below are NOT RUN. For HumHub and Elgg separately, capture exact versions, isolated environment ID, synthetic account roles, requests, redacted responses and database persistence evidence.

| ID | Scenario | Required result |
| --- | --- | --- |
| Q01 | Two accounts; private/public communities | Distinct identities; outsider cannot read private objects, media, search or notifications |
| Q02 | Join, submit, review, publish | Pending post invisible to public and other unprivileged users; authorized reviewer publishes |
| Q03 | Direct API/native UI bypass | No unreviewed publication through alternate clients, endpoints or HumHub UI |
| Q04 | Restart and new browser session | Posts, comments, membership and review history persist |
| Q05 | Reviewed dossier sharing | Canonical version/source reference retained; model confidence cannot award scholar badge |
| Q06 | Edit/withdraw/retry | Re-review on edit, withdrawal propagates, repeated events create one post |
| Q07 | Mosque project update | Approved update reaches followers; social post cannot alter financial ledger |
| Q08 | Unified phone UI | Existing vivid theme and Quran/podcast flows work; EN/TA/SI labels and Arabic RTL checked |
| Q09 | Abuse and account controls | Blocking, reporting, role isolation, revocation, deletion/export verified |
| Q10 | Restore and upgrade | Restore onto a separate instance; test an explicit supported upgrade path |

## Current execution boundary and next work

This environment has Node but no `docker`, `php` or `composer` executable. No isolated HumHub/Elgg endpoint or credentials were supplied. Live engine installation, two-user tests and persistence checks therefore remain blocked. No paid resources were provisioned.

Next operational dependency: an isolated test runtime with supported PHP/DB tooling (or a Docker-capable development host), separate from Railway production. Then pin and install each candidate, execute Q01–Q10, and select the engine using measured results. Only after that should the social adapter be connected to the UI. No dummy feed will be presented as a completed social integration.

Production migration, payment activation, DNS changes and replacement of working components remain outside this increment.

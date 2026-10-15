# UmmahConnect — native qualification and live staging readiness

**15 October 2026 — partial milestone, not live-flow completion**

## Preserved source and production boundary

Preserved baseline: `9fa7f7a8dbc2687250e75f4514ebc1641994e519`. A bundle verifies its complete history. The continuation is on `development/ummahconnect-live-staging-20261015`; no rebase, force-push or change to the original branch is required.

Original recovery of the 13 Mac-M5 files remains a separate workstream. Those files were not accessed, discarded or overwritten in this continuation. When access returns, preserve the original working tree/stashes/reflog first and compare against both handoff `b09becb513c2701113f28c1bbc5a9151e45ebeff` and the pushed continuation before merging useful changes.

The main 33-screen emerald/ivory/gold/turquoise interface source is unchanged from the preserved baseline. HumHub remains the sole social engine. Neither production nor Aishu was changed.

## Task 1: authority confirmed against the deployed application

Authenticated, read-only Railway inspection verified the production app's active deployment `0e8b6bfc-aa6f-40c4-ac23-3c6cc10cf8c8`, GitHub branch `main` and linked source commit `5fe2b37ed7e7ca49fe97db8375addd59b4292a89` in `dragon-dawwa-railway-deploy`. Its actual Dockerfile is `/deploy/railway/Dockerfile.https`, with `server/index.mjs`, healthcheck `/healthz`, one replica and region `asia-southeast1-eqsg3a`.

Authentication authority is the existing Google OIDC verified issuer/subject mapping, invitation/current role lookup and signed session with persistent revocation. Production's source-enforced private MySQL schema/roles are its database authority, not this React app or a browser claim. No production secret or account/database record was copied. See [reconciliation](RECONCILIATION.md).

## Exact isolated destination prepared

The logged-in Railway **Dragon Dawwa Private** workspace contains a new private project **UmmahConnect - Isolated Staging**:

- Project `48d7a4cf-07dc-489b-8a3d-d6d10142b14e`.
- Environment **staging**, `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`.
- [Management console](https://railway.com/project/48d7a4cf-07dc-489b-8a3d-d6d10142b14e?environmentId=1f7d98bf-1d49-4d9f-a5cc-13b57abcc095), **not an application URL**.

The project is empty: no paid runtime, database, volumes, source deployments or application hostname activated. No spending decision has yet been received.

The connected Hetzner inventory contains only `ubuntu-32gb-hel1-1` (ID `164561478`), explicitly Aishu-labelled, with both public IP families blocked. It is excluded. Cloud Computer 2 is governed for private RepoLaunch/historical Aishu data, not this public application; no runtime was installed there. Cloudflare has no dedicated UmmahConnect staging DNS or tunnel, and no DNS/tunnel record was changed.

## Prepared source/configuration

`deployment/staging/` provides immutable app/HumHub Docker definitions, artifact/image lock, Apache restrictions, private persistent HumHub config, new identity SQL schema, placeholder-only protected-settings template and exact Railway service plan. The app keeps the identity process on loopback; public port is the existing app only. Two separate new MySQL services/schemas/users are specified; production DB resources and secrets are excluded.

The staging identity package preserves the production source's OIDC/session implementation with recorded hashes. Only deployment scope constants in its copied Google module differ; new guards pin the new project/environment, app audience, non-root role, schema and instance marker. It does not mint browser-provided identities or auto-enroll accounts by email. Source tests verify revocation/disabled-user/current-role behavior with controlled fixtures.

The Docker images have **not** yet been built/deployed, and hosted MySQL 8.4 has not been qualified. See [complete activation/configuration runbook](../../deployment/staging/README.md).

## Actual moderation correction and evidence

Native execution exposed two defects missed by prior source/syntax-only validation:

1. Referencing the REST event class constant during discovery occurred before the external module namespace was registered. Fixed using the pinned event name.
2. REST 0.12.4 emits its route event at class level with no sender instance. Fixed by resolving the actual REST module before adding routes.

The installed native module now executes against actual HumHub 1.19.0, official checksum-verified REST 0.12.4, PHP 8.3.6 and separate socket-only MariaDB 10.11.14 in the isolated task sandbox. It saves draft state **before the first content INSERT**, rejects publishing/scheduling/edit bypasses, preserves citations, keeps rejected posts as drafts and enforces independent reviewer identity plus space membership/scoped grants.

| Category | Result | What it does NOT prove |
|---|---|---|
| Existing app source | 44/44 pass; clean install, TypeScript and Vite build pass | Real Google login or hosted integration |
| New identity source | 19/19 pass | Actual Google callback or live MySQL invitation state |
| Actual HumHub REST | 20/20 pass | Hosted HTTPS login or actual human scholarly decision |
| Actual native model guards | 5/5 pass | Every concurrent/notification/rollback behavior on hosted MySQL |
| New identity SQL schema | Applies successfully on sandbox MariaDB | Hosted MySQL 8.4/container qualification |
| Hosted HTTPS end-to-end | BLOCKED | No working URL, Google client or real mapped test accounts |
| Physical iPhone Safari | NOT RUN | Desktop browsers and emulation are not physical-device results |

Native REST tests use three **synthetic native fixture accounts**: author, reviewer and excluded user. The provider is real; it is not a simulated response service. Tests verify community discovery, real submission, hidden pending detail/feed, reviewer queue, approval and permitted visibility, rejection, self-review denial even when the author also has review permission, excluded-user access and invalid/query-token denial. Native-model tests observe the first persisted state and exercise HumHub's own publish/schedule/edit paths. Approval notes explicitly mark automated test decisions, not genuine human scholarship.

Evidence is in `evidence/2026-10-15-native/`. Fixture credentials/database files and raw environment logs remain private outside Git. Prior Chrome screenshots are historical UI evidence only; no new hosted or physical-iPhone screenshots are claimed. [33-screen completion matrix](COMPLETION-MATRIX.md) retains all pending live statuses.

## Exact owner decisions/access required

1. Authorize metered activation of the **new separate Railway project** and specify the maximum additional monthly infrastructure budget. Alternatively designate another dedicated existing host whose policy allows this workload. Do not reuse Aishu or production.
2. Supply a **separate staging Google Web OIDC client through protected settings**, not chat. Once the app hostname is allocated, register that exact HTTPS origin and `<origin>/auth/callback`; do not change the production client.
3. Designate the real author, independent reviewer and excluded test identities and their precise staging roles. Verify their Google subject references before invitation/mapping and issue individual native HumHub tokens/memberships/grants. No account permissions are silently copied or granted.
4. Make a physical iPhone Safari session available after HTTPS staging and the three real test identities are working.

Then qualify container builds/new MySQL storage, activate only the new isolated services, connect same-origin auth and per-member native identities, run a real main-interface login → community → submission → **another human's** review → permitted visibility pass, repeat the negative cases and capture dated screenshots. Only then can the hosted milestone be completed. Physical Safari remains a separate release gate until it actually passes.

Qdrant/BGE → Docling → PeerTube → charity/mosque implementation remains in the documented next order, after this first hosted flow. No generated example is a genuine donation, transaction, verified scholarship or construction progress.

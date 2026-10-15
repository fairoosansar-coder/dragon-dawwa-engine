# Native HumHub staging moderation

This extends **HumHub as the sole social system of record**. It is new continuation source, not recovered Mac-M5 files. Actual PHP/HumHub/REST/MariaDB qualification now passes; hosted Google login, another human's decision and physical iPhone Safari remain separate acceptance gates.

## Exact tested source

- HumHub 1.19.0: `8f22a72361841404b3b442306126650fc0f8153b`.
- Core archive SHA-256: `7bd1806389e080c0f1b963fb8d70aae1c5664bcea19a22fc562499b6db14f973`.
- [Official REST 0.12.4 artifact](https://marketplace.humhub.com/downloads/free/rest-v0.12.4.zip): SHA-256 `6180260e042bdc336584eff07271d6af1981d64ef8ed5d00dc4c445f29e3417d`.
- [Official compatibility table](https://marketplace.humhub.com/module/rest/downloads). A newer REST release is not silently substituted.
- `core-hooks/manifest.json` records the exact six patched core targets plus generic event payload. All original/installed hashes are verified by `scripts/apply-humhub-review-hooks.php`.

The narrow core changes add module-neutral cancellable events for movement, raw updates, views, readable queries, search/cache results and File operations. They do not introduce another social engine. Corresponding patch source and module source are available in this repository; preserve HumHub/REST attribution and upstream licensing when distributing builds.

## Isolated installation

1. Use a new isolated PHP/MySQL instance and persistent storage, never production or Aishu. Take an isolated backup before upgrades.
2. Install the exact core/REST pair, then run `php scripts/apply-humhub-review-hooks.php --runtime=<humhub-root>`. It accepts only audited original or exact installed bytes, validates all targets before patching, and is idempotent. Unknown bytes fail the build. The prepared HumHub Dockerfile performs this automatically.
3. Copy this module to `protected/modules/ummahreview`; set `UMMAH_REVIEW_ENVIRONMENT=isolated-staging` and `UMMAH_REVIEW_SPACE_IDS` to actual **Space IDs**, not ContentContainer IDs. Runtime module initialization verifies every required core hash and refuses missing/changed hooks.
4. Enable REST and this module, then apply native module migrations. `ummah_review`, scoped grants and append-only `ummah_review_event` belong exclusively to the HumHub database. UPDATE/DELETE audit triggers must be installed. Use a scoped migration role; binary-logging restrictions must be handled on the new instance only. Revoke unnecessary schema-changing privileges from the runtime role after deployment initialization.
5. Supervise Apache, HumHub's native queue listener and native mutex-protected hourly maintenance. No separate Manus schedule is needed for the native jobs. New-container initialization uses `UMMAH_INITIALIZE_HUMHUB=yes` only for the first empty database; use `no` thereafter. Upgrade migrations are non-destructive; audit-preserving rollback does not delete tables.
6. Use separate members and individual expiring bearer tokens. Disable Basic, JWT/query tokens and impersonation on review routes. Both author and reviewer must be current enabled members; operator-reviewed `ummah_review_grant` rows explicitly permit submit/review. Author may not review their own submission even if they have a review grant.
7. Store verified application subject → native ID/token mapping in a server-only mode-0600 protected file. No browser role/ID, shared administrative token, password, map or session cookie belongs in Git, screenshots or chat.

## Implemented policy

- `Events::saveSubmittedDraft` permits exactly the submitting Post object and clears its scoped context in `finally`. Raw native creation in moderated spaces is denied before an orphan Post can be inserted. First Content INSERT is draft/private, never briefly published.
- Approval uses HumHub's native state service inside the same database transaction as the decision. Current membership, enabled user and scoped grant are locked and rechecked. The reviewed Post/content/actual community binding, message digest and absence of attachments must match.
- Native publishing, scheduling, force movement, raw state/visibility/container mutation and ordinary approved-message editing are denied. Approved text is immutable; changes require a **new submission and review**, not inherited approval.
- Pending/rejected/untracked moderated Posts are denied on native detail, streams, readable queries, direct and cached search—even through owner/global-content-manager shortcuts. Approved private Posts require current membership in the original enabled community.
- **Post attachments are unsupported in this milestone.** FileManager attachment and native File insert/update/delete/raw-assignment routes synchronously deny protected linkage. Native public/creator File download shortcuts also deny unexpected protected attachments. Unrelated/unlinked/profile files retain native policy. A later reviewed ingestion/media workflow is required before enabling uploads.
- Retry keys are per authenticated user. Same key/different payload conflicts. Exact retries return one post/decision; deleted or changed versions return conflict rather than stale success. Competing decisions serialize and only one commits.
- The native append-only ledger records started/committed/replayed/failed attempts, correlation keys, actor, decision and version digest—never post bodies, credentials or raw exceptions. A successful terminal event commits with the business transaction; failed-attempt events append **after rollback**. If audit/database storage itself is unavailable, the endpoint fails and cannot claim a durable record or success.
- Publication failures roll back review status and content state. Rejection remains draft. Pending/rejected content does not create native content notifications. Review API responses are private/no-store.
- Citations remain source references. Community approval is **not** scholarly verification, a Hadith grade or a financial attestation.

Deployment controls must keep the module/hooks enabled and protect migration privileges. Database administrators, direct SQL/bulk writes and physical filesystem changes are outside application-model guards; injected inconsistent content/files nevertheless fail subsequent read/publication checks. These limitations are not hidden by source-test success.

## Main application and identity

Use the existing main app, not a separate demo. Server-only configuration:

```dotenv
UMMAH_SOCIAL_ENVIRONMENT=isolated-staging
UMMAH_PUBLIC_ORIGIN=https://<separate-application-host>
UMMAH_IDENTITY_ENVIRONMENT=isolated-staging
UMMAH_IDENTITY_ORIGIN=http://127.0.0.1:3410
HUMHUB_ORIGIN=https://<separate-humhub-host>
UMMAH_ACCOUNT_MAP_FILE=/secure/staging/social-accounts.json
```

The protected map is `{ "schemaVersion": 1, "accounts": { "<verified-google-subject-reference>": { "humhubUserId": <native-ID>, "token": "<individual-token>", "disabled": false } } }`. These are placeholders, not enrolled identities. Current authority roles/session revocation, current mapping and native `/auth/current` are checked; mapping alone grants no permissions.

`deployment/staging/identity/` preserves the deployed OIDC/session algorithms with provenance and narrowly changed staging scope. It uses separate schema, app audience, session secrets, invitations and persistent revocation. Register the actual new HTTPS origin and `/auth/callback` with a **separate staging Google Web client**. No production client, secrets, roles or database data are copied.

## Evidence and outstanding acceptance

Actual sandbox runtime: **32/32 HTTP tests**, including concurrent decisions, retries, forced database publication failure, durable failed audit, version/tombstone conflict, revocation and multipart denial; **15/15 native model/cache/file tests**. Provider and database are real; accounts/decisions are explicitly synthetic, not human participation. Container/MySQL 8.4 qualification is separately recorded in TEST-RESULTS.md.

Reproduce with protected fixture configuration using `scripts/test-native-humhub.mjs` and `scripts/test-native-model-guards.php`. `scripts/qualify-native-container.sh` builds actual pinned containers and checks persistent restart/background workers, without hosted deployment, production access or genuine Google login.

Hosted acceptance still requires screens 2 → 11/12 → 5 → 33 → 4/6 with real existing Google accounts, another authorized human, an excluded member, logout/expired sessions/revocation and negative native tests. `scripts/test-live-social.mjs` refuses missing prerequisites. Physical iPhone Safari is a distinct hardware gate; Chrome/mobile emulation is never reported as Safari.

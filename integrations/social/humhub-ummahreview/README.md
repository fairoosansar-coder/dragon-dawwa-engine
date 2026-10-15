# Native HumHub staging moderation

This is **new continuation source**, not recovered Mac-M5 edits. It extends HumHub rather than introducing another social engine. It is not installed or runtime-qualified yet.

## Pinned source pair

- HumHub 1.19.0 source commit: `8f22a72361841404b3b442306126650fc0f8153b`.
- REST 0.12.4 official artifact: https://marketplace.humhub.com/downloads/free/rest-v0.12.4.zip
- Verified SHA-256: `6180260e042bdc336584eff07271d6af1981d64ef8ed5d00dc4c445f29e3417d`.
- Official compatibility table: https://marketplace.humhub.com/module/rest/downloads
- REST 0.12.5 is now listed; it has **not** been substituted for the documented, inspected 0.12.4 pair.

Use an isolated HumHub PHP runtime, its own MySQL database and storage, and operator-owned credentials. Do not attach it to production data or Aishu. Review AGPL/module terms before distribution.

## Install only in isolated staging

1. Install the exact HumHub/REST pair in an isolated instance. Take and verify an isolated database backup before schema operations.
2. Copy this directory to HumHub's `protected/modules/ummahreview`. Do not copy it into any production instance.
3. Set `UMMAH_REVIEW_ENVIRONMENT=isolated-staging` and `UMMAH_REVIEW_SPACE_IDS` to a comma-separated list of actual staging community IDs, without spaces. The module fails startup without these explicit guards.
4. Enable the module and apply its migration through the normal HumHub operator workflow. The new tables belong **only to HumHub's database**. Audit-preserving rollback is deliberately not implemented as destructive table deletion.
5. Permit REST access for the two approved test members. Use individual bearer tokens; disable query-token, Basic and impersonation access. The review controller itself allows only bearer authentication.
6. Both accounts must be actual members of the test community. Configure `CreatePost` for the submitting member. Insert scoped operator-reviewed `ummah_review_grant` rows: account A `can_submit=1, can_review=0`; account B `can_submit=1, can_review=1`. Neither requires a shared system-admin token. Test a second community where account A is not a member.
7. Connect the original application's verified account IDs to individual HumHub IDs/tokens using a protected server file with mode `0600`. No token, password, map or real cookie belongs in Git or chat.
8. Keep the module enabled throughout staging acceptance. Module disable/removal or database-administrator writes are outside application-route guards and must be covered by deployment/operations controls before release.

## Application staging configuration

Use the SAME main UmmahConnect app with these server-only variables:

```dotenv
UMMAH_SOCIAL_ENVIRONMENT=isolated-staging
UMMAH_PUBLIC_ORIGIN=https://<isolated-application-host>
UMMAH_IDENTITY_ENVIRONMENT=isolated-staging
UMMAH_IDENTITY_ORIGIN=https://<isolated-identity-backend-host>
HUMHUB_ORIGIN=https://<isolated-humhub-host>
UMMAH_ACCOUNT_MAP_FILE=/secure/staging/social-accounts.json
```

The protected map format is `{ "schemaVersion": 1, "accounts": { "<verified-google-account-reference>": { "humhubUserId": <actual-staging-ID>, "token": "<individual-provider-token>", "disabled": false } } }`. Values shown are placeholders, not installed accounts. The resolver rechecks authority roles, persistent session revocation and the protected map on every request. Provider `/auth/current` must match the mapped member.

The staging identity service must use Railway's existing OIDC/session/role implementation but a **separately reviewed staging configuration contract**. Existing `server/google-auth.mjs` and `server/db.mjs` hard-code the old project/environment and schema. They cannot simply be redeployed to a new environment unchanged. Configure the staging authority's canonical origin to `UMMAH_PUBLIC_ORIGIN`, register its exact `/auth/callback` with the staging OIDC client, and use separate app ID, secrets, role/session store and DB grants. The application transports `/auth/*` to that backend with canonical Host forwarding; cookies stay host-only. Production domains are rejected. This source does not change the Railway repository or provision a second identity authority.

## Guarantees implemented in source

- `Content::STATE_DRAFT` is assigned **before the first `Post::save()`**. There is no save-published-then-draft interval.
- Native Post and Content before-save events guard all posts in explicitly moderated spaces, including attempts to publish/schedule through other HumHub routes.
- Submitted posts are immutable through normal Post update events. Changed text must be submitted as a new version, not inherit an old approval.
- Review rows record author, original-text hash, source references, status, reviewer, time and required note.
- The author cannot review their own submission. Reviewer membership and explicit per-space review grants are checked in HumHub, independently of application role gates.
- Decisions lock review/content rows in a DB transaction; changed content, stale decisions and failed publication do not receive a success response.
- Rejection leaves draft content unpublished. Approval uses HumHub's native state service and private community visibility.
- Approved feed and direct app detail require both `approved` review status and native `PUBLISHED` state. The feed does not include the native query's author-owned drafts.
- Sources are preserved HTTPS references, never automatically verified scholarship. A human community review does not certify qualifications or a Hadith grade.
- Same-origin JSON, bounded bodies, per-member tokens, idempotency keys and provider error redaction are enforced.

## Acceptance still required against the real provider

Run two separate existing-account logins and check callback/session/logout/revocation. Exercise submission and independent approval in screens 2 → 11/12 → 5 → 33 → 4/6. Verify both member permissions, an excluded community, rejection, retries, simultaneous decisions, no-author-self-review, direct native HumHub publication/scheduling/edit/move bypass, native search/stream exclusions, and transaction rollback with real MySQL. Verify native REST responses and permission behavior against this exact artifact, not a stub. Confirm backup/restore and rollback behavior. Run physical iPhone Safari separately from Chrome/WebKit emulation.

`node scripts/test-live-social.mjs` refuses missing live configuration and records `BLOCKED`, never a mock success. It uses pre-authenticated operator-supplied staging sessions; fresh OIDC login, native bypass, real DB rollback and physical Safari remain separate tests even if that script passes. Test-only post text must remain explicitly labelled and should be removed through the approved staging retention workflow after evidence collection.

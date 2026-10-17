# Private account-free staging bootstrap

## Scope and identity prerequisites

The owner explicitly approved a **separate UmmahConnect staging Google Cloud project and Web OAuth client** on 2026-10-17. No production Google project, client, account, database or Aishu runtime may be changed.

The browser's Google Cloud account chooser currently shows a signed-out account. This is not a verified current session or a designated participant. Project/client creation therefore remains blocked by Google sign-in. The three supplied account entries remain bracketed placeholders; none is eligible for enrollment, membership or role grants.

Create the separate project under the owner's intended Google account after sign-in, without linking a billing account or creating Google compute resources. Configure a server-side Web OAuth client for:

- App name: **UmmahConnect Staging**.
- Audience: **External / Testing**, not production publication.
- Minimum identity scopes: `openid profile email` only.
- Authorized redirect URI: `https://ummah-app-staging.up.railway.app/auth/callback`.
- Authorized JavaScript origin, if the console requires one: `https://ummah-app-staging.up.railway.app`.
- Support/developer contact: the owner-designated verified Google account, not an invented email.
- Test users: only the actual designated accounts once supplied.
- Store `GOOGLE_OIDC_CLIENT_ID` and `GOOGLE_OIDC_CLIENT_SECRET` directly in the protected `ummah-app` Railway settings. Never put values in source, evidence, chat, screenshots or the completion matrix. Google displays a new client secret only at creation; preserve it immediately in protected storage.

Official references: [Manage OAuth Clients](https://support.google.com/cloud/answer/15549257?hl=en) and [Configure OAuth consent](https://developers.google.com/workspace/guides/configure-oauth-consent). Any required account security check or policy attestation must be completed by the owner through its protected workflow.

## Native first boot

This mode creates **only** the private space named **UmmahConnect Staging Review**. It creates no users, owner memberships, native passwords, bearer tokens, social posts or review grants.

Set `UMMAH_BOOTSTRAP_PRIVATE_EMPTY=yes`, `UMMAH_INITIALIZE_HUMHUB=yes`, and an empty `UMMAH_REVIEW_SPACE_IDS` for the first deployment of the qualified private-bootstrap branch. Retain the exact isolated project/environment IDs, the separate `ummah_humhub_staging` database and non-root `ummah_humhub_app` role.

The private MySQL start command must match the qualified schema-local trigger environment:

```text
/usr/local/bin/docker-entrypoint.sh mysqld --skip-log-bin --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci
```

This was applied only to the dedicated staging HumHub MySQL service. Its authenticated SQL probe confirmed MySQL 8.4.11, `@@log_bin=0`, and zero schema tables after restart. Its persistent volume was retained. This avoids granting global `SUPER` or weakening the audit-trigger trust policy. Binary logging/PITR is not claimed for this staging instance; the attached volume and separately verified restart preservation are not an automatic backup service.

The container performs a pre-migration emptiness check, native core migrations and site initialization, then creates the ownerless private space via HumHub's real `Space` model. The native null-creator cache defect is corrected through a SHA-qualified pinned-core patch that retains normal authenticated-user behavior.

Native CI run `38999928604` failed because `Space::save()` rejected the account-free instance. The pinned model's `checkVisibility` requires a human private-space creation permission; a guest has none. The correction replaces only that one validator on the bootstrap's new `Space` instance with the exact-project/environment/DB-role, explicit-initialization, zero-user CLI contract and strict private flags. All other native field validators and persistence hooks remain enabled. No global guest permission, subclass container type, fake owner or unvalidated save is introduced. A native regression verifies ordinary guest private-space creation still fails. The corrected revision must pass the full disposable MySQL/container CI before hosted deployment.

Space visibility is private, self-join is disabled, default content visibility is private, and automatic membership is disabled. Guest access, anonymous registration and email/link invitations are disabled. REST starts with explicit per-account bearer authentication; Basic, JWT and query-token authentication are disabled. No API access is enabled for all users.

The **actual database space ID** is recorded in `/var/lib/ummah-humhub/private-community.json`, loaded before enabling moderation, then verified against the real database before serving HTTP. IDs are never guessed. The temporary empty-ID discovery allowance is exact-project, exact-environment, explicit first-boot **CLI only** and is unset before Apache, queue and cron start.

After successful hosted initialization, set `UMMAH_INITIALIZE_HUMHUB=no` and record the actual moderated space ID in protected settings. Keep the private-mode marker loader for restart verification. Bootstrap refuses existing account/content/grant datasets rather than resetting them. It preserves explicitly linked real-account REST permissions on later restarts.

## Participant permissions when actual identities are available

Bind only verified Google subjects to native HumHub users using the protected server-side mapping; browser-supplied user IDs, display names or roles are never authoritative.

- **Author:** current community member; native `can_submit=1`, `can_review=0`; view approved content and their own pending/rejected submissions; no review queue or approval rights.
- **Independent reviewer:** a different real person's verified account; current community member; `can_review=1`; view the queue and approve/reject another person's unchanged submission. No self-review. Do not grant submitter or administrator rights unless explicitly needed and authorized.
- **Excluded tester:** allowed by the staging identity authority; native account linked but **no membership or community grant**. Sign-in permission does not imply social access.

The new author-owned submissions endpoint derives the author from authenticated native identity, rejects other-author selectors, rechecks current user/membership/grants, and never changes the approved-only feed. Its main-interface refresh survives reloads; a local device draft is still not a server submission.

## Acceptance boundaries

Source/build checks and synthetic Docker/MySQL qualification are not human acceptance. Only the hosted native runtime with the designated verified accounts, an independent human action, negative access tests and a physical iPhone Safari run can complete the live milestone. The short physical-device sequence must be executed after the app is actually ready; planned steps do not count as results.

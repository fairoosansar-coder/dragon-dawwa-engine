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

The unchanged authority intentionally returns **403 / Invitation required** after an uninvited account successfully verifies with Google. It shows a non-secret `google:` subject-derived reference and creates no application session. Obtain that reference from each designated person's genuine staging Google callback through a private channel, associate it with the owner's explicit account designation, then add only the intended staging role and native mapping. A second login can then receive a session. This is not automatic email enrollment or a bypass of the existing role gate. Never request passwords, client secrets, bearer tokens or cookies from participants.

- **Author:** current community member; native `can_submit=1`, `can_review=0`; view approved content and their own pending/rejected submissions; no review queue or approval rights.
- **Independent reviewer:** a different real person's verified account; current community member; `can_review=1`; view the queue and approve/reject another person's unchanged submission. No self-review. Do not grant submitter or administrator rights unless explicitly needed and authorized.
- **Excluded tester:** allowed by the staging identity authority; native account linked but **no membership or community grant**. Sign-in permission does not imply social access.

The new author-owned submissions endpoint derives the author from authenticated native identity, rejects other-author selectors, rechecks current user/membership/grants, and never changes the approved-only feed. Its main-interface refresh survives reloads; a local device draft is still not a server submission.

## Acceptance boundaries

Source/build checks and synthetic Docker/MySQL qualification are not human acceptance. Only the hosted native runtime with the designated verified accounts, an independent human action, negative access tests and a physical iPhone Safari run can complete the live milestone. The short physical-device sequence must be executed after the app is actually ready; planned steps do not count as results.

## Hosted observation — 17 October 2026, 04:34 UTC

The exact private-bootstrap source `3435c8356fa2b208c840393f8f5b89ccddc22420` passed [actual non-deploying CI 39001338720](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/39001338720), including **36 native HTTP + 16 model tests**, account-free creation/restart and refusal to initialize over fixture accounts. The corresponding separate Railway HumHub deployment `864c29ea-f4b8-4a10-8d79-61bab638c384` completed native installation/migrations and the protected marker. Its actual scoped helper verified **space 1 / content container 1; users 0, memberships 0, posts 0, grants 0, reviews 0; no guests/registration/auto-join; bearer-only**. No fixture script was used on hosted staging.

HTTP readiness is nevertheless **failed**: Apache reports `AH00534: More than one MPM loaded`, with both `mpm_event` and `mpm_prefork` enabled in the hosted image. Queue/cron run but Apache is FATAL; the bounded HTTPS watcher ended at **502 after 605 seconds**. A new minimal image/boot correction forces exactly PHP-compatible prefork, validates Apache configuration, and injects the observed duplication only into disposable CI to prove recovery. Do not claim this replacement qualified before its exact new run passes.

The verified actual space ID `1` and **initialization=no** were then saved in protected HumHub settings, with no extra volume/account grant. The provider also started an old-source redeployment when the modal's Deploy Changes button received Alt-click: **that modal operation is not established as apply-only**. Preserve the native volume/space and never reset it. New-source activation must remain successful-CI gated and staging only.

A generic text-entry attempt initially missed the terminal and produced an unintended **unapplied** function draft. It was individually reviewed and discarded before any deploy; exactly the four approved services and no extra pending resource remain. Subsequent checks used the console's actual editable xterm textarea with normal paste/Enter events, not page keyboard shortcuts.

Google sign-in, three actual distinct account emails, verified subject enrollment, hosted independent-human flow and physical iPhone Safari remain pending. The app is offline, so its reserved hostname is not a working flow URL.

## Current qualified private bootstrap — 17 October 2026, 04:53 UTC

- **Qualified/deployed native commit:** `66a1adb0052b56a0c094eb43ce0b1259bfc37a4f`, [native CI 39003367427](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/39003367427). **36 HTTP + 16 model** pass with synthetic actors in disposable MySQL/container CI; both images, workers, private paths, first boot, persistent restart, ordinary-guest denial and refusal to initialize over fixture accounts pass. The deliberately duplicated-MPM fault is recovered by exactly-prefork normalization before database startup. No hosted fixture seeder was used.
- **Hosted native deployment:** `5aed714c-4f36-4651-9eb3-6b9e58f647d1` in only project `48d7a4cf-07dc-489b-8a3d-d6d10142b14e` / environment `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`. Protected console confirms the exact source above, `UMMAH_INITIALIZE_HUMHUB=no`, `UMMAH_REVIEW_SPACE_IDS=1`, Apache/queue/cron RUNNING and only `mpm_prefork`. Native private marker mode **0600**, same actual space/container **1/1** after redeployment; **zero users, memberships, posts, grants, reviews, passwords and review events**.
- **Actual scoped SQL:** non-root `ummah_humhub_app@%`, separate `ummah_humhub_staging`, MySQL **8.4.11**, **50 native tables**, **2 append-only audit triggers**, `@@log_bin=0`. No global/SUPER role or PITR/backup guarantee is claimed. Existing three volumes and four service caps are unchanged.
- **Backend HTTPS:** https://ummah-humhub-staging.up.railway.app — a reachable private native backend, **not a working main-app Google flow**. **7/7 actual anonymous-boundary checks** pass: feed, own-submissions, real queue `/api/v1/ummahreview/reviews` and current identity = **401**; protected config/runtime/upload paths = **403**. An initial audit used an invalid `/queue` path (404); that attempt is retained separately and corrected from committed route authority, not represented as an access-control defect. These checks do not test member/excluded identities or human approval.
- **Main application:** https://ummah-app-staging.up.railway.app is still **reserved/offline: HTTP 404, verified TLS**, checked 04:53 UTC. No app deployed commit or working login is claimed. Exact callback remains `https://ummah-app-staging.up.railway.app/auth/callback`.
- **Source/UI:** **47 app + 19 identity**, PHP/shell/lint/build pass. Actual local Chromium **154.0.8037.57** audits all **33 routes**, zero overflow/page errors, six source-interface screenshots including the author-owned pending panel. These are credential-free loopback screenshots with desktop mobile-viewport emulation, **NOT hosted human or physical iPhone Safari evidence**.
- **Not complete:** owner Google sign-in to create the already-authorized separate staging project/Web client; three actual distinct account emails; genuine verified-subject enrollment, scoped native mappings/grants and app deployment; a different human's real approve/reject flow, member/excluded/revocation acceptance; physical iPhone Safari. Placeholder emails are not enrolled. Reviewer remains review-only (`can_submit=0`, `can_review=1`); author cannot review; excluded account receives no membership/grant.
- **Preservation:** production, Aishu, existing auth algorithms, approved design and original 13-file recovery remain unchanged/separate. An accidental **unapplied** function draft from a mistargeted generic text-input attempt was individually discarded before deploy; exactly the four approved services/no extra pending resource remain. The first old image's real duplicate-MPM/502 failure and the settings-triggered old-source redeployment remain documented, not hidden.

Evidence: `evidence/2026-10-17-private-bootstrap/`, particularly `qualified-apache-correction-ci.json`, `hosted-corrected-runtime-verification.json`, `hosted-anonymous-boundary-audit.json`, `hosted-runtime-console.webp` and `screenshots/`. No financial, scholarly or construction fact is certified; Qdrant/BGE → Docling → PeerTube → charity/mosque follow only after the documented social milestone.

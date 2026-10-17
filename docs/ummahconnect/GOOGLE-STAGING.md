# Separate Google staging OAuth setup

**Current state: 17 October 2026, 06:23 UTC.** The separate Google project, owner-approved OAuth consent app and Web client are created. The final credentials are saved only in the isolated Railway `ummah-app` protected variables. Apply-only completed with **zero pending changes**; the application is still **offline**. This is OAuth configuration, not successful application login or human review. Production and Aishu are unchanged.

## Configured staging project and client

- Project: **UmmahConnect Staging**, **`ummahconnect-staging-261017`**, number `677673398182`, no organization.
- Consent name: **UmmahConnect Staging**; audience **External**, publishing status **Testing**. It was not published to production.
- The owner approved Google's explicit User Data Policy agreement at **2026-10-17 05:46:26 UTC**; the agreed consent form was then submitted.
- Owner support/notification contact: `ferozansarlk@gmail.com`. This contact is **not a participant designation**.
- Single OAuth client: **UmmahConnect Staging Web**, type **Web application**.
- Exactly one redirect: **`https://ummah-app-staging.up.railway.app/auth/callback`**.
- JavaScript origins remain empty. The optional AI-agent client designation is not selected.
- Basic identity scopes only: `openid`, `userinfo.email`, `userinfo.profile`; the existing server requests the equivalent **`openid email profile`**. No sensitive/restricted Google API scopes were added.
- No billing account, purchase, extra project, test user, native user, membership or review grant was added in this setup.

[Project console](https://console.cloud.google.com/home/dashboard?project=ummahconnect-staging-261017). No existing project/client was edited; in particular the pre-existing Aishu project remains excluded.

## Protected destination and credential handling

Only project `48d7a4cf-07dc-489b-8a3d-d6d10142b14e`, environment `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`, service **ummah-app** (`f3756510-4e87-445b-9cfb-9dad042d6758`) received `GOOGLE_OIDC_CLIENT_ID` and `GOOGLE_OIDC_CLIENT_SECRET`. Final staged values were privately compared with the new client inside the browser; only booleans were returned. The provider's apply-only action saved both settings without starting an app deployment. Its masked variable list now contains **26 service variables**, no pending change set, and **Service is offline**.

**Security handling:** two unused temporary setup secrets appeared in diagnostic output—first in a Google clipboard attribute and then in a Railway diff button. Both were disabled and deleted **before application use or deployment**. The final fresh replacement was not returned in output and is the sole remaining enabled client secret. No production or pre-existing account credential was altered. The two owned diagnostic files were sanitized; historical private task results cannot be claimed erased. Final temporary browser memory was cleared and the clipboard overwritten with a non-secret marker. Google warns that configuration changes can require propagation time; this record does not claim immediate global revocation timing.

No client ID or secret is included in this handoff, Git or exported evidence. Screenshots show masked provider values. Do not open a raw/diff value screenshot or log unredacted clipboard attributes/button text.

## Testing mode is not community authorization

Google documents a **basic-identity exception**: requests limited to name/email/profile or Sign in with Google do not require users to be on the trusted testing list. Therefore External/Testing and a zero test-user count **must not be used as an access-control boundary**. [1]

The existing authority already requires a cryptographically verified Google identity, stable issuer/`sub` reference and an enabled current `review_roles` row before creating an application session. It also retains current role/session/revocation checks. Google itself says to use `sub`, not email, as the stable account key and to verify token signature, issuer, audience and expiry. [2] HumHub membership and scoped native grants separately protect the private social community.

Source inspection: `deployment/staging/identity/vendor/google-auth.mjs` requests basic scopes with state/nonce/PKCE, rejects unverified identities, queries current roles by the derived subject reference and returns **403 / Invitation required**, without an app session, for uninvited accounts. This source check and fresh **47 app + 19 identity** passing tests are not live Google acceptance.

## Remaining execution gates

1. Obtain three **actual, distinct Google email designations**: author; reviewer belonging to a **different human**; login-permitted but community-excluded tester. Do not infer them from the owner support contact or placeholders.
2. Add only those designated Google test users where appropriate. Basic-login exceptions still require application-side authorization; never rely on test-user membership alone.
3. Bind **ummah-app only** to qualified development runtime ancestry, not `main` or the documentation branch, and verify its isolated database/origin/session settings. The application is not yet deployed. Its invitation-required, no-session callback can then establish genuine subject references without granting access automatically.
4. Explicitly enroll the designated verified references in the separate identity authority. Link native HumHub users and protected per-member credentials only as needed. Author: approved content plus submit/own pending, **no review**. Reviewer: independent approve/reject, **review only**. Excluded tester: application login allowed, **no community membership or grant**. No public/guest access.
5. Exercise real HTTPS author submission and own pending reload, the different human's approval and rejection, member approved visibility, self-review denial, excluded direct-path/queue denial and revocation. Automated fixtures cannot provide human acceptance.
6. Run the actual physical iPhone Safari sequence and record hardware/iOS/browser evidence separately from existing desktop Chromium emulation.

The native backend remains deployed at **`66a1adb0052b56a0c094eb43ce0b1259bfc37a4f`**, private space/container **1/1**, initialization off; its last protected SQL verification had zero users/posts/grants. No accounts/content were added in this OAuth setup. Fresh anonymous checks still return native **401** and main-app health **404**, with verified TLS. There is no working main-app Google workflow URL yet.

All 33 screen statuses remain **6 locally Working / 20 UI Only / 7 Blocked**. Preserve the vivid emerald/ivory/gold/turquoise interface, source citations and genuine human scholarly review. Original 13-file recovery remains separate; Qdrant/BGE → Docling → PeerTube → charity/mosque remain later work, not completed services.

Evidence: `evidence/2026-10-17-google-staging/setup-state.json`, `https-readiness-after-oauth.json`, `google-testing-boundary-source.json`, `web-client-final-redacted.webp` and `protected-oauth-settings.webp`. The earlier project-only record is retained as history.

## References

[1]: https://support.google.com/cloud/answer/15549945?hl=en "Google Cloud: Manage App Audience, Testing basic-identity exception"
[2]: https://developers.google.com/identity/openid-connect/openid-connect "Google OpenID Connect: stable subject identifiers and ID-token validation"

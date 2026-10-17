# Separate Google staging OAuth setup

**Current state (17 October 2026, Author activation):** the first Author supplied a reference from actual Google verification and is now linked to native HumHub user 1 in private UmmahConnect Staging Review (space 1). The qualified operator source 56b797a2be2f24ea54587dad1c6e611c79b88e18 passed CI 39033827738: 36 native HTTP / 16 model cases plus seven member/encrypted-transfer/actual-identity-SQL checks. Hosted enrollment created no password, administrator or review permission. The protected one-entry map is mode 0600, UID 1000; guarded activation passed actual native identity/private-space/approved-feed/own-pending reads and review-queue 403. App source remains afb3e234b4b1e13f7516d879c15957e0b18dcc7f; native remains 44ee3bb5f39b275de84832e15fa02ae82c7b14f7. Actual anonymous health 200, /api/review/session 401 and /auth/login 302 are verified. Fresh invited Author login is pending because the task Google chooser shows Signed out. The different-human Reviewer email is designated, but its verified reference is not supplied; third excluded tester, actual submission/human approval/rejection and physical iPhone Safari remain gates. All 33 statuses remain 6 locally Working / 20 UI Only / 7 Blocked. Production, Aishu, resource envelope and original-file recovery remain unchanged. See REAL-MEMBER-ENROLLMENT.md and evidence/2026-10-17-real-member-enrollment/.

## Configured staging project and client

Project **UmmahConnect Staging**, ID **`ummahconnect-staging-261017`**, number `677673398182`, no organization. The owner approved Google's explicit User Data Policy agreement at 2026-10-17 05:46:26 UTC. Consent audience is **External**, publishing status **Testing**; it was not published to production.

The single **UmmahConnect Staging Web** client is a Web application. Its only redirect is **`https://ummah-app-staging.up.railway.app/auth/callback`**. JavaScript origins and optional AI-agent designation remain unset. Basic identity scopes only: `openid`, `userinfo.email`, `userinfo.profile`, equivalent to the existing server's `openid email profile`. No sensitive/restricted Google API scope, billing account or additional project was added.

Owner support/notification contact was configured separately from participant roles. It did not create a role. Later explicit owner author/reviewer designations are preserved in a protected operator record rather than a browser-trusted email map. Both designated accounts are confirmed in Google's Testing list; the excluded tester is still undesignated.

[Project console](https://console.cloud.google.com/home/dashboard?project=ummahconnect-staging-261017). Existing projects/clients, particularly Aishu, are excluded.

## Protected destination and credential handling

Only project `48d7a4cf-07dc-489b-8a3d-d6d10142b14e`, environment `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`, **ummah-app** service `f3756510-4e87-445b-9cfb-9dad042d6758` received `GOOGLE_OIDC_CLIENT_ID` and `GOOGLE_OIDC_CLIENT_SECRET`. Both were privately compared and persisted with apply-only before app deployment. No value is in this handoff or Git. The 26 protected service settings were privately validated before first app activation, including the valid empty account map and exact private DB reference.

**Historical security handling:** two unused temporary setup secrets appeared in diagnostic output. Both were disabled and deleted before application use or deployment. The final fresh replacement was not returned in output and is the sole enabled client secret. No production/pre-existing credential was altered. Owned diagnostic files were sanitized; historical private task results cannot be claimed erased. Temporary browser memory was cleared and clipboard overwritten with a non-secret marker. This record does not claim immediate global revocation timing.

Never capture an unredacted raw/diff settings screen, clipboard attribute, cookie or bearer. Configuration checks return only booleans. Google provider screenshots in earlier evidence show masked values.

## Testing mode is not community authorization

Google documents a **basic-identity exception**: requests limited to name/email/profile or Sign in with Google need not be on the Testing list. Neither Testing status nor list membership is an access-control boundary. [1]

The existing authority verifies Google authorization code, state, nonce, PKCE and ID-token signature/issuer/audience/expiry/verified email; it derives a stable issuer/`sub` reference. It requires an enabled current `review_roles` row before issuing an app session, with role/session/revocation checks retained. An uninvited verified callback returns **403 / Invitation required**, no session, and only a non-secret subject reference. Email does not substitute for that reference. Google specifies `sub`, not email, as the stable key. [2]

HumHub remains the sole social authority. Enabled native user, current private membership, scoped grant and protected individual bearer mapping are separately required. The app-only Host correction uses bounded `node:http.request` exclusively to `http://127.0.0.1:3001` with the configured public Host; it does not weaken canonical validation, change OIDC authority or alter normal HumHub fetch.

## Remaining execution gates

1. Completed: the Author reference from genuine Google verification is linked to native user 1 with one private member/grant and active author-only identity role. Qualified operator source and hosted read/queue-denial proof are in REAL-MEMBER-ENROLLMENT.md.
2. Perform a fresh invited Author Google login. The current task chooser shows Signed out. No password/client secret is requested in messages. Use the main app `/login`, never the deliberately denied native password page.
3. The different person using the designated Reviewer email must send their own `google:…` reference from an actual verified callback. Its Testing-list/email entry alone does not grant review access. Reviewer remains review-only, not administrator, and must not be the Author identity.
4. Obtain an actual third login-permitted, community-excluded tester; grant no native membership or review permission. No guest/public space.
5. Verify real main-interface submission/own-pending reload, another human's approval and rejection, self-review denial, approved-only visibility and excluded-user denial. Automated fixture decisions are not human scholarship.
6. Run physical iPhone Safari separately. All 33 statuses/design remain unchanged; later Qdrant/BGE, Docling, PeerTube and charity/mosque are not complete.

The native backend remains at `44ee3bb5f39b275de84832e15fa02ae82c7b14f7`, private space 1, initialization off. Original 13-file recovery remains separate. Earlier zero-account checks are historical: one real Author now exists. Credentials and references remain private. Current author evidence: `evidence/2026-10-17-real-member-enrollment/`.

## References

[1]: https://support.google.com/cloud/answer/15549945?hl=en "Google Cloud: Manage App Audience, Testing basic-identity exception"
[2]: https://developers.google.com/identity/openid-connect/openid-connect "Google OpenID Connect: stable subject identifiers and ID-token validation"

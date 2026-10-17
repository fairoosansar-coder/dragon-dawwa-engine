# Separate Google staging OAuth setup

**Current state (17 October 2026, 11:36 UTC):** the designated Author and confirmed different-human, review-only Reviewer are listed in Google Testing. App-only canonical Host correction `afb3e234b4b1e13f7516d879c15957e0b18dcc7f` passed pinned Node-24 source/container CI **39028559641** and is deployed only to ummah-app (**a23d2272-162f-4e22-8206-b6dd2ee6f386**). Actual HTTPS health is 200, anonymous identity session is 401, and /auth/login returns 302 to Google with a secure host-only flow cookie. Exact deployed source hashes and the regular 0600 empty protected map are verified. The real Google chooser currently shows the designated Author **Signed out**: no genuine callback/subject has been obtained and no app role/native account/membership/grant was created. Native remains at qualified 44ee3bb / deployment 934b51d6-7c64-4d51-94a4-cbc4504ff0f7 with earlier private-state/17 anonymous-boundary proof. Third community-excluded tester, verified subject linking, independent human review and physical iPhone Safari remain gates. All 33 statuses stay 6 locally Working / 20 UI Only / 7 Blocked. Production/Aishu/original-file recovery are unchanged. This is a working login-start URL, not a completed login-to-reviewed-post flow. See GOOGLE-STAGING.md and evidence/2026-10-17-first-author-login/.

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

1. Completed: exact app-only correction `afb3e234b4b1e13f7516d879c15957e0b18dcc7f`, CI 39028559641, deployed only to ummah-app a23d2272-162f-4e22-8206-b6dd2ee6f386. Native/main/evidence branches were not deployed.
2. Anonymous preflight passed: health 200, session 401, login 302 with secure host-only flow cookie. The Google chooser shows Author Signed out; owner must sign in in the task browser and complete a genuine callback. Each designated participant needs a verified issuer/subject reference. No grant is inferred from Testing-list membership or support email.
3. Keep each identity role absent/disabled until its native identity/member/grant and protected individual bearer map are safely prepared. Author: view approved, submit, own pending; `can_submit=1`, `can_review=0`. Different-human Reviewer: queue/approve/reject; `can_submit=0`, `can_review=1`, no native or app administrator privilege.
4. Obtain an actual third login-permitted but community-excluded tester. That identity may receive an app login role but **no native community membership/grant**. No public or guest community access.
5. Exercise real author submission/own-pending reload and a different human's approval/rejection. Verify self-review denial, rejected draft preservation, permitted approved visibility, excluded direct-path/queue denial and revocation. Automated fixtures cannot provide human acceptance or scholarly validation.
6. Run physical iPhone Safari and record hardware/iOS/browser evidence separately from Chromium emulation.

The native backend remains at **`44ee3bb5f39b275de84832e15fa02ae82c7b14f7`**, private space/container **1/1**, initialization off. Prior protected verification had zero users/passwords/posts/memberships/reviews/grants/events. Native browser sign-in deliberately returns 403; it is not the app Google login endpoint. No account/content was added during this first-app activation.

All 33 screen statuses remain **6 locally Working / 20 UI Only / 7 Blocked**. Preserve vivid emerald/ivory/gold/turquoise, source citations and genuine human scholarly review. Original 13-file recovery remains separate. Qdrant/BGE → Docling → PeerTube → charity/mosque remain later work, not completed services.

Current evidence is in `evidence/2026-10-17-first-author-login/`; original Google setup/credential configuration evidence remains in `evidence/2026-10-17-google-staging/` as dated history.

## References

[1]: https://support.google.com/cloud/answer/15549945?hl=en "Google Cloud: Manage App Audience, Testing basic-identity exception"
[2]: https://developers.google.com/identity/openid-connect/openid-connect "Google OpenID Connect: stable subject identifiers and ID-token validation"

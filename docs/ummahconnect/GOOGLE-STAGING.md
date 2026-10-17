# Separate Google staging OAuth setup

**Current state (17 October 2026, login-state UI deployed):** staging app runs `ac8fee3f3e12c535d9eb6e61f31229282018257a` in deployment `51ae04c3-2f99-4d26-ba47-3c66295d6371`, qualified by CI 39049525723. `/login` opens screen 2 and separately reports Google availability, authenticated membership and acceptance status; anonymous submission/review controls are hidden. The gateway enforces review-only Reviewer capability and rejects its submit/own-draft requests before the native adapter. Google vendor/auth authority and native source `44ee3bb5f39b275de84832e15fa02ae82c7b14f7` are unchanged. Protected two-member map remains schema 1/mode 0600/UID 1000; both roles active and ten actual native GET boundaries pass. Approved/pending lists remain empty. These checks created no session, post or decision. Fresh invited main-interface Author/independent Reviewer login and human approve/reject/visibility remain unaccepted; excluded tester and physical iPhone Safari remain pending. All 33 statuses stay **6 locally Working / 20 UI Only / 7 Blocked**; production, Aishu, resources and original-file recovery unchanged. See LOGIN-STATE-UI.md and evidence/2026-10-17-login-state-ui/.

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
3. Completed: the designated different-human Reviewer supplied its genuine Google reference, now linked to native user 3 and active review-only identity role. Perform a fresh Reviewer Google login; Testing-list/email entry alone was never used as the identity or authorization key.
4. Obtain an actual third login-permitted, community-excluded tester; grant no native membership or review permission. No guest/public space.
5. Verify real main-interface submission/own-pending reload, another human's approval and rejection, self-review denial, approved-only visibility and excluded-user denial. Automated fixture decisions are not human scholarship.
6. Run physical iPhone Safari separately. All 33 statuses/design remain unchanged; later Qdrant/BGE, Docling, PeerTube and charity/mosque are not complete.

The native backend remains at `44ee3bb5f39b275de84832e15fa02ae82c7b14f7`, private space 1, initialization off. Original 13-file recovery remains separate. Earlier zero-/one-account checks are historical: the real Author and real Reviewer now exist. Credentials and references remain private. Current author evidence: `evidence/2026-10-17-real-member-enrollment/`.

## References

[1]: https://support.google.com/cloud/answer/15549945?hl=en "Google Cloud: Manage App Audience, Testing basic-identity exception"
[2]: https://developers.google.com/identity/openid-connect/openid-connect "Google OpenID Connect: stable subject identifiers and ID-token validation"

## Login-state UI deployment — verified 17 October 2026, 16:42 UTC

Exact app source `ac8fee3f3e12c535d9eb6e61f31229282018257a`, deployment `51ae04c3-2f99-4d26-ba47-3c66295d6371`. [Pinned CI 39049525723](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/39049525723) passes Node-24 app/identity tests, lint/build, both images and isolated native **36 HTTP + 16 model** tests; private bootstrap/restart/denial regressions remain synthetic. Local **76 app + 35 identity/privacy** tests pass with lint/build. Source hashes and deployed Node **v24.21.0** verified in protected console. No auth vendor/native executable or role mutation is part of this UI change.

Actual anonymous HTTPS: health **200**, session **401**, configured review **200**, Google start **302** to HTTPS Google. Actual hosted `/login` Chromium mobile/desktop screenshots show **Sign Up / Login**, **Acceptance pending**, and **sign-in is available; no session is present**. Explicit hash routes remain honored; anonymous submit control count is zero. Local **33 routes**, zero overflow/page errors; hosted entry checks have zero page errors/overflow. These are **desktop Chromium 154.0.8037.57**, mobile viewport emulation where stated, **not authenticated human acceptance or physical Safari**. No APIs mocked. The first screenshot attempt timed out on network-idle; the corrected audit checks the rendered panel instead. An operational verifier initially used nonexistent `/ummahreview/spaces`; its guarded failure is retained and corrected from the committed `/space/1` endpoint, not hidden or treated as a runtime source defect.

Fresh protected map/SQL/native GET checks preserve active distinct Author/Reviewer: private space/feed both 200; Author own submissions 200/queue 403; Reviewer queue 200/own submissions 403. Approved/feed/pending collections have zero records. **No post, session or decision was created by these operator checks.** Real Author submission and different-human approve/reject, excluded-account denial, sign-out/revocation acceptance and physical iPhone Safari remain release gates. The UI never turns public configuration into trusted identity. Qdrant/BGE → Docling → PeerTube → charity/mosque stay after the documented social milestone. All 33 status rows/design colors and original recovery/production/Aishu boundaries remain unchanged.

# Staging login-state and permission-display correction

## Scope

The `/login` entry now opens screen 2, while explicit hash routes remain honored. Public review configuration is not treated as identity: the panel distinguishes loading, unconfigured, configured-anonymous, recognized-but-unmapped/forbidden, verified member projection, and temporary failure. Malformed successful member responses fail closed. Only the same-origin `/auth/login` link is allowed.

The Reviewer remains review-only. The gateway now returns `canSubmit: false` for that role and rejects its POST submission and GET own-submission requests before calling HumHub. This aligns with existing native `can_review`-only grants; no native permission or user is changed. Submission/review UI controls await successful member capability checks. The sign-out action uses same-origin POST and requires a subsequent server-denied session before returning to `/login`; no session cookie, bearer or browser identity is read by UI code.

Catalog classifications match the matrix per screen: Hadith is blocked, browser-local Settings remains locally working, and Moderation remains UI-only. The login badge says **Acceptance pending**, separately from dynamic Google sign-in availability. Counts remain **6 locally working / 20 UI-only / 7 blocked**. The emerald/ivory/gold/turquoise styling and 33-screen templates are unchanged.

## Evidence before deployment

The read-only hosted observation at `2026-10-17T16:21:15.935Z` found both scoped roles active and approved/pending/rejected lists empty. It created no session, post or decision. The task browser was anonymous (`/api/review/session` and `/api/social/spaces` 401), while public configuration returned 200 with review enabled. This is not a disconnected authentication service.

Local source checks: **76/76 app tests**, **35/35 identity/privacy tests**, TypeScript lint and Vite build pass on Node **22.13.0**. Controlled UI/endpoint/transport tests are not hosted Google or human acceptance. Vite retains its existing chunk-size warning. Exact pinned Node-24/native-container qualification is required before changing the app service branch.

## Boundaries

Only the isolated staging app may be replaced after the exact CI run passes. HumHub stays on `44ee3bb5f39b275de84832e15fa02ae82c7b14f7`; production, Aishu, four-service resource envelope, volumes, identity authority/vendor code, native grants and original-file recovery are unchanged.

Real acceptance still requires fresh post-invitation Author and independent Reviewer sessions, two real labelled test posts, one human approval and one human rejection, authorized visibility, self-review denial, a designated login-permitted community-excluded tester, and physical iPhone Safari. No human decision is fabricated. No pending screen is promoted solely by source or browser-emulation evidence.

## Login-state UI deployment — verified 17 October 2026, 16:42 UTC

Exact app source `ac8fee3f3e12c535d9eb6e61f31229282018257a`, deployment `51ae04c3-2f99-4d26-ba47-3c66295d6371`. [Pinned CI 39049525723](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/39049525723) passes Node-24 app/identity tests, lint/build, both images and isolated native **36 HTTP + 16 model** tests; private bootstrap/restart/denial regressions remain synthetic. Local **76 app + 35 identity/privacy** tests pass with lint/build. Source hashes and deployed Node **v24.21.0** verified in protected console. No auth vendor/native executable or role mutation is part of this UI change.

Actual anonymous HTTPS: health **200**, session **401**, configured review **200**, Google start **302** to HTTPS Google. Actual hosted `/login` Chromium mobile/desktop screenshots show **Sign Up / Login**, **Acceptance pending**, and **sign-in is available; no session is present**. Explicit hash routes remain honored; anonymous submit control count is zero. Local **33 routes**, zero overflow/page errors; hosted entry checks have zero page errors/overflow. These are **desktop Chromium 154.0.8037.57**, mobile viewport emulation where stated, **not authenticated human acceptance or physical Safari**. No APIs mocked. The first screenshot attempt timed out on network-idle; the corrected audit checks the rendered panel instead. An operational verifier initially used nonexistent `/ummahreview/spaces`; its guarded failure is retained and corrected from the committed `/space/1` endpoint, not hidden or treated as a runtime source defect.

Fresh protected map/SQL/native GET checks preserve active distinct Author/Reviewer: private space/feed both 200; Author own submissions 200/queue 403; Reviewer queue 200/own submissions 403. Approved/feed/pending collections have zero records. **No post, session or decision was created by these operator checks.** Real Author submission and different-human approve/reject, excluded-account denial, sign-out/revocation acceptance and physical iPhone Safari remain release gates. The UI never turns public configuration into trusted identity. Qdrant/BGE → Docling → PeerTube → charity/mosque stay after the documented social milestone. All 33 status rows/design colors and original recovery/production/Aishu boundaries remain unchanged.

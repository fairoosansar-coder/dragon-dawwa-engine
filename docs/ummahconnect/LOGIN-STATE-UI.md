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

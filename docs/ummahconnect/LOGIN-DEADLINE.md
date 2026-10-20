# Sign-in readiness deadline correction — 18 October 2026

The user reported the main sign-in panel stuck at **Authentication readiness: checking**. The original client waited indefinitely for any config, session or member fetch/JSON body. Current credential-free hosted preflight did not reproduce the original stall: config 200, anonymous session 401 and Google start 302 responded. The triggering network/server/browser condition is **not established**. This repair prevents that class of infinite UI wait; it is not a claim that every provider outage is fixed.

A single **12,000 ms maximum** deadline now spans all three requests and response-body parsing. Timeout or cancellation aborts fetch and returns a fail-closed stage-specific temporary error. **Retry check** starts a fresh check; replacing/navigating away aborts the previous one, with request-ID/controller guards preventing stale state updates. An unverified or failed check cannot show a member or grant controls. The exact safe `/auth/login` link is still shown only after valid config and anonymous session denial. No automatic login, POST, review, credential mapping or authority change occurs.

Only `src/ummah/loginState.ts`, the login-request/loader portion of `SocialPanels.tsx`, controlled tests and non-deploying CI branch coverage changed. Google/auth vendor, all server/native moderation logic, both real account mappings, design and 33-screen classifications are unchanged. Production and Aishu remain excluded.

## Source and browser qualification before deployment

**80 app tests + 35 identity/privacy tests**, lint and build pass (local Node 22.13.0). Tests cover abort-ignoring never-resolving fetches and hanging JSON at config/session/member, late valid member results, cancel/retry, malformed responses and exact safe anonymous-link behavior. This is controlled source evidence, not actual login acceptance.

Actual built-loopback Chromium 154.0.8037.57 with mobile viewport emulation: induced config-request stall exits in **11,986 ms**, shows temporary error and **Retry check**, no unverified login link. Removing the induced stall and retrying reads the real local unconfigured response. No fabricated API success, page errors or overflow. All **33 built routes** have zero overflow/page errors. Screenshot interception is deliberately labelled an induced client-side fault, not an observed hosted outage. No physical iPhone Safari test occurred.

Exact new CI and hosted deployment verification are pending at source submission. Do not deploy unless that exact source passes. After qualification, change only ummah-app staging source; preserve the qualified native deployment and two protected map entries. Return actual deployed revision and hosted checks separately.

Real Author submission, independent human approve/reject, permitted visibility, third excluded account and physical iPhone Safari remain social milestone gates. No automated approval can satisfy human acceptance. Original 13-file recovery remains independent.

## Exact qualification and hosted result — PASS

Source `dae5c666b6b54575ddf2879f2d253f5ec52d121a` passed [CI 39125043697](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/39125043697), including pinned Node tests/lint/build and disposable native **36 HTTP + 16 model** checks, restart, private bootstrap and guest/refusal regressions. Only ummah-app staging changed source. Actual runtime Node **v24.21.0**, deployment `5a1820b2-36f1-405f-9ef8-3e9a1d98bb34`; exact client/vendor hashes verified and private two-member map is mode 0600/UID 1000. No live fixture, session, content or review was created.

Actual hosted browser code under an induced request stall shows temporary error/Retry check at **12,001 ms**. Restoring the real network and retrying shows **sign-in is available; no session is present** and the safe Google link. Zero page errors/overflow. Anonymous real HTTPS checks: health/config 200, session 401, login start 302. No successful API response was fabricated. These are **Chromium emulation**, not physical iPhone Safari or actual human end-to-end moderation. The original screenshot's triggering condition remains unidentified; the unbounded wait defect is fixed.

Next user action: reload https://ummah-app-staging.up.railway.app/login and select Sign in with Google with the designated account. If the temporary state appears, use Retry check. Real participants must submit and independently approve/reject their own clearly labelled staging tests.

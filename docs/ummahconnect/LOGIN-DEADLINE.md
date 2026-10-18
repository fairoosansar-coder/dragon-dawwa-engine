# Sign-in readiness deadline correction — 18 October 2026

The user reported the main sign-in panel stuck at **Authentication readiness: checking**. The original client waited indefinitely for any config, session or member fetch/JSON body. Current credential-free hosted preflight did not reproduce the original stall: config 200, anonymous session 401 and Google start 302 responded. The triggering network/server/browser condition is **not established**. This repair prevents that class of infinite UI wait; it is not a claim that every provider outage is fixed.

A single **12,000 ms maximum** deadline now spans all three requests and response-body parsing. Timeout or cancellation aborts fetch and returns a fail-closed stage-specific temporary error. **Retry check** starts a fresh check; replacing/navigating away aborts the previous one, with request-ID/controller guards preventing stale state updates. An unverified or failed check cannot show a member or grant controls. The exact safe `/auth/login` link is still shown only after valid config and anonymous session denial. No automatic login, POST, review, credential mapping or authority change occurs.

Only `src/ummah/loginState.ts`, the login-request/loader portion of `SocialPanels.tsx`, controlled tests and non-deploying CI branch coverage changed. Google/auth vendor, all server/native moderation logic, both real account mappings, design and 33-screen classifications are unchanged. Production and Aishu remain excluded.

## Source and browser qualification before deployment

**80 app tests + 35 identity/privacy tests**, lint and build pass (local Node 22.13.0). Tests cover abort-ignoring never-resolving fetches and hanging JSON at config/session/member, late valid member results, cancel/retry, malformed responses and exact safe anonymous-link behavior. This is controlled source evidence, not actual login acceptance.

Actual built-loopback Chromium 154.0.8037.57 with mobile viewport emulation: induced config-request stall exits in **11,986 ms**, shows temporary error and **Retry check**, no unverified login link. Removing the induced stall and retrying reads the real local unconfigured response. No fabricated API success, page errors or overflow. All **33 built routes** have zero overflow/page errors. Screenshot interception is deliberately labelled an induced client-side fault, not an observed hosted outage. No physical iPhone Safari test occurred.

Exact new CI and hosted deployment verification are pending at source submission. Do not deploy unless that exact source passes. After qualification, change only ummah-app staging source; preserve the qualified native deployment and two protected map entries. Return actual deployed revision and hosted checks separately.

Real Author submission, independent human approve/reject, permitted visibility, third excluded account and physical iPhone Safari remain social milestone gates. No automated approval can satisfy human acceptance. Original 13-file recovery remains independent.

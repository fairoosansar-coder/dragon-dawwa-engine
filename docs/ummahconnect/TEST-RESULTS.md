# Integration test results — 2026-10-13

Staging preview: https://ummahconnect-integration-staging.feroz1890.chatgpt.site

This is an isolated owner-private staging deployment. The existing production site, Railway runtime and database were not changed.

| Check | Result | Scope / limit |
|---|---|---|
| TypeScript | Pass | Existing app plus integrated routes, service mounting and server adapters |
| Service and integration tests | 28 passed | Existing HumHub qualification, Quran audio, Tafsir schema/cache, prayer validation, Gemini failure behavior; new route contracts and fail-closed social gateway |
| Vite production build | Pass | Same main React entry point; existing large-chunk warning remains |
| Staging runtime tests | 3 passed | Integrated app and Quran corpus served; missing AI key = 503; missing social session = 401; writes rejected; unknown API/asset routes fail correctly |
| Mobile Chromium 375 × 812 | Pass | 39 routes (33 screens + 5 mosque tabs + podcasts), 87 imported controls, five mosque tab links; no final page overflow or uncaught JS errors |
| Mobile Chromium 414 × 896 | Pass | Same 39 routes and 87 controls; no page overflow or uncaught JS errors |
| Search and mobile drawer | Pass | “mosque” returns six main-screen matches; drawer expands; project tabs change route |
| 390 × 844 initial audit | Issue found, corrected | Quran Surah card minimum width overflow. Fixed grid child minimum widths; retested at 375 and 414 |
| Real iPhone Safari | NOT RUN / release gate | No real iPhone/Safari session available; Chromium mobile emulation is not Safari |
| Live authenticated end-to-end operations | BLOCKED | Staging account/role mapping, HumHub instance and provider keys not connected |
| Genuine payments/donations/construction records | NOT CLAIMED | No payment attempt, donation receipt, or real construction status was created |

## Browser method

The actual Vite-built JavaScript and CSS were supplied to connected Cloudflare Browser Rendering with mobile/touch viewports. The audit routes through the real React app, clicks every visible imported button/status control, checks nonempty route content, page width, errors, mosque tabs, search and drawer behavior. No fabricated API success responses or payment records were supplied.

The browser was Chrome 119. Its user-agent includes the compatibility word Safari; this is explicitly NOT a Safari test. These tests run an in-memory copy of the built frontend, not an authenticated visit through the private staging access gate. Browser-local persistence across reloads, provider playback, actual geolocation, microphone capture, file upload, real accounts and permissioned transactions require a separate device/provider acceptance pass. Existing adapter/provider unit tests use controlled responses and do not prove live provider availability.

A passing control check means a route, selected tab, amount input focus, or explicit status dialog responds. It does not imply a backend-pending business action completed. Completion status is recorded separately in COMPLETION-MATRIX.md.

## Evidence

- unit-tests.txt: complete 28-test output.
- ummah-test-375-final.json and ummah-test-414.json: route/control results, viewport, browser identity and errors.
- screenshots/: actual browser screenshots, including Home at 375 and Mosque Project at 414.
- scripts/browser-audit.js and scripts/prepare-browser-audit.mjs: repeatable browser audit payload.
- scripts/test-staging.mjs: three runtime checks against the bundled Worker.

## Remaining release gates

1. Reconcile the exact live Railway commit and auth/database API contract.
2. Connect isolated staging authentication and HumHub per-member accounts.
3. Connect approved sandbox service credentials and exercise live research, voice, Tafsir and prayer behavior.
4. Implement the documented missing project, charity and other business capabilities; verify signed payment callbacks in a sandbox.
5. Run real iPhone Safari checks, including touch navigation, session redirects, audio unlock, microphone/camera/location permissions, Arabic rendering, native sharing and safe-area keyboard behavior.
6. Obtain production approval only after these gates pass. No production cutover is included in this change.

# Health probe and API 404 shell guard — 20 October 2026

## Defect observed on hosted staging

Anonymous HTTPS checks against `https://ummah-app-staging.up.railway.app` showed:

- `/api/health` → JSON `200` (working)
- `/api/social/config` → JSON `200` (working)
- `/healthz` → SPA HTML `200` (broken Railway-style probe; HTML shell was returned)
- Unknown `/api/*` and `/auth/*` paths → SPA HTML `200` (clients could misread HTML as success)

No auth, role, HumHub, account-map, or social write contract was changed by this repair.

## Source correction

1. `GET /healthz` returns minimal JSON `{ status: "ok", service: "ummahconnect-app" }` with `Cache-Control: no-store`. It does not expose Gemini entitlement.
2. The production SPA catch-all returns JSON `404 { error: "not_found" }` for unknown `/api/*` and `/auth/*` paths instead of `index.html`.
3. `npm start` now uses `node --import tsx server.ts`, matching the staging image entry that already imports `tsx`.
4. Controlled tests live in `tests/healthz.test.ts`.

## Operator follow-up (not performed by this source change)

After this branch is deployed only to **ummah-app staging** and CI passes:

1. Confirm `GET /healthz` → `200` JSON on the staging origin.
2. Confirm an unknown `/api/…` path → `404` JSON.
3. Optionally set Railway healthcheck path to `/healthz` on ummah-app only; do not alter HumHub, MySQL, volumes, production, or Aishu.
4. Re-run anonymous boundary checks from [LOGIN-DEADLINE.md](LOGIN-DEADLINE.md); do not invent human acceptance from this probe fix.

Human gates in [HUMAN-DECISIONS.md](HUMAN-DECISIONS.md) remain open and unchanged.

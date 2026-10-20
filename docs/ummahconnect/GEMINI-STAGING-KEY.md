# Staging `GEMINI_API_KEY`

Optional for Author/Reviewer social acceptance. Required for Hadith / AI media routes.

## Where to set

Railway project `48d7a4cf-…` → environment **staging** (`1f7d98bf-…`) → service **ummah-app** (`f3756510-…`) → Variables:

- `GEMINI_API_KEY` (required for `hasKey: true`)
- `GEMINI_MODEL` (optional; e.g. `gemini-2.5-flash`)

Do not put these on HumHub or production Dragon Dawwa unless intentionally enabling AI there.

## Why `/api/health` can stay `hasKey: false`

`deployment/staging/start-app.mjs` only forwards an allowlisted env into the app child. `GEMINI_API_KEY` / `GEMINI_MODEL` must be on that list (fixed on branch `cursor/ummahconnect-gemini-env-allowlist-f488`). After that commit is deployed, a non-empty Railway value yields:

`GET https://ummah-app-staging.up.railway.app/api/health` → `"hasKey": true`

Redeploy ummah-app after adding or changing the variable.

# UmmahConnect — source attached in staging drafts, live activation pending

**17 October 2026 UTC. Production, Aishu and the approved 33-screen design are unchanged.**

## Current outcome

GitHub access is now verified. The Railway app's selected-repository grant includes the approved `dragon-dawwa-engine`, while the two existing repository grants remain intact. Both application and HumHub service drafts select the correct engine repository and `development/ummahconnect-railway-activation-20261017`, never `main`. Their qualified Dockerfiles and protected configuration are prepared. **This is not a working live milestone:** no source deployment, persistent database, native bootstrap or real account enrollment is active.

The isolated Railway destination remains project `48d7a4cf-07dc-489b-8a3d-d6d10142b14e`, environment `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`, in Dragon Dawwa Private. [Management console](https://railway.com/project/48d7a4cf-07dc-489b-8a3d-d6d10142b14e?environmentId=1f7d98bf-1d49-4d9f-a5cc-13b57abcc095) is not an app URL.

| Service | Prepared source/configuration | State |
|---|---|---|
| `ummah-app` | Engine development branch; `deployment/staging/app.Dockerfile`; isolated identity settings, empty account map, three new private keys, private identity DB reference, real reserved HumHub origin | **26 changes unapplied** |
| `ummah-humhub` | Same engine development branch; `deployment/staging/humhub.Dockerfile`; private database role/password reference, separate cookie key; initialization deliberately `no` | **10 changes unapplied** |
| `ummah-humhub-mysql` | Native-qualified immutable MySQL 8.4 image; separate schema/application user and independent root/application secrets | **5 changes unapplied** |
| `ummah-identity-mysql` | Same immutable MySQL image; separate identity schema/application user and a different root/application secret pair | **5 changes unapplied** |

A fresh provider reload confirms **46 staged, unapplied changes**. All four retain **one replica, 1 vCPU and 1 GB RAM**. No persistent volume was created or purchasing/payment step taken. No production credentials, data or account grants were copied.

## Reserved HTTPS routes — not working applications

| Route | Current result |
|---|---|
| https://ummah-app-staging.up.railway.app — app port 3000 | `/api/health`: HTTP **404**, TLS verification **0**, checked 01:12:08 UTC |
| https://ummah-humhub-staging.up.railway.app — HumHub port 80 | HTTP **404**, TLS verification **0**, checked 01:16:11 UTC |

The separate Google callback can now be specified precisely: **`https://ummah-app-staging.up.railway.app/auth/callback`**. The app's staged `HUMHUB_ORIGIN` points to the reserved HumHub HTTPS address; neither reservation proves login, installed HumHub or permitted visibility.

## Owner decision that now blocks persistent activation

The approved storage target was approximately **5 GB aggregate**. The existing Railway **Pro** plan creates **50 GB per volume**. Custom smaller initial size and downsizing are not supported; the three required volumes would allocate **150 GB**, not 5 GB. Creation was left unsubmitted rather than silently expanding the plan.

Railway charges **used storage**, not all allocated capacity, but filesystem metadata consumes approximately 2–3% of allocated storage. Three default volumes therefore imply approximately **3–4.5 GB metadata before application/database data**, and do not guarantee a 5 GB usage cap. A project-only hard spending stop is not available; changing shared workspace hard stops would affect production and was not done.

The decision is to accept the three default allocations with actual-used billing and no hard 5 GB cap, or retain the original capacity requirement and choose a different isolated storage/hosting arrangement. Do not silently combine the independently approved databases. [Official volume rules](https://docs.railway.com/volumes/reference) and [Railway employee confirmation of no custom initial size](https://station.railway.com/questions/creating-small-volume-562ce3b2) support this constraint. Details: `RAILWAY-VOLUME-DECISION-20261017.md`.

Separately, the staging Google Cloud project/client and actual author, different human reviewer, excluded account and private community rights remain undesignated. Client secrets, passwords and browser cookies must be supplied through protected configuration or owner browser entry, never chat. No real identity or scholarly authority was invented.

## Tests — distinct execution boundaries

| Category | Result | Boundary |
|---|---|---|
| Fresh app source tests | **44/44 pass** | Controlled gateway/provider contracts, not Google login |
| Fresh identity source tests | **19/19 pass** | Isolated source/session/provenance fixtures |
| Fresh TypeScript/Vite build | **Pass** | Existing bundle-size warning; main design unchanged |
| Actual native HumHub/REST/MySQL qualification | **32 HTTP + 15 model/file/cache pass** | Prior [real container CI 38826633944](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/38826633944), synthetic native actors; not rerun on Railway |
| Real HTTPS login/post/different human approval | **Not run / blocked** | No hosted bootstrap/client/accounts |
| Physical iPhone Safari | **Not run** | Chromium emulation is not physical Safari |

Prior native tests prove draft-first insertion, no pending/rejected publication, independent reviewer-role decisions, self-review/excluded-user denial, revocation, concurrent retries/decisions, exact content-version binding, rollback with durable audit, native route/file/cache bypass denial and persistence across container restarts. Automated native reviewer actors are not human scholarly review. Attachments remain unsupported and denied.

Qualified runtime: `558cf5c53775d2412ef3d9f8e1fddcdf9e298d22`; evidence ancestry includes `b0d3de57e19e7a5831675540959f209fd09008a3` and preserved `9fa7f7a8dbc2687250e75f4514ebc1641994e519`. The current diff against that qualified runtime changes only staging metadata, documentation and evidence—not executable application/native/deployment code. Original 13-file recovery stays separate; it has not been discarded, overwritten or claimed as recovered.

## Next execution after the missing choices

Create the accepted volumes, activate both private MySQL services and apply the isolated identity schema. Bootstrap the new empty HumHub database once, apply the native hooks/migrations, create the actual private communities and establish scoped review grants and per-member subject/token mappings. Disable first-boot initialization afterwards. Apply the prepared application/HumHub source and protected variables only with the isolation/OAuth/account prerequisites satisfied.

Then test through the main HTTPS interface: existing author login → permitted community → real post and citations → a different human's review → approved permitted visibility. Repeat rejection, self-review denial, excluded accounts, revocation and native robustness/operational persistence against the actual hosted runtime. Record genuine human actions separately from automated fixture cases. Run physical iPhone Safari with device/iOS/browser and session/keyboard/touch evidence; do not replace it with emulation.

All **33 screen statuses remain 6 locally Working / 20 UI Only / 7 Blocked**. No hosted screen was promoted. Source tests, safe service screenshot and negative readiness evidence are in `evidence/2026-10-17-source-preparation/`; existing main-interface screenshots remain earlier Chromium evidence, not new hosted workflow shots. Subsequent Qdrant/BGE → Docling → PeerTube → charity/mosque work remains pending in the documented order.

## Contained setup diagnostic

Three newly generated, unused app keys inadvertently appeared in a setup diagnostic. They were replaced before any deployment or enrollment, and the owned transient diagnostic file was removed. Replacement values and all database/cookie secrets are not exported in the evidence. Production and existing account secrets were not touched.

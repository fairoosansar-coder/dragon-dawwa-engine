# Railway resource preparation — 17 October 2026 UTC

**Partial activation only. The hosted UmmahConnect milestone is not complete. Production and Aishu are unchanged.**

## Preserved source

- Preparation starts from preserved remote HEAD `052c98d42750b10378bd8c4f1e25c74534789c76`.
- Activation-record branch: `development/ummahconnect-railway-activation-20261017`.
- Native-qualified runtime: `558cf5c53775d2412ef3d9f8e1fddcdf9e298d22`; evidence HEAD `b0d3de57e19e7a5831675540959f209fd09008a3`.
- Runtime, UI and container code are unchanged from that qualified source. The new changes are activation metadata, documentation and sanitized evidence.
- `9fa7f7a8dbc2687250e75f4514ebc1641994e519` remains an ancestor. Original Mac-M5 13-file recovery remains separate; nothing was reset, overwritten or represented as recovered.

## Actually saved in the connected Railway account

Workspace **Dragon Dawwa Private**, project **UmmahConnect - Isolated Staging** (`48d7a4cf-07dc-489b-8a3d-d6d10142b14e`), environment **staging** (`1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`).

| Service | Saved service ID | Limits | Actual state |
|---|---|---|---|
| `ummah-app` | `f3756510-4e87-445b-9cfb-9dad042d6758` | 1 replica; 1 vCPU / 1 GB | Empty, offline; app hostname reserved |
| `ummah-humhub` | `e6498121-1725-4d5a-a66f-e0f1091d6d35` | 1 replica; 1 vCPU / 1 GB | Empty, offline |
| `ummah-humhub-mysql` | `40669655-b0cd-4b44-83ab-d0f4bf0376d7` | 1 replica; 1 vCPU / 1 GB | Empty, offline; **not a running database** |
| `ummah-identity-mysql` | `f7abeb9a-2a67-4fb7-9c6b-8a12dc19db44` | 1 replica; 1 vCPU / 1 GB | Empty, offline; **not a running database** |

The newly prepared service limits were saved through Railway's staged-changes UI. The final service and app settings showed no pending changes; the project showed all four services offline. No source/image deployment, persistent volume, public database proxy or payment action was activated. The approved aggregate volume target remains approximately 5 GB; volumes have not yet been created.

### Reserved HTTPS host — not a working application

- Host: **https://ummah-app-staging.up.railway.app**.
- Target port: **3000**.
- Canonical origin for the separate staging OAuth client: `https://ummah-app-staging.up.railway.app`.
- Exact authorized redirect URI: **`https://ummah-app-staging.up.railway.app/auth/callback`**.
- HTTPS check at `2026-10-17T00:48:18Z`: certificate verification succeeded (`curl` TLS verification result `0`), but the endpoint returned **HTTP 404 / `Application not found`**.

A reserved hostname and successful TLS connection do not prove that the application, login or native HumHub is deployed.

## Source-access finding and immediate gate

Railway's picker now lists `fairoosansar-coder/dragon-dawwa-engine`. However, selecting it did **not** produce a verified source attachment; the browser redirected to GitHub **Confirm access** for installation `167750118`, signed in as `fairoosansar-coder`.

The listing must not be reported as a completed repository grant. No installation permission change was applied by this task. The owner previously authorized adding **only `dragon-dawwa-engine`**, retaining all existing Railway app grants. GitHub's current security re-authentication must be completed by the owner in the task's active browser. Do not substitute `dragon-dawwa-railway-deploy`, grant all repositories, or bypass the security step.

After that step, verify the actual attachment before deployment. Use the qualified development ancestry and the explicit app/HumHub Dockerfiles from `deployment/staging/`; never deploy `main` or the root generic build configuration as staging source.

## Validation — deliberately separate categories

| Category | Result | Scope |
|---|---|---|
| Fresh app source tests | **44/44 pass** | Controlled gateway/provider fixtures; not hosted account evidence |
| Fresh staging identity source tests | **19/19 pass** | Identity/session/role/provenance contracts; not Google login |
| Fresh TypeScript and Vite build | **Pass** | Correct lockfile; existing bundle-size warning remains |
| Prior actual native HumHub/REST/MySQL containers | **32 HTTP + 15 native model/file/cache pass** | [Final evidence HEAD CI](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/38826633944), synthetic actors; not rerun on Railway |
| Current reserved HTTPS endpoint | **TLS valid; HTTP 404** | Negative readiness check only |
| Railway-hosted Google login → submission → independent human approval → permitted visibility | **Not run / blocked** | No source/runtime/OAuth/account linkage activated |
| Railway-hosted rejection, self-review denial and excluded users | **Not run / blocked** | Prior native tests are not promoted to hosted acceptance |
| Physical iPhone Safari | **Not run** | Earlier Chromium mobile emulation is not physical Safari |

Fresh source test logs, non-secret readiness evidence, a Railway setup screenshot and the updated 33-screen matrix are retained with this record. The existing 33-screen emerald, ivory, gold and turquoise design is unchanged. No generated example is certified as a donation, transaction, scholarly approval or construction update.

## Remaining exact inputs/setup

1. Owner completes current GitHub **Confirm access** and the already-approved narrow Railway installation addition; then source attachment and development branch must be verified.
2. Designate the **separate staging Google Cloud project/Web client**, with the origin and redirect above. Configure its client secret only through protected settings. Do not alter or copy the production OAuth client.
3. Name the real existing author Google account, **different authorized human reviewer**, excluded account and staging community/grants. Verify canonical OIDC subjects and protected HumHub member mappings; do not invent scholarship or treat fixture-role operations as human review.
4. Activate pinned private MySQL images, separate scoped databases/roles, approximately 5 GB aggregate persistent storage, required schema/trigger grants, protected secrets, private HumHub and native queue/cron. These are prepared definitions, not active services.
5. Repeat the full main-interface flow and negative permission cases on actual hosted HumHub through HTTPS. Verify persistence, private paths and operational backup/restore.
6. Supply a physical iPhone Safari session, or complete and return the recorded hardware acceptance steps after the hosted flow works.

The resource envelope is already approved; no repeat budget approval is needed unless its material scope changes. If Railway requires a purchasing/payment step, the owner completes it. Workspace-wide spending/security settings and every production/Aishu workload remain untouched.

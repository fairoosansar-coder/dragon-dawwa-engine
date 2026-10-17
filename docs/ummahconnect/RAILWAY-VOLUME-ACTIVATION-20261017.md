# UmmahConnect — approved storage and private database activation

Updated: 17 October 2026 UTC. **Storage/database activation advanced; the live human moderation milestone is not complete.**

## Completed against the actual connected Railway account

Destination: [UmmahConnect - Isolated Staging management console](https://railway.com/project/48d7a4cf-07dc-489b-8a3d-d6d10142b14e?environmentId=1f7d98bf-1d49-4d9f-a5cc-13b57abcc095). This console is not a working application URL.

- Project: `48d7a4cf-07dc-489b-8a3d-d6d10142b14e`.
- Environment: `staging`, `1f7d98bf-1d49-4d9f-a5cc-13b57abcc095`.
- Owner approval: three default 50 GB volumes, actual-used billing, 17 October at 02:04:31 UTC.
- All three volumes were created, attached, applied and verified in provider settings.
- Railway's documented Alt-click Deploy committed 55 staged changes without deploying incomplete source services.
- Both private MySQL services were subsequently deployed individually from the pinned native-qualified MySQL image.
- Actual SQL authenticated as each service's non-root application user confirms **MySQL 8.4.11**, separate schemas and correct roles.
- The identity schema was initialized only after exact project/environment/schema/user and empty-database guards. Four tables and the exact instance marker are verified; real role count is **0**.
- No production credentials, database records, users or role grants were copied. No real accounts were invented or automatically enrolled.

| Volume | Provider ID | Service | Mount | Capacity |
|---|---|---|---|---|
| HumHub MySQL | `cd19acff-8eae-49c8-a6c4-f4c3f3b74dc0` | `40669655-b0cd-4b44-83ab-d0f4bf0376d7` | `/var/lib/mysql` | 50 GB |
| Identity MySQL | `fb91f820-835c-47db-b9fb-31a2ddb867a0` | `f7abeb9a-2a67-4fb7-9c6b-8a12dc19db44` | `/var/lib/mysql` | 50 GB |
| HumHub persistent storage | `8f87dd68-860c-4345-a5c6-e472c2184394` | `e6498121-1725-4d5a-a66f-e0f1091d6d35` | `/var/lib/ummah-humhub` | 50 GB |

Allocated capacity is **150 GB**, not a hard 5 GB cap. [Official volume rules](https://docs.railway.com/volumes/reference) bill actual used storage, including filesystem metadata; capacity cannot be downsized. The existing one-replica / 1 vCPU / 1 GB service caps remain the approved envelope. No workspace-wide production spending stop limit or payment transaction was changed/performed.

## Actual current service state

| Service | State | What is verified |
|---|---|---|
| `ummah-identity-mysql` | Online | Native SQL role/version/schema; isolated instance marker; four tables; zero roles |
| `ummah-humhub-mysql` | Online | Native SQL role/version/schema; schema-local grants; native table count 0 |
| `ummah-humhub` | Offline | Saved qualified source/configuration and attached persistent storage; no hosted native installation or community/grants yet |
| `ummah-app` | Offline | Saved qualified source/configuration; no configured real Google login or human-flow pass |

The identity SQL used the application role, not root. The HumHub role has global USAGE and ALL PRIVILEGES only inside `ummah_humhub_staging.*`. That is database isolation evidence, **not** proof of live social permissions.

## URLs — reserved, not a working flow

- App origin: **https://ummah-app-staging.up.railway.app**.
- Google callback: **https://ummah-app-staging.up.railway.app/auth/callback**.
- HumHub origin: **https://ummah-humhub-staging.up.railway.app**.

Checked at `2026-10-17T02:25:58Z`: app `/api/health` and HumHub `/api/v1/auth/current` both returned **HTTP 404**, with successful TLS verification. These URLs must not be delivered as a completed working login or moderation flow.

## Test results, separated by scope

| Category | Result | Interpretation |
|---|---|---|
| Fresh TypeScript / Vite build | PASS | Runtime/UI unchanged; existing large-chunk warning remains |
| Fresh app source suite | 44/44 PASS | Includes controlled/simulated gateway/provider cases; not Google login |
| Fresh identity source suite | 19/19 PASS | Controlled session/database fixtures; not Google login |
| Actual hosted SQL | 2/2 health probes PASS | Two separate MySQL 8.4.11 application roles/schemas, not simulated providers |
| Actual hosted identity bootstrap | PASS | Guarded four-table schema, exact marker and zero role count |
| Prior native HumHub/REST/MySQL CI | 32 HTTP + 15 model/file/cache PASS | [CI 38826633944](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/38826633944); synthetic actors; not newly rerun on Railway |
| Hosted HTTPS existing-account → human approval | NOT RUN / BLOCKED | No real login, post, independent human review, rejection, self-review or excluded-user result is claimed |
| Hosted app/HumHub workers/restart/private-path checks | NOT RUN | Prior CI checks are not hosted acceptance |
| Physical iPhone Safari | NOT RUN | Historical Chromium/mobile emulation is not hardware evidence |

## Exact remaining owner inputs and execution

1. Choose the **separate staging Google Cloud project/Web client**. Configure `GOOGLE_OIDC_CLIENT_ID` and `GOOGLE_OIDC_CLIENT_SECRET` in protected Railway settings only; use the callback above. Do not paste secrets into chat/Git or reuse the production OAuth client.
2. Designate three real existing Google accounts: **author**, **reviewer belonging to another human**, and **login-permitted but private-community-excluded account**. State the private community and intended rights. Email designates the intended user; trust is established only from the verified OIDC issuer/subject. A second account owned by the author is not independent human review.
3. Complete actual HumHub first boot/REST/native migrations, private community IDs, memberships, scoped review grants, per-user tokens and protected subject-to-member mappings. The ready HumHub database is still empty; no fixture users or default sample approvals are substituted.
4. Deploy the app/HumHub only after those guards are satisfied. Verify the full flow and negative cases through the existing 33-screen main interface, then real hosted persistence/operational checks and physical iPhone Safari.

No additional volume-capacity/resource approval is requested. Any future purchasing/payment step remains owner-handled. Scholarly qualifications/financial/construction facts are not certified by generated examples or synthetic CI actors.

## Source preservation and evidence

- Original commit **`9fa7f7a8dbc2687250e75f4514ebc1641994e519`** remains an ancestor.
- Runtime remains byte-equivalent to qualified source **`558cf5c53775d2412ef3d9f8e1fddcdf9e298d22`** outside documentation/plan metadata.
- Activation evidence branch: **`development/ummahconnect-volume-activation-20261017`**, separate from Railway's connected source branch. Pushing this record does not launch an incomplete app/HumHub deployment.
- Evidence: `evidence/2026-10-17-volume-activation/observed-activation.json`, `https-readiness.json`, fresh source logs and the safe architecture screenshot.
- Updated 33-screen counts remain **6 locally Working / 20 UI Only / 7 Blocked**. No social screen is promoted to live completion.
- Approved emerald/ivory/gold/turquoise design, production and Aishu were not modified.
- Original 13-file Mac-M5 recovery remains separate; original edits, stashes and reflogs were not discarded or overwritten.
- Later integrations remain Qdrant/BGE → Docling → PeerTube → charity/mosque in the documented order, with citations and human review.

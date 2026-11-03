# HumHub Community adapter and isolated UI lab

This is the first functional integration slice. It is not a production social platform. The existing Dragon Dawwa application is unchanged.

## Implemented

- Server-only, per-member HumHub client for current identity, visible spaces and paginated space posts.
- Identity check against the expected HumHub user ID before each space/post operation.
- Correct mapping from a space ID to its `contentcontainer_id` before querying posts.
- A field allowlist: account emails, private profile properties, provider URLs and raw content metadata are never forwarded to the UI.
- GET-only requests, rejected redirects, response-size limits, timeouts and safe error messages.
- Standalone Community page in emerald, ivory and gold, responsive CSS, keyboard focus indicators, loading/error/empty states, retry and pagination. Untrusted post text uses `textContent`, never HTML.
- Loopback-only lab with exact Host checks, same-origin restrictions, no-store responses and a restrictive content security policy. It serves one synthetic account configured on the server. It is not multiuser authentication.

## Run without changing the current app

Requires Node 22 or newer. No npm installation is required for this lab.

```bash
node integrations/social/lab-server.mjs
```

Open `http://127.0.0.1:3100` on the same machine. Without configuration, the page explicitly reports that the isolated service is required. It does not invent communities or posts.

To connect, configure these server environment variables through your protected local environment:

| Variable | Purpose |
| --- | --- |
| `SOCIAL_TEST_ISOLATED` | `true` only for a confirmed isolated test instance |
| `SOCIAL_TEST_ORIGIN` | HumHub origin, HTTPS or HTTP loopback; no path/query |
| `SOCIAL_MEMBER_TOKEN` | Per-user bearer token of a synthetic non-admin member |
| `SOCIAL_MEMBER_ID` | That member's numeric HumHub ID |
| `SOCIAL_LAB_PORT` | Optional local port, default 3100 |

These are separate from Gemini/Ummah credentials. The lab does not read your main `.env`. Do not place real credentials in tracked files. If using an ignored local environment file, Node supports `node --env-file=/absolute/path/to/private-social.env integrations/social/lab-server.mjs`.

This loopback lab deliberately rejects forwarded/public hosts. It cannot be opened through an ordinary Codespaces forwarded URL unchanged. Do not widen the bind address or disable the Host checks to publish it. A remote preview needs an authenticated gateway and a real request-bound identity resolver first.

## Adapter contract

`createHumHubClient({origin, token, expectedUserId})` must be constructed server-side from a verified actor's protected identity mapping. The application must never accept `expectedUserId` or a shared privileged token from the browser as authorization. Revoked sessions must be rejected by the eventual gateway before constructing the client.

The client currently exposes only `me()`, `spaces(page)` and `posts(spaceId, page)`. This is a read-only community browser, not a personalized following feed. Comments, reactions, notifications, media and publishing are not implemented here.

The lab API is an isolated contract demonstration:

| Route | Response |
| --- | --- |
| `GET /api/me` | `{id, name}` |
| `GET /api/spaces?page=1` | `{items: [{id, name, description}], total, page, pages}` |
| `GET /api/posts?space=3&page=1` | `{space, items: [{id, message}], total, page, pages}` |

Any write returns 405. These routes are not mounted into Express/Vite. Existing Quran, research and audio routes remain intact.

## Upstream evidence and version selection

Inspected official REST schemas on 12 October 2026:

- https://github.com/humhub/rest/blob/master/docs/swagger/auth.yaml
- https://github.com/humhub/rest/blob/master/docs/swagger/user.yaml
- https://github.com/humhub/rest/blob/master/docs/swagger/space.yaml
- https://github.com/humhub/rest/blob/master/docs/swagger/post.yaml

The adapter follows those inspected schemas; exact installed-version compatibility still needs a live test. GitHub's latest core release endpoint returned `v1.19.0`, while the latest REST release returned `v0.11.7`, whose manifest permits only HumHub `1.18`. The REST master manifest observed earlier was `0.12.5` for HumHub `1.19`, but a `v0.12.5` tag lookup returned 404. Therefore do not install a pair by combining the two “latest release” endpoints. Select and pin a confirmed compatible release pair before provisioning.

## Verification and remaining work

```bash
node --test qualification/social/probe.test.mjs integrations/social/social.test.mjs
```

Fifteen tests passed locally: identity matching, private-space denial, correct container lookup, field projection, input/response validation, provider errors, configuration blocking, read-only behavior and Host/Origin protection. Three adapter/lab tests exercise real local HTTP requests with a controlled mock upstream; this does not certify a live HumHub instance.

No browser binary was available in this workspace, so rendered desktop/mobile visual QA remains unverified. The CSS and markup are implemented, but no screenshot-based claim is made.

Next dependencies:

1. A supported isolated HumHub runtime and pinned core/module pair; no Docker/PHP/Composer is installed here.
2. Two synthetic members, private/public spaces and live qualification checks in `qualification/social/README.md`.
3. Existing identity reconciliation and server-enforced member mapping, then mount the adapter behind authenticated Dragon Dawwa routes and reuse this presentation in the main shell.
4. A persistent review queue and publication outbox using the preserved editorial capabilities, plus a HumHub-side rule preventing native/API bypass. Only then enable posting.
5. Elgg qualification against the same required workflows before final engine selection.

Production, payments, domain routing and database migration were not changed.

# UmmahConnect moderation milestone — 15 October 2026

## Decision summary

**Dependency repair and moderation source implementation are complete and tested locally. Real authenticated HumHub staging acceptance is still blocked. The application is not complete and is not approved for production.**

Branch: `development/ummahconnect-moderation-20261015`, based on preserved handoff `b09becb513c2701113f28c1bbc5a9151e45ebeff`. This is a new continuation, not recovery of the original 13 Mac-M5 files. Those files were not discarded or overwritten. The original workspace remains inaccessible. The handoff Git bundle was verified; unrelated Mac mini checkouts were not changed.

Local built preview on the selected Mac mini: **http://127.0.0.1:3307/#/screen-4**. It is loopback-only and has no production/AI/HumHub credentials. This is not a public staging URL or a working authenticated provider flow. The historic owner-private hosted preview has not been updated. The local service must remain running and the Mac mini awake.

## Delivered source

The Vite/esbuild conflict is fixed by aligning esbuild with Vite 8's supported peer range. The regenerated lockfile resolves Vite **8.3.4** and esbuild **0.28.2**. Clean `npm ci`, TypeScript and the production build pass without peer-dependency bypass flags.

The native `ummahreview` extension places `Content::STATE_DRAFT` on the post **before its first save** and adds native Post/Content pre-save guards. It does not save a public post and then hide it. Review decisions require a different authenticated person with membership and an explicit per-space grant, an unchanged content hash and a human note. Approval uses HumHub's state service; rejection remains a draft. Scheduling/native-route publication attempts and normal edits/moves of tracked reviewed content are guarded. Actual native framework behavior still needs live qualification.

Review rows, posts and citations live only in HumHub. There is no parallel social database. The app gateway adds per-member identity matching, same-origin bounded JSON, role gates, reviewed-only feeds/direct details, error redaction and idempotency. An isolated auth transport preserves the original OIDC/session authority rather than creating new logins. Production origins are rejected.

The approved emerald, ivory, gold and turquoise interface remains the main app. Login readiness, submission, detail and human review are integrated into screens **2, 5, 6 and 33**; home/community routes use the existing gateway. All financial, construction and scholarship examples retain their non-genuine labels. A human community review is not automatically verified scholarship.

## Verified results

| Verification | Result |
|---|---|
| Clean dependency install | PASS |
| Full TypeScript check | PASS |
| Main build | PASS; existing bundle-size warning remains |
| Service/integration tests | **44 passed, 0 failed** |
| Bundled Worker staging tests | **3 passed, 0 failed** |
| PHP grammar parsing | **5 files passed**; no native PHP execution |
| Actual built 33-screen Chrome audit | **33 passed**, no page errors or horizontal overflow |
| Screenshots | Six actual browser captures; 390×844 emulation plus 1440-pixel desktop |
| Real live staging flow | **BLOCKED**; runner exit 2 with missing prerequisites |
| Real iPhone Safari | **NOT RUN**; emulation is not hardware acceptance |

The two-identity moderation test uses a real local HTTP gateway with a **controlled provider**. It proves application contract behavior, not an installed HumHub or real OIDC callback. Native migration, concurrency/rollback, default HumHub route bypass and permission behavior are not yet qualified.

## Exact blockers to unlock live acceptance

An authorized isolated HTTPS host and a running compatible HumHub **1.19 + REST 0.12.4** PHP/MySQL/storage instance are needed. REST artifact SHA-256 is `6180260e042bdc336584eff07271d6af1981d64ef8ed5d00dc4c445f29e3417d`; installed/runtime-qualified remains false. Enable the supplied module only with explicit staging environment and community IDs.

The staging account authority needs a separately reviewed configuration contract because the Railway source hard-codes project/environment/schema guards. Provide isolated OIDC client/callback registration, separate session secret/store and actual existing-account role records. Do not disable the production guards or copy production secrets. Configure `UMMAH_SOCIAL_ENVIRONMENT`, `UMMAH_PUBLIC_ORIGIN`, `UMMAH_IDENTITY_ENVIRONMENT`, `UMMAH_IDENTITY_ORIGIN`, `HUMHUB_ORIGIN`, and a protected mode-0600 `UMMAH_ACCOUNT_MAP_FILE`.

Two actual accounts with different permissions, separate member tokens, a permitted community, explicit author/reviewer grants and an excluded community are required. The real runner additionally requires `UMMAH_LIVE_STAGING_URL`, `UMMAH_TEST_AUTHOR_COOKIE`, `UMMAH_TEST_REVIEWER_COOKIE`, `UMMAH_TEST_SPACE_ID`, and `UMMAH_TEST_FORBIDDEN_SPACE_ID`, supplied as protected staging secrets—not Git/chat. Currently all five are missing.

After connection, test existing-account login → community → submission → independent human review → approved member visibility, plus rejection, self-review denial, excluded users, retries, native publish/schedule/edit/move attempts, MySQL rollback/concurrent decisions, logout/revocation and physical iPhone Safari. See the module README for exact installation/qualification steps.

## Remaining roadmap and boundaries

The running Railway commit/configuration is still not verified in an authenticated dashboard. Source-level auth/DB reconciliation is recorded in RECONCILIATION.md. Production and Aishu have not been touched. Qdrant/BGE retrieval → Docling ingestion → PeerTube media → charity/mosque workflows remain pending in that documented order; selected services/models are not installed, connected or qualified. Keep source citations and human scholarly review throughout. No production deployment is included or authorized.

Use TEST-RESULTS.md for full evidence, COMPLETION-MATRIX.md for all 33 screen statuses, STAGING.md for the actual preview limitations, BACKEND-GAPS.md for outstanding contracts and `integrations/social/humhub-ummahreview/README.md` for operator setup.

# Private staging handoff

Preview: https://ummahconnect-integration-staging.feroz1890.chatgpt.site

Source branch: https://github.com/fairoosansar-coder/dragon-dawwa-engine/tree/integration/ummahconnect-33

This preview is a separate, owner-private Site. It hosts the integrated main application and imports the existing Dragon Dawwa service functions through an isolated staging adapter. It is not the Community Lab, an iframe of the prototype, or a production traffic change. Sign in with the owning ChatGPT account to access the private preview.

No production credentials, database, accounts or HumHub tokens were copied. The deployment has no AI service key and no linked social member, so the UI displays those limits and the server refuses to fabricate results. The existing Node/Express production path is preserved.

Review COMPLETION-MATRIX.md for all 33 screens, BACKEND-GAPS.md for missing contracts, RECONCILIATION.md for source revisions and implementation decisions, and TEST-RESULTS.md for evidence and remaining device gates.

The approved rich emerald/ivory/gold/turquoise theme and supplied prototype were retained. All 33 screens are part of the main route/navigation system. Quran, Tafsir, prayer, research/dossiers and podcasts reuse existing components. The five mosque sections are Current Site, Proposed Design, Construction, Finances and Donations. Local preferences and drafts remain browser-local. Every financial/project example is labelled illustrative.

Status at handoff: 6 Working, 20 UI Only, 7 Blocked. UI integration is available for review; this is not an assertion that all business capabilities are production complete. Real iPhone Safari and live authenticated service acceptance remain release gates.

## 2026-10-15 continuation preview

The preceding URL and branch describe the historical handoff. That hosted deployment **has not been updated** by this continuation.

Current built application preview: http://127.0.0.1:3307/#/screen-4, running on the selected Mac mini only. This is a loopback-only Express service with no production credentials. It is not a public HTTPS staging deployment or a working authenticated HumHub instance. It persists only while the local service and computer remain running. It returns `reviewEnabled=false`, `401 social_account_link_required` for social reads and `405 social_writes_not_enabled` for writes in the unconfigured default mode.

Branch: `development/ummahconnect-moderation-20261015`. Reproduce with Node 24.21.0: `npm ci`, `npm run lint`, `npm run build`, then `PORT=3307 UMMAH_LOCAL_STAGING=true node --import tsx server.ts`. Real staging requires the exact variables, isolated services and account grant contract in `integrations/social/humhub-ummahreview/README.md`. Run `node scripts/test-live-social.mjs` only with protected staging test configuration; it records BLOCKED when prerequisites are missing. Do not supply cookies/tokens in Git or chat.

The Worker can be bundled and regression-tested locally without the absent `.openai/hosting.json`. The script explicitly labels such a bundle test-only and does not generate a replacement hosting manifest. Its write-disabled defaults are unchanged. A separately configured HTTPS host, identity authority and qualified HumHub install are needed before there is a working live-flow URL. Physical iPhone Safari remains untested.

# First real Author submission — 18 October 2026

## Verified milestone

The owner supplied the main-interface screenshot of **submission #1**, “testing my work”, in private **UmmahConnect Staging Review**. It shows successful submission and the Author’s own pending item. This is supplied real-user browser evidence, not an agent-generated or mocked UI result. Its browser/device identity is not established; it is **not physical iPhone Safari evidence**.

Independent protected read-only observation at **2026-10-18T14:49:56.776Z** confirmed:

| Native check | Actual result |
|---|---|
| Author own submissions | HTTP 200; one result: native post `1`, review row `1`, `status=pending`, `state=10`, one source reference |
| Independent Reviewer queue | HTTP 200; the same pending post/review `1`, `state=10` |
| Author approved feed | HTTP 200; zero results |
| Reviewer approved feed | HTTP 200; zero results |

Pinned HumHub `Content::STATE_DRAFT = 10` (`protected/humhub/modules/content/models/Content.php:138`). Own submissions and queue enforce matching pending/draft state. The first real post is saved in HumHub, remains a **draft**, and is excluded from both approved feeds. No approval or rejection is recorded by this check.

App source remains `dae5c666b6b54575ddf2879f2d253f5ec52d121a`, deployment `5a1820b2-36f1-405f-9ef8-3e9a1d98bb34`. Native source remains `44ee3bb5f39b275de84832e15fa02ae82c7b14f7`. Both roles remain active. This observation performed only scoped identity SELECTs and native GETs; it created **no session, post, membership or review decision**. The agent did not use the Reviewer credential to approve/reject. No deployment, source, database privilege, resource, production or Aishu change occurred.

## Next independent human action

The different person using **admin@aegisintelligence.group** should sign into the main staging app, open **Admin & Moderation (screen 33)** and review pending submission #1. Decisions require a reviewer note.

The screenshot’s source is **`https://ummah-ap`**. It is a single-label/test-looking URL, not established as a usable original scholarly source. HTTPS syntax acceptance does not verify a citation. Recommended test order:

1. Reviewer enters a note such as **“Test rejection: source reference is incomplete; replace with a usable original source.”** and chooses **Reject — keep unpublished** for #1.
2. Author refreshes their own submissions. It should show **Rejected submission #1**, still unpublished and absent from the approved feed.
3. Author submits a new clearly labelled staging test with an actual appropriate source URL. The independent human checks unchanged text/reference and, if appropriate, chooses **Approve unchanged post** with a note.
4. Verify only the approved item becomes visible in permitted members’ feed/detail; #1 remains excluded.

This is recommended next action, **not an executed decision**. A technical test must not be represented as genuine verified scholarship.

## Remaining acceptance gates

Independent human review UI/login, actual rejection and approval, approved permitted visibility, real Author self-review denial and third excluded-account access checks still need hosted human evidence. Earlier synthetic/controlled denial tests do not replace these actual tests. A third real community-excluded participant remains needed. Physical iPhone Safari is not run. The source-approved emerald/ivory/gold/turquoise design and all 33 classifications remain **6 locally Working / 20 UI Only / 7 Blocked**; partial Author submission acceptance does not make the social milestone or full application complete.

Original 13-file recovery stays separate. Later Qdrant/BGE, Docling, PeerTube and charity/mosque work remains in documented milestone order.

Evidence: `evidence/2026-10-18-first-real-submission/hosted-observation.json` and the unchanged user-supplied `user-author-pending.png`.

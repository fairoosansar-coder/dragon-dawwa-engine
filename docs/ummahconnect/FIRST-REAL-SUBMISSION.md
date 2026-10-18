# First real Author submission — 18 October 2026

## Verified milestone

At **2026-10-18T16:08:02.788Z**, a guarded GET/SELECT-only main-app-console observation found active native Author `user1` and Reviewer `user3`, with app source `dae5c666b6b54575ddf2879f2d253f5ec52d121a`, deployment `5a1820b2-36f1-405f-9ef8-3e9a1d98bb34`, and native source `44ee3bb5f39b275de84832e15fa02ae82c7b14f7`. The agent created **no** sessions, posts, decisions or roles. Native state records two actual test outcomes:

| Native check | Actual result |
|---|---|
| Post/review #1 | `APPROVED`, state `1`; submitted 2026-10-18 14:47:18 UTC; reviewed 16:03:02 UTC; `sourceCount=1` |
| Post/review #2 | `REJECTED`, state `10`; submitted 2026-10-18 16:00:04 UTC; reviewed 16:02:50 UTC; `sourceCount=0` |
| Author own submissions | Default listing returns rejected #2 only; `includeApproved=1` returns both |
| Reviewer queue and role boundaries | Reviewer queue is HTTP 200/total 0; Author queue is 403 and Reviewer own submissions are 403 |
| Approved feeds and details | Both approved feeds are HTTP 200/total 1 and contain only #1; approved-only detail is 200 for #1 and 404 for #2 |
| Stored content check | Native listing confirms the approved text/source is consistent with stored content; content fields were not printed |

The owner reports that a different human saw both items and approved one and rejected one for testing. That human attestation is corroborated by the native state, but it is **not** an agent-witnessed main-UI click. A separate **SELECT-only native audit passed at 2026-10-18T16:11:09Z** against native source `44ee3bb5f39b275de84832e15fa02ae82c7b14f7` / deployment `934b51d6-7c64-4d51-94a4-cbc4504ff0f7`. All nine invariant checks are true: exactly two review records map to distinct Author `1` and Reviewer `3`; the content is private and unscheduled; required decision metadata is nonempty without values printed; stored message/audit-version integrity holds without hashes printed; and scoped grants are Author submit-only and Reviewer review-only. Events 5/6 committed #2 rejected at 16:02:50 UTC, events 7/8 committed #1 approved at 16:03:02 UTC, and every decision event actor is Reviewer `3`. This proves the linked native decision actor, not the physical human; that person basis remains the owner designation/report. Native GET feed/detail visibility is verified, while authenticated main-UI feed/detail reload screenshots or attestation are still needed. The approval is a test outcome, **not scholarly certification**: #1's initial test source remains not established as a usable verified scholarly citation, and #2 has no sources.

### Historical initial observation — 2026-10-18T14:49:56.776Z

The following earlier protected read-only observation is retained as history. At that timestamp, #1 had not yet received either recorded decision:

| Native check | Actual result |
|---|---|
| Author own submissions | HTTP 200; one result: native post `1`, review row `1`, `status=pending`, `state=10`, one source reference |
| Independent Reviewer queue | HTTP 200; the same pending post/review `1`, `state=10` |
| Author approved feed | HTTP 200; zero results |
| Reviewer approved feed | HTTP 200; zero results |

Pinned HumHub `Content::STATE_DRAFT = 10` (`protected/humhub/modules/content/models/Content.php:138`). At the time of that historical observation, own submissions and queue enforced matching pending/draft state; no approval or rejection was then recorded.

## Historical recommended next action and actual outcome

The following was the **then-recommended** sequence after the pending-only observation; it was not an executed decision plan:

1. An independent Reviewer would reject #1, keeping it unpublished.
2. The Author would refresh own submissions and observe rejected, unpublished #1 absent from the approved feed.
3. The Author would submit a new clearly labelled staging test with an appropriate source, for independent unchanged-content review and, if appropriate, approval.
4. Verification would show only the approved item in permitted members' feed/detail and #1 still excluded.

**Actual result differed from that recommendation:** the owner reports that a different human saw both items, **approved #1 for testing** and **rejected #2 for testing**. The guarded 16:08 native observation corroborates those final states; the later 16:11 SELECT-only audit verifies the linked native decision actor, while neither check proves the UI click or physical human. The historical source caveat remains: the screenshot's source is **`https://ummah-ap`**. It is a single-label/test-looking URL, not established as a usable original scholarly source; HTTPS syntax acceptance does not verify a citation.

## Remaining acceptance gates

No new reviewer identity is required: the SELECT-only audit verifies that the actual linked Reviewer performed the recorded decisions. Remaining acceptance is authenticated main-UI feed/detail reload screenshots or attestation, real Author main-UI self-review denial, sign-out/revocation acceptance and physical iPhone Safari. The third real sign-in-permitted, community-excluded tester is not designated, enrolled or tested. The earlier photographed unmatched account reference remains without a grant and was not inferred auto-enrolled; no account mapping changed. Prior source/container CI is qualification evidence, not fresh human proof.

The source-approved emerald/ivory/gold/turquoise design and all 33 classifications remain **6 locally Working / 20 UI Only / 7 Blocked**. No screen is promoted: this narrow human test outcome is **not** all-screen completion. Production, Aishu, resource caps/volumes and account mappings remain unchanged. Original 13-file recovery stays separate; Qdrant/BGE, Docling, PeerTube and charity/mosque work remain in documented milestone order.

Evidence: `evidence/2026-10-18-first-real-submission/hosted-observation.json`, the unchanged user-supplied `user-author-pending.png`, [HUMAN-DECISIONS.md](HUMAN-DECISIONS.md), and `evidence/2026-10-18-human-decisions/hosted-observation.json`. `evidence/2026-10-18-human-decisions/native-decision-audit.json` records the passed SELECT-only actor audit.

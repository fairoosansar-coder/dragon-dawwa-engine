# First real human approval and rejection — 18 October 2026

**Post #1 is approved and published. Post #2 is rejected and remains a private draft.** The owner reports that the previously designated different human Reviewer saw both items and tested both decisions successfully. Protected hosted reads corroborate the saved states, permitted visibility and the distinct native decision actor. The agent made no approval or rejection.

Staging application: [UmmahConnect](https://ummah-app-staging.up.railway.app). The human review queue is [screen 33](https://ummah-app-staging.up.railway.app/#/screen-33); [screen 11](https://ummah-app-staging.up.railway.app/#/screen-11) is Community Directory, not the pending queue.

## Actual hosted results

The guarded app-console verifier completed at **2026-10-18T16:08:02.788Z**. All 13 native GET responses match the recorded expected outcomes:

- Post/review **1**: `approved`, HumHub published `state=1`; submitted **14:47:18 UTC**, approved **16:03:02 UTC**, one source reference.
- Post/review **2**: `rejected`, HumHub draft `state=10`; submitted **16:00:04 UTC**, rejected **16:02:50 UTC**, zero source references.
- Author and Reviewer approved feeds each return HTTP **200**, total **1**, containing only post #1.
- Approved-only detail for #1 returns **200** for both members. Detail for rejected #2 returns **404** for both, including its Author.
- Author own default submissions return **200** with rejected #2 only. Opting into approved own submissions returns both records. This separate own-submission route does not publish rejected content.
- Reviewer queue returns **200**, total **0** after both decisions. Author queue returns **403**; Reviewer own-submission access returns **403**.

The approved feed text and source array match the Author's stored submission projection for both permitted readers. Content text, source values, identity references and bearer credentials are not included in the evidence JSON.

## Persisted decision actor and version checks

A guarded **SELECT-only PDO query**, without Yii, completed on the isolated native service at **2026-10-18T16:11:09Z**. All **nine** invariants passed. Both review rows record **Author native user 1 / Reviewer native user 3**, with nonempty review notes. Both contents retain private visibility `0` and have no scheduled publication. Stored message hashes remain intact; the committed submission and decision audit version hashes match for each post. Hashes and note text were not exported.

Native decision audit events **5/6** record the started/committed rejection of review #2 at **16:02:50 UTC**. Events **7/8** record the started/committed approval of review #1 at **16:03:02 UTC**. All four events name actor **3**, distinct from Author **1**. Scoped grants remain Author submit-only and Reviewer review-only, not administrator.

This proves which mapped native account committed the decisions. The fact that a different physical human operated that account rests on the owner's designation and report; the agent did not witness the browser clicks. The earlier photographed uninvited reference was not enrolled or granted access by this verification. These actual decisions are attributed to the already linked Reviewer, not presumed to resolve that reference mismatch.

## Exact live versions and previous qualification

Application source remains **`dae5c666b6b54575ddf2879f2d253f5ec52d121a`**, deployment **`5a1820b2-36f1-405f-9ef8-3e9a1d98bb34`**. Native HumHub source remains **`44ee3bb5f39b275de84832e15fa02ae82c7b14f7`**, deployment **`934b51d6-7c64-4d51-94a4-cbc4504ff0f7`**. This documentation update is not a new runtime deployment.

Previous source qualification recorded **80 app / 35 identity-privacy tests**, lint and build passing. Exact app [CI 39125043697](https://github.com/fairoosansar-coder/dragon-dawwa-engine/actions/runs/39125043697) also qualified disposable native **36 HTTP / 16 model** checks and private bootstrap/restart boundaries. Those are earlier controlled source/container results, not today's human acceptance or a fresh rerun. The prior induced 12-second login-retry Chromium test is described in [LOGIN-DEADLINE.md](LOGIN-DEADLINE.md), not presented as physical Safari evidence.

## Evidence and preservation

The evidence directory is [evidence/2026-10-18-human-decisions](evidence/2026-10-18-human-decisions/): [hosted-observation.json](evidence/2026-10-18-human-decisions/hosted-observation.json), [native-decision-audit.json](evidence/2026-10-18-human-decisions/native-decision-audit.json) and the separately attributed [human-attestation.json](evidence/2026-10-18-human-decisions/human-attestation.json).

[Native audit console screenshot](evidence/2026-10-18-human-decisions/native-audit-console.webp) is an actual technical provider-console capture, not a human-review interface screenshot or an iPhone screenshot. The unchanged user-supplied first pending-submission screenshot remains with [FIRST-REAL-SUBMISSION.md](FIRST-REAL-SUBMISSION.md); its device/browser identity is not established.

Verification used existing protected maps and scoped database roles, only identity/native SELECTs and native GETs. Temporary probe files were mode 0600 inside mode 0700 directories and removed after execution. No session, post, decision, user, membership, role, token or grant was created. No service/deployment setting, resource cap, volume, production or Aishu change was made. The approved design is unchanged; original 13-file recovery remains separate and unrecovered.

## Remaining acceptance gates

This is a **verified technical approval/rejection milestone**, not release completion. Both decisions were explicitly for testing. Approval of #1 does not certify scholarship: its initial test-looking source has not been established as a usable scholarly citation, and the native HTTPS syntax check is not source verification.

Next, Author and Reviewer should refresh the main community feed/detail and confirm that only #1 is visible there, while #2 remains in the Author's own rejected submissions. Authenticated main-UI visibility screenshots or attestation are still needed. Real human self-review denial and logout/revocation acceptance remain separate checks; today's Author queue 403 is not a newly executed self-review POST test.

A third real Google tester must still be designated, verified and enrolled for **login only, with no community mapping, native user, membership or grant**. Its actual signed-in community/post/queue denials remain untested. **Physical iPhone Safari has not run.** Record real hardware, iOS/Safari identity and screenshots separately after the three-participant flow is complete.

The [33-screen matrix](COMPLETION-MATRIX.md) remains **6 locally Working / 20 UI Only / 7 Blocked**. No screen or the whole application is promoted on this narrow evidence. Qdrant/BGE retrieval, Docling, PeerTube and charity/mosque workflows remain pending in their documented order. No production deployment is authorized by this milestone.

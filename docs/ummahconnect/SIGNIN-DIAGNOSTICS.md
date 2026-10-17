# Staging sign-in diagnostics — 17 October 2026

The designated independent reviewer reported **Sign-in is temporarily unavailable**. Its exact original failure stage/cause is not established. The current task browser was blank, so it did not preserve that attempt. The reviewer email is designated but its verified Google subject reference and scoped review-only enrollment are still pending.

Current actual anonymous checks passed: application health 200, `/api/review/session` 401, `/login` 200 and `/auth/login` 302. A SELECT-only operator probe in the actual app confirmed the isolated identity marker, an absent-subject lookup returning null, one protected author-map entry, and the existing author role active. Fresh Google discovery returned 200 in 691 ms; fresh Google login start returned 302. No account, role, post, decision or session was written by those diagnostics. An initial temporary probe outside the identity package could not resolve mysql2; the correctly placed dependency-directory probe passed. Both temporary files were removed.

A missing reviewer invitation is not a source-level explanation for that generic 503: a valid verified but uninvited callback returns **403 Invitation required**, no app session, and a subject-derived non-secret reference. Do not infer authorization from email, Google Testing-list membership, or an account named admin.

## Scoped improvement, not an invented root-cause fix

The dedicated unbound development branch adds a privacy-safe wrapper around the existing staging Google authority. It does not edit the vendor authority, session or revocation code. The original provenance tests must remain passing. Discovery cache, state/nonce/PKCE/signature/email verification, subject mapping, scoped roles, cookies and revocation semantics remain unchanged. Token exchange is never retried.

Only an existing generic temporary-unavailable 503 receives a server-generated `uc-auth-` reference containing 16 hex characters. The private event contains only a fixed event name, phase and that reference. It logs no exception text, query, Google code/state, cookie/token, client secret, email or subject. Logger failure cannot grant access or hide the safe response. All other outcomes remain the original authority outcomes, including 403 uninvited/disabled, 400 invalid flow and 302 admitted login.

Synthetic callback tests distinguish discovery failure, token/code-grant failure, role-store failure, absent database, safe session issuance and uninvited identities. Actual loopback HTTP tests distinguish the authority's correlated 503 from a socket-reset transport outage. These are source/ephemeral tests, not genuine reviewer login or human review acceptance.

Deployment is blocked until the exact diagnostic revision passes pinned Node-24/source/native/container qualification. Deploy only the isolated app afterward; leave native source, its private data, production, Aishu, volume envelope and original-file recovery unchanged. If the issue repeats, correlate its safe reference with private stage-only logs and use a new Google flow; never replay a consumed callback code or bypass invitation/identity checks.

## Verified activation

The owner confirmed the symptom appeared before Google opened. This narrows the failed original operation to login-start discovery/flow; it does not identify the exact original exception. App 5b8c72187b47d1aa8ada60dd8ff13d634d4f38b4 is deployed as a61b81a7-3811-4572-86a2-d4286e64f861 after exact CI 39043950586 passed. Protected source hashes and actual Node 24.21.0 match; author mapping and role persist. Fresh genuine SDK login start returned 302. Diagnostics are deployed, not a claim that the earlier cause is repaired or that a reviewer has signed in. A fresh human attempt is still needed.

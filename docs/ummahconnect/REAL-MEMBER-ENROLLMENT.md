# Verified real-member enrollment — isolated staging only

The first designated Author has supplied the non-secret reference emitted by a successful Google identity verification. That callback intentionally created no session because no invitation existed. The reference is retained only in the private operator record; email is never the application identity key.

## New operator source

`scripts/provision-native-member.php` requires CLI execution as www-data and exact staging project/environment/native service, private database, scoped SQL principal and an enabled ownerless private community. It accepts one mode-0600 request file, uses native User/Membership/RestUserBearerToken lifecycles, creates no password or administrator permission, and grants one role in space 1: Author submit-only; Reviewer review-only. It rejects duplicates and writes a private persistent provenance journal without plaintext bearer credentials. Seven-day native bearer material is emitted only in an RSA-OAEP-SHA256/AES-256-GCM encrypted envelope.

`scripts/enroll-staging-identity.mjs` first inserts the verified reference into the existing isolated identity authority as a disabled author/reviewer role. Activation is separate: the protected schema-v1 member map must be present, the native bearer must resolve to its expected UID and private space, approved-feed access must work, and author/reviewer API privileges must match the intended narrow role. The script then rechecks the map hash and enables only the exact operator-staged role in a scoped SQL transaction. It mints no session and creates no posts or human reviews.

## Ordered hosted operation after exact CI passes

1. Confirm the existing deployed native/app revisions and account-free native state with protected SELECT-only checks.
2. Stage the first verified Author role disabled, using only the approved reference.
3. Provision the one real Author through the qualified native helper, passing a browser-controlled public key. Keep its private key non-exportable and transient. Never print plaintext token material.
4. Decrypt the envelope inside protected provider browser memory; validate the reference, role and native UID. Persist only that member entry in protected ummah-app settings. Preserve existing entries and credentials.
5. Restart only ummah-app from its already-qualified source so its private account-map file is rebuilt. Native source and all databases/volumes remain unchanged apart from the authorized one-member enrollment.
6. Run the guarded identity activation. The Author must have submit permission, approved-feed access and own-pending access, but no queue/review permission.
7. Perform a fresh real Google login, then verify the actual main interface and draft-first submission. Do not use native password login.
8. The separate designated human Reviewer must independently provide their verified Google reference before their corresponding enrollment. Do not create an email-keyed identity or perform their human acceptance decision automatically.

## Qualification boundaries and preservation

Local application source tests: 63 passed; existing identity tests: 19 passed; TypeScript lint/build and PHP/shell/Node syntax passed. A database-free encrypted-envelope round-trip passed with no member creation. Exact operator revision `56b797a2be2f24ea54587dad1c6e611c79b88e18` passed non-deploying CI 39033827738: 36 HTTP, 16 model cases and seven native/member/actual identity SQL checks. Failed/superseded qualification is preserved in evidence; the MySQL reserved alias was corrected without weakening its scoped-principal check.

The CI helper tests run exclusively in disposable Docker/MySQL. They use synthetic references and accounts, test native role separation, encrypted bearer transfer, transaction rollback, duplicate refusal, draft-first submission, and actual scoped identity SQL staging/activation. They are not hosted Google login, human review or physical iPhone Safari evidence.

After qualification, one real Author native member and its author-only identity activation were created. No post or human review was created. Fresh post-invitation Google application-session acceptance remains pending; its current chooser shows Signed out. No production, Aishu runtime, new hosted volume or original-file recovery work is changed. The 33-screen design and hosted-human acceptance statuses remain unchanged. Retrying a committed enrollment is deliberately refused; an orphaned private journal after a crash must be reconciled against SQL before any operator cleanup. Native bearer expiration/rotation remains an explicit operational responsibility and must never be silently renewed or disclosed.

## Actual hosted Author outcome

Native user 1 has one normal membership in private space 1, `can_submit=1`, `can_review=0`, no administrator group, password, post or review creation. The encrypted envelope was decrypted only inside protected browser memory. Only `UMMAH_ACCOUNT_MAP_JSON` changed in app settings; other credentials/settings were preserved. Actual map file has schema 1, one enabled member, mode 0600 and UID 1000. Guarded activation passed native current-user/private-space/approved-feed/own-pending GET 200 and author review-queue GET 403, then enabled only the staged author row.

App executable source remains `afb3e234b4b1e13f7516d879c15957e0b18dcc7f`; native remains `44ee3bb5f39b275de84832e15fa02ae82c7b14f7`. The provider deployment view listed `a23d2272-162f-4e22-8206-b6dd2ee6f386`, while the authenticated console reported `e2e65153-f98d-415a-acce-90da1c8a1492`; unique correlation of the map restart is not independently resolved. Exact source and loaded member-map proof are retained separately instead of claiming a new source deployment.

A transient /auth/login 503 was observed during restart; later actual login returns 302. The declared anonymous session endpoint is `/api/review/session` (401). `/api/identity/session` was an audit typo returning HTML, not an authenticated session. Transient plaintext/key/source browser memory and owned encrypted source transfer service were cleared/stopped; temporary operator files were removed. Persistent native enrollment provenance is retained.

Next: the Author performs fresh Google login; the independently designated Reviewer supplies their own verified reference. Never substitute its email, make it administrator, or perform a human acceptance decision automatically. Excluded-account and physical-device gates remain.

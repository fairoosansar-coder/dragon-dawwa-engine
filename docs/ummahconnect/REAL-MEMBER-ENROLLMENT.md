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

Local application source tests: 63 passed; existing identity tests: 19 passed; TypeScript lint/build and PHP/shell/Node syntax passed. A database-free encrypted-envelope round-trip passed with no member creation. Actual native/member/identity SQL qualification is pending on the dedicated non-deploying `development/ummahconnect-real-member-provisioning-20261017` branch.

The CI helper tests run exclusively in disposable Docker/MySQL. They use synthetic references and accounts, test native role separation, encrypted bearer transfer, transaction rollback, duplicate refusal, draft-first submission, and actual scoped identity SQL staging/activation. They are not hosted Google login, human review or physical iPhone Safari evidence.

No real native member, role activation or application session has been created by this source milestone. No production, Aishu runtime, new hosted volume or original-file recovery work is changed. The 33-screen design and hosted-human acceptance statuses remain unchanged. Retrying a committed enrollment is deliberately refused; an orphaned private journal after a crash must be reconciled against SQL before any operator cleanup. Native bearer expiration/rotation remains an explicit operational responsibility and must never be silently renewed or disclosed.

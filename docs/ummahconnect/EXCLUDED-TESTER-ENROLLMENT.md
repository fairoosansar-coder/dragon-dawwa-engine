# Excluded tester enrollment — login allowed, no community map

## Diagnosis (20 October 2026)

Owner evidence shows a third Google account reaching the intentional invitation gate:

- Screenshot: store media `iphone-05-third-tester-blocked.png` (+ `.HEIC`)
- Page title/body: **Invitation required** — identity verified with Google; **no application session** created
- Non-secret account reference from that capture:  
  `google:ahX4JeMajW0X9CuvUZtgpfsRxe17-uLqts4601R9y4k`

This is **expected fail-closed behavior**, not an OIDC or Google Testing-list bug. Google’s basic-identity Testing list is not the app allowlist. The staging identity authority only issues a session when `review_roles` has an **enabled** row for that subject reference (`deployment/staging/identity/vendor/google-auth.mjs`).

Author and Reviewer are already enrolled as community members. The third tester was never invited in identity SQL, so sign-in correctly stops at Invitation required.

## Intended excluded shape

| Layer | Excluded tester |
|---|---|
| Google OIDC | Verifies; may appear on Testing list (optional hygiene) |
| Identity `review_roles` | **`reader`**, `disabled=0` — login-permitted |
| `UMMAH_ACCOUNT_MAP_JSON` / account-map file | **No entry** for this subject |
| HumHub membership / `ummah_review_grant` | **None** — do not run `provision-native-member.php` |
| Social APIs after login | Session may exist; community map/membership remains denied |

Email is **not** the identity key. Enrollment uses only the verified `google:…` subject reference. Do not invent or substitute emails.

## Operator source change

`scripts/enroll-staging-identity.mjs` accepts role **`reader`** in addition to `author` / `reviewer`.

- **stage / activate `reader`:** inserts/enables the identity role only  
- **Does not** require native bearer checks  
- **Refuses activate** if the protected account map already links that subject (`excluded_must_not_be_community_mapped`)

Author/reviewer paths are unchanged.

## Exact owner / operator steps (staging only)

Prerequisites: isolated Railway project `48d7a4cf-…`, staging env `1f7d98bf-…`, ummah-app service `f3756510-…`, identity DB already used for Author/Reviewer. Deploy the commit that includes the `reader` enrollment path before activating a reader role with the new script behavior.

1. Confirm privately that the third tester’s Invitation required screen still shows  
   `google:ahX4JeMajW0X9CuvUZtgpfsRxe17-uLqts4601R9y4k`  
   (or capture a fresh reference if they re-authenticated and the hash changed — rare; treat a new reference as a new enrollment).
2. Optionally add that Google account to the staging OAuth client Testing users list for hygiene only — it does **not** grant app access.
3. On the identity/app operator surface, write a mode-`0600` enrollment input (example — replace nothing except confirm the reference):

```json
{
  "kind": "verified-ummah-identity-enrollment",
  "subjectReference": "google:ahX4JeMajW0X9CuvUZtgpfsRxe17-uLqts4601R9y4k",
  "role": "reader",
  "spaceId": 1,
  "operation": "stage"
}
```

4. Run `scripts/enroll-staging-identity.mjs` (same guarded CLI / env as Author enrollment) with `operation: "stage"`, then again with `operation: "activate"`.
5. **Do not** call `scripts/provision-native-member.php` for this subject.  
6. **Do not** add this subject to `UMMAH_ACCOUNT_MAP_JSON` / the account-map file.  
7. Third tester signs in again at `https://ummah-app-staging.up.railway.app/login` → expect an application session (no Invitation required).  
8. Acceptance checks: `/api/review/session` shows a user with role `reader`; social community/feed/queue paths remain denied (no map / no membership). Capture evidence.

If the operator needs an email for Google Testing-list hygiene only, ask the coordinator for the real third-tester address — **do not invent one**. Identity enrollment itself does not require email.

## Out of scope

- Production Dragon Dawwa / railway-deploy  
- Auto-invite by email  
- Granting Author/Reviewer rights or private-space membership to the third tester  
